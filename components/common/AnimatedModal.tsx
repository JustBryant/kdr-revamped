import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react'

export type AnimatedModalHandle = {
  close: () => void
}

type Props = {
  children: React.ReactNode
  onClose?: () => void
  open?: boolean
  className?: string
  overlayClassName?: string
  contentStyle?: React.CSSProperties
  exitDurationMs?: number
}

const AnimatedModal = forwardRef<AnimatedModalHandle, Props>(({ children, onClose, open = true, className = '', overlayClassName = 'bg-black/60', contentStyle, exitDurationMs = 380 }, ref) => {
  const [mounted, setMounted] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      const id = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(id)
    } else {
      setMounted(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, exitDurationMs)
      return () => clearTimeout(timer)
    }
  }, [open, exitDurationMs])

  // request close: animate out then call onClose
  const requestClose = () => {
    if (!mounted) return
    setMounted(false)
    // call onClose after exit animation
    setTimeout(() => {
      try { onClose?.() } catch (e) {}
    }, exitDurationMs)
  }

  useImperativeHandle(ref, () => ({ close: requestClose }), [])

  if (!shouldRender) return null

  const modalStyle: React.CSSProperties = {
    transformOrigin: 'center center',
    // start from effectively nothing and grow to full size
    transform: mounted ? 'scale(1)' : 'scale(0.0001)',
    opacity: mounted ? 1 : 0,
    // stronger, snappier easing for a pop/grow effect
    transition: `transform ${exitDurationMs}ms cubic-bezier(0.2, 1, 0.2, 1), opacity ${Math.round(exitDurationMs / 1.5)}ms ease-out`,
    // ensure that while hidden it doesn't capture pointer events
    pointerEvents: mounted ? 'auto' : 'none',
    ...contentStyle,
  }

  const overlayStyle: React.CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${exitDurationMs}ms ease-out`,
  }

  return (
    <div 
      className={`fixed inset-0 z-[10000] flex items-center justify-center ${overlayClassName}`} 
      onClick={requestClose}
      style={overlayStyle}
    >
      <div 
        style={modalStyle} 
        className={`relative ${className} bg-white dark:bg-[#0a0a0c] text-gray-900 dark:text-white`} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
})

export default AnimatedModal
