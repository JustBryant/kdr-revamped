import React from 'react'
import { CLASS_IMAGE_BASE_URL, getClassImageUrl } from '../../lib/constants'

interface ClassImageProps {
  /** Filename stored in DB, e.g. classname.png or just classname */
  image?: string | null
  /** Optional object that may contain `image` property */
  classObj?: any
  alt?: string
  className?: string
  style?: React.CSSProperties
  /** Fallback image URL */
  fallbackSrc?: string
}

const DEFAULT_FALLBACK = `${CLASS_IMAGE_BASE_URL}/default.png`

export default function ClassImage({ image, classObj, alt = 'Class', className = '', style, fallbackSrc = DEFAULT_FALLBACK }: ClassImageProps) {
  const filename: string | null = image || (classObj && (classObj.image || classObj.img)) || null

  // If filename appears to already include an extension, treat it as a raw filename.
  // Otherwise, treat it as a class key and use getClassImageUrl which appends .png.
  const src = filename
    ? (filename.includes('.') ? `${CLASS_IMAGE_BASE_URL}/${filename}` : (getClassImageUrl(filename) || fallbackSrc))
    : (fallbackSrc || '')

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={(e: any) => {
        try {
          if (fallbackSrc && e.currentTarget.src !== fallbackSrc) e.currentTarget.src = fallbackSrc
          else e.currentTarget.style.display = 'none'
        } catch (ex) {}
      }}
    />
  )
}

export function getClassImageUrlLocal(filename?: string | null) {
  if (!filename) return null
  return filename.includes('.') ? `${CLASS_IMAGE_BASE_URL}/${filename}` : getClassImageUrl(filename)
}
