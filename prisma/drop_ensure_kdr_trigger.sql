-- Drop the trigger and function that enforced linking to 'kdr'
BEGIN;

DROP TRIGGER IF EXISTS trg_ensure_kdr_formatclass_on_insert ON public."Class";
DROP FUNCTION IF EXISTS public.ensure_kdr_formatclass_on_insert();

COMMIT;
