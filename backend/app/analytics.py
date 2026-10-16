"""
ZORVEX Analytics & Cost Intelligence Engine
Provides Daily Delta, Monthly Comparison, and Date-to-Date Attribution based on actual CUR records.
Integrates the complete root cause deduction system and micro-dollar handling from finops_analyzer.py.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional


def clean_resource_label(arn_or_id: str) -> str:
    """Converts lengthy raw AWS ARNs into clean human-readable executive labels."""
    if not arn_or_id or arn_or_id in ['Unassigned', 'Unknown', 'Baseline', 'Steady Fleet', 'No-Resource-ID']:
        return arn_or_id or 'Baseline Fleet'
    
    if 'distribution/' in arn_or_id:
        return f"CloudFront ({arn_or_id.split('distribution/')[-1]})"
    if 'loadbalancer/app/' in arn_or_id:
        return f"ALB ({arn_or_id.split('loadbalancer/app/')[-1].split('/')[0]})"
    if 'loadbalancer/net/' in arn_or_id:
        return f"NLB ({arn_or_id.split('loadbalancer/net/')[-1].split('/')[0]})"
    if ':db:' in arn_or_id:
        return f"RDS ({arn_or_id.split(':db:')[-1]})"
    if 'natgateway/' in arn_or_id:
        return f"NAT Gateway ({arn_or_id.split('natgateway/')[-1]})"
    if ':domain/' in arn_or_id:
        return f"OpenSearch ({arn_or_id.split(':domain/')[-1]})"
    if '/webacl/' in arn_or_id:
        return f"WAF ({arn_or_id.split('/webacl/')[-1].split('/')[0]})"
    if ':rep:' in arn_or_id:
        return f"DMS ({arn_or_id.split(':rep:')[-1]})"
    if ':stream/' in arn_or_id:
        return f"Kinesis ({arn_or_id.split(':stream/')[-1]})"
    if ':log-group:' in arn_or_id:
        return f"CloudWatch ({arn_or_id.split(':log-group:')[-1]})"
    if 'hostedzone/' in arn_or_id:
        return f"Route 53 ({arn_or_id.split('hostedzone/')[-1]})"
    if ':cluster:' in arn_or_id and 'redshift' in arn_or_id.lower():
        return f"Redshift ({arn_or_id.split(':cluster:')[-1]})"
    if arn_or_id.startswith('arn:aws:s3:::'):
        return f"S3 ({arn_or_id.split(':::')[-1]})"
    if ':function/' in arn_or_id:
        return f"CF Function ({arn_or_id.split(':function/')[-1]})"
    if ':function:' in arn_or_id:
        return f"Lambda ({arn_or_id.split(':function:')[-1].split(':')[0]})"
    if ':secret:' in arn_or_id:
        return f"Secrets Manager ({arn_or_id.split(':secret:')[-1].split('-')[0]})"
    if ':snapshot:' in arn_or_id:
        return f"RDS Snapshot ({arn_or_id.split(':snapshot:')[-1]})"
    if 'network-interface/' in arn_or_id:
        return f"ENI ({arn_or_id.split('network-interface/')[-1]})"
    if arn_or_id.startswith('i-'):
        return f"EC2 ({arn_or_id})"
    if arn_or_id.startswith('vol-'):
        return f"EBS ({arn_or_id})"
    if '/' in arn_or_id:
        return arn_or_id.split('/')[-1]
    return arn_or_id


def deduce_service_cause(
    service: str,
    cost_base: float,
    cost_target: float,
    diff: float,
    top_resource: str = '',
    top_res_diff: float = 0.0
) -> str:
    """Service-level root cause deduction matching finops_analyzer.py with 100% dynamic CUR facts."""
    res_label = clean_resource_label(top_resource) if top_resource and top_resource not in ['Unassigned', 'Unknown', 'No-Resource-ID'] else ""
    res_str = f" on {res_label}" if res_label else ""

    if diff < -0.01:
        if top_resource and abs(top_res_diff) >= 0.01:
            return f"Spend reduction{res_str} (-${abs(top_res_diff):.2f})"
        return f"Monthly commitment fees / usage subsided (-${abs(diff):.2f})"
    elif diff > 0.01:
        if top_resource and top_res_diff >= 0.01:
            return f"Usage increase{res_str} (+${top_res_diff:.2f})"
        return f"Service usage / consumption increased (+${diff:.2f})"
    return "Steady ongoing baseline operations"


def deduce_resource_root_cause(
    res_id: str,
    cost_base: float,
    cost_target: float,
    diff: float,
    usage_types: Optional[List[str]] = None,
    service: str = '',
    term: str = '',
    line_type: str = '',
    sp_arn: str = '',
    last_seen: str = ''
) -> str:
    """Individual resource engineering root cause synthesis matching finops_analyzer.py"""
    usage_types = usage_types or []
    ut_lower = " ".join(u.lower() for u in usage_types)
    res_lower = res_id.lower()
    last_str = f" [Last active: {last_seen}]" if last_seen else ""

    # Helper to extract EC2 instance size
    inst_size = ""
    for u in usage_types:
        if 'BoxUsage:' in u:
            inst_size = u.split('BoxUsage:')[-1]
            break
        elif ':' in u and any(f in u for f in ['t2.', 't3.', 't3a.', 't4g.', 'c5.', 'm5.', 'r5.']):
            inst_size = u.split(':')[-1]
            break

    # 1. EC2 Instances
    if res_id.startswith('i-'):
        size_lbl = f" ({inst_size})" if inst_size else ""
        if cost_base > 0 and cost_target == 0:
            return f"TERMINATED: Server instance stopped & deleted{last_str} (No ongoing fees)"
        elif cost_base == 0 and cost_target > 0:
            return f"EC2 INSTANCE: Newly launched server{size_lbl} provisioned on-demand (+${cost_target:.4f}/day)"
        elif diff < -0.005:
            if sp_arn or 'savingsplan' in term.lower() or 'savingsplan' in line_type.lower():
                return f"COST OPTIMIZATION: Applied Compute Savings Plan (-${abs(diff):.2f}/day saved)"
            return f"USAGE REDUCTION: Server runtime hours decreased (-${abs(diff):.4f}/day)"
        elif diff > 0.005:
            return f"USAGE SPIKE: Higher running hours or capacity on server{size_lbl} (+${diff:.4f}/day)"
        return f"EC2 INSTANCE: Active server{size_lbl} (Steady-state baseline operation)"

    # 2. EBS Block Storage Volumes
    if res_id.startswith('vol-') or 'volumeusage' in ut_lower:
        vol_type = "gp3" if "gp3" in ut_lower else ("gp2" if "gp2" in ut_lower else "gp3")
        if cost_base > 0 and cost_target == 0:
            return f"DELETED DISK: {vol_type} root volume detached & deleted{last_str}"
        elif cost_base == 0 and cost_target > 0:
            return f"EBS STORAGE: {vol_type} root storage volume attached to EC2 instance (+${cost_target:.4f}/day)"
        elif diff > 0.0005:
            return f"EBS GROWTH: Volume storage or IOPS capacity expansion (+${diff:.4f}/day)"
        elif diff < -0.0005:
            return f"EBS REDUCTION: Volume storage scaled down (-${abs(diff):.4f}/day)"
        return f"EBS STORAGE: Steady-state {vol_type} storage volume"

    # 3. VPC Network Interfaces / Public IPv4
    if 'network-interface' in res_lower or 'eni-' in res_lower or 'publicipv4' in ut_lower:
        if cost_base > 0 and cost_target == 0:
            return f"RELEASED IP: Public IPv4 address released upon instance shutdown{last_str}"
        elif cost_base == 0 and cost_target > 0:
            return f"VPC NETWORKING: Public IPv4 address assigned to ENI (+${cost_target:.4f}/day)"
        elif diff > 0.0005:
            return f"VPC NETWORKING: In-use Public IPv4 address hours surge (+${diff:.4f}/day)"
        elif diff < -0.0005:
            return f"VPC NETWORKING: Public IPv4 address released / detached (-${abs(diff):.4f}/day)"
        return "VPC NETWORKING: Public IPv4 address attached to running ENI"

    # 4. Amazon RDS
    if 'rds' in res_lower or 'database' in service.lower():
        if cost_base > 0 and cost_target == 0:
            return f"DECOMMISSIONED: Database instance deleted{last_str}"
        elif cost_base == 0 and cost_target > 0:
            return f"DATABASE: Managed RDS instance provisioned (+${cost_target:.2f})"
        elif diff < -0.005:
            if 'multi-az' in ut_lower and 'instanceusage' in ut_lower:
                return f"ARCHITECTURE CHANGE: Switched from Multi-AZ to Single-AZ (-${abs(diff):.2f} saved)"
            return f"DATABASE USAGE: Workload activity or storage reduced (-${abs(diff):.2f})"
        elif diff > 0.005:
            return f"DATABASE SPIKE: Storage auto-scaling or query workload surge (+${diff:.2f})"
        return "DATABASE: Steady-state relational database"

    # 5. CloudFront CDN
    if 'distribution' in res_lower or 'cloudfront' in service.lower():
        if diff > 0.005:
            return f"CDN EGRESS: High viewer bandwidth egress & HTTPS API requests (+${diff:.2f})"
        elif diff < -0.005:
            return f"CDN NORMALIZATION: Viewer egress and request traffic subsided (-${abs(diff):.2f})"
        return "CLOUDFRONT: Baseline content delivery distribution"

    # 6. Elastic Load Balancer (ALB)
    if 'app/' in res_lower or 'elb' in service.lower():
        if diff > 0.005:
            return f"LOAD BALANCER: ALB LCU capacity units surge & client traffic processed (+${diff:.2f})"
        elif diff < -0.005:
            return f"LOAD BALANCER: LCU consumption and client traffic normalized (-${abs(diff):.2f})"
        return "LOAD BALANCER: Baseline application traffic balancing"

    # 7. NAT Gateway
    if 'nat-' in res_lower:
        if diff > 0.005:
            return f"NAT GATEWAY: Private VPC subnet internet egress spike (+${diff:.2f})"
        elif diff < -0.005:
            return f"NAT GATEWAY: Private VPC data transfer subsided (-${abs(diff):.2f})"
        return "NAT GATEWAY: Steady VPC outbound translation"

    # 8. S3 Object Storage
    if 's3' in service.lower() or 'cur-report' in res_lower or 'bucket' in res_lower:
        if diff > 0.0005:
            return f"OBJECT STORAGE: Growth in stored data or API PUT/POST requests (+${diff:.4f})"
        elif diff < -0.0005:
            return f"STORAGE CLEANUP: Objects deleted or expired via lifecycle rules (-${abs(diff):.4f})"
        return "OBJECT STORAGE: Steady-state bucket storage & API requests"

    # 9. AWS KMS (Key Management Service)
    if 'kms' in service.lower() or 'key/' in res_lower:
        if diff > 0.0005:
            return f"KEY MANAGEMENT: Cryptographic API requests & KMS customer key (+${diff:.4f})"
        elif diff < -0.0005:
            return f"KEY MANAGEMENT: Cryptographic API calls decreased (-${abs(diff):.4f})"
        return "KEY MANAGEMENT: Baseline KMS key hosting"

    # 10. Fallback
    if cost_base == 0 and cost_target > 0:
        return f"NEW WORKLOAD: Newly provisioned {service or 'AWS'} resource (+${cost_target:.4f})"
    elif cost_base > 0 and cost_target == 0:
        return f"DECOMMISSIONED: Resource terminated or removed{last_str} (Saved -${cost_base:.4f})"
    elif diff > 0.0005:
        return f"USAGE INCREASE: Operational consumption increased on {service or 'workload'} (+${diff:.4f})"
    elif diff < -0.0005:
        return f"USAGE REDUCTION: Operational activity decreased (-${abs(diff):.4f})"
    return "STABLE: Steady-state operational baseline"


def compare_dates(cur_data: Dict[str, Any], baseline_date: str, target_date: str, account_id: Optional[str] = None) -> Dict[str, Any]:
    """Compares spending between two dates with engineering root-cause deduction."""
    records = cur_data.get('records', [])
    if account_id and account_id.lower() not in ['all', '']:
        records = [r for r in records if r.get('account_id') == account_id]
    
    # In FinOps analytics, resource-to-resource comparison isolates operational consumption
    # (credits and refunds are invoice-level balance adjustments, not resource utilization)
    baseline_records = [r for r in records if r['date'] == baseline_date and r.get('line_type') not in ('Credit', 'Refund')]
    target_records = [r for r in records if r['date'] == target_date and r.get('line_type') not in ('Credit', 'Refund')]
    
    cost_base = sum(r['cost'] for r in baseline_records)
    cost_target = sum(r['cost'] for r in target_records)
    delta_cost = cost_target - cost_base
    
    # Explicit zero-baseline handling
    if cost_base > 0:
        pct_change = round(((delta_cost / cost_base) * 100.0), 2)
        pct_display = f"{'+' if pct_change > 0 else ''}{pct_change}%"
    elif cost_target > 0:
        pct_change = None
        pct_display = "N/A (New spend from zero baseline)"
    else:
        pct_change = 0.0
        pct_display = "0.0%"

    # Service-level comparison with top resource movement tracking
    services_base = defaultdict(float)
    svc_res_base = defaultdict(lambda: defaultdict(float))
    for r in baseline_records:
        services_base[r['service']] += r['cost']
        svc_res_base[r['service']][r['resource_id']] += r['cost']

    services_target = defaultdict(float)
    svc_res_target = defaultdict(lambda: defaultdict(float))
    for r in target_records:
        services_target[r['service']] += r['cost']
        svc_res_target[r['service']][r['resource_id']] += r['cost']

    all_services = set(services_base.keys()) | set(services_target.keys())
    service_comparison = []
    for svc in all_services:
        sb = services_base[svc]
        st = services_target[svc]
        diff = st - sb
        p_chg = round(((diff / sb) * 100.0), 1) if sb > 0 else (None if st > 0 else 0.0)

        # Find top resource driver for this service in O(M) single-pass
        all_s_res = set(svc_res_base[svc].keys()) | set(svc_res_target[svc].keys())
        top_res = ""
        top_res_diff = 0.0
        max_abs_diff = -1.0
        for r_k in all_s_res:
            c_s_res = svc_res_base[svc].get(r_k, 0.0)
            c_e_res = svc_res_target[svc].get(r_k, 0.0)
            cur_diff = c_e_res - c_s_res
            cur_abs = abs(cur_diff)
            if cur_abs > max_abs_diff:
                max_abs_diff = cur_abs
                top_res = r_k
                top_res_diff = cur_diff

        svc_cause = deduce_service_cause(svc, sb, st, diff, top_res, top_res_diff)

        service_comparison.append({
            'service': svc,
            'baseline_cost': round(sb, 4),
            'target_cost': round(st, 4),
            'delta_cost': round(diff, 4),
            'pct_change': p_chg,
            'pct_display': f"{'+' if p_chg and p_chg > 0 else ''}{p_chg}%" if p_chg is not None else "N/A",
            'cause': svc_cause
        })
    service_comparison.sort(key=lambda x: abs(x['delta_cost']), reverse=True)

    # Resource-level comparison
    res_base = defaultdict(lambda: {
        'cost': 0.0, 'service': '', 'name': '', 'short_id': '', 'usage_types': set(),
        'term': '', 'line_type': '', 'sp_arn': '', 'last_seen': ''
    })
    for r in baseline_records:
        rid = r['resource_id']
        res_base[rid]['cost'] += r['cost']
        res_base[rid]['service'] = r['service']
        res_base[rid]['short_id'] = clean_resource_label(rid)
        if r.get('name'):
            res_base[rid]['name'] = r['name']
        res_base[rid]['usage_types'].add(r['usage_type'])
        res_base[rid]['term'] = r.get('term', '')
        res_base[rid]['line_type'] = r.get('line_type', '')
        res_base[rid]['sp_arn'] = r.get('sp_arn', '')
        res_base[rid]['last_seen'] = r.get('timestamp', '')

    res_target = defaultdict(lambda: {
        'cost': 0.0, 'service': '', 'name': '', 'short_id': '', 'usage_types': set(),
        'term': '', 'line_type': '', 'sp_arn': '', 'last_seen': ''
    })
    for r in target_records:
        rid = r['resource_id']
        res_target[rid]['cost'] += r['cost']
        res_target[rid]['service'] = r['service']
        res_target[rid]['short_id'] = clean_resource_label(rid)
        if r.get('name'):
            res_target[rid]['name'] = r['name']
        res_target[rid]['usage_types'].add(r['usage_type'])
        res_target[rid]['term'] = r.get('term', '')
        res_target[rid]['line_type'] = r.get('line_type', '')
        res_target[rid]['sp_arn'] = r.get('sp_arn', '')
        res_target[rid]['last_seen'] = r.get('timestamp', '')

    all_res_ids = set(res_base.keys()) | set(res_target.keys())
    spikes = []
    new_resources = []
    reduced_resources = []
    unchanged_resources = []

    # Threshold for micro-dollar spikes (0.0005 captures ENI IPv4, EBS gp3, etc.)
    MICRO_THRESHOLD = 0.0005

    for rid in all_res_ids:
        b_info = res_base.get(rid, {})
        t_info = res_target.get(rid, {})

        cb = b_info.get('cost', 0.0)
        ct = t_info.get('cost', 0.0)
        diff = ct - cb
        svc = t_info.get('service') or b_info.get('service') or 'Unknown'
        name = t_info.get('name') or b_info.get('name') or ''
        short_id = t_info.get('short_id') or b_info.get('short_id') or (rid.split('/')[-1] if '/' in rid else rid)
        utypes = list((t_info.get('usage_types') or set()) | (b_info.get('usage_types') or set()))
        term = t_info.get('term') or b_info.get('term') or ''
        ltype = t_info.get('line_type') or b_info.get('line_type') or ''
        sp_arn = t_info.get('sp_arn') or b_info.get('sp_arn') or ''
        last_seen = t_info.get('last_seen') or b_info.get('last_seen') or ''

        pct = round(((diff / cb) * 100.0), 1) if cb > 0 else (None if ct > 0 else 0.0)

        # Root cause deduction
        root_cause = deduce_resource_root_cause(
            res_id=rid,
            cost_base=cb,
            cost_target=ct,
            diff=diff,
            usage_types=utypes,
            service=svc,
            term=term,
            line_type=ltype,
            sp_arn=sp_arn,
            last_seen=last_seen
        )

        item = {
            'resource_id': rid,
            'short_id': short_id,
            'name': name,
            'service': svc,
            'usage_types': utypes,
            'baseline_cost': round(cb, 4),
            'target_cost': round(ct, 4),
            'delta_cost': round(diff, 4),
            'pct_change': pct,
            'pct_display': f"{'+' if pct and pct > 0 else ''}{pct}%" if pct is not None else "New",
            'status': 'SPIKE' if diff > MICRO_THRESHOLD else ('SAVING' if diff < -MICRO_THRESHOLD else 'FLAT'),
            'root_cause': root_cause
        }

        if cb == 0.0 and ct > 0.0:
            item['event_type'] = 'NEW_LAUNCH'
            new_resources.append(item)
            spikes.append(item)
        elif cb > 0.0 and ct == 0.0:
            item['event_type'] = 'TERMINATED_OR_STOPPED'
            reduced_resources.append(item)
        elif diff > MICRO_THRESHOLD:
            item['event_type'] = 'USAGE_INCREASE'
            spikes.append(item)
        elif diff < -MICRO_THRESHOLD:
            item['event_type'] = 'USAGE_DECREASE'
            reduced_resources.append(item)
        else:
            item['event_type'] = 'NO_CHANGE'
            unchanged_resources.append(item)

    spikes.sort(key=lambda x: x['delta_cost'], reverse=True)
    reduced_resources.sort(key=lambda x: x['delta_cost'])
    new_resources.sort(key=lambda x: x['target_cost'], reverse=True)

    # Day's Primary Event Narrative (matching finops_analyzer.py daily timeline)
    if spikes:
        primary_spiker = spikes[0]
        primary_event = f"Primary Driver: {primary_spiker['root_cause']}"
    elif reduced_resources:
        primary_saver = reduced_resources[0]
        primary_event = f"Primary Driver: {primary_saver['root_cause']}"
    else:
        primary_event = "Fleet operated at stable steady-state capacity (No significant resource variance)"

    return {
        'baseline_date': baseline_date,
        'target_date': target_date,
        'baseline_cost': round(cost_base, 2),
        'target_cost': round(cost_target, 2),
        'delta_cost': round(delta_cost, 2),
        'pct_change': pct_change,
        'pct_display': pct_display,
        'direction': 'INCREASE' if delta_cost > MICRO_THRESHOLD else ('DECREASE' if delta_cost < -MICRO_THRESHOLD else 'FLAT'),
        'primary_event': primary_event,
        'service_comparison': service_comparison,
        'top_spikes': spikes[:30],
        'new_resources': new_resources[:30],
        'reduced_resources': reduced_resources[:30],
        'total_spiking_resources': len(spikes),
        'total_reduced_resources': len(reduced_resources),
        'total_new_resources': len(new_resources)
    }


def calculate_daily_delta(cur_data: Dict[str, Any], target_date: str, baseline_date: Optional[str] = None, account_id: Optional[str] = None) -> Dict[str, Any]:
    """Calculates Daily Delta for a selected target day vs previous consecutive day."""
    dates = cur_data.get('dates', [])
    if not dates:
        return {}

    if target_date not in dates:
        target_date = dates[-1]

    if not baseline_date:
        idx = dates.index(target_date)
        baseline_date = dates[idx - 1] if idx > 0 else target_date

    comp = compare_dates(cur_data, baseline_date, target_date, account_id=account_id)

    # 14-day trend context around target date
    daily_totals = cur_data.get('daily_totals', {})
    t_idx = dates.index(target_date)
    start_idx = max(0, t_idx - 13)
    trend_dates = dates[start_idx : t_idx + 1]
    trend_series = [daily_totals.get(d, 0.0) for d in trend_dates]

    comp['trend_dates'] = trend_dates
    comp['trend_series'] = trend_series
    return comp


def compare_months(cur_data: Dict[str, Any], baseline_month: str, target_month: str, account_id: Optional[str] = None) -> Dict[str, Any]:
    """Calculates Monthly Comparison between two months (e.g. 2026-09 vs 2026-10)."""
    records = cur_data.get('records', [])
    if account_id and account_id.lower() not in ['all', '']:
        records = [r for r in records if r.get('account_id') == account_id]
    
    b_records = [r for r in records if r['month'] == baseline_month and r.get('line_type') not in ('Credit', 'Refund')]
    t_records = [r for r in records if r['month'] == target_month and r.get('line_type') not in ('Credit', 'Refund')]

    cost_base = sum(r['cost'] for r in b_records)
    cost_target = sum(r['cost'] for r in t_records)
    delta_cost = cost_target - cost_base

    if cost_base > 0:
        pct_change = round(((delta_cost / cost_base) * 100.0), 2)
        pct_display = f"{'+' if pct_change > 0 else ''}{pct_change}%"
    elif cost_target > 0:
        pct_change = None
        pct_display = "N/A"
    else:
        pct_change = 0.0
        pct_display = "0.0%"

    # Daily breakdown comparison within month
    b_daily = defaultdict(float)
    for r in b_records:
        day_num = r['date'].split('-')[-1]
        b_daily[day_num] += r['cost']

    t_daily = defaultdict(float)
    for r in t_records:
        day_num = r['date'].split('-')[-1]
        t_daily[day_num] += r['cost']

    days_union = sorted(list(set(b_daily.keys()) | set(t_daily.keys())))
    daily_comparison = [
        {
            'day': d,
            'baseline_cost': round(b_daily[d], 2),
            'target_cost': round(t_daily[d], 2)
        }
        for d in days_union
    ]

    # Service-level comparison
    svc_base = defaultdict(float)
    svc_res_base = defaultdict(lambda: defaultdict(float))
    for r in b_records:
        svc_base[r['service']] += r['cost']
        svc_res_base[r['service']][r['resource_id']] += r['cost']

    svc_target = defaultdict(float)
    svc_res_target = defaultdict(lambda: defaultdict(float))
    for r in t_records:
        svc_target[r['service']] += r['cost']
        svc_res_target[r['service']][r['resource_id']] += r['cost']

    all_svcs = set(svc_base.keys()) | set(svc_target.keys())
    services_comp = []
    for s in all_svcs:
        sb = svc_base[s]
        st = svc_target[s]
        diff = st - sb
        p_chg = round(((diff / sb) * 100.0), 1) if sb > 0 else (None if st > 0 else 0.0)

        all_s_res = set(svc_res_base[s].keys()) | set(svc_res_target[s].keys())
        shifts = []
        for r_k in all_s_res:
            c_s_res = svc_res_base[s].get(r_k, 0.0)
            c_e_res = svc_res_target[s].get(r_k, 0.0)
            shifts.append((r_k, c_e_res - c_s_res))
        shifts.sort(key=lambda x: abs(x[1]), reverse=True)
        top_res = shifts[0][0] if shifts else ""
        top_res_diff = shifts[0][1] if shifts else 0.0

        svc_cause = deduce_service_cause(s, sb, st, diff, top_res, top_res_diff)

        services_comp.append({
            'service': s,
            'baseline_cost': round(sb, 2),
            'target_cost': round(st, 2),
            'delta_cost': round(diff, 2),
            'pct_change': p_chg,
            'pct_display': f"{'+' if p_chg and p_chg > 0 else ''}{p_chg}%" if p_chg is not None else "N/A",
            'cause': svc_cause
        })
    services_comp.sort(key=lambda x: abs(x['delta_cost']), reverse=True)

    # Top resource spikes across month
    res_base = defaultdict(float)
    res_names = {}
    res_svcs = {}
    res_types = defaultdict(set)
    for r in b_records:
        res_base[r['resource_id']] += r['cost']
        res_names[r['resource_id']] = r.get('name', '')
        res_svcs[r['resource_id']] = r.get('service', '')
        res_types[r['resource_id']].add(r.get('usage_type', ''))

    res_target = defaultdict(float)
    for r in t_records:
        res_target[r['resource_id']] += r['cost']
        if r.get('name'):
            res_names[r['resource_id']] = r['name']
        if r.get('service'):
            res_svcs[r['resource_id']] = r['service']
        res_types[r['resource_id']].add(r.get('usage_type', ''))

    all_res = set(res_base.keys()) | set(res_target.keys())
    spikes = []
    for rid in all_res:
        rb = res_base[rid]
        rt = res_target[rid]
        diff = rt - rb
        if abs(diff) > 0.005:
            pct = round(((diff / rb) * 100.0), 1) if rb > 0 else None
            svc = res_svcs.get(rid, 'Unknown')
            utypes = list(res_types.get(rid, set()))
            root_cause = deduce_resource_root_cause(
                res_id=rid,
                cost_base=rb,
                cost_target=rt,
                diff=diff,
                usage_types=utypes,
                service=svc
            )
            spikes.append({
                'resource_id': rid,
                'short_id': rid.split('/')[-1] if '/' in rid else rid,
                'name': res_names.get(rid, 'Untagged'),
                'service': svc,
                'baseline_cost': round(rb, 2),
                'target_cost': round(rt, 2),
                'delta_cost': round(diff, 2),
                'pct_change': pct,
                'pct_display': f"{'+' if pct and pct > 0 else ''}{pct}%" if pct is not None else "New",
                'root_cause': root_cause
            })

    spikes.sort(key=lambda x: x['delta_cost'], reverse=True)

    return {
        'baseline_month': baseline_month,
        'target_month': target_month,
        'baseline_cost': round(cost_base, 2),
        'target_cost': round(cost_target, 2),
        'delta_cost': round(delta_cost, 2),
        'pct_change': pct_change,
        'pct_display': pct_display,
        'direction': 'INCREASE' if delta_cost > 0.005 else ('DECREASE' if delta_cost < -0.005 else 'FLAT'),
        'daily_comparison': daily_comparison,
        'service_comparison': services_comp,
        'top_spikes': [s for s in spikes if s['delta_cost'] > 0][:25],
        'top_reductions': [s for s in reversed(spikes) if s['delta_cost'] < 0][:25]
    }


def get_trend_data(cur_data: Dict[str, Any], start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
    daily_totals = cur_data.get('daily_totals', {})
    dates = sorted(list(daily_totals.keys()))

    if start_date:
        dates = [d for d in dates if d >= start_date]
    if end_date:
        dates = [d for d in dates if d <= end_date]
    
    date_set = set(dates)
    services_map = cur_data.get('services', {})
    top_services = list(services_map.keys())[:5]
    records = cur_data.get('records', [])
    
    svc_date_matrix = defaultdict(lambda: defaultdict(float))
    for r in records:
        d = r.get('date')
        if d not in date_set:
            continue
        svc = r.get('service')
        cost = r.get('cost', 0.0)
        ut_lower = r.get('usage_type', '').lower()
        
        # Dedicated EBS separation from EC2 compute
        if svc == 'Amazon EC2' and ('ebs' in ut_lower or 'snapshot' in ut_lower or 'volume' in ut_lower):
            svc_date_matrix['Amazon EBS'][d] += cost
            svc_date_matrix['Amazon EC2 (All)'][d] += cost
        elif svc == 'Amazon EC2':
            svc_date_matrix['Amazon EC2'][d] += cost
            svc_date_matrix['Amazon EC2 (All)'][d] += cost
        else:
            svc_date_matrix[svc][d] += cost

    # Build service_daily_series for all tracked services
    all_tracked = list(services_map.keys())
    if 'Amazon EBS' not in all_tracked:
        all_tracked.append('Amazon EBS')
    if 'Amazon EC2 (All)' not in all_tracked:
        all_tracked.append('Amazon EC2 (All)')

    service_daily_series = {svc: [] for svc in all_tracked}
    for d in dates:
        for svc in all_tracked:
            service_daily_series[svc].append(round(svc_date_matrix[svc][d], 2))

    return {
        'dates': dates,
        'total_series': [daily_totals.get(d, 0.0) for d in dates],
        'top_services': top_services,
        'service_series': service_daily_series
    }
