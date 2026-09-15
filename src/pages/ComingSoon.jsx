import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import RoleDashboardSidebar from '../components/RoleDashboardSidebar'

export default function ComingSoon() {
  const { state } = useLocation()
  const navigate = useNavigate()

  const step = state?.step || 'This feature'
  const role = state?.role
  const chain = state?.chain || []

  return (
    <div className="flex min-h-screen bg-[#F4F4F4]">
      <RoleDashboardSidebar />

      <main className="ml-64 flex flex-1 flex-col items-center justify-center gap-4 px-8 py-8 text-center">
        <Construction size={40} className="text-slate-300" />
        <h1 className="text-xl font-bold text-slate-700">{step}</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Not built yet — this is a placeholder for the "{step}" action{role ? ` in the ${role} dashboard` : ''}.
        </p>

        {chain.length > 1 && (
          <p className="text-xs text-slate-400">Flow: {chain.join(' → ')}</p>
        )}

        <button
          onClick={() => navigate(-1)}
          className="mt-2 flex items-center gap-2 text-sm font-medium text-[#D89B00] hover:underline"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>
      </main>
    </div>
  )
}
