# KDR DB Redesign — Canonical Data Model

This document describes a canonical, future-proof database design for KDR. It focuses on a single canonical representation for "items" (cards, skills, treasures, relics, stats, etc.), clear ownership scoping (user vs KDR run), and modular settings/formats so that the system is extensible without duplication.

Goals
- Single canonical representation for re-usable elements (`Item`).
- Per-run scoping for mutable player state (per-KDR `KDRPlayer`, `PlayerItem`).
- Prevent duplication of business logic by storing metadata and source/origin information.
- Make adding new types (new item types, new settings, new shop phases) straightforward.

High level entities
- `User` — central user account.
- `Item` — canonical, immutable definition of an object (CARD, SKILL, TREASURE, RELIC, STAT, OTHER). Stores metadata JSON for arbitrary extension.
- `Class` — class definition that groups starting `ClassItem`s, class loot pools and class-specific metadata.
- `LootPool` & `LootPoolItem` — pools that reference `Item`s (and legacy Card/Skill relations if needed).
- `KDR` — a tournament/run created from a `Format` + `settingsSnapshot`.
- `KDRPlayer` — per-user participant in a `KDR` with per-run resources (gold, xp, shop state).
- `PlayerItem` — per-player (and optionally per-KDR-player) owned items; stores origin, qty, locked flag.
- `GameSettings` / `Format` — format definitions and default settings; `settingsSnapshot` on `KDR` locks a run's behavior.
- `PlayerStats` / `PlayerClassStats` — aggregated stats for users (global and per class).

Key principles
- Metadata-first: `Item.metadata` holds flexible attributes instead of hard-coding new columns for every extension.
- Origin & scoping: `PlayerItem.origin` and `PlayerItem.kdrPlayerId` separate global ownership vs run-scoped inventories.
- Immutability of formats: store a `settingsSnapshot` JSON on `KDR` so runs are deterministic after creation.
- Minimal duplication: use relations to reference `Item` from `LootPool`, `ClassItem`, `PlayerItem`.

Extensibility patterns
- Add new item fields via `Item.metadata` (JSON) rather than new columns.
- Add new settings under `GameSettings` or include them in `Format.modifiers` as JSON.
- Add new shop phases by adding an enum and extending `KDRPlayer.shopState` JSON to track phase progress.

Migration strategy (high-level)
1. Create new canonical tables (`Item`, `PlayerItem`, `ClassItem`) side-by-side with existing tables.
2. Backfill canonical `Item` rows from existing `Card`, `Skill`, `LootItem`, `Relic` rows, storing original external id in `Item.externalId` and source metadata.
3. For active KDRs, do not migrate; new runs will use the new model. Migrate old runs in a targeted window if necessary.
4. Update application code to write into `PlayerItem` / `Item` for all new flows; keep legacy writes for reads until fully migrated.
5. Move read paths to prefer `Item` + `PlayerItem`; add compatibility translation layers for older data where needed.

Recommended next steps
- Review `docs/prisma/schema_redesign.prisma` for a concrete Prisma schema that implements the model described above.
- Run a small backfill script that creates `Item` rows for a subset of `Card`/`Skill` rows to validate the mapping and feeds the UI.
- Plan a week-long staged migration: (1) create canonical rows, (2) read fallbacks, (3) switch writes for new events, (4) migrate historical data.

If you want, I can now:
- Add a backfill SQL template and a sample Node.js backfill script.
- Start converting a single feature (e.g. Treasures or Class starting items) to the new model to prove the pattern.

---
Created for: KDR Revamped
