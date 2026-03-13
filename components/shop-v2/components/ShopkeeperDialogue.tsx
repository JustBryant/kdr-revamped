import React, { useEffect, useRef, useState } from 'react'
import { useShopContext } from '../ShopContext'
import useTyping from '../hooks/useTyping'

// Map shop stages to dialogue types used by the dialogues API
const stageToDialogueType: Record<string, string> = {
  START: 'GREETING',
  SKILL: 'SKILL_OFFER',
  STATS: 'STATS',
  TRAINING: 'TRAINING',
  TREASURE: 'TREASURES',
  LOOT: 'LOOT_OFFER'
}

// Special action -> dialogue type mapping
const specialTypeMap: Record<string, string> = {
  selling: 'SELLING',
  loot_purchase: 'LOOT_PURCHASE',
  returning: 'RETURNING'
}

export default function ShopkeeperDialogue() {
  const { player, pickShopkeeperDialogue, shopHistory } = useShopContext()

  const sk = player?.shopState?.shopkeeper || null
  const stage = player?.shopState?.stage || null

  const lastStageRef = useRef<string | null>(null)
  const lastHistIdRef = useRef<number | null>(null)
  const [text, setText] = useState<string | null>(player?.shopState?.shopkeeperGreeting || null)

  // Only update phase-based dialogue when the stage actually changes
  useEffect(() => {
    if (!sk) return
    const newStage = stage || 'START'
    if (lastStageRef.current === newStage) return
    lastStageRef.current = newStage

    const diagType = stageToDialogueType[newStage] || 'GREETING'
    ;(async () => {
      try {
        const picked = await pickShopkeeperDialogue(diagType)
        if (picked) setText(picked)
        else setText(player?.shopState?.shopkeeperGreeting || sk.greeting || sk.description || null)
      } catch (e) {
        setText(player?.shopState?.shopkeeperGreeting || sk.greeting || sk.description || null)
      }
    })()
  }, [stage, sk, pickShopkeeperDialogue, player?.shopState?.shopkeeperGreeting])

  // React to special actions recorded in shopHistory (only when new entry appears)
  useEffect(() => {
    try {
      if (!Array.isArray(shopHistory) || shopHistory.length === 0) return
      const last = shopHistory[shopHistory.length - 1]
      if (!last) return
      // simple numeric id or timestamp guard to only react to new entries
      const id = typeof last.ts === 'number' ? last.ts : (last.id || Date.now())
      if (lastHistIdRef.current === id) return
      lastHistIdRef.current = id

      const specialType = specialTypeMap[last.type]
      if (!specialType) return

      ;(async () => {
        try {
          const picked = await pickShopkeeperDialogue(specialType)
          if (picked) setText(picked)
        } catch (e) {}
      })()
    } catch (e) {}
  }, [shopHistory, pickShopkeeperDialogue])

  // Keep displayed text synced if server explicitly sets greeting on player
  useEffect(() => {
    try {
      const explicit = player?.shopState?.shopkeeperGreeting
      if (explicit && explicit !== text) setText(explicit)
    } catch (e) {}
  }, [player?.shopState?.shopkeeperGreeting])

  // call hooks unconditionally (do not early-return before hooks)
  const typed = useTyping(text || '', { speed: 12 })

  if (!sk) return null

  return (
    <div className="rounded px-3 py-2 bg-slate-900/80 text-sm text-slate-100 shadow-sm">
      <span className="font-semibold mr-2">{(sk && sk.name) || 'Shopkeeper'}:</span>
      <span>{typed}</span>
    </div>
  )
}
