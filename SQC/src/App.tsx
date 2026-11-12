import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InspectionsListPage } from './pages/InspectionsListPage';
import { InspectionFormPage } from './pages/InspectionFormPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { MastersPage } from './pages/MastersPage';
import { UsersPage } from './pages/UsersPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { SettingsPage } from './pages/SettingsPage';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <DashboardPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/inspections"
            element={
              <ProtectedLayout>
                <InspectionsListPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/new-inspection"
            element={
              <ProtectedLayout>
                <InspectionFormPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/inspection/:id"
            element={
              <ProtectedLayout>
                <InspectionFormPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/approvals"
            element={
              <ProtectedLayout>
                <ApprovalsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedLayout>
                <ReportsPage />
              </ProtectedLayout>
            }
          />

          {/* Masters */}
          <Route
            path="/masters/departments"
            element={
              <ProtectedLayout>
                <MastersPage tab="departments" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/sections"
            element={
              <ProtectedLayout>
                <MastersPage tab="sections" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/machines"
            element={
              <ProtectedLayout>
                <MastersPage tab="machines" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/looms"
            element={
              <ProtectedLayout>
                <MastersPage tab="looms" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/qualities"
            element={
              <ProtectedLayout>
                <MastersPage tab="qualities" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/specs"
            element={
              <ProtectedLayout>
                <MastersPage tab="qualities" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/standards"
            element={
              <ProtectedLayout>
                <MastersPage tab="standards" />
              </ProtectedLayout>
            }
          />

          {/* Admin */}
          <Route
            path="/admin/users"
            element={
              <ProtectedLayout>
                <UsersPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedLayout>
                <AuditTrailPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedLayout>
                <SettingsPage />
              </ProtectedLayout>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
