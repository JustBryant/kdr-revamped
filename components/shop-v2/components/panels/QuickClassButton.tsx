import React from 'react'
import FitName from '../../../common/FitName'
import ClassImage from '../../../common/ClassImage'

type Props = {
  onClick: (e: any) => void
  classDetails?: any | null
  player?: any | null
}

const QuickClassButton = React.forwardRef<HTMLButtonElement, Props>(({ onClick, classDetails, player }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label="Open class quick view"
      className="w-14 h-14 rounded-xl overflow-hidden border-2 border-blue-500/40 bg-neutral-900 flex items-center justify-center hover:scale-105 active:scale-95 transform transition-all shadow-lg shadow-blue-500/10 group"
    >
      {(() => {
        const filename = classDetails?.image || player?.classImage || (player?.class || {})?.image
        if (filename) return <ClassImage image={filename} alt={classDetails?.name || 'Class'} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
        const name = classDetails?.name || player?.class?.name || 'Cls'
        return (
          <div className="flex items-center justify-center w-full h-full">
            <FitName text={name} maxWidth={44} className="text-white font-bold" />
          </div>
        )
      })()}
    </button>
  )
})

export default QuickClassButton
