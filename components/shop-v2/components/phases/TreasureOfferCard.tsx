import React from 'react'
import CardImage from '../../../common/CardImage'
import { ShatterfoilOverlay } from '../../../ShatterfoilOverlay'
import { UltraRareGlow } from '../../../UltraRareGlow'
import { SuperRareGlow } from '../../../SuperRareGlow'
import { TREASURE_POP_MS as DEFAULT_TREASURE_POP_MS } from '../../utils/constants'

type Props = {
  t: any
  idx: number
  isRare: boolean
  isSuperRare: boolean
  isUltraRare: boolean
  delayMs: number
  treasureAnimateIn: boolean
  exitPhase: number
  chosenTreasureId: string | null
  treasureFlyDelta: { x: number; y: number } | null
  treasureRef: (el: HTMLDivElement | null) => void
  onMouseEnter: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseLeave: (e: React.MouseEvent) => void
  onWheel: (e: React.WheelEvent) => void
  onClick: (e: React.MouseEvent) => void
  onPreview: (card: any) => void
  R_SHIMMER_START_RATIO?: number
  R_SHIMMER_SPEED_RATIO?: number
  TREASURE_POP_MS?: number
  useLootArt?: boolean
}

const TreasureOfferCard: React.FC<Props> = ({ t, idx, isRare, isSuperRare, isUltraRare, delayMs, treasureAnimateIn, exitPhase, chosenTreasureId, treasureFlyDelta, treasureRef, onMouseEnter, onMouseMove, onMouseLeave, onWheel, onClick, onPreview, R_SHIMMER_START_RATIO = 0.6, R_SHIMMER_SPEED_RATIO = 1.15, TREASURE_POP_MS = DEFAULT_TREASURE_POP_MS, useLootArt = false }) => {
  const exitStyle: React.CSSProperties | undefined = (() => {
    if (exitPhase >= 2) {
      if (chosenTreasureId === t.id && treasureFlyDelta) {
        return {
          zIndex: 1000,
          transform: `translate(${treasureFlyDelta.x}px, ${treasureFlyDelta.y}px) scale(0.05) rotate(720deg)`,
          opacity: 0,
          transition: 'transform 500ms cubic-bezier(0.55, 0.055, 0.675, 0.19), opacity 300ms ease-in 200ms',
          filter: 'brightness(2)'
        } as React.CSSProperties
      }
      if (exitPhase >= 3) {
        return {
          transform: 'translateY(100px) scale(0.8)',
          opacity: 0,
          transition: 'transform 500ms ease-in, opacity 400ms ease-out',
          pointerEvents: 'none'
        } as React.CSSProperties
      }
    }
    return undefined
  })()

  return (
    <div
      key={t.id}
      ref={(el) => treasureRef(el)}
      className="w-40 flex-shrink-0 flex flex-col items-center treasure-wrapper"
      style={{
        opacity: treasureAnimateIn ? 1 : 0,
        pointerEvents: (exitPhase > 0) ? 'none' : 'auto',
        animation: treasureAnimateIn ? `treasurePop ${TREASURE_POP_MS}ms cubic-bezier(.2,.9,.2,1) ${delayMs}ms both` : 'none'
      }}
    >
      <div
        className="w-full flex flex-col items-center treasure-item card-hover-spring"
        style={Object.assign({}, exitStyle || {}, { transformOrigin: 'center bottom' })}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
      >
        <div
          className="treasure-img-wrap rounded-md cursor-pointer"
          style={{ position: 'relative', width: '160px', minHeight: '232px' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation(); e.preventDefault();
              (e.currentTarget as HTMLElement).click()
            }
          }}
            onClick={onClick}
            onDoubleClick={() => { try { if (typeof onPreview === 'function') onPreview(t.card || null) } catch (e) {} }}
        >
          {isSuperRare && (() => {
            const sDelay = delayMs + TREASURE_POP_MS
            return <SuperRareGlow delay={sDelay} />
          })()}
          {isUltraRare && (() => {
            const uDelay = delayMs + TREASURE_POP_MS
            return <UltraRareGlow delay={uDelay} />
          })()}
          <div className="treasure-img-clip rounded-md" style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', zIndex: 10 }}>
            <CardImage 
              card={t.card} 
              konamiId={t.card?.konamiId ?? null} 
              alt={t.card?.name || t.id} 
              useLootArt={useLootArt}
              className="treasure-card-img" 
              style={{ display: 'block' }}
            />
            {isRare && (() => {
              const rDelayMs = delayMs + Math.round(TREASURE_POP_MS * R_SHIMMER_START_RATIO)
              const rDurationMs = Math.round(TREASURE_POP_MS * R_SHIMMER_SPEED_RATIO)
              return <span className="rarity-shimmer" style={{ animationDuration: `${rDurationMs}ms`, animationDelay: `${rDelayMs}ms` }} />
            })()}
            {isUltraRare && (() => {
              const uDelay = delayMs + TREASURE_POP_MS
              return <ShatterfoilOverlay delay={uDelay} />
            })()}
          </div>
        </div>
      </div>
      <div className="mt-2 w-full flex items-center justify-center" style={{ minHeight: '32px' }}>
        {(() => {
          const rawRarity = String(t.rarity || t.card?.rarity || '').toUpperCase().trim()
          const map: Record<string, string> = {
            'N': 'N', 'NORMAL': 'N', 'C': 'N', 'COMMON': 'N',
            'R': 'R', 'RARE': 'R',
            'SR': 'SR', 'SUPER RARE': 'SR', 'SUPER_RARE': 'SR',
            'UR': 'UR', 'ULTRA RARE': 'UR', 'ULTRA_RARE': 'UR'
          }
          const mapped = map[rawRarity] || rawRarity
          if (!mapped) return <div style={{ width: 40, height: 40 }} />

          return (
            <img
              src={`/images/rarity/${mapped}.png`}
              alt={mapped}
              className="w-10 h-10 object-contain"
              style={{
                animation: exitPhase >= 1 ? 'pixelVanish 0.55s cubic-bezier(0.4, 0, 1, 1) forwards' : 'none',
                opacity: exitPhase >= 1 ? 0 : 1
              }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )
        })()}
      </div>
    </div>
  )
}

export default TreasureOfferCard
