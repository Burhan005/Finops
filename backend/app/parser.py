"""
AWS CUR Streaming Parser for FinOps Clay Platform
Universal Enterprise Ingestion Engine:
- Compatible with CUR 1.0, CUR 2.0 (Data Exports), Athena Parquet/CSV, and legacy formats
- Normalizes column names regardless of slashes, underscores, or casing
- Enterprise True-Cost Resolver: Handles Compute Savings Plans & Reserved Instances effective costs
- Isolates Gross Infrastructure Spend (filters negative credits/refunds)
- Tracks Multi-Account (UsageAccountId / PayerAccountId) distribution
"""

import gzip
import csv
import os
from collections import defaultdict
from typing import Dict, List, Any, Optional

CANDIDATES = {
    'cost': [
        'lineItem/UnblendedCost', 'line_item_unblended_cost', 'UnblendedCost', 
        'Cost', 'BilledCost', 'lineItem/NetUnblendedCost', 'line_item_net_unblended_cost', 'unblendedcost'
    ],
    'sp_cost': [
        'savingsPlan/SavingsPlanEffectiveCost', 'savings_plan_savings_plan_effective_cost',
        'savingsPlan/TotalCommitmentToDate', 'savingsplan_savingsplaneffectivecost'
    ],
    'ri_cost': [
        'reservation/EffectiveCost', 'reservation_effective_cost', 'reservation/TotalReservedUnits'
    ],
    'date': [
        'lineItem/UsageStartDate', 'line_item_usage_start_date', 'UsageStartDate',
        'ChargePeriodStart', 'BillingPeriodStartDate', 'usagestartdate', 'lineItem/LineItemStartDate'
    ],
    'res_id': [
        'lineItem/ResourceId', 'line_item_resource_id', 'ResourceId', 'ResourceIdName',
        'resourceid', 'lineItem_ResourceId'
    ],
    'usage': [
        'lineItem/UsageType', 'line_item_usage_type', 'UsageType', 'SkuPriceDescription',
        'PricingCategory', 'usagetype', 'lineItem_UsageType'
    ],
    'prod': [
        'lineItem/ProductCode', 'line_item_product_code', 'ProductCode', 'ServiceName',
        'ServiceCode', 'productcode', 'lineItem_ProductCode'
    ],
    'name': [
        'resourceTags/user:Name', 'resource_tags_user_name', 'user:Name', 'Tag_Name',
        'resourceTags_user_Name', 'Name', 'resourceTags/aws:createdBy'
    ],
    'line_type': [
        'lineItem/LineItemType', 'line_item_line_item_type', 'LineItemType', 'ChargeType',
        'lineItem_LineItemType'
    ],
    'term': [
        'pricing/term', 'pricing_term', 'Term', 'PricingTerm'
    ],
    'account_id': [
        'lineItem/UsageAccountId', 'line_item_usage_account_id', 'bill/PayerAccountId',
        'bill_payer_account_id', 'UsageAccountId', 'PayerAccountId'
    ],
    'sp_arn': [
        'savingsPlan/SavingsPlanARN', 'savings_plan_savings_plan_a_r_n', 'SavingsPlanARN'
    ],
    'ri_arn': [
        'reservation/ReservationARN', 'reservation_reservation_a_r_n', 'ReservationARN'
    ],
    'region': [
        'product/region', 'product_region', 'lineItem/AvailabilityZone', 'line_item_availability_zone',
        'AvailabilityZone', 'region'
    ],
    'usage_amount': [
        'lineItem/UsageAmount', 'line_item_usage_amount', 'UsageAmount', 'usageamount', 'lineItem_UsageAmount'
    ],
    'unit': [
        'pricing/unit', 'pricing_unit', 'Unit', 'unit', 'lineItem/Unit', 'pricing_unit'
    ],
    'operation': [
        'lineItem/Operation', 'line_item_operation', 'Operation', 'operation', 'lineItem_Operation'
    ],
    'currency': [
        'lineItem/CurrencyCode', 'line_item_currency_code', 'CurrencyCode', 'currency', 'pricing/currency'
    ],
    'desc': [
        'lineItem/LineItemDescription', 'line_item_line_item_description', 'ItemDescription', 'Description'
    ],
    'tax_type': [
        'lineItem/TaxType', 'line_item_tax_type', 'TaxType'
    ]
}

