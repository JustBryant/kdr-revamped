import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

interface ShopkeeperListItem { id: string; name: string; description?: string }

export default function ShopkeeperList() {
  const [shopkeepers, setShopkeepers] = useState<ShopkeeperListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { fetchList() }, [])

  const fetchList = async () => {
    setIsLoading(true)
    const res = await fetch('/api/admin/shopkeepers', { credentials: 'same-origin' })
    if (res.status === 403) { router.push('/'); return }
    if (!res.ok) { setShopkeepers([]); setIsLoading(false); return }
    const data = await res.json()
    setShopkeepers(data)
    setIsLoading(false)
  }

  const createAndOpen = async () => {
    setCreating(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/admin/shopkeepers', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Shopkeeper' }) })
      setCreating(false)
      if (!res.ok) {
        let body = 'Failed to create'
        try { const json = await res.json(); body = json.error || JSON.stringify(json) } catch (e) { body = await res.text().catch(()=>res.statusText) }
        setErrorMsg(`Create failed: ${body} (status ${res.status})`)
        return
      }
      const data = await res.json()
      if (!data?.id) {
        setErrorMsg('Create succeeded but response missing id')
        return
      }
      router.push(`/admin/shopkeepers/${data.id}`)
    } catch (err: any) {
      setCreating(false)
      setErrorMsg((err as any)?.message || 'Network error')
    }
  }

  return (
    <div className="container mx-auto p-6">
      <Head><title>Shopkeepers | Admin</title></Head>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Shopkeepers</h1>
        <div>
          <button onClick={createAndOpen} className="px-3 py-1 bg-blue-600 text-white rounded" disabled={creating}>{creating ? 'Creating...' : 'Create Shopkeeper'}</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
        {errorMsg && <div className="mb-4 text-sm text-red-600">{errorMsg}</div>}
        {isLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <ul className="space-y-2">
            {shopkeepers.map(s => (
              <li key={s.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-gray-600">{s.description}</div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/shopkeepers/${s.id}`} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600">Edit</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } }
  }
  if (session.user?.role !== 'ADMIN') {
    return { redirect: { destination: '/', permanent: false } }
  }
  return { props: {} }
}
