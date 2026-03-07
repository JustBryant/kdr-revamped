#!/usr/bin/env node
// Backfill `neonId` into local `User` rows by matching neon_auth.user (email or name).
// Usage (preview): node scripts/backfill-neonId.js
// Apply: CONFIRM_BACKFILL=yes node scripts/backfill-neonId.js

require('dotenv').config()
const { Pool } = require('pg')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    // Ensure column exists
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "neonId" text`)
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'User' AND indexname = 'user_neonid_unique') THEN
        CREATE UNIQUE INDEX user_neonid_unique ON "User" ("neonId");
      END IF;
    END $$;`)

    const res = await client.query('SELECT id, email, name, "neonId" FROM "User"')
    const plan = []
    for (const u of res.rows) {
      if (u.neonId) continue
      let neonRow = null
      if (u.email && u.email.includes('@')) {
        const r = await client.query('SELECT id, email FROM neon_auth."user" WHERE email = $1 LIMIT 1', [u.email])
        if (r.rowCount > 0) neonRow = r.rows[0]
      }
      if (!neonRow && u.name) {
        const r2 = await client.query('SELECT id, email FROM neon_auth."user" WHERE name = $1 LIMIT 1', [u.name])
        if (r2.rowCount > 0) neonRow = r2.rows[0]
      }
      if (neonRow) {
        const existing = await client.query('SELECT id FROM "User" WHERE "neonId" = $1 LIMIT 1', [neonRow.id])
        if (existing.rowCount === 0) plan.push({ id: u.id, neonId: neonRow.id, neonEmail: neonRow.email })
        else plan.push({ id: u.id, neonId: neonRow.id, neonEmail: neonRow.email, conflictWith: existing.rows[0].id })
      }
    }

    console.log('Backfill plan:')
    console.log(JSON.stringify(plan, null, 2))

    if (process.env.CONFIRM_BACKFILL !== 'yes') {
      console.log('\nNo changes applied. To apply run:')
      console.log('  CONFIRM_BACKFILL=yes node scripts/backfill-neonId.js')
      return
    }

    console.log('\nApplying backfill...')
    for (const p of plan) {
      if (p.conflictWith) {
        console.log('Skipping', p.id, 'neonId', p.neonId, 'conflicts with', p.conflictWith)
        continue
      }
      await client.query('UPDATE "User" SET "neonId" = $1 WHERE id = $2', [p.neonId, p.id])
      console.log('Updated', p.id, '-> neonId', p.neonId)
    }

    console.log('Backfill complete')
  } catch (e) {
    console.error(e)
  } finally {
    try { client.release() } catch (e) {}
    try { await pool.end() } catch (e) {}
  }
}

main()
