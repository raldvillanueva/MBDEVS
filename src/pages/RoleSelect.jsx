import { useNavigate } from 'react-router-dom'
import RoleDashboardSidebar from '../components/RoleDashboardSidebar'
import { ROLE_DASHBOARDS, ROLE_ORDER } from '../data/roleDashboards'

export default function RoleSelect() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen bg-[#F4F4F4]">
      <RoleDashboardSidebar />

      <main className="ml-64 flex-1 px-8 py-8">
        <h1 className="text-2xl font-bold text-[#2E2E2E]">Role Landing Pages</h1>
        <p className="mt-1 mb-8 text-sm text-slate-500">
          Pick a role to preview its dashboard. None of these are connected to login yet.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_ORDER.map((key) => {
            const config = ROLE_DASHBOARDS[key]
            return (
              <button
                key={key}
                onClick={() => navigate(`/${key}`)}
                className="rounded-2xl border border-[#D9D9D9] bg-white p-6 text-left shadow-sm transition hover:shadow-md hover:border-[#D89B00]"
              >
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${config.badgeClass}`}
                >
                  {config.label}
                </span>
                <p className="mt-3 text-sm text-slate-500">
                  {config.branches.length} sections · {config.branches.reduce((n, b) => n + b.steps.length, 0)} actions
                </p>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
