import React from 'react'
import SkillChoiceCard from './SkillChoiceCard'

type Props = {
  choices: any[]
  localPendingChoices?: any[] | null
  animateSkills: boolean
  skillButtonsExit: boolean
  skillCardFromY: Record<string, string>
  skillCardToY?: Record<string, string>
  setCardRef: (id: string, el: HTMLDivElement | null) => void
  onCardClick: (c: any, idx: number) => void
  loading?: boolean
  playerStats?: any
}

const SkillChoicesContainer: React.FC<Props> = ({ choices, localPendingChoices, animateSkills, skillButtonsExit, skillCardFromY, skillCardToY, setCardRef, onCardClick, playerStats }) => {
  const list = (choices && choices.length) ? choices : (localPendingChoices || [])
  // DEBUG: log which choices we're rendering so we can compare pre/post-train
  try { console.debug('[DBG] SkillChoicesContainer render', { choices, localPendingChoices, listLength: list?.length }) } catch (e) {}
  if (!list || list.length === 0) return null
  return (
    <div className="mt-4 w-full bg-transparent p-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch" style={{ transform: skillButtonsExit ? 'translateX(-120%)' : 'translateX(0)', transition: 'transform 700ms cubic-bezier(.2,.9,.2,1), opacity 500ms', opacity: skillButtonsExit ? 0 : 1 }}>
        {list.map((c: any, idx: number) => {
          const delay = `${idx * 120}ms`
          const fromY = skillCardFromY[c.id] || '120%'
          const toY = (skillCardToY && skillCardToY[c.id]) ? skillCardToY[c.id] : '0px'
          return (
            <SkillChoiceCard
              key={c.id}
              c={c}
              idx={idx}
              fromY={fromY}
              toY={toY}
              animateSkills={animateSkills}
              skillButtonsExit={skillButtonsExit}
              delayMs={delay}
              refSetter={(el) => setCardRef(c.id, el)}
              onClick={(e) => { try { onCardClick(c, idx) } catch (err) {} }}
              playerStats={playerStats}
            />
          )
        })}
      </div>
    </div>
  )
}

export default SkillChoicesContainer
