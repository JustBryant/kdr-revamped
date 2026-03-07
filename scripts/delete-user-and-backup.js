#!/usr/bin/env node
// Safely back up and delete a user and related rows referencing that user.
// Usage (preview): node scripts/delete-user-and-backup.js <userId>
// Apply: CONFIRM_DELETE=yes node scripts/delete-user-and-backup.js <userId>

require('dotenv').config()
const { Pool } = require('pg')

const userId = process.argv[2] || process.env.USER_ID
if (!userId) {
  console.error('Usage: node scripts/delete-user-and-backup.js <userId>')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function quoteIdent(name) { return '"' + name.replace(/"/g, '""') + '"' }

async function main() {
  const client = await pool.connect()
  try {
    // Find tables with columns that likely reference the user id
    const colRes = await client.query(`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE column_name ILIKE '%user%'
        AND table_schema = 'public'
      ORDER BY table_name
    `)

    const refs = colRes.rows.filter(r => r.table_name !== 'backup_deleted_users')
    // Group by table
    const tables = {}
    for (const r of refs) {
      const t = r.table_name
      tables[t] = tables[t] || new Set()
      tables[t].add(r.column_name)
    }

    // Ensure we back up the user row itself
    console.log('Found referencing tables:', Object.keys(tables))

    // Build plan
    const plan = []
    for (const [table, cols] of Object.entries(tables)) {
      for (const col of cols) {
        plan.push({ table, col })
      }
    }

    console.log('Preview: rows that would be backed up/deleted for user', userId)
    for (const p of plan) {
      const q = `SELECT COUNT(*) AS cnt FROM ${quoteIdent(p.table)} WHERE (${quoteIdent(p.col)})::text = $1`;
      const r = await client.query(q, [userId])
      console.log(` - ${p.table}.${p.col}: ${r.rows[0].cnt}`)
    }

    if (process.env.CONFIRM_DELETE !== 'yes') {
      console.log('\nNo changes applied. To delete run:')
      console.log(`  CONFIRM_DELETE=yes node scripts/delete-user-and-backup.js ${userId}`)
      return
    }

    console.log('\nApplying backups and deletes...')
    await client.query('BEGIN')

    // Create a central backup schema table list
    for (const [table, cols] of Object.entries(tables)) {
      const backupTable = 'backup_' + table
      await client.query(`CREATE TABLE IF NOT EXISTS ${quoteIdent(backupTable)} AS SELECT * FROM ${quoteIdent(table)} WHERE false`)
    }

    // Backup rows
    for (const p of plan) {
      const backupTable = 'backup_' + p.table
      const insertSql = `INSERT INTO ${quoteIdent(backupTable)} SELECT * FROM ${quoteIdent(p.table)} WHERE ${quoteIdent(p.col)}::text = $1`
      await client.query(insertSql, [userId])
    }

    // Delete from child tables first
    // We'll order by longest table name to try to delete children before parents (heuristic)
    const tablesOrdered = Object.keys(tables).sort((a,b)=>b.length-a.length)
    for (const table of tablesOrdered) {
      // skip deleting from the users backup itself until the end
      if (table === 'User') continue
      const cols = Array.from(tables[table])
      // delete rows where any of the candidate columns match
      const conditions = cols.map(c => `${quoteIdent(c)}::text = $1`).join(' OR ')
      const delSql = `DELETE FROM ${quoteIdent(table)} WHERE ${conditions}`
      const res = await client.query(delSql, [userId])
      console.log(`Deleted ${res.rowCount} rows from ${table}`)
    }

    // Backup and delete the user row
    await client.query(`CREATE TABLE IF NOT EXISTS ${quoteIdent('backup_User')} AS SELECT * FROM ${quoteIdent('User')} WHERE false`)
    await client.query(`INSERT INTO ${quoteIdent('backup_User')} SELECT * FROM ${quoteIdent('User')} WHERE id::text = $1`, [userId])
    const delUser = await client.query(`DELETE FROM ${quoteIdent('User')} WHERE id::text = $1`, [userId])
    console.log(`Deleted ${delUser.rowCount} rows from User`)    

    await client.query('COMMIT')
    console.log('Deletion complete. Backups stored in backup_<table> tables.')
  } catch (e) {
    console.error('Error during deletion, rolling back:', e)
    try { await client.query('ROLLBACK') } catch (er) {}
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err=>{ console.error(err); process.exit(1) })
