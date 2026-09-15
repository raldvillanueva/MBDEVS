import { useNavigate, Navigate } from 'react-router-dom'
import { Info, ChevronRight } from 'lucide-react'
import RoleDashboardSidebar from '../components/RoleDashboardSidebar'
import { ROLE_DASHBOARDS } from '../data/roleDashboards'

export default function RoleDashboard({ role }) {
  const navigate = useNavigate()
  const config = ROLE_DASHBOARDS[role]

  if (!config) return <Navigate to="/role-select" replace />

  function handleItemClick(branch) {
    const step = branch.steps[0]
    // Object steps with a `to` point at a real, already-built page.
    if (typeof step === 'object' && step.to) {
      navigate(step.to)
      return
    }
    const label = typeof step === 'object' ? step.label : step
    const chainLabels = branch.steps.map((s) => (typeof s === 'object' ? s.label : s))
    navigate('/coming-soon', { state: { step: label, role: config.label, chain: chainLabels } })
  }

  return (
    <div className="flex min-h-screen bg-[#F4F4F4]">
      <RoleDashboardSidebar />

      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2E2E2E]">{config.dashboardTitle}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Landing page for the "{config.label}" branch of the role flowchart.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${config.badgeClass}`}
          >
            {config.label}
          </span>
        </div>

        {config.note && (
          <div className="mb-6 flex max-w-md items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>{config.note}</p>
          </div>
        )}

        <div className="flex max-w-md flex-col gap-3">
          {config.branches.map((branch, i) => {
            const step = branch.steps[0]
            const label = typeof step === 'object' ? step.label : step
            const isReal = typeof step === 'object' && !!step.to
            return (
              <button
                key={label}
                onClick={() => handleItemClick(branch)}
                title={isReal ? `Goes to the real ${step.to} page` : 'Not built yet'}
                className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left text-sm font-semibold
                  border-[#D89B00] bg-[#FFF6E5] text-[#2E2E2E] transition hover:bg-[#FCE9BE]
                  ${isReal ? 'ring-1 ring-emerald-400' : ''}
                `}
              >
                {label}
                <ChevronRight size={16} className="text-[#D89B00]" />
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
