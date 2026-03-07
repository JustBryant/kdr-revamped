import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { signIn } from 'next-auth/react'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  // Password Strength Logic
  const getPasswordStrength = (pass: string) => {
    let strength = 0
    if (pass.length >= 8) strength += 1
    if (/[A-Z]/.test(pass)) strength += 1
    if (/[0-9]/.test(pass)) strength += 1
    return strength
  }

  const strength = getPasswordStrength(password)
  const strengthColor = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  const strengthText = ['Weak', 'Fair', 'Good', 'Strong']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Something went wrong')
      }

      setMessage(data.message)
      // Optional: Redirect to login after a few seconds
      // setTimeout(() => router.push('/auth/signin'), 5000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">Create an Account</h1>
        
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-100/10 border border-red-500 rounded">
            {error}
          </div>
        )}
        
        {message && (
          <div className="p-3 text-sm text-green-500 bg-green-100/10 border border-green-500 rounded">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex justify-between mb-1 text-xs">
                  <span>Strength: {strengthText[strength]}</span>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${strengthColor[strength]}`}
                    style={{ width: `${(strength / 3) * 100}%` }}
                  ></div>
                </div>
                <ul className="mt-2 text-xs text-gray-400 list-disc list-inside">
                  <li className={password.length >= 8 ? 'text-green-400' : ''}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-400' : ''}>At least one uppercase letter</li>
                  <li className={/[0-9]/.test(password) ? 'text-green-400' : ''}>At least one number</li>
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Register
          </button>
        </form>

        <div className="relative flex items-center py-5">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase">Or</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        <button
          onClick={() => signIn('discord', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 font-bold text-white bg-[#5865F2] rounded hover:bg-[#4752C4] transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 0-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 0-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
          </svg>
          Register with Discord
        </button>

        <div className="text-sm text-center">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-blue-400 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
