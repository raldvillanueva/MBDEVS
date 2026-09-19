import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useSector } from '../lib/SectorContext'
import { useAuth } from '../lib/AuthContext'

export default function Layout() {
  const { sector } = useSector()
  const { profile } = useAuth()
  const location = useLocation()

  // The sector picker lives outside Layout, so nothing here has to make an
  // exception for it: no sector means there is nothing to show.
  if (!sector) {
    return <Navigate to="/sectors" replace />
  }

  // An account restricted to one sector can still end up with a different
  // one in sessionStorage — an old tab left open after its assignment
  // changed, a bookmark, or someone typing the URL by hand. The picker only
  // offering the right box is a courtesy; this is what actually stops it,
  // checked on every route under here rather than once at sign-in.
  if (profile?.sector && sector !== profile.sector && sector !== 'mbdevco') {
    return <Navigate to="/sectors" replace />
  }

  // MBDEVCO is a summary-only sector: keep it on the dashboard/reports so
  // the data-entry pages cannot be reached by typing a URL.
  if (
    sector === 'mbdevco' &&
    location.pathname !== '/summary' &&
    location.pathname !== '/reports'
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
