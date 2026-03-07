import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]"
import { prisma } from "../../../lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) {
    return res.status(401).json({ message: 'User not found' })
  }

  const { name, main, extra, side, deckId, classId } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Deck name is required' })
  }

  if (!classId && !deckId) {
     // If we are creating a new deck, we might need a classId. 
     // For now, I'll make classId optional if just saving a generic deck, 
     // but the schema says deck needs a classId?
  }

  // Check Schema for ClassId requirement on Deck
  // model Deck { classId String ... }
  // It is required. So we must provide a classId when creating.

  try {
    let targetDeckId = deckId

    // Basic input validation
    const validateCards = (arr: any[]) => Array.isArray(arr) && arr.every((c: any) => c && c.card && typeof c.card.id === 'string' && Number.isInteger(Number(c.qty)) && Number(c.qty) > 0)
    if (!validateCards(main || []) || !validateCards(extra || []) || !validateCards(side || [])) {
      return res.status(400).json({ message: 'Invalid card payload. Each card must have `card.id` and numeric `qty`.' })
    }

    // Run create/update and card insertion in a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      if (targetDeckId) {
        const existing = await tx.deck.findUnique({ where: { id: targetDeckId } })
        if (!existing || existing.userId !== user.id) {
          throw new Error('FORBIDDEN')
        }

        await tx.deck.update({ where: { id: targetDeckId }, data: { name } })
        await tx.deckCard.deleteMany({ where: { deckId: targetDeckId } })
      } else {
        if (!classId) {
          throw new Error('MISSING_CLASS')
        }
        const newDeck = await tx.deck.create({ data: { name, userId: user.id, classId } })
        targetDeckId = newDeck.id
      }

      const createCards = (cards: any[], location: string) => {
        return cards.map((c: any) => ({ deckId: targetDeckId, cardId: c.card.id, quantity: Number(c.qty), location }))
      }

      const allCards = [
        ...createCards(main || [], 'MAIN'),
        ...createCards(extra || [], 'EXTRA'),
        ...createCards(side || [], 'SIDE')
      ]

      if (allCards.length > 0) {
        await tx.deckCard.createMany({ data: allCards })
      }

      return { id: targetDeckId }
    })

    return res.status(200).json({ message: 'Deck saved', id: result.id })
  } catch (error) {
    console.error('Save Deck Error:', error)
    // Extract Prisma error details if available
    let detailedError = String(error)
    if (String(error) === 'Error: FORBIDDEN') return res.status(403).json({ message: 'Forbidden' })
    if (String(error) === 'Error: MISSING_CLASS') return res.status(400).json({ message: 'Class ID is required for new decks' })
    if (typeof error === 'object' && error !== null && 'code' in error) {
      detailedError += ` (Code: ${(error as any).code})`
      if ((error as any).meta) detailedError += ` Meta: ${JSON.stringify((error as any).meta)}`
    }
    return res.status(500).json({ message: 'Internal server error', error: detailedError })
  }
}
