import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useSector } from '../lib/SectorContext'

export default function Layout() {
  const { sector } = useSector()
  const location = useLocation()

  if (!sector && !location.pathname.startsWith('/sectors')) {
    return <Navigate to="/sectors" replace />
  }

  // MBDEVCO is a summary-only sector: keep it on the dashboard so the
  // data-entry pages cannot be reached by typing a URL.
  if (
    sector === 'mbdevco' &&
    location.pathname !== '/summary' &&
    !location.pathname.startsWith('/sectors')
  ) {
    return <Navigate to="/summary" replace />
  }

  return (
    <div className="flex h-screen bg-[#F4F4F4]">
      <Sidebar />
      {/* py-8 (64px total) is assumed by pages that size themselves with
          calc(100vh - 64px) — change the vertical padding and those break. */}
      <main className="ml-64 flex-1 overflow-auto px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
