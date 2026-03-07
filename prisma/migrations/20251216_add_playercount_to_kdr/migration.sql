-- Migration: add playerCount to KDR
-- Non-destructive: only adds the column if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='"KDR"' OR table_name='kdr'
        AND column_name='playerCount'
    ) THEN
        ALTER TABLE "KDR" ADD COLUMN IF NOT EXISTS "playerCount" integer;
    END IF;
EXCEPTION WHEN undefined_table THEN
    -- If the KDR table doesn't exist, skip (manual DB setup may be required)
    RAISE NOTICE 'KDR table does not exist; migration skipped';
END$$;
