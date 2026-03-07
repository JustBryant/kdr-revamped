-- Non-destructive migration: add shopState to KDRPlayer and create PlayerSkill/PlayerLoot tables
BEGIN;

-- Add shopState JSONB column if missing
ALTER TABLE "KDRPlayer" ADD COLUMN IF NOT EXISTS "shopState" JSONB;

-- Create PlayerSkill table
CREATE TABLE IF NOT EXISTS "PlayerSkill" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "source" TEXT,
  "createdAt" timestamptz DEFAULT now()
);

-- Create PlayerLoot table
CREATE TABLE IF NOT EXISTS "PlayerLoot" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kdrPlayerId" TEXT,
  "lootItemId" TEXT NOT NULL,
  "qty" INT DEFAULT 1,
  "cost" INT DEFAULT 0,
  "createdAt" timestamptz DEFAULT now()
);

-- Add foreign key constraints (only if referenced tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'PlayerSkill') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_playerskill_user') THEN
      ALTER TABLE "PlayerSkill" ADD CONSTRAINT "fk_playerskill_user" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_playerskill_skill') THEN
      ALTER TABLE "PlayerSkill" ADD CONSTRAINT "fk_playerskill_skill" FOREIGN KEY ("skillId") REFERENCES "Skill"(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'PlayerLoot') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_playerloot_user') THEN
      ALTER TABLE "PlayerLoot" ADD CONSTRAINT "fk_playerloot_user" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_playerloot_kdrplayer') THEN
      ALTER TABLE "PlayerLoot" ADD CONSTRAINT "fk_playerloot_kdrplayer" FOREIGN KEY ("kdrPlayerId") REFERENCES "KDRPlayer"(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_playerloot_lootitem') THEN
      ALTER TABLE "PlayerLoot" ADD CONSTRAINT "fk_playerloot_lootitem" FOREIGN KEY ("lootItemId") REFERENCES "LootItem"(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

COMMIT;
