BEGIN;

-- Create backups of Class and Format tables prior to schema change
CREATE TABLE IF NOT EXISTS "Class_backup_20251218" AS SELECT * FROM "Class";
CREATE TABLE IF NOT EXISTS "Format_backup_20251218" AS SELECT * FROM "Format";

COMMIT;
