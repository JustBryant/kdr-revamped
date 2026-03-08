import React, { useState } from 'react'
import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from 'next/router'
import ThemeToggle from './ThemeToggle'
import Link from 'next/link'

type Props = {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const isEmbedded = Boolean((router.query as any)?.embed)
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false)

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

              <Link href="/profile" className="block h-9 w-9 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-all">
                {session.user?.image ? (
                  <img 
                    src={session.user.image} 
                    alt={session.user.name || "Profile"} 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
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
