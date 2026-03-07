import React, { useEffect, useState } from 'react'

let cachedMap: Record<string,string> | null = null

function sanitizeName(name: string) {
  return String(name).replace(/[\\/:*?"<>|\\s]+/g, '_')
}

export default function Icon({ name, className, alt }: { name: string, className?: string, alt?: string }) {
  const [map, setMap] = useState<Record<string,string> | null>(cachedMap)

  useEffect(() => {
    if (cachedMap) {
      setMap(cachedMap)
      return
    }
    let mounted = true
    fetch('/icons/atlas-map.json').then(r => r.json()).then((m) => {
      if (!mounted) return
      cachedMap = m
      setMap(m)
    }).catch(() => {
      if (!mounted) return
      setMap(null)
    })
    return () => { mounted = false }
  }, [])

  const filename = map && map[name] ? map[name] : `${sanitizeName(name)}.png`
  const src = `/icons/${filename}`

  return <img src={src} alt={alt || name} className={className} />
}
