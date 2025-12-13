import React, { useState } from 'react'
import { useSession, signIn, signOut } from "next-auth/react"
import ThemeToggle from './ThemeToggle'
import Link from 'next/link'

type Props = {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  const { data: session } = useSession()
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-900">
        <Link href="/" className="text-xl font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          KDR Revamped
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div>
            {session ? (
              <div className="flex items-center gap-4">
                {session.user?.role === 'ADMIN' && (
                  <div className="relative">
                    <button 
                      onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
                      className="text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                    >
                      Admin
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isAdminDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700">
                        <Link href="/admin/formats" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setIsAdminDropdownOpen(false)}>
                          Edit KDR
                        </Link>
                        <Link href="/admin/users" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setIsAdminDropdownOpen(false)}>
                          View Users
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                <a href="/user/profile" className="block h-10 w-10 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600 hover:opacity-80 transition-opacity">
                  {session.user?.image ? (
                    <img 
                      src={session.user.image} 
                      alt={session.user.name || "Profile"} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </a>
                <button
                  onClick={() => signOut()}
                  className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="p-6 flex-grow">{children}</div>
      <footer className="p-4 border-t border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 text-sm bg-white dark:bg-gray-900">
        <small>Prototype — KDR</small>
      </footer>
    </div>
  )
}
