import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')   // Remove all non-word chars
    .replace(/--+/g, '-')      // Replace multiple - with single -
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = req.query.slug
  const slug = Array.isArray(raw) ? raw[0] : raw

  if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'Missing slug' })

  if (req.method === 'PATCH') {
    try {
      const session = await getServerSession(req, res, authOptions)
      if (!session || (session as any).user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      const { name } = req.body
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Missing name' })

      const format = await prisma.format.findUnique({ where: { slug } })
      if (!format) return res.status(404).json({ error: 'Format not found' })

      const newSlug = slugify(name)
      
      // Update format
      const updated = await prisma.format.update({
        where: { id: format.id },
        data: { name, slug: newSlug }
      })

      return res.status(200).json(updated)
    } catch (err: any) {
      console.error('Error updating format', err)
      return res.status(500).json({ error: err?.message || 'Failed to update format' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const session = await getServerSession(req, res, authOptions)
      if (!session || (session as any).user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      // Resolve format
      const format = await prisma.format.findUnique({ where: { slug } })
      if (!format) return res.status(404).json({ error: 'Format not found' })

      // Collect KDRs that belong to this format and remove dependent KDR data first
      const kdrs = await prisma.kDR.findMany({ where: { formatId: format.id }, select: { id: true } })
      const kdrIds = (kdrs || []).map(k => k.id)

      const txOps: any[] = []
      if (kdrIds.length > 0) {
        txOps.push(prisma.kDRMatch.deleteMany({ where: { kdrId: { in: kdrIds } } }))
        txOps.push(prisma.kDRRound.deleteMany({ where: { kdrId: { in: kdrIds } } }))
        txOps.push(prisma.playerItem.deleteMany({ where: { kdrId: { in: kdrIds } } }))
        txOps.push(prisma.kDRPlayer.deleteMany({ where: { kdrId: { in: kdrIds } } }))
        txOps.push(prisma.kDR.deleteMany({ where: { id: { in: kdrIds } } }))
      }

      // Find all tables that have a formatId column and delete rows referencing this format
      const tablesWithFormatId: Array<{ table_name: string }> = await prisma.$queryRaw`
        SELECT table_name FROM information_schema.columns
        WHERE lower(column_name) = 'formatid' AND table_schema = 'public'
      `

      for (const row of tablesWithFormatId) {
        const tbl = String(row.table_name)
        // skip the main Format table and KDR (handled above)
        if (tbl.toLowerCase() === 'format' || tbl.toLowerCase() === 'kdr') continue
        try {
          // Use parameterized raw execution to delete rows for this format
          // Note: some tables may not exist in all DB variants; wrap in try/catch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          txOps.push(prisma.$executeRawUnsafe(`DELETE FROM "${tbl}" WHERE "formatId" = $1`, format.id))
        } catch (e) {
          console.warn('Skipping conditional delete for', tbl, e)
        }
      }

      // Finally delete the format itself
      txOps.push(prisma.format.delete({ where: { id: format.id } }))

      // Execute transaction
      await prisma.$transaction(txOps)

      return res.status(200).json({ success: true, deletedKdrCount: kdrIds.length })
    } catch (err: any) {
      console.error('Error deleting format', err)
      // If foreign key constraints exist, inform the client
      return res.status(500).json({ error: err?.message || 'Failed to delete format' })
    }
  }

  if (req.method === 'GET') {
    try {
      const session = await getServerSession(req, res, authOptions)
      const isAdmin = session?.user && (session.user as any).role === 'ADMIN'

      const format = await prisma.format.findUnique({ 
        where: { slug },
        include: {
          formatClasses: {
            where: isAdmin ? {} : {
              class: { isPublic: true }
            },
            include: {
              class: {
                include: {
                  skills: true,
                  subclasses: {
                    include: {
                      skills: true
                    }
                  }
                }
              }
            }
          }
        }
      })
      if (!format) return res.status(404).json({ error: 'Format not found' })

      // Also fetch generic skills
      const genericSkills = await prisma.skill.findMany({
        where: {
          OR: [
            { type: 'GENERIC', classId: null },
            { type: 'TIP', classId: null }
          ]
        },
        include: {
          providesCards: true,
          modifications: true
        },
        orderBy: { name: 'asc' }
      })

      return res.status(200).json({ format, genericSkills })
    } catch (err: any) {
      console.error('Error fetching format', err)
      return res.status(500).json({ error: err?.message || 'Failed to fetch format' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
