import React from 'react'
import { Card, SkillModification, Skill } from '../../../types/class-editor'

interface CardDescriptionProps {
  card: Card
  skills?: Skill[] // List of skills that might modify this card
  modifications?: SkillModification[] // Direct list of modifications (optional override)
}

export default function CardDescription({ card, skills, modifications }: CardDescriptionProps) {
  // Calculate effective modifications
  const effectiveModifications = React.useMemo(() => {
    if (modifications) return modifications.filter(m => m.card.id === card.id)
    if (skills) {
      return skills
        .flatMap(s => s.modifications || [])
        .filter(m => m.card.id === card.id)
    }
    return []
  }, [card.id, skills, modifications])

  const conditionMod = effectiveModifications.find(m => m.type === 'CONDITION')
  const textMod = effectiveModifications.find(m => m.type !== 'CONDITION')
  
  const descriptionContent = (() => {
    if (textMod && textMod.highlightedText && textMod.highlightedText.trim().length > 0) {
      return card.desc.split(textMod.highlightedText).map((part, i, arr) => (
        <React.Fragment key={i}>
          {part}
          {i < arr.length - 1 && (
            <span className={`px-1 rounded border font-medium ${
              textMod.type === 'NEGATE' ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 border-red-200 dark:border-red-800 line-through decoration-red-500' :
              textMod.type === 'ALTER' ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 border-green-200 dark:border-green-800' :
              'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 border-green-200 dark:border-green-800'
            }`}>
              {textMod.type === 'ALTER' && textMod.alteredText 
                ? textMod.alteredText 
                : textMod.highlightedText}
            </span>
          )}
        </React.Fragment>
      ))
    }
    return card.desc
  })()

  return (
    <>
      {conditionMod && conditionMod.note && (
        <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex items-start gap-2">
          <div className="flex-shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
            {conditionMod.note}
          </div>
        </div>
      )}
      <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
        {descriptionContent}
      </div>
    </>
  )
}
