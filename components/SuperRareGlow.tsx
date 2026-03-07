import React from 'react'

export const SuperRareGlow: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  return (
    <>
      {/* High-intensity initial flash */}
      <span className="sr-entry-flash" style={{ animationDelay: `${delay}ms` }} />
      
      {/* Expanding golden ring shockwave */}
      <span className="sr-entry-shockwave" style={{ animationDelay: `${delay}ms` }} />
      
      {/* Inner Bloom Burst */}
      <span className="sr-entry-bloom" style={{ animationDelay: `${delay}ms` }} />

      {/* Persistent Glow (fades in quickly after entry) */}
      <span className="sr-persistent-glow" style={{ animationDelay: `${delay + 10}ms, ${delay + 420}ms` }} />
      
      <style jsx>{`
        /* 1. Flash: Bright white/gold explosion overlaid on the card */
        .sr-entry-flash {
          position: absolute;
          inset: -5px;
          border-radius: 12px;
          background: white;
          opacity: 0;
          mix-blend-mode: overlay;
          z-index: 30;
          pointer-events: none;
          animation: srFlashAnim 500ms ease-out forwards;
        }

        /* 2. Shockwave: Expanding gold/amber/yellow ring */
        .sr-entry-shockwave {
          position: absolute;
          inset: -2px;
          border-radius: 12px;
          /* Multi-color gold gradient */
          background: conic-gradient(from 0deg, #f59e0b, #fbbf24, #fcd34d, #fbbf24, #f59e0b);
          opacity: 0;
          filter: blur(8px);
          z-index: 18;
          pointer-events: none;
          mix-blend-mode: screen;
          animation: srShockwaveAnim 1100ms cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
        }

        /* 3. Bloom: Deep diffuse glow spreading outwards */
        .sr-entry-bloom {
          position: absolute;
          inset: -50%;
          background: radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.5), rgba(251, 191, 36, 0.3) 40%, transparent 70%);
          opacity: 0;
          filter: blur(15px);
          z-index: 17;
          pointer-events: none;
          mix-blend-mode: screen;
          transform: scale(0.4);
          animation: srBloomAnim 1200ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
        }

        /* 4. Persistent: Stabilized gold border */
        .sr-persistent-glow {
          position: absolute;
          inset: 0;
          border-radius: 12px;
          pointer-events: none;
          background: transparent;
          /* Inner: Gold, Outer: Amber */
          box-shadow: 0 0 20px 4px rgba(255, 210, 80, 0.6), 0 0 40px 15px rgba(255, 180, 40, 0.3);
          opacity: 0;
          mix-blend-mode: screen;
          z-index: 25;
          animation-name: srPersistentFadeIn, srPersistentPulse;
          animation-duration: 400ms, 3000ms;
          animation-timing-function: ease-out, ease-in-out;
          animation-iteration-count: 1, infinite;
          animation-direction: normal, alternate;
          animation-fill-mode: forwards, none;
        }

        @keyframes srFlashAnim {
            0% { opacity: 0; transform: scale(0.95); filter: contrast(1); }
            10% { opacity: 1; transform: scale(1.02); filter: contrast(1.5); }
            100% { opacity: 0; transform: scale(1.15); }
        }

        @keyframes srShockwaveAnim {
            0% { opacity: 0; transform: scale(0.9); }
            15% { opacity: 1; transform: scale(1.05); }
            100% { opacity: 0; transform: scale(1.35); filter: blur(20px); }
        }

        @keyframes srBloomAnim {
             0% { opacity: 0; transform: scale(0.4); }
             40% { opacity: 1; transform: scale(1.0); }
             100% { opacity: 0; transform: scale(1.4); }
        }

        @keyframes srPersistentFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes srPersistentPulse {
          0% { opacity: 1; filter: saturate(1.3) brightness(1.1); }
          100% { 
            opacity: 0.6; 
            filter: saturate(1) brightness(1); 
          }
        }
      `}</style>
    </>
  )
}

export default SuperRareGlow
