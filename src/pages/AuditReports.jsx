import { useAuth } from '../lib/AuthContext'
import EncoderAuditReports from './reports/EncoderAuditReports'
import AdminAuditReports from './reports/AdminAuditReports'
import SuperAdminAuditReports from './reports/SuperAdminAuditReports'

// Admin and Super Admin are both `role = 'admin'` in the database
// (identical permissions) — account_type just decides which of their two
// pages renders. Encoder and Viewer are both `role = 'staff'`; only
// Encoder gets the generate/submit UI (see EncoderAuditReports, which
// explains the limit to Viewer accounts).
export default function AuditReports() {
  const { role, accountType } = useAuth()

  if (role === 'admin') {
    if (accountType === 'super_admin') return <SuperAdminAuditReports />
    return <AdminAuditReports />
  }

  return <EncoderAuditReports />
}
