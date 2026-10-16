"""
Executive Savings Ledger & Recommendation Lifecycle Engine for ZORVEX FinOps Platform
- Manages complete lifecycle states: IDENTIFIED -> VALIDATED -> APPROVED -> IMPLEMENTED -> AWAITING_VERIFICATION -> VERIFIED (or DISMISSED)
- Synchronizes algorithmic recommendations into persistent relational database
- Prevents double-counting overlapping compute recommendations (e.g. EC2 stop vs Savings Plan)
- Delivers Boardroom-ready realized ROI vs platform retainer cost
"""

import datetime
import json
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from .models import RecommendationRecord
from .forex import get_live_usd_to_inr_rate

def sync_recommendations_to_ledger(db: Session, raw_recs: List[Dict[str, Any]], org_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Ingests algorithmic recommendations from recommendations.py into the persistent ledger.
    Preserves existing user approval/implementation states if already recorded.
    Scoped to organization_id.
    """
    live_forex = get_live_usd_to_inr_rate()
    synced_records = []
    valid_rec_ids = set()

    # 1. Collect all rec_ids
    rec_item_map = {}
    for item in raw_recs:
        rec_id = item.get("id") or f"{item.get('category')}_{item.get('resource_id', 'gen')}"
        valid_rec_ids.add(rec_id)
        rec_item_map[rec_id] = item

    # 2. Batch query existing records in single IN query
    existing_map = {}
    if valid_rec_ids:
        query = db.query(RecommendationRecord).filter(RecommendationRecord.recommendation_id.in_(valid_rec_ids))
        if org_id is not None:
            query = query.filter(RecommendationRecord.organization_id == org_id)
        else:
            query = query.filter(RecommendationRecord.organization_id.is_(None))
        existing_map = {r.recommendation_id: r for r in query.all()}

    has_changes = False
    for rec_id, item in rec_item_map.items():
        existing = existing_map.get(rec_id)
        est_usd = float(item.get("monthly_savings", 0.0) or item.get("estimated_monthly_savings_usd", 0.0))
        est_inr = round(est_usd * live_forex, 2)
        item_title = item.get("title") or item.get("issue") or "Cloud Optimization Opportunity"

        if not existing:
            new_rec = RecommendationRecord(
                organization_id=org_id,
                recommendation_id=rec_id,
                category=item.get("category", "GENERAL_WASTE"),
                title=item_title,
                resource_id=item.get("resource_id", "N/A"),
                service=item.get("service", "AWS"),
                region=item.get("region", "global"),
                account_id=item.get("account_id", "all"),
                status="IDENTIFIED",
                estimated_monthly_savings_usd=est_usd,
                estimated_monthly_savings_inr=est_inr,
                realized_monthly_savings_usd=0.0,
                realized_monthly_savings_inr=0.0,
                confidence_score=float(item.get("confidence_score", 0.92)),
                risk_level=item.get("risk_level", "LOW"),
                evidence_json=json.dumps(item.get("evidence", {}) or {
                    "reason": item.get("reason"),
                    "details": item.get("details"),
                    "last_active": item.get("last_active")
                }),
                remediation_type=item.get("remediation_type", "AWS_CLI"),
                created_at=datetime.datetime.utcnow(),
                updated_at=datetime.datetime.utcnow()
            )
            db.add(new_rec)
            synced_records.append(new_rec)
            has_changes = True
        else:
            # Update title, category and estimated values if still in early stage
            if existing.status in ["IDENTIFIED", "VALIDATED"]:
                if (existing.title != item_title or 
                    existing.estimated_monthly_savings_usd != est_usd or 
                    existing.category != item.get("category", existing.category)):
                    existing.title = item_title
                    existing.category = item.get("category", existing.category)
                    existing.estimated_monthly_savings_usd = est_usd
                    existing.estimated_monthly_savings_inr = est_inr
                    existing.updated_at = datetime.datetime.utcnow()
                    has_changes = True
            synced_records.append(existing)

    # Prune obsolete recommendations from previous datasets that are no longer valid
    if valid_rec_ids:
        stale_query = db.query(RecommendationRecord).filter(
            RecommendationRecord.status.in_(["IDENTIFIED", "VALIDATED"]),
            ~RecommendationRecord.recommendation_id.in_(valid_rec_ids)
        )
        if org_id is not None:
            stale_query = stale_query.filter(RecommendationRecord.organization_id == org_id)
        else:
            stale_query = stale_query.filter(RecommendationRecord.organization_id.is_(None))
        stale_recs = stale_query.all()
        for stale in stale_recs:
            db.delete(stale)
            has_changes = True

    if has_changes:
        db.commit()

    return get_ledger_records(db, org_id=org_id)


def update_recommendation_status(
    db: Session,
    rec_id: str,
    new_status: str,
    user_name: Optional[str] = "Admin",
    notes: Optional[str] = None,
    org_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Transitions a recommendation through its lifecycle.
    Valid statuses: IDENTIFIED, VALIDATED, APPROVED, IMPLEMENTED, AWAITING_VERIFICATION, VERIFIED, DISMISSED.
    Scoped to organization_id.
    """
    valid_statuses = [
        "IDENTIFIED", "VALIDATED", "APPROVED", "IMPLEMENTED", 
        "AWAITING_VERIFICATION", "VERIFIED", "DISMISSED"
    ]
    if new_status not in valid_statuses:
        raise ValueError(f"Invalid status: {new_status}. Must be one of {valid_statuses}")

    query = db.query(RecommendationRecord).filter(RecommendationRecord.recommendation_id == rec_id)
    if org_id is not None:
        query = query.filter(RecommendationRecord.organization_id == org_id)
    rec = query.first()
    if not rec:
        return None

    now = datetime.datetime.utcnow()
    rec.status = new_status
    rec.updated_at = now

    if new_status == "APPROVED":
        rec.approved_by = user_name
        rec.approved_at = now
    elif new_status == "IMPLEMENTED":
        rec.implemented_by = user_name
        rec.implemented_at = now
        # Initial realized assumption equals estimated
        if rec.realized_monthly_savings_usd <= 0.0:
            rec.realized_monthly_savings_usd = rec.estimated_monthly_savings_usd
            rec.realized_monthly_savings_inr = rec.estimated_monthly_savings_inr
    elif new_status == "VERIFIED":
        rec.verified_at = now
        if rec.realized_monthly_savings_usd <= 0.0:
            rec.realized_monthly_savings_usd = rec.estimated_monthly_savings_usd
            rec.realized_monthly_savings_inr = rec.estimated_monthly_savings_inr

    if notes:
        rec.notes = (rec.notes + "\n" + notes) if rec.notes else notes

    db.commit()
    db.refresh(rec)
    return format_ledger_record(rec)


def get_ledger_records(
    db: Session,
    status: Optional[str] = None,
    category: Optional[str] = None,
    org_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Returns stored ledger records with parsed evidence scoped to organization."""
    query = db.query(RecommendationRecord)
    if org_id is not None:
        query = query.filter(RecommendationRecord.organization_id == org_id)
    else:
        query = query.filter(RecommendationRecord.organization_id.is_(None))
    if status and status != "all":
        query = query.filter(RecommendationRecord.status == status)
    if category and category != "all":
        query = query.filter(RecommendationRecord.category == category)

    rows = query.order_by(RecommendationRecord.estimated_monthly_savings_usd.desc()).all()
    return [format_ledger_record(r) for r in rows]


def get_executive_ledger_summary(
    db: Session,
    monthly_retainer_inr: float = 35000.0,
    org_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Calculates executive savings summary without double counting overlapping compute items.
    Scoped to organization_id.
    """
    query = db.query(RecommendationRecord)
    if org_id is not None:
        query = query.filter(RecommendationRecord.organization_id == org_id)
    else:
        query = query.filter(RecommendationRecord.organization_id.is_(None))
    records = query.all()
    live_forex = get_live_usd_to_inr_rate()
    monthly_retainer_usd = round(monthly_retainer_inr / live_forex, 2)

    total_identified_usd = 0.0
    total_approved_usd = 0.0
    total_implemented_usd = 0.0
    total_verified_usd = 0.0

    # Deduplication map to prevent double-counting across overlapping categories
    seen_resources = set()

    for r in records:
        if r.status == "DISMISSED":
            continue

        usd = r.estimated_monthly_savings_usd or 0.0
        r_id = r.resource_id

        # Potential identified includes unique items
        if r_id not in seen_resources or r_id in ["N/A", "global", ""]:
            total_identified_usd += usd
            if r_id not in ["N/A", "global", ""]:
                seen_resources.add(r_id)

        if r.status in ["APPROVED", "IMPLEMENTED", "AWAITING_VERIFICATION", "VERIFIED"]:
            total_approved_usd += usd

        if r.status in ["IMPLEMENTED", "AWAITING_VERIFICATION", "VERIFIED"]:
            total_implemented_usd += (r.realized_monthly_savings_usd or usd)

        if r.status == "VERIFIED":
            total_verified_usd += (r.realized_monthly_savings_usd or usd)

    total_identified_inr = round(total_identified_usd * live_forex, 2)
    total_approved_inr = round(total_approved_usd * live_forex, 2)
    total_implemented_inr = round(total_implemented_usd * live_forex, 2)
    total_verified_inr = round(total_verified_usd * live_forex, 2)

    # Net realized value after retainer
    net_realized_inr = round(total_implemented_inr - monthly_retainer_inr, 2)
    net_realized_usd = round(total_implemented_usd - monthly_retainer_usd, 2)

    # Net potential value after retainer
    net_potential_inr = round(total_identified_inr - monthly_retainer_inr, 2)
    net_potential_usd = round(total_identified_usd - monthly_retainer_usd, 2)

    # Multipliers:
    # 1. Realized ROI Multiplier: Based on actual IMPLEMENTED / VERIFIED savings against retainer.
    #    If nothing is implemented yet, Realized ROI is strictly 0.0. Never return a positive realized multiplier for 0 realized savings.
    if total_implemented_inr > 0 and monthly_retainer_inr > 0:
        realized_roi_multiplier = round(total_implemented_inr / monthly_retainer_inr, 1)
    else:
        realized_roi_multiplier = 0.0

    # 2. Potential Pipeline ROI Multiplier: Based on total IDENTIFIED potential savings.
    if monthly_retainer_inr > 0:
        potential_roi_multiplier = round(total_identified_inr / monthly_retainer_inr, 1)
    else:
        potential_roi_multiplier = 0.0

    if total_implemented_inr == 0:
        realization_status = "AWAITING_IMPLEMENTATION"
    elif total_implemented_inr < monthly_retainer_inr:
        realization_status = "PARTIAL_REALIZATION"
    else:
        realization_status = "POSITIVE_ROI_ACHIEVED"

    return {
        "total_recommendations_count": len(records),
        "total_identified_monthly_usd": round(total_identified_usd, 2),
        "total_identified_monthly_inr": total_identified_inr,
        "total_approved_monthly_usd": round(total_approved_usd, 2),
        "total_approved_monthly_inr": total_approved_inr,
        "total_implemented_monthly_usd": round(total_implemented_usd, 2),
        "total_implemented_monthly_inr": total_implemented_inr,
        "total_verified_monthly_usd": round(total_verified_usd, 2),
        "total_verified_monthly_inr": total_verified_inr,
        "monthly_platform_retainer_inr": monthly_retainer_inr,
        "monthly_platform_retainer_usd": monthly_retainer_usd,
        "net_monthly_client_value_inr": net_realized_inr,
        "net_monthly_client_value_usd": net_realized_usd,
        "net_realized_monthly_client_value_inr": net_realized_inr,
        "net_realized_monthly_client_value_usd": net_realized_usd,
        "net_potential_monthly_client_value_inr": net_potential_inr,
        "net_potential_monthly_client_value_usd": net_potential_usd,
        "realized_roi_multiplier": realized_roi_multiplier,
        "potential_roi_multiplier": potential_roi_multiplier,
        "roi_multiplier": realized_roi_multiplier,
        "realization_status": realization_status,
        "live_usd_to_inr_rate": live_forex
    }


def format_ledger_record(r: RecommendationRecord) -> Dict[str, Any]:
    evidence = {}
    if r.evidence_json:
        try:
            evidence = json.loads(r.evidence_json)
        except Exception:
            evidence = {}

    return {
        "id": r.id,
        "recommendation_id": r.recommendation_id,
        "category": r.category,
        "title": r.title,
        "resource_id": r.resource_id,
        "service": r.service,
        "region": r.region,
        "account_id": r.account_id,
        "status": r.status,
        "estimated_monthly_savings_usd": r.estimated_monthly_savings_usd,
        "estimated_monthly_savings_inr": r.estimated_monthly_savings_inr,
        "realized_monthly_savings_usd": r.realized_monthly_savings_usd,
        "realized_monthly_savings_inr": r.realized_monthly_savings_inr,
        "confidence_score": r.confidence_score,
        "risk_level": r.risk_level,
        "evidence": evidence,
        "remediation_type": r.remediation_type,
        "approved_by": r.approved_by,
        "approved_at": r.approved_at.isoformat() if r.approved_at else None,
        "implemented_by": r.implemented_by,
        "implemented_at": r.implemented_at.isoformat() if r.implemented_at else None,
        "verified_at": r.verified_at.isoformat() if r.verified_at else None,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None
    }
