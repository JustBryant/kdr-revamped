-- Add FK constraint from PlayerItem.kdrId -> KDR.id with ON DELETE CASCADE
-- Run this against the live DB (Postgres) to ensure PlayerItem rows tied to a KDR are removed when the KDR is deleted.

ALTER TABLE "PlayerItem"
  ADD CONSTRAINT fk_playeritem_kdrid
  FOREIGN KEY ("kdrId") REFERENCES "KDR"("id")
  ON DELETE CASCADE;

-- Optional: add an index on kdrId for query performance
CREATE INDEX IF NOT EXISTS idx_playeritem_kdrid ON "PlayerItem"("kdrId");
