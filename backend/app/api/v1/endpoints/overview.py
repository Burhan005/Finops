"""
FinOps Analytics Endpoints:
- Overview (/overview)
- Spending Trends (/trends)
- Resource Explorer (/resources, /resources/hierarchies, /resources/detail)
"""

from typing import Optional, Tuple
from collections import defaultdict
from decimal import Decimal
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ....core.state import get_cached_recommendations
from ....cache import global_cache
from ....database import get_db
from ....models import User, Organization
from ....parser import round_currency
from ....analytics import get_trend_data
from ....resource_explorer import query_resource_explorer, get_available_hierarchies, get_resource_detail
from ...deps import get_current_user_and_org, get_active_dataset_for_org, get_billing_repository

logger = logging.getLogger("zorvex.analytics.overview")

router = APIRouter(prefix="", tags=["analytics-overview"])


@router.get("/overview")
def get_overview(
    response: Response,
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    account_id: Optional[str] = None,
    service: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    svc_filter = service.strip() if service else None
    if svc_filter and svc_filter.lower() in ('all', ''):
        svc_filter = None

    acc_filter = account_id.strip() if account_id else None
    if acc_filter and acc_filter.lower() in ('all', ''):
        acc_filter = None

    repo = get_billing_repository(org, dataset, db)

    ds_key = dataset.get('filepath') or dataset.get('filename') or f'active_{repo.dataset_id or "default"}'
    org_id = org.id if org else 1
    cache_key = global_cache.build_key(
        org_id, ds_key, "overview",
        s=start_date, e=end_date, svc=svc_filter, acc=acc_filter
    )
    cached_res = global_cache.get(cache_key)
    if cached_res is not None:
        response.headers['X-Zorvex-Data-Source'] = cached_res.get('data_source', 'database')
        return cached_res
    if repo.has_records():
        db_res = repo.get_overview(
            start_date=start_date,
            end_date=end_date,
            account_id=acc_filter,
            service=svc_filter
        )
        db_res['data_source'] = 'database'
        response.headers['X-Zorvex-Data-Source'] = 'database'
        data = dataset.get('data') or {}
        recs = get_cached_recommendations(ds_key, data) if data else {}
        db_res['potential_savings'] = recs.get('total_potential_savings', 0.0) if isinstance(recs, dict) else 0.0
        db_res['total_resources'] = db_res.get('matching_resources_count') or len(data.get('resources', []))
        if dataset.get('filename'):
            db_res['filename'] = dataset.get('filename')
        global_cache.set(cache_key, db_res, ttl=1800)
        return db_res

    # Deterministic source-selection policy:
    if getattr(repo, 'd_rec', None) and (repo.d_rec.total_rows or 0) > 0:
        logger.error(
            "Dataset %s (ID %s) has %s expected rows in database catalog, but 0 persisted billing records",
            repo.d_rec.filename, repo.dataset_id, repo.d_rec.total_rows
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset billing records are not yet persisted or temporarily unavailable."
        )

    if not dataset.get('data'):
        response.headers['X-Zorvex-Data-Source'] = 'empty-workspace'
        return {
            'total_cost': 0.0,
            'gross_cost': 0.0,
            'net_cost': 0.0,
            'credits_total': 0.0,
            'refunds_total': 0.0,
            'taxes_total': 0.0,
            'total_rows': 0,
            'dates': [],
            'months': [],
            'services': {},
            'accounts': {},
            'regions': {},
            'daily_costs': {},
            'daily_totals': {},
            'top_services': [],
            'potential_savings': 0.0,
            'total_resources': 0,
            'filename': None,
            'data_source': 'empty-workspace',
            'status': 'EMPTY_WORKSPACE',
            'default_comparison': {
                'baseline_date': '',
                'target_date': '',
                'delta_cost': 0.0,
                'pct_change': 0.0,
                'pct_display': '0.0%'
            },
            'reconciliation': {
                'gross_usage_cost': 0.0,
                'credits_total': 0.0,
                'refunds_total': 0.0,
                'taxes_total': 0.0,
                'net_cost': 0.0,
                'formula': 'Net = Gross - Credits - Refunds + Taxes',
                'formula_verified': True
            }
        }

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    logger.info("Serving overview from in-memory fixture for dataset: %s", dataset.get('filename'))

    data = dataset['data']
    recs = get_cached_recommendations(ds_key, data)

    dates = data.get('dates', [])
    filtered_dates = dates
    if start_date:
        filtered_dates = [d for d in filtered_dates if d >= start_date]
    if end_date:
        filtered_dates = [d for d in filtered_dates if d <= end_date]

    matching_res_count = None
    all_dates = data.get('dates', [])
    is_full_span = (not start_date or (all_dates and start_date <= all_dates[0])) and (not end_date or (all_dates and end_date >= all_dates[-1]))

    if svc_filter or acc_filter:
        matching_recs = []
        for r in data.get('records', []):
            if svc_filter and r.get('service') != svc_filter:
                continue
            if acc_filter and r.get('account_id') != acc_filter:
                continue
            matching_recs.append(r)

        daily_totals_dec = defaultdict(Decimal)
        daily_gross_totals_dec = defaultdict(Decimal)
        daily_tax_totals_dec = defaultdict(Decimal)
        daily_credit_totals_dec = defaultdict(Decimal)
        daily_refund_totals_dec = defaultdict(Decimal)

        for r in matching_recs:
            d = r.get('date')
            c_dec = Decimal(str(r.get('cost', 0.0) or 0.0))
            lt = r.get('line_type', '')
            daily_totals_dec[d] += c_dec
            if lt == 'Tax':
                daily_tax_totals_dec[d] += c_dec
            elif lt in ('Credit', 'SavingsPlanNegation'):
                daily_credit_totals_dec[d] += c_dec
            elif lt == 'Refund':
                daily_refund_totals_dec[d] += c_dec
            else:
                daily_gross_totals_dec[d] += c_dec

        daily_totals = {k: round_currency(v) for k, v in daily_totals_dec.items()}
        daily_gross_totals = {k: round_currency(v) for k, v in daily_gross_totals_dec.items()}
        daily_tax_totals = {k: round_currency(v) for k, v in daily_tax_totals_dec.items()}
        daily_credit_totals = {k: round_currency(v) for k, v in daily_credit_totals_dec.items()}
        daily_refund_totals = {k: round_currency(v) for k, v in daily_refund_totals_dec.items()}

        filtered_gross = round_currency(sum(daily_gross_totals_dec.get(d, Decimal('0')) for d in filtered_dates))
        filtered_tax = round_currency(sum(daily_tax_totals_dec.get(d, Decimal('0')) for d in filtered_dates))
        filtered_credit = round_currency(sum(daily_credit_totals_dec.get(d, Decimal('0')) for d in filtered_dates))
        filtered_refund = round_currency(sum(daily_refund_totals_dec.get(d, Decimal('0')) for d in filtered_dates))
        filtered_net = round_currency(sum(daily_totals_dec.get(d, Decimal('0')) for d in filtered_dates))
        filtered_cost = filtered_gross
        matching_res_count = len(set(r.get('resource_id') for r in matching_recs if r.get('resource_id')))
    else:
        daily_totals = data.get('daily_totals', {})
        daily_gross_totals = data.get('daily_gross_totals', daily_totals)
        daily_tax_totals = data.get('daily_tax_totals', {})
        daily_credit_totals = data.get('daily_credit_totals', {})
        daily_refund_totals = data.get('daily_refund_totals', {})

        unrounded_daily_gross = data.get('_unrounded_daily_gross')
        unrounded_daily_totals = data.get('_unrounded_daily_totals')
        unrounded_daily_tax = data.get('_unrounded_daily_tax')
        unrounded_daily_credit = data.get('_unrounded_daily_credit')
        unrounded_daily_refund = data.get('_unrounded_daily_refund')

        if start_date or end_date:
            if is_full_span:
                filtered_gross = data.get('gross_cost', data['total_cost'])
                filtered_tax = data.get('taxes_total', 0.0)
                filtered_credit = data.get('credits_total', 0.0)
                filtered_refund = data.get('refunds_total', 0.0)
                filtered_net = data.get('net_cost', filtered_gross)
                filtered_cost = data['total_cost']
            else:
                if unrounded_daily_gross:
                    filtered_gross = round_currency(sum(Decimal(str(unrounded_daily_gross.get(d, '0'))) for d in filtered_dates))
                    filtered_tax = round_currency(sum(Decimal(str(unrounded_daily_tax.get(d, '0'))) for d in filtered_dates)) if unrounded_daily_tax else round(sum(daily_tax_totals.get(d, 0.0) for d in filtered_dates), 2)
                    filtered_credit = round_currency(sum(Decimal(str(unrounded_daily_credit.get(d, '0'))) for d in filtered_dates)) if unrounded_daily_credit else round(sum(daily_credit_totals.get(d, 0.0) for d in filtered_dates), 2)
                    filtered_refund = round_currency(sum(Decimal(str(unrounded_daily_refund.get(d, '0'))) for d in filtered_dates)) if unrounded_daily_refund else round(sum(daily_refund_totals.get(d, 0.0) for d in filtered_dates), 2)
                    filtered_net = round_currency(sum(Decimal(str(unrounded_daily_totals.get(d, '0'))) for d in filtered_dates)) if unrounded_daily_totals else round(sum(daily_totals.get(d, 0.0) for d in filtered_dates), 2)
                else:
                    filtered_gross = round(sum(daily_gross_totals.get(d, 0.0) for d in filtered_dates), 2)
                    filtered_tax = round(sum(daily_tax_totals.get(d, 0.0) for d in filtered_dates), 2)
                    filtered_credit = round(sum(daily_credit_totals.get(d, 0.0) for d in filtered_dates), 2)
                    filtered_refund = round(sum(daily_refund_totals.get(d, 0.0) for d in filtered_dates), 2)
                    filtered_net = round(sum(daily_totals.get(d, 0.0) for d in filtered_dates), 2)
                filtered_cost = filtered_gross
        else:
            filtered_gross = data.get('gross_cost', data['total_cost'])
            filtered_tax = data.get('taxes_total', 0.0)
            filtered_credit = data.get('credits_total', 0.0)
            filtered_refund = data.get('refunds_total', 0.0)
            filtered_net = data.get('net_cost', filtered_gross)
            filtered_cost = data['total_cost']

    if is_full_span and not acc_filter and not svc_filter:
        resp_services = {k: v for k, v in data['services'].items() if k not in ('Taxes & Surcharges', 'Tax')}
        resp_accounts = data.get('accounts', {})
    else:
        agg_services = defaultdict(Decimal)
        agg_accounts = defaultdict(Decimal)
        date_set = set(filtered_dates)
        recs_source = matching_recs if (svc_filter or acc_filter) else data.get('records', [])
        for r in recs_source:
            if r.get('date') in date_set:
                c_dec = Decimal(str(r.get('cost', 0.0) or 0.0))
                lt = r.get('line_type', '')
                if lt not in ('Credit', 'Refund', 'SavingsPlanNegation', 'Tax') and c_dec > 0:
                    s = r.get('service', 'Other')
                    if s not in ('Taxes & Surcharges', 'Tax'):
                        agg_services[s] += c_dec
                if c_dec != 0:
                    a = r.get('account_id', 'Primary-Account')
                    agg_accounts[a] += c_dec
        resp_services = {k: round_currency(v) for k, v in sorted(agg_services.items(), key=lambda item: item[1], reverse=True)}
        resp_accounts = {k: round_currency(v) for k, v in sorted(agg_accounts.items(), key=lambda item: item[1], reverse=True)}

    baseline_default = filtered_dates[-2] if len(filtered_dates) >= 2 else (filtered_dates[0] if filtered_dates else "")
    target_default = filtered_dates[-1] if filtered_dates else ""
    
    delta_info = None
    if baseline_default and target_default:
        c_base = daily_totals.get(baseline_default, 0.0)
        c_target = daily_totals.get(target_default, 0.0)
        d_cost = round(c_target - c_base, 2)
        pct = round((d_cost / c_base * 100.0), 2) if c_base > 0 else 0.0
        delta_info = {
            'delta_cost': d_cost,
            'pct_change': pct,
            'pct_display': f"{'+' if pct > 0 else ''}{pct}%"
        }

    gross_val = filtered_gross
    net_val = filtered_net
    credits_val = filtered_credit
    refunds_val = filtered_refund
    taxes_val = filtered_tax

    reconciliation = {
        "gross_usage_cost": gross_val,
        "credits_total": credits_val,
        "refunds_total": refunds_val,
        "taxes_total": taxes_val,
        "net_invoiced_spend": net_val,
        "formula": "net_invoiced_spend = gross_usage_cost + credits_total + refunds_total + taxes_total",
        "is_reconciled": bool(abs((Decimal(str(gross_val)) + Decimal(str(credits_val)) + Decimal(str(refunds_val)) + Decimal(str(taxes_val))) - Decimal(str(net_val))) < Decimal('0.01'))
    }

    return {
        "filename": dataset.get('filename'),
        "total_cost": filtered_cost,
        "gross_cost": gross_val,
        "net_cost": net_val,
        "credits_total": credits_val,
        "refunds_total": refunds_val,
        "taxes_total": taxes_val,
        "accounting_reconciliation": reconciliation,
        "total_rows": data['total_rows'],
        "dates": data['dates'],
        "filtered_dates": filtered_dates,
        "months": data['months'],
        "services": resp_services,
        "accounts": resp_accounts,
        "daily_totals": {d: daily_totals.get(d, 0.0) for d in filtered_dates},
        "default_comparison": {
            "baseline_date": baseline_default,
            "target_date": target_default,
            "delta_cost": delta_info['delta_cost'] if delta_info else 0.0,
            "pct_change": delta_info['pct_change'] if delta_info else 0.0,
            "pct_display": delta_info['pct_display'] if delta_info else "0.0%"
        },
        "potential_savings": recs['total_potential_savings'],
        "total_resources": matching_res_count if matching_res_count is not None else len(data['resources'])
    }


@router.get("/trends")
def get_trends(
    response: Response,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        return repo.get_trend_data(start_date=start_date, end_date=end_date)

    if getattr(repo, 'd_rec', None) and (repo.d_rec.total_rows or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset billing records are not yet persisted or temporarily unavailable."
        )

    if not dataset.get('data'):
        response.headers['X-Zorvex-Data-Source'] = 'empty-workspace'
        return {
            'dates': [],
            'daily_spend': {},
            'daily_gross': {},
            'daily_tax': {},
            'daily_credit': {},
            'daily_refund': {}
        }

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    data = dataset['data']
    if not start_date and not end_date:
        if '_trends' not in data:
            data['_trends'] = get_trend_data(data)
        return data['_trends']
    return get_trend_data(data, start_date=start_date, end_date=end_date)


@router.get("/resources")
def search_resources(
    response: Response,
    query: Optional[str] = None,
    service: Optional[str] = "All",
    category: Optional[str] = "ALL",
    account_id: Optional[str] = "all",
    region: Optional[str] = "all",
    min_cost: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = "cost",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 25,
    limit: Optional[int] = None,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    eff_page_size = limit if (limit and limit > 0) else page_size

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        return repo.query_resources(
            query=query,
            service=service,
            category=category,
            account_id=account_id,
            region=region,
            min_cost=min_cost,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=eff_page_size
        )

    if getattr(repo, 'd_rec', None) and (repo.d_rec.total_rows or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset billing records are not yet persisted or temporarily unavailable."
        )

    if not dataset.get('data'):
        response.headers['X-Zorvex-Data-Source'] = 'empty-workspace'
        return {
            'status': 'EMPTY',
            'summary': {
                'total_cost': 0.0,
                'unique_resources_count': 0
            },
            'resources': [],
            'total_count': 0,
            'pagination': {
                'page': page,
                'page_size': eff_page_size,
                'total_pages': 0,
                'total_resources': 0
            },
            'hierarchies': {
                'services': [],
                'categories_by_service': {}
            }
        }

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    return query_resource_explorer(
        dataset['data'],
        service=service,
        category=category,
        account_id=account_id,
        region=region,
        query=query,
        min_cost=min_cost,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=eff_page_size
    )


@router.get("/resources/hierarchies")
def get_resource_hierarchies(
    response: Response,
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        return repo.get_resource_hierarchies()

    if getattr(repo, 'd_rec', None) and (repo.d_rec.total_rows or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset billing records are not yet persisted or temporarily unavailable."
        )

    if not dataset.get('data'):
        response.headers['X-Zorvex-Data-Source'] = 'empty-workspace'
        return {
            'services': [],
            'categories_by_service': {},
            'regions': [],
            'accounts': []
        }

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    return get_available_hierarchies(dataset['data'])


@router.get("/resources/detail")
def get_resource_detail_endpoint(
    response: Response,
    resource_id: str = Query(..., description="AWS Resource ID or ARN to inspect"),
    auth: Tuple[Optional[User], Optional[Organization]] = Depends(get_current_user_and_org),
    db: Session = Depends(get_db)
):
    user, org = auth
    dataset = get_active_dataset_for_org(org, db)

    repo = get_billing_repository(org, dataset, db)
    if repo.has_records():
        response.headers['X-Zorvex-Data-Source'] = 'database'
        detail = repo.get_resource_detail(resource_id)
        if not detail:
            raise HTTPException(status_code=404, detail=f"Resource '{resource_id}' not found in active dataset")
        return detail

    if getattr(repo, 'd_rec', None) and (repo.d_rec.total_rows or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset billing records are not yet persisted or temporarily unavailable."
        )

    if not dataset.get('data'):
        raise HTTPException(status_code=404, detail=f"No dataset loaded. Resource '{resource_id}' not found.")

    response.headers['X-Zorvex-Data-Source'] = 'in-memory-fixture'
    detail = get_resource_detail(dataset['data'], resource_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Resource '{resource_id}' not found in active dataset")
    return detail
