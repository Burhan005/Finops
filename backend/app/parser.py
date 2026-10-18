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
import json
import logging
import functools
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
from typing import Dict, List, Any, Optional, Union, Tuple

logger = logging.getLogger("zorvex.parser")

def round_currency(val: Any) -> float:
    """Rounds Decimal/float/str to 2 decimal places using ROUND_HALF_UP and converts to standard float for JSON serialization."""
    if isinstance(val, (int, float, str)):
        val = Decimal(str(val))
    return float(val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


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
    'subscription_id': [
        'reservation/SubscriptionId', 'reservation_subscription_id', 'SubscriptionId'
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
    ],
    'line_item_id': [
        'identity/LineItemId', 'identity_line_item_id', 'LineItemId', 'lineitemid',
        'identity/lineItemId', 'LineItem/LineItemId'
    ],
    'bill_period_start': [
        'bill/BillingPeriodStartDate', 'bill_billing_period_start_date', 'BillingPeriodStartDate',
        'bill/BillingPeriodStart', 'BillingPeriodStart'
    ],
    'bill_period_end': [
        'bill/BillingPeriodEndDate', 'bill_billing_period_end_date', 'BillingPeriodEndDate',
        'bill/BillingPeriodEnd', 'BillingPeriodEnd'
    ],
    'payer_account_id': [
        'bill/PayerAccountId', 'bill_payer_account_id', 'PayerAccountId', 'payeraccountid'
    ],
    'invoice_id': [
        'bill/InvoiceId', 'bill_invoice_id', 'InvoiceId', 'invoiceid'
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

@functools.lru_cache(maxsize=4096)
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

@functools.lru_cache(maxsize=1024)
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
    service_totals = defaultdict(Decimal)
    daily_totals = defaultdict(Decimal)
    daily_gross_totals = defaultdict(Decimal)
    daily_tax_totals = defaultdict(Decimal)
    daily_credit_totals = defaultdict(Decimal)
    daily_refund_totals = defaultdict(Decimal)
    monthly_totals = defaultdict(Decimal)
    account_totals = defaultdict(Decimal)
    region_totals = defaultdict(Decimal)
    resource_index = defaultdict(lambda: {
        'total_cost': Decimal('0'),
        'effective_cost': 0.0,
        'usage_amount': 0.0,
        'dates': defaultdict(Decimal),
        'service': '',
        'name': '',
        'account_id': '',
        'short_id': '',
        'last_seen': '',
        'usage_types': set(),
        'line_types': set(),
        'unit': '',
        'region': ''
    })
    
    unique_dates = set()
    unique_months = set()
    total_cost_dec = Decimal('0')
    gross_cost_dec = Decimal('0')
    credits_total_dec = Decimal('0')
    refunds_total_dec = Decimal('0')
    taxes_total_dec = Decimal('0')
    total_rows = 0
    MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB safety limit
    date_cache = {}
    detected_bp_start = None
    detected_bp_end = None
    detected_payer_id = None
    detected_usage_account_id = None
    missing_name_refs: List[Tuple[int, str]] = []

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
            sub_idx = col_map.get('subscription_id')
            reg_idx = col_map.get('region')
            usage_amt_idx = col_map.get('usage_amount')
            unit_idx = col_map.get('unit')
            op_idx = col_map.get('operation')
            curr_idx = col_map.get('currency')
            desc_idx = col_map.get('desc')
            tax_type_idx = col_map.get('tax_type')
            lid_idx = col_map.get('line_item_id')
            bp_start_idx = col_map.get('bill_period_start')
            bp_end_idx = col_map.get('bill_period_end')
            payer_acc_idx = col_map.get('payer_account_id')

            if cost_idx is None or date_idx is None:
                raise ValueError(f"Required Cost or Date columns not detected in {filepath}")

            for row in reader:
                row_len = len(row)
                if row_len <= cost_idx:
                    continue

                if detected_bp_start is None and bp_start_idx is not None and row_len > bp_start_idx:
                    raw_s = row[bp_start_idx].strip()
                    if raw_s:
                        detected_bp_start = raw_s.split('T')[0][:10]
                if detected_bp_end is None and bp_end_idx is not None and row_len > bp_end_idx:
                    raw_e = row[bp_end_idx].strip()
                    if raw_e:
                        detected_bp_end = raw_e.split('T')[0][:10]
                if detected_payer_id is None and payer_acc_idx is not None and row_len > payer_acc_idx:
                    raw_p = row[payer_acc_idx].strip()
                    if raw_p:
                        detected_payer_id = raw_p
                if detected_usage_account_id is None and acc_idx is not None and row_len > acc_idx:
                    raw_u = row[acc_idx].strip()
                    if raw_u and raw_u != 'Primary-Account' and raw_u != 'Unknown':
                        detected_usage_account_id = raw_u

                total_rows += 1
                if total_rows % 5000 == 0:
                    try:
                        if f.tell() > MAX_UNCOMPRESSED_BYTES:
                            raise ValueError("Decompressed file size exceeds safety limit of 500MB (Decompression Bomb protection).")
                    except (AttributeError, OSError):
                        pass

                c_dec = Decimal('0')
                c_val = 0.0
                if cost_idx is not None and row_len > cost_idx:
                    raw_c = row[cost_idx]
                    if raw_c and raw_c not in ('0', '0.0', '0.00', '0.000000', '0.00000000'):
                        try:
                            c_str = raw_c.strip()
                            c_dec = Decimal(c_str)
                            c_val = float(c_dec)
                        except (ValueError, IndexError, ArithmeticError):
                            c_dec = Decimal('0')
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
                is_credit = ltype_lower == 'credit' or (c_dec < 0 and 'credit' in (row[usage_idx].lower() if usage_idx is not None and row_len > usage_idx else ''))
                is_refund = ltype_lower == 'refund'
                is_tax = ltype_lower == 'tax'

                if is_credit:
                    credits_total_dec += c_dec
                elif is_refund:
                    refunds_total_dec += c_dec
                elif is_tax:
                    taxes_total_dec += c_dec
                elif c_dec > 0:
                    gross_cost_dec += c_dec

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
                sub_val = row[sub_idx].strip() if (sub_idx is not None and row_len > sub_idx) else ''
                desc_val = row[desc_idx].strip() if (desc_idx is not None and row_len > desc_idx and row[desc_idx].strip()) else ''
                tax_type_val = row[tax_type_idx].strip() if (tax_type_idx is not None and row_len > tax_type_idx and row[tax_type_idx].strip()) else ''
                line_item_id = row[lid_idx].strip() if (lid_idx is not None and row_len > lid_idx) else ''
                region_raw = row[reg_idx].strip() if (reg_idx is not None and row_len > reg_idx and row[reg_idx].strip()) else ''
                
                region_val = resolve_region(region_raw, usage_type, desc_val, tax_type_val)

                unit_val = row[unit_idx].strip() if (unit_idx is not None and row_len > unit_idx and row[unit_idx].strip()) else ''
                op_val = row[op_idx].strip() if (op_idx is not None and row_len > op_idx and row[op_idx].strip()) else ''
                curr_val = row[curr_idx].strip() if (curr_idx is not None and row_len > curr_idx and row[curr_idx].strip()) else 'USD'

                # Extract clean short identifier for UI display
                short_id = res_id.split('/')[-1] if '/' in res_id else res_id

                # Aggregate gross operational unblended metrics (credits/refunds tracked separately)
                if is_credit:
                    daily_credit_totals[day] += c_dec
                    daily_totals[day] += c_dec
                elif is_refund:
                    daily_refund_totals[day] += c_dec
                    daily_totals[day] += c_dec
                elif is_tax:
                    # Invoiced taxes are tracked at the financial/invoice reconciliation level, NOT as an AWS cloud infrastructure service
                    total_cost_dec += c_dec
                    daily_tax_totals[day] += c_dec
                    daily_totals[day] += c_dec
                    monthly_totals[month] += c_dec
                    account_totals[account_id] += c_dec
                    region_totals[region_val] += c_dec
                    # Note: We intentionally do NOT add taxes to service_totals (taxes are statutory levies, not cloud services)
                else:
                    total_cost_dec += c_dec
                    daily_gross_totals[day] += c_dec
                    daily_totals[day] += c_dec
                    monthly_totals[month] += c_dec
                    account_totals[account_id] += c_dec
                    region_totals[region_val] += c_dec
                    service_totals[prod_code] += c_dec

                if not is_credit and not is_refund and not is_tax:

                    res_entry = resource_index[res_id]
                    res_entry['total_cost'] += c_dec
                    res_entry['effective_cost'] += effective_cost
                    res_entry['dates'][day] += c_dec
                    res_entry['short_id'] = short_id
                    res_entry['account_id'] = account_id
                    res_entry['last_seen'] = full_ts
                    res_entry['usage_amount'] += usage_amount
                    if not res_entry['unit'] and unit_val:
                        res_entry['unit'] = unit_val
                    if not res_entry['region'] and region_val:
                        res_entry['region'] = region_val
                    if not res_entry['service'] or res_entry['service'] == 'Unknown-Service':
                        res_entry['service'] = prod_code
                    if not res_entry['name'] and name_tag:
                        res_entry['name'] = name_tag
                    res_entry['usage_types'].add(usage_type)
                    res_entry['line_types'].add(ltype)

                unique_dates.add(day)
                unique_months.add(month)

                if not name_tag:
                    missing_name_refs.append((len(records), res_id))

                records.append({
                    'cost': c_val,
                    'unblended_cost': raw_unblended,
                    'effective_cost': effective_cost,
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
                    'subscription_id': sub_val,
                    'tax_type': tax_type_val,
                    'desc': desc_val,
                    'item_description': desc_val,
                    'line_item_type': ltype,
                    'line_item_id': line_item_id
                })

    # Surgical post-fill of names only for records that lacked a name
    for rec_idx, rid in missing_name_refs:
        discovered_name = resource_index[rid]['name']
        if discovered_name:
            records[rec_idx]['name'] = discovered_name

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
            'total_cost': round(float(data['total_cost']), 4),
            'effective_cost': round(float(data.get('effective_cost', data['total_cost'])), 4),
            'usage_amount': round(float(data.get('usage_amount', 0.0)), 4),
            'unit': data.get('unit', ''),
            'dates': {k: round(float(v), 4) for k, v in data['dates'].items()},
            'usage_types': list(data['usage_types']),
            'line_types': list(data['line_types'])
        })
    clean_resources.sort(key=lambda x: x['total_cost'], reverse=True)

    sorted_dates = sorted(list(unique_dates))
    sorted_months = sorted(list(unique_months))

    gross_cost = round_currency(gross_cost_dec)
    credits_total = round_currency(credits_total_dec)
    refunds_total = round_currency(refunds_total_dec)
    taxes_total = round_currency(taxes_total_dec)
    net_cost_dec = gross_cost_dec + credits_total_dec + refunds_total_dec + taxes_total_dec
    net_cost = round_currency(net_cost_dec)

    reconciliation = {
        'gross_usage_cost': gross_cost,
        'credits_total': credits_total,
        'refunds_total': refunds_total,
        'taxes_total': taxes_total,
        'net_invoiced_spend': net_cost,
        'formula': 'net_invoiced_spend = gross_usage_cost + credits_total + refunds_total + taxes_total',
        'is_reconciled': bool(abs(round((Decimal(str(gross_cost)) + Decimal(str(credits_total)) + Decimal(str(refunds_total)) + Decimal(str(taxes_total))) - Decimal(str(net_cost)), 2)) < Decimal('0.01'))
    }

    display_name = os.path.basename(filepaths[0])
    if len(filepaths) > 1:
        display_name = f"{display_name} (+{len(filepaths)-1} parts)"

    return {
        'records': records,
        'resources': clean_resources,
        'total_cost': gross_cost,
        'gross_cost': gross_cost,
        'net_cost': net_cost,
        'credits_total': credits_total,
        'refunds_total': refunds_total,
        'taxes_total': taxes_total,
        'accounting_reconciliation': reconciliation,
        'total_rows': total_rows,
        'dates': sorted_dates,
        'months': sorted_months,
        'billing_period_start': detected_bp_start or (sorted_dates[0] if sorted_dates else 'Unknown'),
        'billing_period_end': detected_bp_end or (sorted_dates[-1] if sorted_dates else 'Unknown'),
        'payer_account_id': detected_payer_id or (list(account_totals.keys())[0] if account_totals else 'Unknown'),
        'usage_account_id': detected_usage_account_id or (list(account_totals.keys())[0] if account_totals else (detected_payer_id or 'Unknown')),
        'assembly_id': '',
        'services': {k: round_currency(v) for k, v in sorted(service_totals.items(), key=lambda item: item[1], reverse=True)},
        'accounts': {k: round_currency(v) for k, v in sorted(account_totals.items(), key=lambda item: item[1], reverse=True)},
        'regions': {k: round_currency(v) for k, v in sorted(region_totals.items(), key=lambda item: item[1], reverse=True)},
        'daily_totals': {k: round_currency(v) for k, v in sorted(daily_totals.items())},
        'daily_gross_totals': {k: round_currency(v) for k, v in sorted(daily_gross_totals.items())},
        'daily_tax_totals': {k: round_currency(v) for k, v in sorted(daily_tax_totals.items())},
        'daily_credit_totals': {k: round_currency(v) for k, v in sorted(daily_credit_totals.items())},
        'daily_refund_totals': {k: round_currency(v) for k, v in sorted(daily_refund_totals.items())},
        'monthly_totals': {k: round_currency(v) for k, v in sorted(monthly_totals.items())},
        '_unrounded_service_totals': {k: str(v) for k, v in service_totals.items()},
        '_unrounded_daily_gross': {k: str(v) for k, v in daily_gross_totals.items()},
        '_unrounded_daily_totals': {k: str(v) for k, v in daily_totals.items()},
        '_unrounded_daily_tax': {k: str(v) for k, v in daily_tax_totals.items()},
        '_unrounded_daily_credit': {k: str(v) for k, v in daily_credit_totals.items()},
        '_unrounded_daily_refund': {k: str(v) for k, v in daily_refund_totals.items()},
        'filename': display_name
    }

