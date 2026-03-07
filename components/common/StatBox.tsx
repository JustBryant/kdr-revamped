import React from 'react'
import ReactDOM from 'react-dom'

type StatBoxProps = {
  label: string
  value?: string | number | null
  description?: React.ReactNode
  color?: string // CSS color for top accent and hover fill
  compact?: boolean // use compact stat style (for DEX/CON/STR/INT/CHA)
  className?: string
  onClick?: (e?: React.MouseEvent) => void
}

export default function StatBox({ label, value = null, description = null, color = '#f59e0b', compact = true, className = '', onClick }: StatBoxProps) {
  const [hovered, setHovered] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  React.useEffect(() => {
    if (!hovered) return
    const update = () => {
      try {
        if (wrapperRef.current) setRect(wrapperRef.current.getBoundingClientRect())
      } catch (e) {}
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [hovered])

  // Colors
  const textColor = hovered ? '#ffffff' : '#dbe7f0'
  const subTextColor = hovered ? 'rgba(255,255,255,0.9)' : 'rgba(219,231,240,0.65)'

  if (!compact) {
    // fallback to original richer layout for non-compact usage
    return (
      <div
        className={`relative overflow-hidden rounded-md border border-gray-700 transition-all ${className}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { if (onClick) onClick(e) }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{
          backgroundColor: hovered ? color : 'transparent',
          transition: 'background-color 220ms cubic-bezier(.2,.9,.2,1), transform 160ms ease',
          cursor: onClick ? 'pointer' : 'default'
        }}
      >
        <div className="p-3">
          <div className="flex items-baseline justify-between">
            <div style={{ color: textColor }} className="text-sm font-semibold">
              {label}
            </div>
            <div style={{ color: textColor }} className="text-2xl font-extrabold">
              {value !== null && value !== undefined ? value : '—'}
            </div>
          </div>

          <div
            className="mt-2 text-sm"
            style={{
              color: subTextColor,
              maxHeight: hovered ? 120 : 0,
              opacity: hovered ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 280ms ease, opacity 200ms ease'
            }}
            aria-hidden={!hovered}
          >
            {description}
          </div>
        </div>
      </div>
    )
  }

  // Compact stat box layout (matches attached style)
  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      {/* top colored accent */}
      <div style={{ height: 6, background: color, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />

      <div
        className="relative rounded-b-md border border-gray-700"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { if (onClick) onClick(e) }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{
          backgroundColor: hovered ? color : 'rgba(17,24,39,0.7)',
          transition: 'background-color 220ms cubic-bezier(.2,.9,.2,1), transform 160ms ease',
          padding: '10px 12px',
          cursor: onClick ? 'pointer' : 'default'
        }}
      >
        <div className="flex flex-col items-center justify-center">
          <div style={{ color: textColor, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ color: textColor, fontSize: 18, fontWeight: 800, marginTop: 6 }}>{value !== null && value !== undefined ? value : 0}</div>
        </div>

        {/* tooltip is rendered in a portal so it isn't clipped by overflow containers */}
        {typeof window !== 'undefined' && hovered && rect && ReactDOM.createPortal(
          <div
            role="tooltip"
            aria-hidden={!hovered}
            style={{
              position: 'fixed',
              left: Math.max(180, Math.min(window.innerWidth - 180, rect.left + (rect.width / 2))),
              top: rect.top - 8,
              transform: 'translate(-50%, -100%)',
              minWidth: 180,
              maxWidth: 360,
              maxHeight: 'calc(100vh - 40px)', // ensure it doesn't exceed viewport height
              overflowY: 'auto',
              padding: '8px 12px',
              background: 'rgba(17,24,39,0.96)',
              color: '#e6eef8',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(2,6,23,0.6)',
              fontSize: 13,
              opacity: hovered ? 1 : 0,
              pointerEvents: hovered ? 'auto' : 'none',
              transition: 'opacity 160ms ease, transform 160ms ease',
              transformOrigin: 'center bottom',
              zIndex: 9999
            }}
          >
            <div style={{ marginBottom: 6, fontWeight: 700, color: '#fff' }}>{label}</div>
            <div style={{ color: '#d0e6ff' }}>{description}</div>
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -6, width: 12, height: 6, overflow: 'hidden' }}>
              <svg width="24" height="12" viewBox="0 0 24 12" style={{ display: 'block', margin: 0 }}>
                <polygon points="12,0 24,12 0,12" fill="rgba(17,24,39,0.96)" />
              </svg>
            </div>
          </div>
        , document.body)}
      </div>
    </div>
  )
}

/* Usage for compact stat boxes:
  <StatBox label="DEX" value={2} color="#f59e0b" description="Increases dodge and action speed." />
*/
