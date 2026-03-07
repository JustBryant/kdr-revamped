-- remove-skill-cards.sql
-- Safety-first SQL to preview and (optionally) delete YGOPRO "Skill" cards
-- Usage:
-- 1) Review the SELECT results below to confirm candidates
-- 2) Optionally create a backup table (uncomment backup block) and run it
-- 3) Run the DELETE block inside a transaction and inspect the RETURNING rows

-- PREVIEW matching rows
WITH candidates AS (
  SELECT id, "konamiId", name, type, metadata
  FROM "Card"
  WHERE LOWER(COALESCE(type, '')) LIKE '%skill%'
     OR LOWER(COALESCE(name, '')) LIKE '%skill%'
     OR (metadata->>'frameType') = 'skill'
)
SELECT * FROM candidates ORDER BY name;

-- QUICK IMPACT SUMMARY: how many related rows reference these cards
SELECT 'DeckCard' AS tbl, COUNT(*) AS cnt FROM "DeckCard" dc JOIN candidates c ON dc."cardId" = c.id;
SELECT 'ClassCard' AS tbl, COUNT(*) AS cnt FROM "ClassCard" cc JOIN candidates c ON cc."cardId" = c.id;
SELECT 'LootItem' AS tbl, COUNT(*) AS cnt FROM "LootItem" li JOIN candidates c ON li."cardId" = c.id;
SELECT 'LootPoolItem' AS tbl, COUNT(*) AS cnt FROM "LootPoolItem" lpi JOIN candidates c ON lpi."cardId" = c.id;
SELECT 'SkillCardModification' AS tbl, COUNT(*) AS cnt FROM "SkillCardModification" scm JOIN candidates c ON scm."cardId" = c.id;

-- OPTIONAL: create a backup of the rows to be deleted (recommended before running DELETE)
-- Uncomment to run
-- CREATE TABLE IF NOT EXISTS backup_deleted_skill_cards AS TABLE "Card" WITH NO DATA;
-- INSERT INTO backup_deleted_skill_cards SELECT * FROM "Card" WHERE id IN (SELECT id FROM candidates);

-- SAFE DELETE: run inside a transaction, inspect the RETURNING rows, then COMMIT
-- IMPORTANT: take a full DB backup/snapshot before running in production.
BEGIN;

DELETE FROM "Card"
WHERE LOWER(COALESCE(type, '')) LIKE '%skill%'
   OR LOWER(COALESCE(name, '')) LIKE '%skill%'
   OR (metadata->>'frameType') = 'skill'
RETURNING id, "konamiId", name;

-- If the returned rows look correct, run:
-- COMMIT;
-- Otherwise run:
-- ROLLBACK;

-- End of file
