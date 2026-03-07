-- Non-destructive migration: add classId to KDRPlayer
BEGIN;

ALTER TABLE IF EXISTS "KDRPlayer" ADD COLUMN IF NOT EXISTS "classId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_kdrplayer_class') THEN
    ALTER TABLE "KDRPlayer" ADD CONSTRAINT fk_kdrplayer_class FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL;
  END IF;
END$$;

COMMIT;
