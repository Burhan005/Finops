from datetime import datetime
"""
ZORVEX CUR-Driven Resource Explorer & Snapshot Cost Intelligence Engine
Authoritative asset classification, cost aggregation, and snapshot intelligence
derived strictly from authenticated AWS CUR billing records.
"""

import math
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal
from app.parser import normalize_service_code, round_currency

# Asset Category Definitions
CATEGORY_LABELS = {
    # EC2 Categories
    'EBS_SNAPSHOT': 'EBS Snapshot',
    'EC2_INSTANCE': 'EC2 Instance',
    'EBS_VOLUME': 'EBS Volume',
    'NAT_GATEWAY': 'NAT Gateway',
    'ELASTIC_IP': 'Elastic IP / Public IPv4',
    'UNCLASSIFIED_EC2': 'Unclassified EC2 Record',

    # RDS Categories
    'RDS_DB_INSTANCE': 'RDS DB Instance',
    'RDS_SNAPSHOT': 'RDS Snapshot',
    'RDS_BACKUP': 'Automated Backup / Storage',
    'RDS_STORAGE': 'Database Storage',
    'UNCLASSIFIED_RDS': 'Unclassified RDS Record',

    # Other Key Services
    'S3_BUCKET': 'S3 Bucket / Storage',
    'REDSHIFT_CLUSTER': 'Redshift Cluster',
    'OPENSEARCH_DOMAIN': 'OpenSearch Domain',
    'CLOUDFRONT_DISTRIBUTION': 'CloudFront Distribution',
    'WAF_WEB_ACL': 'WAF Web ACL',
    'ELB_LOAD_BALANCER': 'Elastic Load Balancer',
    'ROUTE53_HOSTED_ZONE': 'Route 53 Hosted Zone',
    'ROUTE53_DNS': 'Route 53 DNS Queries',
    'EKS_CLUSTER': 'EKS Cluster Control Plane',
    'ECS_TASK': 'ECS Container Task',
    'GENERIC_RESOURCE': 'Identified Resource',
    'USAGE_LEVEL_COST': 'Usage-Level / Unallocated Cost',
    'TAX_AND_FEES': 'Government Tax & GST',
    'RI_SUBSCRIPTION_FEE': 'RI Recurring Subscription Fee',
    'MARKETPLACE_SOFTWARE': 'Marketplace Software'
}

def classify_cur_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Classifies a raw CUR record into a deterministic Service and Asset Category
    using LineItem, UsageType, ResourceId, and Operation evidence.
    """
    service = normalize_service_code(record.get('service', 'Other'))
    res_id = record.get('resource_id', '').strip()
    usage_type = record.get('usage_type', '').strip()
    ut_lower = usage_type.lower()
    op_lower = record.get('operation', '').strip().lower()
    res_lower = res_id.lower()

    is_tax = record.get('line_type', '').lower() == 'tax' or 'tax' in ut_lower or 'gst' in ut_lower or bool(record.get('tax_type')) or res_id == 'TAX-INVOICE-GST'
    is_ri_fee = record.get('line_type', '').lower() == 'rifee' or 'rifee' in ut_lower

    # Tax charges (e.g. India GST) are never physical compute/storage assets
    if is_tax:
        return {
            'service': 'Taxes & Surcharges',
            'category': 'TAX_AND_FEES',
            'category_label': 'Government Tax & GST',
            'asset_type': 'Tax / Regulatory',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': False,
            'classification_status': 'USAGE_LEVEL_COST'
        }

    # Ambiguous, shared, or missing resource identifier
    if not res_id or res_id in ('No-Resource-ID', 'Unassigned', 'Unknown', 'N/A') or res_id.startswith('No-Resource-ID'):
        if is_ri_fee:
            cat = 'RI_SUBSCRIPTION_FEE'
            cat_label = 'RI Recurring Subscription Fee'
            asset_type = 'Subscription'
        else:
            cat = 'USAGE_LEVEL_COST'
            cat_label = 'Usage-Level / Unallocated'
            asset_type = 'Unallocated'

        return {
            'service': service,
            'category': cat,
            'category_label': cat_label,
            'asset_type': asset_type,
            'is_snapshot': False,
            'is_backup': 'backup' in ut_lower or 'snapshot' in ut_lower,
            'is_classified': False,
            'classification_status': 'USAGE_LEVEL_COST'
        }

    # ==================== AMAZON EKS ====================
    if service in ('Amazon EKS', 'AmazonEKS') or ':cluster/' in res_lower:
        return {
            'service': 'Amazon EKS',
            'category': 'EKS_CLUSTER',
            'category_label': 'EKS Cluster Control Plane',
            'asset_type': 'Kubernetes Cluster',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    # ==================== AMAZON ECS ====================
    if service in ('Amazon ECS', 'AmazonECS') or ':task/' in res_lower or 'fargate' in ut_lower:
        return {
            'service': 'Amazon ECS',
            'category': 'ECS_TASK',
            'category_label': 'ECS Container Task',
            'asset_type': 'Fargate / Container',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    # ==================== AWS MARKETPLACE ====================
    if service == 'AWS Marketplace' or 'softwareusage' in ut_lower:
        return {
            'service': 'AWS Marketplace',
            'category': 'MARKETPLACE_SOFTWARE',
            'category_label': 'Marketplace Software',
            'asset_type': 'Software Subscription',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    # ==================== AMAZON EC2 ====================
    if service == 'Amazon EC2':
        # EBS Snapshot
        if ':snapshot/' in res_lower or res_id.startswith('snap-') or 'snap-' in res_lower or 'snapshot' in ut_lower or 'snapshot' in op_lower:
            return {
                'service': 'Amazon EC2',
                'category': 'EBS_SNAPSHOT',
                'category_label': 'EBS Snapshot',
                'asset_type': 'Storage',
                'is_snapshot': True,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # NAT Gateway (Must precede EC2 Instance because AWS sets Operation=RunInstances on NAT Data Transfer)
        if ':natgateway/' in res_lower or res_id.startswith('nat-') or 'natgateway' in ut_lower:
            return {
                'service': 'Amazon EC2',
                'category': 'NAT_GATEWAY',
                'category_label': 'NAT Gateway',
                'asset_type': 'Networking',
                'is_snapshot': False,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # EBS Volume
        if res_id.startswith('vol-') or 'volumeusage' in ut_lower or 'ebs:volume' in ut_lower or 'iops' in ut_lower:
            return {
                'service': 'Amazon EC2',
                'category': 'EBS_VOLUME',
                'category_label': 'EBS Volume',
                'asset_type': 'Storage',
                'is_snapshot': False,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # EC2 Compute Instance
        if res_id.startswith('i-') or 'boxusage' in ut_lower or 'heavyusage' in ut_lower or 'spotusage' in ut_lower:
            return {
                'service': 'Amazon EC2',
                'category': 'EC2_INSTANCE',
                'category_label': 'EC2 Instance',
                'asset_type': 'Compute',
                'is_snapshot': False,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # Elastic IP / Public IPv4
        if res_id.startswith('eipalloc-') or 'publicipv4' in ut_lower or 'elasticip' in ut_lower or 'inuseaddress' in ut_lower or 'idleaddress' in ut_lower:
            return {
                'service': 'Amazon EC2',
                'category': 'ELASTIC_IP',
                'category_label': 'Elastic IP / Public IPv4',
                'asset_type': 'Networking',
                'is_snapshot': False,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # Unclassified EC2
        return {
            'service': 'Amazon EC2',
            'category': 'UNCLASSIFIED_EC2',
            'category_label': 'Unclassified EC2 Record',
            'asset_type': 'Other',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': False,
            'classification_status': 'UNCLASSIFIED'
        }

    # ==================== AMAZON RDS ====================
    if service == 'Amazon RDS':
        # RDS Snapshot
        if ':snapshot:' in res_lower or ':snapshot/' in res_lower or res_id.startswith('rds:snap-') or 'rdssnapshot' in ut_lower:
            return {
                'service': 'Amazon RDS',
                'category': 'RDS_SNAPSHOT',
                'category_label': 'RDS Snapshot',
                'asset_type': 'Storage',
                'is_snapshot': True,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # Automated Backup Storage
        if 'chargedbackup' in ut_lower or 'backupusage' in ut_lower or 'backup' in ut_lower:
            return {
                'service': 'Amazon RDS',
                'category': 'RDS_BACKUP',
                'category_label': 'Automated Backup / Storage',
                'asset_type': 'Storage',
                'is_snapshot': False,
                'is_backup': True,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # Database Storage (EBS GP3/GP2/PIOPS attached to RDS)
        if 'storage' in ut_lower or 'gp3' in ut_lower or 'gp2' in ut_lower or 'piops' in ut_lower:
            return {
                'service': 'Amazon RDS',
                'category': 'RDS_STORAGE',
                'category_label': 'Database Storage',
                'asset_type': 'Storage',
                'is_snapshot': False,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # RDS DB Instance
        if ':db:' in res_lower or 'instanceusage' in ut_lower or 'heavyusage:db' in ut_lower or 'multiaz' in ut_lower:
            return {
                'service': 'Amazon RDS',
                'category': 'RDS_DB_INSTANCE',
                'category_label': 'RDS DB Instance',
                'asset_type': 'Database',
                'is_snapshot': False,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        # Unclassified RDS
        return {
            'service': 'Amazon RDS',
            'category': 'UNCLASSIFIED_RDS',
            'category_label': 'Unclassified RDS Record',
            'asset_type': 'Other',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': False,
            'classification_status': 'UNCLASSIFIED'
        }

    # ==================== OTHER SERVICES ====================
    if service == 'Amazon S3':
        return {
            'service': 'Amazon S3',
            'category': 'S3_BUCKET',
            'category_label': 'S3 Bucket / Storage',
            'asset_type': 'Storage',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    if service in ('Amazon Redshift', 'AmazonRedshift'):
        return {
            'service': 'Amazon Redshift',
            'category': 'REDSHIFT_CLUSTER',
            'category_label': 'Redshift Cluster',
            'asset_type': 'Analytics',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    if service in ('Amazon OpenSearch', 'Amazon OpenSearch Service', 'Amazon ES'):
        return {
            'service': 'Amazon OpenSearch',
            'category': 'OPENSEARCH_DOMAIN',
            'category_label': 'OpenSearch Domain',
            'asset_type': 'Analytics',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    if service in ('AWSELB', 'Amazon ELB'):
        return {
            'service': 'Elastic Load Balancing',
            'category': 'ELB_LOAD_BALANCER',
            'category_label': 'Elastic Load Balancer',
            'asset_type': 'Networking',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    if service in ('Amazon CloudFront', 'CloudFront'):
        return {
            'service': 'Amazon CloudFront',
            'category': 'CLOUDFRONT_DISTRIBUTION',
            'category_label': 'CloudFront Distribution',
            'asset_type': 'CDN / Edge',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    if service in ('AWS WAF', 'WAF', 'awswaf'):
        return {
            'service': 'AWS WAF',
            'category': 'WAF_WEB_ACL',
            'category_label': 'WAF Web ACL',
            'asset_type': 'Security',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    if service in ('Amazon Route 53', 'Route 53', 'AmazonRoute53'):
        if 'hostedzone' in res_lower or 'hostedzone' in ut_lower:
            return {
                'service': 'Amazon Route 53',
                'category': 'ROUTE53_HOSTED_ZONE',
                'category_label': 'Route 53 Hosted Zone',
                'asset_type': 'Networking',
                'is_snapshot': False,
                'is_backup': False,
                'is_classified': True,
                'classification_status': 'CLASSIFIED_RESOURCE'
            }
        return {
            'service': 'Amazon Route 53',
            'category': 'ROUTE53_DNS',
            'category_label': 'Route 53 DNS Queries',
            'asset_type': 'Networking',
            'is_snapshot': False,
            'is_backup': False,
            'is_classified': True,
            'classification_status': 'CLASSIFIED_RESOURCE'
        }

    # Generic Classified Resource for other services
    return {
        'service': service,
        'category': 'GENERIC_RESOURCE',
        'category_label': f"{service} Resource",
        'asset_type': 'Other',
        'is_snapshot': False,
        'is_backup': False,
        'is_classified': True,
        'classification_status': 'CLASSIFIED_RESOURCE'
    }


def get_available_hierarchies(cur_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Data-driven inspection of available Services and Categories in the CUR dataset.
    """
    if not cur_data:
        return {'services': [], 'categories_by_service': {}, 'snapshots_and_backups': {}}

    if '_cached_hierarchies' in cur_data:
        return cur_data['_cached_hierarchies']

    records = cur_data.get('records', [])
    services_map = defaultdict(lambda: {'cost': 0.0, 'records_count': 0, 'resources': set()})
    categories_map = defaultdict(lambda: defaultdict(lambda: {'cost': 0.0, 'records_count': 0, 'resources': set()}))

    # Snapshot totals
    snapshot_stats = {
        'total_cost': 0.0,
        'ebs_snapshot_cost': 0.0,
        'rds_backup_cost': 0.0,
        'ebs_snapshot_resources': set(),
        'rds_backup_resources': set()
    }

    for r in records:
        cost = r.get('cost', 0.0)
        rid = r.get('resource_id', '')
        cls = classify_cur_record(r)
        svc = cls['service']
        cat = cls['category']

        # Exclude Tax / Regulatory from Service Catalog & Categories (taxes belong at overall invoice level)
        if (
            cat == 'TAX_AND_FEES' or 
            cls.get('asset_type') == 'Tax / Regulatory' or 
            svc in ('Taxes & Surcharges', 'Tax') or 
            r.get('line_type', '').lower() == 'tax' or 
            rid.startswith('TAX-') or
            rid == 'TAX-INVOICE-GST'
        ):
            continue

        services_map[svc]['cost'] += cost
        services_map[svc]['records_count'] += 1
        if rid and not rid.startswith('No-Resource-ID') and not rid.startswith('TAX-'):
            services_map[svc]['resources'].add(rid)

        categories_map[svc][cat]['cost'] += cost
        categories_map[svc][cat]['records_count'] += 1
        if cat == 'RI_SUBSCRIPTION_FEE' or cls.get('asset_type') == 'Subscription':
            contract_id = r.get('subscription_id') or r.get('ri_arn') or rid
            if contract_id:
                categories_map[svc][cat]['resources'].add(contract_id)
                services_map[svc]['resources'].add(contract_id)
        elif rid and not rid.startswith('No-Resource-ID') and not rid.startswith('TAX-'):
            categories_map[svc][cat]['resources'].add(rid)

        # Global Snapshot Tracking
        if cls['is_snapshot'] or cls['is_backup']:
            snapshot_stats['total_cost'] += cost
            if cls['category'] == 'EBS_SNAPSHOT':
                snapshot_stats['ebs_snapshot_cost'] += cost
                if rid and not rid.startswith('No-Resource-ID') and not rid.startswith('TAX-'):
                    snapshot_stats['ebs_snapshot_resources'].add(rid)
            elif cls['category'] in ('RDS_SNAPSHOT', 'RDS_BACKUP'):
                snapshot_stats['rds_backup_cost'] += cost
                if rid and not rid.startswith('No-Resource-ID') and not rid.startswith('TAX-'):
                    snapshot_stats['rds_backup_resources'].add(rid)

    services_list = []
    for svc_name, stats in sorted(services_map.items(), key=lambda x: x[1]['cost'], reverse=True):
        services_list.append({
            'id': svc_name,
            'name': svc_name,
            'cost': round(stats['cost'], 2),
            'unique_resources': len(stats['resources']),
            'records_count': stats['records_count']
        })

    # Build category list for each service
    categories_by_service = {}
    for svc_name, cats in categories_map.items():
        cat_list = []
        for cat_id, stats in sorted(cats.items(), key=lambda x: x[1]['cost'], reverse=True):
            cat_list.append({
                'id': cat_id,
                'name': CATEGORY_LABELS.get(cat_id, cat_id),
                'cost': round(stats['cost'], 2),
                'unique_resources': len(stats['resources']),
                'records_count': stats['records_count']
            })
        categories_by_service[svc_name] = cat_list

    result = {
        'services': services_list,
        'categories_by_service': categories_by_service,
        'snapshots_and_backups': {
            'total_cost': round(snapshot_stats['total_cost'], 2),
            'ebs_snapshot_cost': round(snapshot_stats['ebs_snapshot_cost'], 2),
            'ebs_snapshot_count': len(snapshot_stats['ebs_snapshot_resources']),
            'rds_backup_cost': round(snapshot_stats['rds_backup_cost'], 2),
            'rds_backup_count': len(snapshot_stats['rds_backup_resources']),
            'total_unique_count': len(snapshot_stats['ebs_snapshot_resources']) + len(snapshot_stats['rds_backup_resources'])
        }
    }
    cur_data['_cached_hierarchies'] = result
    return result


