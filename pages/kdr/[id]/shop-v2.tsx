import React from 'react'
import { useRouter } from 'next/router'
import { ShopPageV2 } from '../../../components/shop-v2'

export default function KdrShopV2Page() {
  const router = useRouter()
  const { id } = router.query
  if (!id || Array.isArray(id)) return null
  return <ShopPageV2 kdrId={String(id)} />
}
