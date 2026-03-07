import React, { useEffect, useRef, useState } from 'react'

const FitName: React.FC<{ text: string; maxWidth?: number; className?: string }> = ({ text, maxWidth = 110, className }) => {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [fontSize, setFontSize] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const containerMax = Number(maxWidth) || 110
    const computedStyle = window.getComputedStyle(el)
    const base = Math.round(Number(computedStyle.fontSize.replace('px', '')) || 16)
    const minSize = Math.max(10, Math.round(base * 0.6))
    let size = base
    el.style.display = 'inline-block'
    el.style.whiteSpace = 'nowrap'
    el.style.maxWidth = containerMax + 'px'
    const fits = () => el.scrollWidth <= el.clientWidth
    while (size > minSize) {
      el.style.fontSize = size + 'px'
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetWidth
      if (fits()) break
      size -= 1
    }
    setFontSize(size)

    const ro = new ResizeObserver(() => {
      let s = base
      while (s > minSize) {
        el.style.fontSize = s + 'px'
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetWidth
        if (el.scrollWidth <= el.clientWidth) break
        s -= 1
      }
      setFontSize(s)
    })
    ro.observe(el)
    const onWin = () => {
      let s = base
      while (s > minSize) {
        el.style.fontSize = s + 'px'
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetWidth
        if (el.scrollWidth <= el.clientWidth) break
        s -= 1
      }
      setFontSize(s)
    }
    window.addEventListener('resize', onWin)
    return () => { try { ro.disconnect() } catch (e) {}; window.removeEventListener('resize', onWin) }
  }, [text, maxWidth])

  return (
    <span ref={ref} className={className} style={{ display: 'inline-block', maxWidth: maxWidth + 'px', verticalAlign: 'middle', fontSize: fontSize ? `${fontSize}px` : undefined, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

export default FitName
