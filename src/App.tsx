import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';

import { DashboardPage } from './pages/DashboardPage';
import { InspectionsListPage } from './pages/InspectionsListPage';
import { InspectionFormPage } from './pages/InspectionFormPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { MastersPage } from './pages/MastersPage';
import { UsersPage } from './pages/UsersPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inspections" element={<InspectionsListPage />} />
            <Route path="/new-inspection" element={<InspectionFormPage />} />
            <Route path="/inspection/:id" element={<InspectionFormPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/reports" element={<ReportsPage />} />

            {/* Masters */}
            <Route path="/masters/departments" element={<MastersPage tab="departments" />} />
            <Route path="/masters/sections" element={<MastersPage tab="sections" />} />
            <Route path="/masters/machines" element={<MastersPage tab="machines" />} />
            <Route path="/masters/looms" element={<MastersPage tab="looms" />} />
            <Route path="/masters/qualities" element={<MastersPage tab="qualities" />} />
            <Route path="/masters/specs" element={<MastersPage tab="qualities" />} />
            <Route path="/masters/standards" element={<MastersPage tab="standards" />} />

            {/* Admin */}
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/audit-logs" element={<AuditTrailPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
