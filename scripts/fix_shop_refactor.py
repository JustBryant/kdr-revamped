import sys

filepath = "/home/bryant/Desktop/Projects/KDR Revamped/pages/api/kdr/shop.ts"
with open(filepath, "r") as f:
    lines = f.readlines()

start_line = -1
for i in range(len(lines)):
    if "let updatedOffers = freshPlayerOffers.filter" in lines[i]:
        if i > 1100 and i < 1140:
            start_line = i
            break

if start_line == -1:
    print("Could not find start line")
    sys.exit(1)

end_line = -1
for i in range(start_line, min(start_line + 100, len(lines))):
    if "if (need <= 0) break" in lines[i]:
        end_line = i + 5
        break

if end_line == -1:
    print("Could not find end line")
    sys.exit(1)

new_refill_block = """              let updatedOffers = freshPlayerOffers.filter((o: any) => 
                !poolsToBuy.some((pb: any) => String(pb.id) === String(o.id))
              )

              // --- OPTIMIZED REFILL LOGIC FOR BULK PURCHASE ---
              const tierKeyLower = (tierKey || 'STARTER').toUpperCase()
              const desiredCount = isGenericBool
                ? (tierKeyLower === 'STARTER' ? (settings.genericStarterCount || 0) : tierKeyLower === 'MID' ? (settings.genericMidCount || 0) : (settings.genericHighCount || 0))
                : (tierKeyLower === 'STARTER' ? (settings.classStarterCount || 0) : tierKeyLower === 'MID' ? (settings.classMidCount || 0) : (settings.classHighCount || 0))
              
              let currentCategoryCount = updatedOffers.filter((o: any) => ((o.tier || '').toUpperCase() === tierKeyLower) && (!!o.isGeneric === !!isGenericBool)).length
              let need = Math.max(0, Number(desiredCount || 0) - currentCategoryCount)
              
              if (need > 0) {
                // Optimization: Use the pre-fetched refillCandidates instead of querying the DB inside the transaction
                if (refillCandidates && refillCandidates.length > 0) {
                  const picks = sampleArray(refillCandidates, Math.min(need, refillCandidates.length)) 
                  for (const pick of picks) {
                    const poolCards = (pick.items || []).filter((i: any) => i.type === 'Card' && i.card).map((i: any) => ({
                      id: i.card.id,
                      name: i.card.name,
                      konamiId: i.card.konamiId || null,
                      imageUrlCropped: i.card.imageUrlCropped,
                      artworks: i.card.artworks
                    }))
                    const isPickGeneric = !pick.classId
                    const pickBaseCost = isPickGeneric
                      ? (pick.tier === 'STARTER' ? (settings.genericStarterCost || 0) : pick.tier === 'MID' ? (settings.genericMidCost || 0) : (settings.genericHighCost || 0))
                      : (pick.tier === 'STARTER' ? (settings.classStarterCost || 0) : pick.tier === 'MID' ? (settings.classMidCost || 0) : (settings.classHighCount || 0))
                    const pickTotalCost = Number(pickBaseCost || 0) + Number(pick.tax || 0)
                    updatedOffers.push({
                      id: pick.id,
                      name: pick.name,
                      tier: pick.tier,
                      isGeneric: isPickGeneric,
                      tax: pick.tax || 0,
                      cost: pickTotalCost,
                      cards: poolCards,
                      items: (pick.items || []).map((i: any) => ({
                        id: i.id,
                        type: i.type,
                        card: {
                          ...i.card,
                          imageUrlCropped: i.card?.imageUrlCropped,
                          artworks: i.card?.artworks
                        },
                        skillName: i.skillName,
                        skillDescription: i.skillDescription,
                        amount: i.amount
                      }))
                    })
                    need--
                    if (need <= 0) break
                  }
                }
              }
"""

lines[start_line:end_line] = [new_refill_block]

with open(filepath, "w") as f:
    f.writelines(lines)

print(f"Successfully updated refill logic")