def parse_cur_file(filepath: str) -> Dict[str, Any]:
    """Single-file wrapper for backward compatibility."""
    return parse_cur_files([filepath])


def parse_cur_manifest(manifest_source: Union[str, bytes, dict]) -> Dict[str, Any]:
    """
    Parses and validates AWS Cost and Usage Report Manifest JSON.
    Supports JSON dict, JSON string/bytes, or file path.
    Validates assemblyId, billingPeriod, format, and reportKeys.
    Rejects unsupported formats (e.g. Parquet or ZIP).
    """
    if isinstance(manifest_source, dict):
        raw = manifest_source
    elif isinstance(manifest_source, (bytes, str)):
        content = manifest_source
        if isinstance(content, str) and os.path.exists(content):
            with open(content, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        else:
            if isinstance(content, bytes):
                content = content.decode('utf-8', errors='ignore')
            raw = json.loads(content)
    else:
        raise ValueError(f"Invalid manifest source type: {type(manifest_source)}")

    if not isinstance(raw, dict):
        raise ValueError("Invalid CUR manifest format: root JSON element must be an object.")

    # Format / compression check: explicitly detect and flag unsupported formats
    content_type = str(raw.get('contentType') or raw.get('format') or '').lower()
    compression = str(raw.get('compression') or '').upper()
    report_keys = raw.get('reportKeys', [])
    report_keys_str = str(report_keys).lower()

    if 'parquet' in content_type or 'parquet' in report_keys_str or ('parquet' in str(raw).lower() and 'text/csv' not in content_type):
        raise ValueError(
            f"Parquet CUR format is not supported: contentType='{raw.get('contentType') or raw.get('format')}'. "
            "ZORVEX Phase 1 supports CSV and GZ-compressed CSV exports. Parquet formats are not supported in this version."
        )

    if compression == 'ZIP' or '.zip' in report_keys_str:
        raise ValueError(
            "ZIP compression is not supported: compression='ZIP'. "
            "ZORVEX Phase 1 supports GZIP (.gz) compression or uncompressed CSV."
        )

    def _normalize_date_str(d_str: str) -> str:
        if not d_str:
            return ''
        cleaned = d_str.split('T')[0].replace('/', '-')
        if len(cleaned) == 8 and cleaned.isdigit():
            return f"{cleaned[:4]}-{cleaned[4:6]}-{cleaned[6:8]}"
        return cleaned[:10]

    bp = raw.get('billingPeriod') or {}
    bp_start = _normalize_date_str(bp.get('start', ''))
    bp_end = _normalize_date_str(bp.get('end', ''))

    return {
        'assembly_id': raw.get('assemblyId', ''),
        'account': str(raw.get('account', '')),
        'report_name': raw.get('reportName', ''),
        'billing_period_start': bp_start,
        'billing_period_end': bp_end,
        'report_keys': report_keys,
        'columns': raw.get('columns', []),
        'compression': compression,
        'content_type': content_type,
        'format': content_type,
        'raw_manifest': raw
    }


def inspect_cur_part_metadata(filepath: str) -> Dict[str, Any]:
    """
    Inspects the header and initial sample rows of a CUR part file without loading
    the full file into memory. Returns schema metadata, detected billing period,
    and payer account id.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    with open_file_any(filepath) as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            raise ValueError(f"CUR file '{os.path.basename(filepath)}' is empty.")

        col_map = detect_column_indices(header)
        cost_idx = col_map.get('cost')
        date_idx = col_map.get('date')

        if cost_idx is None or date_idx is None:
            raise ValueError(f"Required Cost or Date columns not detected in {os.path.basename(filepath)}")

        bp_start_idx = col_map.get('bill_period_start')
        bp_end_idx = col_map.get('bill_period_end')
        payer_acc_idx = col_map.get('payer_account_id')
        acc_idx = col_map.get('account_id')
        lid_idx = col_map.get('line_item_id')

        bp_start = None
        bp_end = None
        payer_acc = None
        usage_acc = None
        sample_dates = []

        # Peek up to 25 data rows to capture metadata
        for _ in range(25):
            try:
                row = next(reader)
            except StopIteration:
                break
            if not row:
                continue

            row_len = len(row)
            if bp_start is None and bp_start_idx is not None and row_len > bp_start_idx and row[bp_start_idx]:
                raw_bp = row[bp_start_idx].strip()
                bp_start = raw_bp[:10] if len(raw_bp) >= 10 else raw_bp

            if bp_end is None and bp_end_idx is not None and row_len > bp_end_idx and row[bp_end_idx]:
                raw_bp_end = row[bp_end_idx].strip()
                bp_end = raw_bp_end[:10] if len(raw_bp_end) >= 10 else raw_bp_end

            if payer_acc is None and payer_acc_idx is not None and row_len > payer_acc_idx and row[payer_acc_idx]:
                payer_acc = row[payer_acc_idx].strip()
            elif payer_acc is None and acc_idx is not None and row_len > acc_idx and row[acc_idx]:
                payer_acc = row[acc_idx].strip()

            if usage_acc is None and acc_idx is not None and row_len > acc_idx and row[acc_idx]:
                raw_u = row[acc_idx].strip()
                if raw_u and raw_u != 'Primary-Account' and raw_u != 'Unknown':
                    usage_acc = raw_u

            if date_idx is not None and row_len > date_idx and row[date_idx]:
                raw_dt = row[date_idx].strip()[:10]
                if raw_dt and raw_dt != 'Unknown':
                    sample_dates.append(raw_dt)

        # Fallback if bill/BillingPeriodStartDate is absent
        if not bp_start and sample_dates:
            bp_start = min(sample_dates)
        if not bp_end and sample_dates:
            bp_end = max(sample_dates)

        return {
            'filepath': filepath,
            'filename': os.path.basename(filepath),
            'header': header,
            'header_count': len(header),
            'normalized_header': [normalize_col_name(h) for h in header],
            'col_map': col_map,
            'billing_period_start': bp_start or 'Unknown',
            'billing_period_end': bp_end or 'Unknown',
            'payer_account_id': payer_acc or '',
            'usage_account_id': usage_acc or payer_acc or '',
            'has_line_item_id': lid_idx is not None
        }


def validate_multipart_cur_export(filepaths: List[str], manifest: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Validates that all files in a multi-part upload belong to the same logical CUR export.
    Verifies:
    1. Header column count and normalized sequence alignment.
    2. Identical billing period start and end.
    3. Payer account alignment.
    4. Manifest alignment if manifest metadata is supplied.
    """
    if not filepaths:
        raise ValueError("No files provided for multi-part validation.")

    metas = [inspect_cur_part_metadata(fp) for fp in filepaths]
    ref_meta = metas[0]

    if len(metas) > 1:
        for meta in metas[1:]:
            # 1. Header column alignment
            if meta['header_count'] != ref_meta['header_count']:
                raise ValueError(
                    f"Multi-part CUR export header mismatch: '{meta['filename']}' has {meta['header_count']} columns, "
                    f"while part 1 ('{ref_meta['filename']}') has {ref_meta['header_count']} columns. "
                    "All parts of a multi-part export must have identical column definitions."
                )
            if meta['normalized_header'] != ref_meta['normalized_header']:
                mismatch_idx = next(
                    (i for i, (a, b) in enumerate(zip(ref_meta['normalized_header'], meta['normalized_header'])) if a != b),
                    0
                )
                col_a = ref_meta['header'][mismatch_idx] if mismatch_idx < len(ref_meta['header']) else f"col_{mismatch_idx}"
                col_b = meta['header'][mismatch_idx] if mismatch_idx < len(meta['header']) else f"col_{mismatch_idx}"
                raise ValueError(
                    f"Multi-part CUR export column sequence mismatch at column {mismatch_idx + 1}: "
                    f"'{ref_meta['filename']}' has '{col_a}', but '{meta['filename']}' has '{col_b}'."
                )

            # 2. Billing period compatibility
            if ref_meta['billing_period_start'] != 'Unknown' and meta['billing_period_start'] != 'Unknown':
                if (ref_meta['billing_period_start'] != meta['billing_period_start'] or
                    ref_meta['billing_period_end'] != meta['billing_period_end']):
                    raise ValueError(
                        f"Cannot combine files across different billing periods: '{ref_meta['filename']}' covers "
                        f"{ref_meta['billing_period_start']} to {ref_meta['billing_period_end']}, while "
                        f"'{meta['filename']}' covers {meta['billing_period_start']} to {meta['billing_period_end']}. "
                        "Distinct billing periods must be uploaded as separate datasets."
                    )

            # 3. Payer account alignment
            if ref_meta['payer_account_id'] and meta['payer_account_id']:
                if ref_meta['payer_account_id'] != meta['payer_account_id']:
                    raise ValueError(
                        f"Payer account mismatch: '{ref_meta['filename']}' is for account {ref_meta['payer_account_id']}, "
                        f"while '{meta['filename']}' is for account {meta['payer_account_id']}."
                    )

    # 4. Manifest cross-validation
    if manifest:
        m_start = manifest.get('billing_period_start')
        m_end = manifest.get('billing_period_end')
        if m_start and ref_meta['billing_period_start'] != 'Unknown' and m_start != ref_meta['billing_period_start']:
            raise ValueError(
                f"Manifest billing period start '{m_start}' does not match file data '{ref_meta['billing_period_start']}'."
            )
        if manifest.get('report_keys'):
            manifest_basenames = [os.path.basename(k) for k in manifest['report_keys']]
            for fp in filepaths:
                fn = os.path.basename(fp)
                if not any(fn in mb or mb in fn for mb in manifest_basenames):
                    logger.warning("Uploaded part '%s' not explicitly listed in manifest reportKeys: %s", fn, manifest_basenames)

    return {
        'billing_period_start': ref_meta['billing_period_start'],
        'billing_period_end': ref_meta['billing_period_end'],
        'payer_account_id': ref_meta['payer_account_id'],
        'assembly_id': manifest.get('assembly_id', '') if manifest else '',
        'col_map': ref_meta['col_map'],
        'header': ref_meta['header'],
        'part_count': len(filepaths)
    }


def merge_cur_files(filepaths: List[str], output_path: str, manifest: Optional[Dict[str, Any]] = None) -> str:
    """
    Merges multiple CUR CSV / GZ part files into a single unified .csv.gz file.
    Validates logical export compatibility and performs streaming line-item deduplication.
    Preserves header from the first part.
    """
    if not filepaths:
        raise ValueError("No files provided for merging.")

    # 1. Authoritative validation pass
    export_meta = validate_multipart_cur_export(filepaths, manifest=manifest)

    if len(filepaths) == 1:
        if os.path.abspath(filepaths[0]) != os.path.abspath(output_path):
            import shutil
            shutil.copy2(filepaths[0], output_path)
        return output_path

    is_gz = output_path.endswith('.gz')
    out_f = gzip.open(output_path, 'wt', encoding='utf-8', newline='') if is_gz else open(output_path, 'w', encoding='utf-8', newline='')

    col_map = export_meta['col_map']
    lid_idx = col_map.get('line_item_id')
    date_idx = col_map.get('date')
    cost_idx = col_map.get('cost')
    res_idx = col_map.get('res_id')
    ut_idx = col_map.get('usage')
    ltype_idx = col_map.get('line_type')

    seen_signatures = set()
    header_written = False

    try:
        writer = csv.writer(out_f)
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
                    if not row:
                        continue
                    row_len = len(row)

                    # Deduplication signature within same delivery bundle
                    if lid_idx is not None and row_len > lid_idx and row[lid_idx]:
                        lid = row[lid_idx].strip()
                        dt = row[date_idx].strip() if (date_idx is not None and row_len > date_idx) else ''
                        c = row[cost_idx].strip() if (cost_idx is not None and row_len > cost_idx) else ''
                        lt = row[ltype_idx].strip() if (ltype_idx is not None and row_len > ltype_idx) else ''
                        sig = (lid, dt, c, lt)
                    else:
                        rid = row[res_idx].strip() if (res_idx is not None and row_len > res_idx) else ''
                        ut = row[ut_idx].strip() if (ut_idx is not None and row_len > ut_idx) else ''
                        dt = row[date_idx].strip() if (date_idx is not None and row_len > date_idx) else ''
                        c = row[cost_idx].strip() if (cost_idx is not None and row_len > cost_idx) else ''
                        lt = row[ltype_idx].strip() if (ltype_idx is not None and row_len > ltype_idx) else ''
                        sig = (rid, ut, dt, c, lt)

                    if sig in seen_signatures:
                        # Identical duplicate within same multi-part upload: discard to prevent double-counting
                        continue

                    seen_signatures.add(sig)
                    writer.writerow(row)
    finally:
        out_f.close()

    return output_path
