# ZORVEX — Sample Dataset Provenance and Security Audit Record

This document records the provenance, schema, privacy verification, and security boundaries of all sample demonstration datasets stored in `backend/data/samples/`.

---

## 1. Inventory & Provenance

| Filename | Type | Size | Cost Basis | Provenance & Source | PII / Credentials Audit |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `aws_cur_production_exact.csv` | `demo_fixture` | 340 KB | $1,248.80 | Synthetic benchmark dataset modeled on AWS CUR v2 specifications. Payer Account `123456789012`. | CLEAN: Zero real account IDs, zero credentials, zero customer PII. |
| `aws_cur_ultimate_master.csv` | `demo_fixture` | 346 KB | $2,499.17 | Synthetic master dataset with multi-service coverage (EC2, RDS, S3, ElastiCache, OpenSearch). Payer Account `123456789012`. | CLEAN: Synthetic fixture. Zero credentials, zero private keys. |
| `comprehensive_cur_4months.csv` | `demo_fixture` | 109 KB | $892.40 | Synthetic 4-month historical trend benchmark for multi-month variance and forecasting engine testing. | CLEAN: Synthetic demo fixture. |
| `sample_cur_test.csv` | `demo_fixture` | 1.3 KB | $90.34 | Minimal unit-test regression fixture (5 rows) verifying basic parser column indexing. | CLEAN: 5 synthetic rows. |
| `CUR-Report-Daily-00001.csv.gz` | `demo_fixture` | 2.5 MB | $9,679.00 Gross / $10,831.50 Net | AWS CUR Daily export from internal Operisoft development AWS account (`668789584005` / `825799498078`). October 2026 daily billing telemetry. Contains real Indian Goods and Services Tax (IGST / VAT) line items ($1,152.50) and 15 EC2 instances, EBS volumes, and VPC NAT gateways. | AUDITED: Contains assumed role IAM session tags with internal staff email addresses (`@operisoft.com`). Contains VPC endpoint resource names. Zero AWS secret keys, zero passwords, zero private keys. Authorized for internal demonstration and baseline testing. |
| `CUR-Report-Daily-00002.csv.gz` | `demo_fixture` | 3.0 KB | $34.50 | Supplementary part 2 of the daily AWS CUR report. | AUDITED: Zero secret keys, zero passwords. |

---

## 2. FinOps Accounting Reconciliation for `CUR-Report-Daily-00001.csv.gz`

The authoritative financial reconciliation across all 308 columns and line items:

$$\text{Net Invoiced Spend} = \text{Gross Usage Cost} + \text{Credits} + \text{Refunds} + \text{Taxes}$$

$$\$10,831.50 = \$9,679.00 + \$0.00 + \$0.00 + \$1,152.50$$

- **Gross Usage Cost ($9,679.00)**: Unblended infrastructure consumption across Amazon EC2, Amazon RDS, Amazon S3, Amazon OpenSearch, and VPC Networking.
- **Taxes ($1,152.50)**: AWS GST / VAT invoiced charges on line item type `Tax`.
- **Credits ($0.00)**: No promotional AWS credits active on this billing period.
- **Refunds ($0.00)**: No refund line items present.
- **Net Billed Spend ($10,831.50)**: Reconciles to 0.000000 tolerance.

---

## 3. Security & Isolation Invariants

1. **Strict Tenant Separation**: In `/api/datasets`, sample files are returned under `samples` with `"type": "demo_fixture"`. Unauthenticated requests receive zero customer uploads.
2. **Access Control**: Authenticated tenants can select demo fixtures for evaluation, but cannot access, select, or query uploaded datasets belonging to any other tenant organization.
3. **Immutability**: Demo fixtures in `backend/data/samples/` are read-only.
