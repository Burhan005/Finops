import sys
sys.path.insert(0, 'backend')
from app.parser import parse_cur_file
from collections import defaultdict

data = parse_cur_file('backend/data/samples/CUR-Report-Daily-00001.csv.gz')

# Simulate resource explorer aggregation for Snapshots & Backups
records = data['records']
print(f"Total dataset records: {len(records)}")

ebs_snaps = {}
rds_backups = {}
unallocated_snaps = 0.0

for r in records:
    svc = r.get('service')
    rid = r.get('resource_id', '')
    ut = r.get('usage_type', '')
    cost = r.get('cost', 0.0)

    # EBS Snapshot
    if svc == 'Amazon EC2' and (':snapshot/' in rid or rid.startswith('snap-') or 'snapshot' in ut.lower()):
        if rid not in ebs_snaps:
            ebs_snaps[rid] = {'cost': 0.0, 'dates': set(), 'account_id': r.get('account_id'), 'region': r.get('region'), 'name': r.get('name')}
        ebs_snaps[rid]['cost'] += cost
        ebs_snaps[rid]['dates'].add(r.get('date'))
    # RDS Backup / Snapshot
    elif svc == 'Amazon RDS' and ('backup' in ut.lower() or 'snapshot' in ut.lower()):
        if rid == 'No-Resource-ID':
            unallocated_snaps += cost
        else:
            if rid not in rds_backups:
                rds_backups[rid] = {'cost': 0.0, 'dates': set(), 'account_id': r.get('account_id'), 'region': r.get('region'), 'name': r.get('name')}
            rds_backups[rid]['cost'] += cost
            rds_backups[rid]['dates'].add(r.get('date'))

total_ebs = sum(s['cost'] for s in ebs_snaps.values())
total_rds = sum(b['cost'] for b in rds_backups.values())
total_snapshots_all = total_ebs + total_rds + unallocated_snaps

print("=== SNAPSHOTS & BACKUPS RECONCILIATION ===")
print(f"EBS Snapshots: {len(ebs_snaps)} unique assets | Total: ${total_ebs:,.2f}")
print(f"RDS Identified DB Backups: {len(rds_backups)} unique databases | Total: ${total_rds:,.2f}")
print(f"RDS Unallocated / Shared Backups: ${unallocated_snaps:,.2f}")
print(f"Grand Total Snapshots & Backups: ${total_snapshots_all:,.2f}")
print(f"Combined Unique Assets: {len(ebs_snaps) + len(rds_backups)}")

# Top 5 EBS Snapshots by spend
print("\nTop 5 EBS Snapshots by Cost:")
for rid, s in sorted(ebs_snaps.items(), key=lambda x: x[1]['cost'], reverse=True)[:5]:
    short = rid.split('/')[-1] if '/' in rid else rid
    print(f"  {short}: ${s['cost']:.4f} ({len(s['dates'])} days, {s['region']}, Acc: {s['account_id']})")

# Top RDS Backups by spend
print("\nRDS Database Backups by Cost:")
for rid, b in sorted(rds_backups.items(), key=lambda x: x[1]['cost'], reverse=True):
    short = rid.split(':')[-1] if ':' in rid else rid
    print(f"  {short}: ${b['cost']:.2f} ({len(b['dates'])} days, {b['region']}, Acc: {b['account_id']})")