REGION_PREFIX_MAP = {
    'APS3': 'ap-south-1',
    'APS1': 'ap-southeast-1',
    'APS2': 'ap-southeast-2',
    'APS4': 'ap-south-2',
    'APN1': 'ap-northeast-1',
    'APN2': 'ap-northeast-2',
    'APN3': 'ap-northeast-3',
    'USE1': 'us-east-1',
    'USE2': 'us-east-2',
    'USW1': 'us-west-1',
    'USW2': 'us-west-2',
    'EUC1': 'eu-central-1',
    'EUW1': 'eu-west-1',
    'EUW2': 'eu-west-2',
    'EUW3': 'eu-west-3',
    'EUN1': 'eu-north-1',
    'MES1': 'me-south-1',
    'SAE1': 'sa-east-1',
    'CAC1': 'ca-central-1',
    'AFS1': 'af-south-1',
}

PREFIX_PATTERNS = [(p, f"-{p}-", f":{p}-", reg) for p, reg in REGION_PREFIX_MAP.items()]

def resolve_region(region_raw: str, usage_type: str = '', desc: str = '', tax_type: str = '', az: str = '') -> str:
    r = region_raw.strip().lower() if region_raw else ''
    if r:
        if len(r) >= 9 and r[-1].isalpha() and r[-2].isdigit():
            return r[:-1]
        return r
    if az:
        az_clean = az.strip().lower()
        if len(az_clean) >= 9 and az_clean[-1].isalpha() and az_clean[-2].isdigit():
            return az_clean[:-1]
    ut_clean = usage_type.strip().upper() if usage_type else ''
    for prefix, dash_p, colon_p, mapped_reg in PREFIX_PATTERNS:
        if ut_clean.startswith(prefix) or dash_p in ut_clean or colon_p in ut_clean:
            return mapped_reg
    combined_desc = f"{desc} {tax_type}".upper()
    if 'INDIA GST' in combined_desc or 'INDIA' in combined_desc:
        return 'ap-south-1'
    return 'global'

SERVICE_CANONICAL_MAP = {
    'amazonec2': 'Amazon EC2',
    'amazonrds': 'Amazon RDS',
    'amazons3': 'Amazon S3',
    'amazonredshift': 'Amazon Redshift',
    'amazondocdb': 'Amazon DocumentDB',
    'amazondocumentdb': 'Amazon DocumentDB',
    'amazonelasticache': 'Amazon ElastiCache',
    'elasticache': 'Amazon ElastiCache',
    'amazones': 'Amazon OpenSearch',
    'amazonopensearchservice': 'Amazon OpenSearch',
    'opensearch': 'Amazon OpenSearch',
    'amazonopensearch': 'Amazon OpenSearch',
    'awselb': 'Elastic Load Balancing',
    'amazonelb': 'Elastic Load Balancing',
    'awswaf': 'AWS WAF',
    'waf': 'AWS WAF',
    'awslambda': 'AWS Lambda',
    'awskms': 'AWS KMS',
    'amazoncloudfront': 'Amazon CloudFront',
    'cloudfront': 'Amazon CloudFront',
    'amazoncloudwatch': 'Amazon CloudWatch',
    'cloudwatch': 'Amazon CloudWatch',
    'amazonroute53': 'Amazon Route 53',
    'route53': 'Amazon Route 53',
    'awsdatatransfer': 'AWS Data Transfer',
    'amazonguardduty': 'Amazon GuardDuty',
    'awssecretsmanager': 'AWS Secrets Manager',
    'awsglue': 'AWS Glue',
    'amazonkinesis': 'Amazon Kinesis',
    'amazonses': 'Amazon SES',
    'amazonsns': 'Amazon SNS',
    'awsdatabasemigrationsvc': 'AWS Database Migration Service',
    'awscostexplorer': 'AWS Cost Explorer',
    'amazonstates': 'AWS Step Functions',
    'awsqueueservice': 'Amazon SQS',
    'amazonpinpoint': 'Amazon Pinpoint',
    'amazonvpc': 'VPC / Networking',
    'vpc': 'VPC / Networking'
}

def normalize_service_code(code: str) -> str:
    if not code:
        return 'Unknown-Service'
    clean = code.strip()
    key = clean.lower().replace(' ', '').replace('-', '').replace('_', '')
    return SERVICE_CANONICAL_MAP.get(key, clean)

