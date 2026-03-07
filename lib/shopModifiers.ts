import { prisma } from './prisma';

export interface ShopModifier {
  goldBonus?: number;
  xpBonus?: number;
  trainingCostMultiplier?: number;
  trainingXpMultiplier?: number;
  skillSelectionCountBonus?: number;
  treasureOfferCountBonus?: number;
  tipThresholdModifier?: number;
  lootCountBonus?: number; // Affects all loot counts
  priceMultiplier?: number;
  rerollsAvailable?: number;
}

/**
 * Calculates the active modifiers for a player in a specific KDR run.
 * This scans the player's current skills and stats to determine how the shop should be adjusted.
 */
export async function getPlayerShopModifiers(playerId: string): Promise<ShopModifier> {
  try {
    const player = await prisma.kDRPlayer.findUnique({
      where: { id: playerId },
      include: {
        playerDeck: {
          include: {
            skills: true,
          },
        },
      },
    });

    if (!player) {
      return {};
    }

    const modifiers: ShopModifier = {
      goldBonus: 0,
      xpBonus: 0,
      trainingCostMultiplier: 1.0,
      trainingXpMultiplier: 1.0,
      skillSelectionCountBonus: 0,
      treasureOfferCountBonus: 0,
      tipThresholdModifier: 0,
      lootCountBonus: 0,
      priceMultiplier: 1.0,
      rerollsAvailable: 0
    };

    const inventorySkills = player.playerDeck?.skills || [];
    
    // 2. Add Skills picked DURING this Shop Phase (not yet in inventory)
    const shopState: any = player.shopState || {};
    const shopSkillIds = Array.isArray(shopState.chosenSkills) 
      ? shopState.chosenSkills.filter((id: any) => typeof id === 'string' && id.length > 0) 
      : [];
    
    let currentShopSkills: any[] = [];
    if (shopSkillIds.length > 0) {
      try {
        currentShopSkills = await prisma.skill.findMany({
          where: { id: { in: shopSkillIds } }
        });
      } catch (err) {
        console.error('Error fetching shop skills in modifiers:', err);
      }
    }

    const allRelevantSkills = [...inventorySkills, ...currentShopSkills].filter(Boolean);

    // 3. Process All Skills
    for (const skill of allRelevantSkills) {
      if (!skill || !skill.description) continue;
      
      const desc = skill.description.toLowerCase();
      // Example: A skill that gives +1 card choice in the shop
      if (desc.includes('additional skill choice')) {
        modifiers.skillSelectionCountBonus! += 1;
      }
      // Example: A merchant skill that reduces prices
      if (desc.includes('shop prices reduced by 20%')) {
        modifiers.priceMultiplier! *= 0.8;
      }
      // Example: A lucky skill that shows more treasures
      if (desc.includes('additional treasure choice')) {
        modifiers.treasureOfferCountBonus! += 1;
      }
    }

    // 4. Process Stats (Dynamic updates during Shop)
    const stats = (player.shopState as any)?.stats || {};
    
    // CHA Calculation: Every 2 CHA provides a Reroll for treasures and loot
    const chaVal = Number(stats.cha || stats.CHA || 0);
    modifiers.rerollsAvailable = (modifiers.rerollsAvailable || 0) + Math.floor(chaVal / 2);

    if (stats.Barter) {
      // Every point of Barter reduces prices by 2%
      const val = Number(stats.Barter) || 0;
      modifiers.priceMultiplier! *= (1 - (val * 0.02));
    }
    if (stats.Luck) {
      // Every 5 points of Luck gives an extra card in loot pools
      const val = Number(stats.Luck) || 0;
      modifiers.lootCountBonus! += Math.floor(val / 5);
    }

    return modifiers;
  } catch (error) {
    console.error('CRITICAL ERROR IN getPlayerShopModifiers:', error);
    return {}; // Return empty modifiers on crash to allow shop to stay functional
  }
}

/**
 * Applies modifiers to the base settings to create personalized shop settings for a player.
 */
export function applyShopModifiers(baseSettings: any, modifiers: ShopModifier) {
  const s = { ...baseSettings };

  // Apply additive bonuses
  s.goldPerRound = (s.goldPerRound || 0) + (modifiers.goldBonus || 0);
  s.xpPerRound = (s.xpPerRound || 0) + (modifiers.xpBonus || 0);
  s.skillSelectionCount = (s.skillSelectionCount || 0) + (modifiers.skillSelectionCountBonus || 0);
  s.treasureOfferCount = (s.treasureOfferCount || 0) + (modifiers.treasureOfferCountBonus || 0);
  s.tipThreshold = (s.tipThreshold || 0) + (modifiers.tipThresholdModifier || 0);

  // Apply multipliers
  s.trainingCost = Math.round((s.trainingCost || 0) * (modifiers.trainingCostMultiplier || 1.0) * (modifiers.priceMultiplier || 1.0));
  s.trainingXp = Math.round((s.trainingXp || 0) * (modifiers.trainingXpMultiplier || 1.0));

  // Apply loot multipliers and bonuses
  const lootFields = [
    'classStarterCount', 'classMidCount', 'classHighCount',
    'genericStarterCount', 'genericMidCount', 'genericHighCount'
  ];
  const costFields = [
    'classStarterCost', 'classMidCost', 'classHighCost',
    'genericStarterCost', 'genericMidCost', 'genericHighCost'
  ];

  lootFields.forEach(field => {
    s[field] = (s[field] || 0) + (modifiers.lootCountBonus || 0);
  });

  costFields.forEach(field => {
    s[field] = Math.round((s[field] || 0) * (modifiers.priceMultiplier || 1.0));
  });

  s.rerollsAvailable = modifiers.rerollsAvailable || 0;

  return s;
}
