import sys
sys.path.insert(0, 'backend')
from app.parser import parse_cur_file
from collections import defaultdict

data = parse_cur_file('backend/data/samples/CUR-Report-Daily-00001.csv.gz')

categories = defaultdict(float)
category_records = defaultdict(list)

for r in data['records']:
    svc = r.get('service')
    rid = r.get('resource_id', '')
    ut = r.get('usage_type', '').lower()
    cat = 'OTHER'
    
    if svc == 'Amazon EC2':
        if ':snapshot/' in rid or rid.startswith('snap-') or 'ebs:snapshot' in ut or 'snapshot' in ut:
            cat = 'EC2:EBS_SNAPSHOT'
        elif rid.startswith('i-') or 'boxusage' in ut:
            cat = 'EC2:INSTANCE'
        elif rid.startswith('vol-') or 'volumeusage' in ut:
            cat = 'EC2:VOLUME'
        elif ':natgateway/' in rid or rid.startswith('nat-') or 'natgateway' in ut:
            cat = 'EC2:NAT_GATEWAY'
        elif 'eipalloc-' in rid or 'publicipv4' in ut or 'elasticip' in ut or 'inuseaddress' in ut:
            cat = 'EC2:ELASTIC_IP'
        else:
            cat = 'EC2:UNCLASSIFIED'
    elif svc == 'Amazon RDS':
        if ':snapshot:' in rid or 'rdssnapshot' in ut or ':snapshot/' in rid:
            cat = 'RDS:SNAPSHOT'
        elif 'chargedbackup' in ut or 'backupusage' in ut:
            cat = 'RDS:BACKUP'
        elif ':db:' in rid and ('instanceusage' in ut or 'heavyusage' in ut):
            cat = 'RDS:INSTANCE'
        elif 'storage' in ut or 'gp3' in ut or 'gp2' in ut:
            cat = 'RDS:STORAGE'
        else:
            cat = 'RDS:UNCLASSIFIED'

    categories[cat] += r['cost']
    category_records[cat].append(r)

print("=== CLASSIFICATION SUMMARY ===")
for cat, cost in sorted(categories.items(), key=lambda x: x[1], reverse=True):
    sample = category_records[cat][0] if category_records[cat] else {}
    print(f"{cat}: ${cost:,.2f} ({len(category_records[cat])} records) | Sample: {sample.get('resource_id')} | Usage: {sample.get('usage_type')}")
