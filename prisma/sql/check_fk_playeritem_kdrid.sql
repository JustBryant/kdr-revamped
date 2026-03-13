-- Check constraints for PlayerItem table
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = '"PlayerItem"'::regclass;
