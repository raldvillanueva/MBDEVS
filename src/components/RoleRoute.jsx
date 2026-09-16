import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { pathForAccountType } from '../lib/rolePaths'

/**
 * Gates a role landing page to the account that owns it. Without this any
 * signed-in user could open /supervisor and work a role they were never
 * given.
 *
 * Super Admin passes everywhere — it is the account that oversees the rest,
 * so being unable to view their dashboards would be perverse.
 *
 * Someone on the wrong role page is sent to their own rather than bounced to
 * the login screen: they are signed in, just in the wrong place.
 */
export default function RoleRoute({ allow, children }) {
  const { session, accountType, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  const allowed = accountType === allow || accountType === 'super_admin'
  return allowed ? children : <Navigate to={pathForAccountType(accountType)} replace />
}
