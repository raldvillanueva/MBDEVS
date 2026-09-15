import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

/**
 * Gates the /super-admin pages. Requires a signed-in session AND super admin
 * standing — without this they were reachable by anyone with the URL, logged
 * in or not.
 *
 * While profiles.account_type is unset (audit_reports_setup.sql not yet run,
 * or an account not yet tagged) it falls back to role === 'admin', so the
 * pages stay reachable by real admins instead of locking everyone out mid
 * migration. Once an account carries an account_type, only 'super_admin'
 * passes — so this tightens itself as soon as the tagging happens.
 */
export default function SuperAdminRoute({ children }) {
  const { session, profile, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  const tagged = profile?.account_type != null
  const allowed = tagged ? profile.account_type === 'super_admin' : role === 'admin'

  return allowed ? children : <Navigate to="/sectors" replace />
}
