import React, { useState } from 'react'

interface Dialogue { id: string; text: string }

interface Props {
  open: boolean
  type: string
  dialogues: Dialogue[]
  onClose: () => void
  onAdd: (text: string) => Promise<void>
  onUpdate: (id: string, text: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function CompactDialoguePanel({ open, type, dialogues, onClose, onAdd, onUpdate, onDelete }: Props) {
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-xl p-4 shadow-lg border">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{type.replace('_',' ')} — Dialogues</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setNewText(''); setEditingId(null); setEditingText('') }} className="px-2 py-1 bg-slate-700 text-white border border-white/10 rounded text-sm">Clear</button>
            <button onClick={onClose} className="px-2 py-1 bg-slate-700 text-white border border-white/10 rounded text-sm">Close</button>
          </div>
        </div>

        <div className="mb-2 flex gap-2">
          <input value={newText} onChange={e => setNewText(e.target.value)} placeholder={`New ${type} line`} className="flex-1 border p-2 text-sm" />
          <button onClick={async () => { if (!newText) return; await onAdd(newText); setNewText('') }} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Add</button>
        </div>

        <div className="max-h-64 overflow-auto space-y-2">
          {dialogues.map(d => (
            <div key={d.id} className="p-2 border rounded flex items-start gap-3">
              <div className="flex-1">
                {editingId === d.id ? (
                  <input value={editingText} onChange={e => setEditingText(e.target.value)} className="w-full border p-2 text-sm" />
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{d.text}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingId === d.id ? (
                  <>
                    <button onClick={async () => { await onUpdate(d.id, editingText); setEditingId(null); setEditingText('') }} title="Save" className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                    </button>
                    <button onClick={() => { setEditingId(null); setEditingText('') }} title="Cancel" className="w-8 h-8 flex items-center justify-center bg-slate-700 text-white rounded text-sm border border-white/10">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(d.id); setEditingText(d.text) }} title="Edit" className="w-8 h-8 flex items-center justify-center bg-slate-700 text-white rounded text-sm border border-white/10">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                    </button>
                    <button onClick={() => onDelete(d.id)} title="Delete" className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {dialogues.length === 0 && <div className="text-sm text-gray-500">No lines yet</div>}
        </div>
      </div>
    </div>
  )
}
