import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import argon2 from 'argon2'
import { Pool } from 'pg'
import { insertNeonUser } from '../../../lib/neonAuth'
import crypto from 'crypto'
import { sendVerificationEmail } from '../../../lib/email'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Email/password registration is disabled. Use Discord OAuth to create accounts.
  if (req.method === 'POST') {
    return res.status(403).json({ message: 'Email/password registration is disabled. Please sign up using Discord.' })
  }
  return res.status(405).json({ message: 'Method not allowed' })
}