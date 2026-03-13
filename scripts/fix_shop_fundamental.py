import sys

filepath = "/home/bryant/Desktop/Projects/KDR Revamped/pages/api/kdr/shop.ts"
with open(filepath, "r") as f:
    lines = f.readlines()

start_tx = -1
end_tx = -1
for i in range(len(lines)):
    if "const result = await prisma.$transaction(async (tx) => {" in lines[i]:
        if i > 1050:
            start_tx = i
            break

if start_tx == -1:
    print("Could not find start of transaction")
    sys.exit(1)

for i in range(start_tx, len(lines)):
    if "return attachPlayerKey(finalPlayer)" in lines[i] or "return attachPlayerKey(updatedPlayer)" in lines[i]:
        for j in range(i, min(i + 20, len(lines))):
            if "timeout:" in lines[j]:
                end_tx = j + 2
                break
        if end_tx != -1: break

if end_tx == -1:
    print("Could not find end of transaction")
    sys.exit(1)

new_optimized_logic = """            // 4. PERFORM FUNDAMENTALLY OPTIMIZED TRANSACTION
            const result = await prisma.$transaction(async (tx) => {
              // Fetch mandatory state once
              const freshPlayer = await tx.kDRPlayer.findUnique({ 
                where: { id: player.id },
                include: { shopInstance: { where: { roundNumber: currentRoundNumberAtStart } } }
              }) as any
              
              if (!freshPlayer) throw new Error('Player not found')
              
              const playerGoldNow = Number(freshPlayer.gold || 0)
              if (playerGoldNow < baseCost) throw new Error(`INSUFFICIENT_GOLD:${playerGoldNow}`)

              const currentInst = freshPlayer.shopInstance?.[0]
              const baseShopState = currentInst?.shopState || freshPlayer.shopState || {}
              const txPurchases = Array.isArray(baseShopState.purchases) ? [...baseShopState.purchases] : []
              const playerItemsToCreate: any[] = []
              let totalGoldInc = 0

              // Process each pre-fetched pool in memory
              for (const fullPool of fullPoolsData) {
                if (txPurchases.some((p: any) => String(p.lootPoolId) === String(fullPool.id))) continue
                
                for (const item of ((fullPool as any).items || [])) {
                  const typ = (item.type || '').toString()
                  if (typ === 'Card' && item.card?.id) {
                    playerItemsToCreate.push({ userId: user.id, kdrId: kdr.id, itemId: null, cardId: item.card.id, qty: 1, lootPoolId: fullPool.id })
                  } else if (typ === 'Skill') {
                    const skillId = item.skillId || item.skill?.id || (item.skillName ? item.id : null)
                    if (skillId) {
                      playerItemsToCreate.push({ userId: user.id, skillId, itemId: null, kdrId: kdr.id, qty: 1, lootPoolId: fullPool.id })
                    }
                  } else if (typ === 'Gold' || item.amount) {
                    totalGoldInc += Number(item.amount || 0)
                  }
                }
                txPurchases.push({ lootPoolId: fullPool.id, qty: 1, cost: 0, bulk: true })
              }

              // Update shop state (clear all pools in this quality category)
              const freshPlayerOffers = Array.isArray(baseShopState.lootOffers) ? [...baseShopState.lootOffers] : []
              let updatedOffers = freshPlayerOffers.filter((o: any) => 
                !poolsToBuy.some((pb: any) => String(pb.id) === String(o.id))
              )

              // --- PRE-FETCHED REFILL LOGIC ---
              const tierKeyLower = (tierKey || 'STARTER').toUpperCase()
              const desiredCount = isGenericBool
                ? (tierKeyLower === 'STARTER' ? (settings.genericStarterCount || 0) : tierKeyLower === 'MID' ? (settings.genericMidCount || 0) : (settings.genericHighCount || 0))
                : (tierKeyLower === 'STARTER' ? (settings.classStarterCount || 0) : tierKeyLower === 'MID' ? (settings.classMidCount || 0) : (settings.classHighCount || 0))
              
              let currentCategoryCount = updatedOffers.filter((o: any) => ((o.tier || '').toUpperCase() === tierKeyLower) && (!!o.isGeneric === !!isGenericBool)).length
              let need = Math.max(0, Number(desiredCount || 0) - currentCategoryCount)
              
              if (need > 0 && refillCandidates?.length > 0) {
                const picks = sampleArray(refillCandidates, Math.min(need, refillCandidates.length)) 
                for (const pick of picks) {
                  const isPickGeneric = !pick.classId
                  const pickBaseCost = isPickGeneric
                    ? (pick.tier === 'STARTER' ? (settings.genericStarterCost || 0) : pick.tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0))
                    : (pick.tier === 'STARTER' ? (settings.classStarterCost || 0) : pick.tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCount || 0))
                  
                  updatedOffers.push({
                    id: pick.id,
                    name: pick.name,
                    tier: pick.tier,
                    isGeneric: isPickGeneric,
                    tax: pick.tax || 0,
                    cost: Number(pickBaseCost || 0) + Number(pick.tax || 0),
                    cards: (pick.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({
                      id: i.card.id,
                      name: i.card.name,
                      imageUrlCropped: i.card.imageUrlCropped,
                      artworks: i.card.artworks
                    })),
                    items: (pick.items || []).map((i: any) => ({
                      id: i.id,
                      type: i.type,
                      card: { ...i.card, imageUrlCropped: i.card?.imageUrlCropped, artworks: i.card?.artworks },
                      skillName: i.skillName,
                      skillDescription: i.skillDescription,
                      amount: i.amount
                    }))
                  })
                }
              }

              const FINAL_STATE = { ...baseShopState, purchases: txPurchases, lootOffers: updatedOffers }
              const isComplete = (FINAL_STATE.stage === 'DONE')

              // ATOMIC WRITE #1: Batch Create Items
              if (playerItemsToCreate.length > 0) {
                await tx.playerItem.createMany({ data: playerItemsToCreate })
              }

              // ATOMIC WRITE #2: Update Player (Gold + State)
              const updatedPlayer = await tx.kDRPlayer.update({ 
                where: { id: player.id }, 
                data: { 
                  gold: { decrement: baseCost - totalGoldInc },
                  shopState: FINAL_STATE,
                  shopComplete: isComplete,
                  lastShopRound: currentRoundNumberAtStart
                } 
              })

              // ATOMIC WRITE #3: Shop Instance (State Sync)
              await tx.kDRShopInstance.upsert({
                where: { playerId_roundNumber: { playerId: player.id, roundNumber: currentRoundNumberAtStart } },
                create: { playerId: player.id, roundNumber: currentRoundNumberAtStart, shopState: FINAL_STATE, isComplete },
                update: { shopState: FINAL_STATE, isComplete }
              })

              return attachPlayerKey(updatedPlayer)
            }, {
              timeout: 10000 
            })
"""

lines[start_tx:end_tx] = [new_optimized_logic]

with open(filepath, "w") as f:
    f.writelines(lines)

print("Successfully applied fundamental optimization")
