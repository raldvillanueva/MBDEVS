import { useAuth } from '../lib/AuthContext'
import EncoderAuditReports from './reports/EncoderAuditReports'
import AdminAuditReports from './reports/AdminAuditReports'
import SupervisorAuditReports from './reports/SupervisorAuditReports'
import SuperAdminAuditReports from './reports/SuperAdminAuditReports'

// Supervisor, Admin, and Super Admin are all `role = 'admin'` in the
// database (identical permissions) — account_type just decides which of
// their three own pages renders. Encoder and Viewer are both `role =
// 'staff'`; only Encoder gets the generate/submit UI (see
// EncoderAuditReports, which explains the limit to Viewer accounts).
export default function AuditReports() {
  const { role, accountType } = useAuth()

  if (role === 'admin') {
    if (accountType === 'supervisor') return <SupervisorAuditReports />
    if (accountType === 'super_admin') return <SuperAdminAuditReports />
    return <AdminAuditReports />
  }

  return <EncoderAuditReports />
}
