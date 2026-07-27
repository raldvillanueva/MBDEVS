import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useSector } from '../lib/SectorContext'

export default function Layout() {
  const { sector } = useSector()
  const location = useLocation()

  if (!sector && !location.pathname.startsWith('/sectors')) {
    return <Navigate to="/sectors" replace />
  }

  return (
    <div className="flex h-screen bg-[#F4F4F4]">
      <Sidebar />
      <main className="ml-64 flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
