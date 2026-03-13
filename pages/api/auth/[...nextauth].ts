import NextAuth, { NextAuthOptions } from "next-auth"
import DiscordProvider from "next-auth/providers/discord"
import { prisma } from "../../../lib/prisma"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord") {
        const discordProfile = profile as any;
        // Prefer global_name (Display Name) over username (Handle)
        const displayName = discordProfile.global_name || discordProfile.username || user.name;

        // Find user by email or neonId
        const email = user.email
        if (!email) return false

        // Link Discord account to existing local user or create new one
        await prisma.user.upsert({
          where: { email },
          update: {
            name: displayName,
            // SECURITY: Never overwrite local image with Discord image
          },
          create: {
            email,
            name: displayName,
            image: "https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/89631139.jpg", 
            emailVerified: new Date(),
          },
        })
      }
      return true
    },
    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        const u = user as any
        token.role = u.role
        // Only set token image if it's explicitly in the DB user object
        token.image = u.image || null
        token.name = u.name || null
        token.neonId = u.neonId || null
      }
      
      if (account?.provider === "discord") {
        token.discordId = (user as any).id
        // SECURITY: Always fetch the latest image from OUR database
        // and ignore the image that Discord provided in the 'user' object
        const dbUser = await prisma.user.findUnique({
          where: { email: (user as any).email! },
          select: { image: true }
        })
        token.image = dbUser?.image || null
      }

      if (trigger === "update" && session?.user) {
        token.image = (session.user as any).image || null
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
        ;(session.user as any).discordId = (token as any).discordId as string
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
