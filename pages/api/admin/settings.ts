import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      // Optional format slug query param to support per-format settings
      const formatSlug = typeof req.query.format === 'string' ? req.query.format : undefined;

      // If a format is provided, ensure the Format exists and fetch its settings
      if (formatSlug) {
        const format = await prisma.format.findUnique({ where: { slug: formatSlug } });
        if (!format) {
          return res.status(404).json({ error: 'Format not found' })
        }

        // Return existing settings if present, otherwise create default settings and persist to the Format.settings JSON
        if (format.settings) return res.status(200).json(format.settings)

        const defaultSettings = {
          levelXpCurve: [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500],
          classStarterCount: 1,
          classStarterCost: 50,
          classStarterMinLevel: 1,
          classMidCount: 1,
          classMidCost: 100,
          classMidMinLevel: 3,
          classHighCount: 1,
          classHighCost: 200,
          classHighMinLevel: 5,
          genericStarterCount: 1,
          genericStarterCost: 50,
          genericStarterMinLevel: 1,
          genericMidCount: 1,
          genericMidCost: 100,
          genericMidMinLevel: 3,
          genericHighCount: 1,
          genericHighCost: 200,
          genericHighMinLevel: 5,
          trainingCost: 50,
          trainingXp: 100,
          treasureRarityWeights: [70, 20, 8, 2],
          treasureOfferCount: 1,
          xpPerRound: 100,
          goldPerRound: 50,
          skillUnlockLevels: [2, 5, 8],
          skillSelectionCount: 3
        }

        const updated = await prisma.format.update({ where: { id: format.id }, data: { settings: defaultSettings } })
        return res.status(200).json(updated.settings)

      }

      // No format specified: legacy singleton behavior using GameSettings table
      let settings = await prisma.gameSettings.findFirst()

      if (!settings) {
        settings = await prisma.gameSettings.create({
          data: {
            levelXpCurve: [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500],
            classStarterCount: 1,
            classStarterCost: 50,
            classStarterMinLevel: 1,
            classMidCount: 1,
            classMidCost: 100,
            classMidMinLevel: 3,
            classHighCount: 1,
            classHighCost: 200,
            classHighMinLevel: 5,
            genericStarterCount: 1,
            genericStarterCost: 50,
            genericStarterMinLevel: 1,
            genericMidCount: 1,
            genericMidCost: 100,
            genericMidMinLevel: 3,
            genericHighCount: 1,
            genericHighCost: 200,
            genericHighMinLevel: 5,
            trainingCost: 50,
            trainingXp: 100,
            treasureRarityWeights: [70, 20, 8, 2],
            treasureOfferCount: 1,
            xpPerRound: 100,
            goldPerRound: 50,
            skillUnlockLevels: [2, 5, 8],
            skillSelectionCount: 3
          }
        })
      }

      return res.status(200).json(settings)
    } catch (error: any) {
      console.error('Error fetching settings:', error)
      if (process.env.NODE_ENV === 'development') return res.status(500).json({ error: error.message, stack: error.stack })
      return res.status(500).json({ error: 'Failed to fetch settings' })
    }
  }

  if (req.method === 'PUT') {
    try {
      console.debug('PUT /api/admin/settings body:', req.body);
      const formatSlug = typeof req.query.format === 'string' ? req.query.format : undefined;
      let targetFormatId: string | undefined = undefined;

      if (formatSlug) {
        const format = await prisma.format.findUnique({ where: { slug: formatSlug } });
        if (!format) return res.status(404).json({ error: 'Format not found' })
        targetFormatId = format.id;
      }
      const { 
        levelXpCurve, 
        classStarterCount, classStarterCost, classStarterMinLevel,
        classMidCount, classMidCost, classMidMinLevel,
        classHighCount, classHighCost, classHighMinLevel,
        genericStarterCount, genericStarterCost, genericStarterMinLevel,
        genericMidCount, genericMidCost, genericMidMinLevel,
        genericHighCount, genericHighCost, genericHighMinLevel,
        trainingCost, trainingXp,
        treasureRarityWeights,
        treasureOfferCount,
        xpPerRound, goldPerRound,
        skillUnlockLevels, skillSelectionCount
      } = req.body

      // Helper to safely parse numbers with defaults
      const safeInt = (val: any, def: number) => {
        const num = Number(val);
        return isNaN(num) ? def : num;
      };

      const data = {
        levelXpCurve,
        classStarterCount: safeInt(classStarterCount, 1),
        classStarterCost: safeInt(classStarterCost, 50),
        classStarterMinLevel: safeInt(classStarterMinLevel, 1),

        classMidCount: safeInt(classMidCount, 1),
        classMidCost: safeInt(classMidCost, 100),
        classMidMinLevel: safeInt(classMidMinLevel, 3),

        classHighCount: safeInt(classHighCount, 1),
        classHighCost: safeInt(classHighCost, 200),
        classHighMinLevel: safeInt(classHighMinLevel, 5),

        genericStarterCount: safeInt(genericStarterCount, 1),
        genericStarterCost: safeInt(genericStarterCost, 50),
        genericStarterMinLevel: safeInt(genericStarterMinLevel, 1),

        genericMidCount: safeInt(genericMidCount, 1),
        genericMidCost: safeInt(genericMidCost, 100),
        genericMidMinLevel: safeInt(genericMidMinLevel, 3),

        genericHighCount: safeInt(genericHighCount, 1),
        genericHighCost: safeInt(genericHighCost, 200),
        genericHighMinLevel: safeInt(genericHighMinLevel, 5),

        trainingCost: safeInt(trainingCost, 50),
        trainingXp: safeInt(trainingXp, 100),
        // Treasure weights: ensure array of numbers
        treasureRarityWeights: Array.isArray(treasureRarityWeights)
          ? treasureRarityWeights.map((w: any) => {
              const n = Number(w);
              return isNaN(n) ? 0 : n;
            })
          : [70, 20, 8, 2],

        treasureOfferCount: safeInt(treasureOfferCount, 1),

        xpPerRound: safeInt(xpPerRound, 100),
        goldPerRound: safeInt(goldPerRound, 50),

        skillUnlockLevels,
        skillSelectionCount: safeInt(skillSelectionCount, 3)
      };

      // Update or create for the target format (persist to Format.settings), otherwise use GameSettings singleton
      if (targetFormatId) {
        const format = await prisma.format.findUnique({ where: { id: targetFormatId } })
        if (!format) return res.status(404).json({ error: 'Format not found' })
        const updated = await prisma.format.update({ where: { id: targetFormatId }, data: { settings: data } })
        return res.status(200).json(updated.settings)
      }

      // Legacy singleton behavior
      const firstSettings = await prisma.gameSettings.findFirst()
      
      if (firstSettings) {
        const updated = await prisma.gameSettings.update({
          where: { id: firstSettings.id },
          data
        })
        return res.status(200).json(updated)
      } else {
        const created = await prisma.gameSettings.create({ data })
        return res.status(200).json(created)
      }

    } catch (error: any) {
      console.error('Error updating settings:', error)
      if (process.env.NODE_ENV === 'development') return res.status(500).json({ error: error.message, stack: error.stack })
      return res.status(500).json({ error: 'Failed to update settings' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}