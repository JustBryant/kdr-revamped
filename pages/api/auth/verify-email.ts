import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Email verification endpoint is disabled; verification is automatic when signing in via Discord.
  return res.status(403).json({ message: 'Email verification via token is disabled. Use Discord to sign in.' })
}
