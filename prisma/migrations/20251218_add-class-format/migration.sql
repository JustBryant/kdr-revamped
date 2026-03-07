BEGIN;

-- Add nullable formatId column to Class
ALTER TABLE "Class"
  ADD COLUMN IF NOT EXISTS "formatId" text;

-- Add foreign key constraint referencing Format(id) with ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_format'
  ) THEN
    ALTER TABLE "Class"
      ADD CONSTRAINT fk_class_format FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE SET NULL;
  END IF;
END$$;

COMMIT;
