import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AppModule } from './types';

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
import { ProfilePage } from './pages/ProfilePage';

const MODULE_HOME_ROUTES: Array<{ module: AppModule; path: string; label: string }> = [
  { module: 'DASHBOARD', path: '/', label: 'Floor Dashboard' },
  { module: 'INSPECTIONS', path: '/inspections', label: 'Inspection Records' },
  { module: 'APPROVALS', path: '/approvals', label: 'Approvals Workflow' },
  { module: 'REPORTS', path: '/reports', label: 'Reports & Analytics' },
  { module: 'MASTERS', path: '/masters/departments', label: 'Master Data' },
  { module: 'USERS', path: '/admin/users', label: 'Users & Form Permissions' },
];

const AccessDeniedScreen: React.FC<{ title?: string; message?: string }> = ({
  title = 'Access Restricted (403)',
  message = 'Your account does not have permission to open this module or resource.',
}) => {
  const { permittedModules, canAccessModule } = useAuth();
  const navigate = useNavigate();

  const firstAllowed = MODULE_HOME_ROUTES.find(r => canAccessModule(r.module));

  return (
    <div className="bg-[#FBF6E8] rounded-2xl p-8 border border-[#C6BA96] max-w-lg mx-auto my-12 text-center shadow-sm space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E3DAB6] border border-[#C6BA96] text-[#4B5420] flex items-center justify-center">
        <ShieldAlert size={28} />
      </div>
      <div>
        <h2 className="text-base font-bold text-[#3B2311]">{title}</h2>
        <p className="text-xs text-[#5B4735] mt-1.5 leading-relaxed">{message}</p>
        {permittedModules.length === 0 && (
          <p className="text-[11px] text-[#6B5B2E] font-semibold mt-2">
            Your account currently has no assigned modules. Contact an Administrator to grant access.
          </p>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
        {firstAllowed && (
          <button
            type="button"
            onClick={() => navigate(firstAllowed.path, { replace: true })}
            className="px-4 py-2 rounded-lg bg-[#4B5420] hover:bg-[#3F471A] text-[#FAF6EA] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Go to {firstAllowed.label}</span>
            <ArrowRight size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/profile', { replace: true })}
          className="px-4 py-2 rounded-lg border border-[#C6BA96] bg-[#F4ECD2] hover:bg-[#E3DAB6] text-[#4C5324] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <User size={14} />
          <span>My Profile &amp; Password</span>
        </button>
      </div>
    </div>
  );
};

const ProtectedLayout: React.FC<{
  children: React.ReactNode;
  requiredModule?: AppModule;
  requiredAnyModules?: AppModule[];
  adminOnly?: boolean;
}> = ({ children, requiredModule, requiredAnyModules, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, canAccessModule } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return (
      <AppLayout>
        <AccessDeniedScreen
          title="Administrator Access Only (403)"
          message="This administration module is restricted to authorized Admin accounts."
        />
      </AppLayout>
    );
  }

  if (requiredModule && !canAccessModule(requiredModule)) {
    return (
      <AppLayout>
        <AccessDeniedScreen />
      </AppLayout>
    );
  }

  if (requiredAnyModules && requiredAnyModules.length > 0) {
    const allowed = isAdmin || requiredAnyModules.some(m => canAccessModule(m));
    if (!allowed) {
      return (
        <AppLayout>
          <AccessDeniedScreen />
        </AppLayout>
      );
    }
  }

  return <AppLayout>{children}</AppLayout>;
};

const LandingRoute: React.FC = () => {
  const { isAuthenticated, canAccessModule } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (canAccessModule('DASHBOARD')) {
    return (
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    );
  }
  const nextRoute = MODULE_HOME_ROUTES.find(r => r.module !== 'DASHBOARD' && canAccessModule(r.module));
  if (nextRoute) {
    return <Navigate to={nextRoute.path} replace />;
  }
  return (
    <AppLayout>
      <ProfilePage />
    </AppLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Self-Service Profile Route (All authenticated users) */}
          <Route
            path="/profile"
            element={
              <ProtectedLayout>
                <ProfilePage />
              </ProtectedLayout>
            }
          />

          {/* Protected Application Routes */}
          <Route path="/" element={<LandingRoute />} />

          <Route
            path="/inspections"
            element={
              <ProtectedLayout requiredModule="INSPECTIONS">
                <InspectionsListPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/new-inspection"
            element={
              <ProtectedLayout requiredModule="INSPECTIONS">
                <InspectionFormPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/inspection/:id"
            element={
              <ProtectedLayout requiredAnyModules={['INSPECTIONS', 'APPROVALS', 'DASHBOARD']}>
                <InspectionFormPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/approvals"
            element={
              <ProtectedLayout requiredModule="APPROVALS">
                <ApprovalsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedLayout requiredModule="REPORTS">
                <ReportsPage />
              </ProtectedLayout>
            }
          />

          {/* Masters */}
          <Route
            path="/masters/departments"
            element={
              <ProtectedLayout requiredModule="MASTERS">
                <MastersPage tab="departments" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/sections"
            element={
              <ProtectedLayout requiredModule="MASTERS">
                <MastersPage tab="sections" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/machines"
            element={
              <ProtectedLayout requiredModule="MASTERS">
                <MastersPage tab="machines" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/looms"
            element={
              <ProtectedLayout requiredModule="MASTERS">
                <MastersPage tab="looms" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/qualities"
            element={
              <ProtectedLayout requiredModule="MASTERS">
                <MastersPage tab="qualities" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/specs"
            element={
              <ProtectedLayout requiredModule="MASTERS">
                <MastersPage tab="qualities" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/masters/standards"
            element={
              <ProtectedLayout requiredModule="MASTERS">
                <MastersPage tab="standards" />
              </ProtectedLayout>
            }
          />

          {/* Strictly Admin-Only Administration Routes */}
          <Route
            path="/admin/users"
            element={
              <ProtectedLayout requiredModule="USERS" adminOnly>
                <UsersPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedLayout requiredModule="AUDIT_LOGS" adminOnly>
                <AuditTrailPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedLayout requiredModule="SETTINGS" adminOnly>
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
