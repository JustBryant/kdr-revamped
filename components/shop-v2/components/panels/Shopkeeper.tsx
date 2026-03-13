import React, { useEffect, useRef } from 'react'
import axios from 'axios'
import { useShopContext } from '../../ShopContext'

export default function Shopkeeper() {
  const { player, setPlayer } = useShopContext()
  const shopkeeper = player?.shopState?.shopkeeper || null
  const greeting = player?.shopState?.shopkeeperGreeting || null

  const image = shopkeeper?.image || null
  const name = shopkeeper?.name || 'Shopkeeper'

  const fetchRef = useRef<{ inFlight: boolean }>({ inFlight: false })

  useEffect(() => {
    let mounted = true
    if (!player) return

    const skId = player?.shopState?.shopkeeper?.id
    const skImgPresent = !!player?.shopState?.shopkeeper?.image

    if (skId && !skImgPresent && !fetchRef.current.inFlight) {
      fetchRef.current.inFlight = true
      axios.get(`/api/shopkeepers/${encodeURIComponent(skId)}`)
        .then(res => {
          if (!mounted) return
          const data = res.data || {}
          if (data && data.image) {
            setPlayer((prev: any) => prev ? ({ ...prev, shopState: { ...(prev.shopState || {}), shopkeeper: { ...(prev.shopState?.shopkeeper || {}), image: data.image } } }) : prev)
          }
        })
        .catch(() => {})
        .finally(() => { fetchRef.current.inFlight = false })
    }

    // If no shopkeeper at all, fetch the canonical default
    if (!skId && !fetchRef.current.inFlight) {
      fetchRef.current.inFlight = true
      axios.get('/api/shopkeepers/default')
        .then(res => {
          if (!mounted) return
          const sk = res.data || null
          if (sk && sk.id) {
            setPlayer((prev: any) => ({ ...(prev || {}), shopState: { ...(prev?.shopState || {}), shopkeeper: sk } }))
          }
        })
        .catch(() => {})
        .finally(() => { fetchRef.current.inFlight = false })
    }

    return () => { mounted = false }
  }, [player?.shopState?.shopkeeper?.id, player?.shopState?.shopkeeper?.image, player, setPlayer])

  return (
    <>
      <div className="w-full p-4 flex flex-col items-start gap-4">
        <div className="w-full">
          {image ? (
            <img src={image} alt={name} className="w-full h-72 object-contain shopkeeper-float" />
          ) : (
            <div className="w-full h-72 flex items-center justify-center text-sm text-gray-400">No image</div>
          )}
        </div>

        {/* name and subtitle intentionally removed to keep left column compact */}
      </div>

      <style jsx>{`
        .shopkeeper-float { transform-origin: center; animation: shopFloat 4200ms ease-in-out infinite; }
        @keyframes shopFloat {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(1deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
      `}</style>
    </>
  )
}
