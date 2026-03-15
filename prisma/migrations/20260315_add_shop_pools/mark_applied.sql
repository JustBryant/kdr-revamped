BEGIN;
UPDATE "_prisma_migrations"
SET finished_at = now(), applied_steps_count = 1
WHERE migration_name = '20260315_add_shop_pools' AND finished_at IS NULL;
COMMIT;
