let ioredisClient: any = null
let upstashClient: any = null

const useUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

function getIoredisClient() {
  if (!process.env.REDIS_URL) return null
  if (!ioredisClient) {
    // lazy-require to avoid import-time failures when package isn't installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require('ioredis')
    ioredisClient = new IORedis(process.env.REDIS_URL)
    ioredisClient.on('error', (e: any) => console.error('Redis error', e))
  }
  return ioredisClient
}

async function getUpstashClient() {
  if (!useUpstash) return null
  if (!upstashClient) {
    const mod = await import('@upstash/redis')
    const { Redis } = mod as any
    upstashClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  }
  return upstashClient
}

export async function getJson(key: string) {
  try {
    if (useUpstash) {
      const c = await getUpstashClient()
      if (!c) return null
      const v = await c.get(key)
      return v ? (typeof v === 'string' ? JSON.parse(v) : v) : null
    }
    const c = getIoredisClient()
    if (!c) return null
    const v = await c.get(key)
    if (!v) return null
    try { return JSON.parse(v) } catch (e) { return null }
  } catch (e) {
    console.error('getJson failed', e)
    return null
  }
}

export async function setJson(key: string, value: any, ttlSeconds = 3) {
  try {
    if (useUpstash) {
      const c = await getUpstashClient()
      if (!c) return
      const s = typeof value === 'string' ? value : JSON.stringify(value)
      if (ttlSeconds > 0) await c.set(key, s, { ex: ttlSeconds })
      else await c.set(key, s)
      return
    }
    const c = getIoredisClient()
    if (!c) return
    const s = JSON.stringify(value)
    if (ttlSeconds > 0) await c.set(key, s, 'EX', ttlSeconds)
    else await c.set(key, s)
  } catch (e) {
    console.error('setJson failed', e)
  }
}

export async function delKey(key: string) {
  try {
    if (useUpstash) {
      const c = await getUpstashClient()
      if (!c) return
      await c.del(key)
      return
    }
    const c = getIoredisClient()
    if (!c) return
    await c.del(key)
  } catch (e) {
    console.error('delKey failed', e)
  }
}

export default getIoredisClient

export async function invalidateKdrCache(kdrId: string) {
  try {
    if (useUpstash) {
      const c = await getUpstashClient()
      if (!c) return
      try {
        // Attempt to find keys containing the kdrId. Upstash supports KEYS but it's acceptable for small scale.
        const keys: string[] = await c.keys(`*${kdrId}*`)
        if (keys && keys.length) {
          for (const k of keys) {
            try { await c.del(k) } catch (e) { console.warn('Failed to del upstash key', k, e) }
          }
        }
      } catch (e) {
        console.warn('Upstash invalidate fallback failed, attempting direct known keys', e)
        // Fallback: delete common keys
        try { await c.del(`kdr:resp:${kdrId}`) } catch (e) {}
        try { await c.del(`kdr:resp:${kdrId}:classview`) } catch (e) {}
      }
      return
    }

    const c = getIoredisClient()
    if (!c) return
    // Use SCAN to find matching keys to avoid blocking Redis with KEYS.
    const stream = c.scanStream({ match: `kdr:resp:*${kdrId}*`, count: 100 })
    const toDel: string[] = []
    for await (const keys of stream) {
      if (keys && keys.length) toDel.push(...keys as string[])
    }
    if (toDel.length) {
      while (toDel.length) {
        const chunk = toDel.splice(0, 100)
        await c.del(...chunk)
      }
    }
  } catch (e) {
    console.error('invalidateKdrCache failed', e)
  }
}