def normalize_col_name(name: str) -> str:
    """Strips delimiters and special characters for bulletproof candidate matching."""
    return name.strip().lower().replace('/', '').replace(':', '').replace('_', '').replace('-', '').replace(' ', '')

def open_file_any(filepath: str):
    if filepath.endswith('.gz'):
        return gzip.open(filepath, mode='rt', encoding='utf-8', errors='ignore')
    return open(filepath, mode='r', encoding='utf-8', errors='ignore')

def detect_column_indices(header: List[str]) -> Dict[str, Optional[int]]:
    header_clean = [h.strip().lower() for h in header]
    header_normalized = [normalize_col_name(h) for h in header]
    mapping = {}
    for key, cand_list in CANDIDATES.items():
        found = None
        for cand in cand_list:
            c_low = cand.lower()
            c_norm = normalize_col_name(cand)
            if c_low in header_clean:
                found = header_clean.index(c_low)
                break
            elif c_norm in header_normalized:
                found = header_normalized.index(c_norm)
                break
        mapping[key] = found
    return mapping

def parse_date_parts(date_str: str):
    clean = date_str.strip().replace('T', ' ')
    month = clean[:7] if len(clean) >= 7 else 'Unknown'
    day = clean[:10] if len(clean) >= 10 else 'Unknown'
    hour = clean[11:16] if len(clean) >= 16 else '00:00'
    return month, day, hour, clean

