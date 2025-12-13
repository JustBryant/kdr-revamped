import React, { useState, useEffect } from 'react'
import { CLASS_IMAGE_BASE_URL } from '../../lib/constants'

export interface ClassDetails {
  name: string
  image?: string
  skillName: string
  skillDescription: string
  questDescription: string
  relicDescription: string
}

interface ClassDetailsEditorProps {
  details: ClassDetails
  onChange: (details: ClassDetails) => void
}

type EditSection = 'name' | 'image' | 'skill' | 'quest' | 'relic' | null

export default function ClassDetailsEditor({ details, onChange }: ClassDetailsEditorProps) {
  const [activeSection, setActiveSection] = useState<EditSection>(null)
  const [editValues, setEditValues] = useState<ClassDetails>(details)
  
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
            <input
              type="text"
              value={editValues.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="e.g. Pyromancer"
              autoFocus
            />
          </div>
        )
      case 'image':
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Select Class Image</label>
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
                    <img 
                      src={`${CLASS_IMAGE_BASE_URL}/${img}`}
                      alt={img}
                      className="w-full h-auto object-contain"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                      {img}
                    </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name</label>
              <input
                type="text"
                value={editValues.skillName}
                onChange={(e) => handleChange('skillName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Fireball"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editValues.skillDescription}
                onChange={(e) => handleChange('skillDescription', e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what the skill does..."
              />
            </div>
          </div>
        )
      case 'quest':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quest Description</label>
            <textarea
              value={editValues.questDescription}
              onChange={(e) => handleChange('questDescription', e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the quest requirements and reward..."
              autoFocus
            />
          </div>
        )
      case 'relic':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relic Description</label>
            <textarea
              value={editValues.relicDescription}
              onChange={(e) => handleChange('relicDescription', e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the relic's effects..."
              autoFocus
            />
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Quadrant 1: Class Name & Image */}
      <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-100 dark:border-green-900/50 hover:border-green-400 dark:hover:border-green-500 hover:shadow-md transition-all group h-full flex items-start space-x-4">
        {/* Image Preview */}
        <div 
          onClick={() => handleOpen('image')}
          className="w-20 h-28 bg-green-200 dark:bg-green-800/50 rounded-md overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 ring-green-400 transition-all relative flex items-center justify-center"
        >
          {details.image ? (
            <img 
              src={`${CLASS_IMAGE_BASE_URL}/${details.image}`} 
              alt="Class" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-green-700 dark:text-green-300 p-2 text-center">
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
          <h3 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">Class Name</h3>
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
        <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Class Skill</h3>
        <div className="font-bold text-blue-900 dark:text-blue-100 text-lg mb-1">
          {details.skillName || <span className="opacity-50 italic">Set Skill Name...</span>}
        </div>
        <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
          {details.skillDescription || <span className="opacity-50 italic">Set Description...</span>}
        </div>
      </div>

      {/* Quadrant 3: Legendary Quest */}
      <div 
        onClick={() => handleOpen('quest')}
        className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-100 dark:border-yellow-900/50 hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-md transition-all cursor-pointer group h-full"
      >
        <h3 className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-2">Legendary Quest</h3>
        <div className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">
          {details.questDescription || <span className="opacity-50 italic">Set Quest Description...</span>}
        </div>
      </div>

      {/* Quadrant 4: Legendary Relic */}
      <div 
        onClick={() => handleOpen('relic')}
        className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-100 dark:border-purple-900/50 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all cursor-pointer group h-full"
      >
        <h3 className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2">Legendary Relic</h3>
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
