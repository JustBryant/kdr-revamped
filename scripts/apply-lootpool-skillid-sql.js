// Apply direct SQL alterations to add `skillId` and FK to LootPoolItem.
// Run with: `node ./scripts/apply-lootpool-skillid-sql.js`
// Requires DATABASE_URL environment variable.

const { Client } = require('pg')

async function main() {
  const conn = process.env.DATABASE_URL
  if (!conn) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const client = new Client({ connectionString: conn })
  await client.connect()

  try {
    console.log('Adding column skillId to LootPoolItem (if not exists)')
    await client.query(`ALTER TABLE "LootPoolItem" ADD COLUMN IF NOT EXISTS "skillId" TEXT`) 
    console.log('Adding foreign key constraint (if not exists)')
    // Add FK constraint only if it does not already exist
    const fkName = 'LootPoolItem_skillId_fkey'
    const res = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [fkName])
    if (res.rowCount === 0) {
      await client.query(`ALTER TABLE "LootPoolItem" ADD CONSTRAINT "${fkName}" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL`)
      console.log('Foreign key constraint added')
    } else {
      console.log('Foreign key constraint already exists')
    }
    console.log('Done')
  } catch (e) {
    console.error('Failed to apply SQL:', e)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
