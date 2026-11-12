import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { hashPassword } from '../utils/crypto';
import { INITIAL_USERS } from '../constants/initialData';
import { FORM_REGISTRY } from '../constants/formsRegistry';

interface AuthContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; message?: string }>;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if a user session already exists, or default to initial admin
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const existing = authService.getCurrentUser();
    if (existing) return existing;
    return INITIAL_USERS[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!authService.getCurrentUser();
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => dataService.getUsers());

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

  const login = async (identifier: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const res = await authService.login(identifier, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      refreshUsers();
      return { success: true };
    }
    return { success: false, message: res.message || 'Login failed.' };
  };

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
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
      dataService.saveUser(toSave);
      refreshUsers();

      // If updating currently logged in user, refresh current user state
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
      setCurrentUser(target);
      setIsAuthenticated(true);
      localStorage.setItem('sqc_auth_current_user', JSON.stringify(target));
      dataService.setCurrentUser(target);
    }
  };

  const isRole = (role: UserRole) => currentUser?.role === role;

  const hasPermission = (action: 'CREATE' | 'EDIT_DRAFT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'MANAGE_MASTERS' | 'SYSTEM_CONFIG') => {
    const role = currentUser?.role;
    if (role === 'Super Admin') return true;

    switch (action) {
      case 'CREATE':
      case 'EDIT_DRAFT':
      case 'SUBMIT':
        return role === 'Admin' || role === 'SQC Inspector / User';
      case 'APPROVE':
      case 'REJECT':
      case 'RETURN':
        return role === 'Admin' || role === 'HOD / Approver';
      case 'MANAGE_MASTERS':
        return role === 'Admin';
      case 'SYSTEM_CONFIG':
        return false;
      default:
        return false;
    }
  };

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
      }}
    >
      {children}
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
