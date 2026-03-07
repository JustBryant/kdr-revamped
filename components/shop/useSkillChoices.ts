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
        list.forEach((c: any) => {
          const el = skillCardRefs.current[c.id]
          if (!el) {
            newY[c.id] = '300px'
            return
          }
          const rect = el.getBoundingClientRect()
          const containerTop = containerRect.top
          // Calculate a start Y that is definitely below the window's bottom
          const dy = Math.round(containerRect.height - (rect.top - containerTop)) + 250
          newY[c.id] = `${dy}px`
        })
        setSkillCardFromY(newY)
      } catch (e) {}
    }, 100)
    return () => { try { window.clearTimeout(timer) } catch (e) {} }
    // Remove skillButtonsExit from dependencies to prevent recalculation during exit
  }, [localPendingChoices, (choices || []).length, shopWindowRef?.current, skillCardFromY])

  return { setCardRef, skillCardFromY }
}
