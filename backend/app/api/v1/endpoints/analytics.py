"""
Comparative Analytics, Root Cause, Forex, Branding, Unit Economics, S3 Sync, and Reports Router.
"""

import os
import json
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from ....core.state import get_cached_recommendations
from ....cache import global_cache, get_dataset_cache_key
from ....database import get_db
from ....models import (
    User,
    Organization,
    ExportTicket,
    AgencyBrandingConfig,
    UnitEconomicsConfig,
    S3SyncConfig,
    S3SyncExecutionHistory,
    AiAnalystQuery,
    ResourceLifecycleEvent
)
from ....analytics import compare_dates, calculate_daily_delta, compare_months
from ....root_cause import analyze_cost_root_cause
from ....forex import fetch_live_usd_to_inr
from ....recommendations import generate_recommendations
from ....exporter import generate_executive_html, generate_executive_excel
from ....simulator import simulate_savings_plan
from ....ai_analyst import ask_zorvex_analyst
from ....schemas.analytics import (
    CompareRequest,
    DailyDeltaRequest,
    MonthlyCompareRequest,
    RootCauseRequest,
    S3SyncConfigRequest,
    AgencyBrandingRequest,
    UnitEconomicsRequest,
    SavingsPlanSimulatorRequest,
    ExportTicketRequest,
    AiQueryRequest
)
from ...deps import get_current_user_and_org, require_auth, get_active_dataset_for_org, get_billing_repository

router = APIRouter(prefix="", tags=["analytics-advanced"])


