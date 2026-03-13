import React from 'react'

type Props = {
  shopTopMessage: any
  shopkeeperTyped: string
  player?: any
}

const TopMessage: React.FC<Props> = ({ shopTopMessage, shopkeeperTyped, player }) => {
  const isDialogue = !!(shopTopMessage && shopTopMessage.type === 'dialogue')
  if (!isDialogue) return null
  const label = shopTopMessage?.label || (player?.shopState?.shopkeeper?.name || 'Shopkeeper')
  return (
    <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#1f2937', color: '#e6eef8' }}>
      <strong>{label}:</strong> {shopkeeperTyped || ''}
    </div>
  )
}

export default TopMessage
