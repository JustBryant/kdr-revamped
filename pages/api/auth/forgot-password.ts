import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '../../../lib/email'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Password/email flows are disabled. Use Discord OAuth instead.
  if (req.method === 'POST') {
    return res.status(403).json({ message: 'Password reset via email is disabled. Use Discord to sign in.' })
  }
  return res.status(405).json({ message: 'Method not allowed' })
}
