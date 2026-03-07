import React, { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { RichTextRenderer } from '../../components/RichText'

export default function PatchNoteView() {
  const router = useRouter()
  const { version } = router.query
  const [patch, setPatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (version) {
      fetch(`/api/patch-notes?version=${version}`)
        .then(res => res.json())
        .then(data => {
          setPatch(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [version])

  const renderContent = (content: string) => {
    try {
      const data = JSON.parse(content)
      return (
        <div className="space-y-8">
          {data.sections.map((section: any, idx: number) => (
            <div key={idx} className="bg-white dark:bg-gray-800/40 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
              <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                <span className="w-1.5 h-8 bg-blue-500 rounded-full"></span>
                {section.title}
              </h2>
              <ul className="space-y-4">
                {section.items.map((item: string, i: number) => (
                  <li key={i} className="flex gap-4 group">
                    <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-blue-500/50 group-hover:bg-blue-500 transition-colors flex-shrink-0 animate-pulse"></span>
                    <div className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                      <RichTextRenderer content={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )
    } catch (e) {
      return (
        <div className="prose dark:prose-invert max-w-none bg-white dark:bg-gray-800/40 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
          {content}
        </div>
      )
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    )
  }

  if (!patch) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Patch Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">The patch you're looking for doesn't exist or hasn't been published yet.</p>
        <a href="/patch-notes" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30">
          Back to Patch Notes
        </a>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{patch.title} - v{patch.version} | KDR Revamped</title>
      </Head>
      <div className="max-w-4xl mx-auto py-16 px-6">
        <div className="mb-12">
          <a href="/patch-notes" className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 transition-colors mb-8 group font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7" />
            </svg>
            BACK TO ALL PATCHES
          </a>
          
          <div className="flex items-center gap-4 mb-4">
            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
              VERSION {patch.version}
            </span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-black mb-6 text-gray-900 dark:text-white tracking-tight uppercase">
            {patch.title}
          </h1>
          
          <div className="flex items-center gap-6 p-1 rounded-full w-fit pr-6">
            <div className="flex items-center gap-3">
              {patch.author?.image ? (
                <img src={patch.author.image} alt={patch.author.name} className="h-10 w-10 rounded-full border-2 border-white dark:border-gray-800 shadow-md" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shadow-md">
                   {patch.author?.name?.[0] || 'A'}
                </div>
              )}
              <div className="text-sm">
                <p className="text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest text-[10px]">Posted By</p>
                <p className="font-bold text-gray-900 dark:text-white leading-none">{patch.author?.name || 'Admin'}</p>
              </div>
            </div>
            <div className="h-6 w-px bg-gray-200 dark:border-gray-700"></div>
            <div className="text-sm">
              <p className="text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest text-[10px]">Release Date</p>
              <p className="font-bold text-gray-900 dark:text-white leading-none">
                {new Date(patch.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          {renderContent(patch.content)}
        </div>
      </div>
    </>
  )
}
