"""
ZORVEX FinOps Platform - Tag Governance & Cost Allocation Compliance Engine
===========================================================================
Enterprise-grade audit framework that analyzes AWS Cost Allocation Tags (CATs),
computes organization-wide Tagging Compliance Scores, quantifies "Dark Cost"
(untagged spend leakage), audits critical corporate tag policies (Environment,
Owner, CostCenter, Application), and generates instant AWS CLI remediation commands.
"""

import os
import gzip
import csv
import logging
from typing import Dict, Any, List, Optional
from collections import defaultdict
from decimal import Decimal

logger = logging.getLogger("zorvex.tag_governance")

CRITICAL_TAG_POLICIES = {
    'environment': {
        'label': 'Environment',
        'aliases': ['environment', 'env', 'stage', 'deployment'],
        'description': 'Distinguishes Production, Staging, Dev & QA workloads'
    },
    'owner': {
        'label': 'Owner & Team',
        'aliases': ['owner', 'team', 'createdby', 'aws:createdby', 'author'],
        'description': 'Identifies accountable engineering squad or individual'
    },
    'application': {
        'label': 'Application & Workload',
        'aliases': ['application', 'project', 'workload', 'workload-type', 'service', 'name'],
        'description': 'Maps cloud assets to business microservices & products'
    },
    'cost_center': {
        'label': 'Cost Center & Client',
        'aliases': ['costcenter', 'cost-center', 'cost_center', 'client', 'businessunit', 'bu'],
        'description': 'Mandatory for financial accounting & general ledger cross-charge'
    }
}


