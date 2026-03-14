import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

interface User {
  id: string
  name: string
  email: string
  image: string | null
  role: 'USER' | 'ADMIN' | 'MODERATOR'
  duelistPoints: number
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [bulkDPAmount, setBulkDPAmount] = useState(100)
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchUsers = async (search?: string) => {
    try {
      const url = new URL('/api/admin/users', window.location.origin)
      if (search) url.searchParams.append('search', search)
      
      const res = await fetch(url.toString(), { credentials: 'same-origin' })
      if (res.status === 403) {
        // Not authorized
        router.push('/')
        return
      }
      
      if (!res.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await res.json()
      
      if (Array.isArray(data)) {
        setUsers(data)
      } else {
        console.error('Received invalid data format:', data)
        setUsers([])
      }
    } catch (error) {
      console.error('Failed to fetch users', error)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to update role')
        return
      }

      // Use authoritative response from server to update local state
      const updated = await res.json()
      if (updated && updated.id) {
        setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, role: updated.role } : u))
      } else {
        // Fallback: refetch the list to ensure UI matches DB
        fetchUsers(searchQuery)
      }
    } catch (error) {
      console.error('Failed to update role', error)
      alert('An error occurred')
    }
  }

  const handleDPChange = async (userId: string, newDP: number) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, duelistPoints: newDP }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to update DP')
        return
      }

      setUsers(users.map(u => u.id === userId ? { ...u, duelistPoints: newDP } : u))
    } catch (error) {
      console.error('Failed to update DP', error)
      alert('An error occurred')
    }
  }

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(users.map(u => u.id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) {
      console.log('Zero users selected, aborting.');
      return;
    }
    
    console.log('--- STARTING BULK DELETE CLICK HANDLER ---');
    console.log('Selected Count:', selectedUserIds.length);
    
    // REMOVED window.confirm because it's being blocked by Firefox
    console.log('Bypassing browser confirm. Proceeding with delete...');

    console.log('Setting loading state...');
    setIsBulkDeleting(true);
    
    try {
      const payload = { userIds: selectedUserIds };
      console.log('Request Payload Prepared:', payload);
      console.log('Sending DELETE request to /api/admin/bulk-users...');

      const res = await fetch('/api/admin/bulk-users', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      console.log('FETCH COMPLETED. Status:', res.status, res.statusText);

      if (!res.ok) {
        let errorData = { error: 'Unknown server error' };
        try {
          errorData = await res.json();
        } catch (e) {
          console.error('Failed to parse error JSON response');
        }
        console.error('SERVER RETURNED ERROR:', errorData);
        alert(errorData.error || 'Failed to delete users');
        setIsBulkDeleting(false);
        return;
      }

      const result = await res.json();
      console.log('SERVER RETURNED SUCCESS:', result);

      setUsers(prevUsers => prevUsers.filter(u => !selectedUserIds.includes(u.id)));
      setSelectedUserIds([]);
      alert(`Successfully deleted ${selectedUserIds.length} users.`);
    } catch (error) {
      console.error('FATAL NETWORK/CLIENT ERROR:', error);
      alert('A network error occurred. Check console.');
    } finally {
      console.log('Finishing Bulk Delete Process...');
      setIsBulkDeleting(false);
    }
  };

  const handleBulkRoleChange = async (role: string) => {
    if (selectedUserIds.length === 0) return
    try {
      const res = await fetch('/api/admin/bulk-users', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds, role }),
      })

      if (!res.ok) throw new Error('Bulk update failed')

      setUsers(users.map(u => selectedUserIds.includes(u.id) ? { ...u, role: role as any } : u))
      alert(`Updated ${selectedUserIds.length} users to ${role}.`)
    } catch (error) {
      alert('Bulk role update failed')
    }
  }

  const handleBulkDPChange = async (action: 'add' | 'remove', amount: number) => {
    if (selectedUserIds.length === 0) return
    try {
      const res = await fetch('/api/admin/bulk-users', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userIds: selectedUserIds, 
          dpAction: action, 
          dpAmount: amount 
        }),
      })

      if (!res.ok) throw new Error('Bulk DP update failed')

      // Since the API returns a number of updated records but doesn't return the new values in bulk easily via raw SQL update, refetch to be accurate.
      fetchUsers(searchQuery);
      alert(`Successfully ${action === 'add' ? 'added' : 'removed'} ${amount} DP to ${selectedUserIds.length} users.`)
    } catch (error) {
      alert('Bulk DP update failed')
    }
  }

  const requestDelete = (userId: string) => {
    setPendingDeleteUserId(userId)
  }

  const cancelDelete = () => setPendingDeleteUserId(null)

  const confirmDelete = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to delete user')
        return
      }
      // remove from list
      setUsers(users.filter(u => u.id !== userId))
      setPendingDeleteUserId(null)
    } catch (e) {
      console.error('Failed to delete user', e)
      alert('Failed to delete user')
    }
  }

  return (
    <>
      <Head>
        <title>User Management | KDR Revamped</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search users by name or email..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white shadow-sm focus:ring-blue-500 focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mb-8 flex justify-between items-center bg-gray-50 dark:bg-gray-900 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Tools ({users.length} Users)</h1>
          <div className="flex gap-4">
            {selectedUserIds.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected: {selectedUserIds.length}</span>
                
                {/* Role Bulk Select */}
                <select 
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white"
                  onChange={(e) => {
                    if (e.target.value) handleBulkRoleChange(e.target.value)
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Change Role</option>
                  <option value="USER">To User</option>
                  <option value="MODERATOR">To Moderator</option>
                  <option value="ADMIN">To Admin</option>
                </select>

                {/* DP Bulk Input and Buttons */}
                <div className="flex items-center gap-1">
                   <input
                    type="number"
                    className="w-20 px-1 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-white"
                    value={bulkDPAmount}
                    onChange={(e) => setBulkDPAmount(parseInt(e.target.value) || 0)}
                   />
                   <button 
                    onClick={() => handleBulkDPChange('add', bulkDPAmount)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                   >
                    Add DP
                   </button>
                   <button 
                    onClick={() => handleBulkDPChange('remove', bulkDPAmount)}
                    className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs"
                   >
                    Sub DP
                   </button>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleBulkDelete();
                  }}
                  disabled={isBulkDeleting}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm"
                >
                  {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                </button>
              </div>
            )}
            <Link 
              href="/admin/classes"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Back
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.length === users.length && users.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">DP</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Loading users...</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id} className={selectedUserIds.includes(user.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {user.image ? (
                          <img className="h-10 w-10 rounded-full" src={user.image} alt="" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold">
                            {user.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-300">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      value={user.duelistPoints || 0}
                      onChange={(e) => handleDPChange(user.id, parseInt(e.target.value) || 0)}
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${user.role === 'ADMIN' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                        user.role === 'MODERATOR' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="mt-1 block py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white"
                      >
                        <option value="USER">User</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      {pendingDeleteUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => confirmDelete(user.id)} className="px-2 py-1 bg-red-700 text-white rounded text-sm">Confirm Delete</button>
                          <button onClick={cancelDelete} className="px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded text-sm">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => requestDelete(user.id)} className="ml-2 px-2 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
        </div>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    }
  }

  // We could check role here, but doing it in the component/API allows for a "Not Authorized" message instead of just a redirect, or we can redirect to home.
  if (session.user?.role !== 'ADMIN') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  return {
    props: { session },
  }
}
