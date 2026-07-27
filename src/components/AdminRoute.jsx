import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function AdminRoute({ children }) {
  const { role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return role === 'admin' ? children : <Navigate to="/field-orders" replace />
}
