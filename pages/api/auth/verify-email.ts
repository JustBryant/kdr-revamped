import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

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

    // Also set Neon auth user's verified timestamp if neon_auth exists
    try {
      const { setEmailVerified } = await import('../../../lib/neonAuth')
      await setEmailVerified(pool, verificationToken.identifier)
    } catch (e) {
      // If the neon_auth schema/table doesn't exist or update fails, log and continue
      console.warn('Failed to update neon_auth.users email_verified_at:', (e as any).message || e)
    }

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
