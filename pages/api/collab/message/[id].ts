import type { NextApiRequest, NextApiResponse } from 'next'
import { getMessage } from '../../../../lib/collabMessageStore'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query || {}
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })
  const msg = getMessage(id)
  if (!msg) return res.status(404).json({ error: 'Message not found or expired' })
  return res.status(200).json(msg)
}
