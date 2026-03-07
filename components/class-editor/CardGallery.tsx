import React, { useEffect, useState } from 'react'
import CardImage, { selectArtworkUrl } from '../common/CardImage'

interface CardItem {
  id: string
  konamiId?: number | null
  name: string
  imageUrlCropped?: string | null
  artworks?: any
  primaryArtworkIndex?: number | null
  variant?: string
}

export default function CardGallery({ formatSlug, variant = 'TCG', onSelect }: { formatSlug: string | null, variant?: string, onSelect?: (c: CardItem)=>void }) {
  const [cards, setCards] = useState<CardItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    if (!formatSlug) return
    setLoading(true);
    ;(async () => {
      try {
        const url = `/api/cards/for-format?slug=${encodeURIComponent(formatSlug)}&variant=${encodeURIComponent(variant)}`
        let res = await fetch(url, { cache: 'no-store' })
        if (!mounted) return
        if (res.ok) {
          const data = await res.json()
          setCards(Array.isArray(data) ? data : [])
        } else if (res.status === 304) {
          // Not modified — if we have no cards yet, retry with cache-buster
          if (!cards || cards.length === 0) {
            const retryUrl = `${url}&cb=${Date.now()}`
            console.warn('CardGallery: 304 received, retrying with cache-buster', retryUrl)
            const r2 = await fetch(retryUrl, { cache: 'no-store' })
            if (r2.ok) {
              const data2 = await r2.json()
              setCards(Array.isArray(data2) ? data2 : [])
            } else {
              console.warn('CardGallery retry failed', r2.status)
            }
          } else {
            console.warn('CardGallery: 304 Not Modified for', url)
          }
        } else {
          console.warn('Failed to load cards for format:', res.status)
          setCards([])
        }
      } catch (e) {
        console.error('Failed to load cards for format', e)
        if (mounted) setCards([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [formatSlug, variant])

  const getArtUrl = (c: CardItem) => selectArtworkUrl(c, c.konamiId) || null

  if (!formatSlug) return <div className="text-sm text-gray-500">No format selected</div>
  if (loading) return <div className="text-sm text-gray-500">Loading cards...</div>

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {cards.map(c => (
        <button key={c.id} type="button" onClick={() => onSelect && onSelect(c)} className="w-full rounded-md overflow-hidden border hover:shadow-lg transition-shadow bg-gray-100 dark:bg-gray-800" style={{ maxWidth: 140, margin: '0 auto' }}>
          <CardImage src={getArtUrl(c)} card={c} konamiId={c.konamiId} alt={c.name} className="w-full" />
        </button>
      ))}
    </div>
  )
}
