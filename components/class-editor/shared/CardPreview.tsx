import React, { useEffect, useRef, useState } from 'react'
import { Card, Skill } from '../../../types/class-editor'
import CardDescription from './CardDescription'
import CardImage, { selectArtworkUrl } from '../../common/CardImage'

interface CardPreviewProps {
  card?: Card | null | any
  skills?: (Skill | undefined)[]
  className?: string
}

const artUrlFor = (card: any): string | null => selectArtworkUrl(card, card?.konamiId)

export default function CardPreview({ card, skills, className }: CardPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const imgs: HTMLImageElement[] = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
    const checkImg = (img: HTMLImageElement) => {
      try {
        if (img.naturalWidth === 0 || img.naturalHeight === 0 || img.naturalWidth <= 1) {
          img.style.display = 'none'
        }
      } catch (e) {}
    }
    imgs.forEach((img) => {
      if (img.complete) checkImg(img)
      else {
        img.addEventListener('load', () => checkImg(img), { once: true })
        img.addEventListener('error', () => { img.style.display = 'none' }, { once: true })
      }
    })
    return () => {
      imgs.forEach((img) => {
        img.removeEventListener('load', () => checkImg(img))
        img.removeEventListener('error', () => { img.style.display = 'none' })
      })
    }
  }, [card])
  // support callers that pass { card, modification }
  let resolved: any = card
  let modifications: any[] | undefined = undefined
  if (resolved && typeof resolved === 'object' && resolved.card) {
    modifications = resolved.modification ? [resolved.modification] : undefined
    resolved = resolved.card
  }

  if (!resolved) return <div className={className || ''}>No card</div>

  const img = artUrlFor(resolved)

  // If caller supplied `skills`, derive modifications from those skills so
  // previews reflect any pool-level modifications even when the card object
  // itself doesn't carry a `modification` wrapper.
  try {
    if ((!modifications || modifications.length === 0) && Array.isArray(skills) && skills.length > 0) {
      const fromSkills = skills.flatMap((s: any) => (s && s.modifications) ? s.modifications : [])
        .filter((m: any) => m && m.card && (m.card.id === resolved.id))
      if (fromSkills && fromSkills.length) modifications = fromSkills
    }
  } catch (e) {
    // ignore any shape issues
  }

  const getFirst = (obj: any, ...keys: string[]) => {
    for (const k of keys) {
      if (obj && (obj[k] !== undefined && obj[k] !== null && obj[k] !== '')) return obj[k]
    }
    return undefined
  }

  const tcgType = getFirst(resolved, 'type', 'cardType', 'types')
  const tcgDesc = getFirst(resolved, 'desc', 'description', 'text', 'longDescription')
  const atk = getFirst(resolved, 'atk', 'attack', 'ATK')
  const def = getFirst(resolved, 'def', 'defence', 'DEF')
  const level = getFirst(resolved, 'level', 'lv')
  const race = getFirst(resolved, 'race')
  const attribute = getFirst(resolved, 'attribute', 'attr')
  const archetype = getFirst(resolved, 'archetype', 'archetypeName', 'set')
  const scale = getFirst(resolved, 'scale', 'pendulumScale')
  const linkVal = getFirst(resolved, 'linkval', 'linkVal', 'linkrating')
  const subtypes = getFirst(resolved, 'subtypes', 'sub_types', 'subType', 'types')
  const formatSubtypes = (val: any): string[] | undefined => {
    if (val === undefined || val === null) return undefined
    let parts: string[] = []
    if (Array.isArray(val)) parts = val.map((v) => String(v || '').trim()).filter(Boolean)
    else parts = String(val).split(/[,\/]+/).map((s) => s.trim()).filter(Boolean)
    const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
    return parts.map(cap)
  }
  const formattedSubtypes = formatSubtypes(subtypes)
  const pendulumDesc = getFirst(resolved, 'pendulum_desc', 'pend_desc', 'pendulumDesc')
  const monsterDesc = getFirst(resolved, 'monster_desc', 'monsterDesc')
  const isTcgVariant = String(getFirst(resolved, 'variant', 'variantName') || '').toUpperCase() === 'TCG'
  const isPendulumType = typeof tcgType === 'string' && /pendulum/i.test(tcgType)
  const showPendulumEffects = isTcgVariant && isPendulumType
  const isSpellOrTrap = typeof tcgType === 'string' && /(spell|trap)/i.test(tcgType)

  const iconPath = (folder: string, name?: string | number) => {
    if (!name) return undefined
    try {
      const s = String(name)
      // try exact; fallback handling is in onError
      return `/icons/${folder}/${encodeURIComponent(s)}.png`
    } catch (e) {
      return undefined
    }
  }

  const IconValue = ({ value, folder }: { value?: string | number | any; folder?: string }) => {
    if (value === undefined || value === null || value === '') return null
    const str = String(value)
    const f = folder || 'types'
    const primary = iconPath(f, str)
    const upper = iconPath(f, String(str).toUpperCase())
    const lower = iconPath(f, String(str).toLowerCase())
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-white/6 rounded">
        <img
          src={primary}
          alt={str}
          className="w-4 h-4 object-contain"
          onError={(e: any) => {
            try {
              const el = e.currentTarget
              if (!el.dataset.triedAlt) {
                el.dataset.triedAlt = '1'
                // prefer lowercase filenames (many icons are lowercase, e.g. dragon.png)
                if (lower) el.src = lower
                else if (upper) el.src = upper
                else {
                  el.src = ''
                  el.style.display = 'none'
                }
              } else {
                el.src = ''
                el.style.display = 'none'
              }
            } catch (ex) {
              e.currentTarget.src = ''
              try { e.currentTarget.style.display = 'none' } catch (_) {}
            }
          }}
        />
        <div>{str}</div>
      </div>
    )
  }

  return (
    <div className={`${className || ''} text-white h-full min-h-0 overflow-hidden`}>
      <div className="flex flex-col items-start gap-3 h-full min-h-0">
        {/* Artwork: fixed aspect ratio container, top-aligned, crops only the bottom */}
        <div className="w-full rounded overflow-hidden shadow-lg relative overflow-hidden flex-none" style={{ paddingTop: '100%', maxHeight: '48%' }}>
          {/* Use a normal img to fill the absolute preview container consistently */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img || ''}
            alt={resolved.name || 'Card'}
            className="absolute top-0 left-0 w-full h-full object-cover object-top block"
            onLoad={() => setImgLoaded(true)}
            onError={(e:any) => { e.currentTarget.style.display = 'none'; setImgLoaded(false) }}
            style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 120ms linear' }}
          />
        </div>

        {/* Name & Variant */}
        <div className="w-full">
          <div className="text-xl font-bold leading-tight">{resolved.name || 'Card'}</div>
          {resolved.variant && <div className="text-xs text-white/80 mt-1">{resolved.variant}</div>}
        </div>

        {/* Type */}
        {tcgType && <div className="w-full text-sm text-white/80">{tcgType}</div>}

        {/* Level / Attribute / Race / Subtypes / Link (icons shown left of value) */}
        <div className="w-full flex flex-wrap items-center gap-3 text-sm mt-1">
          {isSpellOrTrap ? (
            // For Spell/Trap cards show only the race text (no icons at all)
            race ? (
              <div className="px-2 py-1 bg-white/6 rounded">{Array.isArray(race) ? race.join(', ') : String(race)}</div>
            ) : null
          ) : (
            <>
              {typeof level !== 'undefined' && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white/6 rounded">
                  <img src="/icons/levelrank.png" alt="level" className="w-4 h-4 object-contain" onError={(e:any)=>{e.currentTarget.src=''}} />
                  <div>{level}</div>
                </div>
              )}
              {attribute && <IconValue value={attribute} folder="attributes" />}
              {race && <IconValue value={race} folder="types" />}
              {formattedSubtypes && <div className="px-2 py-1 bg-white/6 rounded">{formattedSubtypes.join(' / ')}</div>}
              {typeof scale !== 'undefined' && scale !== null && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white/6 rounded">
                  <img src="/icons/PendulumLeftIcon.png" alt="pend-left" className="w-4 h-4 object-contain" onError={(e:any)=>{e.currentTarget.src=''}} />
                  <div className="font-mono">{scale}</div>
                  <img src="/icons/PendulumRightIcon.png" alt="pend-right" className="w-4 h-4 object-contain" onError={(e:any)=>{e.currentTarget.src=''}} />
                </div>
              )}
              {typeof linkVal !== 'undefined' && linkVal !== null && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white/6 rounded">
                  <img src="/icons/linkrating.png" alt="link" className="w-4 h-4 object-contain" onError={(e: any) => { e.currentTarget.src = '' }} />
                  <div>{linkVal}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ATK / DEF (moved above description so description can expand into footer space) */}
        <div className="w-full mt-1 text-sm text-white flex gap-4">
          {typeof atk !== 'undefined' && (
            <div className="flex items-center gap-2">
              <img src="/icons/atk.png" alt="atk" className="w-4 h-4 object-contain" onError={(e: any) => { e.currentTarget.src = '' }} />
              <div className="font-mono">ATK/{atk === -1 ? '?' : atk}</div>
            </div>
          )}
          {typeof def !== 'undefined' && (
            <div className="flex items-center gap-2">
              <img src="/icons/def.png" alt="def" className="w-4 h-4 object-contain" onError={(e: any) => { e.currentTarget.src = '' }} />
              <div className="font-mono">DEF/{def === -1 ? '?' : def}</div>
            </div>
          )}
        </div>

        {/* Description: for TCG pendulum monsters show pendulum+monster effects when present */}
        <div className="w-full text-sm text-white leading-relaxed mt-1 pr-2 flex-1 overflow-y-auto min-h-0">
          {/* If there are modifications, render only the condition note above the description */}
          {modifications ? (
            <CardDescription card={resolved} modifications={modifications} showOnlyNote />
          ) : null}
          {showPendulumEffects && (pendulumDesc || monsterDesc) ? (
            <div>
              {pendulumDesc ? (
                <div>
                  <div className="inline-block text-[10px] font-semibold uppercase bg-white/6 text-white/90 px-2 py-1 rounded -mb-1">Pendulum Effect</div>
                  <div className="whitespace-pre-wrap mt-2 text-sm text-white/95">{pendulumDesc}</div>
                </div>
              ) : null}

              {monsterDesc ? (
                <div className="mt-4">
                  <div className="inline-block text-[10px] font-semibold uppercase bg-white/6 text-white/90 px-2 py-1 rounded -mb-1">Monster Effect</div>
                  <div className="whitespace-pre-wrap mt-2 text-sm text-white/95">{monsterDesc}</div>
                </div>
              ) : null}
            </div>
          ) : modifications ? (
            <CardDescription
              card={resolved}
              skills={skills}
              modifications={modifications}
              suppressNote
            />
          ) : tcgDesc ? (
            <div className="whitespace-pre-wrap">{tcgDesc}</div>
          ) : (
            <CardDescription card={resolved} skills={skills} />
          )}
        </div>
        {/* (modifications banner moved above description) */}
      </div>
    </div>
  )
}
