import React from 'react'
import ReactDOM from 'react-dom'
import CardDescription from '../class-editor/shared/CardDescription'
import { RichTextRenderer } from '../RichText'

type HoverTooltipProps = {
  hoverTooltip: any
  cardDetailsCacheRef: React.MutableRefObject<Record<string, any>>
  tooltipScrollRef: React.RefObject<HTMLDivElement | null>
  onTooltipEnter?: () => void
  onTooltipLeave?: () => void
}

const HoverTooltip: React.FC<HoverTooltipProps> = ({ hoverTooltip, cardDetailsCacheRef, tooltipScrollRef, onTooltipEnter, onTooltipLeave }) => {
  const visible = Boolean(hoverTooltip?.visible)
  const idKey = hoverTooltip?.idKey
  const resolved = idKey && cardDetailsCacheRef.current[idKey] ? cardDetailsCacheRef.current[idKey] : (hoverTooltip?.cardLike || null)
  const skills = hoverTooltip?.skills || [] // Get skills from hover state

  const OFFSET = 12
  const TOOLTIP_WIDTH = 384 // ~24rem at 16px
  const TOOLTIP_HEIGHT = 220

  // While the tooltip is visible, intercept wheel events at the document
  // level and route them to the tooltip's scroll container when possible.
  React.useEffect(() => {
    if (!visible || typeof document === 'undefined') return
    const el = tooltipScrollRef?.current
    if (!el) return
    const isScrollable = el.scrollHeight > el.clientHeight
    if (!isScrollable) return

    const handler = (ev: WheelEvent) => {
      try {
        ev.preventDefault()
        ev.stopPropagation()
        const delta = ev.deltaY
        const atTop = el.scrollTop <= 0
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
        if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
          return
        }
        el.scrollTop += delta
      } catch (e) {}
    }

    document.addEventListener('wheel', handler, { passive: false })
    return () => { try { document.removeEventListener('wheel', handler as EventListener) } catch (e) {} }
  }, [visible, tooltipScrollRef?.current?.scrollHeight, tooltipScrollRef?.current?.clientHeight])

  // Only render the portal when tooltip is visible and we have resolved data
  if (!visible || !resolved || typeof window === 'undefined') return null

  // Calculate position (only on client)
  let left = (hoverTooltip.x ?? 0) + OFFSET
  let top = (hoverTooltip.y ?? 0) + OFFSET
  
  if (left + TOOLTIP_WIDTH > window.innerWidth - 8) {
    left = (hoverTooltip.x ?? 0) - TOOLTIP_WIDTH - OFFSET
  }
  left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8))
  
  if (top + TOOLTIP_HEIGHT > window.innerHeight - 8) {
    top = (hoverTooltip.y ?? 0) - TOOLTIP_HEIGHT - OFFSET
  }
  top = Math.max(8, Math.min(top, window.innerHeight - 8))

  const tooltipBg = 'rgba(15,23,42,0.6)'
  const fgColor = '#fff'

  const node = (
    <div
      id="hover-tooltip-container"
      style={{ left, top, width: TOOLTIP_WIDTH, zIndex: 99999 }}
      className="fixed pointer-events-none"
      aria-hidden
    >
      <div className="rounded-lg p-4 shadow-md" style={{ backgroundColor: tooltipBg, WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', color: fgColor }}>
        <div className="font-bold text-base truncate">{resolved?.name}</div>
        <div className={`text-sm text-white/80 mt-1`}>{resolved?.type || resolved?.cardType || ''}</div>
        {((resolved?.atk !== undefined || resolved?.def !== undefined) && (resolved?.type && resolved.type.toLowerCase().includes('monster'))) && (
          <div className="mt-2 font-mono text-base" style={{ color: '#ffd86b' }}>
            <span>ATK/{resolved.atk === -1 ? '?' : resolved.atk}</span>
            {resolved.def !== undefined && <span className="ml-3">DEF/{resolved.def === -1 ? '?' : resolved.def}</span>}
          </div>
        )}
        {(resolved?.race || resolved?.attribute) && (
          <div className={`mt-2 text-sm text-white/80`}>
            {resolved?.attribute && (resolved.type || '').toString().toLowerCase().includes('monster') ? (
              <span className="font-semibold">{resolved.attribute}</span>
            ) : null}
            {resolved?.attribute && resolved?.race ? <span className="mx-2">•</span> : null}
            {resolved?.race && <span>{resolved.race}</span>}
          </div>
        )}
        <div ref={tooltipScrollRef} className={`mt-2 text-sm text-white/90 max-h-48 overflow-y-auto leading-relaxed`}>
          {skills && skills.length > 0 ? (
            <CardDescription card={resolved} skills={skills} />
          ) : (
            <RichTextRenderer 
              content={resolved?.desc || resolved?.text || resolved?.description || ''} 
              stats={hoverTooltip.stats}
              requirements={resolved?.statRequirements}
            />
          )}
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(node, document.body)
}

export default HoverTooltip
