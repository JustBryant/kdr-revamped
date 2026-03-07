import React, { useEffect, useState } from 'react'

type Rect = { left: number; top: number; width: number; height: number; containerWidth?: number; containerHeight?: number }

type Props = {
  rect: Rect | null
  visible: boolean
  text?: string
  onDone?: () => void
}

// Anim timings (ms)
const SLIDE_IN_MS = 360
const TEXT_POP_MS = 260
const HOLD_MS = 360
const SLIDE_OUT_MS = 360

export default function PoolPurchasedBanner({ rect, visible, text = 'Purchased', onDone }: Props) {
  const [phase, setPhase] = useState<'idle' | 'in' | 'text' | 'hold' | 'out'>('idle')

  useEffect(() => {
    let to1: any, to2: any, to3: any, to4: any, raf: any
    if (visible && rect) {
      // ensure the element first renders in the "off-screen" position,
      // then transition into view on the next animation frame so the
      // browser can apply the initial transform before we change it.
      raf = window.requestAnimationFrame(() => setPhase('in'))
      to1 = window.setTimeout(() => setPhase('text'), SLIDE_IN_MS)
      to2 = window.setTimeout(() => setPhase('hold'), SLIDE_IN_MS + TEXT_POP_MS)
      to3 = window.setTimeout(() => setPhase('out'), SLIDE_IN_MS + TEXT_POP_MS + HOLD_MS)
      to4 = window.setTimeout(() => {
        setPhase('idle')
        onDone?.()
      }, SLIDE_IN_MS + TEXT_POP_MS + HOLD_MS + SLIDE_OUT_MS + 20)
    } else {
      // ensure reset when hidden
      setPhase('idle')
    }
    return () => { window.cancelAnimationFrame(raf); window.clearTimeout(to1); window.clearTimeout(to2); window.clearTimeout(to3); window.clearTimeout(to4) }
  }, [visible, rect])

  if (!rect || (!visible && phase === 'idle')) return null

  // Styles for banner container; render absolutely inside the shop window
  // so it will be clipped by the shop window's overflow:hidden. The
  // container covers the entire shop window so the overlay can slide in
  // from the shop window's left edge.
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: rect.containerWidth || rect.width,
    height: rect.containerHeight || rect.height,
    pointerEvents: 'none',
    overflow: 'visible',
    zIndex: 1200,
  }

  // Slide using pixel offsets so the banner enters from the left edge of the
  // shop window and exits past the right edge. `rect.left` is relative to the
  // shop window container.
  const containerW = rect.containerWidth || rect.width
  const inPx = -Math.round(rect.left + rect.width) // push left so right edge aligns with container left
  const outPx = Math.round((containerW - rect.left) + rect.width) // push past right edge
  let bannerTransform = `translateX(${inPx}px)`
  let bannerOpacity = 0
  if (phase === 'in') { bannerTransform = `translateX(0px)`; bannerOpacity = 1 }
  if (phase === 'text' || phase === 'hold') { bannerTransform = `translateX(0px)`; bannerOpacity = 1 }
  if (phase === 'out') { bannerTransform = `translateX(${outPx}px)`; bannerOpacity = 0 }

  // text pop style
  let textStyle: React.CSSProperties = { transform: 'scale(0.7)', opacity: 0 }
  if (phase === 'text') textStyle = { transform: 'scale(1.12)', opacity: 1 }
  if (phase === 'hold') textStyle = { transform: 'scale(1)', opacity: 1 }

  return (
    <div style={containerStyle} aria-hidden>
      <div
        style={{
          position: 'absolute',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: bannerTransform,
          transition: `transform ${SLIDE_IN_MS}ms cubic-bezier(.2,.9,.2,1), opacity ${SLIDE_IN_MS/2}ms ease-out`,
          background: 'linear-gradient(90deg, rgba(6,95,70,0.12), rgba(6,95,70,0.14))',
          borderRadius: 8,
          boxShadow: '0 6px 24px rgba(6,95,70,0.08)',
          opacity: bannerOpacity,
        }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              padding: '8px 20px',
              borderRadius: 8,
              background: 'rgba(6,95,70,0.06)',
              backdropFilter: 'blur(6px)'
            }}>
              <div style={{
                color: '#86efac',
                fontWeight: 800,
                fontSize: 28,
                textAlign: 'center',
                transform: textStyle.transform,
                opacity: textStyle.opacity,
                transition: `transform ${TEXT_POP_MS}ms cubic-bezier(.2,.9,.2,1), opacity ${TEXT_POP_MS/2}ms ease-out`,
                textShadow: '0 4px 20px rgba(6,95,70,0.35)'
              }}>{text}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
