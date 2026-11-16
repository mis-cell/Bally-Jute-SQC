import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppModule, InspectionRecord, UserProfile, UserRole } from '../types';
import { dataService } from '../services/dataService';
import { authService, isAdminRole } from '../services/authService';
import { postgresService } from '../services/postgresService';
import {
  maintenanceService,
  MaintenanceStatus,
  DEFAULT_MAINTENANCE_MESSAGE,
} from '../services/maintenanceService';
import { MaintenanceModal } from '../components/MaintenanceModal';

const GUEST_USER: UserProfile = {
  id: 'guest',
  email: '',
  username: 'guest',
  displayName: 'Unauthenticated',
  role: 'Viewer / Auditor',
  isActive: false,
  canEditEntries: false,
  canDeleteEntries: false,
  permittedModules: [],
  permittedForms: [],
  dataScope: 'OWN',
  createdAt: '',
};

interface AuthContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; message?: string; maintenanceMode?: boolean }>;
  logout: () => void;
  allUsers: UserProfile[];
  refreshUsers: () => Promise<void>;
  refreshSession: () => Promise<void>;
  saveUser: (user: UserProfile, newPassword?: string) => Promise<{ success: boolean; message?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message?: string }>;
  updateOwnProfile: (displayName: string, phone: string) => Promise<{ success: boolean; message?: string }>;
  changeOwnPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  adminResetUserPassword: (
    userId: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  permittedModules: AppModule[];
  canAccessModule: (moduleCode: AppModule) => boolean;
  canAccessForm: (formCode: string) => boolean;
  canViewRecord: (record: Partial<InspectionRecord> | null | undefined) => boolean;
  canEditSavedEntry: () => boolean;
  canDeleteSavedEntry: () => boolean;
  permittedForms: string[];
  isRole: (role: UserRole) => boolean;
  hasPermission: (
    action:
      | 'CREATE'
      | 'EDIT_DRAFT'
      | 'SUBMIT'
      | 'APPROVE'
      | 'REJECT'
      | 'RETURN'
      | 'MANAGE_MASTERS'
      | 'SYSTEM_CONFIG'
  ) => boolean;
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
    return authService.getCurrentUser() || GUEST_USER;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(authService.getCurrentUser());
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    const u = authService.getCurrentUser();
    return u && isAdminRole(u.role) ? dataService.getUsers() : [];
  });

  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(() =>
    maintenanceService.getCached()
  );
  const [adminBypassedOverlay, setAdminBypassedOverlay] = useState<boolean>(false);
  const [wasForcedLogout, setWasForcedLogout] = useState<boolean>(false);

  const performForcedSignOut = useCallback(() => {
    authService.logout();
    setCurrentUser(GUEST_USER);
    setIsAuthenticated(false);
    setAllUsers([]);
  }, []);

  const applyMaintenanceStatus = useCallback(
    (next: MaintenanceStatus, isAuthNow: boolean, activeUser: UserProfile) => {
      setMaintenanceStatus(next);
      if (next.enabled) {
        if (isAuthNow && !isAdminRole(activeUser?.role)) {
          performForcedSignOut();
          setWasForcedLogout(true);
          setAdminBypassedOverlay(false);
        }
      } else {
        setWasForcedLogout(false);
        setAdminBypassedOverlay(false);
      }
    },
    [performForcedSignOut]
  );

  useEffect(() => {
    if (maintenanceStatus.enabled && isAuthenticated && !isAdminRole(currentUser?.role)) {
      performForcedSignOut();
      setWasForcedLogout(true);
      setAdminBypassedOverlay(false);
    }
  }, [maintenanceStatus.enabled, isAuthenticated, currentUser?.role, performForcedSignOut]);

  const refreshMaintenanceStatus = useCallback(async (): Promise<MaintenanceStatus> => {
    const latest = await maintenanceService.fetchStatus();
    applyMaintenanceStatus(latest, isAuthenticated, currentUser);
    return latest;
  }, [applyMaintenanceStatus, isAuthenticated, currentUser]);

  const refreshUsers = useCallback(async () => {
    if (!isAuthenticated || !isAdminRole(currentUser?.role)) {
      setAllUsers([]);
      return;
    }
    if (postgresService.isSyncEnabled()) {
      const remoteUsers = await postgresService.loadUsers();
      if (remoteUsers.length > 0) {
        localStorage.setItem('bj_sqc_users_prod_v1', JSON.stringify(remoteUsers));
        setAllUsers(remoteUsers);
        return;
      }
    }
    setAllUsers(dataService.getUsers());
  }, [isAuthenticated, currentUser?.role]);

  const refreshSession = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await postgresService.fetchCurrentSessionUser();
    if (res.ok && res.user) {
      const { passwordHash: _ph, ...safeUser } = res.user;
      setCurrentUser(safeUser as UserProfile);
      localStorage.setItem('sqc_auth_current_user', JSON.stringify(safeUser));
      if (res.maintenanceMode) {
        applyMaintenanceStatus(res.maintenanceMode, true, safeUser as UserProfile);
      }
    }
  }, [isAuthenticated, applyMaintenanceStatus]);

  // Poll Maintenance Mode + listen for auth invalidation (401/revoked tokens)
  useEffect(() => {
    refreshMaintenanceStatus();

    const timer = setInterval(() => {
      refreshMaintenanceStatus();
      if (isAuthenticated) {
        void refreshSession();
      }
    }, 6000);

    const onForcedLogout = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const nextStatus: MaintenanceStatus = {
        ...maintenanceService.getCached(),
        enabled: true,
        message: detail?.message || DEFAULT_MAINTENANCE_MESSAGE,
      };
      if (isAuthenticated && !isAdminRole(currentUser?.role)) {
        performForcedSignOut();
      }
      setMaintenanceStatus(nextStatus);
      setWasForcedLogout(true);
      setAdminBypassedOverlay(false);
    };

    const onAuthInvalidated = () => {
      performForcedSignOut();
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
      if (e.key === 'sqc_auth_token' && !e.newValue && isAuthenticated) {
        performForcedSignOut();
      }
    };

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshMaintenanceStatus();
        if (isAuthenticated) {
          void refreshSession();
        }
      }
    };

    window.addEventListener('bj_sqc_maintenance_forced_logout', onForcedLogout);
    window.addEventListener('bj_sqc_auth_invalidated', onAuthInvalidated);
    window.addEventListener('bj_sqc_maintenance_changed', onMaintenanceChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener('bj_sqc_maintenance_forced_logout', onForcedLogout);
      window.removeEventListener('bj_sqc_auth_invalidated', onAuthInvalidated);
      window.removeEventListener('bj_sqc_maintenance_changed', onMaintenanceChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [
    refreshMaintenanceStatus,
    refreshSession,
    applyMaintenanceStatus,
    performForcedSignOut,
    isAuthenticated,
    currentUser,
  ]);

  // Listen to data sync events
  useEffect(() => {
    const handleSync = () => {
      if (!isAuthenticated) return;
      if (isAdminRole(currentUser?.role)) {
        const users = dataService.getUsers();
        setAllUsers(users);
      }
    };

    window.addEventListener('bj_sqc_data_synced', handleSync);
    return () => window.removeEventListener('bj_sqc_data_synced', handleSync);
  }, [isAuthenticated, currentUser?.role]);

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

      if (isAdminRole(res.user.role)) {
        const remoteUsers = await postgresService.loadUsers();
        setAllUsers(remoteUsers.length > 0 ? remoteUsers : dataService.getUsers());
      } else {
        setAllUsers([]);
      }

      // Immediately pull scoped inspections & master data for the authenticated account
      void postgresService.pullAndSyncAllData(true);
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
    performForcedSignOut();
  };

  const toggleMaintenanceMode = async (enabled: boolean, message: string) => {
    if (!isAuthenticated || !isAdminRole(currentUser?.role)) {
      return {
        success: false,
        status: maintenanceStatus,
        notice: 'Forbidden: Only Administrators can toggle Maintenance Mode.',
      };
    }
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

  const isAdmin = isAuthenticated && isAdminRole(currentUser?.role);
  const permittedModules = isAuthenticated ? authService.getPermittedModules(currentUser) : [];
  const permittedForms = isAuthenticated ? authService.getPermittedForms(currentUser) : [];

  const canAccessModule = (moduleCode: AppModule): boolean => {
    if (!isAuthenticated) return false;
    return authService.canAccessModule(currentUser, moduleCode);
  };

  const canAccessForm = (formCode: string): boolean => {
    if (!isAuthenticated) return false;
    return authService.canAccessForm(currentUser, formCode);
  };

  const canViewRecord = (record: Partial<InspectionRecord> | null | undefined): boolean => {
    if (!isAuthenticated) return false;
    return authService.canViewInspectionRecord(currentUser, record);
  };

  const canEditSavedEntry = (): boolean => {
    if (!isAuthenticated || !currentUser || !currentUser.isActive) return false;
    if (isAdminRole(currentUser.role)) return true;
    return canAccessModule('INSPECTIONS') && Boolean(currentUser.canEditEntries);
  };

  const canDeleteSavedEntry = (): boolean => {
    if (!isAuthenticated || !currentUser || !currentUser.isActive) return false;
    if (isAdminRole(currentUser.role)) return true;
    return canAccessModule('INSPECTIONS') && Boolean(currentUser.canDeleteEntries);
  };

  const saveUser = async (
    user: UserProfile,
    newPassword?: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAdmin) {
      return { success: false, message: 'Forbidden: Only Administrators can manage user accounts.' };
    }
    try {
      const { passwordHash: _ph, ...toSave } = user;
      if (postgresService.isSyncEnabled()) {
        const pgRes = await postgresService.syncUserToPostgres(toSave as UserProfile, newPassword);
        if (!pgRes.success) {
          return { success: false, message: pgRes.message };
        }
        const savedFromServer = pgRes.data && pgRes.data.id ? pgRes.data : toSave;
        await refreshUsers();

        if (currentUser && currentUser.id === savedFromServer.id) {
          setCurrentUser(savedFromServer as UserProfile);
        }
      } else {
        await refreshUsers();
      }

      dataService.logAudit({
        userId: currentUser?.id || 'SYSTEM',
        userEmail: currentUser?.email || 'SYSTEM',
        userRole: currentUser?.role || 'Admin',
        action: 'UPDATE',
        module: 'User Management',
        recordId: toSave.id,
        details: `Saved user "${toSave.displayName}" [${toSave.role}] (Modules: ${
          toSave.permittedModules?.length ?? 0
        }, Scope: ${toSave.dataScope || 'OWN'}).`,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to save user.' };
    }
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    if (!isAdmin) {
      return { success: false, message: 'Forbidden: Only Administrators can delete users.' };
    }
    if (userId === currentUser.id) {
      return { success: false, message: 'You cannot delete your own active Administrator account.' };
    }
    const target = allUsers.find(u => u.id === userId);
    if (!target) {
      return { success: false, message: 'User not found.' };
    }

    if (postgresService.isSyncEnabled()) {
      const pgRes = await postgresService.deleteUserFromPostgresDetailed(userId);
      if (!pgRes.success) {
        return { success: false, message: pgRes.message || 'Failed to delete user on server.' };
      }
    }

    await refreshUsers();

    dataService.logAudit({
      userId: currentUser?.id || 'SYSTEM',
      userEmail: currentUser?.email || 'SYSTEM',
      userRole: currentUser?.role || 'Admin',
      action: 'DELETE',
      module: 'User Management',
      recordId: userId,
      details: `Deleted user "${target.displayName}".`,
    });

    return { success: true };
  };

  const updateOwnProfile = async (
    displayName: string,
    phone: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAuthenticated) return { success: false, message: 'Authentication required.' };
    const cleanName = displayName.trim();
    if (!cleanName) return { success: false, message: 'Display name is required.' };

    const res = await postgresService.updateOwnProfile(cleanName, phone.trim());
    if (!res.success) {
      return { success: false, message: res.message || 'Failed to update profile.' };
    }
    if (res.user) {
      const { passwordHash: _ph, ...safeUser } = res.user;
      setCurrentUser(safeUser as UserProfile);
      localStorage.setItem('sqc_auth_current_user', JSON.stringify(safeUser));
    }
    return { success: true };
  };

  const changeOwnPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAuthenticated) return { success: false, message: 'Authentication required.' };
    const res = await postgresService.changeOwnPassword(currentPassword, newPassword);
    if (!res.success) {
      return { success: false, message: res.message || 'Failed to update password.' };
    }
    if (res.token) {
      localStorage.setItem('sqc_auth_token', res.token);
    }
    return { success: true, message: res.message || 'Your password has been updated.' };
  };

  const adminResetUserPassword = async (
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAdmin) {
      return { success: false, message: 'Forbidden: Only Administrators can reset another user password.' };
    }
    return postgresService.adminResetUserPassword(userId, newPassword);
  };

  const isRole = (role: UserRole) => isAuthenticated && currentUser?.role === role;

  const hasPermission = (
    action:
      | 'CREATE'
      | 'EDIT_DRAFT'
      | 'SUBMIT'
      | 'APPROVE'
      | 'REJECT'
      | 'RETURN'
      | 'MANAGE_MASTERS'
      | 'SYSTEM_CONFIG'
  ) => {
    if (!isAuthenticated || !currentUser || !currentUser.isActive) return false;
    if (isAdminRole(currentUser.role)) return true;

    const role = currentUser.role;
    switch (action) {
      case 'CREATE':
      case 'EDIT_DRAFT':
      case 'SUBMIT':
        return role !== 'Viewer / Auditor' && canAccessModule('INSPECTIONS');
      case 'APPROVE':
      case 'REJECT':
      case 'RETURN':
        return role === 'HOD / Approver' && canAccessModule('APPROVALS');
      case 'MANAGE_MASTERS':
        return canAccessModule('MASTERS') && role !== 'Viewer / Auditor';
      case 'SYSTEM_CONFIG':
        return false;
      default:
        return false;
    }
  };

  const maintenancePopupVisible =
    maintenanceStatus.enabled && !isAdmin && !adminBypassedOverlay;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        allUsers,
        refreshUsers,
        refreshSession,
        saveUser,
        deleteUser,
        updateOwnProfile,
        changeOwnPassword,
        adminResetUserPassword,
        permittedModules,
        canAccessModule,
        canAccessForm,
        canViewRecord,
        canEditSavedEntry,
        canDeleteSavedEntry,
        permittedForms,
        isRole,
        hasPermission,
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
