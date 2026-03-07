// Lazy-initialize Prisma instance (Refreshed schema #1)
import type { PrismaClient } from '@prisma/client'

type GlobalForPrisma = typeof globalThis & { __prisma_instance?: PrismaClient }

let _prismaProxy: any = null

function createPrismaInstance(): PrismaClient {
  // require here so heavy native/wasm files aren't loaded at module evaluation
  // time when bundlers compile client code.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client') as any
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaPg } = require('@prisma/adapter-pg')

  // Some env loaders may include surrounding quotes in the value ("..." or '...').
  // Strip them so downstream libs (pg) receive a valid connection string.
  let connectionString = process.env.DATABASE_URL || ''
  if ((connectionString.startsWith('"') && connectionString.endsWith('"')) || (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
    connectionString = connectionString.slice(1, -1)
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  const globalForPrisma = global as GlobalForPrisma

  if (!globalForPrisma.__prisma_instance) {
    globalForPrisma.__prisma_instance = new PrismaClient({ adapter })
    if (process.env.NODE_ENV !== 'production') {
      // attach to global for HMR safety
      globalForPrisma.__prisma_instance = globalForPrisma.__prisma_instance
    }
  }

  return globalForPrisma.__prisma_instance!
}

// Proxy that lazily initializes Prisma on first access.
_prismaProxy = new Proxy({}, {
  get(_, prop) {
    const real = (global as GlobalForPrisma).__prisma_instance || createPrismaInstance()
    // @ts-ignore
    return real[prop]
  },
  apply(_, thisArg, argArray) {
    const real = (global as GlobalForPrisma).__prisma_instance || createPrismaInstance()
    // @ts-ignore
    return (real as any).apply(thisArg, argArray)
  }
})

export const prisma = _prismaProxy as unknown as PrismaClient
