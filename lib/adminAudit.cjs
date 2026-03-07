const fs = require('fs')
const path = require('path')

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'admin_audit.log')

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
}

function appendAudit(entry) {
  ensureLogDir()
  const out = Object.assign({}, entry, { timestamp: new Date().toISOString() })
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(out) + '\n', 'utf8')
    return out
  } catch (e) {
    console.error('Failed to write audit log', e)
    throw e
  }
}

module.exports = { appendAudit, LOG_FILE }
