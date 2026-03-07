BEGIN;
CREATE TABLE IF NOT EXISTS public."FormatClass" (
  id text PRIMARY KEY,
  "formatId" text NOT NULL,
  "classId" text NOT NULL,
  CONSTRAINT "FormatClass_formatId_classId_key" UNIQUE ("formatId", "classId")
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormatClass_formatId_fkey') THEN
    ALTER TABLE public."FormatClass"
      ADD CONSTRAINT "FormatClass_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES public."Format"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormatClass_classId_fkey') THEN
    ALTER TABLE public."FormatClass"
      ADD CONSTRAINT "FormatClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"("id") ON DELETE CASCADE;
  END IF;
END$$;
COMMIT;
