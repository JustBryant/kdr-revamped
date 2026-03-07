import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  
  if (!session || !session.user || !session.user.email) {
    console.log('[API] /decks/list - No session or email found')
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) {
    console.log('[API] /decks/list - User not found for email:', session.user.email)
    return res.status(401).json({ message: 'User not found' })
  }

  try {
    const decks = await prisma.deck.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        class: {
          select: {
            name: true,
            image: true
          }
        },
        _count: {
            select: { cards: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    
    console.log(`[API] /decks/list - Found ${decks.length} decks for user ${user.id}`)

    return res.status(200).json(decks)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error', error: String(error) })
  }
}
