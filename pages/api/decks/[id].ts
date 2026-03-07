import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Invalid ID' })

  // DELETE: Delete a deck
  if (req.method === 'DELETE') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || !session.user || !session.user.email) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: session.user.email } })
        if (!user) return res.status(401).json({ message: 'User not found' })

        const deck = await prisma.deck.findUnique({ where: { id } })
        if (!deck) return res.status(404).json({ message: 'Deck not found' })
        
        if (deck.userId !== user.id) {
            return res.status(403).json({ message: 'Forbidden: You do not own this deck' })
        }

        await prisma.deck.delete({ where: { id } })
        return res.status(200).json({ message: 'Deck deleted successfully' })
    } catch (e) {
        return res.status(500).json({ message: 'Internal server error', error: String(e) })
    }
  }

  // GET: Fetch a deck
  try {
    const deck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      }
    })

    if (!deck) return res.status(404).json({ message: 'Deck not found' })

    // Optional: Check visibility? For now decks are viewable if you have the ID? 
    // Or should we strict check? The request context is "Load Deck" on frontend which implies my decks.
    // But sharing decks links might be a thing. Let's leave it open to read for now unless it becomes an issue.

    return res.json(deck)
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' })
  }
}
