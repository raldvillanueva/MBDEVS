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
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AuthProvider } from './lib/AuthContext'
import { SectorProvider } from './lib/SectorContext'

export default function App() {
  return (
    <AuthProvider>
      <SectorProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
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
