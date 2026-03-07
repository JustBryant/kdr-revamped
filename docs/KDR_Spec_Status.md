KDR Spec Status (living document)

Last updated: 2025-12-16

Overview
- This file tracks implementation status for the KDR run spec and related features.

Status summary

- Spec Drafted: completed — KDR run spec exists and guided implementation.
- Models: completed — `Format`, `KDR`, `KDRPlayer`, `KDRRound`, `KDRMatch` added in `prisma/schema.prisma`.
- Migrations: completed — non‑destructive SQL applied (see `prisma/migrations`).
- Per‑KDR class pick: completed — `classId` added to `KDRPlayer`; picks increment at join.
- Core APIs (create/join/list/detail/generate): completed — routes implemented.
- Match lifecycle APIs (report/provisional/dispute/resolve/undo): completed — including admin resolve/undo.
- Shop & BYE handling: completed — shop awards gold/xp and supports BYE players.
- Admin change‑class: completed — host/admin pre‑start endpoint added.
- Stats updates on resolve/undo: completed — `PlayerStats` and `PlayerClassStats` updated/rolled back.
- Per‑format settings admin UI: completed — admin settings accept `?format=kdr`.
- Snapshot vs live settings: completed — snapshot-on-create implemented when a format is present; admin "Refresh Snapshots" endpoint and UI added. Policy finalized: stored snapshot by default with admin ability to refresh live KDRs when needed.
- Frontend UIs (create/join/generate/report/resolve/undo/change‑class/shop): not-started — pages/components need building (some minimal pages scaffolded).
- Validation (join deadlines, change‑class deadlines): not-started — enforceable checks and UI flows needed.
- Automated tests (join/picks, match lifecycle): not-started — unit/integration tests to add (helper tests and minimal integration runner exist).
- Docs / admin guide: not-started — write admin/host workflow docs (this file is the start).
- Monitoring / audit logs: not-started — capture admin actions and disputes.
- Player UI for KDR status & shop: not-started — per-player views needed.

Recent updates (delta)
- 2025-12-16: Implemented stored-snapshot policy and added admin API `POST /api/admin/kdr/snapshot` to refresh snapshots for a KDR or all live KDRs of a format.
- 2025-12-16: Added "Refresh Snapshots" button to admin UI: `pages/admin/formats/kdr/settings.tsx`.
- 2025-12-16: Added minimal integration test `tests/integration/adminSnapshotTest.cjs` and updated runner `tests/integration/runAll.cjs`.

Policy decision (finalized)
- Default: store a snapshot of `gameSettings` on KDR creation when a format is set (reproducible behavior).
- Admin override: admins may refresh snapshots for a given live KDR or for all live KDRs of a format via the admin endpoint/UI. This lets admins fix mistakes or apply urgent balance changes while preserving reproducibility when desired.

Next recommended actions
1. Add server-side integration tests exercising `POST /api/admin/kdr/snapshot` with an authenticated admin and a test DB (requires test DB + test server setup).
2. Add confirmation dialog and optional "snapshot single KDR" input to the admin UI.
3. Update documentation pages (admin guide) describing snapshot semantics and when to use "Refresh Snapshots".
4. Add audit logging for snapshot refresh actions (who/when/target) and expose in admin audit UI.
5. Expand automated tests to cover join/picks and match lifecycle flows.

Notes
- Shop API prefers `kDR.settingsSnapshot` when present, otherwise falls back to the format's `gameSettings` and then defaults. With the current policy, `settingsSnapshot` will normally be present and used.

Files of interest
- API: `pages/api/kdr/shop.ts`, `pages/api/kdr/create.ts`, `pages/api/admin/kdr/snapshot.ts`
- Admin UI: `pages/admin/formats/kdr/settings.tsx`
- Tests: `tests/integration/*`

How to update
- Edit this file and commit changes. We will keep this doc as the canonical living spec-status tracker.

