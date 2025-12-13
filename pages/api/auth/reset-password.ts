import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

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

    const hashedPassword = await bcrypt.hash(password, 10)

    // Update User Password
    await prisma.user.update({
      where: { email: resetToken.identifier },
      data: { password: hashedPassword }
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
