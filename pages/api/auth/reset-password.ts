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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { token, password } = req.body

  if (!token || !password) {
    return res.status(400).json({ message: 'Missing token or password' })
  }

  // Password Strength Validation (Same as register)
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number.' })
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    })

    if (!resetToken) {
      return res.status(400).json({ message: 'Invalid or expired token' })
    }

    if (new Date() > resetToken.expires) {
      return res.status(400).json({ message: 'Token expired' })
    }

    // Hash with argon2 and update Neon auth record
    const hashedPassword = await argon2.hash(password)

    try {
      const { updatePasswordByEmail } = await import('../../../lib/neonAuth')
      await updatePasswordByEmail(pool, resetToken.identifier, hashedPassword)
    } catch (e) {
      console.error('Failed to update neon_auth password', e)
      return res.status(500).json({ message: 'Failed to update password' })
    }

    // Ensure local record does not store password
    await prisma.user.update({
      where: { email: resetToken.identifier },
      data: { password: null }
    })

    // Delete Token
    await prisma.passwordResetToken.delete({
      where: { token }
    })

    res.status(200).json({ message: 'Password reset successfully. You can now sign in.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
