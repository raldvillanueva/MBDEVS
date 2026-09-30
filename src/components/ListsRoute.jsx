import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

/**
 * Dropdown Lists: Admin and Super Admin. The database enforces the same
 * rule (can_edit_lists() in dropdown_lists_and_filters_setup.sql), so this
 * only keeps everyone else from landing on a page that would refuse them.
 */
export default function ListsRoute({ children }) {
  const { session, accountType, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  return accountType === 'admin' || accountType === 'super_admin'
    ? children
    : <Navigate to="/field-orders" replace />
}
