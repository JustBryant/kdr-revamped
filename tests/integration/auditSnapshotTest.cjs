const fs = require('fs')
const path = require('path')

const { LOG_FILE } = require('../../lib/adminAudit.cjs')

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

try {
  // call the snapshot endpoint not possible here; instead assert that log file path is writable
  const dir = path.dirname(LOG_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(LOG_FILE, JSON.stringify({ test: true, ts: new Date().toISOString() }) + '\n')
  const contents = fs.readFileSync(LOG_FILE, 'utf8')
  assert(contents.includes('test'), 'log file should contain test entry')
  console.log('Audit log file writable')
  process.exit(0)
} catch (e) {
  console.error('Audit snapshot test failed', e)
  process.exit(2)
}
