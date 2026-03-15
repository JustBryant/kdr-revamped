import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import StartingCardsEditor, { StartingSkill } from '../../../../../components/class-editor/StartingCardsEditor'
import LootPoolEditor from '../../../../../components/class-editor/LootPoolEditor'
import { DeckCard, LootPool } from '../../../../../types/class-editor'
import LegendaryMonsterPicker from '../../../../../components/class-editor/LegendaryMonsterPicker'
import ClassDetailsEditor, { ClassDetails } from '../../../../../components/class-editor/ClassDetailsEditor'
import CollaborativeClassDetails from '../../../../../components/class-editor/CollaborativeClassDetails'
import TipSkillsEditor from '../../../../../components/class-editor/TipSkillsEditor'
import { Skill } from '../../../../../types/class-editor'
import SkillForm from '../../../../../components/class-editor/shared/SkillForm'
import useCollaborative from '../../../../../components/collab/useCollaborative'

// Define Card interface here or import it if available globally
interface Card {
  id: string
  konamiId: number
  name: string
  type: string
  desc: string
  atk?: number
  def?: number
  level?: number
  race?: string
  attribute?: string
}

export default function ClassEditor() {
  const router = useRouter()
  const { id, slug } = router.query
  const isNew = !id

  const [classDetails, setClassDetails] = useState<ClassDetails>({
    name: isNew ? 'New Class' : 'Existing Class',
    isPublic: true,
    image: '',
    skillName: '',
    skillDescription: '',
    questDescription: '',
    relicDescription: ''
  })

  // Tracker for parent class (null means main class)
  const [parentClassId, setParentClassId] = useState<string | null>(null)

  const [deck, setDeck] = useState<DeckCard[]>([])
  const [startingSkills, setStartingSkills] = useState<StartingSkill[]>([])
  const [lootPools, setLootPools] = useState<LootPool[]>([])
  const [tipSkills, setTipSkills] = useState<Skill[]>([])
  const [legendaryMonster, setLegendaryMonster] = useState<Card | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formatVariant, setFormatVariant] = useState<string | null>(null)
  const [mainSkillData, setMainSkillData] = useState<Skill | null>(null)
  const [relicSkillData, setRelicSkillData] = useState<Skill | null>(null)
  const [isMainSkillFormOpen, setIsMainSkillFormOpen] = useState(false)
  const [isRelicSkillFormOpen, setIsRelicSkillFormOpen] = useState(false)
  const [peers, setPeers] = useState<Record<string, any>>({})
  const { data: session } = useSession()
  const me = session?.user || { name: 'You', email: '' }

  const collabRoom = useMemo(() => {
    if (id && typeof id === 'string') return `class:${id}`
    if (slug && typeof slug === 'string') return `class:new:${slug}`
    return null
  }, [id, slug])

  const { send, clients, connected, url, lastPayload } = useCollaborative(collabRoom, (msg: any) => {
    if (!msg || !msg.payload) return
    const p = msg.payload
    // presence messages
    if (p.section === 'presence') {
      const sender = msg.sender || 'anon'
      // compute a stable color for the user based on email or name
      const u = p.data?.user || {}
      const idStr = (u.email || u.name || sender || '')
      let h = 0
      for (let i = 0; i < idStr.length; i++) h = (h * 31 + idStr.charCodeAt(i)) % 360
      const color = `hsl(${h} 70% 45%)`
      setPeers(prev => ({ ...prev, [sender]: { ...p.data, ts: msg.ts || p.ts || Date.now(), user: p.data?.user, color } }))
      return
    }

    // section updates: apply when different
    try {
      if (p.section === 'classDetails') {
        const same = JSON.stringify(p.data) === JSON.stringify(classDetails)
        if (!same) setClassDetails(p.data || classDetails)
      }
      if (p.section === 'deck') {
        const same = JSON.stringify(p.data) === JSON.stringify(deck)
        if (!same) setDeck(p.data || [])
      }
      if (p.section === 'startingSkills') {
        try {
          const incoming = Array.isArray(p.data) ? p.data : []
          // Guard: do not let an empty incoming list wipe out a non-empty local list.
          if (incoming.length === 0 && startingSkills && startingSkills.length > 0) {
            // Skip applying an empty update coming from a peer — it may be stale.
            return
          }
          const same = JSON.stringify(incoming) === JSON.stringify(startingSkills)
          if (!same) setStartingSkills(incoming || [])
        } catch (e) {
          // fallback to original behavior on error
          const same = JSON.stringify(p.data) === JSON.stringify(startingSkills)
          if (!same) setStartingSkills(p.data || [])
        }
      }
      if (p.section === 'lootPools') {
        const same = JSON.stringify(p.data) === JSON.stringify(lootPools)
        if (!same) setLootPools(p.data || [])
      }
      if (p.section === 'tipSkills') {
        const same = JSON.stringify(p.data) === JSON.stringify(tipSkills)
        if (!same) setTipSkills(p.data || [])
      }
    } catch (e) {
      // ignore
    }
  })

  // cleanup stale peers periodically (also trim when client count drops)
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now()
      setPeers(prev => {
        let next: Record<string, any> = { ...prev }
        let changed = false
        // remove peers with stale ts
        for (const k of Object.keys(next)) {
          if (!next[k].ts || (now - next[k].ts) > 8000) {
            delete next[k]
            changed = true
          }
        }
        // if the server-reported client count is less than our stored peers, trim oldest
        try {
          const peerKeys = Object.keys(next)
          if (typeof clients === 'number' && peerKeys.length > clients) {
            // sort keys by ts ascending
            const sorted = peerKeys.sort((a,b)=> (next[a].ts||0) - (next[b].ts||0))
            const toRemove = sorted.slice(0, peerKeys.length - Math.max(clients, 0))
            for (const k of toRemove) { delete next[k]; changed = true }
          }
        } catch (e) {
          // ignore
        }
        return changed ? next : prev
      })
    }, 2000)
    return () => clearInterval(iv)
  }, [clients])

  // debounce broadcasters
  useEffect(() => {
    if (!collabRoom || !send) return
    const t = setTimeout(() => {
      send({ section: 'deck', data: deck, ts: Date.now(), user: me })
    }, 250)
    return () => clearTimeout(t)
  }, [deck, send, collabRoom])

  useEffect(() => {
    if (!collabRoom || !send) return
    const t = setTimeout(() => {
      send({ section: 'startingSkills', data: startingSkills, ts: Date.now(), user: me })
    }, 250)
    return () => clearTimeout(t)
  }, [startingSkills, send, collabRoom])

  useEffect(() => {
    if (!collabRoom || !send) return
    const t = setTimeout(() => {
      send({ section: 'lootPools', data: lootPools, ts: Date.now(), user: me })
    }, 250)
    return () => clearTimeout(t)
  }, [lootPools, send, collabRoom])

  useEffect(() => {
    if (!collabRoom || !send) return
    const t = setTimeout(() => {
      send({ section: 'tipSkills', data: tipSkills, ts: Date.now(), user: me })
    }, 250)
    return () => clearTimeout(t)
  }, [tipSkills, send, collabRoom])

  // Fetch class data if editing
  useEffect(() => {
    if (!id) return

    const fetchClass = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/classes/${id}`)
        if (!res.ok) throw new Error('Failed to fetch class')
        
        const data = await res.json()
        
        // 1. Class Details
        const mainSkill = data.skills.find((s: any) => s.type === 'MAIN')
        setClassDetails({
          name: data.name,
          isPublic: data.isPublic ?? true,
          image: data.image || '',
          skillName: mainSkill?.name || '',
          skillDescription: mainSkill?.description || '',
          questDescription: data.legendaryQuest || '',
          relicDescription: data.legendaryRelic || ''
        })

        setParentClassId(data.parentClassId || null)

        // 2. Deck
        setDeck(data.startingCards.map((sc: any) => ({
          ...sc.card,
          quantity: sc.quantity,
          category: sc.category
        })))

        // 3. Starting Skills
        setStartingSkills(data.skills.filter((s: any) => s.type === 'STARTING').map((s: any) => ({
          ...s,
          modifications: s.modifications.map((m: any) => ({
            ...m,
            card: m.card
          }))
        })))

        // 4. Unique Skills (formerly Tip)
        setTipSkills(data.skills.filter((s: any) => s.type === 'UNIQUE'))

        // 4b. Main skill data (include modifications/provides)
        setMainSkillData(mainSkill || null)

        // 5. Loot Pools
        setLootPools(data.lootPools.map((pool: any) => ({
          id: pool.id,
          name: pool.name,
          tier: pool.tier,
          tax: pool.tax,
          items: pool.items.map((item: any) => ({
            id: item.id,
            type: item.type,
            card: item.card,
            skill: item.type === 'Skill' ? (item.skill || {
              name: item.skillName,
              description: item.skillDescription
            }) : undefined
          }))
        })))

        // 6. Legendary Monster
        setLegendaryMonster(data.legendaryMonsterCard)

        // 7. Relic skill (if any skill exists that references relic by type GENERIC and name includes 'Relic' or similar)
        const relicSkill = data.skills.find((s: any) => s.type === 'GENERIC' && (s.name || '').toLowerCase().includes('relic'))
        setRelicSkillData(relicSkill || null)

      } catch (error) {
        console.error('Error loading class:', error)
        alert('Failed to load class data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchClass()
  }, [id])

  // fetch format details (to know variant e.g., TCG vs RUSH)
  useEffect(() => {
    const raw = slug
    const slugStr = Array.isArray(raw) ? raw[0] : raw
    if (!slugStr || typeof slugStr !== 'string') return
    let mounted = true
    fetch(`/api/formats/${encodeURIComponent(slugStr)}`).then(r => r.json()).then((data) => {
      if (!mounted) return
      if (data && data.format && data.format.variant) setFormatVariant(String(data.format.variant))
    }).catch(() => {}).finally(()=>{})
    return () => { mounted = false }
  }, [slug])

  const handleSave = async (shouldRedirect = true) => {
    setIsSaving(true)
    try {
      const payload: any = {
        id: isNew ? undefined : id,
        ...classDetails,
        deck,
        startingSkills,
        lootPools,
        tipSkills,
        legendaryMonsterId: legendaryMonster?.id,
        mainSkill: mainSkillData,
        relicSkill: relicSkillData
      }

      // If we're in a per-format editor, send formatSlug so class is linked to the format
      if (slug && (!Array.isArray(slug))) {
        payload.formatSlug = String(slug)
      }

      const res = await fetch('/api/classes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || errorData.error || 'Failed to save class')
      }
      
      if (shouldRedirect) {
        // Redirect back to per-format classes listing when present
        if (slug && !Array.isArray(slug)) {
          router.push(`/admin/formats/${encodeURIComponent(String(slug))}/classes`)
        } else {
          router.push('/admin/classes')
        }
      }
      return true
    } catch (error: any) {
      console.error('Error saving class:', error)
      alert(`Failed to save class: ${error.message}`)
      return false
    } finally {
      if (shouldRedirect) {
        setIsSaving(false)
      }
    }
  }

  const handleCreateSubclass = async () => {
    if (isNew || !id) return
    
    if (!confirm('Create a subclass? This will save the current changes first.')) {
      return
    }

    // Save first, but don't redirect
    const saved = await handleSave(false)
    if (!saved) {
      setIsSaving(false)
      return
    }

    try {
      const res = await fetch('/api/classes/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: id })
      })

      if (!res.ok) throw new Error('Failed to duplicate class')
      
      const newClass = await res.json()
      
      // Redirect to the new class editor
      // We use window.location.href to force a full reload or ensure the router picks up the new ID cleanly
      // but router.push should be fine.
      router.push(`/admin/formats/${slug}/classes/editor?id=${newClass.id}`)
    } catch (error) {
      console.error('Error creating subclass:', error)
      alert('Failed to create subclass')
      setIsSaving(false)
    }
  }

  const handleDeleteClass = async () => {
    if (isNew || !id) return

    const confirmMsg = parentClassId 
      ? `Are you sure you want to delete this subclass?` 
      : `Are you sure you want to delete this class? This will also delete ALL its subclasses.`
    
    if (!confirm(confirmMsg)) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to delete class')
      }

      router.push(`/admin/formats/${slug}/classes`)
    } catch (error: any) {
      console.error('Error deleting class:', error)
      alert(error.message || 'Failed to delete class')
      setIsSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>{isNew ? 'Create Class' : 'Edit Class'} | KDR Revamped</title>
      </Head>

      <div className="w-full px-6 py-8">
        {isLoading && (
          <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 z-50 flex items-center justify-center">
            <div className="text-xl font-bold text-gray-600 dark:text-gray-300">Loading Class Data...</div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center">
            <button 
              onClick={() => router.back()}
              className="mr-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isNew ? 'Create Class' : 'Edit Class'}
            </h1>
          </div>
          <div className="flex space-x-3">
            {!isNew && !parentClassId && (
              <button
                onClick={handleCreateSubclass}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium disabled:opacity-50"
              >
                Create Subclass
              </button>
            )}
            {!isNew && (
              <button
                onClick={handleDeleteClass}
                disabled={isSaving}
                className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 font-medium disabled:opacity-50"
              >
                Delete {parentClassId ? 'Subclass' : 'Class'}
              </button>
            )}
            {!isNew && (
              <button
                onClick={async () => {
                  if (!id || typeof id !== 'string') {
                    alert('Missing class id; please refresh and try again')
                    return
                  }
                  const target = window.prompt('Enter a KDR id to push to (or leave blank to publish to this class\'s format live KDRs):')
                  // payload always includes classId; if target provided detect whether it's a KDR id or a format slug
                  const payload: any = { classId: String(id) }
                  if (target && target.trim().length) {
                    const t = target.trim()
                    const isUuid = t.includes('-')
                    if (isUuid) payload.kdrId = t
                    else payload.formatSlug = t
                  }
                  try {
                    const confirmMsg = payload.kdrId
                      ? `Publish this class to KDR ${payload.kdrId}? This will overwrite class snapshots for that KDR. Proceed?`
                      : `Publish this class to all live KDRs for its format? This will overwrite class snapshots for those KDRs. Proceed?`
                    if (!confirm(confirmMsg)) return
                    const res = await fetch('/api/admin/kdr/class-snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || data.message || 'Failed')
                    alert('Publish succeeded: ' + (data.message || JSON.stringify(data)))
                  } catch (err: any) {
                    console.error('Publish failed', err)
                    alert('Publish failed: ' + (err.message || err))
                  }
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-medium shadow-sm"
              >
                Publish to Live KDRs
              </button>
            )}
            <button 
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
            >
              Discard
            </button>
            <button 
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Class'}
            </button>
          </div>
        </div>

        {/* Peers Overlay removed from fixed position; moved to sidebar below Legendary Monster */}

        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Main Content */}
          <div className="col-span-12 lg:col-span-9 space-y-8">
            {/* 1. Class Details */}
              <div style={{ outline: (Object.values(peers || {}).find((p:any)=>p.section==='classDetails')||{}).color ? `3px solid ${(Object.values(peers || {}).find((p:any)=>p.section==='classDetails')||{}).color}` : undefined, outlineOffset: '-4px' }}>
              <CollaborativeClassDetails
                details={classDetails}
                onChange={setClassDetails}
                onEditSkillExtras={() => setIsMainSkillFormOpen(true)}
                onEditRelicExtras={() => setIsRelicSkillFormOpen(true)}
                send={send}
                me={me}
                peers={peers}
              />
            </div>

            {/* 2. Starting Cards */}
              <div style={{ outline: (Object.values(peers || {}).find((p:any)=>p.section==='startingCards')||{}).color ? `3px solid ${(Object.values(peers || {}).find((p:any)=>p.section==='startingCards')||{}).color}` : undefined, outlineOffset: '-4px' }}>
              <StartingCardsEditor 
                deck={deck}
                onChange={setDeck}
                skills={startingSkills}
                onSkillsChange={setStartingSkills}
                send={send}
                me={me}
                peers={peers}
                formatSlug={typeof slug === 'string' ? slug : null}
                formatVariant={formatVariant}
              />
            </div>

            {/* 3. Loot Pools */}
              <div style={{ outline: (Object.values(peers || {}).find((p:any)=>p.section==='lootPools')||{}).color ? `3px solid ${(Object.values(peers || {}).find((p:any)=>p.section==='lootPools')||{}).color}` : undefined, outlineOffset: '-4px' }}>
              <LootPoolEditor 
                pools={lootPools}
                onChange={setLootPools}
                send={send}
                me={me}
                peers={peers}
                formatVariant={formatVariant}
              />
            </div>

            {/* 4. Tip Skills */}
              <div style={{ outline: (Object.values(peers || {}).find((p:any)=>p.section==='tipSkills')||{}).color ? `3px solid ${(Object.values(peers || {}).find((p:any)=>p.section==='tipSkills')||{}).color}` : undefined, outlineOffset: '-4px' }}>
              <TipSkillsEditor 
                skills={tipSkills}
                onChange={setTipSkills}
                send={send}
                me={me}
                peers={peers}
                formatVariant={formatVariant}
              />
            </div>
          </div>

          {/* Right Column: Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-8">
            <LegendaryMonsterPicker 
              selectedCard={legendaryMonster}
              onChange={setLegendaryMonster}
            />
            {/* Collab Peers Panel */}
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold">Collaborators</div>
                <div className="text-xs text-gray-500">{clients} online</div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Build grouped view of presences by user */}
                {(() => {
                  const groups: Record<string, any> = {}
                  Object.entries(peers).forEach(([k, v]) => {
                    const u = (v && v.user) || { name: k }
                    const key = (u.email || u.name || k)
                    const col = (v && v.color) || (()=>{let s=(u.email||u.name||''); let h=0; for(let ii=0;ii<s.length;ii++)h=(h*31+s.charCodeAt(ii))%360; return `hsl(${h} 70% 45%)`})()
                    if (!groups[key]) groups[key] = { user: u, color: col, areas: [] }
                    // derive a human readable label for this presence
                    const p: any = v || {}
                    let label = ''
                    if (p.section === 'classDetails') {
                      const field = p.field
                      if (field === 'name') label = 'Class Name'
                      else if (field === 'skillName') label = 'Skill Name'
                      else if (field === 'skillDescription') label = 'Skill Description'
                      else if (field === 'questDescription') label = 'Legendary Quest'
                      else if (field === 'relicDescription') label = 'Relic Description'
                      else label = 'Class Details'
                    } else if (p.section === 'startingCards') {
                      if (p.itemId) {
                        const card = deck.find((d:any)=>d.id===p.itemId)
                        label = card ? `Starting Card: ${card.name}` : `Starting Card (${p.itemId})`
                      } else label = 'Starting Cards'
                    } else if (p.section === 'lootPools') {
                      if (p.field === 'pool') {
                        const pool = lootPools.find((pl:any)=>pl.id===p.poolId)
                        label = pool ? `Loot Pool: ${pool.name}` : `Loot Pool (${p.poolId})`
                      } else if (p.field === 'poolItem') {
                        const pool = lootPools.find((pl:any)=>pl.id===p.poolId)
                        const item = pool?.items?.find((it:any)=>it.id===p.itemId)
                        if (item) label = `Pool Item: ${item.type}${item.card?.name? ' - ' + (item.card.name): ''}`
                        else label = `Pool Item (${p.itemId})`
                      } else label = 'Loot Pools'
                    } else if (p.section === 'tipSkills') {
                      if (p.itemId) {
                        const s = tipSkills.find((t:any)=>t.id===p.itemId)
                        label = s ? `Tip Skill: ${s.name}` : `Tip Skill (${p.itemId})`
                      } else label = 'Tip Skills'
                    } else if (p.section === 'deck') {
                      label = 'Deck Editor'
                    } else if (p.section) {
                      label = p.section
                    } else {
                      label = 'idle'
                    }
                    // include field-specific cursor info
                    if (p.field && !label.includes(p.field)) label = label
                    if (!groups[key].areas.includes(label)) groups[key].areas.push(label)
                  })

                  // ensure the current user is included
                  const meKey = (me && (me.email || me.name)) || 'me'
                  if (!groups[meKey]) {
                    const myCol = (me && ((me.email||me.name) ? (()=>{let s=(me.email||me.name||''); let h=0; for(let ii=0;ii<s.length;ii++)h=(h*31+s.charCodeAt(ii))%360; return `hsl(${h} 70% 45%)`})() : undefined)) || '#666'
                    groups[meKey] = { user: me, color: myCol, areas: ['idle'] }
                  }

                  return Object.values(groups).map((g:any, idx:number) => (
                    <div key={idx} className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: g.color || '#444' }}>
                        {g.user?.image ? <img src={g.user.image} className="w-full h-full object-cover" alt={g.user.name||'U'} /> : <div className="text-white text-sm font-bold flex items-center justify-center">{(g.user && (g.user.name||'') || '?')[0]}</div>}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium truncate" style={{ color: g.color || undefined }}>{g.user?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                          {g.areas.map((a:string, i:number)=>(<div key={i} className="truncate">{a}</div>))}
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>
        </div>
        {/* Skill Forms for main skill and relic */}
        <SkillForm
          isOpen={isMainSkillFormOpen}
          onClose={() => setIsMainSkillFormOpen(false)}
          onSave={(s: Skill) => { setMainSkillData(s); setIsMainSkillFormOpen(false) }}
          initialSkill={mainSkillData || undefined}
          title="Edit Class Skill"
          formatVariant={formatVariant}
        />
        <SkillForm
          isOpen={isRelicSkillFormOpen}
          onClose={() => setIsRelicSkillFormOpen(false)}
          onSave={(s: Skill) => { setRelicSkillData(s); setIsRelicSkillFormOpen(false) }}
          initialSkill={relicSkillData || undefined}
          title="Edit Relic Skill"
          formatVariant={formatVariant}
        />
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    }
  }

  return {
    props: { session },
  }
}
