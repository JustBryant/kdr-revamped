import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userEmail = session.user.email;

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
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
              imageUrl: true,
              imageUrlSmall: true,
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
        where: { email: userEmail },
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
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user || !user.password) {
        return res.status(404).json({ message: 'User not found or no password set' });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid current password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { email: userEmail },
        data: {
          password: hashedPassword,
        },
      });

      return res.status(200).json({ message: 'Password updated' });
    } catch (error) {
      console.error('Error updating password:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