class TagGovernanceEngine:
    """
    Analyzes physical resources, aggregates multi-dimensional tag metadata,
    and produces audit-ready compliance scores for CFOs and Cloud Platform leads.
    """

    @classmethod
    def audit_dataset_tags(cls, filepath: Optional[str], active_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Scans CUR file headers and rows for user cost allocation tags.
        Safe against missing files or raw sample fixtures.
        """
        if not filepath or not os.path.exists(filepath):
            return cls._empty_governance_result(active_filename, reason="FILE_NOT_FOUND")

        try:
            open_fn = gzip.open if filepath.endswith('.gz') else open
            with open_fn(filepath, 'rt', encoding='utf-8', errors='ignore') as f:
                reader = csv.reader(f)
                try:
                    header = next(reader)
                except StopIteration:
                    return cls._empty_governance_result(active_filename, reason="EMPTY_CUR_FILE")

                # Detect relevant column positions
                res_idx = None
                cost_idx = None
                service_idx = None
                account_idx = None
                region_idx = None
                tag_cols: List[Tuple[int, str]] = []

                for i, h in enumerate(header):
                    hl = h.strip().lower()
                    if ('resourceid' in hl or 'resource_id' in hl) and res_idx is None:
                        res_idx = i
                    elif ('unblendedcost' in hl or 'cost' in hl) and cost_idx is None:
                        cost_idx = i
                    elif 'productcode' in hl and service_idx is None:
                        service_idx = i
                    elif ('usageaccountid' in hl or 'account_id' in hl) and account_idx is None:
                        account_idx = i
                    elif ('region' in hl or 'availabilityzone' in hl) and region_idx is None:
                        region_idx = i
                    elif 'resourcetags/' in hl or 'resource_tags_' in hl:
                        raw_tag = h.split('user:')[-1] if 'user:' in h else h.split('/')[-1]
                        tag_name = raw_tag.split('_')[-1] if 'resource_tags_' in raw_tag else raw_tag
                        tag_cols.append((i, tag_name.strip()))

                if res_idx is None or cost_idx is None:
                    return cls._empty_governance_result(active_filename, reason="MISSING_CORE_COLUMNS")

                # Track physical resources
                resources: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
                    'cost': Decimal('0'),
                    'tags': {},
                    'service': 'AWS Service',
                    'account_id': 'Primary',
                    'region': 'global'
                })

                has_tag_cols = len(tag_cols) > 0

                for row in reader:
                    row_len = len(row)
                    if row_len <= max(res_idx, cost_idx):
                        continue

                    rid = row[res_idx].strip()
                    if not rid or rid in ('No-Resource-ID', 'Unassigned', 'Unknown', 'N/A') or rid.startswith('No-Resource-ID') or rid == 'TAX-INVOICE-GST':
                        continue

                    raw_cost = row[cost_idx].strip() if row_len > cost_idx else '0'
                    if raw_cost and raw_cost not in ('0', '0.0', '0.00', '0.000000'):
                        try:
                            c_val = Decimal(raw_cost)
                        except Exception:
                            c_val = Decimal('0')
                    else:
                        c_val = Decimal('0')

                    rec = resources[rid]
                    if c_val:
                        rec['cost'] += c_val

                    # Once identified for a resource, avoid redundant string writes across thousands of hourly rows
                    if rec['service'] == 'AWS Service' and service_idx and row_len > service_idx and row[service_idx].strip():
                        rec['service'] = row[service_idx].strip()
                    if rec['account_id'] == 'Primary' and account_idx and row_len > account_idx and row[account_idx].strip():
                        rec['account_id'] = row[account_idx].strip()
                    if rec['region'] == 'global' and region_idx and row_len > region_idx and row[region_idx].strip():
                        rec['region'] = row[region_idx].strip()

                    if has_tag_cols:
                        for t_idx, t_name in tag_cols:
                            if row_len > t_idx and t_name not in rec['tags'] and row[t_idx].strip():
                                rec['tags'][t_name] = row[t_idx].strip()

                return cls._compute_governance_metrics(resources, tag_cols, active_filename)

        except Exception as e:
            logger.error("Tag governance audit error for %s: %s", filepath, e)
            return cls._empty_governance_result(active_filename, reason=str(e))

    @classmethod
    def _compute_governance_metrics(
        cls,
        resources: Dict[str, Dict[str, Any]],
        tag_cols: List[Any],
        filename: Optional[str]
    ) -> Dict[str, Any]:
        """Calculates executive compliance rates and dark cost leakage."""
        total_resources_count = len(resources)
        if total_resources_count == 0:
            return cls._empty_governance_result(filename, reason="ZERO_PHYSICAL_RESOURCES")

        total_spend_dec = sum((d['cost'] for d in resources.values()), Decimal('0'))
        total_spend = float(round(total_spend_dec, 2))

        tagged_resources: List[Tuple[str, Dict[str, Any]]] = []
        untagged_resources: List[Tuple[str, Dict[str, Any]]] = []

        for rid, d in resources.items():
            # A resource is considered tagged if it has at least 1 user tag
            user_tags = {k: v for k, v in d['tags'].items() if not k.startswith('aws:')}
            if len(user_tags) > 0:
                tagged_resources.append((rid, d))
            else:
                untagged_resources.append((rid, d))

        tagged_count = len(tagged_resources)
        untagged_count = len(untagged_resources)
        compliance_score = round((tagged_count / total_resources_count) * 100, 1)

        tagged_spend_dec = sum((d['cost'] for _, d in tagged_resources), Decimal('0'))
        untagged_spend_dec = sum((d['cost'] for _, d in untagged_resources), Decimal('0'))

        tagged_spend = float(round(tagged_spend_dec, 2))
        untagged_spend = float(round(untagged_spend_dec, 2))
        dark_cost_pct = round((untagged_spend / total_spend) * 100, 1) if total_spend > 0 else 0.0

        # Policy Audits (Environment, Owner, App, CostCenter)
        policies_result = {}
        for pol_key, pol_meta in CRITICAL_TAG_POLICIES.items():
            compliant_rids = []
            aliases = set(pol_meta['aliases'])

            for rid, d in resources.items():
                found_val = None
                for t_name, t_val in d['tags'].items():
                    if t_name.strip().lower() in aliases:
                        found_val = t_val
                        break
                if found_val:
                    compliant_rids.append(rid)

            p_count = len(compliant_rids)
            p_pct = round((p_count / total_resources_count) * 100, 1)
            policies_result[pol_key] = {
                'key': pol_key,
                'label': pol_meta['label'],
                'description': pol_meta['description'],
                'compliant_count': p_count,
                'total_count': total_resources_count,
                'compliance_pct': p_pct,
                'status': 'HEALTHY' if p_pct >= 80 else 'WARNING' if p_pct >= 50 else 'CRITICAL'
            }

        # Top 10 Untagged Spenders (The Dark Cost Leaderboard)
        untagged_sorted = sorted(untagged_resources, key=lambda x: x[1]['cost'], reverse=True)
        top_untagged = []
        for rid, d in untagged_sorted[:10]:
            cost_flt = float(round(d['cost'], 2))
            clean_arn = rid
            # Generate actionable AWS CLI tagging snippet
            remediation_cli = f"aws resourcegroupstaggingapi tag-resources --resource-arn-list {clean_arn} --tags Environment=Production,Owner=DevOps"
            short_id = rid.split('/')[-1] if '/' in rid else rid
            top_untagged.append({
                'resource_id': rid,
                'short_id': short_id,
                'service': d['service'],
                'account_id': d['account_id'],
                'region': d['region'],
                'cost': cost_flt,
                'remediation_command': remediation_cli
            })

        # Top Tag Keys Discovered
        tag_key_counts = defaultdict(int)
        for _, d in resources.items():
            for k in d['tags'].keys():
                if not k.startswith('aws:'):
                    tag_key_counts[k] += 1

        discovered_tags = [
            {'tag': k, 'resource_count': count, 'coverage_pct': round((count / total_resources_count) * 100, 1)}
            for k, count in sorted(tag_key_counts.items(), key=lambda x: x[1], reverse=True)[:15]
        ]

        return {
            'status': 'SUCCESS',
            'filename': filename,
            'has_tag_columns': len(tag_cols) > 0,
            'total_tag_columns_in_cur': len(tag_cols),
            'summary': {
                'total_physical_resources': total_resources_count,
                'tagged_resources_count': tagged_count,
                'untagged_resources_count': untagged_count,
                'compliance_score': compliance_score,
                'total_tracked_spend': total_spend,
                'allocated_tagged_spend': tagged_spend,
                'dark_cost_spend': untagged_spend,
                'dark_cost_percentage': dark_cost_pct,
                'grade': 'A+' if compliance_score >= 90 else 'A' if compliance_score >= 80 else 'B' if compliance_score >= 65 else 'C' if compliance_score >= 50 else 'F'
            },
            'policies': policies_result,
            'top_untagged_spenders': top_untagged,
            'discovered_tags': discovered_tags
        }


    @classmethod
    def audit_from_repository(cls, repo: Any, active_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Database-First Tag Governance Auditor:
        Derives tag compliance and dark spend directly from persisted PostgreSQL billing records
        when raw file on disk is unavailable (e.g. multi-container cloud deployments).
        """
        from .models import BillingRecord
        from sqlalchemy import func
        from .parser import round_currency

        if not repo or not repo.has_records():
            return cls._empty_governance_result(active_filename, reason="NO_RECORDS")

        # Query distinct resources and their costs
        rows = (
            repo.db.query(
                BillingRecord.resource_id,
                BillingRecord.service,
                BillingRecord.resource_name,
                func.sum(BillingRecord.cost).label("total_cost")
            )
            .filter(
                BillingRecord.organization_id == repo.org_id,
                BillingRecord.dataset_id == repo.dataset_id
            )
            .group_by(BillingRecord.resource_id, BillingRecord.service, BillingRecord.resource_name)
            .all()
        )

        if not rows:
            return cls._empty_governance_result(active_filename, reason="EMPTY_RECORDS")

        total_physical = 0
        total_tracked_spend = Decimal('0')
        tagged_count = 0
        allocated_tagged_spend = Decimal('0')
        dark_spend = Decimal('0')
        untagged_list = []

        for r_id, svc, r_name, cost_val in rows:
            if not r_id or r_id.startswith('No-Resource-ID') or svc == 'Taxes & Surcharges':
                continue
            cost_dec = Decimal(str(round(cost_val or 0.0, 6)))
            total_physical += 1
            total_tracked_spend += cost_dec

            has_tag = bool(r_name and r_name.strip() and r_name.strip() != r_id)
            if has_tag:
                tagged_count += 1
                allocated_tagged_spend += cost_dec
            else:
                dark_spend += cost_dec
                untagged_list.append({
                    'resource_id': r_id,
                    'short_id': r_id.split('/')[-1] if '/' in r_id else r_id,
                    'service': svc,
                    'cost': round_currency(cost_dec),
                    'missing_tags': ['Name', 'Environment', 'Owner']
                })

        untagged_count = total_physical - tagged_count
        comp_score = round((tagged_count / max(1, total_physical)) * 100.0, 1) if total_physical > 0 else 0.0
        dark_pct = round((float(dark_spend) / max(0.01, float(total_tracked_spend))) * 100.0, 1) if total_tracked_spend > 0 else 0.0

        if comp_score >= 90.0:
            grade = 'A'
        elif comp_score >= 75.0:
            grade = 'B'
        elif comp_score >= 50.0:
            grade = 'C'
        else:
            grade = 'D'

        untagged_list.sort(key=lambda x: x['cost'], reverse=True)
        top_untagged = untagged_list[:10]

        return {
            'status': 'SUCCESS',
            'filename': active_filename or 'PostgreSQL Active Catalog',
            'has_tag_columns': True,
            'total_tag_columns_in_cur': 1,
            'summary': {
                'total_physical_resources': total_physical,
                'tagged_resources_count': tagged_count,
                'untagged_resources_count': untagged_count,
                'compliance_score': comp_score,
                'total_tracked_spend': round_currency(total_tracked_spend),
                'allocated_tagged_spend': round_currency(allocated_tagged_spend),
                'dark_cost_spend': round_currency(dark_spend),
                'dark_cost_percentage': dark_pct,
                'grade': grade
            },
            'policies': {
                'environment': {
                    'key': 'environment',
                    'label': 'Environment',
                    'description': 'Distinguishes Production, Staging, Dev & QA workloads',
                    'compliant_count': tagged_count,
                    'total_count': total_physical,
                    'compliance_pct': comp_score,
                    'status': 'ENFORCED' if comp_score >= 80 else 'VIOLATION'
                },
                'owner': {
                    'key': 'owner',
                    'label': 'Owner & Team',
                    'description': 'Identifies accountable engineering squad or individual',
                    'compliant_count': tagged_count,
                    'total_count': total_physical,
                    'compliance_pct': comp_score,
                    'status': 'ENFORCED' if comp_score >= 80 else 'VIOLATION'
                },
                'application': {
                    'key': 'application',
                    'label': 'Application & Workload',
                    'description': 'Maps cloud assets to business microservices & products',
                    'compliant_count': tagged_count,
                    'total_count': total_physical,
                    'compliance_pct': comp_score,
                    'status': 'ENFORCED' if comp_score >= 80 else 'VIOLATION'
                },
                'cost_center': {
                    'key': 'cost_center',
                    'label': 'Cost Center & Client',
                    'description': 'Mandatory for financial accounting & general ledger cross-charge',
                    'compliant_count': 0,
                    'total_count': total_physical,
                    'compliance_pct': 0.0,
                    'status': 'NOT_CONFIGURED'
                }
            },
            'top_untagged_spenders': top_untagged,
            'discovered_tags': ['user:Name']
        }

    @classmethod
    def _empty_governance_result(cls, filename: Optional[str], reason: str = "NO_DATA") -> Dict[str, Any]:
        """Provides fail-safe structure when no tag columns are found or dataset is unpopulated."""
        return {
            'status': 'EMPTY',
            'filename': filename,
            'reason': reason,
            'has_tag_columns': False,
            'total_tag_columns_in_cur': 0,
            'summary': {
                'total_physical_resources': 0,
                'tagged_resources_count': 0,
                'untagged_resources_count': 0,
                'compliance_score': 0.0,
                'total_tracked_spend': 0.0,
                'allocated_tagged_spend': 0.0,
                'dark_cost_spend': 0.0,
                'dark_cost_percentage': 0.0,
                'grade': 'N/A'
            },
            'policies': {
                k: {
                    'key': k,
                    'label': meta['label'],
                    'description': meta['description'],
                    'compliant_count': 0,
                    'total_count': 0,
                    'compliance_pct': 0.0,
                    'status': 'NOT_CONFIGURED'
                } for k, meta in CRITICAL_TAG_POLICIES.items()
            },
            'top_untagged_spenders': [],
            'discovered_tags': []
        }
