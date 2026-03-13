import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'
import argon2 from 'argon2'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Password reset via email is disabled. Use Discord OAuth instead.
  if (req.method === 'POST') {
    return res.status(403).json({ message: 'Password reset via email is disabled. Use Discord to sign in.' })
  }
  return res.status(405).json({ message: 'Method not allowed' })
}
