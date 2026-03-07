import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import { RichTextRenderer } from '../../components/RichText'

type Section = {
  title: string
  items: string[]
}

export default function AdminPatchNotes() {
  const { data: session } = useSession()
  const [notes, setNotes] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [version, setVersion] = useState('')
  const [title, setTitle] = useState('')
  const [sections, setSections] = useState<Section[]>([{ title: '', items: [''] }])
  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/patch-notes')
      .then(res => res.json())
      .then(data => {
        setNotes(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  const handleAddSection = () => {
    setSections([...sections, { title: '', items: [''] }])
  }

  const handleAddItem = (sectionIndex: number) => {
    const newSections = [...sections]
    newSections[sectionIndex].items.push('')
    setSections(newSections)
  }

  const handleSectionTitleChange = (sectionIndex: number, value: string) => {
    const newSections = [...sections]
    newSections[sectionIndex].title = value
    setSections(newSections)
  }

  const handleItemChange = (sectionIndex: number, itemIndex: number, value: string) => {
    const newSections = [...sections]
    newSections[sectionIndex].items[itemIndex] = value
    setSections(newSections)
  }

  const insertTag = (sectionIndex: number, itemIndex: number, tag: string) => {
    const newSections = [...sections];
    const currentText = newSections[sectionIndex].items[itemIndex];
    
    // Add space if starting a new tag and not at beginning
    const prefix = currentText && !currentText.endsWith(' ') ? ' ' : '';
    newSections[sectionIndex].items[itemIndex] = currentText + prefix + tag;
    setSections(newSections);
  }

  const handleSave = async () => {
    const method = currentId ? 'PUT' : 'POST'
    const body: any = {
      version,
      title,
      content: JSON.stringify({ sections }),
      isPublished
    }
    if (currentId) body.id = currentId

    const res = await fetch('/api/admin/patch-notes', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (res.ok) {
      setIsEditing(false)
      setVersion('')
      setTitle('')
      setSections([{ title: '', items: [''] }])
      setCurrentId(null)
      // Refresh list
      const updatedList = await fetch('/api/admin/patch-notes').then(r => r.json())
      setNotes(updatedList)
    }
  }

  const handleEdit = (note: any) => {
    setCurrentId(note.id)
    setVersion(note.version)
    setTitle(note.title)
    try {
      const content = JSON.parse(note.content)
      setSections(content.sections || [{ title: '', items: [''] }])
    } catch {
      setSections([{ title: 'Content', items: [note.content] }])
    }
    setIsPublished(note.isPublished)
    setIsEditing(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return
    await fetch(`/api/admin/patch-notes?id=${id}`, { method: 'DELETE' })
    setNotes(notes.filter(n => n.id !== id))
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="p-20 text-center">Access Denied</div>
    )
  }

  return (
    <>
      <Head>
        <title>Admin - Patch Notes | KDR Revamped</title>
      </Head>
      <div className="max-w-6xl mx-auto py-12 px-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Manage Patch Notes</h1>
          <button 
            onClick={() => {
              setIsEditing(true)
              setCurrentId(null)
              setVersion('')
              setTitle('')
              setSections([{ title: '', items: [''] }])
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/20"
          >
            Create New Patch
          </button>
        </div>

        {isEditing ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Version (e.g. 1.0.2)</label>
                <input 
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold"
                  placeholder="2.1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Release Title</label>
                <input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold"
                  placeholder="The Awakening Update"
                />
              </div>
            </div>

            <div className="space-y-6 text-white text-xs">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Update Sections</label>
                <div className="flex bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-400 max-w-md">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                   <p className="text-[10px] font-bold leading-relaxed">
                     <span className="text-white">PRO TIP:</span> The <span className="text-white">{"{class:Name}"}</span> tag automatically pulls the class image from your database. Make sure the name matches the class name exactly (e.g. Fire, Dragon, Spellcaster).
                   </p>
                </div>
              </div>
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="bg-gray-50 dark:bg-gray-900/30 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center mb-4">
                    <input 
                      value={section.title}
                      onChange={(e) => handleSectionTitleChange(sIdx, e.target.value)}
                      className="w-full bg-transparent text-xl font-black border-b-2 border-dashed border-gray-200 dark:border-gray-700 focus:border-blue-500 outline-none"
                      placeholder="Section Name (e.g. Card Changes)"
                    />
                    <button onClick={() => {
                      const newSections = [...sections];
                      newSections.splice(sIdx, 1);
                      setSections(newSections);
                    }} className="text-red-500 hover:text-red-600 ml-4 font-bold text-xs uppercase transition-colors">REMOVE SECTION</button>
                  </div>
                  <div className="space-y-4">
                    {section.items.map((item, iIdx) => (
                      <div key={iIdx} className="space-y-2">
                        {/* TOOLBAR */}
                        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-gray-200 dark:bg-gray-800 rounded-t-lg border-x border-t border-gray-300 dark:border-gray-700">
                          <button onClick={() => insertTag(sIdx, iIdx, "**BOLD**")} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded font-black">B</button>
                          <button onClick={() => insertTag(sIdx, iIdx, "*italic*")} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded italic">I</button>
                          <div className="w-px h-4 bg-white/10"></div>
                          <button onClick={() => insertTag(sIdx, iIdx, "[red]RED[/red]")} className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded">Red</button>
                          <button onClick={() => insertTag(sIdx, iIdx, "[blue]BLUE[/blue]")} className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded">Blue</button>
                          <button onClick={() => insertTag(sIdx, iIdx, "[green]GREEN[/green]")} className="px-2 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded">Green</button>
                          <button onClick={() => insertTag(sIdx, iIdx, "[yellow]YELLOW[/yellow]")} className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 rounded">Yellow</button>
                          <div className="w-px h-4 bg-white/10"></div>
                          <button onClick={() => insertTag(sIdx, iIdx, "[size=xl]LARGE[/size]")} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded">Size+</button>
                          <button onClick={() => insertTag(sIdx, iIdx, "[img]IMAGE_URL[/img]")} className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Image
                          </button>
                          <button onClick={() => insertTag(sIdx, iIdx, "{class:FIRE}")} className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 rounded">Class</button>
                        </div>
                        <div className="flex gap-2">
                          <textarea 
                            value={item}
                            onChange={(e) => handleItemChange(sIdx, iIdx, e.target.value)}
                            className="w-full bg-white dark:bg-gray-900 border border-t-0 border-gray-300 dark:border-gray-700 rounded-b-lg p-3 text-sm focus:ring-0 outline-none transition-all"
                            rows={3}
                            placeholder="Use the toolbar or type manually..."
                          />
                          <button onClick={() => {
                            const newSections = [...sections];
                            newSections[sIdx].items.splice(iIdx, 1);
                            setSections(newSections);
                          }} className="text-gray-400 hover:text-red-500 p-2 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {item && (
                          <div className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-1 pl-1">PREVIEW:</div>
                        )}
                        {item && (
                          <div className="bg-white/5 dark:bg-white/5 p-3 rounded-lg border border-white/5 text-sm">
                            <RichTextRenderer content={item} />
                          </div>
                        )}
                      </div>
                    ))}
                    <button 
                      onClick={() => handleAddItem(sIdx)}
                      className="text-sm font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 group"
                    >
                      <span className="group-hover:translate-x-1 transition-transform">+ ADD ITEM</span>
                    </button>
                  </div>
                </div>
              ))}
              <button 
                onClick={handleAddSection}
                className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-blue-500 hover:border-blue-500 transition-all font-black flex items-center justify-center gap-2 group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-125 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
                ADD NEW SECTION
              </button>
            </div>

            <div className="flex items-center gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-bold text-gray-700 dark:text-gray-300">PUBLISH LIVE</span>
              </label>
              <div className="flex-grow"></div>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 text-gray-500 font-bold hover:text-gray-700 transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={handleSave}
                className="bg-blue-600 text-white px-8 py-2 rounded-lg font-black hover:bg-blue-700 transition-all"
              >
                {currentId ? 'UPDATE PATCH' : 'CREATE PATCH'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {notes.map((note) => (
              <div key={note.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${note.isPublished ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-400'}`}></div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter text-xl">
                      v{note.version}: {note.title}
                    </h3>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">
                      {new Date(note.date).toLocaleDateString()} • {note.isPublished ? 'PUBLISHED' : 'DRAFT'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEdit(note)}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleDelete(note.id)}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
