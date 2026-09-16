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
import SuperAdminRoute from './components/SuperAdminRoute'
import RoleRoute from './components/RoleRoute'
import ManageUsersRoute from './components/ManageUsersRoute'
import HomeRedirect from './pages/HomeRedirect'
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

            {/* Role landing pages. Each is gated to the account type that
                owns it; Super Admin may view any of them. Login sends
                everyone to /home, which forwards by account type. */}
            <Route path="/home" element={<HomeRedirect />} />
            <Route path="/role-select" element={<RoleSelect />} />
            <Route path="/coming-soon" element={<ComingSoon />} />
            <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
            {/* Shared: Super Admin runs every account, Admin runs their own
                Encoder/Viewer team. Both paths render the same page. */}
            <Route path="/super-admin/manage-users" element={<ManageUsersRoute><ManageUsers /></ManageUsersRoute>} />
            <Route path="/manage-users" element={<ManageUsersRoute><ManageUsers /></ManageUsersRoute>} />
            <Route path="/super-admin/manage-admins" element={<SuperAdminRoute><ManageAdmins /></SuperAdminRoute>} />
            <Route path="/super-admin/records" element={<SuperAdminRoute><ViewRecords /></SuperAdminRoute>} />
            <Route path="/super-admin/audit-logs" element={<SuperAdminRoute><AuditLogs /></SuperAdminRoute>} />
            <Route path="/super-admin/settings" element={<SuperAdminRoute><SystemSettings /></SuperAdminRoute>} />
            <Route path="/admin" element={<RoleRoute allow="admin"><RoleDashboard role="admin" /></RoleRoute>} />
            <Route path="/supervisor" element={<RoleRoute allow="supervisor"><RoleDashboard role="supervisor" /></RoleRoute>} />
            <Route path="/encoder" element={<RoleRoute allow="encoder"><RoleDashboard role="encoder" /></RoleRoute>} />
            <Route path="/viewer" element={<RoleRoute allow="viewer"><RoleDashboard role="viewer" /></RoleRoute>} />
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
