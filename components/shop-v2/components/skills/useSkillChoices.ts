import React from 'react'

type Params = {
  shopWindowRef: React.RefObject<HTMLElement | null>
  choices?: any[]
  localPendingChoices?: any[] | null
  skillButtonsExit?: boolean
}

export default function useSkillChoices({ shopWindowRef, choices, localPendingChoices, skillButtonsExit }: Params) {
  const skillCardRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const [skillCardFromY, setSkillCardFromY] = React.useState<Record<string, string>>({})
  const [skillCardToY, setSkillCardToY] = React.useState<Record<string, string>>({})

  const setCardRef = (id: string, el: HTMLDivElement | null) => {
    skillCardRefs.current[id] = el
  }

  React.useEffect(() => {
    const list = (choices && choices.length) ? choices : (localPendingChoices || [])
    if (!shopWindowRef?.current || !list || list.length === 0) return

    // If we've already calculated positions for these specific IDs, don't recalculate
    const currentKeys = Object.keys(skillCardFromY)
    const listIds = list.map((c: any) => String(c.id))
    const allPresent = listIds.length > 0 && listIds.every(id => currentKeys.includes(id))
    
    // Only proceed if we have references for all cards
    const hasAllRefs = listIds.every(id => !!skillCardRefs.current[id])
    if (allPresent || !hasAllRefs) return

    const timer = window.setTimeout(() => {
      try {
        if (!shopWindowRef.current) return
        const containerRect = (shopWindowRef.current as HTMLElement).getBoundingClientRect()
        const newY: Record<string, string> = {}
        const newTo: Record<string, string> = {}
        // Start all skill cards from a consistent position below the window
        const dy = Math.round(containerRect.height + 250)
        // center of the shop window (viewport relative)
        const centerY = Math.round(containerRect.top + (containerRect.height / 2))
        list.forEach((c: any) => {
          const el = skillCardRefs.current[String(c.id)]
          // default from below
          newY[c.id] = `${dy}px`
          if (el) {
            const r = el.getBoundingClientRect()
            // compute translation needed to move card center to window center
            const cardCenter = Math.round(r.top + (r.height / 2))
            const delta = centerY - cardCenter
            newTo[c.id] = `${delta}px`
          } else {
            newTo[c.id] = `0px`
          }
        })
        setSkillCardFromY(newY)
        setSkillCardToY(newTo)
      } catch (e) {}
    }, 60)
    return () => { try { window.clearTimeout(timer) } catch (e) {} }
    // Only recalc when choices or refs change
  }, [localPendingChoices, (choices || []).length, shopWindowRef?.current])

  return { setCardRef, skillCardFromY, skillCardToY }
}
