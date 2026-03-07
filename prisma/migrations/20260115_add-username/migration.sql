-- Migration: add username column and unique index
-- Safe: adds nullable column and unique index restricted to non-null values

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_unique"
  ON "User" (username)
  WHERE username IS NOT NULL;
