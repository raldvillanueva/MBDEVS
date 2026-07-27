import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'

const NAMES = {
  manila: 'Manila',
  pasig: 'Pasig',
  balintawak: 'Balintawak',
  mbdevco: 'MBDEVCO',
}

export default function SectorPlaceholder() {
  const { sector } = useParams()
  const navigate = useNavigate()
  const name = NAMES[sector] || sector

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <Construction size={40} className="text-slate-300" />
      <h1 className="text-xl font-bold text-slate-700">{name}</h1>
      <p className="text-slate-500 text-sm max-w-sm">
        No data available for this sector yet.
      </p>
      <button
        onClick={() => navigate('/sectors')}
        className="mt-2 flex items-center gap-2 text-sm font-medium text-[#D89B00] hover:underline"
      >
        <ArrowLeft size={16} />
        Back to sectors
      </button>
    </div>
  )
}
