import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'
import crypto from 'crypto'
import { invalidateKdrCache } from '../../../lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !session.user?.email) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Log incoming request and session for debugging when creation fails
    try {
      console.log('KDR create request - user:', session.user?.email || null, 'body:', JSON.stringify(req.body || {}))
    } catch (e) {
      console.log('KDR create request - (failed to serialize body)')
    }
    const { name, slug, formatSlug, playerCount, password, ranked, settingsSnapshot: customSettings } = req.body || {}

    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Missing or invalid name' })

    // Resolve or create Format when provided
    let format = null
    if (formatSlug && typeof formatSlug === 'string') {
      format = await prisma.format.findUnique({ where: { slug: formatSlug } })
      if (!format) {
        return res.status(404).json({ error: 'Format not found' })
      }
    }

    // Snapshot settings if format exists
    let settingsSnapshot = customSettings || null
    if (!settingsSnapshot && format) {
      const gs = await prisma.gameSettings.findFirst()
      if (gs) {
        // remove meta fields that don't belong in snapshot
        const { id: _id, updatedAt: _u, ...rest } = gs as any
        settingsSnapshot = rest
      } else if (format.settings) {
        // Fallback to format-specific settings if no global game settings found
        settingsSnapshot = format.settings
      }
    }

    // Ensure unique, human-friendly slug; fallback to generated
    const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g, '').slice(0, 60)
    const makeCandidate = (suffix?: string) => suffix ? `${safeName}-${suffix}` : safeName

    // Generate a short random hex suffix to keep slugs compact and readable.
    const randomSuffix = () => crypto.randomBytes(3).toString('hex') // 6 hex chars

    let finalSlug: string | null = null
    if (slug && typeof slug === 'string') finalSlug = slug
    else {
      // Try a few times to find a unique slug
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = makeCandidate(attempt === 0 ? randomSuffix() : randomSuffix())
        // ensure we don't collide
        // Note: we intentionally check uniqueness to avoid unique constraint errors
        // in case a similar slug already exists.
        // If safeName alone is acceptable, we could try that first; here we always use a short suffix.
        // If a collision occurs on all attempts, append timestamp as final fallback.
        // eslint-disable-next-line no-await-in-loop
        const exists = await prisma.kDR.findUnique({ where: { slug: candidate } })
        if (!exists) { finalSlug = candidate; break }
      }
      if (!finalSlug) finalSlug = `${safeName}-${Date.now().toString().slice(-4)}`
    }

    // resolve creator id (if any) and prepare nested connect shapes for Prisma
    let createdByConnect: { connect: { id: string } } | undefined = undefined
    if (session.user?.email) {
      const creator = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      if (creator && creator.id) createdByConnect = { connect: { id: creator.id } }
    }

    const createData: any = {
      name,
      slug: finalSlug,
      password: password || null,
      isRanked: Boolean(ranked),
      format: format ? { connect: { id: format.id } } : undefined,
      settingsSnapshot: settingsSnapshot || undefined,
      createdBy: createdByConnect
    }
    // Persist playerCount when provided (added to schema)
    if (playerCount && typeof playerCount === 'number') createData.playerCount = playerCount

    const created = await prisma.kDR.create({ data: createData })

    // Trigger Pusher updates
    try {
      const { triggerPusher } = await import('../../../lib/pusher')
      await triggerPusher('kdr-lobby', 'update', { type: 'update', action: 'create' })
    } catch (e) {
      console.error('Failed to trigger Pusher for create:', e)
    }

    // Invalidate any cached KDR responses for this id/slug
    try {
      if (created && created.id) await invalidateKdrCache(created.id)
      if (created && (created as any).slug) await invalidateKdrCache((created as any).slug)
    } catch (e) {
      console.warn('Failed to invalidate KDR cache after create', e)
    }

    return res.status(201).json(created)
  } catch (error: any) {
    console.error('Error creating KDR:', error, '\nstack:', (error && (error as any).stack) || '')
    const msg = error?.message || String(error)
    return res.status(500).json({ error: `Failed to create KDR: ${msg}` })
  }
}
