import { prisma } from './prisma'
import * as crypto from 'crypto'

export type KdrFindOptions = {
  select?: any
  include?: any
}

/**
 * Find a KDR by id or slug. Accepts `select` or `include` options passed to Prisma.
 */
export async function findKdr(idOrSlug: string, opts?: KdrFindOptions): Promise<any | null> {
  if (!idOrSlug || typeof idOrSlug !== 'string') return null
  const query: any = {
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
  }
  if (opts?.select) query.select = opts.select
  if (opts?.include) query.include = opts.include
  
  // Try finding by UUID ID first, then fallback to slug
  const byId = await prisma.kDR.findUnique({ 
    where: { id: idOrSlug },
    select: opts?.select,
    include: opts?.include
  })
  if (byId) return byId

  return prisma.kDR.findFirst(query) as any
}

/**
 * Resolve canonical KDR id from an id or slug. Returns null when not found.
 */
export async function resolveKdrId(idOrSlug: string) {
  const k = await findKdr(idOrSlug, { select: { id: true } })
  return k?.id ?? null
}

/**
 * Generate a short stable per-KDR player key for URLs. Deterministic, non-reversible.
 * Uses HMAC-SHA256 with the KDR id as key and the user id as message,
 * then returns a url-safe base64 substring (8 chars) for compactness.
 */
export function generatePlayerKey(userId: string, kdrId: string) {
  if (!userId || !kdrId) return null
  const h = crypto.createHmac('sha256', kdrId).update(userId).digest('base64url')
  return h.slice(0, 8)
}

export default { findKdr, resolveKdrId, generatePlayerKey }
