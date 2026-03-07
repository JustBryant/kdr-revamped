import React, { useState } from 'react'

export default function LocalIcon({ src, alt, className, fallback }: { src: string, alt?: string, className?: string, fallback?: React.ReactNode }) {
  const [ok, setOk] = useState(true)
  return ok ? (
    // use native img; if it fails, hide it and render fallback
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt || ''} className={className} onError={() => setOk(false)} />
  ) : (
    <div className={className} aria-hidden>
      {fallback || <div className="w-full h-full bg-gray-300" />}
    </div>
  )
}
