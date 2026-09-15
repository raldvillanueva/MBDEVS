import { Construction } from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'

export default function ManageAdmins() {
  return (
    <SuperAdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E2E2E]">Manage Admins</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create new Admin accounts.
          </p>
        </div>
        <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Super Admin
        </span>
      </div>

      <div className="flex max-w-3xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <Construction size={36} className="text-slate-300" />
        <p className="font-semibold text-slate-600">Not built yet</p>
        <p className="max-w-sm text-sm text-slate-500">
          This page will let a Super Admin create Admin accounts, matching
          the "Manage Admins → Create Admin" branch of the role flowchart.
        </p>
      </div>
    </SuperAdminLayout>
  )
}
