import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import ManageUsersRoute from './components/ManageUsersRoute'
import EncodeRoute from './components/EncodeRoute'
import HomeRedirect from './pages/HomeRedirect'
import { AuthProvider } from './lib/AuthContext'
import { SectorProvider } from './lib/SectorContext'
import { SettingsProvider } from './lib/SettingsContext'

// The Super Admin section: account management and system-wide views.
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import ManageUsers from './pages/superadmin/ManageUsers'
import ViewRecords from './pages/superadmin/ViewRecords'
import AuditLogs from './pages/superadmin/AuditLogs'
import SystemSettings from './pages/superadmin/SystemSettings'

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
      <SectorProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />

            {/* Login lands here; it waits for the profile, then forwards. */}
            <Route path="/home" element={<HomeRedirect />} />
            {/* The per-role landing pages are retired: every account works
                in the app itself, and the sidebar offers only the tabs that
                account can use. These paths still resolve so old links and
                bookmarks do not dead-end. */}
            <Route path="/role-select" element={<Navigate to="/sectors" replace />} />
            <Route path="/coming-soon" element={<Navigate to="/sectors" replace />} />
            <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
            {/* Shared: Super Admin runs every account, Admin runs their own
                Encoder/Viewer team. Both paths render the same page. */}
            <Route path="/super-admin/manage-users" element={<ManageUsersRoute><ManageUsers /></ManageUsersRoute>} />
            <Route path="/manage-users" element={<ManageUsersRoute><ManageUsers /></ManageUsersRoute>} />
            {/* Manage Admins is gone: Manage Users creates and retargets every
                account type, so a second page for one of them was redundant. */}
            <Route path="/super-admin/manage-admins" element={<Navigate to="/manage-users" replace />} />
            <Route path="/super-admin/records" element={<SuperAdminRoute><ViewRecords /></SuperAdminRoute>} />
            <Route path="/super-admin/audit-logs" element={<SuperAdminRoute><AuditLogs /></SuperAdminRoute>} />
            <Route path="/super-admin/settings" element={<SuperAdminRoute><SystemSettings /></SuperAdminRoute>} />
            <Route path="/admin" element={<Navigate to="/sectors" replace />} />
            <Route path="/supervisor" element={<Navigate to="/sectors" replace />} />
            <Route path="/encoder" element={<Navigate to="/sectors" replace />} />
            <Route path="/viewer" element={<Navigate to="/sectors" replace />} />
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
              <Route path="field-orders/add" element={<EncodeRoute><AddRecord /></EncodeRoute>} />
              <Route path="field-orders/edit/:id" element={<EncodeRoute><EditRecord /></EncodeRoute>} />
              <Route path="pending-records" element={<PendingRecords />} />
              <Route path="archived-work-orders" element={<ArchivedWorkOrders />} />
              <Route path="deletion-requests" element={<AdminRoute><DeletionRequests /></AdminRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SectorProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
