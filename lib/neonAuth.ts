import { Pool } from 'pg'

type ColMap = {
  id: string
  email: string
  name?: string | null
  hashed?: string | null
  raw_meta?: string | null
  email_verified_at?: string | null
  types?: Record<string, string>
}

let _cached: ColMap | null = null

export async function detectNeonAuthColumns(pool: Pool): Promise<ColMap> {
  if (_cached) return _cached

  const res = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
    ['neon_auth', 'user']
  )

  const cols = new Set(res.rows.map((r: any) => r.column_name))
  const types: Record<string, string> = {}
  res.rows.forEach((r: any) => { types[r.column_name] = r.data_type })
  const allCols = Array.from(cols)

  const findMatch = (rx: RegExp) => allCols.find(c => rx.test(c)) || null

  const map: ColMap = {
    id: findMatch(/^id$/i) || allCols[0] || 'id',
    email: findMatch(/email/i) || allCols[0] || 'email',
    name: findMatch(/^(name|full_name|display_name|username)$/i) || findMatch(/name/i) || null,
    hashed: findMatch(/(hash|password)/i) || null,
    raw_meta: findMatch(/(raw.*meta|user_meta|raw)/i) || null,
    email_verified_at: findMatch(/verified/i) || null,
    types,
  }

  _cached = map
  return map
}

