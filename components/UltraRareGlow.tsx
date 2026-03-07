import React from 'react'

export const UltraRareGlow: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  return (
    <>
      {/* High-intensity initial flash */}
      <span className="ur-entry-flash" style={{ animationDelay: `${delay}ms` }} />
      
      {/* Expanding spectral ring shockwave */}
      <span className="ur-entry-shockwave" style={{ animationDelay: `${delay}ms` }} />
      
      {/* Inner Bloom Burst */}
      <span className="ur-entry-bloom" style={{ animationDelay: `${delay}ms` }} />

      {/* Persistent Glow (fades in quickly after entry) */}
      <span className="ur-persistent-glow" style={{ animationDelay: `${delay + 10}ms, ${delay + 420}ms` }} />
      
      <style jsx>{`
        /* 1. Flash: Bright white/cyan explosion overlaid on the card */
        .ur-entry-flash {
          position: absolute;
          inset: -5px;
          border-radius: 12px;
          background: white;
          opacity: 0;
          mix-blend-mode: overlay;
          z-index: 30;
          pointer-events: none;
          animation: urFlashAnim 500ms ease-out forwards;
        }

        /* 2. Shockwave: Expanding rainbow/neon ring */
        .ur-entry-shockwave {
          position: absolute;
          inset: -2px;
          border-radius: 12px;
          /* Multi-color neon gradient matching Shatterfoil shards */
          background: conic-gradient(from 0deg, #d946ef, #8b5cf6, #3b82f6, #06b6d4, #d946ef);
          opacity: 0;
          filter: blur(8px);
          z-index: 18;
          pointer-events: none;
          mix-blend-mode: screen;
          animation: urShockwaveAnim 1100ms cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
        }

        /* 3. Bloom: Deep diffuse glow spreading outwards */
        .ur-entry-bloom {
          position: absolute;
          inset: -50%;
          background: radial-gradient(circle at 50% 50%, rgba(217, 70, 239, 0.5), rgba(59, 130, 246, 0.3) 40%, transparent 70%);
          opacity: 0;
          filter: blur(15px);
          z-index: 17;
          pointer-events: none;
          mix-blend-mode: screen;
          transform: scale(0.4);
          animation: urBloomAnim 1200ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
        }

        /* 4. Persistent: Stabilized neon border */
        .ur-persistent-glow {
          position: absolute;
          inset: 0;
          border-radius: 12px;
          pointer-events: none;
          background: transparent;
          /* Inner: Neon Pink/Purple, Outer: Cyan/Blue */
          box-shadow: 0 0 25px 5px rgba(220, 40, 255, 0.7), 0 0 50px 15px rgba(0, 180, 255, 0.4);
          opacity: 0;
          mix-blend-mode: screen;
          z-index: 25;
          animation-name: urPersistentFadeIn, urPersistentPulse;
          animation-duration: 400ms, 3000ms;
          animation-timing-function: ease-out, ease-in-out;
          animation-iteration-count: 1, infinite;
          animation-direction: normal, alternate;
          animation-fill-mode: forwards, none;
        }

        @keyframes urFlashAnim {
            0% { opacity: 0; transform: scale(0.95); filter: contrast(1); }
            10% { opacity: 1; transform: scale(1.02); filter: contrast(1.5); }
            100% { opacity: 0; transform: scale(1.15); }
        }

        @keyframes urShockwaveAnim {
            0% { opacity: 0; transform: scale(0.9); }
            15% { opacity: 1; transform: scale(1.05); }
            100% { opacity: 0; transform: scale(1.35); filter: blur(20px); }
        }

        @keyframes urBloomAnim {
             0% { opacity: 0; transform: scale(0.4); }
             40% { opacity: 1; transform: scale(1.0); }
             100% { opacity: 0; transform: scale(1.4); }
        }

        @keyframes urPersistentFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes urPersistentPulse {
          0% { opacity: 1; filter: saturate(1.3) brightness(1.1); }
          100% { 
            opacity: 0.7; 
            filter: saturate(1) brightness(1); 
            box-shadow: 0 0 20px 3px rgba(220, 40, 255, 0.6), 0 0 40px 10px rgba(0, 180, 255, 0.3); 
          }
        }
      `}</style>
    </>
  )
}

export default UltraRareGlow
