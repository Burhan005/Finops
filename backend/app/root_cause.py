"""
ZORVEX FinOps Platform - Cost Root-Cause Analysis & Variance Attribution Engine
=============================================================================
Provides rigorous, evidence-based decomposition of cloud cost variances across
arbitrary timeframes (Day-over-Day, Week-over-Week, Month-over-Month like-for-like,
and custom date ranges).

Decomposes variances into:
1. Quantity Effect (ΔQ * R_base): Usage volume / runtime hours surges or decreases.
2. Rate Effect (Q_base * ΔR): Pricing shifts, commitment coverage changes, RI expiration.
3. Workload Lifecycle: Newly provisioned resources vs terminated/stopped resources.
4. Billing Adjustments: RIFees, Taxes, Credits, Refunds, and account-level fees.
5. Service and Resource Attribution with exact mathematical share of total net delta.
"""

from typing import Dict, List, Any, Optional, Tuple, Set
from collections import defaultdict
import math
import re


def clean_resource_label(arn_or_id: str) -> str:
    """Extracts human-readable identifier from raw AWS ARN or ID."""
    if not arn_or_id:
        return "Unassigned"
    if arn_or_id in ('Unknown', 'Unassigned', 'No-Resource-ID'):
        return arn_or_id
    if ':instance/' in arn_or_id:
        return arn_or_id.split(':instance/')[-1]
    if ':volume/' in arn_or_id:
        return arn_or_id.split(':volume/')[-1]
    if ':snapshot/' in arn_or_id:
        return arn_or_id.split(':snapshot/')[-1]
    if ':db:' in arn_or_id:
        return arn_or_id.split(':db:')[-1]
    if ':domain/' in arn_or_id:
        return arn_or_id.split(':domain/')[-1].split(':')[0]
    if ':cluster:' in arn_or_id:
        return arn_or_id.split(':cluster:')[-1]
    if ':loadbalancer/' in arn_or_id:
        parts = arn_or_id.split(':loadbalancer/')[-1].split('/')
        return f"{parts[0]}/{parts[1]}" if len(parts) >= 2 else parts[0]
    if ':natgateway/' in arn_or_id:
        return arn_or_id.split(':natgateway/')[-1]
    if arn_or_id.startswith('arn:aws:s3:::'):
        return f"s3://{arn_or_id.split(':::')[-1]}"
    if ':function:' in arn_or_id:
        return arn_or_id.split(':function:')[-1].split(':')[0]
    if '/' in arn_or_id and not arn_or_id.startswith('http'):
        return arn_or_id.split('/')[-1]
    return arn_or_id


