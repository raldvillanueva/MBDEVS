import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Sectors from './pages/Sectors'
import SectorPlaceholder from './pages/SectorPlaceholder'
import Dashboard from './pages/Dashboard'
import FieldOrders from './pages/FieldOrders'
import PendingRecords from './pages/PendingRecords'
import ArchivedWorkOrders from './pages/ArchivedWorkOrders'
import AddRecord from './pages/AddRecord'
import EditRecord from './pages/EditRecord'
import DeletionRequests from './pages/DeletionRequests'
import AuditReports from './pages/AuditReports'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AuthProvider } from './lib/AuthContext'
import { SectorProvider } from './lib/SectorContext'

// Role landing pages — final production paths, but NOT wired to an auth
// guard yet since no accounts are tied to these roles. Encoder and Viewer
// link into the real, already-built pages below; the other three roles
// show "coming soon" placeholders until those features are built.
import RoleSelect from './pages/RoleSelect'
import RoleDashboard from './pages/RoleDashboard'
import ComingSoon from './pages/ComingSoon'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import ManageUsers from './pages/superadmin/ManageUsers'
import ManageAdmins from './pages/superadmin/ManageAdmins'
import ViewRecords from './pages/superadmin/ViewRecords'
import AuditLogs from './pages/superadmin/AuditLogs'
import SystemSettings from './pages/superadmin/SystemSettings'

export default function App() {
  return (
    <AuthProvider>
      <SectorProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />

            {/* Role landing pages — final production paths, no auth guard
                yet. No accounts are tied to these roles, so they're kept
                separate from the protected app below on purpose. When
                accounts exist, point the post-login redirect (see
                AuthContext/Login) at these same paths. */}
            <Route path="/role-select" element={<RoleSelect />} />
            <Route path="/coming-soon" element={<ComingSoon />} />
            <Route path="/super-admin" element={<SuperAdminDashboard />} />
            <Route path="/super-admin/manage-users" element={<ManageUsers />} />
            <Route path="/super-admin/manage-admins" element={<ManageAdmins />} />
            <Route path="/super-admin/records" element={<ViewRecords />} />
            <Route path="/super-admin/audit-logs" element={<AuditLogs />} />
            <Route path="/super-admin/settings" element={<SystemSettings />} />
            <Route path="/admin" element={<RoleDashboard role="admin" />} />
            <Route path="/supervisor" element={<RoleDashboard role="supervisor" />} />
            <Route path="/encoder" element={<RoleDashboard role="encoder" />} />
            <Route path="/viewer" element={<RoleDashboard role="viewer" />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >

              <Route path="sectors" element={<Sectors />} />
              <Route path="sectors/:sector" element={<SectorPlaceholder />} />
              <Route path="summary" element={<Dashboard />} />
              <Route path="reports" element={<AuditReports />} />
              <Route path="field-orders" element={<FieldOrders />} />
              <Route path="field-orders/add" element={<AdminRoute><AddRecord /></AdminRoute>} />
              <Route path="field-orders/edit/:id" element={<AdminRoute><EditRecord /></AdminRoute>} />
              <Route path="pending-records" element={<PendingRecords />} />
              <Route path="archived-work-orders" element={<ArchivedWorkOrders />} />
              <Route path="deletion-requests" element={<AdminRoute><DeletionRequests /></AdminRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SectorProvider>
    </AuthProvider>
  )
}
