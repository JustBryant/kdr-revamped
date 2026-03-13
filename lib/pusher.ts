import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

const sanitizeChannelName = (channel: string) => {
  if (!channel) return channel
  // Replace colon (:) and other potentially invalid characters with hyphens
  // Allow characters that Pusher accepts: alphanumeric, _ - = @ , . ;
  let safe = channel.replace(/:/g, '-')
  safe = safe.replace(/[^A-Za-z0-9_\-=@,.;]/g, '-')
  return safe
}

export const triggerPusher = async (channel: string, event: string, data: any) => {
  try {
    const safeChannel = sanitizeChannelName(channel)
    if (safeChannel !== channel) {
      try { console.debug('triggerPusher: sanitizing channel', channel, '->', safeChannel) } catch (e) {}
    }
    await pusher.trigger(safeChannel, event, data)
  } catch (error) {
    console.error('Pusher trigger error:', error)
  }
}

export default pusher
