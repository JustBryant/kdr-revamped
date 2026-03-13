-- Add nullable kdrPlayerId column and index to PlayerItem
ALTER TABLE "PlayerItem" ADD COLUMN IF NOT EXISTS "kdrPlayerId" text;
CREATE INDEX IF NOT EXISTS "idx_PlayerItem_kdrPlayerId" ON "PlayerItem" ("kdrPlayerId");

-- Note: we intentionally do NOT add the FK constraint yet. Backfill will populate values first.
