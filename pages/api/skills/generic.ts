import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (req.method === 'GET') {
    try {
      const skills = await prisma.skill.findMany({
        where: {
          type: 'GENERIC',
          classId: null,
        },
        include: {
          modifications: {
            include: {
              card: true
            }
          },
          providesCards: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      return res.status(200).json(skills);
    } catch (error) {
      console.error('Error fetching generic skills:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    const { name, description, isSellable, modifications, providesCards } = req.body;

    try {
      const skill = await prisma.skill.create({
        data: {
          name,
          description,
          type: 'GENERIC',
          isSellable,
          providesCards: {
            connect: providesCards?.map((card: any) => ({ id: card.id })) || []
          },
          modifications: {
            create: modifications.map((mod: any) => ({
              cardId: mod.card.id,
              type: mod.type,
              highlightedText: mod.highlightedText,
              alteredText: mod.alteredText,
              note: mod.note
            }))
          }
        },
        include: {
          modifications: {
            include: {
              card: true
            }
          },
          providesCards: true
        }
      });
      return res.status(201).json(skill);
    } catch (error) {
      console.error('Error creating generic skill:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    const { id, name, description, isSellable, modifications, providesCards } = req.body;

    try {
      // First delete existing modifications to replace them
      await prisma.skillCardModification.deleteMany({
        where: { skillId: id }
      });

      const skill = await prisma.skill.update({
        where: { id },
        data: {
          name,
          description,
          isSellable,
          providesCards: {
            set: [], // Clear existing connections
            connect: providesCards?.map((card: any) => ({ id: card.id })) || []
          },
          modifications: {
            create: modifications.map((mod: any) => ({
              cardId: mod.card.id,
              type: mod.type,
              highlightedText: mod.highlightedText,
              alteredText: mod.alteredText,
              note: mod.note
            }))
          }
        },
        include: {
          modifications: {
            include: {
              card: true
            }
          },
          providesCards: true
        }
      });
      return res.status(200).json(skill);
    } catch (error) {
      console.error('Error updating generic skill:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Missing id' });
    }

    try {
      await prisma.skill.delete({
        where: { id }
      });
      return res.status(200).json({ message: 'Skill deleted' });
    } catch (error) {
      console.error('Error deleting generic skill:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
