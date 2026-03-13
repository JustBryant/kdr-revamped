BEGIN;

-- Populate kdrPlayerId by matching (userId, kdrId) -> KDRPlayer.id
UPDATE "PlayerItem" pi
SET "kdrPlayerId" = kp.id
FROM "KDRPlayer" kp
WHERE pi."kdrId" IS NOT NULL
  AND pi."kdrPlayerId" IS NULL
  AND kp."userId" = pi."userId"
  AND kp."kdrId" = pi."kdrId";

COMMIT;

-- Counts for verification (run separately if desired)
-- SELECT count(*) FROM "PlayerItem" WHERE "kdrId" IS NOT NULL AND "kdrPlayerId" IS NOT NULL;
-- SELECT count(*) FROM "PlayerItem" WHERE "kdrId" IS NOT NULL AND "kdrPlayerId" IS NULL;
