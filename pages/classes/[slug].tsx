import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import Head from 'next/head'
import Link from 'next/link'
import { getClassImageUrl } from '../../lib/constants'

export default function FormatClassesPage() {
  const router = useRouter()
  const { slug } = router.query
  const [format, setFormat] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let mounted = true
    axios.get(`/api/formats/${slug}`)
      .then(res => {
        if (!mounted) return
        setFormat(res.data.format)
        setLoading(false)
      })
      .catch(err => {
        if (!mounted) return
        console.error('Failed to fetch format', err)
        setError('Format not found or failed to load.')
        setLoading(false)
      })
    return () => { mounted = false }
  }, [slug])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm font-bold uppercase tracking-widest text-gray-500">Loading Format roster...</span>
      </div>
    )
  }

  if (error || !format) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-rose-500 mb-4">{error}</h1>
        <Link href="/classes" className="text-blue-500 hover:underline">Back to Formats</Link>
      </div>
    )
  }

  const formatClasses = format.formatClasses || []
  // Only top-level classes (no parent) are main classes
  const mainFormatClasses = formatClasses.filter((fc: any) => !fc.class.parentClassId)
  const sortedClasses = [...mainFormatClasses].sort((a: any, b: any) => a.class.name.localeCompare(b.class.name))

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20 pt-8">
      <Head>
        <title>{format.name} Classes - KDR</title>
      </Head>

      <div className="mb-12">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/classes" className="text-sm font-bold text-blue-500 hover:underline uppercase tracking-widest">
            Formats
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{format.name}</span>
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tight mb-2">
          {format.name} <span className="text-blue-500 italic">Classes</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl">
          {format.description || `Browse the available classes for the ${format.name} format.`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
        {sortedClasses.map((fc: any) => {
          const c = fc.class
          const subclasses = c.subclasses || []
          
          return (
            <div key={fc.id} className="flex flex-col gap-2 group">
              <Link 
                href={`/classes/view/${c.id}`}
                className="relative cursor-pointer"
              >
                <div className="relative aspect-square transition-all duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_15px_15px_rgba(59,130,246,0.2)]">
                  <img 
                    src={getClassImageUrl(c.image)} 
                    alt={c.name}
                    className="w-full h-full object-contain"
                  />
                  {/* Main Class Badge */}
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                    Main
                  </div>
                </div>
              </Link>
              
              {/* Subclasses row */}
              {subclasses.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  {subclasses.map((sub: any) => (
                    <Link 
                      key={sub.id} 
                      href={`/classes/view/${sub.id}`}
                      title={sub.name}
                      className="w-8 h-8 relative hover:scale-125 transition-transform"
                    >
                      <img 
                        src={getClassImageUrl(sub.image)} 
                        alt={sub.name}
                        className="w-full h-full object-contain drop-shadow-sm border border-transparent hover:border-blue-400 rounded-sm"
                      />
                    </Link>
                  ))}
                </div>
              )}
              
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 truncate px-1">
                  {c.name}
                </p>
              </div>
            </div>
          )
        })}

        {sortedClasses.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-gray-500 italic">No classes found for this format.</p>
          </div>
        )}
      </div>
    </div>
  )
}
