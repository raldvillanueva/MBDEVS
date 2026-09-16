import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { pathForAccountType } from '../lib/rolePaths'

/**
 * Manage Users is shared: a Super Admin runs every account, an Admin runs
 * their own Encoder/Viewer team. Which of the two you are is decided inside
 * the page — this only settles whether you get in at all.
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

  const allowed = accountType === 'super_admin' || accountType === 'admin'
  return allowed ? children : <Navigate to={pathForAccountType(accountType)} replace />
}
