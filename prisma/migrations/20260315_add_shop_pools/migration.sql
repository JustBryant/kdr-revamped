BEGIN;

-- Add DB-level columns to track seen and purchased loot pool IDs
ALTER TABLE "KDRPlayer" ADD COLUMN IF NOT EXISTS "seenPools" text[] DEFAULT ARRAY[]::text[];
ALTER TABLE "KDRPlayer" ADD COLUMN IF NOT EXISTS "purchasedPools" text[] DEFAULT ARRAY[]::text[];

-- If there are existing values in JSON shopState.seenPools / shopState.purchasedPools,
-- copy them into the new columns (best-effort; skips non-array values).
-- json_array_elements_text returns setof text from a JSON array; aggregate into Postgres array.
-- Copy JSON arrays from the existing `shopState` JSON column if present.
-- Note: the column is named with camelCase by Prisma; quote identifiers to preserve case.
UPDATE "KDRPlayer" SET "purchasedPools" = (
  SELECT array_agg(x) FROM jsonb_array_elements_text(("shopState"->'purchasedPools')::jsonb) AS x
) WHERE "shopState" IS NOT NULL AND ("shopState"->'purchasedPools') IS NOT NULL;

UPDATE "KDRPlayer" SET "seenPools" = (
  SELECT array_agg(x) FROM jsonb_array_elements_text(("shopState"->'seenPools')::jsonb) AS x
) WHERE "shopState" IS NOT NULL AND ("shopState"->'seenPools') IS NOT NULL;

COMMIT;
