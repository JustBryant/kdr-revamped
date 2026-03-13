import React from 'react'
import TreasureOfferCard from './TreasureOfferCard'

type Props = {
  treasureOffers: any[]
  trainingButtonsExit: boolean
  treasureAnimateIn: boolean
  exitPhase: number
  chosenTreasureId: string | null
  treasureFlyDelta: { x: number; y: number } | null
  selecting: boolean
  setTreasureRef: (id: string, el: HTMLDivElement | null) => void
  showHover: (e: any, card: any, idKey: string) => void
  moveHover: (e: any) => void
  hideHover: () => void
  onTooltipWheel: (e: any) => void
  selectTreasure: (id: string) => Promise<any>
  previewCard: (card: any, cardLike: any) => void
  TREASURE_POP_MS: number
  TREASURE_STAGGER_GAP: number
}

const TreasureArea: React.FC<Props> = ({
  treasureOffers,
  trainingButtonsExit,
  treasureAnimateIn,
  exitPhase,
  chosenTreasureId,
  treasureFlyDelta,
  selecting,
  setTreasureRef,
  showHover,
  moveHover,
  hideHover,
  onTooltipWheel,
  selectTreasure,
  previewCard,
  TREASURE_POP_MS,
  TREASURE_STAGGER_GAP
}) => {
  if (trainingButtonsExit || !treasureOffers || treasureOffers.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-16 items-start justify-center">
        {treasureOffers.map((t: any, idx: number) => {
          const card = t.card || {}
          const idKey = card && (card.id || (card.konamiId ? String(card.konamiId) : null))

          const rarityStr = String(t.rarity || t.card?.rarity || t.card?.rarityStr || '').toLowerCase().trim()
          const isRare = (rarityStr === 'r' || rarityStr === 'rare' || rarityStr === 'r_rare')
          const isSuperRare = (rarityStr === 'sr' || rarityStr === 'super rare' || rarityStr === 'super_rare')
          const isUltraRare = (rarityStr === 'ur' || rarityStr === 'ultra rare' || rarityStr === 'ultra_rare')
          const delayMs = Math.round(idx * (TREASURE_POP_MS + TREASURE_STAGGER_GAP))

          return (
            <TreasureOfferCard
              key={t.id}
              t={t}
              idx={idx}
              isRare={isRare}
              isSuperRare={isSuperRare}
              isUltraRare={isUltraRare}
              delayMs={delayMs}
              treasureAnimateIn={treasureAnimateIn}
              exitPhase={exitPhase}
              chosenTreasureId={chosenTreasureId}
              treasureFlyDelta={treasureFlyDelta}
              useLootArt={true}
              treasureRef={(el) => setTreasureRef(t.id, el)}
              onMouseEnter={(e: any) => showHover(e, card, idKey)}
              onMouseMove={(e: any) => moveHover(e)}
              onMouseLeave={() => hideHover()}
              onWheel={(e: any) => onTooltipWheel(e)}
              onClick={async (e: any) => {
                e.stopPropagation()
                if (selecting || exitPhase > 0) return
                await selectTreasure(t.id)
              }}
              onPreview={(cardLike: any) => previewCard(card || cardLike, card || cardLike)}
            />
          )
        })}
      </div>
    </div>
  )
}

export default TreasureArea
