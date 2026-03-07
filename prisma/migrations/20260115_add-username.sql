-- Add nullable username column and unique index for non-null usernames
-- Safe to run on a live database. Creates index only for non-null values.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Unique index on username for non-null values to enforce uniqueness without affecting NULLs
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_unique"
  ON "User" (username)
  WHERE username IS NOT NULL;
