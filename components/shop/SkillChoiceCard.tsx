import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import CardImage from '../common/CardImage'

type Props = {
  c: any
  idx: number
  fromY: string
  animateSkills: boolean
  skillButtonsExit: boolean
  delayMs?: string
  refSetter?: (el: HTMLDivElement | null) => void
  onClick?: (e: React.MouseEvent) => void
}

const SkillChoiceCard: React.FC<Props> = ({ c, idx, fromY, animateSkills, skillButtonsExit, delayMs, refSetter, onClick }) => {
  const [isHovered, setIsHovered] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const delay = delayMs || `${idx * 120}ms`

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  // Determine fixed transition string to prevent properties changing after completion
  const transitionString = skillButtonsExit 
    ? 'transform 700ms cubic-bezier(.2,.9,.2,1), opacity 500ms' 
    : (animateSkills && fromY !== '0px' ? `transform 750ms cubic-bezier(.34,1.56,.64,1) ${delay}, opacity 600ms ${delay}` : 'none')

  return (
    <>
      <div
        ref={(el) => { try { if (refSetter) refSetter(el) } catch (e) {} }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); try { onClick && onClick((e as unknown) as React.MouseEvent) } catch (err) {} } }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setIsHovered(false)}
        className={`group p-4 border-2 rounded-lg bg-white/5 border-gray-700 flex flex-col items-center justify-center transform transition-all cursor-pointer hover:border-emerald-400 hover:shadow-lg active:opacity-90 hover:bg-emerald-600/20 relative z-10 hover:z-50 min-h-[160px] h-full box-border`}
        style={{
          transform: (animateSkills && fromY !== '0px') ? 'translateY(0) scale(1)' : `translateY(${fromY}) scale(0.98)`,
          opacity: (animateSkills && fromY !== '0px') ? 1 : 0,
          transition: transitionString
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center border-2 border-emerald-500/30 group-hover:border-emerald-500 transition-colors overflow-hidden">
            <img 
              src="/icons/skill_icon.png" 
              alt={c.name} 
              className="w-10 h-10 object-contain brightness-110" 
            />
          </div>
          <div className="font-bold text-white text-center group-hover:text-emerald-400 transition-colors drop-shadow-md">
            {c.name}
          </div>
        </div>
      </div>

      {isHovered && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[999999] pointer-events-none max-w-xs bg-gray-900 border-2 border-emerald-500/50 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.8)] p-4"
          style={{ 
            top: mousePos.y + 20,
            left: mousePos.x + 20,
            transform: (mousePos.x + 320 > window.innerWidth) ? 'translateX(-110%)' : 'none'
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <img src="/icons/skill_icon.png" alt="skill" className="w-4 h-4 object-contain" />
              <div className="font-bold text-emerald-400">{c.name}</div>
            </div>
            <div className="text-sm text-gray-200 leading-relaxed italic">
              {c.description}
            </div>

            {c.providesCards && c.providesCards.length > 0 && (
              <div className="mt-2 pt-3 border-t border-white/10">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Provides {c.providesCards.length} Card(s)</div>
                <div className="flex flex-wrap gap-1.5">
                  {c.providesCards.map((card: any) => (
                    <div key={card.id} className="w-12 h-16 relative group/card">
                      <CardImage 
                        card={card} 
                        konamiId={card.konamiId} 
                        alt={card.name} 
                        className="w-full h-full object-contain rounded shadow-sm border border-white/10" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default SkillChoiceCard
