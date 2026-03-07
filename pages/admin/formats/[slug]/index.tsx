import React from 'react';
import Layout from '../../../../components/Layout';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useEffect, useState } from 'react';

export default function FormatDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const slug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug as string | undefined;
  const [valid, setValid] = useState<boolean | null>(null);
  const [formatName, setFormatName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/formats/${encodeURIComponent(slug)}`)
        if (!cancelled) {
          setValid(true)
          setFormatName(res.data.name)
        }
      } catch (err: any) {
        if (!cancelled) {
          setValid(false)
          // redirect to formats list after short delay
          router.replace('/admin/formats')
        }
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  const handleRename = async () => {
    if (!slug || !formatName.trim()) return;
    setSavingName(true);
    try {
      const res = await axios.patch(`/api/formats/${encodeURIComponent(slug)}`, {
        name: formatName.trim()
      });
      setIsEditingName(false);
      // If the slug changed, we need to redirect to the new URL
      if (res.data.slug && res.data.slug !== slug) {
        router.push(`/admin/formats/${res.data.slug}`);
      }
    } catch (err) {
      console.error('Failed to rename format:', err);
      alert('Failed to rename format');
    } finally {
      setSavingName(false);
    }
  };

  if (status === 'loading') return <div>Loading...</div>;

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const base = `/admin/formats/${slug}`
  if (valid === false) {
    return <div className="p-8 text-center">Format not found — redirecting to formats list...</div>
  }

  if (valid === null) {
    return <div className="p-8 text-center">Loading format...</div>
  }
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-8">
          <Link href="/admin/formats" className="text-blue-600 hover:underline mr-4">
            &larr; Back to Formats
          </Link>
          <div className="flex-1 flex items-center">
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={formatName}
                  onChange={(e) => setFormatName(e.target.value)}
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-2xl font-bold text-gray-900 dark:text-white"
                  autoFocus
                />
                <button
                  onClick={handleRename}
                  disabled={savingName}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mr-4 whitespace-nowrap overflow-hidden text-ellipsis">
                  {formatName || 'KDR Dashboard'}
                </h1>
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="text-gray-400 hover:text-blue-500"
                >
                  ✏️
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href={`${base}/classes`} className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">⚔️</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Classes
              </h2>
            </div>
          </Link>

          <Link href={`${base}/generic-skills`} className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Generic Skills
              </h2>
            </div>
          </Link>

          <Link href={`${base}/generic-loot`} className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">💰</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Generic Loot
              </h2>
            </div>
          </Link>

          <Link href={`${base}/treasures`} className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">💎</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Treasures
              </h2>
            </div>
          </Link>

          <Link href={`${base}/settings`} className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">⚙️</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Settings
              </h2>
            </div>
          </Link>
        </div>
      </div>
  );
}
