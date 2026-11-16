-- =============================================================================
-- ZORVEX ENTERPRISE FINOPS PLATFORM: NATIVE POSTGRESQL PREPARED QUERIES (, )
-- =============================================================================
-- Database: PostgreSQL 18
-- Native Wire Protocol: libpq / PQexecParams (, , ...)
-- Parameterized Prepared Statements: 100% SQL Injection Immune
-- =============================================================================

-- 1. USER LOGIN & AUTHENTICATION QUERY:
-- Source: backend/app/api/v1/endpoints/auth.py (Line 154)
SELECT users.id, users.organization_id, users.name, users.company, users.email, users.password_hash 
FROM users 
WHERE users.email = $1::VARCHAR;
-- Parameters Bound Separately:
--    = 'user@example.com'


-- 2. ACCOUNT-WISE COST AGGREGATION QUERY (OVERVIEW DASHBOARD):
-- Source: backend/app/repository.py (Lines 474 - 485)
SELECT billing_records.account_id, sum(billing_records.cost) AS total_cost 
FROM billing_records 
WHERE billing_records.organization_id = $1::INTEGER AND billing_records.dataset_id = $2::INTEGER AND billing_records.cost != $3::INTEGER GROUP BY billing_records.account_id;
-- Parameters Bound Separately:
--    = organization_id (Tenant ID)
--    = dataset_id
--    = 0.0


-- 3. SERVICE-WISE COST ANALYTICS QUERY (DATE RANGE FILTERING):
-- Source: backend/app/repository.py (Lines 2170 - 2185)
SELECT billing_records.service, sum(billing_records.cost) AS total_cost, count(billing_records.id) AS record_count 
FROM billing_records 
WHERE billing_records.organization_id = $1::INTEGER AND billing_records.dataset_id = $2::INTEGER AND billing_records.usage_date BETWEEN $3::VARCHAR AND $4::VARCHAR GROUP BY billing_records.service;
-- Parameters Bound Separately:
--    = organization_id (Tenant ID)
--    = dataset_id
--    = '2026-09-01' (start_date)
--    = '2026-09-30' (end_date)


-- 4. DAILY ROLLUP HIGH-SPEED AGGREGATION QUERY:
-- Source: backend/app/repository.py (Lines 429 - 436)
SELECT dataset_daily_rollups.usage_date, dataset_daily_rollups.gross_cost, dataset_daily_rollups.net_cost, dataset_daily_rollups.credits_cost 
FROM dataset_daily_rollups 
WHERE dataset_daily_rollups.organization_id = $1::INTEGER AND dataset_daily_rollups.dataset_id = $2::INTEGER ORDER BY dataset_daily_rollups.usage_date ASC;
-- Parameters Bound Separately:
--    = organization_id
--    = dataset_id


-- 5. RESOURCE EXPLORER SEARCH QUERY (ILIKE):
-- Source: backend/app/repository.py & security.py
SELECT billing_records.id, billing_records.resource_id, billing_records.service, billing_records.cost 
FROM billing_records 
WHERE billing_records.organization_id = $1::INTEGER AND billing_records.resource_id ILIKE $2::VARCHAR;
-- Parameters Bound Separately:
--    = organization_id
--    = '%vol-0123456789%' (Sanitized search term)