@router.post("/compare")
def compare_spending(
    req: CompareRequest,
    response: Response,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        org_id = org.id if org else 0
        ds_key = get_dataset_cache_key(dataset, repo)
        cache_key = global_cache.build_key(org_id, ds_key, "compare_spending", b=req.baseline_date, t=req.target_date, acc=req.account_id)
        return global_cache.get_or_compute(
            cache_key,
            lambda: repo.compare_dates(req.baseline_date, req.target_date, account_id=req.account_id),
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
            'status': 'EMPTY_WORKSPACE',
            'baseline_date': req.baseline_date,
            'target_date': req.target_date,
            'baseline_cost': 0.0,
            'target_cost': 0.0,
            'delta_cost': 0.0,
            'pct_change': 0.0,
            'services_delta': {},
            'resources_breakdown': []
        }

    data = dataset['data']
    dates = set(data.get('dates', []))

    if req.baseline_date not in dates:
        raise HTTPException(status_code=400, detail=f"Baseline date {req.baseline_date} not in dataset dates")
    if req.target_date not in dates:
        raise HTTPException(status_code=400, detail=f"Target date {req.target_date} not in dataset dates")

    org_id = org.id if org else 0
    ds_key = get_dataset_cache_key(dataset, repo)
    cache_key = global_cache.build_key(org_id, ds_key, "compare_spending", b=req.baseline_date, t=req.target_date, acc=req.account_id)

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    return global_cache.get_or_compute(
        cache_key,
        lambda: compare_dates(data, req.baseline_date, req.target_date, account_id=req.account_id),
        ttl=1800
    )


@router.post("/analytics/daily-delta")
def get_daily_delta(
    req: DailyDeltaRequest,
    response: Response,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        org_id = org.id if org else 0
        ds_key = get_dataset_cache_key(dataset, repo)
        cache_key = global_cache.build_key(org_id, ds_key, "daily_delta", t=req.target_date, b=req.baseline_date, acc=req.account_id)
        return global_cache.get_or_compute(
            cache_key,
            lambda: repo.calculate_daily_delta(req.target_date, req.baseline_date, account_id=req.account_id),
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
            'status': 'EMPTY_WORKSPACE',
            'baseline_date': req.baseline_date,
            'target_date': req.target_date,
            'baseline_cost': 0.0,
            'target_cost': 0.0,
            'delta_cost': 0.0,
            'pct_change': 0.0,
            'services': {},
            'top_increases': [],
            'top_decreases': []
        }

    org_id = org.id if org else 0
    ds_key = get_dataset_cache_key(dataset, repo)
    cache_key = global_cache.build_key(org_id, ds_key, "daily_delta", t=req.target_date, b=req.baseline_date, acc=req.account_id)

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    return global_cache.get_or_compute(
        cache_key,
        lambda: calculate_daily_delta(dataset['data'], req.target_date, req.baseline_date, account_id=req.account_id),
        ttl=1800
    )


@router.post("/analytics/monthly-comparison")
def get_monthly_comparison(
    req: MonthlyCompareRequest,
    response: Response,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        org_id = org.id if org else 0
        ds_key = get_dataset_cache_key(dataset, repo)
        cache_key = global_cache.build_key(org_id, ds_key, "monthly_comparison", b=req.baseline_month, t=req.target_month, acc=req.account_id)
        return global_cache.get_or_compute(
            cache_key,
            lambda: repo.compare_months(req.baseline_month, req.target_month, account_id=req.account_id),
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
            'status': 'EMPTY_WORKSPACE',
            'baseline_month': req.baseline_month,
            'target_month': req.target_month,
            'baseline_cost': 0.0,
            'target_cost': 0.0,
            'delta_cost': 0.0,
            'pct_change': 0.0,
            'services': {}
        }

    org_id = org.id if org else 0
    ds_key = get_dataset_cache_key(dataset, repo)
    cache_key = global_cache.build_key(org_id, ds_key, "monthly_comparison", b=req.baseline_month, t=req.target_month, acc=req.account_id)

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    return global_cache.get_or_compute(
        cache_key,
        lambda: compare_months(dataset['data'], req.baseline_month, req.target_month, account_id=req.account_id),
        ttl=1800
    )


@router.post("/analytics/root-cause")
def get_cost_root_cause(
    req: RootCauseRequest,
    response: Response,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    if req.limit is not None and (req.limit < 1 or req.limit > 1000):
        raise HTTPException(status_code=400, detail="Invalid limit: must be between 1 and 1000")
    if req.offset is not None and req.offset < 0:
        raise HTTPException(status_code=400, detail="Invalid offset: cannot be negative")

    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if not dataset.get('data'):
        if repo.has_records():
            response.headers['X-Zorvex-Data-Source'] = 'database'
            org_id = org.id if org else 0
            ds_key = get_dataset_cache_key(dataset, repo)
            cache_key = global_cache.build_key(
                org_id, ds_key, "root_cause_db",
                b_start=req.baseline_start, b_end=req.baseline_end,
                t_start=req.target_start, t_end=req.target_end,
                svc=req.service, acc=req.account_id, min_delta=req.min_delta,
                limit=req.limit, offset=req.offset,
                cat=req.category, q=req.search,
                sort_by=req.sort_by, sort_order=req.sort_order
            )
            return global_cache.get_or_compute(
                cache_key,
                lambda: repo.compare_periods(
                    baseline_start=req.baseline_start,
                    baseline_end=req.baseline_end,
                    target_start=req.target_start,
                    target_end=req.target_end,
                    service=req.service,
                    account_id=req.account_id,
                    min_delta=req.min_delta or 0.001,
                    limit=req.limit,
                    offset=req.offset,
                    category=req.category,
                    search=req.search,
                    sort_by=req.sort_by,
                    sort_order=req.sort_order
                ),
                ttl=1800
            )

        response.headers['X-Zorvex-Data-Source'] = 'empty-workspace'
        return {
            'status': 'EMPTY',
            'variance_usd': 0.0,
            'drivers': [],
            'resources': [],
            'total_count': 0,
            'pagination': {
                'limit': req.limit,
                'offset': req.offset or 0,
                'total_count': 0,
                'has_more': False
            }
        }

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-quantity-rate-engine'

    org_id = org.id if org else 0
    ds_key = get_dataset_cache_key(dataset, repo)
    cache_key = global_cache.build_key(
        org_id, ds_key, "root_cause",
        b_start=req.baseline_start, b_end=req.baseline_end,
        t_start=req.target_start, t_end=req.target_end,
        svc=req.service, acc=req.account_id, min_delta=req.min_delta,
        limit=req.limit, offset=req.offset,
        cat=req.category, q=req.search,
        sort_by=req.sort_by, sort_order=req.sort_order
    )

    return global_cache.get_or_compute(
        cache_key,
        lambda: analyze_cost_root_cause(
            cur_data=dataset['data'],
            baseline_start=req.baseline_start,
            baseline_end=req.baseline_end,
            target_start=req.target_start,
            target_end=req.target_end,
            service=req.service,
            account_id=req.account_id,
            min_delta=req.min_delta or 0.001,
            limit=req.limit,
            offset=req.offset,
            category=req.category,
            search=req.search,
            sort_by=req.sort_by,
            sort_order=req.sort_order,
            db=db,
            org_id=org_id
        ),
        ttl=1800
    )


@router.get("/system/cache-stats")
def get_cache_diagnostics():
    """Returns real-time dual-tier cache diagnostics, hit ratios, and Redis status."""
    return global_cache.get_status()


@router.post("/export/ticket")
def create_export_ticket(
    req: ExportTicketRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    fmt = req.format.lower()
    if fmt not in ["html", "excel"]:
        raise HTTPException(status_code=400, detail="Invalid export format. Only 'html' and 'excel' are supported.")

    ticket_str = f"ticket_{secrets.token_urlsafe(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
    params_payload = {
        "baseline_date": req.baseline_date,
        "target_date": req.target_date,
        "account_id": req.account_id
    }

    t_rec = ExportTicket(
        ticket=ticket_str,
        user_id=user.id,
        organization_id=org.id,
        export_format=fmt,
        params_json=json.dumps(params_payload),
        expires_at=expires_at,
        used=0,
        created_at=datetime.now(timezone.utc)
    )
    db.add(t_rec)
    db.commit()

    return {
        "success": True,
        "ticket": ticket_str,
        "expires_in_seconds": 60,
        "format": fmt
    }


@router.get("/export/executive-report")
def export_executive_report(
    format: str = "html",
    baseline_date: Optional[str] = None,
    target_date: Optional[str] = None,
    account_id: Optional[str] = None,
    ticket: Optional[str] = Query(None),
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth

    if ticket:
        t_rec = db.query(ExportTicket).filter(ExportTicket.ticket == ticket).first()
        if not t_rec:
            raise HTTPException(status_code=401, detail="Invalid export ticket.")
        if t_rec.used:
            raise HTTPException(status_code=403, detail="Export ticket has already been used. Please request a new ticket.")

        now_utc = datetime.now(timezone.utc)
        exp = t_rec.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now_utc > exp:
            raise HTTPException(status_code=403, detail="Export ticket has expired. Please request a new ticket.")

        t_rec.used = 1
        db.commit()

        user = db.query(User).filter(User.id == t_rec.user_id).first()
        org = db.query(Organization).filter(Organization.id == t_rec.organization_id).first()
        if not user or not org:
            raise HTTPException(status_code=401, detail="User or organization associated with ticket not found.")

        if t_rec.export_format:
            format = t_rec.export_format
        if t_rec.params_json:
            try:
                p = json.loads(t_rec.params_json)
                baseline_date = baseline_date or p.get("baseline_date")
                target_date = target_date or p.get("target_date")
                account_id = account_id or p.get("account_id")
            except Exception:
                pass
    elif not user or not org:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide Authorization: Bearer token header or a valid single-use export ticket.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        raise HTTPException(status_code=400, detail="No active dataset loaded")

    data = dataset['data']
    dates = data.get('dates', [])
    b_date = baseline_date or (dates[-2] if len(dates) >= 2 else (dates[0] if dates else 'N/A'))
    t_date = target_date or (dates[-1] if dates else 'N/A')

    comp = compare_dates(data, b_date, t_date, account_id=account_id) if (b_date != 'N/A' and t_date != 'N/A') else None
    recs = generate_recommendations(data)
    fname = dataset.get('filename', 'AWS_CUR_Report')

    b_query = db.query(AgencyBrandingConfig)
    if org:
        b_query = b_query.filter(AgencyBrandingConfig.organization_id == org.id)
    b_cfg = b_query.order_by(AgencyBrandingConfig.id.desc()).first()

    brand_dict = {
        "agency_name": b_cfg.agency_name if b_cfg else "Cloud FinOps Advisory Partners",
        "client_name": b_cfg.client_name if b_cfg else "Enterprise Client Organization",
        "prepared_by": b_cfg.prepared_by if b_cfg else "Burhan Kapasi, Principal FinOps Lead",
        "confidentiality_note": b_cfg.confidentiality_note if b_cfg else "Strictly Confidential — Prepared for Executive Boardroom Review"
    }

    if format.lower() == "excel":
        excel_bytes = generate_executive_excel(fname, data, comparison=comp, recommendations=recs, branding=brand_dict)
        clean_name = fname.replace('.csv.gz', '').replace('.csv', '')
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=FinOps_Executive_Report_{clean_name}.xlsx"}
        )
    else:
        html_content = generate_executive_html(fname, data, comparison=comp, recommendations=recs, branding=brand_dict)
        return HTMLResponse(content=html_content)


@router.get("/branding")
def get_branding(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    if not org:
        return {
            "agency_name": "Cloud FinOps Advisory Partners",
            "client_name": "Enterprise Client Organization",
            "prepared_by": "Burhan Kapasi, Principal FinOps Lead",
            "contact_email": "cloudops@finopsclay.io",
            "confidentiality_note": "Strictly Confidential — Prepared for Executive Boardroom Review"
        }
    cfg = db.query(AgencyBrandingConfig).filter(AgencyBrandingConfig.organization_id == org.id).order_by(AgencyBrandingConfig.id.desc()).first()
    if not cfg:
        return {
            "agency_name": "Cloud FinOps Advisory Partners",
            "client_name": "Enterprise Client Organization",
            "prepared_by": "Burhan Kapasi, Principal FinOps Lead",
            "contact_email": "cloudops@finopsclay.io",
            "confidentiality_note": "Strictly Confidential — Prepared for Executive Boardroom Review"
        }
    return {
        "agency_name": cfg.agency_name,
        "client_name": cfg.client_name,
        "prepared_by": cfg.prepared_by,
        "contact_email": cfg.contact_email,
        "confidentiality_note": cfg.confidentiality_note
    }


@router.post("/branding")
def save_branding(
    req: AgencyBrandingRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = db.query(AgencyBrandingConfig).filter(
        AgencyBrandingConfig.organization_id == org.id
    ).order_by(AgencyBrandingConfig.id.desc()).first()

    now_utc = datetime.now(timezone.utc)
    if not cfg:
        cfg = AgencyBrandingConfig(
            organization_id=org.id,
            agency_name=req.agency_name.strip(),
            client_name=req.client_name.strip(),
            prepared_by=req.prepared_by.strip(),
            contact_email=req.contact_email.strip() if req.contact_email else "cloudops@finopsclay.io",
            confidentiality_note=req.confidentiality_note.strip() if req.confidentiality_note else "Strictly Confidential",
            updated_at=now_utc
        )
        db.add(cfg)
    else:
        cfg.agency_name = req.agency_name.strip()
        cfg.client_name = req.client_name.strip()
        cfg.prepared_by = req.prepared_by.strip()
        if req.contact_email:
            cfg.contact_email = req.contact_email.strip()
        if req.confidentiality_note:
            cfg.confidentiality_note = req.confidentiality_note.strip()
        cfg.updated_at = now_utc
    db.commit()
    return {"success": True, "message": "Agency branding updated successfully."}


@router.get("/unit-economics")
def get_unit_economics(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = None
    if org:
        cfg = db.query(UnitEconomicsConfig).filter(UnitEconomicsConfig.organization_id == org.id).order_by(UnitEconomicsConfig.id.desc()).first()

    metric_name = cfg.metric_name if cfg else "Monthly Active Users (MAU)"
    metric_unit = cfg.metric_unit if cfg else "Users"
    curr_vol = cfg.current_volume if cfg else 25000.0
    prev_vol = cfg.previous_volume if cfg else 18000.0
    target_cost = cfg.target_unit_cost if cfg else 0.10

    dataset = get_active_dataset_for_org(org, db)
    total_cost = 0.0
    prev_cost = 0.0
    if dataset.get('data'):
        data = dataset['data']
        total_cost = data.get('total_cost', 0.0)
        dates = data.get('dates', [])
        daily_totals = data.get('daily_totals', {})
        if len(dates) >= 2:
            mid = len(dates) // 2
            prev_days = dates[:mid]
            curr_days = dates[mid:]
            prev_sum = sum(daily_totals.get(d, 0.0) for d in prev_days)
            prev_cost = round(prev_sum * (len(dates) / max(1, len(prev_days))), 2)
        else:
            prev_cost = total_cost

    curr_unit_cost = round(total_cost / max(1.0, curr_vol), 4)
    prev_unit_cost = round(prev_cost / max(1.0, prev_vol), 4)

    if prev_unit_cost > 0:
        efficiency_gain_pct = round(((prev_unit_cost - curr_unit_cost) / prev_unit_cost) * 100.0, 1)
    else:
        efficiency_gain_pct = 0.0

    return {
        "metric_name": metric_name,
        "metric_unit": metric_unit,
        "current_volume": curr_vol,
        "previous_volume": prev_vol,
        "total_cloud_cost": total_cost,
        "previous_cloud_cost": prev_cost,
        "current_unit_cost": curr_unit_cost,
        "previous_unit_cost": prev_unit_cost,
        "unit_cost_delta": round(curr_unit_cost - prev_unit_cost, 4),
        "efficiency_gain_pct": efficiency_gain_pct,
        "is_improving": efficiency_gain_pct >= 0,
        "target_unit_cost": target_cost,
        "notes": cfg.notes if cfg else "Unit cost tracked across cloud compute & storage infrastructure"
    }


@router.post("/unit-economics")
def save_unit_economics(
    req: UnitEconomicsRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = db.query(UnitEconomicsConfig).filter(
        UnitEconomicsConfig.organization_id == org.id
    ).order_by(UnitEconomicsConfig.id.desc()).first()

    now_utc = datetime.now(timezone.utc)
    if not cfg:
        cfg = UnitEconomicsConfig(
            organization_id=org.id,
            metric_name=req.metric_name.strip(),
            metric_unit=req.metric_unit.strip(),
            current_volume=max(1.0, req.current_volume),
            previous_volume=max(1.0, req.previous_volume),
            target_unit_cost=req.target_unit_cost,
            notes=req.notes,
            updated_at=now_utc
        )
        db.add(cfg)
    else:
        cfg.metric_name = req.metric_name.strip()
        cfg.metric_unit = req.metric_unit.strip()
        cfg.current_volume = max(1.0, req.current_volume)
        cfg.previous_volume = max(1.0, req.previous_volume)
        if req.target_unit_cost is not None:
            cfg.target_unit_cost = req.target_unit_cost
        cfg.notes = req.notes
        cfg.updated_at = now_utc
    db.commit()
    return get_unit_economics(auth=(user, org), db=db)


@router.post("/simulator/savings-plans")
def simulate_sp_endpoint(
    req: SavingsPlanSimulatorRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        return {
            'status': 'EMPTY',
            'commitment_hourly': req.commitment_hourly,
            'plan_type': req.plan_type or "COMPUTE_SP",
            'monthly_on_demand_spend': 0.0,
            'monthly_sp_commitment': 0.0,
            'monthly_sp_effective_spend': 0.0,
            'monthly_savings': 0.0,
            'savings_percentage': 0.0,
            'coverage_percentage': 0.0,
            'resources_breakdown': []
        }
    return simulate_savings_plan(
        dataset['data'],
        commitment_hourly=req.commitment_hourly,
        reserved_units=req.reserved_units,
        term_years=req.term_years,
        payment_option=req.payment_option,
        plan_type=req.plan_type or "COMPUTE_SP",
        account_id=req.account_id,
        region=req.region
    )


@router.get("/forex/usd-inr")
def get_forex_usd_to_inr():
    return fetch_live_usd_to_inr()


@router.get("/s3/config")
def get_s3_config(
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    if not org:
        return {
            "configured": False,
            "bucket_name": "",
            "region": "us-east-1",
            "prefix": "",
            "role_arn": "",
            "account_name": "",
            "is_enabled": False,
            "last_synced_at": None,
            "last_status": "NOT_CONFIGURED"
        }
    cfg = db.query(S3SyncConfig).filter(S3SyncConfig.organization_id == org.id).order_by(S3SyncConfig.id.desc()).first()
    if not cfg:
        return {
            "configured": False,
            "bucket_name": "",
            "region": "us-east-1",
            "prefix": "",
            "role_arn": "",
            "account_name": "",
            "is_enabled": False,
            "last_synced_at": None,
            "last_status": "NOT_CONFIGURED"
        }
    return {
        "configured": True,
        "bucket_name": cfg.bucket_name,
        "region": cfg.region,
        "prefix": cfg.prefix,
        "role_arn": cfg.role_arn,
        "account_name": cfg.account_name or "",
        "is_enabled": bool(cfg.is_enabled),
        "last_synced_at": cfg.last_synced_at.isoformat() if cfg.last_synced_at else None,
        "last_status": cfg.last_status,
        "last_message": cfg.last_message
    }


@router.post("/s3/config")
def save_s3_config(
    req: S3SyncConfigRequest,
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    user, org = auth
    cfg = db.query(S3SyncConfig).filter(
        S3SyncConfig.organization_id == org.id
    ).order_by(S3SyncConfig.id.desc()).first()

    account_name_val = req.account_name.strip() if req.account_name and req.account_name.strip() else None

    if not cfg:
        cfg = S3SyncConfig(
            organization_id=org.id,
            bucket_name=req.bucket_name.strip(),
            region=req.region.strip() if req.region else "us-east-1",
            prefix=req.prefix.strip() if req.prefix else "",
            role_arn=req.role_arn.strip() if req.role_arn else "",
            account_name=account_name_val,
            is_enabled=1,
            last_status="CONFIGURED",
            last_message="S3 Automated Sync configuration saved."
        )
        db.add(cfg)
    else:
        cfg.bucket_name = req.bucket_name.strip()
        cfg.region = req.region.strip() if req.region else "us-east-1"
        cfg.prefix = req.prefix.strip() if req.prefix else ""
        cfg.role_arn = req.role_arn.strip() if req.role_arn else ""
        cfg.account_name = account_name_val
        cfg.last_status = "CONFIGURED"
        cfg.last_message = "S3 configuration updated."

    db.commit()
    return {"success": True, "message": "AWS S3 Sync configuration saved successfully."}


@router.post("/s3/sync")
def trigger_s3_sync(
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Executes end-to-end direct S3 CUR sync:
    Discovers reports, validates gzip streams, downloads, parses, and ingests into ZORVEX.
    """
    user, org = auth
    cfg = db.query(S3SyncConfig).filter(
        S3SyncConfig.organization_id == org.id
    ).order_by(S3SyncConfig.id.desc()).first()

    if not cfg:
        raise HTTPException(status_code=400, detail="Please configure S3 Bucket details first for your organization.")

    from ....s3_service import download_and_ingest_cur_from_s3
    result = download_and_ingest_cur_from_s3(
        db=db,
        org_id=org.id,
        user_id=user.id,
        s3_config=cfg
    )
    return result


@router.get("/s3/status")
def get_s3_sync_status(
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Returns current S3 Sync configuration, status, and recent execution history."""
    user, org = auth
    cfg = db.query(S3SyncConfig).filter(
        S3SyncConfig.organization_id == org.id
    ).order_by(S3SyncConfig.id.desc()).first()

    history = db.query(S3SyncExecutionHistory).filter(
        S3SyncExecutionHistory.organization_id == org.id
    ).order_by(S3SyncExecutionHistory.id.desc()).limit(10).all()

    from ....s3_service import generate_least_privilege_iam_policy

    return {
        "configured": cfg is not None,
        "config": {
            "bucket_name": cfg.bucket_name if cfg else None,
            "region": cfg.region if cfg else None,
            "prefix": cfg.prefix if cfg else None,
            "role_arn": cfg.role_arn if cfg else None,
            "is_enabled": cfg.is_enabled if cfg else 0,
            "last_synced_at": cfg.last_synced_at.isoformat() if (cfg and cfg.last_synced_at) else None,
            "last_status": cfg.last_status if cfg else "NOT_CONFIGURED",
            "last_message": cfg.last_message if cfg else "No S3 configuration detected."
        } if cfg else None,
        "recommended_iam_policy": generate_least_privilege_iam_policy(
            cfg.bucket_name if cfg else "my-cur-bucket",
            cfg.prefix if cfg else ""
        ),
        "history": [
            {
                "id": h.id,
                "started_at": h.started_at.isoformat() if h.started_at else None,
                "completed_at": h.completed_at.isoformat() if h.completed_at else None,
                "status": h.status,
                "records_ingested": h.records_ingested,
                "bytes_downloaded": h.bytes_downloaded,
                "manifest_key": h.manifest_key,
                "error_message": h.error_message
            }
            for h in history
        ]
    }


@router.get("/s3/policy")
def get_s3_least_privilege_policy(
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Returns the recommended least-privilege IAM policy document for the configured S3 bucket."""
    user, org = auth
    cfg = db.query(S3SyncConfig).filter(
        S3SyncConfig.organization_id == org.id
    ).order_by(S3SyncConfig.id.desc()).first()

    from ....s3_service import generate_least_privilege_iam_policy
    bucket = cfg.bucket_name if cfg else "my-cur-bucket"
    prefix = cfg.prefix if cfg else ""

    return {
        "bucket_name": bucket,
        "prefix": prefix,
        "policy": generate_least_privilege_iam_policy(bucket, prefix)
    }


@router.get("/analytics/lifecycle-events")
def get_lifecycle_events(
    resource_id: Optional[str] = Query(None, description="Optional resource ID or short identifier filter"),
    service: Optional[str] = Query(None, description="Optional AWS service name filter"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Lists AWS CloudTrail resource lifecycle events for the current organization."""
    user, org = auth

    q = db.query(ResourceLifecycleEvent).filter(
        ResourceLifecycleEvent.organization_id == org.id
    )

    if resource_id:
        rid_clean = resource_id.strip()
        q = q.filter(
            or_(
                ResourceLifecycleEvent.resource_id == rid_clean,
                ResourceLifecycleEvent.resource_id.like(f"%{rid_clean}%")
            )
        )
    if service and service.lower() != 'all':
        q = q.filter(ResourceLifecycleEvent.service.ilike(f"%{service}%"))
    if start_date:
        q = q.filter(ResourceLifecycleEvent.event_date >= start_date)
    if end_date:
        q = q.filter(ResourceLifecycleEvent.event_date <= end_date)

    total_count = q.count()
    events = q.order_by(ResourceLifecycleEvent.event_time.desc()).offset(offset).limit(limit).all()

    return {
        "status": "SUCCESS",
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total_count,
        "events": [
            {
                "id": ev.id,
                "event_id": ev.event_id,
                "resource_id": ev.resource_id,
                "service": ev.service,
                "event_name": ev.event_name,
                "event_time": ev.event_time,
                "event_date": ev.event_date,
                "region": ev.region,
                "account_id": ev.account_id,
                "actor": ev.actor,
                "status": ev.status,
                "event_source": ev.event_source,
                "details": json.loads(ev.details_json) if ev.details_json else None
            }
            for ev in events
        ]
    }


@router.post("/analytics/lifecycle-events/ingest")
def ingest_lifecycle_events_endpoint(
    req: Dict[str, Any],
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Idempotently ingests an array of normalized CloudTrail/AWS lifecycle event records
    for the current authenticated tenant organization.
    """
    user, org = auth
    events = req.get("events", [])
    if not isinstance(events, list) or not events:
        raise HTTPException(status_code=400, detail="Payload must contain a non-empty 'events' list.")

    from ....lifecycle_service import ingest_lifecycle_events_batch
    count = ingest_lifecycle_events_batch(db, org.id, events)

    # Invalidate cached root cause and comparison endpoints for tenant
    global_cache.invalidate_endpoint(org.id, "root_cause")
    global_cache.invalidate_endpoint(org.id, "compare")

    return {
        "success": True,
        "persisted_events_count": count,
        "total_submitted": len(events),
        "message": f"Successfully ingested {count} lifecycle events."
    }


@router.post("/analytics/lifecycle-events/sync")
def sync_cloudtrail_lifecycle_events(
    days_back: int = Query(7, ge=1, le=30),
    region: str = Query("ap-south-1"),
    auth: Tuple[User, Organization] = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Polls AWS CloudTrail lookup_events for EC2/RDS start/stop lifecycle events
    using the organization's configured AWS credentials or IAM role.
    """
    user, org = auth
    cfg = db.query(S3SyncConfig).filter(
        S3SyncConfig.organization_id == org.id
    ).order_by(S3SyncConfig.id.desc()).first()

    role_arn = cfg.role_arn if cfg else None
    target_region = cfg.region if (cfg and cfg.region) else region

    from ....s3_service import resolve_aws_session
    from ....lifecycle_service import poll_cloudtrail_lifecycle_events

    session, auth_status, auth_err = resolve_aws_session(
        region=target_region,
        role_arn=role_arn
    )

    if auth_status != "AUTHENTICATED" or not session:
        return {
            "success": False,
            "status": auth_status,
            "error": auth_err,
            "message": f"Cannot poll CloudTrail: {auth_err}"
        }

    try:
        ct_client = session.client("cloudtrail", region_name=target_region)
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=days_back)

        poll_result = poll_cloudtrail_lifecycle_events(
            cloudtrail_client=ct_client,
            db=db,
            org_id=org.id,
            start_time=start_time,
            end_time=now,
            region=target_region
        )

        # Invalidate cached root cause and comparison endpoints
        global_cache.invalidate_endpoint(org.id, "root_cause")
        global_cache.invalidate_endpoint(org.id, "compare")

        return {
            "success": True,
            "status": "COMPLETED",
            "region": target_region,
            "days_polled": days_back,
            "events_discovered": poll_result["total_found"],
            "events_persisted": poll_result["total_persisted"],
            "errors": poll_result["errors"],
            "message": f"Polled CloudTrail: {poll_result['total_persisted']} new events saved."
        }
    except Exception as exc:
        return {
            "success": False,
            "status": "FAILED",
            "error": str(exc),
            "message": f"CloudTrail API error: {str(exc)}"
        }



@router.post("/ai/query")
def query_ai_analyst(
    req: AiQueryRequest,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)
    if not dataset.get('data'):
        return {
            "query": req.query,
            "intent": "EMPTY_WORKSPACE",
            "answer": "No billing dataset is currently active in this workspace. Please upload an AWS CUR report (.csv or .csv.gz) to start analyzing your cloud spend.",
            "data_references": [],
            "provider_used": "system_guard",
            "is_deterministic": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    return ask_zorvex_analyst(req.query, dataset['data'], db)


@router.get("/ai/history")
def get_ai_history(
    limit: int = 20,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    if not org:
        return []
    rows = db.query(AiAnalystQuery).filter(AiAnalystQuery.organization_id == org.id).order_by(AiAnalystQuery.id.desc()).limit(limit).all()
    return [{
        "id": r.id,
        "query": r.query_text,
        "intent": r.intent_detected,
        "answer": r.response_text,
        "provider_used": r.provider_used,
        "timestamp": r.created_at.isoformat()
    } for r in rows]
