import { prisma } from '../../lib/prisma'

export async function persistStateForPlayer(opts: { playerId: string; roundNumber: number; partial?: any; playerShopState?: any }) {
  const { playerId, roundNumber, partial = {}, playerShopState } = opts
  const currentInst = await prisma.kDRShopInstance.findUnique({ where: { playerId_roundNumber: { playerId, roundNumber } } })
  const baseState = (currentInst?.shopState as any) || { stage: 'START', chosenSkills: [], purchases: [], tipAmount: 0, history: [] }
  const newState = { ...baseState, ...partial }
  const isActuallyDone = newState.stage === 'DONE'
  const updatedInst = await prisma.kDRShopInstance.upsert({
    where: { playerId_roundNumber: { playerId, roundNumber } },
    create: { playerId, roundNumber, shopState: newState, isComplete: isActuallyDone },
    update: { shopState: newState, isComplete: isActuallyDone }
  })
  // Merge persistent fields (seen, purchases) into the player's top-level shopState
  const currentPlayer = await prisma.kDRPlayer.findUnique({ where: { id: playerId } })
  const existingPlayerState = (currentPlayer && (currentPlayer as any).shopState) || {}

  // Merge 'seen' arrays (de-duplicated)
  const existingSeen: any[] = Array.isArray(existingPlayerState?.seen) ? existingPlayerState.seen : []
  const newSeen: any[] = Array.isArray(newState?.seen) ? newState.seen : []
  const mergedSeen = Array.from(new Set([...(existingSeen || []), ...(newSeen || [])]))

  // Merge 'purchases' arrays (de-duplicate by lootPoolId/poolId/itemId key)
  const existingPurchases: any[] = Array.isArray(existingPlayerState?.purchases) ? existingPlayerState.purchases : []
  const newPurchases: any[] = Array.isArray(newState?.purchases) ? newState.purchases : []
  const combinedPurchases = [...existingPurchases, ...newPurchases]
  const seenPurchaseKeys = new Set<string>()
  const mergedPurchases: any[] = []
  for (const p of combinedPurchases) {
    if (!p) continue
    const key = String(p.lootPoolId ?? p.poolId ?? p.itemId ?? JSON.stringify(p))
    if (seenPurchaseKeys.has(key)) continue
    seenPurchaseKeys.add(key)
    mergedPurchases.push(p)
  }

  const playerShopStateForUpdate = { ...existingPlayerState, ...newState, seen: mergedSeen, purchases: mergedPurchases }

  // Also merge and persist top-level `seenPools` and `purchasedPools` arrays
  const existingSeenPoolsFromPlayer: any[] = Array.isArray(currentPlayer?.seenPools) ? (currentPlayer as any).seenPools : []
  const newSeenPoolsFromState: any[] = Array.isArray(newState?.seenPools) ? newState.seenPools : []
  const mergedSeenPools = Array.from(new Set([...(existingSeenPoolsFromPlayer || []), ...(newSeenPoolsFromState || [])]))

  const existingPurchasedPoolsFromPlayer: any[] = Array.isArray(currentPlayer?.purchasedPools) ? (currentPlayer as any).purchasedPools : []
  const newPurchasedPoolsFromState: any[] = Array.isArray(newState?.purchasedPools) ? newState.purchasedPools : []
  const mergedPurchasedPools = Array.from(new Set([...(existingPurchasedPoolsFromPlayer || []), ...(newPurchasedPoolsFromState || [])]))

  const updatedPlayer = await prisma.kDRPlayer.update({
    where: { id: playerId },
    data: { shopState: playerShopStateForUpdate as any, shopComplete: isActuallyDone, lastShopRound: roundNumber, seenPools: mergedSeenPools, purchasedPools: mergedPurchasedPools },
    include: { shopInstances: { where: { roundNumber } } }
  })
  return { updated: updatedPlayer, shopState: newState }
}

export async function appendHistoryForPlayer(opts: { playerId: string; roundNumber: number; entry: any; playerShopState?: any }) {
  const { playerId, roundNumber, entry, playerShopState } = opts
  const e = { ts: entry.ts || Date.now(), ...entry }
  const inst = await prisma.kDRShopInstance.findUnique({ where: { playerId_roundNumber: { playerId, roundNumber } } })
  const currentState = (inst?.shopState as any) || { history: [] }
  const hist = Array.isArray(currentState.history) ? [...currentState.history] : []
  hist.push(e)
  const { updated } = await persistStateForPlayer({ playerId, roundNumber, partial: { history: hist }, playerShopState: currentState })
  return { updated }
}
