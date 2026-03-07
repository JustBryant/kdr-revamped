-- Migration: add uniqueRound to Skill
-- Run this with psql or your DB admin tool against the project's DATABASE_URL

BEGIN;

-- Add column if not present
ALTER TABLE "Skill" ADD COLUMN IF NOT EXISTS "uniqueRound" INTEGER;

COMMIT;

-- Notes:
-- 1) If your DB uses a different naming convention (lowercase table names), adjust the table name accordingly.
-- 2) After applying this, run `npx prisma generate` so the Prisma client is in sync.
