import React from 'react'

type Props = {
  onStart: () => void
  disabled?: boolean
}

const StartShopButton: React.FC<Props> = ({ onStart, disabled }) => (
  <div className="mb-4 flex justify-end">
    <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={onStart} disabled={disabled}>Start Shop</button>
  </div>
)

export default StartShopButton