function quoteIdent(name: string) {
  return '"' + name.replace(/"/g, '""') + '"'
}

export async function insertNeonUser(pool: Pool, email: string, hashedPassword: string | null, rawMeta: any) {
  const cols = await detectNeonAuthColumns(pool)

  const parts: string[] = []
  const vals: string[] = []
  const params: any[] = []

  parts.push(quoteIdent(cols.email)); params.push(email); vals.push(`$${params.length}`)
  if (cols.hashed && hashedPassword) {
    parts.push(quoteIdent(cols.hashed)); params.push(hashedPassword); vals.push(`$${params.length}`)
  }
  // If the Neon auth table exposes a name column and we have a value in rawMeta, include it
  if (cols.name) {
    const nameVal = (rawMeta && (rawMeta.name || rawMeta.displayName || rawMeta.username)) || null
    // If name is required non-null in the table, derive a fallback from the email local-part
    const finalName = nameVal ?? (email ? email.split('@')[0] : null)
    parts.push(quoteIdent(cols.name)); params.push(finalName); vals.push(`$${params.length}`)
  }
  if (cols.raw_meta) {
    parts.push(quoteIdent(cols.raw_meta)); params.push(JSON.stringify(rawMeta)); vals.push(`$${params.length}`)
  }

  // If the Neon auth table exposes an email-verified column, include a typed
  // fallback now based on information_schema so we avoid NOT NULL insert errors.
  if (cols.email_verified_at) {
    try {
      const evCol = cols.email_verified_at
      const evType = cols.types && evCol ? (cols.types[evCol] || '').toLowerCase() : ''
      let evFallback: any = null
      if (evType.includes('bool') || evType.includes('boolean')) evFallback = false
      else if (evType.includes('timestamp') || evType.includes('date') || evType.includes('time')) evFallback = new Date().toISOString()
      else evFallback = new Date().toISOString()

      parts.push(quoteIdent(evCol)); params.push(evFallback); vals.push(`$${params.length}`)
    } catch (e) {
      // ignore and let catch-retry handle it
    }
  }

  const table = 'neon_auth.' + quoteIdent('user')

  const returning = ['id']
  if (cols.email_verified_at) returning.push(quoteIdent(cols.email_verified_at))

  const sql = `INSERT INTO ${table} (${parts.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT (email) DO NOTHING RETURNING ${returning.join(',')}`

  try {
    const r = await pool.query(sql, params)
    if ((r?.rowCount ?? 0) > 0) return r.rows[0]
  } catch (e: any) {
    // If insert failed due to a NOT NULL constraint on a column, attempt to supply a sensible fallback and retry once
    if (e && e.code === '23502') {
      // try to determine missing column name
      let missingCol = e.column
      if (!missingCol && e.detail) {
        const m = /column "([^"]+)"/i.exec(e.detail)
        if (m) missingCol = m[1]
      }
      if (!missingCol && e.message) {
        const m2 = /column "([^"]+)"/i.exec(e.message)
        if (m2) missingCol = m2[1]
      }

      if (missingCol) {
        // If we already included it, rethrow
        const quoted = quoteIdent(missingCol)
        if (!parts.includes(quoted)) {
          // determine fallback value by querying the column type (boolean vs timestamp-like)
          let fallback: any = ''
          try {
            const colRes = await pool.query(
              `SELECT data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
              ['neon_auth', 'user', missingCol]
            )
            const ctype = (colRes.rows && colRes.rows[0] && colRes.rows[0].data_type) ? String(colRes.rows[0].data_type).toLowerCase() : ''
            const lower = missingCol.toLowerCase()
            if (ctype.includes('bool')) {
              // boolean verified columns should default to false
              fallback = false
            } else if (ctype.includes('timestamp') || ctype.includes('date') || ctype.includes('time')) {
              fallback = new Date().toISOString()
            } else if (lower.includes('verified')) {
              // fallback to timestamp for verified-like names if type unknown
              fallback = new Date().toISOString()
            } else if (lower.includes('name')) {
              fallback = (rawMeta && (rawMeta.name || rawMeta.displayName || rawMeta.username)) || (email ? email.split('@')[0] : '')
            } else if (lower.includes('email')) {
              fallback = email
            } else {
              fallback = ''
            }
          } catch (ee) {
            const lower = missingCol.toLowerCase()
            if (lower.includes('verified')) fallback = new Date().toISOString()
            else if (lower.includes('name')) fallback = (rawMeta && (rawMeta.name || rawMeta.displayName || rawMeta.username)) || (email ? email.split('@')[0] : '')
            else if (lower.includes('email')) fallback = email
            else fallback = ''
          }

          parts.push(quoted)
          params.push(fallback)
          vals.push(`$${params.length}`)

          const sql2 = `INSERT INTO ${table} (${parts.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT (email) DO NOTHING RETURNING ${returning.join(',')}`
          const r2 = await pool.query(sql2, params)
          if ((r2?.rowCount ?? 0) > 0) return r2.rows[0]
        }
      }
    }
    throw e
  }

  // If insert didn't return, try select to get id
  const sel = await pool.query(`SELECT id${cols.email_verified_at ? ', ' + quoteIdent(cols.email_verified_at) : ''} FROM ${table} WHERE ${quoteIdent(cols.email)} = $1 LIMIT 1`, [email])
  const userRow = (sel?.rowCount ?? 0) > 0 ? sel.rows[0] : null

  // If we created or found the user and a hashedPassword was provided, ensure there's an account row for credentials
  if (userRow && hashedPassword) {
    try {
      const accTable = 'neon_auth.' + quoteIdent('account')
      // Use email as accountId and providerId 'credentials' for local password accounts
      const accSql = `INSERT INTO ${accTable} (${quoteIdent('accountId')}, ${quoteIdent('providerId')}, ${quoteIdent('userId')}, ${quoteIdent('password')}, ${quoteIdent('createdAt')}, ${quoteIdent('updatedAt')}) VALUES ($1,$2,$3,$4, now(), now()) ON CONFLICT DO NOTHING`
      await pool.query(accSql, [email, 'credentials', userRow.id, hashedPassword])
      // If an account row existed without a password, update it to set the hashed password
      try {
        const updSql = `UPDATE ${accTable} SET ${quoteIdent('password')} = $1, ${quoteIdent('updatedAt')} = now() WHERE ${quoteIdent('providerId')} = $2 AND ${quoteIdent('userId')} = $3 AND (${quoteIdent('password')} IS NULL OR ${quoteIdent('password')} = '') RETURNING id`
        const upd = await pool.query(updSql, [hashedPassword, 'credentials', userRow.id])
        if ((upd?.rowCount ?? 0) > 0) console.debug('insertNeonUser: updated existing account password for user', userRow.id)
      } catch (ue) {
        console.debug('insertNeonUser: failed to update existing account password', (ue as any)?.message ?? String(ue))
      }
    } catch (e) {
      // non-fatal: log and continue
      console.debug('insertNeonUser: failed to insert account row', (e as any)?.message ?? String(e))
    }
  }

  return userRow
}

export async function findNeonUserByEmail(pool: Pool, email: string) {
  // Query user and any linked credentials account (account.password)
  const userTable = 'neon_auth.' + quoteIdent('user')
  const accTable = 'neon_auth.' + quoteIdent('account')
  const sql = `SELECT u.${quoteIdent('id')} as id, u.${quoteIdent('email')} as email, u.${quoteIdent('emailVerified')} as email_verified, u.${quoteIdent('image')} as image, a.${quoteIdent('password')} as account_password, a.${quoteIdent('providerId')} as providerId FROM ${userTable} u LEFT JOIN ${accTable} a ON a.${quoteIdent('userId')} = u.${quoteIdent('id')} AND a.${quoteIdent('providerId')} = $2 WHERE (u.${quoteIdent('email')} = $1 OR u.${quoteIdent('name')} = $1) LIMIT 1`
  console.debug('findNeonUserByEmail SQL:', sql, 'identifier:', email)
  const r = await pool.query(sql, [email, 'credentials'])
  if ((r?.rowCount ?? 0) > 0) {
    const row = r.rows[0]
    try {
      console.debug('findNeonUserByEmail row keys:', Object.keys(row))
    } catch (e) {}
    return row
  }
  return null
}

export async function updatePasswordByEmail(pool: Pool, email: string, newHashed: string) {
  // Find the user id by email, then update/insert the credentials account row's password
  const userRes = await pool.query(`SELECT id FROM neon_auth."user" WHERE "email" = $1 LIMIT 1`, [email])
  if ((userRes?.rowCount ?? 0) === 0) throw new Error('No neon_auth user found for email')
  const userId = userRes.rows[0].id
  const accTable = 'neon_auth.' + quoteIdent('account')
  // Try update existing credentials account
  const upd = await pool.query(`UPDATE ${accTable} SET "password" = $1, "updatedAt" = now() WHERE "providerId" = $2 AND "userId" = $3 RETURNING id`, [newHashed, 'credentials', userId])
  if ((upd?.rowCount ?? 0) === 0) {
    // Insert a new account row if none existed
    const ins = `INSERT INTO ${accTable} ("accountId","providerId","userId","password","createdAt","updatedAt") VALUES ($1,$2,$3,$4, now(), now())`
    return pool.query(ins, [email, 'credentials', userId, newHashed])
  }
  return upd
}

export async function updatePasswordById(pool: Pool, id: any, newHashed: string) {
  const accTable = 'neon_auth.' + quoteIdent('account')
  const upd = await pool.query(`UPDATE ${accTable} SET "password" = $1, "updatedAt" = now() WHERE "providerId" = $2 AND "userId" = $3 RETURNING id`, [newHashed, 'credentials', id])
  if ((upd?.rowCount ?? 0) === 0) {
    // Need an email to insert accountId; try to find the user's email
    const res = await pool.query(`SELECT email FROM neon_auth."user" WHERE id = $1 LIMIT 1`, [id])
    const email = (res?.rowCount ?? 0) > 0 ? res.rows[0].email : null
    if (!email) throw new Error('No neon_auth user found for id')
    const ins = `INSERT INTO ${accTable} ("accountId","providerId","userId","password","createdAt","updatedAt") VALUES ($1,$2,$3,$4, now(), now())`
    return pool.query(ins, [email, 'credentials', id, newHashed])
  }
  return upd
}

export async function setEmailVerified(pool: Pool, email: string) {
  const cols = await detectNeonAuthColumns(pool)
  const table = 'neon_auth.' + quoteIdent('user')
  if (!cols.email_verified_at) throw new Error('Neon auth table has no email verified column')
  const evCol = cols.email_verified_at
  const evType = cols.types && evCol ? (cols.types[evCol] || '').toLowerCase() : ''
  if (evType.includes('bool')) {
    const sql = `UPDATE ${table} SET ${quoteIdent(evCol)} = true WHERE ${quoteIdent(cols.email)} = $1`
    return pool.query(sql, [email])
  }
  const sql = `UPDATE ${table} SET ${quoteIdent(evCol)} = now() WHERE ${quoteIdent(cols.email)} = $1`
  return pool.query(sql, [email])
}
