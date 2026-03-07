import React from 'react'

type CardLike = any

// Minimal inline SVG used as a visible 'failed to load' texture. Keep this local to avoid adding assets.
const DEFAULT_FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='420'><rect width='100%' height='100%' fill='%23222'/><text x='50%' y='50%' fill='%23fff' font-size='20' text-anchor='middle' dominant-baseline='middle'>Image failed</text></svg>"

// Prefer only DB-provided artwork fields. Do NOT construct konami/raw URLs here.
export function selectArtworkUrl(card?: CardLike, _konamiId?: number | null, options: { useLootArt?: boolean } = {}): string | null {
  if (!card) return null
  const useLootArt = options.useLootArt ?? false
  const variant = (card.variant || 'TCG').toUpperCase()

  try {
    // 1. Explicit override field
    if (card.artworkUrl) return card.artworkUrl

    const artworksArr = Array.isArray(card.artworks) 
      ? card.artworks 
      : (card.artworks && typeof card.artworks === 'object' ? Object.values(card.artworks) : [])
    
    const target = artworksArr[card.primaryArtworkIndex || 0] || artworksArr[0]

    // 2. SHOP LOOT PATH (Forced full-card art)
    if (useLootArt) {
      if (target && typeof target === 'object') {
        if (variant === 'RUSH') {
          if (target.full_rush) return target.full_rush
          if (target.image_full_orr) return target.image_full_orr
          if (target.full_rush_orr) return target.full_rush_orr
        } else {
          // TCG (Loot uses full-card links. Favor small versions for performance if available)
          if (target.small_tcg) return target.small_tcg
          if (target.full_tcg) return target.full_tcg
        }
      }
      
      // Fallback within loot mode: prioritize non-crop fields
      if (card.imageUrlSmall && !card.imageUrlSmall.toLowerCase().includes('crop')) return card.imageUrlSmall
      if (card.imageUrl && !card.imageUrl.toLowerCase().includes('crop')) return card.imageUrl
      if (card.image && !card.image.toLowerCase().includes('crop')) return card.image
      
      // If we are here, we found no explicit full art. Try any artwork JSON entry that isn't a crop
      for (const a of artworksArr) {
        if (typeof a === 'object' && a) {
          const lootCandidate = a.small_tcg || a.full_tcg || a.small_rush || a.full_rush || a.image_url || a.image_url_small
          if (lootCandidate && !lootCandidate.toLowerCase().includes('crop')) return lootCandidate
        }
      }
    }

    // 3. DEFAULT PATH (Standard cropped art)
    // If NOT in loot mode, always favor cropped.
    if (!useLootArt && card.imageUrlCropped) return card.imageUrlCropped

    // 4. GENERAL FALLBACKS (Normal usage prefers crops, Loot usage avoids them)
    if (card.imageUrlSmall && (!useLootArt || !card.imageUrlSmall.toLowerCase().includes('crop'))) return card.imageUrlSmall
    if (card.imageUrl && (!useLootArt || !card.imageUrl.toLowerCase().includes('crop'))) return card.imageUrl
    if (card.image && (!useLootArt || !card.image.toLowerCase().includes('crop'))) return card.image

    // 5. LAST DITCH JSON SEARCH
    for (const a of artworksArr) {
      if (typeof a === 'string' && (!useLootArt || !a.toLowerCase().includes('crop'))) return a
      if (typeof a === 'object' && a) {
         if (useLootArt) {
            const lp = a.full_tcg || a.small_tcg || a.full_rush || a.image_url || a.image_url_small
            if (lp && !lp.toLowerCase().includes('crop')) return lp
         } else {
            const cp = a.image_url_cropped || a.image_url_cropped_tcg
            if (cp) return cp
         }
      }
    }

    // Absolute final return if nothing better found (even if it's a crop, unless in loot mode where we desperately want full art)
    if (useLootArt) {
      return card.imageUrl || card.imageUrlSmall || card.image || card.imageUrlCropped || null
    }
    return card.imageUrlCropped || card.imageUrlSmall || card.imageUrl || card.image || null
  } catch (e) {
    return card.imageUrlCropped || null
  }
}

interface CardImageProps {
  card?: CardLike
  konamiId?: number | null
  src?: string | null
  alt?: string
  className?: string
  fallbackSrc?: string
  useLootArt?: boolean
  onError?: () => void
  onLoad?: () => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseMove?: (e: React.MouseEvent) => void
  onMouseLeave?: () => void
  onWheel?: (e: React.WheelEvent) => void
  style?: React.CSSProperties
}

// Simple in-memory cache shared across all CardImage instances to prevent redundant API calls.
const globalArtworkCache = new Map<string, string | null>()

