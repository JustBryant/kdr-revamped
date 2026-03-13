import React from 'react'
import axios from 'axios'

export default function useShopCaches() {
  const dialoguesCacheRef = React.useRef<Record<string, any[]>>({})
  const dialoguesFetchPromisesRef = React.useRef<Record<string, Promise<any> | undefined>>({})
  const cardDetailsCacheRef = React.useRef<Record<string, any>>({})
  const cardFetchPromisesRef = React.useRef<Record<string, Promise<any> | undefined>>({})

  const ensureCardDetails = async (cardLike: any) => {
    try {
      if (!cardLike) return cardLike
      const idKey = cardLike.id || (cardLike.konamiId ? String(cardLike.konamiId) : null)
      if (!idKey) return cardLike
      // Use a shared global cache so different hook instances don't duplicate fetches
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const globalCardCache = (typeof window !== 'undefined' && (window as any).__KDR_CARD_CACHE__) || undefined
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const globalCardPromises = (typeof window !== 'undefined' && (window as any).__KDR_CARD_PROMISES__) || undefined

      if (globalCardCache && globalCardCache[idKey]) {
        try { console.debug('useShopCaches: global cache hit', idKey) } catch (e) {}
        cardDetailsCacheRef.current[idKey] = globalCardCache[idKey]
        return cardDetailsCacheRef.current[idKey]
      }

      if (globalCardPromises && globalCardPromises[idKey]) {
        try { console.debug('useShopCaches: global in-flight promise reuse', idKey) } catch (e) {}
        cardFetchPromisesRef.current[idKey] = globalCardPromises[idKey]
        return await cardFetchPromisesRef.current[idKey]
      }

      if (cardDetailsCacheRef.current[idKey]) {
        try { console.debug('useShopCaches: local cache hit', idKey) } catch (e) {}
        return cardDetailsCacheRef.current[idKey]
      }
      if (cardFetchPromisesRef.current[idKey]) {
        try { console.debug('useShopCaches: local in-flight promise reuse', idKey) } catch (e) {}
        return await cardFetchPromisesRef.current[idKey]
      }

      try { console.debug('useShopCaches: fetching card details', idKey) } catch (e) {}

      // Create a promise and register it in the global promises map immediately
      // so concurrent hook instances reuse the same in-flight request and avoid races.
      const p = new Promise<any>(async (resolve) => {
        try {
          const res = await axios.get(`/api/cards/${encodeURIComponent(idKey)}`)
          const data = res.data || null
          if (data) cardDetailsCacheRef.current[idKey] = data
          // populate global cache when available
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (typeof window !== 'undefined') {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              window.__KDR_CARD_CACHE__ = window.__KDR_CARD_CACHE__ || {}
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              window.__KDR_CARD_CACHE__[idKey] = data
              try { console.debug('useShopCaches: populated global cache', idKey) } catch (e) {}
            }
          } catch (e) {}

          resolve(data || cardLike)
        } catch (e) {
          resolve(cardLike)
        } finally {
          delete cardFetchPromisesRef.current[idKey]
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (typeof window !== 'undefined') {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              window.__KDR_CARD_PROMISES__ = window.__KDR_CARD_PROMISES__ || {}
              // keep in sync: remove promise from global store
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              delete window.__KDR_CARD_PROMISES__[idKey]
              try { console.debug('useShopCaches: removed global in-flight promise', idKey) } catch (e) {}
            }
          } catch (e) {}
        }
      })

      // register promise locally
      cardFetchPromisesRef.current[idKey] = p
      try {
        // also register global in-flight promise so other hook instances reuse it
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          window.__KDR_CARD_PROMISES__ = window.__KDR_CARD_PROMISES__ || {}
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          window.__KDR_CARD_PROMISES__[idKey] = p
        }
      } catch (e) {}

      return await p
    } catch (e) {
      return cardLike
    }
  }

  const ensureDialoguesForShopkeeper = async (shopkeeperId: string | number | null) => {
    try {
      if (!shopkeeperId) return []
      const key = String(shopkeeperId)
      if (dialoguesCacheRef.current[key]) return dialoguesCacheRef.current[key]
      if (dialoguesFetchPromisesRef.current[key]) return await dialoguesFetchPromisesRef.current[key]
      const p = axios.get(`/api/shopkeepers/${encodeURIComponent(key)}/dialogues`).then(r => r.data || [])
      dialoguesFetchPromisesRef.current[key] = p
      try {
        const resData = await p
        dialoguesCacheRef.current[key] = resData
        return resData
      } catch (e) {
        return []
      } finally {
        delete dialoguesFetchPromisesRef.current[key]
      }
    } catch (e) {
      return []
    }
  }

  return {
    dialoguesCacheRef,
    ensureDialoguesForShopkeeper,
    cardDetailsCacheRef,
    ensureCardDetails,
  }
}
