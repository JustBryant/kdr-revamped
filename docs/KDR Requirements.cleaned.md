# KDR Requirements

This document describes the requirements and data model considerations for KDR (the tournament/game system). It outlines class structure, player inventory, shop flow, formats, settings, KDR lifecycle, stats, and other design considerations.

---

## Table of Contents

- Classes
  - Starting Inventory
  - Unique Skill, Quest, Relic, Monster
  - Loot Pools & Tip Skills
  - Stats / XP / Gold
- Shop
  - Stages (Start, Check, Skill Choice, Stat Level, Training, Treasures, Loot, Tip)
  - Shop Aspects (Training, Loot Pools, Shopkeepers)
- Generics (Generic Loot, Skills, Treasures)
- Formats & Settings
  - Levelling, Skill System, Round Rewards, Shop Configuration
- KDR (Tournament lifecycle)
  - Creation, Hosting, Players, Brackets, Rounds
- Class Pages / Inventory
- Scores & Stats (User + Class specific)
- Skills (description, card modifiers, stat modifiers)

---

## Classes

Classes are the main unit in KDR. Each class contains:

- Unique Skill(s)
- Legendary Quest(s)
- Legendary Relic(s)
- Tip Skills
- Legendary Monster(s)
- Starting Items (cards & skills)
- Loot Pools (class-specific)
- Base stats and XP rules

All of the above should be stored cleanly in the database so class definitions are first-class entities that UIs and server logic can consume directly.

### Starting Inventory

Starting inventory contains the cards and skills a class begins with. These are regular cards and skills, but marked as "starting" for that class. They should be modeled so they can be treated the same as items obtained later.

### Unique Skill

The class's unique skill determines its playstyle. It behaves like a normal skill but is associated with the class as a permanent/unique ability.

### Legendary Quest, Relic, Monster

- Legendary Quest: a class-specific quest granting access to the Legendary Relic.
- Legendary Relic: unlocked after completing the Legendary Quest; functions like a special skill/relic.
- Legendary Monster: one or more cards that represent the class's legendary monster(s). Allow multiple and possible upgrades/changes over time.

### Loot Pools

Class loot pools are class-specific collections purchasable in the Shop. They can contain cards and skills and have tiers (Starter, Mid, High). Loot pools must reference the items they contain to make adding to a player's inventory straightforward.

### Tip Skills

Tip skills are class-specific rewards obtained by tipping the shopkeeper. They behave like regular skills but are gated by tip thresholds and cost ranges.

### Stats, XP, Gold

- Stats: five core stats (and extendable). Store each stat individually under a `stats` group so adding new stats later is easy.
- XP: numeric value; used to compute level and available loot/skills.
- Gold: numeric value used for purchases, tipping, training, and selling. Gold mechanics include interest (gain at end of shop based on held gold) and configurable defaults.

All values should be easily configurable via the Format/Settings system.

---

## Shop

The Shop is the central interaction where the player's run is shaped. It has distinct stages and aspects.

### Stages (flow)

1. **Start Phase** — award gold and XP as per settings.
2. **Check Phase** — evaluate XP for level ups; if level-up triggers a skill choice, move to Skill Choice; otherwise proceed based on stat points.
3. **Skill Choice Phase** — present N skills (based on settings); chosen skill is added to inventory.
4. **Stat Level Phase** — spend stat points across available stats; must consume all stat points.
5. **Training Phase** — option to buy training (cost -> XP); if purchased, re-run Check Phase.
6. **Treasures Phase** — offer a random set of treasures (rarities weighted by settings); player picks one (no duplicates).
7. **Loot Phase** — purchase Class/Generic loot pools; sell treasures/skills here until the player finishes.
8. **Tip Phase** — tip the shopkeeper; tipping accumulates across shops in the KDR and can unlock tip skills when thresholds are reached.

### Shop Aspects

- **Training:** configurable cost and XP gain.
- **Loot Pools:** track seen vs purchased pools for UI and logic.
- **Shopkeepers:** characters that drive flavor and dialogue for the shop flow.

---

## Generics

Generics are items not tied to any one class: generic loot, generic skills, and treasures.

### Generic Loot

Generic loot is purchasable by any class. Like class loot, it references cards and skills, can have tax, and is categorized (Staples, Removal/Disruption, Engine).

### Generic Skills

Skills accessible to any class — displayed in Skill Choice phase. Skills include descriptions, optional card modifiers, and a boolean `isSellable`.

### Treasures

Unique single-copy cards offered in Treasures Phase with rarities: Normal (N), Rare (R), Super Rare (SR), Ultra Rare (UR). Treasures are one-off and must be modeled as such.

---

## Formats & Settings

Formats bundle classes, skills, loot, treasures, and the settings that govern them. Settings control game logic and should be easily accessible and versionable per-format.

### Key settings

- **Levelling system:** XP thresholds per level (array), flexible number of levels.
- **Skill system:** number of generic skills to present; option `allLevelsGrantSkillChoice` or specific `skillUnlockLevels`.
- **Round rewards:** gold and XP awarded each round.
- **Shop configuration:** counts, costs, and min-levels per loot category; treasure counts and rarity weights; training cost/xp.
- **Modifiers:** optional per-format modifiers that change flow or shop behavior.
- **Public:** boolean allowing public hosting of formats.

Formats should store a `settingsSnapshot` at creation so KDRs remain immutable to later format changes.

---

## KDR (Tournament lifecycle)

### Creation & Hosting

- Hosts create KDRs with a name, player count, and selected Format; generate a unique ID for each KDR.
- Hosts can enable Ranked mode (affects Elo) and configure format overrides specific to the KDR.

### Players & Class Picking

- Track joined players by user id; allow host controls (kick, disable classes, duplicates, picks).
- Class picks are locked once chosen for the KDR run.

### Brackets & Rounds

- Support Round Robin and Swiss with configurable options (match counts, rounds).
- Host advances rounds and generates brackets; players report match results.

### Shop per Round

- Each round a player has one shop (after reporting their match result). Track whether a player's shop for a round is completed.

---

## Class Pages / Inventory

Each player has a Class Page (their Inventory) for the KDR run. It must surface: starting items, owned cards, treasures, skills, relics, stats, gold, and xp — all scoped to the KDR run.

The inventory model should be canonical and easy to consume by any UI (class page, shop, sell modal, admin tools).

---

## Scores & Stats

Track per-player and per-class statistics for display and ranking:

- Wins, losses, games played, points scored
- Elo rating
- Win/Loss ratio
- Most beaten / most lost-to opponent
- Most picked card, favorite class, favorite skill
- Best/worst matchups
- Host-granted losses

Class-specific stats mirror the above but scoped to a class.

---

## Skills

Skills require careful modeling and features:

- **Description:** human-readable text.
- **Card Modifiers:** rules that alter specific card text/behavior (negate, alter, add condition).
- **Stat Modifiers:** skills that scale or change effect based on a player's stat values.

Skills should be stored so they can reference card modifications and metadata cleanly.

---

## Notes

This document is a high-level requirements specification intended to guide schema redesign, API endpoints (e.g. `getPlayerInventory`, `getClassDefinition`), and a staged migration plan. The goal is a single canonical representation of class definitions and player inventories that reduces duplication and heuristic logic across the codebase.
