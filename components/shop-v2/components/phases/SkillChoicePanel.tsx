import React, { useState, useEffect } from 'react'
import SkillChoicesContainer from '../skills/SkillChoicesContainer'
import useSkillChoices from '../skills/useSkillChoices'
import { useShopContext } from '../../ShopContext'

export default function SkillChoicePanel({ shopWindowRef, finishSkillOffer }: { shopWindowRef: React.RefObject<HTMLDivElement | null>, finishSkillOffer?: () => void }) {
  const { player, call, setPlayer, addHistory } = useShopContext()
  const [localPendingChoices, setLocalPendingChoices] = useState<any[] | null>(null)
  const [animateSkills, setAnimateSkills] = useState(false)
  const [skillButtonsExit, setSkillButtonsExit] = useState(false)

  const { setCardRef, skillCardFromY, skillCardToY } = useSkillChoices({ shopWindowRef, choices: player?.shopState?.pendingSkillChoices, localPendingChoices, skillButtonsExit })

  if (!player) return null
  const choices = player?.shopState?.pendingSkillChoices || []

  // Enable entrance animation once we've calculated start positions for all cards
  useEffect(() => {
    const list = (choices && choices.length) ? choices : (localPendingChoices || [])
    if (!list || list.length === 0) return
    const ids = list.map((c: any) => String(c.id))
    const keys = Object.keys(skillCardFromY || {})
    const ready = ids.every(id => keys.includes(id))
    if (ready) {
      // small timeout to ensure DOM paint before starting animation
      const t = window.setTimeout(() => setAnimateSkills(true), 30)
      return () => { try { window.clearTimeout(t) } catch (e) {} }
    }
  }, [skillCardFromY, choices.length])

  const onCardClick = async (c: any, idx: number) => {
    if (!c) return
    if (skillButtonsExit) return
    setLocalPendingChoices(choices)
    // start exit animation immediately to avoid race with server response
    setSkillButtonsExit(true)
    try {
      // optimistic history entry for skill choice
      try {
        const clientId = `c-${Date.now()}`
        const optimisticEntry = { ts: Date.now(), type: 'skill', text: `Player chose skill: ${c.name}`, skillId: c.id, skillName: c.name, optimistic: true, clientId }
        try { if (addHistory) addHistory(optimisticEntry) } catch (e) {}
      } catch (e) {}
      const res = await call('chooseSkill', { skillId: c.id })
      if (res && res.player) setPlayer(res.player)
      window.setTimeout(() => {
        setAnimateSkills(false)
        setLocalPendingChoices(null)
        try { finishSkillOffer && finishSkillOffer() } catch (e) {}
      }, 700)
    } catch (e) {
      // ignore
    }
  }

  return (
    <div>
      <SkillChoicesContainer
        choices={choices}
        localPendingChoices={localPendingChoices}
        animateSkills={animateSkills}
        skillButtonsExit={skillButtonsExit}
        skillCardFromY={skillCardFromY}
        skillCardToY={skillCardToY}
        setCardRef={setCardRef}
        onCardClick={onCardClick}
        playerStats={player}
      />
    </div>
  )
}
