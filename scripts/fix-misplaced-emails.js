#!/usr/bin/env node
// Safe fixer for users who have a username stored in the `email` column.
// Usage: CONFIRM_FIX=yes node scripts/fix-misplaced-emails.js

require('dotenv').config()
const { Pool } = require('pg')
const { PrismaClient } = require('@prisma/client')
// Use the same driver-adapter pattern as the app's `lib/prisma`.
const { PrismaPg } = require('@prisma/adapter-pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// Instantiate a fresh PrismaClient for this script with the adapter
const prisma = new PrismaClient({ adapter })

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  console.log('Scanning for users whose `email` does not look like an email...')
  const badUsers = await prisma.$queryRawUnsafe(`SELECT id, name, email FROM "User" WHERE email IS NOT NULL AND email NOT LIKE '%@%'`)

  if (!badUsers || badUsers.length === 0) {
    console.log('No suspicious rows found.')
    await pool.end()
    process.exit(0)
  }

  console.log(`Found ${badUsers.length} users with non-email values in email:`)
  badUsers.forEach(u => console.log(` - id=${u.id} email=${u.email} name=${u.name}`))

  // Prepare backup table
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_misplaced_emails AS SELECT * FROM "User" WHERE false`)

  // Show plan
  const plan = []
  for (const u of badUsers) {
    const identifier = u.email
    // Try to find Neon record by identifier (email OR name) to get canonical email
    const neonRes = await pool.query(`SELECT id, email FROM neon_auth."user" WHERE "email" = $1 OR "name" = $1 LIMIT 1`, [identifier])
    const neonRow = (neonRes && neonRes.rowCount > 0) ? neonRes.rows[0] : null

    if (neonRow && neonRow.email && neonRow.email.includes('@')) {
      // Check uniqueness
      const existing = await prisma.user.findUnique({ where: { email: neonRow.email } })
      if (!existing || existing.id === u.id) {
        plan.push({ id: u.id, action: 'setEmail', newEmail: neonRow.email, movedName: u.email })
      } else {
        plan.push({ id: u.id, action: 'moveToName', movedName: u.email, reason: 'emailTaken' })
      }
    } else {
      plan.push({ id: u.id, action: 'moveToName', movedName: u.email, reason: 'noNeonEmail' })
    }
  }

  console.log('\nPlanned changes:')
  plan.forEach(p => console.log(JSON.stringify(p)))

  if (process.env.CONFIRM_FIX !== 'yes') {
    console.log('\nNo changes applied. To apply these changes run:')
    console.log('  CONFIRM_FIX=yes node scripts/fix-misplaced-emails.js')
    await pool.end()
    process.exit(0)
  }

  console.log('\nApplying changes...')

  for (const p of plan) {
    // Backup row
    try {
      await pool.query(`INSERT INTO backup_misplaced_emails SELECT * FROM "User" WHERE id = $1`, [p.id])
    } catch (e) {
      console.error('Backup failed for', p.id, e)
      throw e
    }

    if (p.action === 'setEmail') {
      // Move old email into name if missing
      const user = await prisma.user.findUnique({ where: { id: p.id } })
      const newName = user.name || p.movedName || null
      try {
        await prisma.user.update({ where: { id: p.id }, data: { email: p.newEmail, name: newName } })
        console.log(`Updated user ${p.id}: set email=${p.newEmail} name=${newName}`)
      } catch (e) {
        console.error('Failed to update email for', p.id, e)
      }
    } else if (p.action === 'moveToName') {
      try {
        await prisma.user.update({ where: { id: p.id }, data: { name: p.movedName, email: null } })
        console.log(`Moved ${p.movedName} into name for user ${p.id} and cleared email`) 
      } catch (e) {
        console.error('Failed to move email into name for', p.id, e)
      }
    }
  }

  console.log('\nDone. Backups inserted into table `backup_misplaced_emails`.')
  await pool.end()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
