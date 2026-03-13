import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useShopContext } from '../../ShopContext'
import TreasureArea from './TreasureArea'
import { TREASURE_POP_MS, TREASURE_STAGGER_GAP } from '../../utils/constants'
import AnimatedModal from '../../../common/AnimatedModal'
import CardPreview from '../../../class-editor/shared/CardPreview'

export default function TreasurePhase({ shopWindowRef }: { shopWindowRef?: React.RefObject<HTMLElement> }) {
  const ctx = useShopContext()
  const { player, call, addHistory, setPlayer } = ctx
  const offers = (player?.shopState?.treasureOffers) || []

  const [treasureAnimateIn, setTreasureAnimateIn] = useState<boolean>(false)
  const [chosenTreasureId, setChosenTreasureId] = useState<string | null>(null)
  const [exitPhase, setExitPhase] = useState<number>(0)
  const [treasureFlyDelta, setTreasureFlyDelta] = useState<{ x: number; y: number } | null>(null)
  const treasureRefs = useRef<Record<string, HTMLDivElement | null>>({})
  
  const [selecting, setSelecting] = useState<boolean>(false)
  const [previewCard, setPreviewCard] = useState<any | null>(null)
  const [previewOpen, setPreviewOpen] = useState<boolean>(false)

  const setTreasureRef = useCallback((id: string, el: HTMLDivElement | null) => {
    try { treasureRefs.current[id] = el } catch (e) {}
  }, [])

  // Determine whether training UI is still present/visible so we can
  // avoid rendering the treasure area (which reserves layout space)
  // until the training UI has finished exiting.
  const trainingWrapVisible = (() => {
    try {
      // If server says we're already in TREASURES stage, consider training hidden.
      if (player && player.shopState && player.shopState.stage === 'TREASURES') return false
      if (typeof document === 'undefined') return false
      const trainingWrap = document.querySelector('.training-wrap') as HTMLElement | null
      if (!trainingWrap) return false
      const style = window.getComputedStyle(trainingWrap)
      const opacity = parseFloat(style.opacity || '1')
      const transform = (style.transform || '')
      if (opacity > 0.01) return true
      if (transform && transform !== 'none') return true
      return false
    } catch (e) {
      return false
    }
  })()

  useEffect(() => {
    try {
      if (offers && offers.length > 0) {
        // Ensure we don't animate treasures in until any training buttons
        // have finished their exit animation — otherwise the layout can
        // shift and cards will compute positions incorrectly.
        setTreasureAnimateIn(false)
        requestAnimationFrame(() => {
          try {
            const trainingWrap = (typeof document !== 'undefined') ? document.querySelector('.training-wrap') as HTMLElement | null : null
            const shouldDelay = (() => {
              try {
                if (!trainingWrap) return false
                const style = window.getComputedStyle(trainingWrap)
                // If training UI is still visible (opacity > 0) or transform not none,
                // give it time to finish sliding out.
                const opacity = parseFloat(style.opacity || '1')
                const transform = (style.transform || '')
                if (opacity > 0.01) return true
                if (transform && transform !== 'none') return true
                return false
              } catch (e) { return false }
            })()

            const delayMs = shouldDelay ? 780 : 24
            window.setTimeout(() => setTreasureAnimateIn(true), delayMs)
          } catch (e) {
            setTreasureAnimateIn(true)
          }
        })
      } else {
        setTreasureAnimateIn(false)
      }
    } catch (e) {}
  }, [offers?.length, trainingWrapVisible])


  const selectTreasure = useCallback(async (treasureId: string) => {
    if (selecting || exitPhase > 0) return null
    setSelecting(true)

    // Phase 1: icons vanish
    setExitPhase(1)
    await new Promise(r => setTimeout(r, 600))

    // Phase 2: fly/overlay animation to class button if refs exist
    try {
      const el = treasureRefs.current[treasureId]
      const classBtn = (document.querySelector('[aria-label="Open class quick view"]') as HTMLElement | null)
      if (el && classBtn) {
        const wRect = el.getBoundingClientRect()
        const dRect = classBtn.getBoundingClientRect()
        const dx = (dRect.left + dRect.width / 2) - (wRect.left + wRect.width / 2)
        const dy = (dRect.top + dRect.height / 2) - (wRect.top + wRect.height / 2)

        // Use legacy in-DOM transform animation for exact parity
        setTreasureFlyDelta({ x: dx, y: dy })
        setChosenTreasureId(treasureId)
        setExitPhase(2)
        await new Promise(r => setTimeout(r, 500))
        setExitPhase(3)
        await new Promise(r => setTimeout(r, 400))
      }
    } catch (e) {}

    try {
      const result = await call('chooseTreasure', { treasureId }, { autoSetPlayer: false })
      setExitPhase(0)
      setChosenTreasureId(null)
      setTreasureFlyDelta(null)
      setTreasureAnimateIn(false)

      const serverPlayer = result && result.player ? result.player : null
      if (serverPlayer) {
        try {
          const mod = await import('../../utils/mergePlayer')
          const merge = mod.mergePlayerWithIncoming || mod.default || mod.mergePlayerWithIncoming
          setPlayer((prev: any) => merge(prev, serverPlayer))
        } catch (e) {
          try { setPlayer(serverPlayer) } catch (e) {}
        }
      }

      // fetch loot offers next; do NOT let the call auto-apply the returned player
      try {
        const lootRes = await call('lootOffers', {}, { autoSetPlayer: false })
        try {
          if (lootRes && (lootRes.player || lootRes.offers)) {
              try {
                const incoming = lootRes.player || {}
                if (lootRes.offers) incoming.shopState = { ...(incoming.shopState || {}), lootOffers: lootRes.offers }
                const mod = await import('../../utils/mergePlayer')
                const merge = mod.mergePlayerWithIncoming
                setPlayer((prev: any) => merge(prev, incoming))
              } catch (e) {
                try {
                  const incoming = lootRes.player || {}
                  if (lootRes.offers) incoming.shopState = { ...(incoming.shopState || {}), lootOffers: lootRes.offers }
                  setPlayer((prev: any) => ({ ...(prev || {}), ...(incoming || {}), shopState: { ...(prev?.shopState || {}), ...(incoming.shopState || {}) } }))
                } catch (e) {}
              }
            }
        } catch (e) { console.error('failed applying lootOffers merge', e) }
      } catch (err) { console.error('lootOffers failed', err) }
    } catch (err) {
      setSelecting(false)
      setExitPhase(0)
      setChosenTreasureId(null)
      setTreasureFlyDelta(null)
      return null
    }

    setSelecting(false)
    return true
  }, [call, selecting, exitPhase])

  if (!offers || offers.length === 0) return null

  return (
    <>
    <div className="mt-6 w-full flex justify-center">
      <div style={{ width: '100%', maxWidth: '980px' }} className="overflow-visible">
        <div style={{ padding: '0 20px' }}>
          <TreasureArea
            treasureOffers={offers}
            trainingButtonsExit={trainingWrapVisible}
            treasureAnimateIn={treasureAnimateIn}
            exitPhase={exitPhase}
            chosenTreasureId={chosenTreasureId}
            treasureFlyDelta={treasureFlyDelta}
            selecting={selecting}
            setTreasureRef={(id: string, el: HTMLDivElement | null) => { try { treasureRefs.current[id] = el } catch (e) {} }}
            showHover={() => {}}
            moveHover={() => {}}
            hideHover={() => {}}
            onTooltipWheel={() => {}}
            selectTreasure={async (id: string) => await selectTreasure(id)}
            previewCard={(c: any, cl: any) => { try { setPreviewCard(c); setPreviewOpen(true) } catch (e) {} }}
            TREASURE_POP_MS={TREASURE_POP_MS}
            TREASURE_STAGGER_GAP={TREASURE_STAGGER_GAP}
          />
        </div>
      </div>
    </div>
    
    {previewOpen ? (
      <AnimatedModal open={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewCard(null) }}>
        <div style={{ width: 360, maxWidth: '90vw' }}>
          <CardPreview card={previewCard} />
        </div>
      </AnimatedModal>
    ) : null}
    </>
  )
}