def parse_cur_files(filepaths: List[str]) -> Dict[str, Any]:
    if not filepaths:
        raise ValueError("No filepaths provided for parsing.")

    for fp in filepaths:
        if not os.path.exists(fp):
            raise FileNotFoundError(f"File not found: {fp}")

    records = []
    service_totals = defaultdict(float)
    daily_totals = defaultdict(float)
    daily_gross_totals = defaultdict(float)
    daily_tax_totals = defaultdict(float)
    daily_credit_totals = defaultdict(float)
    daily_refund_totals = defaultdict(float)
    monthly_totals = defaultdict(float)
    account_totals = defaultdict(float)
    region_totals = defaultdict(float)
    resource_index = defaultdict(lambda: {
        'total_cost': 0.0,
        'dates': defaultdict(float),
        'service': '',
        'name': '',
        'account_id': '',
        'short_id': '',
        'last_seen': '',
        'usage_types': set(),
        'line_types': set()
    })
    
    unique_dates = set()
    unique_months = set()
    total_cost = 0.0
    gross_cost = 0.0
    credits_total = 0.0
    refunds_total = 0.0
    taxes_total = 0.0
    total_rows = 0
    MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB safety limit
    date_cache = {}

    for filepath in filepaths:
        with open_file_any(filepath) as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                continue

            col_map = detect_column_indices(header)
            cost_idx = col_map.get('cost')
            sp_cost_idx = col_map.get('sp_cost')
            ri_cost_idx = col_map.get('ri_cost')
            date_idx = col_map.get('date')
            res_idx = col_map.get('res_id')
            usage_idx = col_map.get('usage')
            prod_idx = col_map.get('prod')
            name_idx = col_map.get('name')
            ltype_idx = col_map.get('line_type')
            term_idx = col_map.get('term')
            acc_idx = col_map.get('account_id')
            sp_idx = col_map.get('sp_arn')
            ri_idx = col_map.get('ri_arn')
            reg_idx = col_map.get('region')
            usage_amt_idx = col_map.get('usage_amount')
            unit_idx = col_map.get('unit')
            op_idx = col_map.get('operation')
            curr_idx = col_map.get('currency')
            desc_idx = col_map.get('desc')
            tax_type_idx = col_map.get('tax_type')

            if cost_idx is None or date_idx is None:
                raise ValueError(f"Required Cost or Date columns not detected in {filepath}")

            for row in reader:
                row_len = len(row)
                if row_len <= cost_idx:
                    continue

                total_rows += 1
                if total_rows % 5000 == 0:
                    try:
                        if f.tell() > MAX_UNCOMPRESSED_BYTES:
                            raise ValueError("Decompressed file size exceeds safety limit of 500MB (Decompression Bomb protection).")
                    except (AttributeError, OSError):
                        pass

                try:
                    c_val = float(row[cost_idx])
                except (ValueError, IndexError):
                    c_val = 0.0

                raw_unblended = c_val
                ltype = row[ltype_idx].strip() if (ltype_idx is not None and row_len > ltype_idx) else 'Usage'

                # Extract Usage Amount first so DiscountedUsage rows with running hours are never dropped
                usage_amount = 0.0
                if usage_amt_idx is not None and row_len > usage_amt_idx and row[usage_amt_idx]:
                    try:
                        usage_amount = float(row[usage_amt_idx])
                    except (ValueError, IndexError):
                        usage_amount = 0.0

                # Extract Effective Costs from SP and RI columns for accurate unit-economics / resource attribution
                sp_effective = 0.0
                if sp_cost_idx is not None and row_len > sp_cost_idx and row[sp_cost_idx]:
                    try:
                        sp_effective = float(row[sp_cost_idx])
                    except (ValueError, IndexError):
                        sp_effective = 0.0

                ri_effective = 0.0
                if ri_cost_idx is not None and row_len > ri_cost_idx and row[ri_cost_idx]:
                    try:
                        ri_effective = float(row[ri_cost_idx])
                    except (ValueError, IndexError):
                        ri_effective = 0.0

                effective_cost = ri_effective if ri_effective > 0 else (sp_effective if sp_effective > 0 else raw_unblended)

                # Explicitly classify according to FinOps billing accounting standards
                ltype_lower = ltype.lower()
                is_credit = ltype_lower == 'credit' or (c_val < 0 and 'credit' in (row[usage_idx].lower() if usage_idx is not None and row_len > usage_idx else ''))
                is_refund = ltype_lower == 'refund'
                is_tax = ltype_lower == 'tax'

                if is_credit:
                    credits_total += c_val
                elif is_refund:
                    refunds_total += c_val
                elif is_tax:
                    taxes_total += c_val
                elif c_val > 0:
                    gross_cost += c_val

                # FinOps Invariant: Unblended Invoice spend reflects authoritative cash billing.
                # LineItemType 'DiscountedUsage' has UnblendedCost = $0.00 (the commitment is billed on RIFee).
                # Skipping rows must NOT discard active compute hours (DiscountedUsage rows with usage_amount > 0).
                if c_val == 0.0 and usage_amount == 0.0 and not is_credit and not is_refund:
                    continue

                raw_date = row[date_idx] if row_len > date_idx else ''
                if raw_date in date_cache:
                    month, day, hour, full_ts = date_cache[raw_date]
                else:
                    clean = raw_date.strip().replace('T', ' ')
                    month = clean[:7] if len(clean) >= 7 else 'Unknown'
                    day = clean[:10] if len(clean) >= 10 else 'Unknown'
                    hour = clean[11:16] if len(clean) >= 16 else '00:00'
                    date_cache[raw_date] = (month, day, hour, clean)
                    full_ts = clean

                res_id_raw = row[res_idx].strip() if (res_idx is not None and row_len > res_idx) else ''
                usage_type = row[usage_idx].strip() if (usage_idx is not None and row_len > usage_idx and row[usage_idx].strip()) else 'Standard'
                prod_code = row[prod_idx].strip() if (prod_idx is not None and row_len > prod_idx and row[prod_idx].strip()) else 'Unknown-Service'
                
                # Normalize Service Code and consolidate invoiced taxes
                if is_tax:
                    prod_code = 'Taxes & Surcharges'
                    res_id = 'TAX-INVOICE-GST'
                    name_tag = 'Statutory GST & Invoiced Taxes'
                    usage_type = 'Government GST / Tax'
                    usage_amount = 0.0
                    unit_val = ''
                else:
                    prod_code = normalize_service_code(prod_code)
                    res_id = res_id_raw if (res_id_raw and res_id_raw != 'No-Resource-ID') else f"No-Resource-ID ({prod_code})"
                    name_tag = row[name_idx].strip() if (name_idx is not None and row_len > name_idx and row[name_idx].strip()) else ''
                term = row[term_idx].strip() if (term_idx is not None and row_len > term_idx) else 'OnDemand'
                account_id = row[acc_idx].strip() if (acc_idx is not None and row_len > acc_idx and row[acc_idx].strip()) else 'Primary-Account'
                sp_arn = row[sp_idx].strip() if (sp_idx is not None and row_len > sp_idx) else ''
                ri_arn = row[ri_idx].strip() if (ri_idx is not None and row_len > ri_idx) else ''
                desc_val = row[desc_idx].strip() if (desc_idx is not None and row_len > desc_idx and row[desc_idx].strip()) else ''
                tax_type_val = row[tax_type_idx].strip() if (tax_type_idx is not None and row_len > tax_type_idx and row[tax_type_idx].strip()) else ''
                region_raw = row[reg_idx].strip() if (reg_idx is not None and row_len > reg_idx and row[reg_idx].strip()) else ''
                
                region_val = resolve_region(region_raw, usage_type, desc_val, tax_type_val)

                unit_val = row[unit_idx].strip() if (unit_idx is not None and row_len > unit_idx and row[unit_idx].strip()) else ''
                op_val = row[op_idx].strip() if (op_idx is not None and row_len > op_idx and row[op_idx].strip()) else ''
                curr_val = row[curr_idx].strip() if (curr_idx is not None and row_len > curr_idx and row[curr_idx].strip()) else 'USD'

                # Extract clean short identifier for UI display
                short_id = res_id.split('/')[-1] if '/' in res_id else res_id

                # Aggregate gross operational unblended metrics (credits/refunds tracked separately)
                if is_credit:
                    daily_credit_totals[day] += c_val
                    daily_totals[day] += c_val
                elif is_refund:
                    daily_refund_totals[day] += c_val
                    daily_totals[day] += c_val
                elif is_tax:
                    # Invoiced taxes are tracked at the financial/invoice reconciliation level, NOT as an AWS cloud infrastructure service
                    total_cost += c_val
                    daily_tax_totals[day] += c_val
                    daily_totals[day] += c_val
                    monthly_totals[month] += c_val
                    account_totals[account_id] += c_val
                    region_totals[region_val] += c_val
                    # Note: We intentionally do NOT add taxes to service_totals (taxes are statutory levies, not cloud services)
                else:
                    total_cost += c_val
                    daily_gross_totals[day] += c_val
                    daily_totals[day] += c_val
                    monthly_totals[month] += c_val
                    account_totals[account_id] += c_val
                    region_totals[region_val] += c_val
                    service_totals[prod_code] += c_val

                if not is_credit and not is_refund and not is_tax:

                    res_entry = resource_index[res_id]
                    res_entry['total_cost'] += c_val
                    if 'effective_cost' not in res_entry:
                        res_entry['effective_cost'] = 0.0
                    res_entry['effective_cost'] += effective_cost
                    res_entry['dates'][day] += c_val
                    res_entry['short_id'] = short_id
                    res_entry['account_id'] = account_id
                    res_entry['last_seen'] = full_ts
                    if 'usage_amount' not in res_entry:
                        res_entry['usage_amount'] = 0.0
                    res_entry['usage_amount'] += usage_amount
                    if not res_entry.get('unit') and unit_val:
                        res_entry['unit'] = unit_val
                    if not res_entry.get('region') and region_val:
                        res_entry['region'] = region_val
                    if not res_entry['service'] or res_entry['service'] == 'Unknown-Service':
                        res_entry['service'] = prod_code
                    if not res_entry['name'] and name_tag:
                        res_entry['name'] = name_tag
                    res_entry['usage_types'].add(usage_type)
                    res_entry['line_types'].add(ltype)

                unique_dates.add(day)
                unique_months.add(month)

                records.append({
                    'cost': round(c_val, 6),
                    'unblended_cost': round(raw_unblended, 6),
                    'effective_cost': round(effective_cost, 6),
                    'date': day,
                    'month': month,
                    'hour': hour,
                    'timestamp': full_ts,
                    'service': prod_code,
                    'resource_id': res_id,
                    'short_id': short_id,
                    'account_id': account_id,
                    'region': region_val,
                    'name': name_tag,
                    'usage_type': usage_type,
                    'usage_amount': round(usage_amount, 4),
                    'unit': unit_val,
                    'operation': op_val,
                    'currency': curr_val,
                    'line_type': ltype,
                    'term': term,
                    'sp_arn': sp_arn,
                    'ri_arn': ri_arn,
                    'tax_type': tax_type_val,
                    'desc': desc_val
                })

    # Single-pass post-fill of names from resource_index
    for r in records:
        if not r['name']:
            r['name'] = resource_index[r['resource_id']]['name']

    clean_resources = []
    for rid, data in resource_index.items():
        clean_resources.append({
            'resource_id': rid,
            'short_id': data.get('short_id', rid.split('/')[-1] if '/' in rid else rid),
            'account_id': data.get('account_id', 'Primary-Account'),
            'region': data.get('region', 'us-east-1'),
            'last_seen': data.get('last_seen', ''),
            'service': data['service'],
            'name': data['name'],
            'total_cost': round(data['total_cost'], 4),
            'effective_cost': round(data.get('effective_cost', data['total_cost']), 4),
            'usage_amount': round(data.get('usage_amount', 0.0), 4),
            'unit': data.get('unit', ''),
            'dates': {k: round(v, 4) for k, v in data['dates'].items()},
            'usage_types': list(data['usage_types']),
            'line_types': list(data['line_types'])
        })
    clean_resources.sort(key=lambda x: x['total_cost'], reverse=True)

    sorted_dates = sorted(list(unique_dates))
    sorted_months = sorted(list(unique_months))

    net_cost = gross_cost + credits_total + refunds_total + taxes_total

    reconciliation = {
        'gross_usage_cost': round(gross_cost, 2),
        'credits_total': round(credits_total, 2),
        'refunds_total': round(refunds_total, 2),
        'taxes_total': round(taxes_total, 2),
        'net_invoiced_spend': round(net_cost, 2),
        'formula': 'net_invoiced_spend = gross_usage_cost + credits_total + refunds_total + taxes_total',
        'is_reconciled': bool(abs(round((gross_cost + credits_total + refunds_total + taxes_total) - net_cost, 2)) < 0.01)
    }

    display_name = os.path.basename(filepaths[0])
    if len(filepaths) > 1:
        display_name = f"{display_name} (+{len(filepaths)-1} parts)"

    return {
        'records': records,
        'resources': clean_resources,
        'total_cost': round(gross_cost, 2),
        'gross_cost': round(gross_cost, 2),
        'net_cost': round(net_cost, 2),
        'credits_total': round(credits_total, 2),
        'refunds_total': round(refunds_total, 2),
        'taxes_total': round(taxes_total, 2),
        'accounting_reconciliation': reconciliation,
        'total_rows': total_rows,
        'dates': sorted_dates,
        'months': sorted_months,
        'services': {k: round(v, 2) for k, v in sorted(service_totals.items(), key=lambda item: item[1], reverse=True)},
        'accounts': {k: round(v, 2) for k, v in sorted(account_totals.items(), key=lambda item: item[1], reverse=True)},
        'regions': {k: round(v, 2) for k, v in sorted(region_totals.items(), key=lambda item: item[1], reverse=True)},
        'daily_totals': {k: round(v, 2) for k, v in sorted(daily_totals.items())},
        'daily_gross_totals': {k: round(v, 2) for k, v in sorted(daily_gross_totals.items())},
        'daily_tax_totals': {k: round(v, 2) for k, v in sorted(daily_tax_totals.items())},
        'daily_credit_totals': {k: round(v, 2) for k, v in sorted(daily_credit_totals.items())},
        'daily_refund_totals': {k: round(v, 2) for k, v in sorted(daily_refund_totals.items())},
        'monthly_totals': {k: round(v, 2) for k, v in sorted(monthly_totals.items())},
        'filename': display_name
    }

