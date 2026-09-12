import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { dataService } from '../services/dataService';
import { INITIAL_USERS } from '../constants/initialData';

interface AuthContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  switchUser: (userId: string) => void;
  updateCurrentUserProfile: (profile: Partial<UserProfile>) => void;
  isRole: (role: UserRole) => boolean;
  hasPermission: (action: 'CREATE' | 'EDIT_DRAFT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'MANAGE_MASTERS' | 'SYSTEM_CONFIG') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<UserProfile>(() => dataService.getCurrentUser());
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => dataService.getUsers());

  const switchUser = (userId: string) => {
    const target = allUsers.find(u => u.id === userId) || INITIAL_USERS[0];
    setCurrentUserState(target);
    dataService.setCurrentUser(target);
  };

  const updateCurrentUserProfile = (profile: Partial<UserProfile>) => {
    const updated = { ...currentUser, ...profile };
    setCurrentUserState(updated);
    dataService.saveUser(updated);
    dataService.setCurrentUser(updated);
    setAllUsers(dataService.getUsers());
  };

  const isRole = (role: UserRole) => currentUser.role === role;

  const hasPermission = (action: 'CREATE' | 'EDIT_DRAFT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'MANAGE_MASTERS' | 'SYSTEM_CONFIG') => {
    const role = currentUser.role;
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
        allUsers,
        switchUser,
        updateCurrentUserProfile,
        isRole,
        hasPermission,
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