def classify_resource_variance(
    rid: str,
    cb: float,
    ct: float,
    qb: float,
    qt: float,
    unit: str,
    svc: str,
    uts_base: Set[str],
    uts_target: Set[str],
    line_types: Set[str],
    name: str = ""
) -> Tuple[str, str, str, str]:
    """
    Classifies a resource's variance into an authoritative FinOps category,
    generates a clear engineering explanation, defines evidence confidence,
    and documents operational boundaries.
    
    Returns:
        (category, explanation, evidence_status, operational_note)
    """
    diff = ct - cb
    q_diff = qt - qb
    unit_str = f" {unit}" if unit else ""
    name_str = f" ({name})" if name else ""

    # Check for Account-Level / Billing Fee line types
    is_fee_tax = any(t in ('Tax', 'RIFee', 'Fee', 'Credit', 'Refund') for t in line_types)
    if rid.startswith('TAX-') or rid.startswith('No-Resource-ID') or is_fee_tax or svc == 'Tax':
        if diff > 0:
            return (
                'BILLING_FEE_OR_TAX',
                f"Account-level billing charges/taxes increased (+${diff:.2f})",
                'CONFIRMED_BY_CUR',
                "CUR documents invoice-level taxes, recurring reservation fees, or non-resource charges."
            )
        else:
            return (
                'BILLING_FEE_OR_TAX',
                f"Account-level fees or credits normalized (-${abs(diff):.2f})",
                'CONFIRMED_BY_CUR',
                "Invoice-level credit or fee subsidence recorded in CUR."
            )

    diff_str = f"+${diff:.2f}" if diff > 0 else f"-${abs(diff):.2f}"

    # 1. New Workload (0 baseline cost and >0 target cost)
    if cb <= 0.0001 and ct > 0.0001:
        if q_diff > 0:
            qty_info = f" with {qt:,.2f}{unit_str}"
        else:
            qty_info = ""
        return (
            'NEW_RESOURCE',
            f"Newly provisioned workload{name_str} began incurring charges (+${ct:.2f}{qty_info})",
            'CONFIRMED_BY_CUR',
            "Resource identifier appeared in billing records for the first time in the comparison window. Operational trigger (API/IaC/AutoScaling) requires CloudTrail."
        )

    # 2. Terminated or Inactive Workload (>0 baseline cost and 0 target cost)
    if cb > 0.0001 and ct <= 0.0001:
        return (
            'TERMINATED_RESOURCE',
            f"Workload{name_str} stopped incurring charges (Saved ${cb:.2f}/period)",
            'CONFIRMED_BY_CUR',
            "Resource had zero billing line items in target period. Proves billing cessation; physical instance deletion vs stop state requires AWS Config/EC2 describe."
        )

    # 3. Usage Type / Capacity / SKU Shift
    if uts_base and uts_target and uts_base != uts_target:
        diff_uts = uts_target - uts_base
        new_sku = list(diff_uts)[0] if diff_uts else list(uts_target)[0]
        return (
            'CAPACITY_OR_SKU_CHANGE',
            f"Billed capacity or SKU changed to {new_sku} ({diff_str})",
            'CONFIRMED_BY_CUR',
            "Underlying lineItem/UsageType shifted between periods, indicating instance resize, storage tier migration, or multi-AZ change."
        )

    # 4. Usage Quantity Surges (runtime hours, GB stored, GB transit, I/O)
    if abs(q_diff) > 0.01:
        if diff > 0:
            if qb > 0:
                pct_q = ((q_diff / qb) * 100.0)
                q_text = f"increased by +{q_diff:,.2f}{unit_str} (+{pct_q:.1f}%)"
            else:
                q_text = f"increased by +{q_diff:,.2f}{unit_str}"
            return (
                'USAGE_QUANTITY_INCREASE',
                f"Consumption/runtime{name_str} {q_text} ({diff_str})",
                'CONFIRMED_BY_CUR',
                f"CUR verifies exact billed usage quantity change of {q_diff:+,.2f}{unit_str}. Explaining business intent requires application telemetry."
            )
        else:
            pct_q = abs((q_diff / qb) * 100.0) if qb > 0 else 0.0
            return (
                'USAGE_QUANTITY_DECREASE',
                f"Consumption/runtime{name_str} decreased by {abs(q_diff):,.2f}{unit_str} (-{pct_q:.1f}%) (-${abs(diff):.2f})",
                'CONFIRMED_BY_CUR',
                f"CUR verifies reduced usage quantity of {q_diff:+,.2f}{unit_str}."
            )

    # 5. Effective Rate / Discount Change (same usage, different price)
    if abs(diff) > 0.005:
        rate_b = (cb / qb) if qb > 0 else 0.0
        rate_t = (ct / qt) if qt > 0 else 0.0
        if abs(rate_t - rate_b) > 0.0001:
            return (
                'RATE_OR_DISCOUNT_CHANGE',
                f"Effective billing rate shifted from ${rate_b:.4f} to ${rate_t:.4f}{unit_str} ({diff_str})",
                'PARTIAL_EVIDENCE',
                "Rate variance detected with steady usage quantity. May indicate Reserved Instance coverage shift, Savings Plan discount expiration, or on-demand surge."
            )

    # 6. Steady Baseline
    return (
        'STABLE_USAGE',
        f"Steady-state baseline operations{name_str} (${ct:.2f})",
        'CONFIRMED_BY_CUR',
        "Resource billing remained flat within steady-state variance bounds."
    )


