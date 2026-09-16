import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { pathForAccountType } from '../lib/rolePaths'

/**
 * Where login lands. The account type is only known once the profile has
 * loaded, so Login cannot decide the destination itself — it sends everyone
 * here and this waits, then forwards.
 */
export default function HomeRedirect() {
  const { session, accountType, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  return <Navigate to={pathForAccountType(accountType)} replace />
}
