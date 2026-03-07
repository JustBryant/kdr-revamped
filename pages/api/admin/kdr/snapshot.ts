import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { prisma } from '../../../../lib/prisma'
const { appendAudit } = require('../../../../lib/adminAudit.cjs')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(403).json({ error: 'Forbidden' })
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!dbUser || dbUser.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Accept either a single kdrId, or formatSlug to refresh all live KDRs using that format
    const { kdrId, formatSlug } = req.body || {}

    if (!kdrId && !formatSlug) return res.status(400).json({ error: 'Missing kdrId or formatSlug' })

    // Resolve settings: the current schema stores format-specific settings on Format.settings (Json)
    let format = null
    if (formatSlug && typeof formatSlug === 'string') {
      format = await prisma.format.findUnique({ where: { slug: formatSlug } })
      if (!format) return res.status(404).json({ error: 'Format not found' })
    }

    let settings: any = null
    if (format) {
      settings = format.settings
    } else if (kdrId && typeof kdrId === 'string') {
      const kdr = await prisma.kDR.findUnique({ where: { id: kdrId } })
      if (!kdr) return res.status(404).json({ error: 'KDR not found' })
      if (!kdr.formatId) return res.status(400).json({ error: 'KDR has no format to snapshot from' })
      const fmt = await prisma.format.findUnique({ where: { id: kdr.formatId } })
      if (!fmt) return res.status(404).json({ error: 'Format not found for KDR' })
      settings = fmt.settings
    }

    if (!settings) return res.status(404).json({ error: 'Game settings not found for target format' })

    const snapshot = (typeof settings === 'object' && settings !== null) ? settings : { settings }

    // Update KDR(s)
    if (kdrId && typeof kdrId === 'string') {
      const updated = await prisma.kDR.update({ where: { id: kdrId }, data: { settingsSnapshot: snapshot } })
      try { appendAudit({ action: 'refresh_snapshot', target: 'kdr', kdrId, user: session.user?.email }) } catch (e) {}
      return res.status(200).json({ message: 'Snapshot updated', kdr: updated })
    }

    // formatSlug provided: update all non-completed KDRs using this format
    const where = { formatId: format!.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
    const kdrs = await prisma.kDR.findMany({ where })
    const updates = await Promise.all(kdrs.map((k: any) => prisma.kDR.update({ where: { id: k.id }, data: { settingsSnapshot: snapshot } })))
    try { appendAudit({ action: 'refresh_snapshot', target: 'format', formatId: format!.id, count: updates.length, user: session.user?.email }) } catch (e) {}
    return res.status(200).json({ message: 'Snapshots updated', count: updates.length })
  } catch (error: any) {
    console.error('Error updating KDR snapshots:', error)
    if (process.env.NODE_ENV === 'development') return res.status(500).json({ error: error.message || 'Failed to update snapshots', stack: error.stack })
    return res.status(500).json({ error: 'Failed to update snapshots' })
  }
}
