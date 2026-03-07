-- Add neonId column to User and a unique index for non-null values
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "neonId" text;

-- Ensure uniqueness for non-null neonId values without blocking writes
CREATE UNIQUE INDEX IF NOT EXISTS user_neonid_unique ON "User" ("neonId") WHERE "neonId" IS NOT NULL;
