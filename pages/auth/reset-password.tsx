import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function ResetPassword() {
  const router = useRouter()
  const { token } = router.query
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!token) {
      setError('Missing reset token')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.message || 'Something went wrong')

      setMessage(data.message)
      // Redirect to login after success
      setTimeout(() => router.push('/auth/signin'), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">Set New Password</h1>
        
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
            <label htmlFor="password" className="block text-sm font-medium">
              New Password
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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="text-sm text-center">
          <Link href="/auth/signin" className="text-blue-400 hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
