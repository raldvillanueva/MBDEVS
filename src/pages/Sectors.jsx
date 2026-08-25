import { useNavigate } from 'react-router-dom'
import { Building2, MapPin } from 'lucide-react'
import { useSector } from '../lib/SectorContext'
import logo from '../assets/mb-logo.jpg'

const SECTORS = [
  { label: 'Rizal', key: 'rizal', to: '/summary', icon: MapPin },
  { label: 'Manila', key: 'manila', to: '/sectors/manila', icon: MapPin },
  { label: 'Pasig', key: 'pasig', to: '/sectors/pasig', icon: MapPin },
  { label: 'Balintawak', key: 'balintawak', to: '/sectors/balintawak', icon: MapPin },
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
  const { setSector } = useSector()

  function selectSector(key, to) {
    setSector(key)
    navigate(to)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10">
      <div className="flex flex-col items-center">
        <img src={logo} alt="MB Development" className="w-16 h-16 rounded-xl object-cover shadow-lg mb-3" />
        <h1 className="text-2xl font-bold text-[#2E2E2E]">Select a Sector</h1>
        <div className="w-12 h-1 bg-[#D89B00] rounded-full mt-2 mb-2" />
        <p className="text-slate-500 text-sm">Choose a sector to view its field order data</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {SECTORS.map(s => (
          <SectorBox key={s.key} label={s.label} icon={s.icon} onClick={() => selectSector(s.key, s.to)} />
        ))}
      </div>

      <SectorBox label="MBDEVCO" icon={Building2} onClick={() => selectSector('mbdevco', '/summary')} wide />
    </div>
  )
}
