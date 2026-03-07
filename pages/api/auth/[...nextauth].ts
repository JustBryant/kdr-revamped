import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "../../../lib/prisma"
const bcrypt = require('bcryptjs')
import * as argon2 from 'argon2'
import { Pool } from "pg"
import { findNeonUserByEmail } from '../../../lib/neonAuth'

const neonPool = new Pool({ connectionString: process.env.DATABASE_URL })

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email or Username", type: "text", placeholder: "you@example.com or username" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing username/email or password')
        }

        const identifier = (credentials.email || '').trim()

        // Try local user by email OR name (case-insensitive)
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: identifier, mode: 'insensitive' } },
              { name: { equals: identifier, mode: 'insensitive' } }
            ]
          }
        })

        // If local user exists and has a password, verify with bcrypt
        if (user && user.password) {
          const isValid = await bcrypt.compare(credentials.password, user.password)
          if (!isValid) throw new Error('Incorrect password')
          if (!user.emailVerified) throw new Error('Email not verified')
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            neonId: (user as any).neonId ?? undefined,
            image: user.image,
            role: user.role,
          }
        }

        // Fallback: check Neon `neon_auth.users` (if present) and verify with argon2.
        try {
          const row = await findNeonUserByEmail(neonPool, identifier)
          console.debug('neon fallback - row keys:', row ? Object.keys(row) : null)
          if (!row) throw new Error('Incorrect username or password')

          const hashKey = Object.keys(row).find(k => k.toLowerCase().includes('hash') || k.toLowerCase().includes('password')) as string
          const hashed = hashKey ? row[hashKey] : undefined
          console.debug('neon fallback - hashKey:', hashKey, 'hashed present:', !!hashed)
          if (!hashed) throw new Error('Account exists but no password set; try password reset')

          const verified = await argon2.verify(hashed, credentials.password).catch((err) => {
            console.debug('argon2.verify error', err && err.message)
            return false
          })
          console.debug('argon2 verified:', !!verified)
          if (!verified) throw new Error('Incorrect password')

          // Parse whatever raw meta column exists
          let meta: any = {}
          const rawKey = Object.keys(row).find(k => k.toLowerCase().includes('raw') || k.toLowerCase().includes('meta'))
          try {
            if (rawKey && row[rawKey]) meta = JSON.parse(row[rawKey])
          } catch (e) {
            meta = {}
          }

          // Upsert local user metadata (do NOT assume a `neonId` column exists in the schema)
          // Determine the best email to write: prefer the identifier if it looks like an email,
          // otherwise prefer the Neon row.email when available. If no email is available,
          // create/find the user by name to avoid writing a username into the email column.
          const looksLikeEmail = identifier.includes('@')
          const neonEmail = (row && (row.email || row.email_verified || row.email_verified_at)) ? row.email : undefined
          const emailToStore = looksLikeEmail ? identifier : (row && row.email ? row.email : undefined)

          // Prefer using Neon id when available to avoid duplicate local users
          const neonUserId = (row && (row.id || row.user_id || row.uid)) ? (row.id || row.user_id || row.uid) : undefined

          if (emailToStore) {
            const whereClause = neonUserId ? { neonId: neonUserId } : { email: emailToStore }
            user = await prisma.user.upsert({
              where: whereClause as any,
              update: ({
                neonId: neonUserId ?? undefined,
                emailVerified: (row.email_verified_at || row.email_verified) ? new Date(row.email_verified_at || row.email_verified) : undefined,
                name: meta.name ?? undefined,
                image: meta.image ?? undefined,
              } as any),
              create: ({
                neonId: neonUserId ?? undefined,
                email: emailToStore,
                name: meta.name ?? null,
                image: meta.image ?? null,
                emailVerified: (row.email_verified_at || row.email_verified) ? new Date(row.email_verified_at || row.email_verified) : undefined,
                password: null,
              } as any)
            })
          } else {
            // No email available: find or create by name so we don't store a username in the email column
            const lookupName = meta.name ?? identifier
            let local = await prisma.user.findFirst({ where: { name: { equals: lookupName, mode: 'insensitive' } } })
            if (local) {
              user = await prisma.user.update({
                where: { id: local.id },
                data: ({
                  neonId: neonUserId ?? (local as any).neonId ?? undefined,
                  name: meta.name ?? local.name ?? lookupName,
                  image: meta.image ?? local.image ?? undefined,
                  emailVerified: (row.email_verified_at || row.email_verified) ? new Date(row.email_verified_at || row.email_verified) : undefined,
                } as any)
              })
            } else {
              user = await prisma.user.create({
                data: ({
                  neonId: neonUserId ?? undefined,
                  name: meta.name ?? lookupName ?? null,
                  image: meta.image ?? null,
                  email: null,
                  emailVerified: (row.email_verified_at || row.email_verified) ? new Date(row.email_verified_at || row.email_verified) : undefined,
                  password: null,
                } as any)
              })
            }
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
          }
        } catch (e: any) {
          console.error('Neon auth lookup error', e)
          // Re-throw so NextAuth can surface our error messages to the client
          throw e instanceof Error ? e : new Error('Sign-in failed')
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const u = user as any
      if (u) {
        token.role = u.role
        token.image = u.image || undefined
        token.name = u.name || undefined
        token.neonId = u.neonId || undefined
      }
      if (trigger === "update" && session?.user) {
        token.image = (session.user as any).image || undefined
        token.name = (session.user as any).name || token.name
        token.neonId = (session.user as any).neonId || token.neonId
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        ;(session.user as any).role = (token as any).role
        ;(session.user as any).id = token.sub as string
        ;(session.user as any).image = (token as any).image as string
        ;(session.user as any).name = (token as any).name as string || (session.user as any).name
        ;(session.user as any).neonId = (token as any).neonId as string || (session.user as any).neonId
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    // error: '/auth/error', // Error code passed in query string as ?error=
    // verifyRequest: '/auth/verify-request', // (used for check email message)
    // newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out if not of interest)
  }
}

export default NextAuth(authOptions)
