import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { pathForAccountType } from '../lib/rolePaths'

/**
 * Managing accounts is Super Admin work. This is not only a UI decision:
 * profiles_update is gated on is_super_admin(), so an Admin reaching the
 * page would have been refused by the database on every change anyway.
 * Refusing at the door is clearer than letting them in to fail.
 */
export default function ManageUsersRoute({ children }) {
  const { session, accountType, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  return accountType === 'super_admin'
    ? children
    : <Navigate to={pathForAccountType(accountType)} replace />
}
