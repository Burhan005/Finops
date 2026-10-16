"""
ZORVEX CUR-Driven Resource Explorer & Snapshot Cost Intelligence Engine
Authoritative asset classification, cost aggregation, and snapshot intelligence
derived strictly from authenticated AWS CUR billing records.
"""

import math
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple
from app.parser import normalize_service_code

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
    'GENERIC_RESOURCE': 'Identified Resource',
    'USAGE_LEVEL_COST': 'Usage-Level / Unallocated Cost',
    'TAX_AND_FEES': 'Government Tax & GST',
    'RI_SUBSCRIPTION_FEE': 'RI Recurring Subscription Fee'
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

        services_map[svc]['cost'] += cost
        services_map[svc]['records_count'] += 1
        if rid and not rid.startswith('No-Resource-ID') and not rid.startswith('TAX-'):
            services_map[svc]['resources'].add(rid)

        categories_map[svc][cat]['cost'] += cost
        categories_map[svc][cat]['records_count'] += 1
        if rid and not rid.startswith('No-Resource-ID') and not rid.startswith('TAX-'):
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


def extract_cluster_topology(service: str, resource_id: str, data: Dict[str, Any], total_days: int) -> Optional[Dict[str, Any]]:
    """
    Decomposes multi-node cluster resources (OpenSearch, Elasticsearch, Redshift)
    into constituent Data Nodes, Dedicated Master Nodes, Provisioned Storage,
    and Network Data Transfer.
    """
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
                count = round(amt / (days * 24)) if (days * 24) > 0 else 1
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
            'node_count': total_nodes
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
                count = round(amt / (days * 24)) if (days * 24) > 0 else 1
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
            'node_count': node_info['estimated_count'] if node_info else 1
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
        'usage_amount': 0.0,
        'usage_amounts_by_unit': defaultdict(float),
        'usage_by_type': defaultdict(float),
        'cost_by_type': defaultdict(float),
        'dates': defaultdict(float),
        'usage_types': defaultdict(float),
        'categories': defaultdict(float),
        'category_labels': {},
        'asset_types': {},
        'regions': defaultdict(float),
        'operations': set(),
        'line_types': set(),
        'units': set(),
        'currencies': set(),
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
    ebs_snap_spend = 0.0
    rds_bkp_spend = 0.0

    for r in records:
        cls = classify_cur_record(r)
        cost = r.get('cost', 0.0)
        rid = r.get('resource_id', 'No-Resource-ID')
        name_tag = r.get('name', '')
        ut = r.get('usage_type', '')
        r_date = r.get('date', '')
        r_account = r.get('account_id', '')
        r_region = r.get('region', '')

        if cls['is_snapshot'] or cls['is_backup']:
            u_unit = r.get('unit', '')
            u_amt = r.get('usage_amount', 0.0)
            snapshot_usage_breakdown[ut]['cost'] += cost
            snapshot_usage_breakdown[ut]['amount'] += u_amt
            if not snapshot_usage_breakdown[ut]['unit'] and u_unit:
                snapshot_usage_breakdown[ut]['unit'] = u_unit

            if cls['category'] == 'EBS_SNAPSHOT':
                ebs_snap_spend += cost
                if rid and not rid.startswith('No-Resource-ID'):
                    ebs_snap_ids.add(rid)
            elif cls['category'] in ('RDS_SNAPSHOT', 'RDS_BACKUP'):
                rds_bkp_spend += cost
                if rid and not rid.startswith('No-Resource-ID'):
                    rds_bkp_ids.add(rid)

        entry = res_map[rid]
        entry['total_cost'] += cost
        u_amt = r.get('usage_amount', 0.0)
        u_unit = r.get('unit', '') or ''
        if u_unit:
            entry['usage_amounts_by_unit'][u_unit] += u_amt
        if ut:
            entry['usage_by_type'][ut] += u_amt
            entry['cost_by_type'][ut] += cost

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

        if not entry['service'] or entry['service'] == 'Other' or cls['service'] == 'Taxes & Surcharges':
            entry['service'] = cls['service']

        if not entry['account_id'] and r_account:
            entry['account_id'] = r_account
        if not entry['region'] and r_region:
            entry['region'] = r_region
        if not entry['name'] and name_tag:
            entry['name'] = name_tag

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
        primary_unit = list(data['units'])[0] if data['units'] else ''
        primary_curr = list(data['currencies'])[0] if data['currencies'] else 'USD'

        # Resolve primary category and archetype deterministically
        rid_lower = rid.lower()
        if rid.startswith('i-'):
            primary_cat = 'EC2_INSTANCE'
        elif rid.startswith('vol-'):
            primary_cat = 'EBS_VOLUME'
        elif ':db:' in rid_lower:
            # Check if this database resource had compute instance usage or is a retained backup/storage
            if 'RDS_DB_INSTANCE' in data['categories'] or any(
                'instanceusage' in ut.lower() or 'boxusage' in ut.lower() or 'heavyusage' in ut.lower()
                for ut in data['usage_types'].keys()
            ):
                primary_cat = 'RDS_DB_INSTANCE'
            elif 'RDS_BACKUP' in data['categories'] or any('backup' in ut.lower() for ut in data['usage_types'].keys()):
                primary_cat = 'RDS_BACKUP'
            elif 'RDS_STORAGE' in data['categories'] or any('storage' in ut.lower() or 'gp3' in ut.lower() or 'gp2' in ut.lower() for ut in data['usage_types'].keys()):
                primary_cat = 'RDS_STORAGE'
            else:
                primary_cat = 'RDS_DB_INSTANCE'
        elif ':snapshot/' in rid_lower or 'snap-' in rid_lower or 'rds:snap-' in rid_lower:
            if data['service'] == 'Amazon EC2' or ':ec2:' in rid_lower or 'snap-' in rid_lower:
                primary_cat = 'EBS_SNAPSHOT'
            else:
                primary_cat = 'RDS_SNAPSHOT'
        elif ':natgateway/' in rid_lower or rid.startswith('nat-'):
            primary_cat = 'NAT_GATEWAY'
        elif ':distribution/' in rid_lower or 'arn:aws:cloudfront' in rid_lower:
            primary_cat = 'CLOUDFRONT_DISTRIBUTION'
            data['service'] = 'Amazon CloudFront'
        elif ':webacl/' in rid_lower or 'arn:aws:waf' in rid_lower:
            primary_cat = 'WAF_WEB_ACL'
            data['service'] = 'AWS WAF'
        elif rid.startswith('eipalloc-'):
            primary_cat = 'ELASTIC_IP'
        elif rid.startswith('TAX-') or rid == 'TAX-INVOICE-GST' or 'TAX_AND_FEES' in data['categories']:
            primary_cat = 'TAX_AND_FEES'
            data['service'] = 'Taxes & Surcharges'
        elif rid.startswith('No-Resource-ID'):
            if 'TAX_AND_FEES' in data['categories']:
                primary_cat = 'TAX_AND_FEES'
                data['service'] = 'Taxes & Surcharges'
            elif 'RI_SUBSCRIPTION_FEE' in data['categories']:
                primary_cat = 'RI_SUBSCRIPTION_FEE'
            else:
                primary_cat = 'USAGE_LEVEL_COST'
        else:
            sorted_cats = sorted(data['categories'].items(), key=lambda x: x[1], reverse=True)
            primary_cat = sorted_cats[0][0] if sorted_cats else 'GENERIC_RESOURCE'

        primary_cat_label = data['category_labels'].get(primary_cat, CATEGORY_LABELS.get(primary_cat, primary_cat))
        primary_asset_type = data['asset_types'].get(primary_cat, 'Other')

        # Resolve primary region by highest spend
        sorted_regions = sorted(data['regions'].items(), key=lambda x: x[1], reverse=True)
        primary_region = sorted_regions[0][0] if sorted_regions else (data['region'] or 'global')

        clean_label = data['name']
        if not clean_label:
            if rid.startswith('i-'):
                clean_label = f"EC2 ({data['short_id']})"
            elif rid.startswith('vol-'):
                clean_label = f"EBS Disk ({data['short_id']})"
            elif ':db:' in rid_lower:
                if primary_cat == 'RDS_BACKUP':
                    clean_label = f"RDS Retained Backup ({data['short_id']})"
                elif primary_cat == 'RDS_STORAGE':
                    clean_label = f"RDS Disk Storage ({data['short_id']})"
                else:
                    clean_label = f"RDS DB ({data['short_id']})"
            elif ':snapshot/' in rid_lower or rid.startswith('snap-'):
                clean_label = f"EBS Snapshot ({data['short_id']})"
            elif ':natgateway/' in rid_lower or rid.startswith('nat-'):
                clean_label = f"NAT GW ({data['short_id']})"
            elif ':distribution/' in rid_lower or 'arn:aws:cloudfront' in rid_lower:
                clean_label = f"Distribution ({data['short_id']})"
            elif ':webacl/' in rid_lower or 'arn:aws:waf' in rid_lower:
                clean_label = f"Web ACL ({data['short_id']})"
            elif rid.startswith('No-Resource-ID'):
                op_str = f" ({list(data['operations'])[0]})" if data['operations'] else ""
                clean_label = f"{data['service']} Usage{op_str}"
            else:
                clean_label = data['short_id']

        all_cats = set(data['categories'].keys()) | {primary_cat}
        is_snap = any(c in ('EBS_SNAPSHOT', 'RDS_SNAPSHOT') for c in all_cats)
        is_bkp = any(c in ('RDS_BACKUP',) for c in all_cats)

        # Explicit FinOps Lifecycle Status classification
        has_instance_compute = any(
            'instanceusage' in ut.lower() or 'boxusage' in ut.lower() or 'heavyusage' in ut.lower()
            for ut in data['usage_types'].keys()
        )
        is_retained_backup_only = is_bkp and not has_instance_compute and not any(
            'storage' in ut.lower() or 'gp3' in ut.lower() for ut in data['usage_types'].keys()
        )

        if rid.startswith('No-Resource-ID') or rid.startswith('TAX-') or primary_cat == 'TAX_AND_FEES':
            lifecycle_status = 'ACCOUNT_LEVEL_FEES'
            lifecycle_label = 'Account / Tax / Fee'
        elif primary_cat == 'RDS_DB_INSTANCE' or (has_instance_compute and ':db:' in rid_lower):
            lifecycle_status = 'ACTIVE_INSTANCE'
            lifecycle_label = 'Active DB Instance'
        elif primary_cat == 'RDS_BACKUP' or (is_retained_backup_only and ':db:' in rid_lower):
            lifecycle_status = 'RETAINED_BACKUP_STORAGE'
            lifecycle_label = 'Retained Backup (Terminated DB)'
        elif primary_cat == 'EC2_INSTANCE' or (has_instance_compute and rid.startswith('i-')):
            lifecycle_status = 'ACTIVE_INSTANCE'
            lifecycle_label = 'Active Compute Instance'
        elif primary_cat == 'EBS_SNAPSHOT' or is_snap:
            lifecycle_status = 'SNAPSHOT_STORAGE'
            lifecycle_label = 'Snapshot Storage Asset'
        elif primary_cat == 'EBS_VOLUME':
            lifecycle_status = 'PROVISIONED_STORAGE'
            lifecycle_label = 'EBS Block Storage'
        else:
            lifecycle_status = 'ACTIVE_RESOURCE'
            lifecycle_label = 'Active Cloud Resource'

        # Extract multi-node cluster topology (Data nodes vs Dedicated Master nodes vs Storage)
        cluster_info = extract_cluster_topology(data['service'], rid, data, total_days=len(all_dates))

        if cluster_info:
            primary_usage_amount = round(cluster_info['total_compute_hours'], 4)
            primary_unit = 'Hrs'
            usage_display = f"{cluster_info['total_compute_hours']:,.2f} Hrs"
        elif primary_cat in ('TAX_AND_FEES', 'RI_SUBSCRIPTION_FEE') or rid.startswith('No-Resource-ID') or rid.startswith('TAX-'):
            primary_usage_amount = 0.0
            primary_unit = ''
            usage_display = '—'
        else:
            # Deterministic, unit-safe usage selection without cross-unit contamination
            unit_map = data['usage_amounts_by_unit']
            if 'Hrs' in unit_map and (has_instance_compute or primary_cat in ('EC2_INSTANCE', 'RDS_DB_INSTANCE')):
                primary_unit = 'Hrs'
                primary_usage_amount = round(unit_map['Hrs'], 4)
            elif 'GB-Mo' in unit_map and (is_snap or is_bkp or primary_cat in ('EBS_VOLUME', 'RDS_STORAGE', 'RDS_BACKUP', 'EBS_SNAPSHOT')):
                primary_unit = 'GB-Mo'
                primary_usage_amount = round(unit_map['GB-Mo'], 4)
            elif 'GB' in unit_map and any('transfer' in ut.lower() or 'bytes' in ut.lower() for ut in data['usage_types'].keys()):
                primary_unit = 'GB'
                primary_usage_amount = round(unit_map['GB'], 4)
            elif 'Hrs' in unit_map:
                primary_unit = 'Hrs'
                primary_usage_amount = round(unit_map['Hrs'], 4)
            elif 'GB-Mo' in unit_map:
                primary_unit = 'GB-Mo'
                primary_usage_amount = round(unit_map['GB-Mo'], 4)
            elif 'GB' in unit_map:
                primary_unit = 'GB'
                primary_usage_amount = round(unit_map['GB'], 4)
            elif unit_map:
                sorted_u = sorted(unit_map.items(), key=lambda x: x[1], reverse=True)
                primary_unit, u_amt = sorted_u[0]
                primary_usage_amount = round(u_amt, 4)
            else:
                primary_unit = ''
                primary_usage_amount = 0.0

            if primary_usage_amount >= 1:
                usage_display = f"{primary_usage_amount:,.2f} {primary_unit}"
            elif primary_usage_amount > 0:
                usage_display = f"{primary_usage_amount:.4f} {primary_unit}"
            else:
                usage_display = '—'

        all_resources.append({
            'resource_id': rid,
            'short_id': data['short_id'],
            'name': data['name'],
            'display_label': clean_label,
            'service': data['service'],
            'category': primary_cat,
            'category_label': primary_cat_label,
            'all_categories': list(all_cats),
            'asset_type': primary_asset_type,
            'account_id': data['account_id'] or 'Primary-Account',
            'region': primary_region,
            'total_cost': round(data['total_cost'], 4),
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
            'daily_costs': {k: round(v, 4) for k, v in sorted(data['dates'].items())},
            'is_snapshot': is_snap,
            'is_backup': is_bkp
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
        'ebs_snap_spend': ebs_snap_spend,
        'ebs_snap_count': len(ebs_snap_ids),
        'rds_bkp_spend': rds_bkp_spend,
        'rds_bkp_count': len(rds_bkp_ids),
        'unique_snapshots_count': len(ebs_snap_ids) + len(rds_bkp_ids),
        'hierarchies': hierarchies
    }
    cur_data['_materialized_explorer_index'] = index
    return index


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
            eff_cost = sum(v for d, v in r['daily_costs'].items() if (not start_date or d >= start_date) and (not end_date or d <= end_date))
            if eff_cost <= 0:
                continue

        if min_cost is not None and eff_cost < min_cost:
            continue

        if has_date_filter:
            r_copy = dict(r)
            r_copy['total_cost'] = round(eff_cost, 4)
            filtered.append(r_copy)
        else:
            filtered.append(r)

    total_records = len(filtered)
    total_spend = sum(r['total_cost'] for r in filtered)
    unallocated_spend = sum(
        r['total_cost'] for r in filtered 
        if r['resource_id'].startswith('No-Resource-ID') or r['resource_id'].startswith('TAX-') or r['classification_status'] == 'USAGE_LEVEL_COST'
    )
    unique_count = sum(
        1 for r in filtered 
        if not r['resource_id'].startswith('No-Resource-ID') and not r['resource_id'].startswith('TAX-') and r['classification_status'] != 'USAGE_LEVEL_COST'
    )
    classified_cost = total_spend - unallocated_spend

    # Sorting
    reverse_sort = (sort_order.lower() == 'desc')
    if sort_by != 'cost' or not reverse_sort or has_date_filter:
        if sort_by == 'cost':
            filtered.sort(key=lambda x: x['total_cost'], reverse=reverse_sort)
        elif sort_by == 'days':
            filtered.sort(key=lambda x: x['active_days'], reverse=reverse_sort)
        elif sort_by == 'id':
            filtered.sort(key=lambda x: x['resource_id'], reverse=reverse_sort)
        elif sort_by == 'name':
            filtered.sort(key=lambda x: x['name'] or x['short_id'], reverse=reverse_sort)
        elif sort_by == 'usage_amount':
            filtered.sort(key=lambda x: x['usage_amount'], reverse=reverse_sort)

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
    scope_snapshot_cost = round(sum(r['total_cost'] for r in scope_snapshot_resources), 2)
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
        'total_snapshot_cost': round(index['ebs_snap_spend'] + index['rds_bkp_spend'], 2),
        'unique_snapshots_count': index['unique_snapshots_count'],
        'ebs_snapshot_cost': round(index['ebs_snap_spend'], 2),
        'ebs_snapshot_count': index['ebs_snap_count'],
        'rds_backup_cost': round(index['rds_bkp_spend'], 2),
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

    active_instances = [r for r in filtered if r.get('lifecycle_status') == 'ACTIVE_INSTANCE']
    retained_backups = [r for r in filtered if r.get('lifecycle_status') in ('RETAINED_BACKUP_STORAGE', 'SNAPSHOT_STORAGE')]
    active_instances_count = len(active_instances)
    retained_backups_count = len(retained_backups)

    # Collect actual unique database/resource names dynamically from the filtered resources
    active_db_names = []
    for r in active_instances:
        name = r.get('name') or r.get('short_id') or r.get('resource_id')
        if name and name not in active_db_names:
            active_db_names.append(name)

    retained_backup_names = []
    for r in retained_backups:
        name = r.get('name') or r.get('short_id') or r.get('resource_id')
        if name and name not in retained_backup_names:
            retained_backup_names.append(name)

    if service == 'Amazon RDS':
        active_list_str = f" ({', '.join(active_db_names[:4])})" if active_db_names else ""
        if retained_backups_count > 0:
            retained_list_str = f" ({', '.join(retained_backup_names[:4])})" if retained_backup_names else ""
            reconciliation_note = (
                f"Authoritative AWS inventory contains {active_instances_count} active database instance{'s' if active_instances_count != 1 else ''}{active_list_str}. "
                f"The remaining {retained_backups_count} identifier{'s represent' if retained_backups_count != 1 else ' represents'} retained automated backup storage from terminated databases{retained_list_str}."
            )
        else:
            reconciliation_note = (
                f"Authoritative AWS inventory contains {active_instances_count} active database instance{'s' if active_instances_count != 1 else ''}{active_list_str} with zero retained backup storage."
            )
    else:
        reconciliation_note = f"{active_instances_count} active compute instances and {retained_backups_count} snapshot/backup storage assets in {service}."

    inventory_reconciliation = {
        'active_instances': active_instances_count,
        'active_instance_names': active_db_names,
        'retained_backups': retained_backups_count,
        'retained_backup_names': retained_backup_names,
        'total_billable_identifiers': unique_count,
        'scope': service,
        'reconciliation_note': reconciliation_note
    }

    return {
        'status': 'SUCCESS',
        'total_matches': total_records,
        'summary': {
            'total_cost': round(total_spend, 2),
            'unique_resources_count': unique_count,
            'active_instances_count': active_instances_count,
            'retained_backups_count': retained_backups_count,
            'inventory_reconciliation': inventory_reconciliation,
            'classified_cost': round(classified_cost, 2),
            'unallocated_cost': round(unallocated_spend, 2),
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

    matching_rows = [r for r in cur_data['records'] if r.get('resource_id') == resource_id]
    if not matching_rows:
        return None

    cls = classify_cur_record(matching_rows[0])
    total_cost = sum(r.get('cost', 0.0) for r in matching_rows)
    daily_spend = defaultdict(float)
    usage_type_spend = defaultdict(float)
    usage_amounts_by_unit = defaultdict(float)
    usage_by_type = defaultdict(float)
    cost_by_type = defaultdict(float)
    operations = set()
    line_types = set()
    units = set()

    for r in matching_rows:
        cost_val = r.get('cost', 0.0)
        u_amt = r.get('usage_amount', 0.0)
        u_unit = r.get('unit', '') or ''
        ut = r.get('usage_type', '')

        daily_spend[r.get('date', '')] += cost_val
        usage_type_spend[ut] += cost_val
        if ut:
            usage_by_type[ut] += u_amt
            cost_by_type[ut] += cost_val
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
        {'usage_by_type': usage_by_type, 'cost_by_type': cost_by_type}, 
        total_days=len(daily_spend)
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

    return {
        'resource_id': resource_id,
        'short_id': short_id,
        'name': sample.get('name', ''),
        'service': cls['service'],
        'category': cls['category'],
        'category_label': cls['category_label'],
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
        'verification_status': 'Not verified against live AWS state',
        'operations': list(operations),
        'line_types': list(line_types),
        'daily_timeline': [{ 'date': k, 'cost': round(v, 4) } for k, v in sorted(daily_spend.items())],
        'usage_breakdown': [{ 'usage_type': k, 'cost': round(v, 4) } for k, v in sorted(usage_type_spend.items(), key=lambda x: x[1], reverse=True)],
        'recent_line_items': matching_rows[:50],
        'line_items': matching_rows[:50]
    }
