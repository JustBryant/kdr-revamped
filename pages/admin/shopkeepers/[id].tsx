import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import CompactDialoguePanel from '../../../components/CompactDialoguePanel'

interface VoiceLine { id: string; text: string; audioUrl?: string }
interface Shopkeeper { id: string; name: string; description?: string; image?: string; voiceLines?: VoiceLine[] }

export default function ShopkeeperEditor() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const [shop, setShop] = useState<Shopkeeper | null>(null)
  const [edit, setEdit] = useState<Shopkeeper | null>(null)
  const [newVoice, setNewVoice] = useState('')
  const [activeTab, setActiveTab] = useState<'details'|'voicelines'|'preview'|'dialogues'>('details')
  const [githubImages, setGithubImages] = useState<Array<{name:string, download_url:string}>>([])
  const [imagesModalOpen, setImagesModalOpen] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [dialogues, setDialogues] = useState<Array<{id:string, type:string, text:string}>>([])
  const [newDialogText, setNewDialogText] = useState('')
  const [newDialogType, setNewDialogType] = useState<'GREETING'|'RETURNING'|'SKILL_OFFER'|'TRAINING'|'TREASURES'|'LOOT_OFFER'|'LOOT_PURCHASE'|'STATS'>('GREETING')
  const [activeSection, setActiveSection] = useState<'name'|'image'|'greeting'|'returning'|'skillOffer'|'training'|'treasures'|'lootOffer'|'lootPurchase'|'selling'|'tipping'|'stats'|null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [dialogueEditorOpen, setDialogueEditorOpen] = useState(false)
  const [dialogueEditorType, setDialogueEditorType] = useState<string | null>(null)
  const [dialogueEditorNewText, setDialogueEditorNewText] = useState('')
  const [editingDialogueId, setEditingDialogueId] = useState<string | null>(null)
  const [editingDialogueText, setEditingDialogueText] = useState('')

  useEffect(() => { if (id) fetchShop() }, [id])

  const fetchShop = async () => {
    const res = await fetch(`/api/admin/shopkeepers/${id}`, { credentials: 'same-origin' })
    if (!res.ok) return alert('Failed to load')
    const data = await res.json()
    setShop(data)
    setEdit(data)
    // fetch dialogues
    try {
      const dres = await fetch(`/api/admin/shopkeepers/${id}/dialogues`, { credentials: 'same-origin' })
      if (dres.ok) {
        const d = await dres.json()
        setDialogues(d)
      }
    } catch (e) { console.error('Failed to load dialogues', e) }
  }

  const handleOpen = (section: NonNullable<typeof activeSection>) => {
    // If the section maps to dialogue types, open the compact dialogue panel instead
    const sectionToDialogueType: Record<string,string> = {
      greeting: 'GREETING',
      returning: 'RETURNING',
      skillOffer: 'SKILL_OFFER',
      training: 'TRAINING',
      treasures: 'TREASURES',
      stats: 'STATS',
      selling: 'SELLING',
      tipping: 'TIPPING',
      lootOffer: 'LOOT_OFFER',
      lootPurchase: 'LOOT_PURCHASE',
    }
    const mapped = sectionToDialogueType[section as string]
    // Special-case the image section to open the github image picker
    if (section === 'image') {
      // fetchGithubImages will open the images modal and populate images
      try { fetchGithubImages() } catch (e) { console.error('Failed to open image picker', e); setImagesModalOpen(true) }
      return
    }
    if (mapped) {
      // open compact dialogue editor for this type
      setDialogueEditorType(mapped)
      setDialogueEditorNewText('')
      setEditingDialogueId(null)
      setEditingDialogueText('')
      setDialogueEditorOpen(true)
      return
    }

    setEditingValue((edit as any)?.[section] ?? '')
    setActiveSection(section)
  }

  const handleSaveSection = () => {
    if (!edit || !activeSection) return
    // @ts-ignore
    setEdit({ ...edit, [activeSection]: editingValue })
    setActiveSection(null)
  }

  const save = async () => {
    if (!edit) return
    const res = await fetch(`/api/admin/shopkeepers/${edit.id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: edit.name, description: edit.description, image: edit.image }) })
    if (!res.ok) return alert('Save failed')
    const data = await res.json()
    setShop(data); setEdit(data); alert('Saved')
  }

  const fetchGithubImages = async () => {
    setImagesLoading(true)
    setImagesModalOpen(true)
    try {
      const res = await fetch('https://api.github.com/repos/JustBryant/card-images/contents/shopkeepers')
      if (!res.ok) throw new Error('Failed to fetch from GitHub')
      const data = await res.json()
      const files = (Array.isArray(data) ? data : []).filter((f: any) => f.type === 'file' && !!f.download_url)
      setGithubImages(files.map((f: any) => ({ name: f.name, download_url: f.download_url })))
    } catch (err) {
      console.error('Failed to load github images', err)
      alert('Failed to load images from GitHub')
      setGithubImages([])
    } finally {
      setImagesLoading(false)
    }
  }

  const addVoice = async () => {
    if (!shop || !newVoice) return
    const res = await fetch(`/api/admin/shopkeepers/${shop.id}/voicelines`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: newVoice }) })
    if (!res.ok) return alert('Failed')
    setNewVoice('')
    fetchShop()
  }

  const addDialogue = async () => {
    if (!shop || !newDialogText) return
    const res = await fetch(`/api/admin/shopkeepers/${shop.id}/dialogues`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: newDialogType, text: newDialogText }) })
    if (!res.ok) return alert('Failed')
    setNewDialogText('')
    // refresh
    fetchShop()
  }

  const openDialogueEditor = (type: string) => {
    setDialogueEditorType(type)
    setDialogueEditorNewText('')
    setEditingDialogueId(null)
    setEditingDialogueText('')
    setDialogueEditorOpen(true)
  }

  const closeDialogueEditor = () => {
    setDialogueEditorOpen(false)
    setDialogueEditorType(null)
  }

  const addDialogueForType = async (text?: string) => {
    const payloadText = text ?? dialogueEditorNewText
    if (!shop || !dialogueEditorType || !payloadText) return
    const res = await fetch(`/api/admin/shopkeepers/${shop.id}/dialogues`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: dialogueEditorType, text: payloadText }) })
    if (!res.ok) return alert('Failed to add')
    setDialogueEditorNewText('')
    await fetchShop()
  }

  const updateDialogue = async (id: string, text: string) => {
    if (!shop) return
    const res = await fetch(`/api/admin/shopkeepers/${shop.id}/dialogues`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dialogueId: id, text }) })
    if (!res.ok) return alert('Failed to update')
    setEditingDialogueId(null)
    setEditingDialogueText('')
    fetchShop()
  }

  const deleteDialogue = async (dialogueId: string) => {
    if (!shop) return
    const res = await fetch(`/api/admin/shopkeepers/${shop.id}/dialogues`, { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dialogueId }) })
    if (!res.ok) return alert('Failed')
    fetchShop()
  }

  

  const deleteVoice = async (voiceId: string) => {
    if (!shop) return
    const res = await fetch(`/api/admin/shopkeepers/${shop.id}/voicelines`, { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voiceLineId: voiceId }) })
    if (!res.ok) return alert('Failed')
    fetchShop()
  }

  const deleteShop = async () => {
    if (!shop) return
    if (!confirm('Delete shopkeeper and all voice lines?')) return
    const res = await fetch(`/api/admin/shopkeepers/${shop.id}`, { method: 'DELETE', credentials: 'same-origin' })
    if (!res.ok) return alert('Failed')
    router.push('/admin/shopkeepers')
  }

  if (!id) return <div className="p-6">Missing id</div>

  return (
    <div className="container mx-auto p-6 text-white">
      <Head><title>Shopkeeper Editor</title></Head>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{shop?.name || 'Shopkeeper'}</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/admin/shopkeepers')} className="px-3 py-1 bg-slate-700 text-white border border-white/10 rounded">Back</button>
          <button onClick={deleteShop} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
        </div>
      </div>

      <div className="mb-4 border border-white/10 rounded-lg p-4">
        <div className="flex gap-4 border-b pb-2 mb-4">
          <button className={`px-3 py-1 ${activeTab==='details'?'border-b-2 border-blue-600':''}`} onClick={()=>setActiveTab('details')}>Details</button>
          <button className={`px-3 py-1 ${activeTab==='voicelines'?'border-b-2 border-blue-600':''}`} onClick={()=>setActiveTab('voicelines')}>Voice Lines</button>
          <button className={`px-3 py-1 ${activeTab==='preview'?'border-b-2 border-blue-600':''}`} onClick={()=>setActiveTab('preview')}>Preview</button>
          <button className={`px-3 py-1 ${activeTab==='details'?'':'hidden'}`} onClick={()=>{}}> </button>
        </div>

        {activeTab === 'details' && edit && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent" onClick={()=>handleOpen('image')}>
              <div className="flex items-center gap-4">
                <div className="w-24 h-28 bg-green-900/10 rounded overflow-hidden border border-white/10 flex items-center justify-center">
                  {edit.image ? <img src={edit.image} alt="shop" className="object-contain w-full h-full" /> : <div className="text-sm text-green-400">No image</div>}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-green-400 uppercase">Image</h3>
                  <div className="text-sm text-gray-300">Click to choose or clear</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-white/20 hover:shadow-sm bg-transparent flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-blue-400 uppercase">Name</h3>
                <input value={(edit && edit.name) || ''} onChange={e=>setEdit(edit?{...edit, name: e.target.value}:edit)} className="text-lg font-bold mt-1 bg-transparent border-b border-white/10 p-1" />
              </div>
            </div>

            <div onClick={()=>handleOpen('greeting')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-amber-400">{dialogues.filter(d=>d.type==='GREETING').length}</div>
                  <div className="text-xs font-semibold text-amber-500 uppercase">Greeting</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('skillOffer')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-400">{dialogues.filter(d=>d.type==='SKILL_OFFER').length}</div>
                  <div className="text-xs font-semibold text-purple-500 uppercase">Skill Offer</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('training')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-teal-300">{dialogues.filter(d=>d.type==='TRAINING').length}</div>
                  <div className="text-xs font-semibold text-teal-400 uppercase">Training</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('returning')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-yellow-300">{dialogues.filter(d=>d.type==='RETURNING').length}</div>
                  <div className="text-xs font-semibold text-yellow-400 uppercase">Returning</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('stats')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-cyan-300">{dialogues.filter(d=>d.type==='STATS').length}</div>
                  <div className="text-xs font-semibold text-cyan-400 uppercase">Stats</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('treasures')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-amber-400">{dialogues.filter(d=>d.type==='TREASURES').length}</div>
                  <div className="text-xs font-semibold text-amber-500 uppercase">Treasures</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('lootOffer')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-rose-400">{dialogues.filter(d=>d.type==='LOOT_OFFER').length}</div>
                  <div className="text-xs font-semibold text-rose-500 uppercase">Loot Offer</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('selling')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-indigo-400">{dialogues.filter(d=>d.type==='SELLING').length}</div>
                  <div className="text-xs font-semibold text-indigo-400 uppercase">Selling</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('lootPurchase')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-300">{dialogues.filter(d=>d.type==='LOOT_PURCHASE').length}</div>
                  <div className="text-xs font-semibold text-slate-400 uppercase">Loot Purchase</div>
                </div>
              </div>
            </div>

            <div onClick={()=>handleOpen('tipping')} className="p-3 rounded-lg border border-white/20 hover:shadow-sm cursor-pointer bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{dialogues.filter(d=>d.type==='TIPPING').length}</div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase">Tipping</div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
              <button onClick={fetchShop} className="px-4 py-2 bg-slate-700 text-white border border-white/10 rounded">Reset</button>
            </div>
          </div>
        )}

        {imagesModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-auto p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">Choose Shopkeeper Image</h3>
                <button onClick={() => setImagesModalOpen(false)} className="px-2 py-1 bg-slate-700 text-white border border-white/10 rounded">Close</button>
              </div>
              {imagesLoading ? (
                <div className="text-gray-500">Loading images...</div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  <button onClick={() => { setEdit(edit ? {...edit, image: undefined} : edit); setImagesModalOpen(false) }} className="p-2 border rounded text-sm">No image</button>
                  {githubImages.map(img => (
                    <div key={img.name} className="p-1 border rounded cursor-pointer hover:shadow" onClick={() => { setEdit(edit ? {...edit, image: img.download_url} : edit); setImagesModalOpen(false) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.download_url} alt={img.name} className="w-28 h-20 object-contain" />
                      <div className="text-xs mt-1 truncate">{img.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'voicelines' && shop && (
          <div>
            <div className="flex gap-2 mt-2">
              <input value={newVoice} onChange={e=>setNewVoice(e.target.value)} placeholder="New voice text" className="flex-1 border p-2" />
              <button onClick={addVoice} className="px-3 py-1 bg-green-600 text-white rounded">Add</button>
            </div>
            <ul className="mt-3 space-y-2">
              {shop.voiceLines?.map(v => (
                <li key={v.id} className="p-2 border rounded flex justify-between items-center">
                  <div>{v.text}</div>
                  <div className="flex gap-2">
                    {v.audioUrl && <a href={v.audioUrl} target="_blank" rel="noreferrer" className="text-blue-600">Play</a>}
                    <button onClick={()=>deleteVoice(v.id)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'dialogues' && shop && (
          <div>
            <h3 className="font-semibold mb-2">Dialogues</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['GREETING','RETURNING','SKILL_OFFER','TRAINING','STATS','TREASURES','LOOT_OFFER','LOOT_PURCHASE','SELLING','TIPPING'].map((t:any) => (
                <div key={t} className="p-3 border rounded bg-white dark:bg-gray-800 flex flex-col justify-between">
                  <div>
                    <div className="font-semibold mb-2">{t.replace('_',' ')}</div>
                    <div className="text-sm text-gray-600">{dialogues.filter(d=>d.type===t).length} lines</div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => openDialogueEditor(t)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Edit</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <select value={newDialogType} onChange={e=>setNewDialogType(e.target.value as any)} className="border p-2">
                <option value="GREETING">GREETING</option>
                <option value="SKILL_OFFER">SKILL_OFFER</option>
                <option value="TRAINING">TRAINING</option>
                <option value="STATS">STATS</option>
                <option value="RETURNING">RETURNING</option>
                <option value="TREASURES">TREASURES</option>
                <option value="LOOT_OFFER">LOOT_OFFER</option>
                <option value="LOOT_PURCHASE">LOOT_PURCHASE</option>
                <option value="SELLING">SELLING</option>
                <option value="TIPPING">TIPPING</option>
              </select>
              <input value={newDialogText} onChange={e=>setNewDialogText(e.target.value)} placeholder="New dialogue line" className="flex-1 border p-2" />
              <button onClick={addDialogue} className="px-3 py-1 bg-green-600 text-white rounded">Add</button>
            </div>
          </div>
        )}

        {activeTab === 'preview' && shop && (
          <div className="p-4 border rounded bg-white dark:bg-gray-800">
            <h3 className="text-lg font-bold">{shop.name}</h3>
            <p className="text-sm text-gray-600">{shop.description}</p>
            {shop.image && <img src={shop.image} alt="shop" className="mt-4 max-h-40 object-contain" />}
          </div>
        )}

        {activeSection && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Edit {activeSection}</h3>
                <button onClick={() => setActiveSection(null)} className="px-2 py-1 bg-slate-700 text-white border border-white/10 rounded">Close</button>
              </div>
              <div>
                <textarea value={editingValue} onChange={e=>setEditingValue(e.target.value)} rows={8} className="w-full border p-3" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setActiveSection(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={handleSaveSection} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
              </div>
            </div>
          </div>
        )}
        <CompactDialoguePanel
          open={dialogueEditorOpen}
          type={dialogueEditorType || ''}
          dialogues={dialogues.filter(d => d.type === (dialogueEditorType || ''))}
          onClose={closeDialogueEditor}
          onAdd={async (text) => await addDialogueForType(text)}
          onUpdate={async (id, text) => await updateDialogue(id, text)}
          onDelete={async (id) => await deleteDialogue(id)}
        />
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