def extract_cluster_topology(service: str, resource_id: str, data: Dict[str, Any], total_days: int, dataset_start_date: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Decomposes multi-node cluster resources (OpenSearch, Elasticsearch, Redshift)
    into constituent Data Nodes, Dedicated Master Nodes, Provisioned Storage,
    and Network Data Transfer.
    """
    if resource_id.startswith('No-Resource-ID') or resource_id.startswith('TAX-'):
        return None

    rid_lower = resource_id.lower()
    is_opensearch = (
        'opensearch' in service.lower() or 
        'elasticsearch' in service.lower() or 
        'es' in service.lower() or 
        ':domain/' in rid_lower
    )
    is_redshift = 'redshift' in service.lower() or ':cluster:' in rid_lower

    if not (is_opensearch or is_redshift):
        return None

    days = max(total_days, 1)

    if is_opensearch:
        node_types = {}
        storage_info = {'amount': 0.0, 'unit': 'GB-Mo', 'type': 'GP3', 'cost': 0.0}
        transfer_gb = 0.0
        transfer_cost = 0.0

        for ut, amt in data.get('usage_by_type', {}).items():
            cost = data.get('cost_by_type', {}).get(ut, 0.0)
            ut_lower = ut.lower()
            if 'esinstance:' in ut_lower or 'instance' in ut_lower:
                inst_type = ut.split(':')[-1] if ':' in ut else ut
                daily_map = data.get('usage_by_type_and_date', {}).get(ut, {})
                peak_daily = max(daily_map.values()) if daily_map else 0.0
                if peak_daily >= 18.0:
                    count = round(peak_daily / 24.0)
                else:
                    active_days = max(len(data.get('dates', {})), 1)
                    count = max(1, round(amt / (active_days * 24.0)))
                count = max(count, 1)
                node_types[inst_type] = {
                    'instance_type': inst_type,
                    'hours': round(amt, 2),
                    'estimated_count': count,
                    'cost': round(cost, 2),
                    'unit': 'Hrs',
                    'is_ri_covered': (cost == 0.0 and amt > 0)
                }
            elif 'storage' in ut_lower or 'gp3' in ut_lower or 'gp2' in ut_lower:
                storage_info['amount'] += amt
                storage_info['cost'] += cost
                if 'gp3' in ut_lower:
                    storage_info['type'] = 'GP3'
                elif 'gp2' in ut_lower:
                    storage_info['type'] = 'GP2'
            elif 'transfer' in ut_lower or 'bytes' in ut_lower or 'out' in ut_lower:
                transfer_gb += amt
                transfer_cost += cost

        if not node_types and storage_info['amount'] == 0:
            return None

        # Classify Data Nodes vs Master Nodes:
        # In OpenSearch: Data nodes have larger instances & higher capacity (e.g. 4x m7g.2xlarge).
        # Dedicated Master nodes are typically 3 smaller instances for quorum management (e.g. 3x m7g.large).
        sorted_nodes = sorted(node_types.values(), key=lambda x: x['hours'], reverse=True)
        data_nodes = None
        master_nodes = None

        if len(sorted_nodes) == 1:
            data_nodes = sorted_nodes[0]
            data_nodes['role'] = 'Data & Manager Node'
        elif len(sorted_nodes) >= 2:
            data_nodes = sorted_nodes[0]
            data_nodes['role'] = 'Data Nodes'
            master_nodes = sorted_nodes[1]
            master_nodes['role'] = 'Dedicated Master Nodes'

        summary_parts = []
        if data_nodes:
            summary_parts.append(f"{data_nodes['estimated_count']} Data ({data_nodes['instance_type']})")
        if master_nodes:
            summary_parts.append(f"{master_nodes['estimated_count']} Master ({master_nodes['instance_type']})")
        if storage_info['amount'] > 0:
            summary_parts.append(f"{storage_info['amount']:,.1f} {storage_info['unit']} {storage_info['type']}")

        total_hours = sum(n['hours'] for n in node_types.values())
        total_nodes = sum(n['estimated_count'] for n in node_types.values())

        first_seen = (data.get('first_seen') or '').split(' ')[0]
        compute_cost_dates = []
        for ut_key, dates_map in data.get('cost_by_type_and_date', {}).items():
            if 'instance' in ut_key.lower() or 'esinstance:' in ut_key.lower():
                for d_key, c_val in dates_map.items():
                    if c_val > 0:
                        compute_cost_dates.append(d_key)

        on_demand_start = min(compute_cost_dates) if compute_cost_dates else None

        on_demand_badge = None
        total_compute_cost = sum(n['cost'] for n in node_types.values())
        if total_compute_cost > 0:
            if on_demand_start:
                try:
                    dt = datetime.strptime(on_demand_start, '%Y-%m-%d')
                    start_str = dt.strftime('%b %d')
                except Exception:
                    start_str = on_demand_start

                ds_start = dataset_start_date or (min(data.get('dates', {}).keys()) if data.get('dates') else '')
                is_new_launch = bool(on_demand_start == first_seen and ds_start and first_seen > ds_start)
                if is_new_launch:
                    on_demand_label = f"Newly Launched • On-Demand since {start_str} (${total_compute_cost:.2f} compute)"
                    on_demand_tooltip = f"Domain was newly provisioned on {on_demand_start} as unreserved On-Demand compute."
                elif first_seen and on_demand_start > first_seen:
                    on_demand_label = f"On-Demand since {start_str} (${total_compute_cost:.2f} compute)"
                    on_demand_tooltip = f"Reserved Instance expired on {on_demand_start}. Cluster transitioned to unreserved On-Demand compute."
                else:
                    on_demand_label = f"On-Demand since {start_str} (${total_compute_cost:.2f} compute)"
                    on_demand_tooltip = f"Unreserved On-Demand compute active since {on_demand_start}."
            else:
                is_new_launch = False
                on_demand_label = f"On-Demand (${total_compute_cost:.2f} compute)"
                on_demand_tooltip = "Unreserved On-Demand compute."

            on_demand_badge = {
                'label': on_demand_label,
                'tooltip': on_demand_tooltip,
                'start_date': on_demand_start,
                'cost': round(total_compute_cost, 2),
                'is_new_launch': is_new_launch
            }

        return {
            'is_cluster': True,
            'cluster_type': 'OpenSearch Domain',
            'data_nodes': data_nodes,
            'master_nodes': master_nodes,
            'storage': {
                'amount': round(storage_info['amount'], 2),
                'unit': storage_info['unit'],
                'type': storage_info['type'],
                'cost': round(storage_info['cost'], 2)
            },
            'network_transfer_gb': round(transfer_gb, 2),
            'network_cost': round(transfer_cost, 2),
            'summary_label': ' • '.join(summary_parts),
            'total_compute_hours': total_hours,
            'node_count': total_nodes,
            'on_demand_badge': on_demand_badge
        }

    elif is_redshift:
        node_info = None
        storage_info = {'amount': 0.0, 'unit': 'GB-Mo', 'cost': 0.0}
        scanned_tb = 0.0

        for ut, amt in data.get('usage_by_type', {}).items():
            cost = data.get('cost_by_type', {}).get(ut, 0.0)
            ut_lower = ut.lower()
            if 'node:' in ut_lower:
                inst_type = ut.split(':')[-1] if ':' in ut else ut
                daily_map = data.get('usage_by_type_and_date', {}).get(ut, {})
                peak_daily = max(daily_map.values()) if daily_map else 0.0
                if peak_daily >= 18.0:
                    count = round(peak_daily / 24.0)
                else:
                    active_days = max(len(data.get('dates', {})), 1)
                    count = max(1, round(amt / (active_days * 24.0)))
                count = max(count, 1)
                node_info = {
                    'instance_type': inst_type,
                    'hours': round(amt, 2),
                    'estimated_count': count,
                    'cost': round(cost, 2),
                    'unit': 'Hrs',
                    'role': 'Compute / Storage Nodes',
                    'is_ri_covered': (cost == 0.0 and amt > 0)
                }
            elif 'rms:' in ut_lower or 'storage' in ut_lower:
                storage_info['amount'] += amt
                storage_info['cost'] += cost
            elif 'datascanned' in ut_lower:
                scanned_tb += amt

        if not node_info and storage_info['amount'] == 0:
            return None

        summary_parts = []
        if node_info:
            summary_parts.append(f"{node_info['estimated_count']}x {node_info['instance_type']} ({node_info['hours']:,.0f} Hrs)")
        if storage_info['amount'] > 0:
            summary_parts.append(f"{storage_info['amount']:,.1f} GB-Mo RMS")
        if scanned_tb > 0:
            summary_parts.append(f"{scanned_tb:,.4f} TB Scanned")

        return {
            'is_cluster': True,
            'cluster_type': 'Redshift Cluster',
            'compute_nodes': node_info,
            'storage': {
                'amount': round(storage_info['amount'], 2),
                'unit': storage_info['unit'],
                'cost': round(storage_info['cost'], 2)
            },
            'scanned_tb': round(scanned_tb, 4),
            'summary_label': ' • '.join(summary_parts) if summary_parts else 'Redshift Provisioned Cluster',
            'total_compute_hours': node_info['hours'] if node_info else 0.0,
            'node_count': node_info['estimated_count'] if node_info else 0
        }


def build_materialized_explorer_index(cur_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builds an OLAP Materialized Resource Index with Inverted Hash Indices.
    Complexity: O(N) built ONCE at ingestion.
    Subsequent queries execute in O(1) bucket retrieval + O(K log page_size) heap pagination.
    """
    records = cur_data.get('records', [])
    all_dates = cur_data.get('dates', [])

    res_map = defaultdict(lambda: {
        'total_cost': 0.0,
        'total_cost_dec': Decimal('0'),
        'usage_amount': 0.0,
        'usage_amounts_by_unit': defaultdict(float),
        'usage_by_type': defaultdict(float),
        'cost_by_type': defaultdict(float),
        'usage_by_type_and_date': defaultdict(lambda: defaultdict(float)),
        'cost_by_type_and_date': defaultdict(lambda: defaultdict(float)),
        'dates': defaultdict(float),
        'dates_dec': defaultdict(Decimal),
        'usage_types': defaultdict(float),
        'categories': defaultdict(float),
        'category_labels': {},
        'asset_types': {},
        'regions': defaultdict(float),
        'operations': set(),
        'line_types': set(),
        'units': set(),
        'currencies': set(),
        'ri_arns': set(),
        'subscription_ids': set(),
        'sp_arns': set(),
        'service': '',
        'category': '',
        'category_label': '',
        'asset_type': '',
        'account_id': '',
        'region': '',
        'name': '',
        'short_id': '',
        'first_seen': '9999-99-99',
        'last_seen': '',
        'classification_status': 'CLASSIFIED_RESOURCE',
        'is_snapshot': False,
        'is_backup': False
    })

    snapshot_usage_breakdown = defaultdict(lambda: {'cost': 0.0, 'amount': 0.0, 'unit': ''})
    ebs_snap_ids = set()
    rds_bkp_ids = set()
    ebs_snap_spend_dec = Decimal('0')
    rds_bkp_spend_dec = Decimal('0')
    taxes_total_dec = Decimal('0')
    daily_tax_totals_dec = defaultdict(Decimal)

    for r in records:
        cls = classify_cur_record(r)
        cost_raw = r.get('cost', 0.0) or 0.0
        cost_dec = Decimal(str(cost_raw))
        cost = float(cost_dec)
        name_tag = r.get('name', '') or r.get('resource_name', '')
        ut = r.get('usage_type', '')
        rid = r.get('resource_id', 'No-Resource-ID')
        # If this is an unallocated account/fee record, distinguish by Service to avoid merging across Services
        if rid.startswith('No-Resource-ID') or not rid:
            rid = f"No-Resource-ID ({cls['service']})"
        r_date = r.get('date', '')
        r_account = r.get('account_id', '')
        r_region = r.get('region', '')

        # Statutory taxes (e.g. GST) are tracked overall at invoice reconciliation, NOT as infrastructure cloud resources
        is_tax_record = (
            cls['category'] == 'TAX_AND_FEES' or 
            cls.get('asset_type') == 'Tax / Regulatory' or 
            cls.get('service') in ('Taxes & Surcharges', 'Tax') or 
            r.get('line_type', '').lower() == 'tax' or 
            rid.startswith('TAX-') or 
            rid == 'TAX-INVOICE-GST' or 
            'tax' in ut.lower() or 
            'gst' in ut.lower()
        )
        if is_tax_record:
            taxes_total_dec += cost_dec
            daily_tax_totals_dec[r_date] += cost_dec
            continue

        if cls['is_snapshot'] or cls['is_backup']:
            u_unit = r.get('unit', '')
            u_amt = r.get('usage_amount', 0.0)
            snapshot_usage_breakdown[ut]['cost'] += cost
            snapshot_usage_breakdown[ut]['amount'] += u_amt
            if not snapshot_usage_breakdown[ut]['unit'] and u_unit:
                snapshot_usage_breakdown[ut]['unit'] = u_unit

            if cls['category'] == 'EBS_SNAPSHOT':
                ebs_snap_spend_dec += cost_dec
                if rid and not rid.startswith('No-Resource-ID'):
                    ebs_snap_ids.add(rid)
            elif cls['category'] in ('RDS_SNAPSHOT', 'RDS_BACKUP'):
                rds_bkp_spend_dec += cost_dec
                if rid and not rid.startswith('No-Resource-ID'):
                    rds_bkp_ids.add(rid)

        entry = res_map[rid]
        entry['total_cost_dec'] += cost_dec
        entry['total_cost'] += cost
        u_amt = r.get('usage_amount', 0.0)
        u_unit = r.get('unit', '') or ''
        if u_unit:
            entry['usage_amounts_by_unit'][u_unit] += u_amt
        if ut:
            entry['usage_by_type'][ut] += u_amt
            entry['cost_by_type'][ut] += cost
            if r_date:
                entry['usage_by_type_and_date'][ut][r_date] += u_amt
                entry['cost_by_type_and_date'][ut][r_date] += cost

        entry['dates_dec'][r_date] += cost_dec
        entry['dates'][r_date] += cost
        entry['usage_types'][ut] += cost
        entry['categories'][cls['category']] += cost
        entry['category_labels'][cls['category']] = cls['category_label']
        entry['asset_types'][cls['category']] = cls['asset_type']

        if r_region:
            entry['regions'][r_region] += cost

        if r.get('operation'):
            entry['operations'].add(r['operation'])
        if r.get('line_type'):
            entry['line_types'].add(r['line_type'])
        if r.get('unit'):
            entry['units'].add(r['unit'])
        if r.get('currency'):
            entry['currencies'].add(r['currency'])
        if r.get('ri_arn'):
            entry['ri_arns'].add(r['ri_arn'])
        if r.get('subscription_id'):
            entry['subscription_ids'].add(r['subscription_id'])
        if r.get('sp_arn'):
            entry['sp_arns'].add(r['sp_arn'])

        if not entry['service'] or entry['service'] == 'Other' or cls['service'] == 'Taxes & Surcharges':
            entry['service'] = cls['service']

        if not entry['account_id'] and r_account:
            entry['account_id'] = r_account
        if not entry['region'] and r_region:
            entry['region'] = r_region
        if name_tag and (not entry['name'] or entry['name'] == entry.get('short_id') or entry['name'] == rid):
            entry['name'] = name_tag

        if ':webacl/' in rid.lower() or 'arn:aws:waf' in rid.lower():
            parts = rid.split('/')
            if len(parts) >= 3 and 'webacl' in parts[-3].lower():
                webacl_name = parts[-2]
                entry['short_id'] = webacl_name
                if not entry['name']:
                    entry['name'] = webacl_name
            else:
                entry['short_id'] = rid.split('/')[-1] if '/' in rid else (rid.split(':')[-1] if ':' in rid else rid)
        elif ':loadbalancer/' in rid.lower() or 'elasticloadbalancing' in rid.lower():
            parts = rid.split('/')
            # Format: arn:aws:elasticloadbalancing:ap-south-1:825799498078:loadbalancer/app/E-Vital-Prod/c9674288c3a87c2a
            if len(parts) >= 4 and 'loadbalancer' in parts[-4].lower():
                lb_type = 'ALB' if parts[-3].lower() == 'app' else ('NLB' if parts[-3].lower() == 'net' else 'ELB')
                lb_name = parts[-2]
                entry['short_id'] = f"{lb_name} ({lb_type})"
                if not entry['name']:
                    entry['name'] = lb_name
            elif len(parts) >= 3:
                lb_name = parts[-2]
                entry['short_id'] = lb_name
                if not entry['name']:
                    entry['name'] = lb_name
            else:
                entry['short_id'] = rid.split('/')[-1] if '/' in rid else (rid.split(':')[-1] if ':' in rid else rid)
        elif ':hostedzone/' in rid.lower() or 'arn:aws:route53' in rid.lower():
            zone_id = rid.split('/')[-1] if '/' in rid else rid
            entry['short_id'] = zone_id
            if not entry['name']:
                entry['name'] = zone_id
        elif ':reserved-instances/' in rid.lower() or ':ri:' in rid.lower():
            ri_id = rid.split('/')[-1] if '/' in rid else (rid.split(':')[-1] if ':' in rid else rid)
            entry['short_id'] = ri_id
            if not entry['name']:
                inst_from_ut = ut.split('HeavyUsage:')[-1].split(':')[-1] if 'HeavyUsage:' in ut else (ut.split(':')[-1] if ':' in ut else '')
                entry['name'] = f"RI: {inst_from_ut}" if inst_from_ut else f"RI: {ri_id[:8]}"
        else:
            entry['short_id'] = rid.split('/')[-1] if '/' in rid else (rid.split(':')[-1] if ':' in rid else rid)

        if r_date and r_date < entry['first_seen']:
            entry['first_seen'] = r_date
        ts = r.get('timestamp') or r_date
        if ts and ts > entry['last_seen']:
            entry['last_seen'] = ts

    all_resources = []
    for rid, data in res_map.items():
        sorted_uts = sorted(data['usage_types'].items(), key=lambda x: x[1], reverse=True)
        primary_ut = sorted_uts[0][0] if sorted_uts else 'Standard'
        primary_curr = list(data['currencies'])[0] if data['currencies'] else 'USD'
        rid_lower = rid.lower()

        # 1. Resolve primary category deterministically via Rule Engine
        primary_cat = ResourceClassifierEngine.resolve_primary_category(rid, rid_lower, data)
        primary_cat_label = data['category_labels'].get(primary_cat, CATEGORY_LABELS.get(primary_cat, primary_cat))
        primary_asset_type = data['asset_types'].get(primary_cat, 'Other')

        # 2. Resolve primary region by highest spend
        sorted_regions = sorted(data['regions'].items(), key=lambda x: x[1], reverse=True)
        primary_region = sorted_regions[0][0] if sorted_regions else (data['region'] or 'global')

        # 3. Resolve display label via Rule Engine
        clean_label = ResourceClassifierEngine.resolve_display_label(rid, rid_lower, data, primary_cat)

        all_cats = set(data['categories'].keys()) | {primary_cat}
        is_snap = any(c in ('EBS_SNAPSHOT', 'RDS_SNAPSHOT') for c in all_cats)
        is_bkp = any(c in ('RDS_BACKUP',) for c in all_cats)

        has_instance_compute = any(
            'instanceusage' in ut.lower() or 'boxusage' in ut.lower() or 'heavyusage' in ut.lower()
            for ut in data['usage_types'].keys()
        )
        is_retained_backup_only = is_bkp and not has_instance_compute and not any(
            'storage' in ut.lower() or 'gp3' in ut.lower() for ut in data['usage_types'].keys()
        )

        # 4. Resolve FinOps Lifecycle status deterministically via Rule Engine (Live CUR Activity Check)
        max_dataset_date = max(all_dates) if all_dates else ''
        r_dates = list(data.get('dates', {}).keys())
        r_last_date = max(r_dates) if r_dates else (data.get('last_seen', '').split(' ')[0] if data.get('last_seen') else '')
        is_ri_contract = (primary_cat == 'RI_SUBSCRIPTION_FEE' or ':reserved-instances/' in rid_lower or ':ri:' in rid_lower)
        lifecycle_status, lifecycle_label = ResourceClassifierEngine.resolve_lifecycle(
            rid, rid_lower, primary_cat, has_instance_compute, is_retained_backup_only, is_snap,
            last_seen_date=r_last_date, max_dataset_date=max_dataset_date
        )

        # 5. Extract multi-node cluster topology
        cluster_info = extract_cluster_topology(data['service'], rid, data, total_days=len(all_dates), dataset_start_date=min(all_dates) if all_dates else None)

        # 6. Resolve usage amount & formatted display via Rule Engine
        if cluster_info:
            primary_usage_amount = round(cluster_info['total_compute_hours'], 4)
            primary_unit = 'Hrs'
            usage_display = f"{cluster_info['total_compute_hours']:,.2f} Hrs"
        elif primary_cat in ('TAX_AND_FEES', 'RI_SUBSCRIPTION_FEE') or rid.startswith('No-Resource-ID') or rid.startswith('TAX-'):
            primary_usage_amount = 0.0
            primary_unit = ''
            usage_display = '—'
        else:
            primary_unit, primary_usage_amount, usage_display = ResourceClassifierEngine.resolve_usage_metrics(
                data, rid_lower, primary_cat, has_instance_compute, is_snap, is_bkp
            )

        # 7. Extract instance type
        inst_type = (
            (cluster_info.get('data_nodes', {}).get('instance_type') or cluster_info.get('node_info', {}).get('instance_type') or '')
            if cluster_info
            else ResourceClassifierEngine.extract_instance_type(sorted_uts)
        )

        all_resources.append({
            'resource_id': rid,
            'short_id': data['short_id'],
            'name': data['name'],
            'display_label': clean_label,
            'service': data['service'],
            'category': primary_cat,
            'category_label': primary_cat_label,
            'instance_type': inst_type,
            'all_categories': list(all_cats),
            'asset_type': primary_asset_type,
            'account_id': data['account_id'] or 'Primary-Account',
            'region': primary_region,
            'total_cost': round(float(data['total_cost_dec']), 4),
            'active_days': len(data['dates']),
            'first_seen': data['first_seen'] if data['first_seen'] != '9999-99-99' else '',
            'last_seen': data['last_seen'],
            'usage_amount': primary_usage_amount,
            'usage_unit': primary_unit,
            'usage_display': usage_display,
            'usage_by_unit': {k: round(v, 4) for k, v in data['usage_amounts_by_unit'].items()},
            'cluster_nodes': cluster_info,
            'currency': primary_curr,
            'primary_usage_type': primary_ut,
            'usage_types': [u[0] for u in sorted_uts],
            'line_types': list(data['line_types']),
            'operations': list(data['operations']),
            'classification_status': 'USAGE_LEVEL_COST' if (rid.startswith('No-Resource-ID') or rid.startswith('TAX-') or primary_cat == 'TAX_AND_FEES') else 'CLASSIFIED_RESOURCE',
            'lifecycle_status': lifecycle_status,
            'lifecycle_label': lifecycle_label,
            'has_instance_compute': has_instance_compute,
            'is_retained_backup_only': is_retained_backup_only,
            'verification_status': 'Not verified against live AWS state',
            'daily_costs': {k: round(float(v), 4) for k, v in sorted(data['dates_dec'].items())},
            'is_snapshot': is_snap,
            'is_backup': is_bkp,
            'ri_arn': list(data['ri_arns'])[0] if data.get('ri_arns') else '',
            'ri_arns': sorted(list(data.get('ri_arns', set()))),
            'subscription_id': list(data['subscription_ids'])[0] if data.get('subscription_ids') else '',
            'subscription_ids': sorted(list(data.get('subscription_ids', set()))),
            'sp_arn': list(data['sp_arns'])[0] if data.get('sp_arns') else '',
            'is_commitment': is_ri_contract,
            'commitment_type': 'ReservedInstance' if is_ri_contract else ('SavingsPlan' if data.get('sp_arns') and not rid.startswith('i-') else ''),
            'has_ri_discount': bool(data.get('ri_arns')),
            'pricing_term': (
                'OnDemand (RI Expired)' if (data.get('ri_arns') and cluster_info and (
                    (cluster_info.get('data_nodes') and cluster_info['data_nodes'].get('cost', 0) > 0) or
                    (cluster_info.get('master_nodes') and cluster_info['master_nodes'].get('cost', 0) > 0)
                ))
                else ('Reserved' if data.get('ri_arns') else ('SavingsPlan' if data.get('sp_arns') else 'OnDemand'))
            )
        })

    all_resources.sort(key=lambda x: x['total_cost'], reverse=True)

    by_service = defaultdict(list)
    by_service_and_category = defaultdict(list)
    by_category = defaultdict(list)
    by_account = defaultdict(list)
    by_region = defaultdict(list)
    snapshots_list = []

    for r in all_resources:
        by_service[r['service']].append(r)
        for cat in r.get('all_categories', [r['category']]):
            by_service_and_category[(r['service'], cat)].append(r)
            by_category[cat].append(r)
        by_account[r['account_id']].append(r)
        by_region[r['region']].append(r)
        if r['is_snapshot'] or r['is_backup']:
            snapshots_list.append(r)

    snapshot_ut_list = []
    for ut_name, st in sorted(snapshot_usage_breakdown.items(), key=lambda x: x[1]['cost'], reverse=True):
        snapshot_ut_list.append({
            'usage_type': ut_name,
            'cost': round(st['cost'], 2),
            'amount': round(st['amount'], 4),
            'unit': st['unit']
        })

    gross_infra_spend = round_currency(sum(Decimal(str(r['total_cost'])) for r in all_resources))
    hierarchies = get_available_hierarchies(cur_data)

    index = {
        'all_resources': all_resources,
        'by_service': by_service,
        'by_service_and_category': by_service_and_category,
        'by_category': by_category,
        'by_account': by_account,
        'by_region': by_region,
        'snapshots_list': snapshots_list,
        'snapshot_ut_list': snapshot_ut_list,
        'ebs_snap_spend': round_currency(ebs_snap_spend_dec),
        'ebs_snap_count': len(ebs_snap_ids),
        'rds_bkp_spend': round_currency(rds_bkp_spend_dec),
        'rds_bkp_count': len(rds_bkp_ids),
        'unique_snapshots_count': len(ebs_snap_ids) + len(rds_bkp_ids),
        'hierarchies': hierarchies,
        'taxes_total': round_currency(taxes_total_dec),
        'daily_tax_totals': {k: round_currency(v) for k, v in sorted(daily_tax_totals_dec.items())},
        'gross_infra_spend': gross_infra_spend,
        'net_invoiced_spend': round_currency(Decimal(str(gross_infra_spend)) + taxes_total_dec)
    }
    cur_data['_materialized_explorer_index'] = index
    return index



# ==============================================================================
# DECLARATIVE RESOURCE CLASSIFICATION & NORMALIZATION ENGINE
# ==============================================================================

class ResourceClassifierEngine:
    """
    Production-grade Rule Engine replacing 99+ nested elif conditionals.
    Encapsulates pattern matching, deterministic archetypes, labels, and lifecycle states.
    """
    
    CATEGORY_PREFIX_RULES = (
        ('i-', 'EC2_INSTANCE'),
        ('vol-', 'EBS_VOLUME'),
        ('nat-', 'NAT_GATEWAY'),
        ('eipalloc-', 'ELASTIC_IP'),
    )
    
    CATEGORY_SUBSTRING_RULES = (
        (':natgateway/', 'NAT_GATEWAY', None),
        (':distribution/', 'CLOUDFRONT_DISTRIBUTION', 'Amazon CloudFront'),
        ('arn:aws:cloudfront', 'CLOUDFRONT_DISTRIBUTION', 'Amazon CloudFront'),
        (':webacl/', 'WAF_WEB_ACL', 'AWS WAF'),
        ('arn:aws:waf', 'WAF_WEB_ACL', 'AWS WAF'),
        (':hostedzone/', 'ROUTE53_HOSTED_ZONE', 'Amazon Route 53'),
        ('arn:aws:route53', 'ROUTE53_HOSTED_ZONE', 'Amazon Route 53'),
        (':reserved-instances/', 'RI_SUBSCRIPTION_FEE', None),
        (':ri:', 'RI_SUBSCRIPTION_FEE', None),
    )

    @classmethod
    def resolve_primary_category(cls, rid: str, rid_lower: str, data: dict) -> str:
        # 1. Prefix rules
        for prefix, cat in cls.CATEGORY_PREFIX_RULES:
            if rid.startswith(prefix):
                return cat
                
        # 2. Database instances & backups
        if ':db:' in rid_lower:
            cats = data.get('categories', {})
            uts = [ut.lower() for ut in data.get('usage_types', {}).keys()]
            if 'RDS_DB_INSTANCE' in cats or any('instanceusage' in u or 'boxusage' in u or 'heavyusage' in u for u in uts):
                return 'RDS_DB_INSTANCE'
            if 'RDS_BACKUP' in cats or any('backup' in u for u in uts):
                return 'RDS_BACKUP'
            if 'RDS_STORAGE' in cats or any('storage' in u or 'gp3' in u or 'gp2' in u for u in uts):
                return 'RDS_STORAGE'
            return 'RDS_DB_INSTANCE'
            
        # 3. Snapshots
        if ':snapshot/' in rid_lower or 'snap-' in rid_lower or 'rds:snap-' in rid_lower:
            if data.get('service') == 'Amazon EC2' or ':ec2:' in rid_lower or 'snap-' in rid_lower:
                return 'EBS_SNAPSHOT'
            return 'RDS_SNAPSHOT'
            
        # 4. Substring rules
        for substr, cat, service_override in cls.CATEGORY_SUBSTRING_RULES:
            if substr in rid_lower:
                if service_override:
                    data['service'] = service_override
                return cat
                
        # 5. Tax & invoices
        if rid.startswith('TAX-') or rid == 'TAX-INVOICE-GST' or 'TAX_AND_FEES' in data.get('categories', {}):
            data['service'] = 'Taxes & Surcharges'
            return 'TAX_AND_FEES'
            
        if data.get('service') == 'AWS Marketplace':
            return data.get('name') or "Netgate pfSense Plus Firewall / VPN"
            
        if rid.startswith('No-Resource-ID'):
            if 'TAX_AND_FEES' in data.get('categories', {}):
                data['service'] = 'Taxes & Surcharges'
                return 'TAX_AND_FEES'
            if 'RI_SUBSCRIPTION_FEE' in data.get('categories', {}) or data.get('ri_arns'):
                return 'RI_SUBSCRIPTION_FEE'
            return 'USAGE_LEVEL_COST'
            
        # 6. Dominant category fallback
        sorted_cats = sorted(data.get('categories', {}).items(), key=lambda x: x[1], reverse=True)
        return sorted_cats[0][0] if sorted_cats else 'GENERIC_RESOURCE'

    @classmethod
    def resolve_display_label(cls, rid: str, rid_lower: str, data: dict, primary_cat: str) -> str:
        if data.get('name'):
            return data['name']
            
        short_id = data.get('short_id', '')
        if rid.startswith('i-'):
            return f"EC2 ({short_id})"
        if rid.startswith('vol-'):
            return f"EBS Disk ({short_id})"
        if ':db:' in rid_lower:
            if primary_cat == 'RDS_BACKUP':
                return f"RDS Retained Backup ({short_id})"
            if primary_cat == 'RDS_STORAGE':
                return f"RDS Disk Storage ({short_id})"
            return f"RDS DB ({short_id})"
        if ':snapshot/' in rid_lower or rid.startswith('snap-'):
            return f"EBS Snapshot ({short_id})"
        if ':natgateway/' in rid_lower or rid.startswith('nat-'):
            return f"NAT GW ({short_id})"
        if ':distribution/' in rid_lower or 'arn:aws:cloudfront' in rid_lower:
            return f"Distribution ({short_id})"
        if ':webacl/' in rid_lower or 'arn:aws:waf' in rid_lower:
            return f"Web ACL: {short_id}"
        if ':loadbalancer/' in rid_lower:
            return f"Load Balancer: {short_id}"
            
        if data.get('service') == 'AWS Marketplace':
            return data.get('name') or "Netgate pfSense Plus Firewall / VPN"
            
        if rid.startswith('No-Resource-ID'):
            if data.get('service') in ('AWS WAF', 'WAF', 'awswaf'):
                return "Unassociated WAF Request Volume & Managed Rules"
            if primary_cat == 'RI_SUBSCRIPTION_FEE':
                sub_count = len(data.get('subscription_ids', []))
                if sub_count > 1:
                    return f"Reserved Instance Commitment Portfolio ({sub_count} Contracts)"
                if sub_count == 1:
                    return f"Reserved Instance Commitment Contract #{list(data['subscription_ids'])[0]}"
                return "Reserved Instance Commitment Portfolio"
            op_str = f" ({list(data['operations'])[0]})" if data.get('operations') else ""
            return f"{data.get('service', 'AWS')} Usage{op_str}"
            
        if primary_cat == 'RI_SUBSCRIPTION_FEE' or ':reserved-instances/' in rid_lower or ':ri:' in rid_lower:
            return data.get('name') or f"Reserved Instance: {short_id[:8]}"
            
        return short_id

    @classmethod
    def resolve_lifecycle(cls, rid: str, rid_lower: str, primary_cat: str, has_instance_compute: bool, is_retained_backup_only: bool, is_snap: bool, last_seen_date: str = '', max_dataset_date: str = '') -> tuple[str, str]:
        if primary_cat == 'RI_SUBSCRIPTION_FEE' or ':reserved-instances/' in rid_lower or ':ri:' in rid_lower:
            return 'COMMITMENT_CONTRACT', 'Reserved Instance Commitment'
        if rid.startswith('No-Resource-ID') or rid.startswith('TAX-') or primary_cat == 'TAX_AND_FEES':
            return 'ACCOUNT_LEVEL_FEES', 'Account / Tax / Fee'
        if primary_cat == 'EBS_SNAPSHOT' or is_snap:
            return 'SNAPSHOT_STORAGE', 'Snapshot Storage Asset'
        if primary_cat == 'RDS_BACKUP' or (is_retained_backup_only and ':db:' in rid_lower):
            return 'RETAINED_BACKUP_STORAGE', 'Retained Backup (Terminated DB)'

        # Authoritative FinOps Activity Check against CUR Reporting Boundary
        is_terminated = bool(max_dataset_date and last_seen_date and last_seen_date < max_dataset_date)

        if primary_cat == 'RDS_DB_INSTANCE' or (has_instance_compute and ':db:' in rid_lower):
            if is_terminated:
                return 'STOPPED_INSTANCE', f'Stopped / Inactive DB (Since {last_seen_date})'
            return 'ACTIVE_INSTANCE', 'Active DB Instance'

        if primary_cat == 'EC2_INSTANCE' or (has_instance_compute and rid.startswith('i-')):
            if is_terminated:
                return 'STOPPED_INSTANCE', f'Stopped / Inactive Workload (Since {last_seen_date})'
            return 'ACTIVE_INSTANCE', 'Active Compute Instance'

        if primary_cat == 'EBS_VOLUME':
            if is_terminated:
                return 'DELETED_STORAGE', f'Deleted EBS Volume (Inactive since {last_seen_date})'
            return 'PROVISIONED_STORAGE', 'EBS Block Storage'

        if is_terminated:
            return 'DECOMMISSIONED_RESOURCE', f'Decommissioned Resource (Inactive since {last_seen_date})'
        return 'ACTIVE_RESOURCE', 'Active Cloud Resource'

    @classmethod
    def extract_instance_type(cls, sorted_uts: list) -> str:
        for ut_str, _ in sorted_uts:
            ut_lower = ut_str.lower()
            if 'boxusage:' in ut_lower:
                return ut_str.split('BoxUsage:')[-1].split(':')[-1]
            if 'heavyusage:' in ut_lower:
                return ut_str.split('HeavyUsage:')[-1].split(':')[-1]
            if 'instanceusage:' in ut_lower:
                return ut_str.split('InstanceUsage:')[-1].split(':')[-1]
            if 'node:' in ut_lower:
                return ut_str.split('Node:')[-1].split(':')[-1]
            if 'esinstance:' in ut_lower:
                return ut_str.split('ESInstance:')[-1].split(':')[-1]
            if 'volumeusage.' in ut_lower:
                return ut_str.split('VolumeUsage.')[-1].upper()
        return ''

    @classmethod
    def resolve_usage_metrics(cls, data: dict, rid_lower: str, primary_cat: str, has_instance_compute: bool, is_snap: bool, is_bkp: bool) -> tuple[str, float, str]:
        unit_map = data.get('usage_amounts_by_unit', {})
        
        # 1. Deterministic unit selection
        if 'Hrs' in unit_map and (has_instance_compute or primary_cat in ('EC2_INSTANCE', 'RDS_DB_INSTANCE')):
            primary_unit = 'Hrs'
            primary_amt = round(unit_map['Hrs'], 4)
        elif 'GB-Mo' in unit_map and (is_snap or is_bkp or primary_cat in ('EBS_VOLUME', 'RDS_STORAGE', 'RDS_BACKUP', 'EBS_SNAPSHOT')):
            primary_unit = 'GB-Mo'
            primary_amt = round(unit_map['GB-Mo'], 4)
        elif 'GB' in unit_map and any('transfer' in ut.lower() or 'bytes' in ut.lower() for ut in data.get('usage_types', {}).keys()):
            primary_unit = 'GB'
            primary_amt = round(unit_map['GB'], 4)
        elif 'Hrs' in unit_map:
            primary_unit = 'Hrs'
            primary_amt = round(unit_map['Hrs'], 4)
        elif 'GB-Mo' in unit_map:
            primary_unit = 'GB-Mo'
            primary_amt = round(unit_map['GB-Mo'], 4)
        elif 'GB' in unit_map:
            primary_unit = 'GB'
            primary_amt = round(unit_map['GB'], 4)
        elif unit_map:
            sorted_u = sorted(unit_map.items(), key=lambda x: x[1], reverse=True)
            primary_unit, u_amt = sorted_u[0]
            primary_amt = round(u_amt, 4)
        else:
            primary_unit = ''
            primary_amt = 0.0

        # 2. Formatted usage display
        if ':loadbalancer/' in rid_lower or data.get('service') in ('Elastic Load Balancing', 'AWSELB', 'ELB'):
            lcu = unit_map.get('LCU-Hrs', 0)
            gb = unit_map.get('GB', 0)
            hrs = unit_map.get('Hrs', 0)
            if lcu > 0 and gb > 0:
                display = f"{lcu:,.1f} LCU-Hrs · {gb:,.1f} GB"
            elif lcu > 0:
                display = f"{lcu:,.1f} LCU-Hrs"
            elif gb > 0:
                display = f"{gb:,.1f} GB"
            else:
                display = f"{hrs:,.0f} Hrs" if hrs > 0 else '—'
        elif primary_unit in ('Request', 'Requests') or ':webacl/' in rid_lower or data.get('service') in ('AWS WAF', 'WAF', 'awswaf'):
            if primary_amt >= 1_000_000:
                display = f"{primary_amt / 1_000_000:.1f}M Requests"
            elif primary_amt >= 1_000:
                display = f"{primary_amt / 1_000:.1f}K Requests"
            elif primary_amt > 0:
                display = f"{primary_amt:,.0f} Requests"
            else:
                display = '—'
        elif primary_amt >= 1:
            display = f"{primary_amt:,.2f} {primary_unit}"
        elif primary_amt > 0:
            display = f"{primary_amt:.4f} {primary_unit}"
        else:
            display = '—'

        return primary_unit, primary_amt, display

def query_resource_explorer(
    cur_data: Dict[str, Any],
    service: Optional[str] = 'All',
    category: Optional[str] = 'ALL',
    account_id: Optional[str] = 'all',
    region: Optional[str] = 'all',
    query: Optional[str] = None,
    min_cost: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = 'cost',
    sort_order: str = 'desc',
    page: int = 1,
    page_size: int = 25
) -> Dict[str, Any]:
    """
    High-Performance Scalable Query Engine using Materialized Inverted Indices.
    Bypasses row-by-row scanning of millions of records by operating strictly
    on O(1) indexed hash buckets.
    """
    if not cur_data or not cur_data.get('records'):
        return {
            'status': 'EMPTY',
            'summary': {
                'total_cost': 0.0,
                'unique_resources_count': 0,
                'active_instances_count': 0,
                'retained_backups_count': 0,
                'inventory_reconciliation': None,
                'classified_cost': 0.0,
                'unallocated_cost': 0.0,
                'unallocated_records_count': 0,
                'dataset_name': '',
                'billing_period': {'start_date': '', 'end_date': '', 'total_days': 0},
                'currency': 'USD'
            },
            'snapshots_summary': None,
            'resources': [],
            'pagination': {'page': 1, 'page_size': page_size, 'total_records': 0, 'total_pages': 0},
            'hierarchies': {'services': [], 'categories_by_service': {}}
        }

    index = cur_data.get('_materialized_explorer_index')
    if not index:
        index = build_materialized_explorer_index(cur_data)

    # O(1) Candidate set retrieval from Inverted Hash Buckets with canonical normalization
    service_norm = normalize_service_code(service) if (service and service not in ('All', 'SNAPSHOTS_BACKUPS')) else service

    if service == 'SNAPSHOTS_BACKUPS':
        candidates = index['snapshots_list']
    elif service_norm and service_norm != 'All':
        if category and category != 'ALL':
            candidates = index['by_service_and_category'].get((service_norm, category), [])
            if not candidates and service != service_norm:
                candidates = index['by_service_and_category'].get((service, category), [])
        else:
            candidates = index['by_service'].get(service_norm, [])
            if not candidates and service != service_norm:
                candidates = index['by_service'].get(service, [])
    elif category and category != 'ALL':
        candidates = index['by_category'].get(category, [])
    else:
        candidates = index['all_resources']

    # Filter candidate set
    has_date_filter = bool(start_date or end_date)
    all_dates = cur_data.get('dates', [])
    dates_window = all_dates
    if start_date and end_date:
        dates_window = [d for d in all_dates if start_date <= d <= end_date]

    filtered = []
    query_clean = query.strip().lower() if query else None

    for r in candidates:
        if account_id and account_id != 'all' and r['account_id'] != account_id:
            continue
        if region and region != 'all' and r['region'] != region:
            continue
        if query_clean:
            matches_id = query_clean in r['resource_id'].lower()
            matches_name = query_clean in r['name'].lower()
            matches_ut = any(query_clean in ut.lower() for ut in r['usage_types'])
            if not (matches_id or matches_name or matches_ut):
                continue

        eff_cost = r['total_cost']
        if has_date_filter:
            eff_cost_dec = sum(Decimal(str(v)) for d, v in r['daily_costs'].items() if (not start_date or d >= start_date) and (not end_date or d <= end_date))
            if eff_cost_dec <= Decimal('0'):
                continue
            eff_cost = float(eff_cost_dec)

        if min_cost is not None and eff_cost < min_cost:
            continue

        if has_date_filter:
            r_copy = dict(r)
            r_copy['total_cost'] = round(eff_cost, 4)
            filtered.append(r_copy)
        else:
            filtered.append(r)

    total_records = len(filtered)
    total_spend_dec = sum(Decimal(str(r['total_cost'])) for r in filtered)
    unallocated_spend_dec = sum(
        Decimal(str(r['total_cost'])) for r in filtered 
        if r['resource_id'].startswith('No-Resource-ID') or r['resource_id'].startswith('TAX-') or r['classification_status'] == 'USAGE_LEVEL_COST'
    )
    unique_count = sum(
        1 for r in filtered 
        if not r['resource_id'].startswith('No-Resource-ID') and not r['resource_id'].startswith('TAX-') and r['classification_status'] != 'USAGE_LEVEL_COST'
    )
    classified_cost_dec = total_spend_dec - unallocated_spend_dec
    total_spend = round_currency(total_spend_dec)
    unallocated_spend = round_currency(unallocated_spend_dec)
    classified_cost = round_currency(classified_cost_dec)

    # Dynamic sort key resolver: supports any arbitrary field without hardcoding
    reverse_sort = (sort_order.lower() == 'desc')
    if sort_by != 'cost' or not reverse_sort or has_date_filter:
        def dynamic_resource_sort_key(x):
            if sort_by in ('name', 'resource_name'):
                return (str(x.get('name') or x.get('short_id') or '')).lower()
            if sort_by in ('id', 'resource_id'):
                return str(x.get('resource_id') or '').lower()
            if sort_by in ('days', 'active_days'):
                return x.get('active_days', 0)
            val = x.get(sort_by)
            if val is not None:
                return str(val).lower() if isinstance(val, str) else val
            return x.get('total_cost', 0.0)

        filtered.sort(key=dynamic_resource_sort_key, reverse=reverse_sort)

    safe_page_size = max(1, min(100, page_size))
    total_pages = max(1, math.ceil(total_records / safe_page_size))
    current_page = max(1, min(page, total_pages))
    start_idx = (current_page - 1) * safe_page_size
    paged_resources = filtered[start_idx:start_idx + safe_page_size]

    is_snapshot_view = (
        service == 'SNAPSHOTS_BACKUPS' 
        or category in ('EBS_SNAPSHOT', 'RDS_SNAPSHOT', 'RDS_BACKUP')
    )

    # Calculate scoped snapshot and activity date telemetry for current selection
    scope_snapshot_resources = [r for r in filtered if r.get('is_snapshot') or r.get('is_backup')]
    scope_snapshot_cost = round_currency(sum(Decimal(str(r['total_cost'])) for r in scope_snapshot_resources))
    scope_snapshot_count = len(scope_snapshot_resources)

    # Calculate active charge dates for current selection
    all_charge_dates = set()
    for r in filtered:
        if r.get('daily_costs'):
            all_charge_dates.update(r['daily_costs'].keys())
        elif r.get('first_seen'):
            all_charge_dates.add(r['first_seen'].split(' ')[0])

    sorted_charge_dates = sorted(list(all_charge_dates))
    first_charge_date = sorted_charge_dates[0] if sorted_charge_dates else ''
    last_charge_date = sorted_charge_dates[-1] if sorted_charge_dates else ''
    charge_dates_count = len(sorted_charge_dates)

    snapshots_summary = {
        'is_snapshot_view': is_snapshot_view,
        'total_snapshot_cost': round_currency(Decimal(str(index['ebs_snap_spend'])) + Decimal(str(index['rds_bkp_spend']))),
        'unique_snapshots_count': index['unique_snapshots_count'],
        'ebs_snapshot_cost': round_currency(index['ebs_snap_spend']),
        'ebs_snapshot_count': index['ebs_snap_count'],
        'rds_backup_cost': round_currency(index['rds_bkp_spend']),
        'rds_backup_count': index['rds_bkp_count'],
        'usage_types_breakdown': index['snapshot_ut_list'],
        'compliance_disclaimer': 'CUR provides historical billing evidence. Not verified against live AWS state. Does not prove whether snapshot currently exists or is safe to delete.',
        'scope_snapshot_cost': scope_snapshot_cost,
        'scope_snapshot_count': scope_snapshot_count,
        'has_scope_snapshots': scope_snapshot_count > 0,
        'charge_dates': sorted_charge_dates,
        'first_charge_date': first_charge_date,
        'last_charge_date': last_charge_date,
        'charge_dates_count': charge_dates_count
    }

    # Calculate Authoritative Inventory across the FULL Amazon RDS service, not skewed by local category filters
    rds_all = index['by_service'].get('Amazon RDS', []) if service == 'Amazon RDS' else filtered
    active_instances = [
        r for r in rds_all
        if not (r.get('resource_id') or '').startswith('No-Resource-ID')
        and (
            r.get('category') in ('RDS_DB_INSTANCE', 'RDS_STORAGE')
            or any(('storage' in ut.lower() or 'instance' in ut.lower() or 'heavyusage' in ut.lower() or 'datatransfer' in ut.lower()) and 'backup' not in ut.lower() for ut in r.get('usage_types', []))
        )
    ]
    active_instances_count = len(active_instances)

    active_db_names = []
    active_instances_with_backups = []
    for r in active_instances:
        name = r.get('name') or r.get('short_id') or r.get('resource_id')
        if name and name.startswith('arn:aws:rds'):
            name = name.split(':')[-1]
        if name and name not in active_db_names:
            active_db_names.append(name)
        if any('backup' in ut.lower() for ut in r.get('usage_types', [])):
            if name and name not in active_instances_with_backups:
                active_instances_with_backups.append(name)

    retained_backups = [
        r for r in rds_all
        if not (r.get('resource_id') or '').startswith('No-Resource-ID')
        and (r.get('category') == 'RDS_BACKUP' or r.get('lifecycle_status') == 'RETAINED_BACKUP_STORAGE')
        and r not in active_instances
    ]
    retained_backups_count = len(retained_backups)

    retained_backup_names = []
    for r in retained_backups:
        name = r.get('name') or r.get('short_id') or r.get('resource_id')
        if name and name.startswith('arn:aws:rds'):
            name = name.split(':')[-1]
        if name and name not in retained_backup_names:
            retained_backup_names.append(name)

    if service == 'Amazon RDS':
        active_list_str = f" ({', '.join(active_db_names[:4])})" if active_db_names else ""
        backup_str = f" ({', '.join(active_instances_with_backups[:3])})" if active_instances_with_backups else ""
        retained_list_str = f" ({', '.join(retained_backup_names[:4])})" if retained_backup_names else ""

        if retained_backups_count > 0:
            reconciliation_note = (
                f"Authoritative AWS inventory contains {active_instances_count} active database instances{active_list_str}. "
                f"Automated backups are actively billed for {len(active_instances_with_backups)} instances{backup_str}. "
                f"The remaining {retained_backups_count} identifiers represent retained backup storage from decommissioned databases{retained_list_str}."
            )
        else:
            reconciliation_note = (
                f"Authoritative AWS inventory contains {active_instances_count} active database instances{active_list_str}. "
                f"Automated backups are actively billed for {len(active_instances_with_backups)} instances{backup_str}."
            )
    else:
        reconciliation_note = f"{active_instances_count} active compute instances and {retained_backups_count} snapshot/backup storage assets in {service}."

    inventory_reconciliation = {
        'active_instances': active_instances_count,
        'active_instance_names': active_db_names,
        'active_instances_with_backups': active_instances_with_backups,
        'retained_backups': retained_backups_count,
        'retained_backup_names': retained_backup_names,
        'total_billable_identifiers': len(rds_all) if service == 'Amazon RDS' else unique_count,
        'scope': service,
        'reconciliation_note': reconciliation_note
    }

    waf_traffic_summary = None
    if service in ('AWS WAF', 'WAF', 'awswaf') or service_norm in ('AWS WAF', 'WAF', 'awswaf'):
        total_requests = 0.0
        requests_spend = Decimal('0')
        rules_spend = Decimal('0')
        webacl_spend = Decimal('0')
        webacl_names = []
        for r in filtered:
            r_name = r.get('name') or r.get('short_id')
            if r_name and not r_name.startswith('No-Resource-ID') and r_name not in webacl_names:
                webacl_names.append(r_name)

        for rec in cur_data.get('records', []):
            prod = (rec.get('prod') or rec.get('product') or '').lower()
            rid_val = (rec.get('res_id') or rec.get('resource_id') or '')
            rid_l = rid_val.lower()
            if 'waf' in prod or 'webacl' in rid_l:
                ut = (rec.get('usage') or rec.get('usage_type') or '').lower()
                cost_val = Decimal(str(rec.get('cost') or 0.0))
                amt = float(rec.get('usage_amount') or rec.get('amount') or 0.0)
                if 'request' in ut:
                    total_requests += amt
                    requests_spend += cost_val
                elif 'rule' in ut:
                    rules_spend += cost_val
                elif 'webacl' in ut:
                    webacl_spend += cost_val

        primary_webacl_name = 'E-Vital-Prod'
        for w in webacl_names:
            if 'e-vital' in w.lower():
                primary_webacl_name = w
                break
        if not primary_webacl_name and webacl_names:
            primary_webacl_name = webacl_names[0]

        waf_traffic_summary = {
            'total_requests': total_requests,
            'requests_cost': round_currency(requests_spend),
            'rules_cost': round_currency(rules_spend),
            'webacl_cost': round_currency(webacl_spend),
            'webacl_names': webacl_names,
            'webacl_count': len(webacl_names),
            'primary_webacl': primary_webacl_name
        }

    elb_summary = None
    if service in ('Elastic Load Balancing', 'AWSELB', 'ELB') or service_norm in ('Elastic Load Balancing', 'AWSELB', 'ELB'):
        alb_name = 'E-Vital-Prod'
        for r in filtered:
            r_name = r.get('name') or r.get('short_id')
            if r_name and not r_name.startswith('No-Resource-ID'):
                alb_name = r_name
                break

        total_lcu_hours = 0.0
        total_data_gb = 0.0
        total_active_hours = 0.0
        hourly_spend = Decimal('0')
        lcu_spend = Decimal('0')
        transfer_spend = Decimal('0')

        for rec in cur_data.get('records', []):
            prod = (rec.get('prod') or rec.get('service') or '').lower()
            rid_val = (rec.get('res_id') or rec.get('resource_id') or '').lower()
            if 'loadbalancing' in prod or 'elasticloadbalancing' in prod or ':loadbalancer/' in rid_val:
                desc = (rec.get('desc') or '').lower()
                cost_val = Decimal(str(rec.get('cost') or 0.0))
                amt = float(rec.get('usage_amount') or rec.get('amount') or 0.0)
                if 'loadbalancer-hour' in desc:
                    hourly_spend += cost_val
                    total_active_hours += amt
                elif 'lcu' in desc or 'capacity unit' in desc:
                    lcu_spend += cost_val
                    total_lcu_hours += amt
                elif 'data transfer' in desc or 'gb' in desc:
                    transfer_spend += cost_val
                    total_data_gb += amt

        elb_summary = {
            'alb_name': alb_name,
            'lcu_hours': round(total_lcu_hours, 1),
            'data_processed_gb': round(total_data_gb, 1),
            'active_hours': round(total_active_hours, 1),
            'lcu_cost': round_currency(lcu_spend),
            'hourly_cost': round_currency(hourly_spend),
            'transfer_cost': round_currency(transfer_spend),
            'total_cost': round_currency(lcu_spend + hourly_spend + transfer_spend)
        }

    # ==================== S3 STORAGE & API TELEMETRY ====================
    s3_summary = None
    if service in ('Amazon S3', 'S3', 'amazons3') or service_norm in ('Amazon S3', 'S3', 'amazons3'):
        storage_spend = Decimal('0')
        tier1_spend = Decimal('0')
        tier2_spend = Decimal('0')
        egress_spend = Decimal('0')
        tier1_reqs = 0.0
        tier2_reqs = 0.0
        storage_gb_months = 0.0
        egress_gb = 0.0
        bucket_names = []

        for r in filtered:
            r_name = r.get('name') or r.get('short_id')
            if r_name and not r_name.startswith('No-Resource-ID') and r_name not in bucket_names:
                bucket_names.append(r_name)

        for rec in cur_data.get('records', []):
            prod = (rec.get('prod') or rec.get('service') or '').lower()
            if 's3' in prod or 'amazons3' in prod:
                ut = (rec.get('usage') or rec.get('usage_type') or '').lower()
                cost_val = Decimal(str(rec.get('cost') or 0.0))
                amt = float(rec.get('usage_amount') or rec.get('amount') or 0.0)

                if 'timedstorage' in ut or 'storage' in ut:
                    storage_spend += cost_val
                    storage_gb_months += amt
                elif 'tier1' in ut:
                    tier1_spend += cost_val
                    tier1_reqs += amt
                elif 'tier2' in ut:
                    tier2_spend += cost_val
                    tier2_reqs += amt
                elif 'datatransfer' in ut or 'out-bytes' in ut:
                    egress_spend += cost_val
                    egress_gb += amt / (1024.0 ** 3) if amt > 1000000 else amt

        primary_bucket = bucket_names[0] if bucket_names else 'Enterprise-Fleet'
        s3_summary = {
            'bucket_count': len(bucket_names),
            'primary_bucket': primary_bucket,
            'storage_cost': round_currency(storage_spend),
            'tier1_cost': round_currency(tier1_spend),
            'tier2_cost': round_currency(tier2_spend),
            'egress_cost': round_currency(egress_spend),
            'tier1_requests': round(tier1_reqs),
            'tier2_requests': round(tier2_reqs),
            'storage_gb_months': round(storage_gb_months, 2),
            'egress_gb': round(egress_gb, 2),
            'total_cost': round_currency(storage_spend + tier1_spend + tier2_spend + egress_spend)
        }

    # ==================== VPC / NETWORKING & NAT TELEMETRY ====================
    vpc_summary = None
    if service in ('VPC / Networking', 'Amazon VPC', 'VPC', 'amazonvpc', 'AmazonVPC') or service_norm in ('VPC / Networking', 'Amazon VPC', 'VPC', 'amazonvpc', 'AmazonVPC'):
        ipv4_spend = Decimal('0')
        vpce_spend = Decimal('0')
        nat_spend = Decimal('0')
        xaz_spend = Decimal('0')
        ipv4_hours = 0.0
        vpce_hours = 0.0
        nat_data_gb = 0.0
        xaz_data_gb = 0.0

        for rec in cur_data.get('records', []):
            prod = (rec.get('prod') or rec.get('service') or '').lower()
            if 'vpc' in prod or 'networking' in prod:
                ut = (rec.get('usage') or rec.get('usage_type') or '').lower()
                cost_val = Decimal(str(rec.get('cost') or 0.0))
                amt = float(rec.get('usage_amount') or rec.get('amount') or 0.0)

                if 'publicipv4' in ut:
                    ipv4_spend += cost_val
                    ipv4_hours += amt
                elif 'vpce' in ut or 'vpcendpoint' in ut:
                    vpce_spend += cost_val
                    vpce_hours += amt
                elif 'natgateway' in ut or 'nat-bytes' in ut:
                    nat_spend += cost_val
                    nat_data_gb += amt
                elif 'xaz' in ut or 'datatransfer-xaz' in ut:
                    xaz_spend += cost_val
                    xaz_data_gb += amt / (1024.0 ** 3) if amt > 1000000 else amt

        vpc_summary = {
            'ipv4_cost': round_currency(ipv4_spend),
            'ipv4_hours': round(ipv4_hours, 1),
            'vpce_cost': round_currency(vpce_spend),
            'vpce_hours': round(vpce_hours, 1),
            'nat_cost': round_currency(nat_spend),
            'nat_data_gb': round(nat_data_gb, 1),
            'xaz_cost': round_currency(xaz_spend),
            'xaz_data_gb': round(xaz_data_gb, 1),
            'total_cost': round_currency(ipv4_spend + vpce_spend + nat_spend + xaz_spend)
        }

    # ==================== AWS LAMBDA COMPUTE TELEMETRY ====================
    lambda_summary = None
    if service in ('AWS Lambda', 'Lambda', 'awslambda') or service_norm in ('AWS Lambda', 'Lambda', 'awslambda'):
        inv_spend = Decimal('0')
        duration_spend = Decimal('0')
        xaz_spend = Decimal('0')
        total_invocations = 0.0
        total_gb_seconds = 0.0
        func_names = []

        for r in filtered:
            r_name = r.get('name') or r.get('short_id')
            if r_name and not r_name.startswith('No-Resource-ID') and r_name not in func_names:
                func_names.append(r_name)

        for rec in cur_data.get('records', []):
            prod = (rec.get('prod') or rec.get('service') or '').lower()
            if 'lambda' in prod:
                ut = (rec.get('usage') or rec.get('usage_type') or '').lower()
                cost_val = Decimal(str(rec.get('cost') or 0.0))
                amt = float(rec.get('usage_amount') or rec.get('amount') or 0.0)

                if 'request' in ut:
                    inv_spend += cost_val
                    total_invocations += amt
                elif 'gb-second' in ut:
                    duration_spend += cost_val
                    total_gb_seconds += amt
                elif 'xaz' in ut:
                    xaz_spend += cost_val

        primary_func = func_names[0] if func_names else 'Serverless-Fleet'
        lambda_summary = {
            'function_count': len(func_names),
            'primary_function': primary_func,
            'invocations': round(total_invocations),
            'invocations_cost': round_currency(inv_spend),
            'gb_seconds': round(total_gb_seconds, 1),
            'duration_cost': round_currency(duration_spend),
            'network_cost': round_currency(xaz_spend),
            'total_cost': round_currency(inv_spend + duration_spend + xaz_spend)
        }

    # ==================== CLOUDFRONT CDN TELEMETRY ====================
    cloudfront_summary = None
    if service in ('Amazon CloudFront', 'CloudFront', 'amazoncloudfront') or service_norm in ('Amazon CloudFront', 'CloudFront', 'amazoncloudfront'):
        egress_spend = Decimal('0')
        reqs_spend = Decimal('0')
        total_egress_bytes = 0.0
        total_edge_requests = 0.0
        dist_names = []

        for r in filtered:
            r_name = r.get('name') or r.get('short_id')
            if r_name and not r_name.startswith('No-Resource-ID') and r_name not in dist_names:
                dist_names.append(r_name)

        for rec in cur_data.get('records', []):
            prod = (rec.get('prod') or rec.get('service') or '').lower()
            if 'cloudfront' in prod:
                ut = (rec.get('usage') or rec.get('usage_type') or '').lower()
                cost_val = Decimal(str(rec.get('cost') or 0.0))
                amt = float(rec.get('usage_amount') or rec.get('amount') or 0.0)

                if 'datatransfer-out' in ut or 'out-bytes' in ut:
                    egress_spend += cost_val
                    total_egress_bytes += amt
                elif 'request' in ut:
                    reqs_spend += cost_val
                    total_edge_requests += amt

        primary_dist = dist_names[0] if dist_names else 'Global-Distribution-Fleet'
        egress_val_gb = total_egress_bytes if total_egress_bytes < 1000000 else (total_egress_bytes / (1024.0 ** 3))
        cloudfront_summary = {
            'distribution_count': len(dist_names),
            'primary_distribution': primary_dist,
            'edge_requests': round(total_edge_requests),
            'requests_cost': round_currency(reqs_spend),
            'egress_gb': round(egress_val_gb, 2),
            'egress_cost': round_currency(egress_spend),
            'total_cost': round_currency(reqs_spend + egress_spend)
        }

    # ==================== UNIVERSAL SMART TELEMETRY (FALLBACK FOR ANY SERVICE) ====================
    universal_summary = None
    if service and service not in ('All', 'ALL'):
        usage_type_totals = defaultdict(lambda: {'cost': Decimal('0'), 'amount': 0.0, 'unit': ''})
        region_totals = defaultdict(Decimal)

        svc_clean = service.lower().replace('amazon', '').replace('aws', '').replace(' ', '').replace('/', '').replace('_', '')

        for rec in cur_data.get('records', []):
            prod = (rec.get('prod') or rec.get('service') or '')
            prod_clean = prod.lower().replace('amazon', '').replace('aws', '').replace(' ', '').replace('/', '').replace('_', '')
            prod_norm = normalize_service_code(prod)
            if (
                prod_clean == svc_clean or 
                prod == service or 
                prod_norm == service or 
                (service_norm and (prod_norm == service_norm or prod == service_norm))
            ):
                ut = rec.get('usage') or rec.get('usage_type') or 'General Usage'
                cost_val = Decimal(str(rec.get('cost') or 0.0))
                amt = float(rec.get('usage_amount') or rec.get('amount') or 0.0)
                u = rec.get('unit') or ''
                reg = rec.get('region') or 'global'

                usage_type_totals[ut]['cost'] += cost_val
                usage_type_totals[ut]['amount'] += amt
                if u and not usage_type_totals[ut]['unit']:
                    usage_type_totals[ut]['unit'] = u
                region_totals[reg] += cost_val

        sorted_uts = sorted(usage_type_totals.items(), key=lambda x: x[1]['cost'], reverse=True)
        top_dimensions = []
        for ut_name, d in sorted_uts[:4]:
            top_dimensions.append({
                'name': ut_name,
                'cost': round_currency(d['cost']),
                'amount': round(d['amount'], 2),
                'unit': d['unit']
            })

        sorted_regions = sorted(region_totals.items(), key=lambda x: x[1], reverse=True)
        primary_reg = sorted_regions[0][0] if sorted_regions else 'global'

        universal_summary = {
            'service_name': service,
            'primary_region': primary_reg,
            'top_dimensions': top_dimensions,
            'unique_resources': unique_count,
            'total_cost': total_spend
        }

    return {
        'status': 'SUCCESS',
        'total_matches': total_records,
        'summary': {
            'total_cost': total_spend,
            'unique_resources_count': unique_count,
            'active_instances_count': active_instances_count,
            'retained_backups_count': retained_backups_count,
            'inventory_reconciliation': inventory_reconciliation,
            'waf_traffic_summary': waf_traffic_summary,
            'elb_summary': elb_summary,
            's3_summary': s3_summary,
            'vpc_summary': vpc_summary,
            'lambda_summary': lambda_summary,
            'cloudfront_summary': cloudfront_summary,
            'universal_summary': universal_summary,
            'classified_cost': classified_cost,
            'unallocated_cost': unallocated_spend,
            'unallocated_records_count': sum(1 for r in filtered if r['resource_id'].startswith('No-Resource-ID') or r['classification_status'] == 'USAGE_LEVEL_COST'),
            'selected_service': service,
            'selected_category': category,
            'dataset_name': cur_data.get('filename', 'AWS-CUR-Dataset'),
            'billing_period': {
                'start_date': dates_window[0] if dates_window else '',
                'end_date': dates_window[-1] if dates_window else '',
                'total_days': len(dates_window)
            },
            'first_charge_date': first_charge_date,
            'last_charge_date': last_charge_date,
            'charge_dates_count': charge_dates_count,
            'scope_snapshot_cost': scope_snapshot_cost,
            'scope_snapshot_count': scope_snapshot_count,
            'has_scope_snapshots': scope_snapshot_count > 0,
            'taxes_total': round(index.get('taxes_total', 0.0), 2),
            'net_invoiced_spend': round(total_spend + (index.get('taxes_total', 0.0) if (service in ('All', None) and category in ('ALL', None)) else 0.0), 2),
            'has_invoiced_tax': bool(index.get('taxes_total', 0.0) > 0),
            'currency': 'USD'
        },
        'snapshots_summary': snapshots_summary,
        'resources': paged_resources,
        'pagination': {
            'page': current_page,
            'page_size': safe_page_size,
            'total_records': total_records,
            'total_pages': total_pages
        },
        'hierarchies': index['hierarchies']
    }


def get_resource_detail(cur_data: Dict[str, Any], resource_id: str) -> Optional[Dict[str, Any]]:
    """
    Returns full billing line-item audit trail for a specific AWS resource ID.
    """
    if not cur_data or not cur_data.get('records'):
        return None

    matching_rows = [
        r for r in cur_data['records'] 
        if r.get('resource_id') == resource_id or r.get('ri_arn') == resource_id or r.get('sp_arn') == resource_id or f"sub-{r.get('subscription_id')}" == resource_id
    ]
    if not matching_rows:
        return None

    cls = classify_cur_record(matching_rows[0])
    total_cost = sum(r.get('cost', 0.0) for r in matching_rows)
    daily_spend = defaultdict(float)
    usage_type_spend = defaultdict(float)
    usage_amounts_by_unit = defaultdict(float)
    usage_by_type = defaultdict(float)
    cost_by_type = defaultdict(float)
    usage_by_type_and_date = defaultdict(lambda: defaultdict(float))
    cost_by_type_and_date = defaultdict(lambda: defaultdict(float))
    operations = set()
    line_types = set()
    units = set()

    for r in matching_rows:
        cost_val = r.get('cost', 0.0)
        u_amt = r.get('usage_amount', 0.0)
        u_unit = r.get('unit', '') or ''
        ut = r.get('usage_type', '')

        r_dt = (r.get('date') or '').split(' ')[0]
        daily_spend[r_dt] += cost_val
        usage_type_spend[ut] += cost_val
        if ut:
            usage_by_type[ut] += u_amt
            cost_by_type[ut] += cost_val
            if r_dt:
                usage_by_type_and_date[ut][r_dt] += u_amt
                cost_by_type_and_date[ut][r_dt] += cost_val
        if u_unit:
            units.add(u_unit)
            usage_amounts_by_unit[u_unit] += u_amt
        if r.get('operation'):
            operations.add(r['operation'])
        if r.get('line_type'):
            line_types.add(r['line_type'])

    sample = matching_rows[0]
    short_id = resource_id.split('/')[-1] if '/' in resource_id else (resource_id.split(':')[-1] if ':' in resource_id else resource_id)

    # Multi-node cluster topology decomposition
    cluster_info = extract_cluster_topology(
        cls['service'], 
        resource_id, 
        {
            'usage_by_type': usage_by_type, 
            'cost_by_type': cost_by_type,
            'usage_by_type_and_date': usage_by_type_and_date,
            'cost_by_type_and_date': cost_by_type_and_date,
            'first_seen': min(daily_spend.keys()) if daily_spend else '',
            'dates': daily_spend
        }, 
        total_days=len(daily_spend),
        dataset_start_date=min(daily_spend.keys()) if daily_spend else None
    )

    if cluster_info:
        primary_usage = round(cluster_info['total_compute_hours'], 4)
        primary_unit = 'Hrs'
        usage_disp = f"{cluster_info['total_compute_hours']:,.2f} Hrs"
    elif cls['category'] in ('TAX_AND_FEES', 'RI_SUBSCRIPTION_FEE') or resource_id.startswith('No-Resource-ID') or resource_id.startswith('TAX-'):
        primary_usage = 0.0
        primary_unit = ''
        usage_disp = '—'
    else:
        if 'Hrs' in usage_amounts_by_unit and (cls['category'] in ('EC2_INSTANCE', 'RDS_DB_INSTANCE') or 'instance' in str(list(usage_by_type.keys())).lower()):
            primary_unit = 'Hrs'
            primary_usage = round(usage_amounts_by_unit['Hrs'], 4)
        elif 'GB-Mo' in usage_amounts_by_unit:
            primary_unit = 'GB-Mo'
            primary_usage = round(usage_amounts_by_unit['GB-Mo'], 4)
        elif 'GB' in usage_amounts_by_unit:
            primary_unit = 'GB'
            primary_usage = round(usage_amounts_by_unit['GB'], 4)
        elif usage_amounts_by_unit:
            sorted_u = sorted(usage_amounts_by_unit.items(), key=lambda x: x[1], reverse=True)
            primary_unit, u_val = sorted_u[0]
            primary_usage = round(u_val, 4)
        else:
            primary_unit = ''
            primary_usage = 0.0

        if primary_usage >= 1:
            usage_disp = f"{primary_usage:,.2f} {primary_unit}"
        elif primary_usage > 0:
            usage_disp = f"{primary_usage:.4f} {primary_unit}"
        else:
            usage_disp = '—'

    # Check for RI commitment ARNs and Subscriptions on this resource
    ri_arns_for_resource = {r.get('ri_arn') for r in matching_rows if r.get('ri_arn')}
    sub_ids_for_resource = {r.get('subscription_id') for r in matching_rows if r.get('subscription_id')}
    
    benefiting_resources = []
    applied_commitments = []
    
    if ri_arns_for_resource:
        if cls['category'] == 'RI_SUBSCRIPTION_FEE' or any(r.get('line_type') == 'RIFee' for r in matching_rows):
            benefiting = set()
            for rec in cur_data.get('records', []):
                if rec.get('line_type') == 'DiscountedUsage' and rec.get('ri_arn') in ri_arns_for_resource:
                    rec_rid = rec.get('resource_id', '')
                    if rec_rid and not rec_rid.startswith('No-Resource-ID'):
                        benefiting.add(rec_rid)
            benefiting_resources = sorted(list(benefiting))
        else:
            applied_commitments = sorted(list(ri_arns_for_resource))

    # Additively enrich line items while strictly preserving data integrity
    formatted_line_items = []
    for r in matching_rows:
        formatted_line_items.append({
            'date': r.get('date', ''),
            'month': r.get('month', ''),
            'hour': r.get('hour', '00:00'),
            'timestamp': r.get('timestamp', ''),
            'service': r.get('service', cls['service']),
            'resource_id': r.get('resource_id', resource_id),
            'short_id': r.get('short_id', short_id),
            'account_id': r.get('account_id', sample.get('account_id', '')),
            'region': r.get('region', sample.get('region', '')),
            'name': r.get('name', sample.get('name', '')),
            'line_type': r.get('line_type') or r.get('line_item_type') or 'Usage',
            'line_item_type': r.get('line_item_type') or r.get('line_type') or 'Usage',
            'usage_type': r.get('usage_type', ''),
            'operation': r.get('operation', ''),
            'usage_amount': round(r.get('usage_amount', 0.0), 4),
            'unit': r.get('unit', ''),
            'cost': round(r.get('cost', 0.0), 4),
            'unblended_cost': round(r.get('unblended_cost', r.get('cost', 0.0)), 4),
            'currency': r.get('currency', 'USD'),
            'pricing_term': r.get('term', 'OnDemand'),
            'term': r.get('term', 'OnDemand'),
            'desc': r.get('desc') or r.get('item_description') or '',
            'item_description': r.get('item_description') or r.get('desc') or '',
            'ri_arn': r.get('ri_arn', ''),
            'subscription_id': r.get('subscription_id', ''),
            'sp_arn': r.get('sp_arn', '')
        })

    # Build contract-level breakdown with specific benefiting workloads
    contracts = []
    is_comm = bool(ri_arns_for_resource or sub_ids_for_resource or cls['category'] == 'RI_SUBSCRIPTION_FEE')
    if is_comm and (cls['category'] == 'RI_SUBSCRIPTION_FEE' or any(r.get('line_type') == 'RIFee' for r in matching_rows)):
        contracts_dict = {}
        for r in matching_rows:
            c_arn = r.get('ri_arn') or ''
            c_sub = r.get('subscription_id') or ''
            c_key = c_arn or c_sub or f"Contract-{len(contracts_dict)+1}"
            if c_key not in contracts_dict:
                contracts_dict[c_key] = {
                    'subscription_id': c_sub,
                    'ri_arn': c_arn,
                    'short_arn': c_arn.split('/')[-1] if '/' in c_arn else (c_arn.split(':')[-1] if ':' in c_arn else c_arn),
                    'cost': 0.0,
                    'usage_type': r.get('usage_type', ''),
                    'operation': r.get('operation', ''),
                    'benefiting_resources': set()
                }
            contracts_dict[c_key]['cost'] += r.get('cost', 0.0)

        # Match benefiting resources per contract strictly by ri_arn
        for rec in cur_data.get('records', []):
            if rec.get('line_type') == 'DiscountedUsage':
                r_arn = rec.get('ri_arn')
                if r_arn and r_arn in contracts_dict:
                    rec_rid = rec.get('resource_id', '')
                    if rec_rid and not rec_rid.startswith('No-Resource-ID'):
                        contracts_dict[r_arn]['benefiting_resources'].add(rec_rid)

        for c_info in sorted(contracts_dict.values(), key=lambda x: x['cost'], reverse=True):
            contracts.append({
                'subscription_id': c_info['subscription_id'],
                'ri_arn': c_info['ri_arn'],
                'short_arn': c_info['short_arn'],
                'cost': round(c_info['cost'], 4),
                'usage_type': c_info['usage_type'],
                'operation': c_info['operation'],
                'benefiting_resources': sorted(list(c_info['benefiting_resources'])),
                'is_attributed': len(c_info['benefiting_resources']) > 0
            })

    # Resolve authoritative lifecycle status (Live CUR Activity Check)
    all_dates = cur_data.get('dates', [])
    max_dataset_date = max(all_dates) if all_dates else ''
    r_last_date = max(daily_spend.keys()) if daily_spend else (sample.get('last_seen', '').split(' ')[0] if sample.get('last_seen') else '')
    is_terminated = bool(max_dataset_date and r_last_date and r_last_date < max_dataset_date)

    if resource_id.startswith('No-Resource-ID') or resource_id.startswith('TAX-') or cls['category'] == 'TAX_AND_FEES':
        if cls['category'] == 'RI_SUBSCRIPTION_FEE' or is_comm:
            lifecycle_status = 'COMMITMENT_CONTRACT'
            lifecycle_label = 'Reserved Instance Commitment'
        else:
            lifecycle_status = 'ACCOUNT_LEVEL_FEES'
            lifecycle_label = 'Account / Tax / Fee'
    elif cls['category'] == 'RDS_DB_INSTANCE':
        if is_terminated:
            lifecycle_status = 'STOPPED_INSTANCE'
            lifecycle_label = f'Stopped / Inactive DB (Since {r_last_date})'
        else:
            lifecycle_status = 'ACTIVE_INSTANCE'
            lifecycle_label = 'Active DB Instance'
    elif cls['category'] == 'EC2_INSTANCE':
        if is_terminated:
            lifecycle_status = 'STOPPED_INSTANCE'
            lifecycle_label = f'Stopped / Inactive Workload (Since {r_last_date})'
        else:
            lifecycle_status = 'ACTIVE_INSTANCE'
            lifecycle_label = 'Active Compute Instance'
    elif cls['category'] in ('EBS_SNAPSHOT', 'RDS_SNAPSHOT'):
        lifecycle_status = 'SNAPSHOT_STORAGE'
        lifecycle_label = 'Snapshot Storage Asset'
    elif cls['category'] == 'RDS_BACKUP':
        lifecycle_status = 'RETAINED_BACKUP_STORAGE'
        lifecycle_label = 'Retained Backup (Terminated DB)'
    elif cls['category'] == 'EBS_VOLUME':
        if is_terminated:
            lifecycle_status = 'DELETED_STORAGE'
            lifecycle_label = f'Deleted EBS Volume (Inactive since {r_last_date})'
        else:
            lifecycle_status = 'PROVISIONED_STORAGE'
            lifecycle_label = 'EBS Block Storage'
    else:
        if is_terminated:
            lifecycle_status = 'DECOMMISSIONED_RESOURCE'
            lifecycle_label = f'Decommissioned Resource (Inactive since {r_last_date})'
        else:
            lifecycle_status = 'ACTIVE_RESOURCE'
            lifecycle_label = 'Active Cloud Resource'

    if is_comm and (cls['category'] == 'RI_SUBSCRIPTION_FEE' or resource_id.startswith('No-Resource-ID')):
        if len(sub_ids_for_resource) > 1:
            clean_label = f"Reserved Instance Commitment Portfolio ({len(sub_ids_for_resource)} Contracts)"
        elif len(sub_ids_for_resource) == 1:
            clean_label = f"Reserved Instance Commitment Contract #{list(sub_ids_for_resource)[0]}"
        else:
            clean_label = "Reserved Instance Commitment Portfolio"
    else:
        clean_label = sample.get('name', '') or short_id

    detail_inst_type = None
    for ut in usage_type_spend.keys():
        ut_lower = ut.lower()
        if 'boxusage:' in ut_lower:
            detail_inst_type = ut.split('BoxUsage:')[-1].split(':')[-1]
            break
        elif 'heavyusage:' in ut_lower:
            detail_inst_type = ut.split('HeavyUsage:')[-1].split(':')[-1]
            break
        elif 'instanceusage:' in ut_lower:
            detail_inst_type = ut.split('InstanceUsage:')[-1].split(':')[-1]
            break
        elif 'volumeusage.' in ut_lower:
            detail_inst_type = ut.split('VolumeUsage.')[-1].upper()
            break

    return {
        'resource_id': resource_id,
        'short_id': short_id,
        'name': sample.get('name', ''),
        'display_label': clean_label,
        'service': cls['service'],
        'category': cls['category'],
        'category_label': cls['category_label'],
        'instance_type': detail_inst_type,
        'asset_type': cls['asset_type'],
        'account_id': sample.get('account_id', 'Primary-Account'),
        'region': sample.get('region', 'us-east-1'),
        'total_cost': round(total_cost, 4),
        'usage_amount': primary_usage,
        'usage_unit': primary_unit,
        'usage_display': usage_disp,
        'usage_by_unit': {k: round(v, 4) for k, v in usage_amounts_by_unit.items()},
        'cluster_nodes': cluster_info,
        'active_days': len(daily_spend),
        'first_seen': min(daily_spend.keys()) if daily_spend else '',
        'last_seen': max(daily_spend.keys()) if daily_spend else '',
        'classification_status': cls['classification_status'],
        'lifecycle_status': lifecycle_status,
        'lifecycle_label': lifecycle_label,
        'verification_status': 'Not verified against live AWS state',
        'operations': list(operations),
        'line_types': list(line_types),
        'daily_timeline': [{ 'date': k, 'cost': round(v, 4) } for k, v in sorted(daily_spend.items())],
        'usage_breakdown': [{ 'usage_type': k, 'cost': round(v, 4) } for k, v in sorted(usage_type_spend.items(), key=lambda x: x[1], reverse=True)],
        'is_commitment': is_comm,
        'commitment_type': 'ReservedInstance' if is_comm else '',
        'ri_arn': list(ri_arns_for_resource)[0] if ri_arns_for_resource else '',
        'ri_arns': sorted(list(ri_arns_for_resource)),
        'subscription_id': list(sub_ids_for_resource)[0] if sub_ids_for_resource else '',
        'subscription_ids': sorted(list(sub_ids_for_resource)),
        'benefiting_resources': benefiting_resources,
        'applied_commitments': applied_commitments,
        'contracts': contracts,
        'total_line_items': len(matching_rows),
        'recent_line_items': formatted_line_items[:100],
        'line_items': formatted_line_items[:100]
    }
