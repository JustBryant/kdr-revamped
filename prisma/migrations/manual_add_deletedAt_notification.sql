BEGIN;

-- Add deletedAt to KDR if it doesn't exist
ALTER TABLE "KDR"
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz;

-- Create Notification table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "data" jsonb,
  "read" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.conname = 'notification_userid_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT notification_userid_fkey FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;
END$$;

-- Add index on userId
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification" ("userId");

COMMIT;
