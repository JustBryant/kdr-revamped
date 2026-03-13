import { useState, useCallback, useEffect } from 'react'
import { computeLevel } from '../../../lib/shopHelpers'

type Player = any

export default function useShopFlow({ player, setPlayer, startShop, settings, addHistory }: { player: Player | null, setPlayer: (p: any) => void, startShop: () => Promise<any>, settings?: any, addHistory?: (entry: any) => void }) {
  const [phase, setPhase] = useState<'IDLE'|'IN_PROGRESS'|'LEVEL_UP'|'SKILL_OFFER'|'STAT_POINT'|'COMPLETE'>('IDLE')
  const [levelUpInfo, setLevelUpInfo] = useState<any | null>(null)
  const [showLevelUp, setShowLevelUp] = useState<boolean>(false)

  // Expose a helper to show the stat-level overlay (reuses LevelUpAnimation's statCenter)
  const showStatOverlay = useCallback((statCenter: any) => {
    try {
      // Force a remount of the level-up overlay so repeated stat overlays animate reliably
      setShowLevelUp(false)
      window.setTimeout(() => {
        try {
          setLevelUpInfo({ statCenter, statOverlayOnly: true })
          setShowLevelUp(true)
          // after a short delay, flip to show the 'new' value for the stat
          window.setTimeout(() => {
            setLevelUpInfo((prev: any) => {
              try {
                if (!prev || !prev.statCenter) return prev
                return { ...(prev || {}), statCenter: { ...(prev.statCenter || {}), showNew: true } }
              } catch (e) { return prev }
            })
          }, 300)
        } catch (e) {}
      }, 20)
    } catch (e) {}
  }, [])

  // If the page reloads and the server-side player still has pendingSkillChoices,
  // resume the flow into the SKILL_OFFER phase so the UI renders the choices.
  useEffect(() => {
    try {
      // Do not auto-advance into SKILL_OFFER if we're currently showing a level-up animation.
      if (phase === 'LEVEL_UP') return
      const pending = (player && player.shopState && player.shopState.pendingSkillChoices) || []
      if (pending && pending.length > 0 && phase !== 'SKILL_OFFER') {
        setPhase('SKILL_OFFER')
      }
    } catch (e) {}
  }, [player?.shopState?.pendingSkillChoices?.length, phase])

  // If the page reloads and the server-side player still has statPoints (and there
  // are no pending skill choices), resume the flow into STAT_POINT so the stat
  // chooser animates back in like skills do.
  useEffect(() => {
    try {
      if (phase === 'LEVEL_UP') return
      const pending = (player && player.shopState && player.shopState.pendingSkillChoices) || []
      // If there are pending skill offers, let the SKILL_OFFER effect take precedence
      if (pending && pending.length > 0) return
      const points = Number((player && player.shopState && typeof player.shopState.statPoints !== 'undefined') ? player.shopState.statPoints : 0)
      if (points > 0 && phase !== 'STAT_POINT') {
        setPhase('STAT_POINT')
      }
    } catch (e) {}
  }, [player?.shopState?.statPoints, player?.shopState?.pendingSkillChoices?.length, phase])

  const handleStart = useCallback(async () => {
    if (!player) return
    setPhase('IN_PROGRESS')
    const prevXP = Number(player.xp || 0)
    const prevGold = Number(player.gold || 0)
    const prevLevel = computeLevel(prevXP, settings?.levelXpCurve)

    try {
      // call server to start the shop and get authoritative player (do not auto-set player)
      const res = await startShop()
      const updated = (res && res.player) ? res.player : null

      // compute awarded gold/xp and add immediate award message BEFORE updating local player
      try {
        const afterGold = Number((updated && typeof updated.gold === 'number') ? updated.gold : prevGold)
        const afterXp = Number((updated && typeof updated.xp === 'number') ? updated.xp : prevXP)
        const gainedGold = (res && res.awarded && typeof res.awarded.gold === 'number') ? res.awarded.gold : Math.max(0, afterGold - prevGold)
        const gainedXp = (res && res.awarded && typeof res.awarded.xp === 'number') ? res.awarded.xp : Math.max(0, afterXp - prevXP)
        if ((gainedGold > 0 || gainedXp > 0) && typeof addHistory === 'function') {
          try {
            const label = (updated && updated.user && updated.user.name) ? updated.user.name : 'Player'
            const text = `${label} gained ${gainedGold} gold and ${gainedXp} XP this round.`
            addHistory({ ts: Date.now(), type: 'award', text, gold: gainedGold, xp: gainedXp })
          } catch (e) {}
        }
      } catch (e) {}

      // now update local player state with authoritative server response
      if (updated) setPlayer(updated)

      const newXP = Number((updated && typeof updated.xp === 'number') ? updated.xp : (player.xp || 0))
      const newLevel = computeLevel(newXP, settings?.levelXpCurve)

      if (newLevel > prevLevel) {
        // Server should persist stat points; do not locally add them to avoid double-award.
        // Use human-facing (1-based) levels for the UI animation.
        setLevelUpInfo({ from: prevLevel + 1, to: newLevel + 1, gained: newLevel - prevLevel })
        // show the level-up overlay but allow skills to begin animating so timings can be tuned
        setShowLevelUp(true)
        // If server returned a levelEntry, schedule it to render slightly after the award so ordering feels right
        try {
          if (res && res.levelEntry && typeof addHistory === 'function') {
            window.setTimeout(() => {
              try { addHistory(res.levelEntry) } catch (e) {}
            }, 300)
          }
        } catch (e) {}
        setPhase('SKILL_OFFER')
        return
      }

      // no level up -> normal progress
      setPhase('COMPLETE')
    } catch (e) {
      // revert to idle on error
      setPhase('IDLE')
      throw e
    }
  }, [player, setPlayer, startShop])

  const handleTrainingResult = useCallback((updated: any) => {
    try {
      const prevXP = Number(player?.xp || 0)
      const prevLevel = computeLevel(prevXP, settings?.levelXpCurve)
      const newXP = Number((updated && typeof updated.xp === 'number') ? updated.xp : (player?.xp || 0))
      const newLevel = computeLevel(newXP, settings?.levelXpCurve)
      if (newLevel > prevLevel) {
        // store display-friendly levels (+1) so animations show 1->2 instead of 0->1
        setLevelUpInfo({ from: prevLevel + 1, to: newLevel + 1, gained: newLevel - prevLevel })
        setShowLevelUp(true)
        setPhase('SKILL_OFFER')
        return true
      }
    } catch (e) {}
    return false
  }, [player, settings?.levelXpCurve])

  // After the level-up animation completes, show skill offers.
  const finishLevelUp = useCallback(() => {
    setShowLevelUp(false)
  }, [])

  const finishStatPoint = useCallback(() => {
    setPhase('COMPLETE')
  }, [])

  // When skills finish, if server recorded statPoints, show STAT_POINT, else COMPLETE
  const finishSkillOffer = useCallback(() => {
    try {
      const pendingPoints = Number((player && player.shopState && typeof player.shopState.statPoints !== 'undefined') ? player.shopState.statPoints : 0)
      if (pendingPoints > 0) {
        setPhase('STAT_POINT')
        return
      }
    } catch (e) {}
    setPhase('COMPLETE')
  }, [player])

  return {
    phase,
    levelUpInfo,
    showLevelUp,
    showStatOverlay,
    handleStart,
    handleTrainingResult,
    finishLevelUp,
    finishStatPoint,
    finishSkillOffer
  }
}
