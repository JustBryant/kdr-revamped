import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import argon2 from 'argon2'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !(session.user && ((session.user as any).id || session.user.email))) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = (session.user as any).id as string | undefined
  const sessionEmail = session.user?.email as string | undefined

  if (req.method === 'GET') {
    try {
      // Prefer lookup by session user id (set by NextAuth callbacks). Fall back to email.
      const user = userId
        ? await prisma.user.findUnique({ where: { id: userId },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              favoriteCardId: true,
              favoriteCard: {
                select: {
                  id: true,
                  konamiId: true,
                  name: true,
                  imageUrlCropped: true,
                }
              }
            }
          })
        : await prisma.user.findUnique({
            where: { email: sessionEmail },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              favoriteCardId: true,
              favoriteCard: {
                select: {
                  id: true,
                  konamiId: true,
                  name: true,
                  imageUrlCropped: true,
                }
              }
            },
          });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching profile:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // Update profile details
    const { name, image, favoriteCardId } = req.body;

    try {
      const updatedUser = await prisma.user.update({
        where: userId ? { id: userId } : { email: sessionEmail! },
        data: {
          name,
          image,
          favoriteCardId: favoriteCardId || null,
        },
      });

      return res.status(200).json({ message: 'Profile updated', user: updatedUser });
    } catch (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else if (req.method === 'PATCH') {
    // Update password
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    try {
      // Verify against Neon auth; use column-detection helper
      const { findNeonUserByEmail, updatePasswordById } = await import('../../../lib/neonAuth')
      // For password updates we may not have an email (users who signed-in with username).
      // Use session email if present, otherwise fall back to session name.
      const identifier = sessionEmail || (session.user as any).name
      if (!identifier) return res.status(400).json({ message: 'No identifier available for password update' })
      const row = await findNeonUserByEmail(pool, identifier)
      if (!row) return res.status(404).json({ message: 'User not found' })

      const hashedKey = Object.keys(row).find(k => k.toLowerCase().includes('hash') || k.toLowerCase().includes('password'))
      const hashedValue = hashedKey ? row[hashedKey] : null
      const verified = hashedValue ? await argon2.verify(hashedValue, currentPassword).catch(() => false) : false
      if (!verified) return res.status(400).json({ message: 'Invalid current password' })

      const newHashed = await argon2.hash(newPassword)
      await updatePasswordById(pool, row.id, newHashed)

      // Clear any local password storage (prefer id lookup when available)
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { password: null } })
      } else if (sessionEmail) {
        await prisma.user.update({ where: { email: sessionEmail }, data: { password: null } })
      }

      return res.status(200).json({ message: 'Password updated' })
    } catch (error) {
      console.error('Error updating password:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
