-- ─────────────────────────────────────────────────────────────────────────────
-- SAFAT — PostgreSQL setup
-- Open pgAdmin → connect as postgres → Query Tool → paste & run
-- ─────────────────────────────────────────────────────────────────────────────

-- Step A: run on database "postgres"
CREATE USER safat WITH PASSWORD 'safat_local_dev';
CREATE DATABASE safat_db OWNER safat ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE safat_db TO safat;

-- Step B: switch to database "safat_db" in pgAdmin, then run:
GRANT ALL ON SCHEMA public TO safat;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO safat;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO safat;
