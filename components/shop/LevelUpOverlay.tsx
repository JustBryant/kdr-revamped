import React from 'react'

type Props = {
  showLevelUp: boolean
  levelUpMessage: string | null
  statCenter: any | null
}

const LevelUpOverlay: React.FC<Props> = ({ showLevelUp, levelUpMessage, statCenter }) => {
  return (
    <>
      {showLevelUp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-none">
          <div className="relative z-10 pointer-events-none flex items-center justify-center w-full h-full">
            <div className="level-up-root pointer-events-none flex items-center justify-center">
              <div className="level-up-text level-up-animate">{levelUpMessage || 'Level Up!'}</div>
            </div>
          </div>
          <style jsx>{`
            .level-up-root { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
            .level-up-text { color: #fff6d6; font-weight: 900; letter-spacing: 0.02em; text-shadow: 0 6px 18px rgba(0,0,0,0.6); font-size: 2.8rem; transform-origin: center; opacity: 0; }
            .level-up-animate { animation: levelPopInOut 3000ms cubic-bezier(.2,.9,.2,1) forwards; }
            @keyframes levelPopInOut { 0% { transform: scale(0.2); opacity: 0 } 20% { transform: scale(1.6); opacity: 1 } 30% { transform: scale(1); opacity: 1 } 80% { transform: scale(1); opacity: 1 } 100% { transform: scale(0); opacity: 0 } }
            .level-up-particles { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
            .particle { position: absolute; left: 0; top: 0; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #ffd86b, #ff8a00); opacity: 0; transform: translate(-50%, -50%) scale(0.3); animation: particleFly 900ms cubic-bezier(.2,.9,.2,1) forwards; animation-delay: var(--delay, 0ms); }
            @keyframes particleFly { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.3); } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); } }
          `}</style>
        </div>
      )}

      {statCenter && (
        <div className="fixed inset-0 z-70 flex items-center justify-center pointer-events-none">
          <div className="relative z-10 pointer-events-none flex items-center justify-center w-full h-full">
            <div className="level-up-root pointer-events-none flex items-center justify-center">
              <div className="level-up-text" style={{ fontSize: '2.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '2.8rem', opacity: 1, marginBottom: 6, color: statCenter.color, fontWeight: 700 }}>{statCenter.label}</div>
                <div className={statCenter.showNew ? 'stat-center-new' : 'stat-center-old'} style={{ fontWeight: 900, color: statCenter.color, fontSize: '2.8rem' }}>{statCenter.showNew ? statCenter.newValue : statCenter.oldValue}</div>
              </div>
            </div>
          </div>
          <style jsx>{`
            .level-up-root { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
            .level-up-text { color: #fff6d6; letter-spacing: 0.02em; text-shadow: 0 6px 18px rgba(0,0,0,0.6); transform-origin: center; animation: levelPop 900ms cubic-bezier(.2,.9,.2,1) forwards; }
            @keyframes levelPop { 0% { transform: scale(0.2); opacity: 0 } 60% { transform: scale(1.6); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
            .level-up-particles { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
            .particle { position: absolute; left: 0; top: 0; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #ffd86b, #ff8a00); opacity: 0; transform: translate(-50%, -50%) scale(0.3); animation: particleFly 900ms cubic-bezier(.2,.9,.2,1) forwards; animation-delay: var(--delay, 0ms); }
            @keyframes particleFly { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.3); } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); } }
            .stat-center-new { transform: scale(1.12); color: inherit; }
            .stat-center-old { opacity: 0.95; color: inherit; }
          `}</style>
        </div>
      )}
    </>
  )
}

export default LevelUpOverlay
