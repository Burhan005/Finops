import os
"""
Cost Governance, Budget Guard, Anomalies, Recommendations, and Savings Ledger Router.
"""

from typing import Optional, Tuple
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ....core.state import get_cached_recommendations
from ....cache import global_cache, get_dataset_cache_key
from ....database import get_db
from ....models import User, Organization, AnomalyAlert, BudgetConfig, AuditEvent
from ....recommendations import generate_recommendations
from ....anomalies import get_stored_anomalies, sync_anomalies_to_db
from ....budget_guard import calculate_cost_forecast, evaluate_budgets
from ....savings_ledger import (
    get_ledger_records,
    get_executive_ledger_summary,
    sync_recommendations_to_ledger,
    update_recommendation_status
)
from ....schemas.analytics import (
    AnomalyActionRequest,
    BudgetCreateRequest,
    RecommendationStatusRequest
)
from ...deps import get_current_user_and_org, require_auth, get_active_dataset_for_org, get_billing_repository

router = APIRouter(prefix="", tags=["governance"])


@router.get("/recommendations")
def get_recommendations(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    cur_data = dataset.get('data')
    if not cur_data:
        repo = get_billing_repository(org, dataset, db)
        if repo.has_records():
            cur_data = repo.get_cur_data()

    if not cur_data:
        return {
            'recommendations': [],
            'total_potential_savings': 0.0,
            'total_recommendations': 0
        }
    ds_key = dataset.get('filepath') or dataset.get('filename') or 'active'
    return get_cached_recommendations(ds_key, cur_data)


@router.get("/anomalies")
def list_anomalies(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    """
    Side-effect free: returns stored anomaly alerts scoped to organization.
    Guarantees zero database writes, updates, or deletions on repeated calls.
    """
    user, org = auth
    org_id = org.id if org else None
    return get_stored_anomalies(db, status=status, severity=severity, org_id=org_id)


@router.post("/anomalies/sync")
def trigger_anomalies_sync(
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Explicit write workflow: synchronizes anomalies from active dataset to persistent storage.
    Enforces authentication, tenant isolation, and guarantees GET endpoints remain strictly side-effect free.
    """
    user, org = auth
    org_id = org.id
    dataset = get_active_dataset_for_org(org, db)
    cur_data = dataset.get('data')
    if not cur_data:
        repo = get_billing_repository(org, dataset, db)
        if repo.has_records():
            cur_data = repo.get_cur_data()
    if not cur_data:
        return {
            "success": True,
            "synced_count": 0,
            "anomalies": get_stored_anomalies(db, org_id=org_id)
        }
    synced = sync_anomalies_to_db(db, cur_data, org_id=org_id)
    return {
        "success": True,
        "synced_count": len(synced),
        "anomalies": get_stored_anomalies(db, org_id=org_id)
    }


@router.post("/anomalies/{alert_id}/acknowledge")
def acknowledge_anomaly(
    alert_id: int,
    req: AnomalyActionRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    alert = db.query(AnomalyAlert).filter(
        AnomalyAlert.id == alert_id,
        AnomalyAlert.organization_id == org.id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Anomaly alert not found.")

    now_utc = datetime.now(timezone.utc)
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_by = req.user_name or user.name
    alert.acknowledged_at = now_utc
    if req.notes:
        alert.notes = (alert.notes + "\n" + req.notes) if alert.notes else req.notes
    db.commit()
    db.refresh(alert)
    return {"success": True, "alert_id": alert.id, "status": alert.status}


@router.post("/anomalies/{alert_id}/resolve")
def resolve_anomaly(
    alert_id: int,
    req: AnomalyActionRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    alert = db.query(AnomalyAlert).filter(
        AnomalyAlert.id == alert_id,
        AnomalyAlert.organization_id == org.id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Anomaly alert not found.")

    now_utc = datetime.now(timezone.utc)
    alert.status = "RESOLVED"
    alert.resolved_by = req.user_name or user.name
    alert.resolved_at = now_utc
    if req.notes:
        alert.notes = (alert.notes + "\n" + req.notes) if alert.notes else req.notes
    db.commit()
    db.refresh(alert)
    return {"success": True, "alert_id": alert.id, "status": alert.status}


@router.get("/forecast")
def get_forecast(
    response: Response,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    repo = get_billing_repository(org, dataset, db)

    org_id = org.id if org else 0
    ds_key = get_dataset_cache_key(dataset, repo)
    cache_key = global_cache.build_key(org_id, ds_key, "forecast")

    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        return global_cache.get_or_compute(
            cache_key,
            lambda: repo.get_forecast(),
            ttl=1800
        )

    if getattr(repo, 'd_rec', None) and (repo.d_rec.total_rows or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset billing records are not yet persisted or temporarily unavailable."
        )

    if not dataset.get('data'):
        response.headers['X-Zorvex-Data-Source'] = 'empty-workspace'
        return {
            'forecasted_month_end_usd': 0.0,
            'actual_spend_to_date_usd': 0.0,
            'projected_additional_spend_usd': 0.0,
            'daily_run_rate_usd': 0.0,
            'days_elapsed': 0,
            'days_remaining': 0,
            'total_days_in_month': 30,
            'status': 'EMPTY'
        }

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    return calculate_cost_forecast(dataset['data'])


@router.get("/budgets")
def get_budgets(
    response: Response,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        ds_key = get_dataset_cache_key(dataset, repo)
        org_id = org.id if org else 1
        cache_key = global_cache.build_key(org_id, ds_key, "budgets")
        return global_cache.get_or_compute(
            cache_key,
            lambda: repo.evaluate_budgets(),
            ttl=300
        )

    if getattr(repo, 'd_rec', None) and (repo.d_rec.total_rows or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset billing records are not yet persisted or temporarily unavailable."
        )

    if not dataset.get('data'):
        response.headers['X-Zorvex-Data-Source'] = 'empty-workspace'
        return []

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    return evaluate_budgets(db, dataset['data'], org_id=org.id if org else None)


@router.post("/budgets")
def create_budget(
    req: BudgetCreateRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    now_utc = datetime.now(timezone.utc)
    new_b = BudgetConfig(
        organization_id=org.id,
        name=req.name.strip(),
        scope_type=req.scope_type,
        scope_value=req.scope_value,
        monthly_budget_usd=max(1.0, req.monthly_budget_usd),
        alert_threshold_pct=req.alert_threshold_pct,
        notification_email=req.notification_email,
        is_active=1,
        created_at=now_utc,
        updated_at=now_utc
    )
    db.add(new_b)
    db.commit()
    db.refresh(new_b)
    global_cache.invalidate_endpoint(org.id, "budgets")
    dataset = get_active_dataset_for_org(org, db)
    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        return repo.evaluate_budgets()
    if dataset.get('data'):
        return evaluate_budgets(db, dataset['data'], org_id=org.id)
    return [{"id": new_b.id, "name": new_b.name, "status": "HEALTHY"}]


@router.delete("/budgets/{budget_id}")
def delete_budget(
    budget_id: int,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    existing = db.query(BudgetConfig).filter(BudgetConfig.id == budget_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Budget not found.")
    if existing.organization_id != org.id:
        raise HTTPException(status_code=403, detail="Forbidden: Budget belongs to another organization.")
    b = existing

    db.delete(b)
    db.commit()
    global_cache.invalidate_endpoint(org.id, "budgets")
    return {"success": True, "deleted_id": budget_id}


@router.get("/ledger/records")
def list_ledger_records(
    status: Optional[str] = None,
    category: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    """
    Side-effect free: returns stored recommendation ledger records scoped to organization.
    Guarantees zero database writes, updates, or deletions on repeated calls.
    """
    user, org = auth
    org_id = org.id if org else None
    return get_ledger_records(db, status=status, category=category, org_id=org_id)


@router.get("/ledger/summary")
def get_ledger_summary(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    """
    Side-effect free: returns executive savings ledger summary and ROI scoped to organization.
    Guarantees zero database writes, updates, or deletions on repeated calls.
    """
    user, org = auth
    org_id = org.id if org else None
    return get_executive_ledger_summary(db, org_id=org_id)


@router.post("/ledger/sync")
def trigger_ledger_sync(
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Explicit write workflow: synchronizes algorithmic recommendations into the executive savings ledger.
    Enforces authentication, tenant isolation, and guarantees GET endpoints remain strictly side-effect free.
    """
    user, org = auth
    org_id = org.id
    dataset = get_active_dataset_for_org(org, db)
    cur_data = dataset.get('data')
    if not cur_data:
        repo = get_billing_repository(org, dataset, db)
        if repo.has_records():
            cur_data = repo.get_cur_data()
    if not cur_data:
        return {
            "success": True,
            "synced_count": 0,
            "records": []
        }
    raw = generate_recommendations(cur_data)
    records = sync_recommendations_to_ledger(db, raw.get('recommendations', []), org_id=org_id)
    return {
        "success": True,
        "synced_count": len(records),
        "records": records
    }


@router.post("/recommendations/{rec_id}/status")
def change_recommendation_status(
    rec_id: str,
    req: RecommendationStatusRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    updated = update_recommendation_status(
        db,
        rec_id=rec_id,
        new_status=req.status,
        user_name=req.user_name or user.name,
        notes=req.notes,
        org_id=org.id
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return updated


@router.get("/governance/tags")
def get_tag_governance_report(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    """
    Returns organization-wide Tag Governance & Cost Allocation Compliance report.
    Quantifies tagging compliance percentage, untagged dark cost, policy compliance rates,
    and actionable AWS CLI remediation commands.
    """
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    
    filepath = dataset.get('filepath')
    active_filename = dataset.get('filename')
    
    repo = get_billing_repository(org, dataset, db)
    from ....tag_governance import TagGovernanceEngine
    if (not filepath or not os.path.exists(filepath)) and not repo.has_records():
        return TagGovernanceEngine._empty_governance_result(active_filename, reason="NO_ACTIVE_FILE")
        
    ds_key = get_dataset_cache_key(dataset, repo)
    org_id = org.id if org else 1
    cache_key = global_cache.build_key(org_id, ds_key, "tag_governance")
    
    def _compute_tag_audit():
        if filepath and os.path.exists(filepath):
            return TagGovernanceEngine.audit_dataset_tags(filepath, active_filename)
        return TagGovernanceEngine.audit_from_repository(repo, active_filename)

    return global_cache.get_or_compute(
        cache_key,
        _compute_tag_audit,
        ttl=1800
    )



@router.get("/governance/audit-logs")
def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    action: Optional[str] = None,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Returns immutable, timestamped audit events for SOC-2 compliance & FinOps governance.
    """
    user, org = auth
    query = db.query(AuditEvent).filter(AuditEvent.organization_id == org.id)
    if not action or action == 'OPERATIONS':
        query = query.filter(~AuditEvent.action.in_(['LOGIN', 'AUTH']))
    elif action in ('DATASET_UPLOAD', 'UPLOAD'):
        query = query.filter(AuditEvent.action.in_(['DATASET_UPLOAD', 'UPLOAD']))
    elif action == 'LOGIN':
        query = query.filter(AuditEvent.action.in_(['LOGIN', 'AUTH']))
    elif action != 'ALL':
        query = query.filter(AuditEvent.action == action)
    total = query.count()
    events = query.order_by(AuditEvent.timestamp.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "events": [
            {
                "id": ev.id,
                "action": ev.action,
                "timestamp": ev.timestamp.isoformat() if ev.timestamp else None,
                "ip_address": ev.ip_address,
                "details": ev.details,
                "user_id": ev.user_id
            }
            for ev in events
        ]
    }
