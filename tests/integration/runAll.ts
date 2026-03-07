const { runHelperTests } = require('./testHelpers')

async function run() {
  try {
    await runHelperTests()
    console.log('All integration tests passed')
    process.exit(0)
  } catch (e) {
    console.error('Integration tests failed:', e)
    process.exit(2)
  }
}

run()
