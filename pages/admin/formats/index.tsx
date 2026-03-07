import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function FormatsList() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createVariant, setCreateVariant] = useState('TCG')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formats, setFormats] = useState<Array<{id: string; name: string; slug: string; variant?: string}>>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    let mounted = true
    axios.get('/api/formats')
      .then((r) => { if (mounted) setFormats(r.data || []) })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const handleUpdateName = async (f: any) => {
    if (!editName.trim()) return
    setSavingEdit(true)
    try {
      const res = await axios.patch(`/api/formats/${f.slug}`, { name: editName.trim() })
      setFormats(prev => prev.map(fmt => fmt.id === f.id ? { ...fmt, name: res.data.name, slug: res.data.slug } : fmt))
      setEditingSlug(null)
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to update format name')
    } finally {
      setSavingEdit(false)
    }
  }

  if (status === 'loading') return <div>Loading...</div>;

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Select a Format</h1>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Format
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formats.map((f) => (
            <div key={f.id} className="relative group/card">
              <Link href={`/admin/formats/${f.slug}`} className="block">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover/card:border-blue-500 min-h-[140px]">
                  {editingSlug === f.slug ? (
                    <div className="flex flex-col gap-2 mb-2" onClick={(e) => e.preventDefault()}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xl font-bold text-gray-900 dark:text-white"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateName(f)
                          if (e.key === 'Escape') setEditingSlug(null)
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateName(f)}
                          disabled={savingEdit}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingSlug(null)}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400">
                          {f.name}
                        </h2>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            setEditingSlug(f.slug)
                            setEditName(f.name)
                          }}
                          className="text-gray-400 hover:text-blue-500 opacity-0 group-hover/card:opacity-100 transition-opacity"
                        >
                          ✏️
                        </button>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300">Variant: {f.variant || 'TCG'}</p>
                    </>
                  )}
                </div>
              </Link>

              <div className="absolute top-3 right-3 flex gap-2">
                {!editingSlug && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      setActionError(null)
                      if (!confirm(`Delete format "${f.name}"? This cannot be undone.`)) return
                      try {
                        await axios.delete(`/api/formats/${f.slug}`)
                        setFormats((s) => s.filter((x) => x.slug !== f.slug))
                      } catch (err: any) {
                        setActionError(err?.response?.data?.error || 'Failed to delete format')
                      }
                    }}
                    className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 opacity-0 group-hover/card:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {formats.length === 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 opacity-60 bg-white dark:bg-gray-800">
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">No formats</h2>
              <p className="text-gray-600 dark:text-gray-300">Create a new format to get started.</p>
            </div>
          )}
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCreateOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Format</h3>
            <div className="mt-4">
              <label className="block text-sm text-gray-700 dark:text-gray-300">Name</label>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm text-gray-700 dark:text-gray-300">Variant</label>
              <select
                value={createVariant}
                onChange={(e) => setCreateVariant(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="TCG">TCG</option>
                <option value="RUSH">RUSH</option>
              </select>
            </div>

            {createError && <div className="mt-3 text-sm text-red-600">{createError}</div>}

            <div className="mt-6 flex justify-end gap-3">
              <button className="px-3 py-2 rounded border" onClick={() => setIsCreateOpen(false)}>Cancel</button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={async () => {
                  setCreateError(null)
                  if (!createName || createName.trim().length === 0) { setCreateError('Please enter a name'); return }
                  setCreating(true)
                  try {
                    const res = await axios.post('/api/formats', { name: createName.trim(), variant: createVariant })
                    const data = res.data
                    // navigate to the new format edit page
                    router.push(`/admin/formats/${data.slug}`)
                  } catch (err: any) {
                    setCreateError(err?.response?.data?.error || 'Failed to create format')
                  } finally { setCreating(false) }
                }}
                disabled={creating}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {actionError && <div className="max-w-4xl mx-auto mt-4 text-sm text-red-600">{actionError}</div>}
    </>
  );
}

// formats are fetched in a useEffect inside the component