def analyze_cost_root_cause(
    cur_data: Dict[str, Any],
    baseline_start: str,
    baseline_end: str,
    target_start: str,
    target_end: str,
    service: Optional[str] = None,
    account_id: Optional[str] = None,
    min_delta: float = 0.001
) -> Dict[str, Any]:
    """
    Primary FinOps Investigation Algorithm.
    
    Accepts arbitrary baseline and target date windows, decomposes the net spend
    variance into service, resource, and usage-type contributions, and isolates
    the definitive root cause with evidence ratings.
    """
    records = cur_data.get('records', [])
    if not records:
        return {
            'status': 'NO_DATA',
            'error': 'No billing records available in active dataset'
        }

    # Optional account scoping
    if account_id and account_id.lower() not in ('all', ''):
        records = [r for r in records if r.get('account_id') == account_id]

    # Optional service scoping
    if service and service.lower() not in ('all', ''):
        records = [r for r in records if r.get('service') == service]

    # Partition records into baseline window and target window
    # Exclude invoice-level credits/refunds from operational usage delta
    upfront_types = {'Credit', 'Refund'}
    
    if baseline_start and baseline_end:
        baseline_records = [
            r for r in records 
            if baseline_start <= r['date'] <= baseline_end 
            and r.get('line_type') not in upfront_types
        ]
    else:
        baseline_records = []

    target_records = [
        r for r in records 
        if target_start <= r['date'] <= target_end 
        and r.get('line_type') not in upfront_types
    ] if (target_start and target_end) else []

    base_dates = sorted(list(set(r['date'] for r in baseline_records)))
    target_dates = sorted(list(set(r['date'] for r in target_records)))
    
    days_base = len(base_dates)
    days_target = len(target_dates)
    is_like_for_like = (days_base == days_target and days_base > 0)
    days_base_divisor = max(days_base, 1)
    days_target_divisor = max(days_target, 1)

    cost_base = sum(r['cost'] for r in baseline_records)
    cost_target = sum(r['cost'] for r in target_records)
    net_delta = cost_target - cost_base

    # Percentage change with zero-baseline safety
    has_valid_baseline = bool(baseline_records and cost_base > 0)
    if has_valid_baseline:
        pct_change = round(((net_delta / cost_base) * 100.0), 2)
        pct_display = f"{'+' if pct_change > 0 else ''}{pct_change:.2f}%"
    elif cost_target > 0:
        pct_change = None
        pct_display = "Selected Period Analysis" if not baseline_records else "N/A (New spend from zero baseline)"
    else:
        pct_change = 0.0
        pct_display = "0.0%"

    # -------------------------------------------------------------
    # 1. Service-Level Variance Decomposition
    # -------------------------------------------------------------
    svc_base = defaultdict(float)
    svc_target = defaultdict(float)
    svc_records_base = defaultdict(int)
    svc_records_target = defaultdict(int)
    daily_base_totals = defaultdict(float)
    daily_target_totals = defaultdict(float)
    daily_target_service = defaultdict(lambda: defaultdict(float))
    daily_target_records = defaultdict(int)

    for r in baseline_records:
        svc_base[r['service']] += r['cost']
        svc_records_base[r['service']] += 1
        d = r.get('date', '')
        if d:
            daily_base_totals[d] += r['cost']

    for r in target_records:
        svc_target[r['service']] += r['cost']
        svc_records_target[r['service']] += 1
        d = r.get('date', '')
        c = float(r.get('cost', 0.0) or 0.0)
        s = r.get('service', 'Other')
        if d:
            daily_target_totals[d] += c
            daily_target_service[d][s] += c
            daily_target_records[d] += 1

    all_services = sorted(list(s for s in (set(svc_base.keys()) | set(svc_target.keys())) if s not in ('Taxes & Surcharges', 'Tax')))
    services_summary = []

    for s in all_services:
        sb = svc_base[s]
        st = svc_target[s]
        sdiff = st - sb

        if sb > 0:
            spct = round(((sdiff / sb) * 100.0), 1)
            spct_str = f"{'+' if spct > 0 else ''}{spct:.1f}%"
        elif st > 0:
            spct = None
            spct_str = "New"
        else:
            spct = 0.0
            spct_str = "0.0%"

        # Share of total net delta
        if abs(net_delta) > 0.001:
            share_pct = round((sdiff / net_delta) * 100.0, 1)
        else:
            share_pct = 0.0

        services_summary.append({
            'service': s,
            'baseline_cost': round(sb, 2),
            'target_cost': round(st, 2),
            'delta_cost': round(sdiff, 2),
            'pct_change': spct,
            'pct_display': spct_str,
            'share_of_total_delta': share_pct,
            'direction': 'INCREASE' if sdiff > min_delta else ('DECREASE' if sdiff < -min_delta else 'FLAT'),
            'baseline_records_count': svc_records_base[s],
            'target_records_count': svc_records_target[s]
        })

    # Sort services by absolute financial impact
    services_summary.sort(key=lambda x: abs(x['delta_cost']), reverse=True)

    # -------------------------------------------------------------
    # 2. Resource-Level Aggregation & Mathematical Root-Cause Synthesis
    # -------------------------------------------------------------
    res_base = defaultdict(lambda: {
        'cost': 0.0, 'usage_qty': 0.0, 'unit': '', 'service': '', 'name': '',
        'account_id': '', 'region': '', 'usage_types': set(), 'line_types': set(),
        'operations': set(), 'record_count': 0
    })
    res_daily_base = defaultdict(lambda: defaultdict(float))
    res_daily_target = defaultdict(lambda: defaultdict(float))
    res_line_items = defaultdict(list)

    for r in baseline_records:
        if r.get('line_type', '').lower() == 'tax' or r.get('service') in ('Taxes & Surcharges', 'Tax') or (r.get('resource_id') or '').startswith('TAX-'):
            continue
        rid = r.get('resource_id') or 'Unassigned'
        item = res_base[rid]
        c = float(r.get('cost', 0.0) or 0.0)
        item['cost'] += c
        u_amt = float(r.get('usage_amount', 0.0) or 0.0)
        item['usage_qty'] += u_amt
        if r.get('unit'):
            item['unit'] = r['unit']
        item['service'] = r['service']
        if r.get('name'):
            item['name'] = r['name']
        if r.get('account_id'):
            item['account_id'] = r['account_id']
        if r.get('region'):
            item['region'] = r['region']
        item['usage_types'].add(r.get('usage_type', ''))
        item['line_types'].add(r.get('line_type', ''))
        item['operations'].add(r.get('operation', ''))
        item['record_count'] += 1

        r_day = r.get('date', '')
        if r_day:
            res_daily_base[rid][r_day] += c

        if len(res_line_items[rid]) < 20:
            res_line_items[rid].append({
                'date': r_day,
                'period': 'baseline',
                'line_type': r.get('line_type', ''),
                'usage_type': r.get('usage_type', ''),
                'operation': r.get('operation', ''),
                'usage_amount': round(u_amt, 4),
                'unit': r.get('unit', ''),
                'cost': round(c, 4),
                'unblended_cost': round(float(r.get('unblended_cost', c) or 0.0), 4),
                'desc': r.get('desc', '') or r.get('item_description', '')
            })

    res_target = defaultdict(lambda: {
        'cost': 0.0, 'usage_qty': 0.0, 'unit': '', 'service': '', 'name': '',
        'account_id': '', 'region': '', 'usage_types': set(), 'line_types': set(),
        'operations': set(), 'record_count': 0
    })
    for r in target_records:
        if r.get('line_type', '').lower() == 'tax' or r.get('service') in ('Taxes & Surcharges', 'Tax') or (r.get('resource_id') or '').startswith('TAX-'):
            continue
        rid = r.get('resource_id') or 'Unassigned'
        item = res_target[rid]
        c = float(r.get('cost', 0.0) or 0.0)
        item['cost'] += c
        u_amt = float(r.get('usage_amount', 0.0) or 0.0)
        item['usage_qty'] += u_amt
        if r.get('unit'):
            item['unit'] = r['unit']
        item['service'] = r['service']
        if r.get('name'):
            item['name'] = r['name']
        if r.get('account_id'):
            item['account_id'] = r['account_id']
        if r.get('region'):
            item['region'] = r['region']
        item['usage_types'].add(r.get('usage_type', ''))
        item['line_types'].add(r.get('line_type', ''))
        item['operations'].add(r.get('operation', ''))
        item['record_count'] += 1

        r_day = r.get('date', '')
        if r_day:
            res_daily_target[rid][r_day] += c

        # Prioritize target line items in sample
        if len(res_line_items[rid]) < 40:
            res_line_items[rid].insert(0, {
                'date': r_day,
                'period': 'target',
                'line_type': r.get('line_type', ''),
                'usage_type': r.get('usage_type', ''),
                'operation': r.get('operation', ''),
                'usage_amount': round(u_amt, 4),
                'unit': r.get('unit', ''),
                'cost': round(c, 4),
                'unblended_cost': round(float(r.get('unblended_cost', c) or 0.0), 4),
                'desc': r.get('desc', '') or r.get('item_description', '')
            })

    all_rids = set(res_base.keys()) | set(res_target.keys())

    all_resources = []
    category_totals = defaultdict(float)

    spikes = []
    reductions = []
    new_workloads = []
    decommissioned = []

    for rid in all_rids:
        b = res_base.get(rid, {})
        t = res_target.get(rid, {})

        cb = b.get('cost', 0.0)
        ct = t.get('cost', 0.0)
        diff = ct - cb

        qb = b.get('usage_qty', 0.0)
        qt = t.get('usage_qty', 0.0)
        qdiff = qt - qb

        svc = t.get('service') or b.get('service') or 'Other'
        unit = t.get('unit') or b.get('unit') or ''
        name = t.get('name') or b.get('name') or ''
        acc = t.get('account_id') or b.get('account_id') or ''
        reg = t.get('region') or b.get('region') or 'global'

        uts_b = b.get('usage_types') or set()
        uts_t = t.get('usage_types') or set()
        ltypes = (b.get('line_types') or set()) | (t.get('line_types') or set())
        operations = list((b.get('operations') or set()) | (t.get('operations') or set()))

        # Variance attribution category
        cat, explanation, evidence, op_note = classify_resource_variance(
            rid=rid, cb=cb, ct=ct, qb=qb, qt=qt, unit=unit, svc=svc,
            uts_base=uts_b, uts_target=uts_t, line_types=ltypes, name=name
        )

        category_totals[cat] += diff

        # Share of total net variance
        if abs(net_delta) > 0.001:
            share_pct = round((diff / net_delta) * 100.0, 1)
        else:
            share_pct = 0.0

        if cb > 0:
            rpct = round(((diff / cb) * 100.0), 1)
            rpct_str = f"{'+' if rpct > 0 else ''}{rpct:.1f}%"
        elif ct > 0:
            rpct = None
            rpct_str = "New"
        else:
            rpct = 0.0
            rpct_str = "0.0%"

        # Mathematical decomposition: Quantity effect vs Rate effect
        rate_b = (cb / qb) if qb > 0 else 0.0
        rate_t = (ct / qt) if qt > 0 else 0.0
        if qb > 0 and qt > 0:
            qty_effect = (qt - qb) * rate_b
            rate_effect = qb * (rate_t - rate_b)
        elif cb <= 0.0001:
            qty_effect = ct
            rate_effect = 0.0
        else:
            qty_effect = -cb
            rate_effect = 0.0

        resource_entry = {
            'resource_id': rid,
            'short_id': clean_resource_label(rid),
            'name': name,
            'service': svc,
            'account_id': acc,
            'region': reg,
            'baseline_cost': round(cb, 4),
            'target_cost': round(ct, 4),
            'delta_cost': round(diff, 4),
            'pct_change': rpct,
            'pct_display': rpct_str,
            'share_of_total_delta': share_pct,
            'baseline_usage_qty': round(qb, 2),
            'target_usage_qty': round(qt, 2),
            'delta_usage_qty': round(qdiff, 2),
            'usage_unit': unit,
            'effective_rate_base': round(rate_b, 6) if (0 < rate_b < 0.001) else round(rate_b, 4),
            'effective_rate_target': round(rate_t, 6) if (0 < rate_t < 0.001) else round(rate_t, 4),
            'rate_unit': f"$/{unit}" if unit else "$/unit",
            'quantity_effect': round(qty_effect, 4),
            'rate_effect': round(rate_effect, 4),
            'change_category': cat,
            'explanation': explanation,
            'evidence_status': evidence,
            'operational_note': op_note,
            'usage_types': sorted(list(uts_b | uts_t)),
            'operations': sorted(operations),
            'raw_records_count': (b.get('record_count', 0) + t.get('record_count', 0)),
            'line_items_sample': res_line_items[rid][:5] if abs(diff) >= min_delta else []
        }

        all_resources.append(resource_entry)

        if cat == 'NEW_RESOURCE':
            new_workloads.append(resource_entry)
        elif cat == 'TERMINATED_RESOURCE':
            decommissioned.append(resource_entry)

        if diff > min_delta:
            spikes.append(resource_entry)
        elif diff < -min_delta:
            reductions.append(resource_entry)

    # Sort lists by financial magnitude
    spikes.sort(key=lambda x: x['delta_cost'], reverse=True)
    reductions.sort(key=lambda x: x['delta_cost'])
    new_workloads.sort(key=lambda x: x['target_cost'], reverse=True)
    decommissioned.sort(key=lambda x: x['baseline_cost'], reverse=True)
    all_resources.sort(key=lambda x: abs(x['delta_cost']), reverse=True)

    # -------------------------------------------------------------
    # 3. Daily Cost Timeline & Spike Decomposition
    # -------------------------------------------------------------
    target_days_sorted = sorted(daily_target_totals.keys())
    daily_timeline = []
    max_cost = -1.0
    min_cost = float('inf') if target_days_sorted else 0.0
    max_day = ""
    min_day = ""

    for d in target_days_sorted:
        c = round(daily_target_totals[d], 2)
        if c > max_cost:
            max_cost = c
            max_day = d
        if c < min_cost:
            min_cost = c
            min_day = d

    daily_spikes = []
    daily_drops = []

    for i, d in enumerate(target_days_sorted):
        c = round(daily_target_totals[d], 2)
        prev_c = round(daily_target_totals[target_days_sorted[i-1]], 2) if i > 0 else c
        d_delta = round(c - prev_c, 2)
        d_pct = round((d_delta / prev_c * 100.0), 1) if prev_c > 0 else 0.0
        is_spike = bool(d_delta > 5.0 and d_pct >= 15.0)
        is_drop = bool(d_delta < -5.0 and d_pct <= -15.0)

        # Baseline matching day for DoD alignment
        base_d = base_dates[i] if i < len(base_dates) else None
        base_d_cost = round(daily_base_totals[base_d], 2) if base_d else None

        timeline_item = {
            'date': d,
            'total_cost': c,
            'previous_day_cost': prev_c if i > 0 else None,
            'equivalent_baseline_date': base_d,
            'equivalent_baseline_cost': base_d_cost,
            'daily_delta': d_delta if i > 0 else 0.0,
            'pct_change': d_pct if i > 0 else 0.0,
            'is_peak': (d == max_day),
            'is_trough': (d == min_day),
            'is_spike': is_spike,
            'is_drop': is_drop,
            'records_count': daily_target_records[d],
            'service_breakdown': {s: round(v, 2) for s, v in sorted(daily_target_service[d].items(), key=lambda x: x[1], reverse=True)}
        }
        daily_timeline.append(timeline_item)

        if is_spike:
            daily_spikes.append({'date': d, 'cost': c, 'delta': d_delta, 'pct': d_pct})
        if is_drop:
            daily_drops.append({'date': d, 'cost': c, 'delta': d_delta, 'pct': d_pct})

    # -------------------------------------------------------------
    # 4. Financial Reconciliation & Data Completeness Auditing
    # -------------------------------------------------------------
    unallocated_records = [
        r for r in target_records 
        if not r.get('resource_id') or r.get('resource_id') in ('Unassigned', 'Unknown', 'No-Resource-ID') 
        or r.get('resource_id').startswith('No-Resource-ID') or r.get('resource_id').startswith('TAX-')
    ]
    unallocated_target_cost = round(sum(r['cost'] for r in unallocated_records), 2)
    allocated_target_cost = round(cost_target - unallocated_target_cost, 2)
    sum_service_deltas = round(sum(s['delta_cost'] for s in services_summary), 2)

    reconciliation = {
        'gross_baseline_cost': round(cost_base, 2),
        'gross_target_cost': round(cost_target, 2),
        'net_delta': round(net_delta, 2),
        'sum_service_deltas': sum_service_deltas,
        'allocated_target_cost': allocated_target_cost,
        'unallocated_target_cost': unallocated_target_cost,
        'allocation_percentage': round((allocated_target_cost / cost_target * 100.0), 1) if cost_target > 0 else 100.0,
        'is_reconciled': bool(abs(round(net_delta - sum_service_deltas, 2)) < 0.05)
    }

    all_dataset_dates = cur_data.get('dates', [])
    latest_date_in_cur = all_dataset_dates[-1] if all_dataset_dates else ''
    is_latest_partial = bool(
        target_dates and target_dates[-1] == latest_date_in_cur 
        and daily_target_records.get(target_dates[-1], 0) < 500
    )

    data_completeness = {
        'earliest_ingested_date': all_dataset_dates[0] if all_dataset_dates else '',
        'latest_ingested_date': latest_date_in_cur,
        'target_days_requested': len(target_dates),
        'target_days_available': len(target_dates),
        'baseline_days_requested': len(base_dates),
        'baseline_days_available': len(base_dates),
        'has_missing_baseline': bool(len(base_dates) == 0 and cost_base == 0 and (baseline_start or baseline_end)),
        'is_partial_latest_day': is_latest_partial,
        'latest_day_notice': (
            f"Latest date {latest_date_in_cur} contains partial billing records and should not be confused with confirmed spend reduction."
            if is_latest_partial else ""
        )
    }

    # -------------------------------------------------------------
    # 5. Primary Root Cause Narrative Construction
    # -------------------------------------------------------------
    top_driver_text = "Stable fleet operations"
    if spikes:
        primary = spikes[0]
        base_expl = re.sub(r'\s*\([+–-]?\$[0-9.,]+\)\s*$', '', primary['explanation']).strip()
        top_driver_text = f"Top Cost Driver: {base_expl} (+${primary['delta_cost']:.2f}, {primary['share_of_total_delta']}% of net change)"
    elif reductions:
        primary = reductions[0]
        base_expl = re.sub(r'\s*\([+–-]?\$[0-9.,]+\)\s*$', '', primary['explanation']).strip()
        top_driver_text = f"Top Cost Saver: {base_expl} (-${abs(primary['delta_cost']):.2f})"

    # Human-readable executive takeaway
    if net_delta > 0.05:
        summary_verdict = f"Cost increased by +${net_delta:.2f} ({pct_display}) between periods. {top_driver_text}."
    elif net_delta < -0.05:
        summary_verdict = f"Cost reduced by -${abs(net_delta):.2f} ({pct_display}) between periods. {top_driver_text}."
    else:
        summary_verdict = "Cost remained flat (±$0.05 variance) across steady-state operations."

    return {
        'status': 'SUCCESS',
        'comparison_window': {
            'baseline': {
                'start_date': baseline_start,
                'end_date': baseline_end,
                'total_days': days_base,
                'total_cost': round(cost_base, 2),
                'records_count': len(baseline_records)
            },
            'target': {
                'start_date': target_start,
                'end_date': target_end,
                'total_days': days_target,
                'total_cost': round(cost_target, 2),
                'records_count': len(target_records)
            },
            'is_like_for_like': is_like_for_like,
            'daily_average_baseline': round(cost_base / days_base_divisor, 2) if days_base > 0 else 0.0,
            'daily_average_target': round(cost_target / days_target_divisor, 2) if days_target > 0 else 0.0
        },
        'variance_summary': {
            'net_delta': round(net_delta, 2),
            'pct_change': pct_change,
            'pct_display': pct_display,
            'direction': 'INCREASE' if net_delta > min_delta else ('DECREASE' if net_delta < -min_delta else 'FLAT'),
            'top_driver_narrative': top_driver_text,
            'executive_summary': summary_verdict
        },
        'category_decomposition': {k: round(v, 2) for k, v in category_totals.items()},
        'service_attribution': services_summary,
        'top_cost_increases': spikes[:25],
        'top_cost_reductions': reductions[:25],
        'newly_launched_workloads': new_workloads[:25],
        'terminated_workloads': decommissioned[:25],
        'total_spiking_resources': len(spikes),
        'total_reducing_resources': len(reductions),
        'total_new_resources': len(new_workloads),
        'total_decommissioned_resources': len(decommissioned),
        'total_evaluated_resources': len(all_resources),
        'daily_timeline': daily_timeline,
        'daily_spikes': daily_spikes,
        'daily_drops': daily_drops,
        'peak_spend_day': {'date': max_day, 'cost': max_cost} if max_day else None,
        'trough_spend_day': {'date': min_day, 'cost': min_cost} if min_day else None,
        'financial_reconciliation': reconciliation,
        'data_completeness': data_completeness,
        'resources': all_resources  # Complete evaluated resources
    }
