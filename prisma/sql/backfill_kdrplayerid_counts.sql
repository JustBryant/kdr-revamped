-- Verification counts after backfill
SELECT 'with_kdrId_and_kdrPlayerId_set' AS label, count(*) AS cnt FROM "PlayerItem" WHERE "kdrId" IS NOT NULL AND "kdrPlayerId" IS NOT NULL;
SELECT 'with_kdrId_and_kdrPlayerId_null' AS label, count(*) AS cnt FROM "PlayerItem" WHERE "kdrId" IS NOT NULL AND "kdrPlayerId" IS NULL;
SELECT 'kdrId_null_total' AS label, count(*) AS cnt FROM "PlayerItem" WHERE "kdrId" IS NULL;
