"""
ZORVEX Phase 5: AWS Resource Lifecycle Correlation Service
===========================================================
Correlates real AWS resource lifecycle events (CloudTrail API actions such as
EC2 Start/Stop/Terminate and RDS Start/Stop/Snapshot) with measured CUR cost changes.

FinOps Principles:
- Never fabricates causality: distinguishes verified billing facts from correlated events.
- Enforces operational boundaries (e.g. stopping an EC2 instance stops compute, but EBS storage continues).
- Implements authoritative FinOps evidence classifications:
    * CONFIRMED_BY_BILLING_DATA
    * CORRELATED_WITH_AWS_EVENT
    * SUPPORTED_EXPLANATION
    * INSUFFICIENT_EVIDENCE
    * UNAVAILABLE_EVENT_HISTORY
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Set

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .models import ResourceLifecycleEvent

logger = logging.getLogger("zorvex.lifecycle_service")

# Authoritative FinOps Classification Constants
CONFIRMED_BY_BILLING_DATA = "CONFIRMED_BY_BILLING_DATA"
CORRELATED_WITH_AWS_EVENT = "CORRELATED_WITH_AWS_EVENT"
SUPPORTED_EXPLANATION = "SUPPORTED_EXPLANATION"
INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
UNAVAILABLE_EVENT_HISTORY = "UNAVAILABLE_EVENT_HISTORY"

# Target operational lifecycle events of interest
RELEVANT_EVENT_NAMES = {
    # EC2 lifecycle
    "StartInstances",
    "StopInstances",
    "RunInstances",
    "TerminateInstances",
    "ModifyInstanceAttribute",
    # RDS lifecycle
    "StartDBInstance",
    "StopDBInstance",
    "CreateDBInstance",
    "DeleteDBInstance",
    "CreateDBSnapshot",
    "DeleteDBSnapshot",
    "ModifyDBInstance",
    # Networking & Gateways
    "CreateNatGateway",
    "DeleteNatGateway",
    "AssociateAddress",
    "DisassociateAddress"
}


def poll_cloudtrail_lifecycle_events(
    cloudtrail_client: Any,
    db: Session,
    org_id: int,
    start_time: datetime,
    end_time: datetime,
    region: str = "ap-south-1"
) -> Dict[str, Any]:
    """
    Polls AWS CloudTrail lookup_events for relevant EC2, RDS, and infrastructure lifecycle events,
    normalizes the payloads, and persists them into resource_lifecycle_events with deduplication.
    """
    total_found = 0
    total_persisted = 0
    errors = []

    for event_name in RELEVANT_EVENT_NAMES:
        try:
            paginator = cloudtrail_client.get_paginator("lookup_events")
            page_iter = paginator.paginate(
                LookupAttributes=[
                    {"AttributeKey": "EventName", "AttributeValue": event_name}
                ],
                StartTime=start_time,
                EndTime=end_time
            )

            for page in page_iter:
                events = page.get("Events", [])
                for ev in events:
                    total_found += 1
                    event_id = ev.get("EventId")
                    ev_time = ev.get("EventTime")
                    ev_time_iso = ev_time.isoformat() if hasattr(ev_time, "isoformat") else str(ev_time)
                    ev_date = ev_time_iso[:10]
                    actor = ev.get("Username") or "AWS Service / Role"

                    # Parse CloudTrailEvent JSON string
                    raw_ct_str = ev.get("CloudTrailEvent", "{}")
                    try:
                        ct_data = json.loads(raw_ct_str)
                    except Exception:
                        ct_data = {}

                    account_id = ct_data.get("recipientAccountId") or ct_data.get("userIdentity", {}).get("accountId", "")
                    service_source = ct_data.get("eventSource", "")
                    err_code = ct_data.get("errorCode")
                    status = "FAILED" if err_code else "SUCCESS"

                    # Determine service label
                    if "ec2" in service_source:
                        svc_label = "AmazonEC2"
                    elif "rds" in service_source:
                        svc_label = "AmazonRDS"
                    else:
                        svc_label = ev.get("EventSource", "AWS")

                    # Extract Resource IDs
                    resources = ev.get("Resources", [])
                    extracted_rids = [r.get("ResourceName") for r in resources if r.get("ResourceName")]

                    # Also inspect requestParameters
                    req_params = ct_data.get("requestParameters") or {}
                    if not extracted_rids:
                        if "instanceIdSet" in req_params:
                            extracted_rids.extend(req_params.get("instanceIdSet", {}).get("items", []))
                        elif "instancesSet" in req_params:
                            extracted_rids.extend(req_params.get("instancesSet", {}).get("items", []))
                        elif "dBInstanceIdentifier" in req_params:
                            extracted_rids.append(req_params.get("dBInstanceIdentifier"))

                    if not extracted_rids:
                        extracted_rids = [f"unknown-target-{event_name}"]

                    # Persist event per affected resource
                    for rid in extracted_rids:
                        clean_rid = str(rid).strip()
                        unique_ev_key = f"{event_id}_{clean_rid}"

                        existing = db.query(ResourceLifecycleEvent.id).filter(
                            ResourceLifecycleEvent.organization_id == org_id,
                            ResourceLifecycleEvent.event_id == unique_ev_key
                        ).first()

                        if not existing:
                            rec = ResourceLifecycleEvent(
                                organization_id=org_id,
                                event_id=unique_ev_key,
                                resource_id=clean_rid,
                                service=svc_label,
                                event_name=event_name,
                                event_time=ev_time_iso,
                                event_date=ev_date,
                                region=region,
                                account_id=account_id,
                                actor=actor,
                                status=status,
                                event_source="aws.cloudtrail",
                                details_json=json.dumps({
                                    "errorCode": err_code,
                                    "errorMessage": ct_data.get("errorMessage"),
                                    "userAgent": ct_data.get("userAgent"),
                                    "sourceIPAddress": ct_data.get("sourceIPAddress"),
                                    "requestParameters": req_params
                                })
                            )
                            db.add(rec)
                            total_persisted += 1

        except Exception as e:
            logger.warning("CloudTrail lookup failed for event %s: %s", event_name, e)
            errors.append(f"{event_name}: {str(e)}")

    if total_persisted > 0:
        db.commit()

    return {
        "total_found": total_found,
        "total_persisted": total_persisted,
        "errors": errors
    }


def ingest_lifecycle_events_batch(
    db: Session,
    org_id: int,
    events: List[Dict[str, Any]]
) -> int:
    """
    Ingests a list of normalized lifecycle events into resource_lifecycle_events for an organization.
    Ensures idempotent insertion and validates required schema fields.
    """
    persisted_count = 0
    for ev in events:
        event_id = str(ev.get("event_id") or ev.get("event_name", "event") + "_" + ev.get("resource_id", "res") + "_" + ev.get("event_time", ""))
        resource_id = str(ev.get("resource_id", "Unassigned"))
        event_name = str(ev.get("event_name", "UnknownEvent"))
        event_time = str(ev.get("event_time", datetime.now(timezone.utc).isoformat()))
        event_date = str(ev.get("event_date") or event_time[:10])
        service = str(ev.get("service", "AWS"))
        region = str(ev.get("region", "ap-south-1"))
        account_id = str(ev.get("account_id", ""))
        actor = str(ev.get("actor", "system"))
        status = str(ev.get("status", "SUCCESS"))
        details = ev.get("details_json")
        if isinstance(details, dict):
            details = json.dumps(details)

        existing = db.query(ResourceLifecycleEvent.id).filter(
            ResourceLifecycleEvent.organization_id == org_id,
            ResourceLifecycleEvent.event_id == event_id
        ).first()

        if not existing:
            db_ev = ResourceLifecycleEvent(
                organization_id=org_id,
                event_id=event_id,
                resource_id=resource_id,
                service=service,
                event_name=event_name,
                event_time=event_time,
                event_date=event_date,
                region=region,
                account_id=account_id,
                actor=actor,
                status=status,
                event_source=ev.get("event_source", "manual_sync"),
                details_json=details
            )
            db.add(db_ev)
            persisted_count += 1

    if persisted_count > 0:
        db.commit()

    return persisted_count


def correlate_resource_lifecycle(
    db: Optional[Session],
    org_id: Optional[int],
    resource_id: str,
    baseline_start: str,
    baseline_end: str,
    target_start: str,
    target_end: str,
    baseline_cost: float,
    target_cost: float,
    delta_cost: float,
    service: str,
    usage_types: Optional[Set[str]] = None
) -> Dict[str, Any]:
    """
    Correlates a resource's cost variance between baseline and target date windows with
    stored AWS lifecycle events (EC2 start/stop, RDS start/stop, volume snapshots).

    Returns a rich correlation dict with:
    - classification: Authoritative FinOps rating
    - has_lifecycle_events: bool
    - matched_events_count: int
    - events: List of matched event objects
    - operational_boundaries: Plain-English explanation of infrastructure behavior
    - explanation: Corroborated FinOps explanation
    """
    if not db or not org_id or not resource_id or resource_id in ("Unassigned", "Unknown", ""):
        return {
            "classification": CONFIRMED_BY_BILLING_DATA,
            "has_lifecycle_events": False,
            "matched_events_count": 0,
            "events": [],
            "operational_boundaries": "Attribution derived strictly from CUR billing line items.",
            "explanation": "Cost variance confirmed by billing line items."
        }

    # Query events matching this resource within the window
    # Search from baseline_start to target_end
    clean_rid = resource_id.strip()
    short_rid = clean_rid.split("/")[-1].split(":")[-1]

    events_query = db.query(ResourceLifecycleEvent).filter(
        ResourceLifecycleEvent.organization_id == org_id,
        or_(
            ResourceLifecycleEvent.resource_id == clean_rid,
            ResourceLifecycleEvent.resource_id == short_rid,
            ResourceLifecycleEvent.resource_id.like(f"%{short_rid}%")
        ),
        ResourceLifecycleEvent.event_date >= baseline_start,
        ResourceLifecycleEvent.event_date <= target_end
    ).order_by(ResourceLifecycleEvent.event_time.desc())

    matched_events = events_query.all()

    if not matched_events:
        # Check if org has any lifecycle events at all to distinguish empty history from unconfigured
        has_any_events = db.query(ResourceLifecycleEvent.id).filter(
            ResourceLifecycleEvent.organization_id == org_id
        ).first() is not None

        classification = CONFIRMED_BY_BILLING_DATA if has_any_events else UNAVAILABLE_EVENT_HISTORY
        note = (
            "No CloudTrail lifecycle actions recorded for this resource during the selected dates. Change driven by usage activity or automated scaling."
            if has_any_events else
            "CloudTrail lifecycle event telemetry is not configured or inactive for this organization."
        )

        return {
            "classification": classification,
            "has_lifecycle_events": False,
            "matched_events_count": 0,
            "events": [],
            "operational_boundaries": "Billed spend strictly governed by AWS Cost and Usage Report (CUR).",
            "explanation": note
        }

    # Extract event summaries
    event_summaries = []
    for ev in matched_events:
        event_summaries.append({
            "event_name": ev.event_name,
            "event_time": ev.event_time,
            "event_date": ev.event_date,
            "actor": ev.actor or "AWS Admin",
            "status": ev.status,
            "service": ev.service,
            "region": ev.region
        })

    # Find primary event
    primary_event = matched_events[0]
    ev_name = primary_event.event_name
    ev_time = primary_event.event_time
    ev_actor = primary_event.actor or "IAM Principal"

    # Analyze operational correlation
    svc_lower = (service or "").lower()
    operational_boundaries = ""
    corroborated_explanation = ""
    classification = CORRELATED_WITH_AWS_EVENT

    # 1. EC2 Instance Actions
    if "ec2" in svc_lower or clean_rid.startswith("i-") or "instance" in svc_lower:
        if ev_name == "StopInstances":
            classification = SUPPORTED_EXPLANATION if delta_cost < -0.05 else CORRELATED_WITH_AWS_EVENT
            corroborated_explanation = (
                f"EC2 instance was stopped via CloudTrail '{ev_name}' at {ev_time} by '{ev_actor}'. "
                f"Compute box usage hours dropped, reducing spend by -${abs(delta_cost):.2f}."
            )
            operational_boundaries = (
                "Operational Boundary: Stopping an EC2 instance stops compute box charges ($0.00). "
                "However, attached EBS storage volumes (gp3/io2), provisioned IOPS, and elastic IP reservations "
                "continue to accrue charges until detached, deleted, or released."
            )
        elif ev_name in ("StartInstances", "RunInstances"):
            classification = SUPPORTED_EXPLANATION if delta_cost > 0.05 else CORRELATED_WITH_AWS_EVENT
            corroborated_explanation = (
                f"EC2 instance was started via CloudTrail '{ev_name}' at {ev_time} by '{ev_actor}'. "
                f"Compute box usage hours increased spend by +${delta_cost:.2f}."
            )
            operational_boundaries = (
                "Operational Boundary: Starting an instance immediately incurs On-Demand or commitment compute charges. "
                "Instance execution also generates CloudWatch metrics and regional network transfer."
            )
        elif ev_name == "TerminateInstances":
            classification = SUPPORTED_EXPLANATION
            corroborated_explanation = (
                f"EC2 instance was terminated via CloudTrail at {ev_time} by '{ev_actor}'. "
                f"Compute hours and root EBS volume ceased."
            )
            operational_boundaries = (
                "Operational Boundary: Termination permanently deletes the instance and any EBS volumes configured with "
                "DeleteOnTermination=True. Unattached EBS volumes and snapshots persist until explicitly deleted."
            )

    # 2. RDS Database Actions
    elif "rds" in svc_lower or ":db:" in clean_rid or "database" in svc_lower:
        if ev_name == "StopDBInstance":
            classification = SUPPORTED_EXPLANATION if delta_cost < -0.05 else CORRELATED_WITH_AWS_EVENT
            corroborated_explanation = (
                f"RDS database instance was stopped via CloudTrail '{ev_name}' at {ev_time} by '{ev_actor}'. "
                f"Database compute hours stopped."
            )
            operational_boundaries = (
                "Operational Boundary: Stopping an RDS database stops database engine compute charges. "
                "Provisioned database storage (gp3/io1), multi-AZ standby storage, and automated snapshot backup retention "
                "continue to be billed."
            )
        elif ev_name in ("StartDBInstance", "CreateDBInstance"):
            classification = SUPPORTED_EXPLANATION if delta_cost > 0.05 else CORRELATED_WITH_AWS_EVENT
            corroborated_explanation = (
                f"RDS database instance was started via CloudTrail '{ev_name}' at {ev_time} by '{ev_actor}'. "
                f"Database compute hours resumed."
            )
            operational_boundaries = (
                "Operational Boundary: Running an Amazon RDS database instance accrues per-second compute usage "
                "based on the instance class."
            )
        elif ev_name in ("DeleteDBSnapshot", "CreateDBSnapshot"):
            classification = SUPPORTED_EXPLANATION
            corroborated_explanation = (
                f"RDS snapshot lifecycle action '{ev_name}' recorded via CloudTrail at {ev_time} by '{ev_actor}'."
            )
            operational_boundaries = (
                "Operational Boundary: RDS snapshot storage (ChargedBackupUsage) is billed per GB-month for backup "
                "data exceeding the 100% database storage allocation threshold."
            )

    # Default fallback for other matched events
    if not corroborated_explanation:
        classification = CORRELATED_WITH_AWS_EVENT
        corroborated_explanation = (
            f"AWS CloudTrail recorded '{ev_name}' at {ev_time} by '{ev_actor}' affecting this resource. "
            f"Measured cost change: {'+$' if delta_cost > 0 else '-$'}{abs(delta_cost):.2f}."
        )
        operational_boundaries = "Correlated infrastructure event observed in proximity to measured CUR billing variance."

    return {
        "classification": classification,
        "has_lifecycle_events": True,
        "matched_events_count": len(matched_events),
        "primary_event": {
            "event_name": ev_name,
            "event_time": ev_time,
            "actor": ev_actor,
            "status": primary_event.status
        },
        "events": event_summaries[:5],
        "operational_boundaries": operational_boundaries,
        "explanation": corroborated_explanation
    }
