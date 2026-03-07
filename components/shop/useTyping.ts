import { useEffect, useRef, useState } from 'react'

type Options = {
  speed?: number
  pause?: boolean
}

export default function useTyping(target: string, opts?: Options) {
  const [typed, setTyped] = useState('')
  const timeoutsRef = useRef<number[]>([])
  const lastShownRef = useRef<string | null>(null)

  useEffect(() => {
    const t = target || ''
    const speed = opts?.speed ?? 12

    // If paused, do not start/clear typing; keep current text
    if (opts?.pause) return

    // If nothing to type, clear and exit
    if (!t) {
      try { timeoutsRef.current.forEach(id => { try { window.clearTimeout(id) } catch (e) {} }) } catch (e) {}
      timeoutsRef.current = []
      lastShownRef.current = null
      setTyped('')
      return
    }

    // If this target was already shown, do nothing
    if (lastShownRef.current === t) return

    // Clear any pending timers and start fresh
    try { timeoutsRef.current.forEach(id => { try { window.clearTimeout(id) } catch (e) {} }) } catch (e) {}
    timeoutsRef.current = []
    lastShownRef.current = null
    setTyped('')

    for (let i = 0; i < t.length; i++) {
      const id = window.setTimeout(() => {
        setTyped(prev => prev + t.charAt(i))
        if (i === t.length - 1) lastShownRef.current = t
      }, i * speed + 24)
      timeoutsRef.current.push(id as unknown as number)
    }

    return () => {
      try { timeoutsRef.current.forEach(id => { try { window.clearTimeout(id) } catch (e) {} }) } catch (e) {}
      timeoutsRef.current = []
    }
  }, [target, opts?.speed, opts?.pause])

  return typed
}
