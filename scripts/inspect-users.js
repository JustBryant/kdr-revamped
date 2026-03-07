#!/usr/bin/env node
require('dotenv').config()
const { Pool } = require('pg')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const ids = process.argv.slice(2)
if (ids.length === 0) { console.error('Usage: node scripts/inspect-users.js <id> [id2 ...]'); process.exit(1) }
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    for (const id of ids) {
      const u = await prisma.user.findUnique({ where: { id } })
      console.log('Local user', id, u)
      // Cast id to text for safe comparisons against email/name values
      const neon = await pool.query('SELECT id, email, name FROM neon_auth."user" WHERE id::text = $1 OR email = $1 OR name = $1 LIMIT 1', [id])
      console.log('Neon lookup for', id, neon.rows)
    }
  } catch (e) { console.error(e) }
  finally { await pool.end(); await prisma.$disconnect() }
}
main()
