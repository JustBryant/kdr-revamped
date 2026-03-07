#!/usr/bin/env node
// Usage: node scripts/fill-missing-email-for-user.js <userId>
// or: USER_ID=... node scripts/fill-missing-email-for-user.js

require('dotenv').config()
const { Pool } = require('pg')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const userId = process.argv[2] || process.env.USER_ID
if (!userId) {
  console.error('Usage: node scripts/fill-missing-email-for-user.js <userId>')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      console.error('User not found:', userId)
      process.exit(1)
    }

    if (user.email && user.email.includes('@')) {
      console.log('User already has an email:', user.email)
      process.exit(0)
    }

    const identifier = user.name || user.id
    console.log('Looking up Neon for identifier:', identifier)

    // Match by email OR name (avoid comparing id to non-UUID strings)
    const res = await pool.query('SELECT id, email, name FROM neon_auth."user" WHERE "email" = $1 OR "name" = $1 LIMIT 1', [identifier])
    const neonRow = (res && res.rowCount > 0) ? res.rows[0] : null
    if (!neonRow) {
      console.log('No matching Neon auth user found for identifier')
      process.exit(0)
    }

    const neonEmail = neonRow.email
    if (!neonEmail || !neonEmail.includes('@')) {
      console.log('Neon row found but email not available or not valid:', neonEmail)
      process.exit(0)
    }

    // Check uniqueness
    const existing = await prisma.user.findUnique({ where: { email: neonEmail } })
    if (existing && existing.id !== user.id) {
      console.log('Email from Neon is already used by another user:', existing.id)
      process.exit(0)
    }

    // Backup current row
    await pool.query('CREATE TABLE IF NOT EXISTS backup_email_updates AS SELECT * FROM "User" WHERE false')
    await pool.query('INSERT INTO backup_email_updates SELECT * FROM "User" WHERE id = $1', [user.id])

    // Apply update
    await prisma.user.update({ where: { id: user.id }, data: { email: neonEmail } })
    console.log('Updated user', user.id, 'email ->', neonEmail)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  } finally {
    try { await pool.end() } catch (e) {}
    try { await prisma.$disconnect() } catch (e) {}
  }
}

main()
