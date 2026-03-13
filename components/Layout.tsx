import React, { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from 'next/router'
import ThemeToggle from './ThemeToggle'
import Link from 'next/link'
import useCollaborative from './collab/useCollaborative'
import axios from 'axios'
import ShatterfoilOverlay from './ShatterfoilOverlay'
import UltraRareGlow from './UltraRareGlow'

type Props = {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  const { data: session } = useSession()
  const [detailedUser, setDetailedUser] = useState<any>(null)
  const router = useRouter()
  const isEmbedded = Boolean((router.query as any)?.embed)
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false)

  // Global presence: join the lobby room from every page on the site
  const { setUserId } = useCollaborative('kdr-lobby', () => {
    // We don't need to do anything on update here, just being in the room
    // is enough to announce presence to everyone else.
  })

  // Fetch detailed user data for global cosmetics (e.g. Nav Icon)
  const fetchDetailedUser = async () => {
    if (session?.user) {
      axios.get('/api/user/me').then(res => {
        setDetailedUser(res.data.user || res.data)
      }).catch(err => console.error("Error fetching detailed user for nav:", err))
    }
  }

  useEffect(() => {
    fetchDetailedUser()
  }, [session, router.asPath]) // Refresh on session change or navigation

  // Listen for global refresh events (e.g. after equipping in shop)
  useEffect(() => {
    window.addEventListener('user:stats-refresh', fetchDetailedUser)
    return () => window.removeEventListener('user:stats-refresh', fetchDetailedUser)
  }, [session])

  useEffect(() => {
    // If we have a session, we want to set the userId for presence
    // We use the email or ID to identify the user globally
    if (session?.user?.email || (session?.user as any)?.id) {
       setUserId(session.user.email || (session.user as any).id)
    }
  }, [session, setUserId])

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0b0f19] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {!isEmbedded && (
        <header className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#0b0f19] sticky top-0 z-[100] backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center transition-transform active:scale-95">
            <img 
              src="/images/KDRLogo.png" 
              alt="KDR Logo" 
              className="h-14 w-auto object-contain group-hover:scale-105 transition-transform duration-300 pointer-events-none drop-shadow-lg"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/classes" className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-blue-500 transition-colors">
              Classes
            </Link>
            <Link href="/kdr" className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-blue-500 transition-colors">
              Tournaments
            </Link>
            <Link href="/leaderboard" className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-blue-500 transition-colors">
              Rankings
            </Link>
            <Link href="/shop/cosmetics" className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-blue-500 transition-colors">
              Shop
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-2"></div>

          {session ? (
            <div className="flex items-center gap-4">
              {session.user?.role === 'ADMIN' && (
                <div className="relative">
                  <button 
                    onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
                    className="text-xs font-black uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                  >
                    Admin
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isAdminDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isAdminDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsAdminDropdownOpen(false)}></div>
                      <div className="absolute right-0 mt-4 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl py-2 z-20 border border-gray-100 dark:border-gray-700 overflow-hidden ring-1 ring-black ring-opacity-5 animate-fadeIn">
                        <Link href="/admin/formats" className="block px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => setIsAdminDropdownOpen(false)}>
                          Edit KDR
                        </Link>
                        <Link href="/admin/users" className="block px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => setIsAdminDropdownOpen(false)}>
                          View Users
                        </Link>
                        <Link href="/admin/patch-notes" className="block px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => setIsAdminDropdownOpen(false)}>
                          Manage Patches
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}

              <Link href="/profile" className="block h-10 w-10 relative group">
                {/* Navigation Profile Icon - Single Layer Replacement */}
                <div className={`h-full w-full rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-all relative z-10 ${detailedUser?.border?.imageUrl ? 'p-0.5 bg-gradient-to-br from-blue-400 to-purple-500' : ''}`}>
                  <img 
                    src={detailedUser?.profileIcon?.imageUrl || session.user?.image || '/images/default-avatar.png'} 
                    alt={session.user?.name || "Profile"} 
                    className="h-full w-full object-cover relative z-10"
                  />
                </div>

                {/* Frame Overlay in Nav */}
                {detailedUser?.frame?.imageUrl && (
                   <img src={detailedUser.frame.imageUrl} className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] object-contain z-20 pointer-events-none" alt="" />
                )}

                {/* Icon Effect Layer in Nav */}
                {detailedUser?.iconEffect?.metadata && (
                  <div className="absolute inset-0 pointer-events-none rounded-full overflow-hidden z-30">
                    {(detailedUser.iconEffect.metadata as any).variant === 'SHATTERFOIL' && (
                        <div className="absolute inset-0 z-50">
                            <ShatterfoilOverlay />
                        </div>
                    )}
                    {(detailedUser.iconEffect.metadata as any).variant === 'UR_GLOW' && (
                        <UltraRareGlow />
                    )}
                  </div>
                )}
              </Link>
              
              <button
                onClick={() => signOut()}
                className="text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn()}
              className="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
            >
              Sign in
            </button>
          )}
        </div>
        </header>
      )}
      <div className="p-6 flex-grow">{children}</div>
      <footer className="p-4 border-t border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 text-sm bg-white dark:bg-gray-900">
        <small>Prototype — KDR</small>
      </footer>
    </div>
  )
}
