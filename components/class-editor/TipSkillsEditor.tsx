import React, { useState } from 'react'
import { Skill } from '../../types/class-editor'
import SkillForm from './shared/SkillForm'
import { RichTextRenderer } from '../RichText'

interface TipSkillsEditorProps {
  skills: Skill[]
  onChange: (skills: Skill[]) => void
  formatVariant?: string | null
}

export default function TipSkillsEditor({ skills, onChange, send, me, peers, formatVariant }: TipSkillsEditorProps & { send?: (p:any)=>void, me?: any, peers?: Record<string, any> }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)

  const handleAdd = () => {
    setEditingSkill(null)
    setIsModalOpen(true)
  }

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill)
    setIsModalOpen(true)
    if (send) send({ section: 'tipSkills', data: { section: 'skill', skillId: skill.id }, ts: Date.now(), user: me })
  }

  const handleDelete = (id: string) => {
    onChange(skills.filter(s => s.id !== id))
  }

  const handleSave = (skill: Skill) => {
    if (editingSkill) {
      onChange(skills.map(s => s.id === editingSkill.id ? skill : s))
    } else {
      onChange([...skills, { ...skill, id: Date.now().toString(), type: 'UNIQUE' }])
    }
    setIsModalOpen(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Unique Skills</h2>
        <button 
          onClick={handleAdd}
          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-sm font-medium"
        >
          + Add Skill
        </button>
      </div>

      {skills.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          No Unique Skills added yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map(skill => (
            <div key={skill.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 transition-colors group relative bg-white dark:bg-gray-800" onMouseEnter={()=> send && send({ section: 'tipSkills', data: { section: 'skill', skillId: skill.id }, ts: Date.now(), user: me })} onMouseLeave={()=> send && send({ section: 'tipSkills', data: { section: 'skill', skillId: undefined }, ts: Date.now(), user: me })}>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                <button 
                  onClick={() => handleEdit(skill)}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
                >
                  ✎
                </button>
                <button 
                  onClick={() => handleDelete(skill.id)}
                  className="p-1 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                >
                  ✕
                </button>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">{skill.name}</h3>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <RichTextRenderer 
                  content={skill.description} 
                  requirements={skill.statRequirements as any}
                />
              </div>
              {skill.modifications && skill.modifications.length > 0 && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Modifies {skill.modifications.length} card{skill.modifications.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SkillForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialSkill={editingSkill}
        title={editingSkill ? 'Edit Unique Skill' : 'Add Unique Skill'}
        formatVariant={formatVariant}
      />
    </div>
  )
}
