-- CreateEnum
CREATE TYPE "Variant" AS ENUM ('TCG', 'RUSH');

-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_formatId_fkey";

-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "fk_class_format";

-- DropForeignKey
ALTER TABLE "ClassItem" DROP CONSTRAINT "ClassItem_classId_fkey";

-- DropForeignKey
ALTER TABLE "ClassItem" DROP CONSTRAINT "ClassItem_itemId_fkey";

-- DropForeignKey
ALTER TABLE "GameSettings" DROP CONSTRAINT "GameSettings_formatId_fkey";

-- DropForeignKey
ALTER TABLE "KDR" DROP CONSTRAINT "KDR_createdById_fkey";

-- DropForeignKey
ALTER TABLE "KDR" DROP CONSTRAINT "KDR_formatId_fkey";

-- DropForeignKey
ALTER TABLE "KDRMatch" DROP CONSTRAINT "KDRMatch_kdrId_fkey";

-- DropForeignKey
ALTER TABLE "KDRMatch" DROP CONSTRAINT "KDRMatch_playerAId_fkey";

-- DropForeignKey
ALTER TABLE "KDRMatch" DROP CONSTRAINT "KDRMatch_playerBId_fkey";

-- DropForeignKey
ALTER TABLE "KDRMatch" DROP CONSTRAINT "KDRMatch_roundId_fkey";

-- DropForeignKey
ALTER TABLE "KDRMatch" DROP CONSTRAINT "KDRMatch_winnerId_fkey";

-- DropForeignKey
ALTER TABLE "KDRPlayer" DROP CONSTRAINT "KDRPlayer_classId_fkey";

-- DropForeignKey
ALTER TABLE "KDRPlayer" DROP CONSTRAINT "KDRPlayer_deckId_fkey";

-- DropForeignKey
ALTER TABLE "KDRPlayer" DROP CONSTRAINT "KDRPlayer_kdrId_fkey";

-- DropForeignKey
ALTER TABLE "KDRPlayer" DROP CONSTRAINT "KDRPlayer_userId_fkey";

-- DropForeignKey
ALTER TABLE "KDRPlayer" DROP CONSTRAINT "fk_kdrplayer_class";

-- DropForeignKey
ALTER TABLE "KDRRound" DROP CONSTRAINT "KDRRound_kdrId_fkey";

-- DropForeignKey
ALTER TABLE "LootPoolItem" DROP CONSTRAINT "LootPoolItem_skillId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerClassStats" DROP CONSTRAINT "PlayerClassStats_classId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerClassStats" DROP CONSTRAINT "PlayerClassStats_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerItem" DROP CONSTRAINT "PlayerItem_itemId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerItem" DROP CONSTRAINT "PlayerItem_kdrPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerItem" DROP CONSTRAINT "PlayerItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerLoot" DROP CONSTRAINT "PlayerLoot_kdrPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerLoot" DROP CONSTRAINT "PlayerLoot_lootItemId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerLoot" DROP CONSTRAINT "PlayerLoot_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerLoot" DROP CONSTRAINT "fk_playerloot_kdrplayer";

-- DropForeignKey
ALTER TABLE "PlayerLoot" DROP CONSTRAINT "fk_playerloot_lootitem";

-- DropForeignKey
ALTER TABLE "PlayerLoot" DROP CONSTRAINT "fk_playerloot_user";

-- DropForeignKey
ALTER TABLE "PlayerSkill" DROP CONSTRAINT "PlayerSkill_skillId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerSkill" DROP CONSTRAINT "PlayerSkill_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerSkill" DROP CONSTRAINT "fk_playerskill_skill";

-- DropForeignKey
ALTER TABLE "PlayerSkill" DROP CONSTRAINT "fk_playerskill_user";

-- DropForeignKey
ALTER TABLE "PlayerStats" DROP CONSTRAINT "PlayerStats_userId_fkey";

-- DropIndex
DROP INDEX "DeckCard_deckId_cardId_location_key";

-- DropIndex
DROP INDEX "GameSettings_formatId_key";

-- DropIndex
DROP INDEX "KDRMatch_kdrId_idx";

-- DropIndex
DROP INDEX "KDRMatch_roundId_idx";

