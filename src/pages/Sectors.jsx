import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, MapPin } from 'lucide-react'
import { useSector } from '../lib/SectorContext'
import { allowedSectors, isSectorRestricted } from '../lib/sectorTables'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import logo from '../assets/mb-logo.jpg'

const SECTORS = [
  { label: 'Rizal', key: 'rizal', to: '/summary', icon: MapPin },
  { label: 'Manila', key: 'manila', to: '/summary', icon: MapPin },
  { label: 'Pasig', key: 'pasig', to: '/summary', icon: MapPin },
  { label: 'Balintawak', key: 'balintawak', to: '/summary', icon: MapPin },
  { label: 'AMI', key: 'ami', to: '/summary', icon: MapPin },
]

// A fixed width so every box matches whether it is on a full row or a
// wrapped one. Slightly narrower than before, which is what lets five sit
// on a single line instead of four with one underneath.
function SectorBox({ label, onClick, icon: Icon, wide }) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#D89B00] hover:shadow-md ${wide ? 'w-52' : 'w-40'}`}
    >
      <span className="rounded-full bg-[#D89B00]/10 p-3.5 text-[#D89B00] transition-colors group-hover:bg-[#D89B00] group-hover:text-white">
        <Icon size={24} />
      </span>
      <span className="text-base font-semibold text-slate-800">{label}</span>
    </button>
  )
}

export default function Sectors() {
  const navigate = useNavigate()
  const { setSector, clearSector } = useSector()
  const { profile, session } = useAuth()

  // No list means unrestricted, so the picker offers everything — the
  // same as before accounts could be limited at all.
  const allowed = allowedSectors(profile)
  const restricted = isSectorRestricted(profile)
  const visibleSectors = SECTORS.filter(s => allowed.includes(s.key))

  // Exactly one sector is a question with one answer, so answer it and
  // move on. Two or more is a real choice and still gets the picker.
  const onlySector = visibleSectors.length === 1 ? visibleSectors[0].key : null

  // replace: true keeps this out of the history, or Back from the
  // dashboard would land here and bounce straight forward again.
  useEffect(() => {
    if (onlySector) {
      setSector(onlySector)
      navigate('/summary', { replace: true })
    }
  }, [onlySector, setSector, navigate])

  // Render nothing rather than a flash of the picker on the way past.
  if (onlySector) return null

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
          {restricted
            ? 'Choose from the sectors your account covers'
            : 'Choose a sector to view its field order data'}
        </p>
      </div>

      {/* Wrapping flex rather than a fixed column count: the row fits as
          many sectors as the screen allows and stays centred, so adding a
          sixth needs no change here and none of them end up stranded
          alone on a second line. */}
      <div className="flex w-full max-w-5xl flex-wrap justify-center gap-4">
        {visibleSectors.map(s => (
          <SectorBox key={s.key} label={s.label} icon={s.icon} onClick={() => selectSector(s.key, s.to)} />
        ))}
      </div>

      {/* The rollup spans every sector, so it is not offered to an
          account that has been kept out of some of them. */}
      {!restricted && (
        <SectorBox label="MBDEVCO" icon={Building2} onClick={() => selectSector('mbdevco', '/summary')} wide />
      )}

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
