import React, { useMemo, useState, useEffect } from 'react'

export const ShatterfoilOverlay: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  // Density: 20 rows x 14 cols (finer shards)
  const rows = 20
  const cols = 14
  
  // Phase state for cycling animation groups
  // We split shards into 3 groups. Each cycle animates one group sweeping DL -> TR.
  const [activeGroup, setActiveGroup] = useState(0)

  useEffect(() => {
    // Cycle every 3 seconds
    const interval = setInterval(() => {
      setActiveGroup(g => (g + 1) % 3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Generate Jigsaw Voronoi Mesh (Memoized once)
  const triangles = useMemo(() => {
    const points: {x:number, y:number}[][] = []

    // 1. Generate jittered grid points
    for (let r = 0; r <= rows; r++) {
      const rowPoints = []
      for (let c = 0; c <= cols; c++) {
        // Base uniform position
        let x = (c / cols) * 100
        let y = (r / rows) * 100

        // Jitter internal points
        if (r !== 0 && r !== rows && c !== 0 && c !== cols) {
           const xJitter = (Math.random() - 0.5) * (100 / cols) * 1.6
           const yJitter = (Math.random() - 0.5) * (100 / rows) * 1.6
           x += xJitter
           y += yJitter
        }
        rowPoints.push({ x, y })
      }
      points.push(rowPoints)
    }

    // 2. Tesselate into triangles
    const tris = []
    let triIndex = 0
    
    // Pattern Colors (UR Vibrant Neon)
    const colorPalette = [
      'rgba(220, 40, 255, 0.9)', // neon purple
      'rgba(0, 160, 255, 0.9)',  // electric blue
      'rgba(255, 20, 160, 0.9)', // deep hot pink
      'rgba(0, 255, 220, 0.9)',  // bright cyan
      'rgba(255, 255, 255, 0.95)' // blinding white
    ]

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p1 = points[r][c]         // TL
        const p2 = points[r][c+1]       // TR
        const p3 = points[r+1][c]       // BL
        const p4 = points[r+1][c+1]     // BR

        // Random diagonal split
        const flip = Math.random() > 0.5

        if (flip) {
           tris.push({ p: [p3, p1, p2], c, r, i: triIndex++ })
           tris.push({ p: [p3, p2, p4], c, r, i: triIndex++ })
        } else {
           tris.push({ p: [p1, p2, p4], c, r, i: triIndex++ })
           tris.push({ p: [p1, p4, p3], c, r, i: triIndex++ })
        }
      }
    }

    // Pre-calculate spatial properties & assign groups
    return tris.map(t => {
      const clipPath = `polygon(${t.p.map(p => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`).join(', ')})`
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)]
      
      // Centers
      const cx = (t.p[0].x + t.p[1].x + t.p[2].x) / 3
      const cy = (t.p[0].y + t.p[1].y + t.p[2].y) / 3

      // Assign to one of 3 animation groups randomly
      const group = Math.floor(Math.random() * 3)

      return { ...t, clipPath, color, cx, cy, group }
    })
  }, []) // Fixed mesh

  return (
    <div className="shatter-overlay-root" style={{ animationDelay: `${delay}ms` }}>
      {triangles.map((t) => {
        // Only render/animate if this shard belongs to the current active group
        if (t.group !== activeGroup) return null

        // Diagonal Sweep (Left-Bottom to Top-Right) for EVERY group
        // cx (0..100) + (100 - cy) (0..100) -> Range 0..200
        const animDelay = (t.cx + (100 - t.cy)) * 0.012 

        return (
            <div
            key={`${t.i}-${activeGroup}`} // Re-key to restart animation
            className="shard-poly"
            style={{
                clipPath: t.clipPath,
                background: `linear-gradient(135deg, ${t.color} 20%, transparent 90%)`,
                animationDelay: `${animDelay}s`,
            }}
            />
        )
      })}
      <style jsx>{`
        .shatter-overlay-root {
          position: absolute;
          inset: 0;
          z-index: 35;
          pointer-events: none;
          mix-blend-mode: color-dodge;
          opacity: 0;
          animation: rootFadeIn 100ms ease-out forwards;
        }

        .shard-poly {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          mix-blend-mode: overlay; /* Stronger blend for white pops */
          opacity: 0; /* Invisible by default */
          animation: shardFlash 2s ease-out forwards;
        }

        @keyframes rootFadeIn {
          to { opacity: 1; }
        }

        @keyframes shardFlash {
          0% { opacity: 0; transform: scale(1); }
          10% { opacity: 0.85; transform: scale(1); filter: brightness(1.5); } /* Bright flash */
          60% { opacity: 0; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default ShatterfoilOverlay
