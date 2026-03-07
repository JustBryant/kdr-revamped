# Inventory Migration Plan

This document describes the migration steps to move from the legacy `PlayerLoot` / `PlayerSkill` / `LootItem` tables to the new canonical `Item` / `PlayerItem` / `ClassItem` models.

Overview

- We added Prisma models: `Item`, `PlayerItem`, `ClassItem`, and `ItemType` enum.
- Next steps: generate and apply a DB migration, then run a safe backfill script to populate `Item` and `PlayerItem` from existing rows.

High-level migration steps

1. Commit schema changes (already done).
2. Generate migration using `prisma migrate dev --name add-canonical-inventory` on a dev machine.
3. Run the migration in staging.
4. Run backfill script to create `Item` rows (from `LootItem`, `Skill`, `Card`) and `PlayerItem` from `PlayerLoot` and `PlayerSkill`.
5. Deploy backend changes that prefer `PlayerItem` reads but still fall back to legacy tables.
6. After verification, switch write paths to create `PlayerItem` rows for new chooses/purchases.
7. Trim legacy tables once data parity is confirmed.

Rollback strategy

- Keep legacy tables intact until verification completed.
- Backfill script is idempotent and creates records using `upsert` or checks before inserts; it logs progress to a file.
- If issues are found, stop and inspect logs; do not drop legacy tables until fully confident.

Verification

- Compare counts per user: sum of `qty` in `PlayerItem` vs `PlayerLoot` + `PlayerSkill` counts.
- Spot-check items for several users: ensure `item.metadata` matches `lootItem`/`skill`/`card` metadata.
- Run frontend smoke tests for `SellModal` and Shop flows.

Schedule

- Run full migration on staging first. After 24–48h of validation, schedule migration window for production.
