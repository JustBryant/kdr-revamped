import React from 'react'

type Props = {
  onClick?: (e?: any) => void
  loading?: boolean
  disabled?: boolean
}

export default function StartButton({ onClick, loading, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      aria-label="Start Shop"
      className={
        "px-6 py-3 rounded-full text-white font-semibold shadow-lg transform transition hover:-translate-y-0.5 " +
        (disabled || loading
          ? 'bg-gray-600/60 cursor-not-allowed'
          : 'bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600')
      }
    >
      {loading ? 'Starting…' : 'Start Shop'}
    </button>
  )
}