-- DropIndex
DROP INDEX "KDRPlayer_kdrId_userId_key";

-- DropIndex
DROP INDEX "PlayerClassStats_userId_classId_key";

-- DropIndex
DROP INDEX "PlayerItem_itemId_idx";

-- DropIndex
DROP INDEX "PlayerItem_kdrPlayerId_idx";

-- DropIndex
DROP INDEX "PlayerItem_userId_idx";

-- DropIndex
DROP INDEX "PlayerStats_userId_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "imageUrl",
DROP COLUMN "imageUrlSmall",
DROP COLUMN "isRush",
DROP COLUMN "ygoprodeckUrl",
ADD COLUMN     "effect" TEXT,
ADD COLUMN     "monsterDesc" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pendulumDesc" TEXT,
ADD COLUMN     "requirement" TEXT,
ADD COLUMN     "variant" "Variant" NOT NULL DEFAULT 'TCG',
ALTER COLUMN "linkMarkers" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "formatId",
ADD COLUMN     "tipMax" INTEGER,
ADD COLUMN     "tipMin" INTEGER,
ADD COLUMN     "tipSkillIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "DeckCard" DROP COLUMN "location";

-- AlterTable
ALTER TABLE "Format" ADD COLUMN     "settings" JSONB,
ADD COLUMN     "variant" "Variant" NOT NULL DEFAULT 'TCG';

-- AlterTable
ALTER TABLE "GameSettings" DROP COLUMN "formatId";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "formatId" TEXT,
ADD COLUMN     "rarity" TEXT,
ADD COLUMN     "skillId" TEXT;

-- AlterTable
ALTER TABLE "KDR" DROP COLUMN "deletedAt";

-- AlterTable
ALTER TABLE "KDRMatch" DROP COLUMN "reportedById";

-- AlterTable
ALTER TABLE "KDRPlayer" ADD COLUMN     "tippedAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LootPoolItem" DROP COLUMN "skillId";

-- AlterTable
ALTER TABLE "PlayerClassStats" DROP COLUMN "losses",
DROP COLUMN "mostPickedCardId",
DROP COLUMN "wins",
ADD COLUMN     "stats" JSONB;

-- AlterTable
ALTER TABLE "PlayerItem" DROP COLUMN "acquiredAt",
DROP COLUMN "kdrPlayerId",
DROP COLUMN "locked",
DROP COLUMN "metadata",
DROP COLUMN "origin",
ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "kdrId" TEXT,
ADD COLUMN     "purchased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skillId" TEXT,
ALTER COLUMN "itemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlayerStats" DROP COLUMN "elo",
DROP COLUMN "gamesPlayed",
DROP COLUMN "givenLosses",
DROP COLUMN "losses",
DROP COLUMN "mostBeatenPlayerId",
DROP COLUMN "mostLostToPlayerId",
DROP COLUMN "mostPickedCardId",
DROP COLUMN "mostPickedClassId",
DROP COLUMN "mostPickedSkillId",
DROP COLUMN "mostPickedTreasureId",
DROP COLUMN "wins",
ADD COLUMN     "gold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kdrId" TEXT,
ADD COLUMN     "stats" JSONB,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Shopkeeper" DROP COLUMN "lootOffer",
DROP COLUMN "lootPurchase",
DROP COLUMN "skillOffer",
DROP COLUMN "training",
DROP COLUMN "treasures";

-- AlterTable
-- Ensure no NULLs exist before making column NOT NULL, preserve existing values
-- Map NULL dialogue types to a safe default that exists in the current enum
UPDATE "ShopkeeperDialogue" SET "type" = 'GREETING' WHERE "type" IS NULL;
ALTER TABLE "ShopkeeperDialogue" ALTER COLUMN "type" TYPE TEXT;
ALTER TABLE "ShopkeeperDialogue" ALTER COLUMN "type" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isDummy",
DROP COLUMN "username";

-- DropTable
DROP TABLE "ClassItem";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "PlayerLoot";

-- DropTable
DROP TABLE "PlayerSkill";

-- DropEnum
DROP TYPE "DialogueType";

-- CreateIndex
CREATE UNIQUE INDEX "DeckCard_deckId_cardId_key" ON "DeckCard"("deckId", "cardId");
