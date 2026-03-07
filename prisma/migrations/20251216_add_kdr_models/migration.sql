-- Non-destructive migration to add KDR run models and per-format support
-- Review before applying to production.

BEGIN;

-- Create Format table
CREATE TABLE IF NOT EXISTS "Format" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create KDR table
CREATE TABLE IF NOT EXISTS "KDR" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "formatId" TEXT,
  "settingsSnapshot" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_kdr_format FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE SET NULL,
  CONSTRAINT fk_kdr_createdby FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);

-- Create KDRPlayer table
CREATE TABLE IF NOT EXISTS "KDRPlayer" (
  "id" TEXT PRIMARY KEY,
  "kdrId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deckId" TEXT,
  "bye" BOOLEAN NOT NULL DEFAULT false,
  "shopComplete" BOOLEAN NOT NULL DEFAULT false,
  "gold" INTEGER NOT NULL DEFAULT 0,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_kdrplayer_kdr FOREIGN KEY ("kdrId") REFERENCES "KDR"("id") ON DELETE CASCADE,
  CONSTRAINT fk_kdrplayer_user FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT fk_kdrplayer_deck FOREIGN KEY ("deckId") REFERENCES "Deck"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_kdr_user" ON "KDRPlayer"("kdrId", "userId");

-- Create KDRRound table
CREATE TABLE IF NOT EXISTS "KDRRound" (
  "id" TEXT PRIMARY KEY,
  "kdrId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_kdrround_kdr FOREIGN KEY ("kdrId") REFERENCES "KDR"("id") ON DELETE CASCADE
);

-- Create KDRMatch table
CREATE TABLE IF NOT EXISTS "KDRMatch" (
  "id" TEXT PRIMARY KEY,
  "kdrId" TEXT NOT NULL,
  "roundId" TEXT,
  "playerAId" TEXT NOT NULL,
  "playerBId" TEXT,
  "scoreA" INTEGER NOT NULL DEFAULT 0,
  "scoreB" INTEGER NOT NULL DEFAULT 0,
  "winnerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "reportedById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_kdrmatch_kdr FOREIGN KEY ("kdrId") REFERENCES "KDR"("id") ON DELETE CASCADE,
  CONSTRAINT fk_kdrmatch_round FOREIGN KEY ("roundId") REFERENCES "KDRRound"("id") ON DELETE CASCADE,
  CONSTRAINT fk_kdrmatch_playerA FOREIGN KEY ("playerAId") REFERENCES "KDRPlayer"("id") ON DELETE CASCADE,
  CONSTRAINT fk_kdrmatch_playerB FOREIGN KEY ("playerBId") REFERENCES "KDRPlayer"("id") ON DELETE CASCADE,
  CONSTRAINT fk_kdrmatch_winner FOREIGN KEY ("winnerId") REFERENCES "KDRPlayer"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_kdrmatch_kdrId" ON "KDRMatch"("kdrId");
CREATE INDEX IF NOT EXISTS "idx_kdrmatch_roundId" ON "KDRMatch"("roundId");

-- Add formatId to existing GameSettings (if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='GameSettings' AND column_name='formatId'
  ) THEN
    ALTER TABLE "GameSettings" ADD COLUMN "formatId" TEXT UNIQUE;
    ALTER TABLE "GameSettings" ADD CONSTRAINT fk_gamesettings_format FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE CASCADE;
  END IF;
END$$;

COMMIT;
