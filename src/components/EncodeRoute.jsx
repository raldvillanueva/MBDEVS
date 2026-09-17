import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

/**
 * Guards the record form. Encoding is the Encoder's whole job, so this cannot
 * be an admin-only gate — it asks the same question the database does:
 * can_encode(), which is everyone except Viewer.
 */
export default function EncodeRoute({ children }) {
  const { session, canEncode, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  return canEncode ? children : <Navigate to="/field-orders" replace />
}
