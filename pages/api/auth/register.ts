import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import argon2 from 'argon2'
import { Pool } from 'pg'
import { insertNeonUser } from '../../../lib/neonAuth'
import crypto from 'crypto'
import { sendVerificationEmail } from '../../../lib/email'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  const { email, password, username, name } = req.body ?? {}
  const displayName = (name ?? username) as string | undefined

  if (!email || !password || !displayName) {
    return res.status(400).json({ message: 'Missing email, name/username, or password' })
  }

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number.' })
  }

  try {
    const candidateTables = ['"User"', 'user', 'users']
    for (const t of candidateTables) {
      try {
        const colRes = await pool.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
          [t.replace(/"/g, ''), 'email']
        )
        if (colRes.rowCount === 0) continue
        const sel = await pool.query(`SELECT id FROM ${t} WHERE email = $1 LIMIT 1`, [email])
        if ((sel?.rowCount ?? 0) > 0) return res.status(400).json({ message: 'User already exists with that email' })
      } catch (_) { continue }
    }

    for (const t of candidateTables) {
      try {
        const colRes = await pool.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
          [t.replace(/"/g, ''), 'name']
        )
        if (colRes.rowCount === 0) continue
        const sel = await pool.query(`SELECT id FROM ${t} WHERE name = $1 LIMIT 1`, [displayName])
        if ((sel?.rowCount ?? 0) > 0) return res.status(400).json({ message: 'Name already taken' })
      } catch (_) { continue }
    }

    const hashedPassword = await argon2.hash(password)

    // Default to Blue-Eyes White Dragon
    const imageUrl = "https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/89631139.jpg"

    let neonUserId: string | null = null
    try {
      const neonRes = await insertNeonUser(pool, email, hashedPassword, { name: displayName })
      if (!neonRes) {
        throw new Error('Neon auth insertion returned null')
      }
      neonUserId = (neonRes.id ?? neonRes.user_id ?? neonRes.uid ?? null) as string | null
      if (!neonUserId) {
        throw new Error('Neon auth insertion did not return a valid user ID')
      }
    } catch (e) {
      console.error('insertNeonUser failed', e)
      return res.status(500).json({ message: 'Failed to create user in auth store' })
    }

    try {
      await prisma.user.create({ data: { email, name: displayName, neonId: neonUserId, password: null, image: imageUrl ?? undefined } })
    } catch (e) {
      console.error('prisma.user.create failed', e)
      return res.status(500).json({ message: 'Failed to create local user record' })
    }

    try {
      const token = crypto.randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await prisma.verificationToken.create({ data: { identifier: email, token, expires } })
      const emailResult = await sendVerificationEmail(email, token)
      if (!emailResult.success) {
        console.error('sendVerificationEmail failed', emailResult.error)
        return res.status(500).json({ message: 'User created but failed to send verification email.' })
      }
    } catch (e) {
      console.error('verification flow failed', e)
      return res.status(500).json({ message: 'Failed to create verification token / send email' })
    }

    return res.status(201).json({ message: 'User created. Please check your email to verify your account.' })
  } catch (err: any) {
    console.error('registration top-level error', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
}