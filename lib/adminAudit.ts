import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'admin_audit.log')

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

export type AuditEntry = {
  adminEmail: string
  action: string // e.g., 'KICK_PLAYER', 'OVERRIDE_MATCH', 'DELETE_KDR'
  targetId: string | number
  details?: any
  timestamp?: string
}

export function appendAudit(entry: AuditEntry) {
  ensureLogDir()
  const out = { ...entry, timestamp: new Date().toISOString() }
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(out) + '\n', 'utf8')
    return out
  } catch (e) {
    console.error('Failed to write audit log', e)
    // We don't want to crash the whole request if logging fails, 
    // but in a real-world scenario we might want stricter guarantees.
  }
}
