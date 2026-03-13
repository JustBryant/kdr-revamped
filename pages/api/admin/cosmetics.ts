import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as any).role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    if (req.method === 'GET') {
        try {
            const { type, search, page = '1', limit = '50' } = req.query;
            const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

            const where: any = {};
            if (type && type !== 'ALL') {
                where.type = type;
            } else if (type === 'ALL') {
                where.type = {
                    in: ['BORDER', 'FRAME', 'TITLE', 'BACKGROUND', 'PROFILE_ICON', 'CARD_EFFECT', 'ICON_EFFECT']
                };
            } else {
                // Default to showing all shop-related types if no type filter
                where.type = {
                    in: ['BORDER', 'FRAME', 'TITLE', 'BACKGROUND', 'PROFILE_ICON', 'CARD_EFFECT', 'ICON_EFFECT']
                };
            }

            if (search) {
                where.OR = [
                    { name: { contains: search as string, mode: 'insensitive' } },
                    { description: { contains: search as string, mode: 'insensitive' } },
                ];
            }

            const [items, total] = await Promise.all([
                prisma.item.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: parseInt(limit as string),
                }),
                prisma.item.count({ where }),
            ]);

            return res.status(200).json({
                items,
                pagination: {
                    total,
                    pages: Math.ceil(total / parseInt(limit as string)),
                    currentPage: parseInt(page as string),
                }
            });
        } catch (error) {
            console.error('Admin Cosmetics GET error:', error);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    if (req.method === 'PUT') {
        try {
            const { id, name, description, price, isSellable, type } = req.body;

            if (!id) {
                return res.status(400).json({ message: 'Item ID is required' });
            }

            const updatedItem = await prisma.item.update({
                where: { id },
                data: {
                    name,
                    description,
                    price: price !== undefined ? parseInt(price) : undefined,
                    isSellable,
                    type,
                },
            });

            return res.status(200).json(updatedItem);
        } catch (error) {
            console.error('Admin Cosmetics PUT error:', error);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;
            if (!id) return res.status(400).json({ message: 'ID required' });

            await prisma.item.delete({
                where: { id: id as string },
            });

            return res.status(200).json({ message: 'Deleted successfully' });
        } catch (error) {
            console.error('Admin Cosmetics DELETE error:', error);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
}
