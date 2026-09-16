// Structure describing each role's landing page, mirrored 1:1 from the
// role-management flowchart. This file has no auth logic — it is display
// data used by RoleDashboard.jsx to render each role's page.
//
// Each role has "branches" (matching the flowchart's vertical chains).
// Each branch is a list of steps, top to bottom, exactly as drawn in the
// flowchart. A step is either a plain string label, or an object
// { label, to } — when `to` is set, clicking the step navigates straight
// to that real, already-built route instead of the "coming soon" page.

export const ROLE_DASHBOARDS = {
  'super-admin': {
    label: 'Super Admin',
    dashboardTitle: 'Super Admin Dashboard',
    badgeClass: 'bg-blue-500 text-white',
    branches: [
      { steps: [{ label: 'Manage Users', to: '/super-admin/manage-users' }, 'Create/Disable Users'] },
      { steps: [{ label: 'View Records', to: '/super-admin/records' }, 'view reports'] },
      { steps: [{ label: 'View Audit Logs', to: '/super-admin/audit-logs' }, 'Export reports'] },
      { steps: [{ label: 'Manage Admins', to: '/super-admin/manage-admins' }, 'Create Admin'] },
      { steps: [{ label: 'System Settings', to: '/super-admin/settings' }, 'Configure System'] },
    ],
  },

  admin: {
    label: 'Admin',
    dashboardTitle: 'Admin Dashboard',
    badgeClass: 'bg-amber-500 text-[#2E2E2E]',
    branches: [
      { steps: ['Manage Users', 'Create Encoder/Viewer'] },
      { steps: [{ label: 'view reports', to: '/summary' }, 'Edit reports', 'Delete Records'] },
      { steps: [{ label: 'Manage records', to: '/field-orders' }, 'Delete Records', 'Export records'] },
      { steps: [{ label: 'approve records', to: '/deletion-requests' }, 'Export records'] },
    ],
  },

  supervisor: {
    label: 'Supervisor',
    dashboardTitle: 'Supervisor Dashboard',
    badgeClass: 'bg-emerald-600 text-white',
    note: 'Supervisor can add, edit, archive and approve \u2014 everything except permanently deleting a record, which stays with Admin.',
    branches: [
      { steps: [{ label: 'Approve Records', to: '/deletion-requests' }, 'Edit users record (limited)'] },
      { steps: [{ label: 'view reports', to: '/summary' }, { label: 'View Audit Logs', to: '/reports' }] },
      { steps: [{ label: 'Export reports', to: '/field-orders' }] },
    ],
  },

  // Encoder = the app you already have. Sectors -> Field Orders/Add Record
  // already implement "Encode Data", "Edit own records" and "view reports".
  // These steps link straight into that real, already-built flow.
  encoder: {
    label: 'Encoder',
    dashboardTitle: 'Encoder Dashboard',
    badgeClass: 'bg-purple-600 text-white',
    note: 'This role\u2019s functionality already exists in the app. These boxes link to the real pages — since there\u2019s no logged-in session yet, they\u2019ll bounce you to the login screen. That\u2019s expected.',
    branches: [
      { steps: [{ label: 'Encode Data', to: '/sectors' }] },
      { steps: [{ label: 'Edit own records', to: '/field-orders' }] },
      { steps: [{ label: 'view reports (limited)', to: '/summary' }] },
    ],
  },

  // Viewer = the existing read-only ("staff") mode already built into the
  // app (see Sidebar.jsx View-Only Mode banner, isAdmin checks in
  // FieldOrders/PendingRecords/ArchivedWorkOrders/RecordForm).
  viewer: {
    label: 'Viewer',
    dashboardTitle: 'Viewer Dashboard',
    badgeClass: 'bg-slate-500 text-white',
    note: 'This role\u2019s functionality already exists in the app as the read-only ("staff") mode. These boxes link to the real pages — since there\u2019s no logged-in session yet, they\u2019ll bounce you to the login screen. That\u2019s expected.',
    branches: [
      { steps: [{ label: 'view records/reports', to: '/field-orders' }] },
      { steps: [{ label: 'view reports/records (limited)', to: '/summary' }] },
    ],
  },
}

export const ROLE_ORDER = ['super-admin', 'admin', 'supervisor', 'encoder', 'viewer']
