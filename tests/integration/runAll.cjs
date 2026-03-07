const { runHelperTests } = require('./testHelpers.cjs')
const path = require('path')

async function run() {
  try {
    await runHelperTests()
    // run minimal admin snapshot test
    require(path.join(__dirname, 'adminSnapshotTest.cjs'))
    // run audit log writability test
    require(path.join(__dirname, 'auditSnapshotTest.cjs'))
    console.log('All integration tests passed')
    process.exit(0)
  } catch (e) {
    console.error('Integration tests failed:', e)
    process.exit(2)
  }
}

run()
