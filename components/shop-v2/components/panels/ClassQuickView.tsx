import React from 'react'

type Props = {
  mounted: boolean
  overlayOpenTs: number | null
  classOverlayActive: boolean
  showIframe: boolean
  iframeActive: boolean
  iframeLoaded: boolean
  id: string | string[] | undefined
  playerKey?: string | null
  classDetails?: any
  onClose: () => void
  onIframeLoad?: () => void
}

const ClassQuickView: React.FC<Props> = ({ mounted, overlayOpenTs, classOverlayActive, showIframe, iframeActive, iframeLoaded, id, playerKey, classDetails, onClose, onIframeLoad }) => {
  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center pointer-events-none">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="relative z-[1001] w-full h-full pointer-events-auto flex flex-col items-center justify-center">
        <div
          className="w-full h-full bg-[#0a0a0c] overflow-hidden flex flex-col pt-6"
          style={{
            transformOrigin: 'center',
            transform: classOverlayActive ? 'scale(1)' : 'scale(0.95)',
            opacity: classOverlayActive ? 1 : 0,
            transition: 'transform 420ms cubic-bezier(.2,.9,.2,1), opacity 300ms ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">{classDetails?.name || 'Character'} Inventory</h2>
              <div className="hidden md:block h-4 w-px bg-white/10" />
              <div className="hidden md:block text-xs font-bold uppercase tracking-widest text-gray-500">Quick View</div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 relative bg-black/10">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 animate-pulse">Synchronizing Data...</div>
              </div>
            )}
            {showIframe && (
              <iframe
                key={overlayOpenTs || 'overlay-static'}
                src={`/kdr/${encodeURIComponent(String(id))}/class?playerKey=${encodeURIComponent(String(playerKey || ''))}&isEmbedded=1&embed=1${overlayOpenTs ? `&embedTs=${overlayOpenTs}` : ''}`}
                className="w-full h-full border-0"
                onLoad={() => {
                  try { onIframeLoad && onIframeLoad() } catch (e) {}
                }}
                style={{
                  visibility: iframeLoaded ? 'visible' : 'hidden',
                  pointerEvents: iframeLoaded ? 'auto' : 'none',
                  background: 'transparent',
                  opacity: iframeActive ? 1 : 0,
                  transition: `opacity 500ms linear`,
                  willChange: 'opacity'
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClassQuickView
