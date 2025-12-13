import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { token } = req.query

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid token' })
  }

  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    })

    if (!verificationToken) {
      return res.status(400).json({ message: 'Invalid token' })
    }

    if (new Date() > verificationToken.expires) {
      return res.status(400).json({ message: 'Token expired' })
    }

    // Verify User
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() }
    })

    // Delete Token
    await prisma.verificationToken.delete({
      where: { token }
    })

    // Redirect to login or success page
    res.redirect('/auth/signin?verified=true')
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
}
