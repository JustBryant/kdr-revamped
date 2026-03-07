const fs = require('fs')
const path = require('path')

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

try {
  const p = path.join(__dirname, '..', '..', 'pages', 'api', 'admin', 'kdr', 'snapshot.ts')
  const exists = fs.existsSync(p)
  assert(exists, `expected ${p} to exist`)
  const src = fs.readFileSync(p, 'utf8')
  assert(src.includes('export default'), 'snapshot file should export default handler')
  console.log('Admin snapshot source present')
  process.exit(0)
} catch (e) {
  console.error('Admin snapshot test failed', e)
  process.exit(2)
}
