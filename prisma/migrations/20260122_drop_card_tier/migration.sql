-- Migration: drop Card.tier
ALTER TABLE "Card" DROP COLUMN IF EXISTS "tier";