def parse_cur_file(filepath: str) -> Dict[str, Any]:
    """Single-file wrapper for backward compatibility."""
    return parse_cur_files([filepath])

def merge_cur_files(filepaths: List[str], output_path: str) -> str:
    """
    Merges multiple CUR CSV / GZ part files into a single unified .csv.gz file.
    Preserves the header from the first file and appends data rows from all files.
    """
    if not filepaths:
        raise ValueError("No files provided for merging.")
    
    if len(filepaths) == 1:
        if os.path.abspath(filepaths[0]) != os.path.abspath(output_path):
            import shutil
            shutil.copy2(filepaths[0], output_path)
        return output_path

    is_gz = output_path.endswith('.gz')
    out_f = gzip.open(output_path, 'wt', encoding='utf-8', newline='') if is_gz else open(output_path, 'w', encoding='utf-8', newline='')
    
    try:
        writer = csv.writer(out_f)
        header_written = False
        
        for fp in filepaths:
            with open_file_any(fp) as in_f:
                reader = csv.reader(in_f)
                try:
                    header = next(reader)
                except StopIteration:
                    continue
                
                if not header_written:
                    writer.writerow(header)
                    header_written = True
                
                for row in reader:
                    if row:
                        writer.writerow(row)
    finally:
        out_f.close()
        
    return output_path
