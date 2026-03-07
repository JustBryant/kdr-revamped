-- Ensures every newly inserted Class is linked to the 'kdr' Format via FormatClass.
-- If the 'kdr' format does not exist the insert will fail to avoid orphan classes.
BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_kdr_formatclass_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fmtId TEXT;
BEGIN
  SELECT id INTO fmtId FROM public."Format" WHERE slug = 'kdr' LIMIT 1;
  IF fmtId IS NULL THEN
    RAISE EXCEPTION 'Required format "kdr" not found; cannot create Class without linking to a Format';
  END IF;

  INSERT INTO public."FormatClass"("formatId", "classId")
  VALUES (fmtId, NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Replace any existing trigger with the same name
DROP TRIGGER IF EXISTS trg_ensure_kdr_formatclass_on_insert ON public."Class";

CREATE TRIGGER trg_ensure_kdr_formatclass_on_insert
AFTER INSERT ON public."Class"
FOR EACH ROW
EXECUTE FUNCTION public.ensure_kdr_formatclass_on_insert();

COMMIT;
