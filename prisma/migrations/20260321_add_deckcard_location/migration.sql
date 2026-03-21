-- Add location column to DeckCard
ALTER TABLE "DeckCard" ADD COLUMN "location" TEXT NOT NULL DEFAULT 'MAIN';
-- Add unique constraint for (deckId, cardId, location)
CREATE UNIQUE INDEX "DeckCard_deckId_cardId_location_key" ON "DeckCard"("deckId", "cardId", "location");
