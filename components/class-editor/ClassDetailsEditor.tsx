import React, { useState, useEffect, useRef, useCallback } from 'react'
import ClassImage from '../common/ClassImage'

export interface ClassDetails {
  name: string
  isPublic?: boolean
  image?: string
  skillName: string
  skillDescription: string
  questDescription: string
  relicDescription: string
}

interface ClassDetailsEditorProps {
  details: ClassDetails
  onChange: (details: ClassDetails) => void
  onEditSkillExtras?: () => void
  onEditRelicExtras?: () => void
  collabSend?: (payload: any) => void
  me?: any
  peers?: Record<string, any>
}

type EditSection = 'name' | 'image' | 'skill' | 'quest' | 'relic' | null

export default function ClassDetailsEditor({ details, onChange, onEditSkillExtras, onEditRelicExtras, collabSend, me, peers }: ClassDetailsEditorProps) {
  const [activeSection, setActiveSection] = useState<EditSection>(null)
  const [editValues, setEditValues] = useState<ClassDetails>(details)
  const colorFor = (idOrUser: any) => {
    const s = (idOrUser && (idOrUser.email || idOrUser.name)) || String(idOrUser || '')
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
    return `hsl(${h} 70% 45%)`
  }

  const renderPeerBadge = (p: any) => {
    const name = p?.user?.name || 'Anon'
    const img = p?.user?.image || p?.user?.avatar
    const color = p?.color || colorFor(p?.user || p)
    return (
      <div className="inline-flex items-center space-x-2">
        <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center" style={{ background: color }}>
          {img ? <img src={img} className="w-full h-full object-cover" alt={name} /> : <div className="text-xs font-bold text-white">{(name||'')[0] || '?'}</div>}
        </div>
        <div className="text-xs truncate">{name}</div>
      </div>
    )
  }

  // caret coordinate helper (simple mirror technique)
  const getCaretCoordinates = (el: HTMLTextAreaElement | HTMLInputElement, position: number) => {
    try {
      const div = document.createElement('div')
      const style = getComputedStyle(el)
      Array.from(style).forEach((name: any) => {
        div.style.setProperty(name, style.getPropertyValue(name))
      })
      div.style.position = 'absolute'
      div.style.visibility = 'hidden'
      div.style.whiteSpace = 'pre-wrap'
      if (el.tagName === 'INPUT') div.style.whiteSpace = 'nowrap'
      div.style.overflow = 'auto'
      div.textContent = el.value.substring(0, position)

      const span = document.createElement('span')
      span.textContent = el.value.substring(position) || '\u200b'
      div.appendChild(span)
      // position the mirror exactly over the input/textarea so coords align
      const rect = el.getBoundingClientRect()
      div.style.left = (rect.left + window.scrollX) + 'px'
      div.style.top = (rect.top + window.scrollY) + 'px'
      div.style.width = rect.width + 'px'
      div.style.height = rect.height + 'px'
      // ensure mirror scroll matches textarea scroll
      document.body.appendChild(div);
      (div as any).scrollTop = (el as any).scrollTop || 0

      const spanRect = span.getBoundingClientRect()
      const left = spanRect.left
      const top = spanRect.top
      const height = spanRect.height || parseInt(style.lineHeight || '16', 10)
      document.body.removeChild(div)
      return { left, top, height }
    } catch (err) {
      return null
    }
  }

  const sendPresenceForElement = useCallback((field: string, el: HTMLTextAreaElement | HTMLInputElement | null) => {
    if (!collabSend || !el) return
    const start = (el as any).selectionStart ?? 0
    const end = (el as any).selectionEnd ?? start
    const coords = getCaretCoordinates(el as any, start)
    collabSend({ section: 'presence', data: { section: 'classDetails', field, cursor: { start, end }, cursorPixel: coords, user: me }, ts: Date.now() })
  }, [collabSend, me])
  
  // Image Picker State
  const [availableImages, setAvailableImages] = useState<string[]>([])
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  useEffect(() => {
    if (activeSection === 'image' && availableImages.length === 0) {
      setIsLoadingImages(true)
      fetch('/api/classes/images')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAvailableImages(data)
          }
        })
        .catch(err => console.error('Failed to load images', err))
        .finally(() => setIsLoadingImages(false))
    }
  }, [activeSection])

  const handleOpen = (section: EditSection) => {
    setEditValues(details)
    setActiveSection(section)
    if (collabSend && section) {
      collabSend({ section: 'presence', data: { section: 'classDetails', field: section, user: me }, ts: Date.now() })
    }
  }

  const handleSave = () => {
    onChange(editValues)
    setActiveSection(null)
  }

  const handleChange = (key: keyof ClassDetails, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }))
  }

  const renderModalContent = () => {
    switch (activeSection) {
      case 'name':
        return (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Class Name</label>
              <div className="flex space-x-2">
                {(peers ? Object.values(peers).filter((p:any)=>p.section==='classDetails' && p.field==='name').slice(0,3) : []).map((p:any, i:number)=>(
                  <div key={i} className="text-xs px-2 py-1 rounded" style={{ background: (p.color || colorFor(p.user)) }}>
                      <div className="inline-flex items-center space-x-1 text-white px-2 py-0.5">
                        <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                          {p.user?.image ? <img src={p.user.image} className="w-full h-full object-cover" alt={p.user.name || 'A'} /> : <div className="text-[10px] font-bold text-white">{(p.user?.name||'')[0]||'?'}</div>}
                        </div>
                        <div className="text-xs">{(p.user && p.user.name) || 'Anon'}</div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={editValues.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onFocus={(e) => sendPresenceForElement('name', e.currentTarget)}
              onBlur={(e) => collabSend && collabSend({ section: 'presence', data: { section: 'classDetails', user: me }, ts: Date.now() })}
              onSelect={(e) => sendPresenceForElement('name', e.currentTarget)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="e.g. Pyromancer"
              autoFocus
            />
          </div>
        )
      case 'image':
        return (
          <div className="space-y-4">
            {/* Heading above already indicates purpose; remove redundant label here */}
            {isLoadingImages ? (
              <div className="text-center py-8 text-gray-500">Loading images...</div>
            ) : (
              <div className="grid grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-2">
                {availableImages.map(img => (
                  <button
                    key={img}
                    onClick={() => handleChange('image', img)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      editValues.image === img 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <ClassImage
                      image={img}
                      alt={img}
                      className="w-full h-auto object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      case 'skill':
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Skill Name</label>
                <div className="flex space-x-2">
                    {(peers ? Object.values(peers).filter((p:any)=>p.section==='classDetails' && p.field==='skill').slice(0,3) : []).map((p:any, i:number)=>(
                      <div key={i} className="text-xs px-2 py-1 rounded" style={{ background: (p.color || colorFor(p.user)) }}>
                        <div className="inline-flex items-center space-x-1 text-white px-2 py-0.5">
                          <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                            {p.user?.image ? <img src={p.user.image} className="w-full h-full object-cover" alt={p.user.name || 'A'} /> : <div className="text-[10px] font-bold text-white">{(p.user?.name||'')[0]||'?'}</div>}
                          </div>
                          <div className="text-xs">{(p.user && p.user.name) || 'Anon'}</div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
              <div className="relative">
              <input
                type="text"
                value={editValues.skillName}
                onChange={(e) => handleChange('skillName', e.target.value)}
                onFocus={(e) => sendPresenceForElement('skillName', e.currentTarget)}
                onBlur={() => collabSend && collabSend({ section: 'presence', data: { section: 'classDetails', user: me }, ts: Date.now() })}
                onSelect={(e) => sendPresenceForElement('skillName', e.currentTarget)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Fireball"
                autoFocus
              />
                {/* render cursor badges for peers editing this field */}
                {(peers ? Object.values(peers).filter((pp:any)=>pp.section==='classDetails' && (pp.field==='skill' || pp.field==='skillName' || pp.field==='skillDescription')).map((pp:any, idx:number)=>{
                  if (!pp) return null
                  const color = pp.color || colorFor(pp.user)
                  const cursor = pp?.cursor
                  return (
                    <div key={idx} className="absolute right-2 top-2 flex items-center space-x-2 pointer-events-none">
                      <div className="w-6 h-6 rounded-full overflow-hidden border-2" style={{ borderColor: 'rgba(255,255,255,0.6)', background: color }}>
                        {pp.user?.image ? <img src={pp.user.image} className="w-full h-full object-cover" alt={pp.user.name||'A'} /> : <div className="text-xs font-bold text-white">{(pp.user?.name||'')[0]||'?'}</div>}
                      </div>
                      {cursor ? <div className="text-xs text-white bg-black/50 px-2 py-0.5 rounded">{cursor.start}-{cursor.end}</div> : <div className="text-xs text-white bg-black/40 px-2 py-0.5 rounded">editing</div>}
                    </div>
                  )
                }) : [])}
                </div>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editValues.skillDescription}
                onChange={(e) => handleChange('skillDescription', e.target.value)}
                onFocus={(e) => sendPresenceForElement('skillDescription', e.currentTarget)}
                onBlur={() => collabSend && collabSend({ section: 'presence', data: { section: 'classDetails', user: me }, ts: Date.now() })}
                onSelect={(e) => sendPresenceForElement('skillDescription', e.currentTarget)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what the skill does..."
              />
              {(peers ? Object.values(peers).filter((pp:any)=>pp.section==='classDetails' && pp.field==='skillDescription').map((pp:any, idx:number)=>{
                if (!pp) return null
                const color = pp.color || colorFor(pp.user)
                const cursor = pp?.cursor
                return (
                  <div key={idx} className="absolute right-2 top-2 flex items-center space-x-2 pointer-events-none">
                    <div className="w-6 h-6 rounded-full overflow-hidden border-2" style={{ borderColor: 'rgba(255,255,255,0.6)', background: color }}>
                      {pp.user?.image ? <img src={pp.user.image} className="w-full h-full object-cover" alt={pp.user.name||'A'} /> : <div className="text-xs font-bold text-white">{(pp.user?.name||'')[0]||'?'}</div>}
                    </div>
                    {cursor ? <div className="text-xs text-white bg-black/50 px-2 py-0.5 rounded">{cursor.start}-{cursor.end}</div> : <div className="text-xs text-white bg-black/40 px-2 py-0.5 rounded">editing</div>}
                  </div>
                )
              }) : [])}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onEditSkillExtras && onEditSkillExtras()}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Edit Skill Modifications & Provides
              </button>
            </div>
          </div>
        )
      case 'quest':
        return (
          <div>
            <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Quest Description</label>
            <textarea
              value={editValues.questDescription}
              onChange={(e) => handleChange('questDescription', e.target.value)}
              onFocus={(e) => sendPresenceForElement('questDescription', e.currentTarget)}
              onBlur={() => collabSend && collabSend({ section: 'presence', data: { section: 'classDetails', user: me }, ts: Date.now() })}
              onSelect={(e) => sendPresenceForElement('questDescription', e.currentTarget)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the quest requirements and reward..."
              autoFocus
            />
              {(peers ? Object.values(peers).filter((pp:any)=>pp.section==='classDetails' && pp.field==='questDescription').map((pp:any, idx:number)=>{
                if (!pp) return null
                const color = pp.color || colorFor(pp.user)
                const cursor = pp?.cursor
                return (
                  <div key={idx} className="absolute right-2 top-2 flex items-center space-x-2 pointer-events-none">
                    <div className="w-6 h-6 rounded-full overflow-hidden border-2" style={{ borderColor: 'rgba(255,255,255,0.6)', background: color }}>
                      {pp.user?.image ? <img src={pp.user.image} className="w-full h-full object-cover" alt={pp.user.name||'A'} /> : <div className="text-xs font-bold text-white">{(pp.user?.name||'')[0]||'?'}</div>}
                    </div>
                    {cursor ? <div className="text-xs text-white bg-black/50 px-2 py-0.5 rounded">{cursor.start}-{cursor.end}</div> : <div className="text-xs text-white bg-black/40 px-2 py-0.5 rounded">editing</div>}
                  </div>
                )
              }) : [])}
            </div>
          </div>
        )
      case 'relic':
        return (
          <div>
            <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Relic Description</label>
            <textarea
              value={editValues.relicDescription}
              onChange={(e) => handleChange('relicDescription', e.target.value)}
              onFocus={(e) => sendPresenceForElement('relicDescription', e.currentTarget)}
              onBlur={() => collabSend && collabSend({ section: 'presence', data: { section: 'classDetails', user: me }, ts: Date.now() })}
              onSelect={(e) => sendPresenceForElement('relicDescription', e.currentTarget)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the relic's effects..."
              autoFocus
            />
              {(peers ? Object.values(peers).filter((pp:any)=>pp.section==='classDetails' && pp.field==='relicDescription').map((pp:any, idx:number)=>{
                if (!pp) return null
                const color = pp.color || colorFor(pp.user)
                const cursor = pp?.cursor
                return (
                  <div key={idx} className="absolute right-2 top-2 flex items-center space-x-2 pointer-events-none">
                    <div className="w-6 h-6 rounded-full overflow-hidden border-2" style={{ borderColor: 'rgba(255,255,255,0.6)', background: color }}>
                      {pp.user?.image ? <img src={pp.user.image} className="w-full h-full object-cover" alt={pp.user.name||'A'} /> : <div className="text-xs font-bold text-white">{(pp.user?.name||'')[0]||'?'}</div>}
                    </div>
                    {cursor ? <div className="text-xs text-white bg-black/50 px-2 py-0.5 rounded">{cursor.start}-{cursor.end}</div> : <div className="text-xs text-white bg-black/40 px-2 py-0.5 rounded">editing</div>}
                  </div>
                )
              }) : [])}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onEditRelicExtras && onEditRelicExtras()}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
              >
                Edit Relic Modifications & Provides
              </button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'name': return 'Edit Class Name'
      case 'image': return 'Select Class Image'
      case 'skill': return 'Edit Class Skill'
      case 'quest': return 'Edit Legendary Quest'
      case 'relic': return 'Edit Legendary Relic'
      default: return ''
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
      {/* remote carets */}
      {peers ? Object.values(peers).filter((pp:any)=>pp.section==='classDetails' && pp.cursorPixel).map((pp:any, i:number)=>{
        const coords = pp.cursorPixel
        if (!coords) return null
        const color = pp.color || colorFor(pp.user)
        const left = typeof coords.left === 'number' ? coords.left : parseFloat(coords.left) || 0
        const top = typeof coords.top === 'number' ? coords.top : parseFloat(coords.top) || 0
        const height = Math.max(16, coords.height || 16)
        return (
          <div key={i} style={{ position: 'fixed', left: left, top: top, pointerEvents: 'none', zIndex: 2147483647 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ width: 2, height: height, background: color, borderRadius: 1, boxShadow: `0 0 6px ${color}` }} />
              <div style={{ position: 'absolute', left: 6, bottom: height + 6, width: 22, height: 22, borderRadius: 9999, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.9)', background: color }}>
                {pp.user?.image ? <img src={pp.user.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={pp.user.name||'P'} /> : <div style={{ color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(pp.user?.name||'?')[0]}</div>}
              </div>
            </div>
          </div>
        )
      }) : null}
      {/* Quadrant 1: Class Name & Image */}
      <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-100 dark:border-green-900/50 hover:border-green-400 dark:hover:border-green-500 hover:shadow-md transition-all group h-full flex items-start space-x-4">
        {/* Visibility Toggle */}
        <div className="absolute top-2 right-2 flex items-center gap-2 pr-4 pt-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400">Visibility</label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...details, isPublic: !details.isPublic });
            }}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${details.isPublic !== false ? 'bg-green-500' : 'bg-gray-400'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${details.isPublic !== false ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Image Preview */}
        <div 
          onClick={() => handleOpen('image')}
          className="w-20 h-28 bg-green-200 dark:bg-green-800/50 rounded-md overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 ring-green-400 transition-all relative flex items-center justify-center"
        >
          {details.image ? (
            <ClassImage
              image={details.image}
              alt="Class"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-green-900 dark:text-green-200 p-2 text-center">
              <span className="text-2xl mb-1">+</span>
              <span className="text-[10px] font-bold uppercase leading-tight">Add Image</span>
            </div>
          )}
        </div>

        {/* Name Editor */}
        <div 
          onClick={() => handleOpen('name')}
          className="flex-1 cursor-pointer"
        >
          <h3 className="text-xs font-bold text-green-900 dark:text-green-300 uppercase tracking-wider mb-2">Class Name</h3>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100 break-words">
            {details.name || <span className="opacity-50 italic">Set Name...</span>}
          </div>
        </div>
      </div>

      {/* Quadrant 2: Class Skill */}
      <div 
        onClick={() => handleOpen('skill')}
        className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-900/50 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group h-full"
      >
        <h3 className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider mb-2">Class Skill</h3>
        <div className="font-bold text-blue-900 dark:text-blue-100 text-lg mb-1">
          {details.skillName || <span className="opacity-50 italic">Set Skill Name...</span>}
        </div>
        <div className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap">
          {details.skillDescription || <span className="opacity-50 italic">Set Description...</span>}
        </div>
      </div>

      {/* Quadrant 3: Legendary Quest */}
      <div 
        onClick={() => handleOpen('quest')}
        className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-100 dark:border-yellow-900/50 hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-md transition-all cursor-pointer group h-full"
      >
        <h3 className="text-xs font-bold text-yellow-900 dark:text-yellow-400 uppercase tracking-wider mb-2">Legendary Quest</h3>
        <div className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">
          {details.questDescription || <span className="opacity-50 italic">Set Quest Description...</span>}
        </div>
      </div>

      {/* Quadrant 4: Legendary Relic */}
      <div 
        onClick={() => handleOpen('relic')}
        className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-100 dark:border-purple-900/50 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all cursor-pointer group h-full"
      >
        <h3 className="text-xs font-bold text-purple-900 dark:text-purple-400 uppercase tracking-wider mb-2">Legendary Relic</h3>
        <div className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap">
          {details.relicDescription || <span className="opacity-50 italic">Set Relic Description...</span>}
        </div>
      </div>

      {/* Edit Modal */}
      {activeSection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{getSectionTitle()}</h3>
              <button 
                onClick={() => setActiveSection(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 dark:text-gray-200">
              {renderModalContent()}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end space-x-3">
              <button 
                onClick={() => setActiveSection(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
