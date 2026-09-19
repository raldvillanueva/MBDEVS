import { useNavigate } from 'react-router-dom'
import { Building2, MapPin } from 'lucide-react'
import { useSector } from '../lib/SectorContext'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import logo from '../assets/mb-logo.jpg'

const SECTORS = [
  { label: 'Rizal', key: 'rizal', to: '/summary', icon: MapPin },
  { label: 'Manila', key: 'manila', to: '/summary', icon: MapPin },
  { label: 'Pasig', key: 'pasig', to: '/summary', icon: MapPin },
  { label: 'Balintawak', key: 'balintawak', to: '/summary', icon: MapPin },
]

function SectorBox({ label, onClick, icon: Icon, wide }) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-3 rounded-xl bg-white border border-slate-200 shadow-sm p-6 hover:border-[#D89B00] hover:shadow-md transition-all ${wide ? 'w-56' : 'w-44'}`}
    >
      <span className="rounded-full bg-[#D89B00]/10 p-4 text-[#D89B00] group-hover:bg-[#D89B00] group-hover:text-white transition-colors">
        <Icon size={26} />
      </span>
      <span className="font-semibold text-slate-800 text-base">{label}</span>
    </button>
  )
}

export default function Sectors() {
  const navigate = useNavigate()
  const { setSector, clearSector } = useSector()
  const { profile, session } = useAuth()

  // Unset (or unrecognized) means unrestricted — the account can still
  // pick from every sector, same as before this field existed.
  const assignedSector = profile?.sector
  const visibleSectors = assignedSector
    ? SECTORS.filter(s => s.key === assignedSector)
    : SECTORS

  function selectSector(key, to) {
    setSector(key)
    navigate(to)
  }

  async function handleSignOut() {
    clearSector()
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    // Full screen rather than h-full: this page is no longer inside the app
    // layout, so there is no sized parent to fill.
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#F4F4F4] px-4 py-10">
      <div className="flex flex-col items-center">
        <img src={logo} alt="MB Development" className="w-16 h-16 rounded-xl object-cover shadow-lg mb-3" />
        <h1 className="text-2xl font-bold text-[#2E2E2E]">Select a Sector</h1>
        <div className="w-12 h-1 bg-[#D89B00] rounded-full mt-2 mb-2" />
        <p className="text-slate-500 text-sm">
          {assignedSector
            ? 'Your account is set up for one sector'
            : 'Choose a sector to view its field order data'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {visibleSectors.map(s => (
          <SectorBox key={s.key} label={s.label} icon={s.icon} onClick={() => selectSector(s.key, s.to)} />
        ))}
      </div>

      <SectorBox label="MBDEVCO" icon={Building2} onClick={() => selectSector('mbdevco', '/summary')} wide />

      {/* Without the sidebar there is no other control on this page, so
          signing out has to be reachable from here. */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{profile?.full_name || session?.user?.email}</span>
        <span aria-hidden>·</span>
        <button onClick={handleSignOut} className="font-medium text-slate-500 hover:text-[#D89B00] hover:underline">
          Sign Out
        </button>
      </div>
    </div>
  )
}
