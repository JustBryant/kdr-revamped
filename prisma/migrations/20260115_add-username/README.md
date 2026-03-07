Migration: add-username

This migration adds a nullable `username` column to the `User` table and creates a unique index for non-null usernames.

SQL file: `migration.sql`

Notes:
- This is non-destructive: the column is nullable and Postgres allows multiple NULLs for a unique index.
- If you later make `username` non-nullable, ensure every row has a unique username first.

How to apply (example):

```bash
# apply the SQL directly (requires psql and DATABASE_URL env)
psql "$DATABASE_URL" -f prisma/migrations/20260115_add-username/migration.sql

# regenerate Prisma client
npx prisma generate
```
