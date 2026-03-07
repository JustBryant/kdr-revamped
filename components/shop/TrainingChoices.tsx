import React from 'react'

type Props = {
  trainingButtonsExit: boolean
  loading: boolean
  playerGold: number
  trainingCost: number
  sessionsToNext: number
  onTrain: () => void | Promise<void>
  onDontTrain: () => void | Promise<void>
  onReroll?: () => void | Promise<void>
  cha?: number
  rerollsUsed?: number
}

const TrainingChoices: React.FC<Props> = ({ trainingButtonsExit, loading, playerGold, trainingCost, sessionsToNext, onTrain, onDontTrain, onReroll, cha = 0, rerollsUsed = 0 }) => {
  const maxRerolls = Math.floor(cha / 2)
  return (
    <div className="mt-6 w-full">
      <div className="w-full flex justify-center">
        <div style={{ width: '100%', maxWidth: '720px' }}>
          <div className="training-wrap" style={{ transform: trainingButtonsExit ? 'translateX(-220%)' : 'translateX(0)', transition: 'transform 700ms cubic-bezier(.2,.9,.2,1), opacity 300ms', opacity: trainingButtonsExit ? 0 : 1 }}>
            
            <div className="h-[88px] flex items-center justify-center">
              <div className="inline-flex flex-col sm:flex-row items-center gap-4" style={{ zIndex: 20 }}>
                <button style={{ animationDelay: '0ms' }} className="px-8 py-4 bg-emerald-600 text-white rounded-lg text-xl font-semibold shadow-lg min-w-[160px] inline-flex items-center justify-center gap-3 train-left" disabled={loading || (playerGold < trainingCost)} onClick={async () => { try { await onTrain() } catch (e) {} }}>
                  <span>Train</span>
                  <span className="text-sm opacity-90">-{trainingCost}g</span>
                </button>
                <button style={{ animationDelay: '120ms' }} className="px-8 py-4 bg-gray-600 text-white rounded-lg text-xl font-semibold shadow min-w-[160px] flex items-center justify-center train-right" disabled={loading} onClick={async () => { try { await onDontTrain() } catch (e) {} }}>
                  Don't Train
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-300 text-center train-footnote" style={{ animationDelay: '560ms' }}>
              Cost: <span className="font-semibold text-white">{trainingCost} gold</span> — Sessions to next level: <span className="font-semibold text-white">{sessionsToNext}</span>
            </div>
            <style jsx>{`
              .train-left { transform: translateX(-120%); opacity: 0; }
              .train-right { transform: translateX(120%); opacity: 0; }
              .train-footnote { transform: translateY(-18px); opacity: 0; }
              @keyframes trainInLeft { 0% { transform: translateX(-120%); opacity: 0 } 60% { transform: translateX(8px); opacity: 1 } 100% { transform: translateX(0); opacity: 1 } }
              @keyframes trainInRight { 0% { transform: translateX(120%); opacity: 0 } 60% { transform: translateX(-8px); opacity: 1 } 100% { transform: translateX(0); opacity: 1 } }
              @keyframes footnoteIn { 0% { transform: translateY(-18px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
              .train-left { animation: trainInLeft 420ms cubic-bezier(.2,.9,.2,1) forwards; }
              .train-right { animation: trainInRight 420ms cubic-bezier(.2,.9,.2,1) forwards; }
              .train-footnote { animation: footnoteIn 360ms cubic-bezier(.2,.9,.2,1) forwards; }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingChoices
