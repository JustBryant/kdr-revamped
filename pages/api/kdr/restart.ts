import { NextApiRequest, NextApiResponse } from 'next'

// Restart endpoint disabled — kept for compatibility but returns 404.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).json({ error: 'Restart KDR endpoint disabled' })
}