const CardImage: React.FC<CardImageProps> = ({
  card,
  konamiId,
  src,
  alt = 'Card',
  className = '',
  fallbackSrc = DEFAULT_FALLBACK,
  useLootArt = false,
  onLoad,
  onError,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onWheel,
  style
}) => {
  // 1. Resolve initial source synchronously if possible.
  // If we have a konamiId but no card object, we can't selectArtworkUrl yet.
  const resolvedInitial = React.useMemo(() => {
    if (src) return src
    if (card) return selectArtworkUrl(card, konamiId, { useLootArt })
    
    // If we only have a konamiId, check the global cache immediately.
    if (konamiId && globalArtworkCache.has(String(konamiId))) {
      return globalArtworkCache.get(String(konamiId))
    }
    return null
  }, [src, card, konamiId, useLootArt])

  const [imgSrc, setImgSrc] = React.useState<string | null | undefined>(resolvedInitial)
  const [didAttemptFetch, setDidAttemptFetch] = React.useState(!!resolvedInitial)

  const cacheKey = React.useMemo(() => {
    if (card && (card.id || card.konamiId)) return String(card.id || card.konamiId)
    if (konamiId) return String(konamiId)
    return null
  }, [card, konamiId])

  React.useEffect(() => {
    let mounted = true

    // If we have a resolved initial source, we are done.
    if (resolvedInitial) {
      setImgSrc(resolvedInitial)
      setDidAttemptFetch(true)
      return
    }

    // If no key to fetch, mark attempted so fallback can show.
    if (!cacheKey) {
      setImgSrc(null)
      setDidAttemptFetch(true)
      return
    }

    // Check global cache again in effect (insurance)
    if (globalArtworkCache.has(cacheKey)) {
      const cached = globalArtworkCache.get(cacheKey)
      setImgSrc(cached || null)
      setDidAttemptFetch(true)
      return
    }

    // fetch card details from our API to get artworks fields
    ;(async () => {
      try {
        const res = await fetch(`/api/cards/${encodeURIComponent(cacheKey)}`)
        if (!mounted) return
        
        if (!res.ok) {
          // If the direct lookup failed (404), try the search endpoint as a fallback
          if (res.status === 404) {
            try {
              const sres = await fetch(`/api/cards/search?q=${encodeURIComponent(cacheKey)}`)
              if (sres.ok) {
                const sdata = await sres.json()
                let list: any[] | null = null
                if (Array.isArray(sdata)) list = sdata
                else if (Array.isArray(sdata.results)) list = sdata.results
                else if (Array.isArray(sdata.data)) list = sdata.data
                else if (Array.isArray(sdata.cards)) list = sdata.cards

                const candidate = Array.isArray(list) && list.length > 0 ? list[0] : null
                let pickedFromSearch = candidate ? selectArtworkUrl(candidate, null, { useLootArt }) || null : null

                globalArtworkCache.set(cacheKey, pickedFromSearch)
                setImgSrc(pickedFromSearch)
                setDidAttemptFetch(true)
                return
              }
            } catch (se) {}
          }
          globalArtworkCache.set(cacheKey, null)
          setImgSrc(null)
          setDidAttemptFetch(true)
          return
        }

        const data = await res.json()
        const picked = selectArtworkUrl(data, null, { useLootArt }) || null
        globalArtworkCache.set(cacheKey, picked)
        if (!mounted) return
        setImgSrc(picked)
        setDidAttemptFetch(true)
      } catch (e) {
        if (!mounted) return
        globalArtworkCache.set(cacheKey, null)
        setImgSrc(null)
        setDidAttemptFetch(true)
      }
    })()

    return () => { mounted = false }
  }, [cacheKey, resolvedInitial, useLootArt])

  const showFallback = didAttemptFetch && !imgSrc
  const [aspectPadding, setAspectPadding] = React.useState<string>('140%')
  const imgRef = React.useRef<HTMLImageElement | null>(null)

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    try {
      const el = e.currentTarget
      imgRef.current = el
      const w = el.naturalWidth || el.width
      const h = el.naturalHeight || el.height
      if (w && h && w > 1) {
        const pad = `${(h / w) * 100}%`
        setAspectPadding(pad)
      }
    } catch (ex) {}
    try { onLoad?.() } catch (ex) {}
  }

  // eslint-disable-next-line @next/next/no-img-element
  const finalSrc = imgSrc || (showFallback ? fallbackSrc : '')
  
  return (
    <div style={{ width: '100%', minHeight: '1px' }} className="card-image-root relative">
      <div style={{ width: '100%', position: 'relative', paddingTop: aspectPadding, overflow: 'hidden' }}>
        {finalSrc && (
          <img
            ref={imgRef}
            src={finalSrc}
            alt={alt || (card && (card.name || card.title)) || 'Card'}
            className={`${'absolute top-0 left-0 w-full h-full object-contain block transition-opacity duration-200'}${className ? ' ' + className : ''} ${imgSrc ? 'opacity-100' : 'opacity-0'}`}
            style={style}
            onError={(e: any) => {
              try {
                const el = e.currentTarget
                if (el && el.src !== fallbackSrc) {
                  el.src = fallbackSrc
                  onError?.()
                }
              } catch (ex) {}
            }}
            onMouseEnter={onMouseEnter}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onWheel={onWheel}
            onLoad={handleImgLoad}
          />
        )}
      </div>
    </div>
  )
}

export default CardImage
