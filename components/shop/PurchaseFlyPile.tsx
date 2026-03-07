import React, { forwardRef, useImperativeHandle } from 'react'
import { CARD_BACK_URL } from '../../lib/constants'

export type PurchaseFlyPileHandle = {
  fly: (poolId: string, poolObj: any, fromEl?: HTMLElement | null, toEl?: HTMLElement | null) => Promise<void>
}

const PurchaseFlyPile = forwardRef<PurchaseFlyPileHandle, {}>((_props, ref) => {
  useImperativeHandle(ref, () => ({
    fly(poolId: string, poolObj: any, fromEl?: HTMLElement | null, toEl?: HTMLElement | null) {
      return new Promise<void>((resolve) => {
        try {
          const root = document.body
          if (!root) return resolve()
          const poolNode = fromEl || null
          const targetBtn = toEl || null
          if (!poolNode || !targetBtn) return resolve()

          const destRect = targetBtn.getBoundingClientRect()

          // Create overlay for clones
          const overlay = document.createElement('div')
          overlay.style.position = 'fixed'
          overlay.style.left = '0'
          overlay.style.top = '0'
          overlay.style.width = '100%'
          overlay.style.height = '100%'
          overlay.style.pointerEvents = 'none'
          overlay.style.zIndex = '20000'
          root.appendChild(overlay)

          // Try to clone actual shown images inside the pool DOM node.
          const allImgs = Array.from(poolNode.querySelectorAll('img')).filter((n: any) => n && n.src)
          const isCardBackSrc = (s?: string) => {
            if (!s) return false
            try {
              const lower = String(s).toLowerCase()
              const cb = String(CARD_BACK_URL || '').toLowerCase()
              if (cb && lower === cb) return true
              if (lower.endsWith('/card-back.jpg')) return true
              if (lower.includes('/card-back')) return true
              if (lower.includes('cardback')) return true
            } catch (e) {}
            return false
          }

          const likelyFront = allImgs.filter((img: HTMLImageElement) => {
            try {
              const src = (img && img.src) || ''
              if (!src) return false
              // Prefer images that are not the card-back
              if (isCardBackSrc(src)) return false
              return true
            } catch (e) { return true }
          })
          const sourceImgs = (likelyFront && likelyFront.length > 0) ? likelyFront.slice(0, 3) : allImgs.slice(0, 3)
          const imgs: HTMLImageElement[] = []
          const rects: DOMRect[] = []

          if (sourceImgs.length > 0) {
            // Animate the actual DOM image elements (no clones). Insert placeholders to preserve layout.
            const placeholders: Array<{ placeholder: HTMLElement, parent: Node | null, nextSibling: ChildNode | null, original: HTMLImageElement }> = []
            sourceImgs.forEach((srcEl: HTMLImageElement, idx: number) => {
              try {
                const r = srcEl.getBoundingClientRect()
                // create placeholder to keep layout
                const placeholder = document.createElement('div')
                placeholder.style.width = `${r.width}px`
                placeholder.style.height = `${r.height}px`
                placeholder.style.display = getComputedStyle(srcEl).display || 'inline-block'
                // insert placeholder in place of the original image
                const parent = srcEl.parentNode
                const nextSibling = srcEl.nextSibling
                try { parent?.replaceChild(placeholder, srcEl) } catch (e) {}
                placeholders.push({ placeholder, parent, nextSibling, original: srcEl })

                  // move the actual image into the overlay and preserve its exact visual size/position
                  srcEl.style.position = 'fixed'
                  srcEl.style.left = `${r.left}px`
                  srcEl.style.top = `${r.top}px`
                  // enforce exact measured pixel dimensions (both attributes and styles)
                  try { srcEl.setAttribute('width', String(Math.round(r.width))) } catch (e) {}
                  try { srcEl.setAttribute('height', String(Math.round(r.height))) } catch (e) {}
                  srcEl.style.width = `${r.width}px`
                  srcEl.style.height = `${r.height}px`
                  srcEl.style.maxWidth = `${r.width}px`
                  srcEl.style.maxHeight = `${r.height}px`
                  srcEl.style.boxSizing = 'border-box'
                  srcEl.style.objectFit = 'contain'
                  srcEl.style.margin = '0'
                  // remove borders/shadows so only the raw image is visible
                  srcEl.style.border = 'none'
                  srcEl.style.boxShadow = 'none'
                  // rendering hints to keep image crisp
                  srcEl.style.willChange = 'transform, left, top'
                  srcEl.style.imageRendering = 'auto'
                  srcEl.style.transform = 'none'
                  srcEl.style.transformOrigin = 'center center'
                  srcEl.style.transition = 'transform 300ms cubic-bezier(.2,.9,.2,1), left 300ms cubic-bezier(.2,.9,.2,1), top 300ms cubic-bezier(.2,.9,.2,1)'
                  srcEl.style.zIndex = `${20010 + idx}`
                  overlay.appendChild(srcEl)
                  imgs.push(srcEl)
                  rects.push(r)
              } catch (e) { /* continue */ }
            })
          } else {
            // fallback: build images from pool data as before
            const cardsArr = Array.isArray(poolObj.cards) ? poolObj.cards.slice(0, 3) : []
            if (cardsArr.length === 0) {
              try { overlay.remove() } catch (e) {}
              return resolve()
            }
            const poolRect = poolNode.getBoundingClientRect()
            const centerX = poolRect.left + poolRect.width / 2
            const centerY = poolRect.top + poolRect.height / 2
            cardsArr.forEach((c: any, idx: number) => {
              const img = document.createElement('img')
              const src = (c && (c.artworkUrl || c.image || c.imageUrl)) ? (c.artworkUrl || c.image || c.imageUrl) : CARD_BACK_URL
              img.src = src
              img.style.position = 'fixed'
              img.style.left = `${centerX - 48 + idx * 10}px`
              img.style.top = `${centerY - 64 + idx * 6}px`
              img.style.width = '96px'
              img.style.height = '128px'
              img.style.objectFit = 'contain'
              img.style.borderRadius = '8px'
              // remove borders/shadows so only the image is visible during animation
              img.style.border = 'none'
              img.style.boxShadow = 'none'
              img.style.transition = 'transform 300ms cubic-bezier(.2,.9,.2,1), left 300ms cubic-bezier(.2,.9,.2,1), top 300ms cubic-bezier(.2,.9,.2,1), opacity 400ms linear'
              img.style.zIndex = `${20010 + idx}`
              overlay.appendChild(img)
              imgs.push(img)
              rects.push(new DOMRect(centerX - 48 + idx * 10, centerY - 64 + idx * 6, 96, 128))
            })
          }

          // compute pile center from source rects (average center)
          let centerX = 0
          let centerY = 0
          if (rects.length > 0) {
            rects.forEach(r => { centerX += (r.left + r.width / 2); centerY += (r.top + r.height / 2) })
            centerX = centerX / rects.length
            centerY = centerY / rects.length
          } else {
            const poolRect = poolNode.getBoundingClientRect()
            centerX = poolRect.left + poolRect.width / 2
            centerY = poolRect.top + poolRect.height / 2
          }

          // Force all animated images to the exact pixel size of the middle card
          try {
            const midIndex = Math.floor(rects.length / 2)
            const midRect = rects[midIndex] || rects[0]
            if (midRect) {
              const targetW = Math.round(midRect.width)
              const targetH = Math.round(midRect.height)
              imgs.forEach((img) => {
                try {
                  // enforce exact pixel dimensions and clear any transforms
                  img.style.width = `${targetW}px`
                  img.style.height = `${targetH}px`
                  img.style.maxWidth = `${targetW}px`
                  img.style.maxHeight = `${targetH}px`
                  try { img.setAttribute('width', String(targetW)) } catch (e) {}
                  try { img.setAttribute('height', String(targetH)) } catch (e) {}
                  img.style.boxSizing = 'border-box'
                  // remove any scaling/rotation so size equals pixels exactly
                  img.style.transform = 'none'
                  img.style.transformOrigin = 'center center'
                  // restrict transitions to position/transform only (avoid layout changes)
                  img.style.transition = 'left 300ms cubic-bezier(.2,.9,.2,1), top 300ms cubic-bezier(.2,.9,.2,1), transform 300ms cubic-bezier(.2,.9,.2,1)'
                } catch (e) {}
              })
            }
          } catch (e) {}

          // Step 1: gather into a neat stacked pile near the computed center
          window.setTimeout(() => {
            const mid = Math.floor(imgs.length / 2)
            imgs.forEach((img, i) => {
              // position all images centered on the same pile center
              const w = parseFloat(img.style.width) || (rects[i] ? rects[i].width : 96)
              const h = parseFloat(img.style.height) || (rects[i] ? rects[i].height : 128)
              const left = centerX - w / 2
              const top = centerY - h / 2
              img.style.left = `${left}px`
              img.style.top = `${top}px`
              // keep same rendered size; place all exactly overlapping
              img.style.transform = 'translate3d(0,0,0)'
              // Ensure the middle image sits on top; outer images go behind the middle one
              if (i === mid) {
                img.style.zIndex = `${20030}`
                img.style.opacity = '1'
              } else {
                img.style.zIndex = `${20010 + i}`
                img.style.opacity = '1'
              }
            })
          }, 30)

          // Step 2: fly to target — compute per-image translate and scale so sizes remain proportional
          window.setTimeout(() => {
            const destX = destRect.left + destRect.width / 2
            const destY = destRect.top + destRect.height / 2
            imgs.forEach((img, i) => {
              // current center of this cloned img
              const curLeft = parseFloat(img.style.left || '0')
              const curTop = parseFloat(img.style.top || '0')
              const srcW = (rects[i] && rects[i].width) ? rects[i].width : (parseFloat(img.style.width || '96'))
              const srcH = (rects[i] && rects[i].height) ? rects[i].height : (parseFloat(img.style.height || '128'))
              const curCenterX = curLeft + srcW / 2
              const curCenterY = curTop + srcH / 2
              const dx = destX - curCenterX
              const dy = destY - curCenterY
              // scale so the thumb width matches destRect.width (preserve clarity)
              const targetScale = srcW > 0 ? (destRect.width / srcW) : 0.18
              const clampedScale = Math.max(0.12, Math.min(0.6, targetScale))
              img.style.transition = 'transform 600ms cubic-bezier(0.55, 0.055, 0.675, 0.19), left 600ms cubic-bezier(0.55,0.055,0.675,0.19), top 600ms cubic-bezier(0.55,0.055,0.675,0.19)'
              img.style.transform = `translate(${dx}px, ${dy}px) scale(${clampedScale})`
            })
          }, 380)

          // Cleanup and resolve once animation finished
          window.setTimeout(() => {
            try {
              // restore original images into their original places if placeholders remain
              try {
                // find placeholders and originals in the overlay imgs list
                imgs.forEach((img) => {
                  try {
                    // find matching placeholder by comparing src/matching sizes
                    const matching = sourceImgs.find((s: any) => s && s.src === img.src)
                    // if a matching placeholder exists in DOM saved earlier, try to restore
                  } catch (e) {}
                })
              } catch (e) {}
              overlay.remove()
            } catch (e) {}
            resolve()
          }, 1100)
        } catch (e) { try { resolve() } catch (er) {} }
      })
    }
  }), [])

  return null
})

export default PurchaseFlyPile
