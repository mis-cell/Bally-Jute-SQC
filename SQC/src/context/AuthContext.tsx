import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { postgresService } from '../services/postgresService';
import {
  maintenanceService,
  MaintenanceStatus,
  DEFAULT_MAINTENANCE_MESSAGE,
} from '../services/maintenanceService';
import { MaintenanceModal } from '../components/MaintenanceModal';
import { hashPassword } from '../utils/crypto';
import { INITIAL_USERS } from '../constants/initialData';

function isAdminUserRole(role?: string): boolean {
  return role === 'Super Admin' || role === 'SuperAdmin' || role === 'Admin';
}

interface AuthContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  login: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; message?: string; maintenanceMode?: boolean }>;
  logout: () => void;
  allUsers: UserProfile[];
  refreshUsers: () => void;
  saveUser: (user: UserProfile, newPassword?: string) => Promise<{ success: boolean; message?: string }>;
  deleteUser: (userId: string) => boolean;
  canAccessForm: (formCode: string) => boolean;
  permittedForms: string[];
  isRole: (role: UserRole) => boolean;
  hasPermission: (action: 'CREATE' | 'EDIT_DRAFT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'MANAGE_MASTERS' | 'SYSTEM_CONFIG') => boolean;
  switchUser: (userId: string) => void;
  maintenanceStatus: MaintenanceStatus;
  toggleMaintenanceMode: (
    enabled: boolean,
    message: string
  ) => Promise<{ success: boolean; status: MaintenanceStatus; notice: string }>;
  refreshMaintenanceStatus: () => Promise<MaintenanceStatus>;
  showMaintenanceModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const existing = authService.getCurrentUser();
    if (existing) return existing;
    return INITIAL_USERS[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!authService.getCurrentUser();
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => dataService.getUsers());

  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(() =>
    maintenanceService.getCached()
  );
  const [adminBypassedOverlay, setAdminBypassedOverlay] = useState<boolean>(false);
  const [wasForcedLogout, setWasForcedLogout] = useState<boolean>(false);

  const applyMaintenanceStatus = useCallback(
    (next: MaintenanceStatus, isAuthNow: boolean, activeUser: UserProfile) => {
      setMaintenanceStatus(next);
      if (next.enabled) {
        if (isAuthNow && !isAdminUserRole(activeUser?.role)) {
          authService.logout();
          setIsAuthenticated(false);
          setWasForcedLogout(true);
          setAdminBypassedOverlay(false);
        }
      } else {
        setWasForcedLogout(false);
        setAdminBypassedOverlay(false);
      }
    },
    []
  );

  // Enforce immediately on mount / auth changes if Maintenance Mode is active for a non-admin session
  useEffect(() => {
    if (maintenanceStatus.enabled && isAuthenticated && !isAdminUserRole(currentUser?.role)) {
      authService.logout();
      setIsAuthenticated(false);
      setWasForcedLogout(true);
      setAdminBypassedOverlay(false);
    }
  }, [maintenanceStatus.enabled, isAuthenticated, currentUser?.role]);

  const refreshMaintenanceStatus = useCallback(async (): Promise<MaintenanceStatus> => {
    const latest = await maintenanceService.fetchStatus();
    applyMaintenanceStatus(latest, isAuthenticated, currentUser);
    return latest;
  }, [applyMaintenanceStatus, isAuthenticated, currentUser]);

  // Poll Maintenance Mode continuously + react to cross-tab & 503 forced logout events
  useEffect(() => {
    refreshMaintenanceStatus();

    const timer = setInterval(() => {
      refreshMaintenanceStatus();
    }, 4000);

    const onForcedLogout = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const nextStatus: MaintenanceStatus = {
        ...maintenanceService.getCached(),
        enabled: true,
        message: detail?.message || DEFAULT_MAINTENANCE_MESSAGE,
      };
      if (isAuthenticated && !isAdminUserRole(currentUser?.role)) {
        authService.logout();
        setIsAuthenticated(false);
      }
      setMaintenanceStatus(nextStatus);
      setWasForcedLogout(true);
      setAdminBypassedOverlay(false);
    };

    const onMaintenanceChanged = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as MaintenanceStatus | undefined;
      const next = detail || maintenanceService.getCached();
      applyMaintenanceStatus(next, isAuthenticated, currentUser);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bj_sqc_maintenance_mode') {
        applyMaintenanceStatus(maintenanceService.getCached(), isAuthenticated, currentUser);
      }
    };

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshMaintenanceStatus();
      }
    };

    window.addEventListener('bj_sqc_maintenance_forced_logout', onForcedLogout);
    window.addEventListener('bj_sqc_maintenance_changed', onMaintenanceChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener('bj_sqc_maintenance_forced_logout', onForcedLogout);
      window.removeEventListener('bj_sqc_maintenance_changed', onMaintenanceChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [refreshMaintenanceStatus, applyMaintenanceStatus, isAuthenticated, currentUser]);

  // Listen to data service events for real-time user updates
  useEffect(() => {
    const handleSync = () => {
      const users = dataService.getUsers();
      setAllUsers(users);
      const active = authService.getCurrentUser();
      if (active) {
        const found = users.find(u => u.id === active.id);
        if (found) setCurrentUser(found);
      }
    };

    window.addEventListener('bj_sqc_data_synced', handleSync);
    return () => window.removeEventListener('bj_sqc_data_synced', handleSync);
  }, []);

  const refreshUsers = () => {
    const users = dataService.getUsers();
    setAllUsers(users);
  };

  const login = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; message?: string; maintenanceMode?: boolean }> => {
    const res = await authService.login(identifier, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      setWasForcedLogout(false);
      setAdminBypassedOverlay(false);
      refreshUsers();
      return { success: true };
    }
    if (res.maintenanceMode) {
      setMaintenanceStatus({
        ...maintenanceService.getCached(),
        enabled: true,
        message: res.message || DEFAULT_MAINTENANCE_MESSAGE,
      });
      setAdminBypassedOverlay(false);
    }
    return {
      success: false,
      maintenanceMode: res.maintenanceMode,
      message: res.message || 'Login failed.',
    };
  };

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  const toggleMaintenanceMode = async (enabled: boolean, message: string) => {
    const res = await maintenanceService.setMaintenanceMode(enabled, message, currentUser);
    if (res.success) {
      setMaintenanceStatus(res.status);
      if (!enabled) {
        setWasForcedLogout(false);
        setAdminBypassedOverlay(false);
      }
    }
    return res;
  };

  const canAccessForm = (formCode: string): boolean => {
    return authService.canAccessForm(currentUser, formCode);
  };

  const permittedForms = authService.getPermittedForms(currentUser);

  const saveUser = async (user: UserProfile, newPassword?: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const toSave = { ...user };
      if (newPassword && newPassword.trim()) {
        toSave.passwordHash = await hashPassword(newPassword.trim());
      }
      dataService.saveUser(toSave, currentUser, true);
      refreshUsers();

      // Sync directly to PostgreSQL backend
      if (postgresService.isSyncEnabled()) {
        const pgRes = await postgresService.syncUserToPostgres(toSave, newPassword);
        if (!pgRes.success) {
          return { success: false, message: pgRes.message };
        }
      }

      if (currentUser && currentUser.id === toSave.id) {
        setCurrentUser(toSave);
        localStorage.setItem('sqc_auth_current_user', JSON.stringify(toSave));
      }

      dataService.logAudit({
        userId: currentUser?.id || 'SYSTEM',
        userEmail: currentUser?.email || 'SYSTEM',
        userRole: currentUser?.role || 'Admin',
        action: 'UPDATE',
        module: 'User Management',
        recordId: toSave.id,
        details: `Saved account for user "${toSave.displayName}" [${toSave.role}]. Form access count: ${toSave.permittedForms?.length ?? 'All'}`,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to save user.' };
    }
  };

  const deleteUser = (userId: string): boolean => {
    const target = allUsers.find(u => u.id === userId);
    if (!target) return false;

    dataService.deleteUser(userId, currentUser);
    refreshUsers();

    dataService.logAudit({
      userId: currentUser?.id || 'SYSTEM',
      userEmail: currentUser?.email || 'SYSTEM',
      userRole: currentUser?.role || 'Admin',
      action: 'DELETE',
      module: 'User Management',
      recordId: userId,
      details: `Deleted user "${target.displayName}".`,
    });

    return true;
  };

  const switchUser = (userId: string) => {
    const target = allUsers.find(u => u.id === userId);
    if (target) {
      if (maintenanceStatus.enabled && !isAdminUserRole(target.role)) {
        return;
      }
      setCurrentUser(target);
      setIsAuthenticated(true);
      localStorage.setItem('sqc_auth_current_user', JSON.stringify(target));
      dataService.setCurrentUser(target);
    }
  };

  const isRole = (role: UserRole) => currentUser?.role === role;

  const hasPermission = (action: 'CREATE' | 'EDIT_DRAFT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'MANAGE_MASTERS' | 'SYSTEM_CONFIG') => {
    const role = currentUser?.role as string;
    if (role === 'Super Admin' || role === 'SuperAdmin') return true;

    switch (action) {
      case 'CREATE':
      case 'EDIT_DRAFT':
      case 'SUBMIT':
        return role === 'Admin' || role === 'SQC Inspector / User' || role === 'Inspector';
      case 'APPROVE':
      case 'REJECT':
      case 'RETURN':
        return role === 'Admin' || role === 'HOD / Approver' || role === 'HOD';
      case 'MANAGE_MASTERS':
        return role === 'Admin';
      case 'SYSTEM_CONFIG':
        return false;
      default:
        return false;
    }
  };

  const isAdminSession = isAuthenticated && isAdminUserRole(currentUser?.role);
  const maintenancePopupVisible =
    maintenanceStatus.enabled && !isAdminSession && !adminBypassedOverlay;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        logout,
        allUsers,
        refreshUsers,
        saveUser,
        deleteUser,
        canAccessForm,
        permittedForms,
        isRole,
        hasPermission,
        switchUser,
        maintenanceStatus,
        toggleMaintenanceMode,
        refreshMaintenanceStatus,
        showMaintenanceModal: () => setAdminBypassedOverlay(false),
      }}
    >
      {children}
      <MaintenanceModal
        isOpen={maintenancePopupVisible}
        message={maintenanceStatus.message}
        activatedBy={maintenanceStatus.activatedBy}
        activatedAt={maintenanceStatus.activatedAt}
        wasForcedLogout={wasForcedLogout}
        onRefreshStatus={async () => {
          await refreshMaintenanceStatus();
        }}
        onAdminBypassToLogin={() => setAdminBypassedOverlay(true)}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
