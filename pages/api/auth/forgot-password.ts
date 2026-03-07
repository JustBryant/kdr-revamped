import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '../../../lib/email'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Missing email' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({ message: 'If an account exists with that email, we sent a password reset link.' })
    }

    // Generate Reset Token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(new Date().getTime() + 1 * 60 * 60 * 1000) // 1 hour

    // Delete any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { identifier: email }
    })

    await prisma.passwordResetToken.create({
      data: {
        identifier: email,
        token,
        expires
      }
    })

    // Send email
    const emailResult = await sendPasswordResetEmail(email, token)

    if (!emailResult.success) {
      console.error('Failed to send reset email', emailResult.error)
      return res.status(500).json({ message: 'Failed to send email.' })
    }

    res.status(200).json({ message: 'If an account exists with that email, we sent a password reset link.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
