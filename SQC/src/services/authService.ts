// ==============================================================================
// SQC - Authentication & Authorization Service
// Enforces Per-Form Permissions, Password Hashing, and Session Management
// ==============================================================================

import { UserProfile, UserRole } from '../types';
import { dataService } from './dataService';
import { hashPassword, verifyPassword, DEFAULT_ADMIN_PASSWORD_HASH } from '../utils/crypto';
import { FORM_REGISTRY } from '../constants/formsRegistry';

const AUTH_STORAGE_KEYS = {
  CURRENT_USER: 'sqc_auth_current_user',
  AUTH_TOKEN: 'sqc_auth_token',
};

class AuthService {
  /**
   * Get currently authenticated user from storage
   */
  public getCurrentUser(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER);
      if (!stored) return null;
      const parsed: UserProfile = JSON.parse(stored);
      
      // Always get latest version from dataService to reflect permission changes immediately
      const users = dataService.getUsers();
      const fresh = users.find(u => u.id === parsed.id || u.email.toLowerCase() === parsed.email.toLowerCase());
      if (fresh) {
        if (!fresh.isActive) {
          this.logout();
          return null;
        }
        return fresh;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Authenticate user with Username or Email + Password
   */
  public async login(identifier: string, password: string): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId || !password) {
      return { success: false, message: 'Please enter both username/email and password.' };
    }

    const users = dataService.getUsers();
    const user = users.find(u => 
      (u.username && u.username.toLowerCase() === cleanId) ||
      (u.email && u.email.toLowerCase() === cleanId) ||
      (u.employeeCode && u.employeeCode.toLowerCase() === cleanId)
    );

    if (!user) {
      return { success: false, message: 'Invalid username, employee code, or password.' };
    }

    if (!user.isActive) {
      return { success: false, message: 'This user account is currently deactivated. Please contact an SQC administrator.' };
    }

    // Check password
    let isValid = false;
    if (user.passwordHash) {
      isValid = await verifyPassword(password, user.passwordHash);
    } else {
      // Fallback for default admin
      if (user.role === 'Super Admin' || user.role === 'Admin') {
        isValid = await verifyPassword(password, DEFAULT_ADMIN_PASSWORD_HASH) || password === 'Admin@123456';
      }
    }

    if (!isValid) {
      return { success: false, message: 'Invalid password. Please try again.' };
    }

    // Update lastLoginAt
    const updatedUser: UserProfile = {
      ...user,
      lastLoginAt: new Date().toISOString(),
    };
    dataService.saveUser(updatedUser);

    // Save session
    localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    localStorage.setItem(AUTH_STORAGE_KEYS.AUTH_TOKEN, `sqc_token_${Date.now()}_${updatedUser.id}`);
    dataService.setCurrentUser(updatedUser);

    dataService.logAudit({
      userId: updatedUser.id,
      userEmail: updatedUser.email,
      userRole: updatedUser.role,
      action: 'LOGIN',
      module: 'Authentication',
      details: `User ${updatedUser.displayName} logged in successfully.`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Log out currently authenticated user
   */
  public logout(): void {
    if (typeof window !== 'undefined') {
      const user = this.getCurrentUser();
      if (user) {
        dataService.logAudit({
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'LOGOUT',
          module: 'Authentication',
          details: `User ${user.displayName} logged out.`,
        });
      }
      localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);
    }
  }

  /**
   * Check if a user has access to a specific form code
   */
  public canAccessForm(user: UserProfile | null, formCode: string): boolean {
    if (!user || !user.isActive) return false;
    
    // Admins and Super Admins have universal access to all forms
    const roleStr = user.role as string;
    if (roleStr === 'SuperAdmin' || roleStr === 'Super Admin' || roleStr === 'Admin') {
      return true;
    }

    // If permittedForms is explicitly defined, check membership
    if (Array.isArray(user.permittedForms)) {
      if (user.permittedForms.length === 0 && (roleStr === 'SuperAdmin' || roleStr === 'Super Admin' || roleStr === 'Admin')) {
        return true;
      }
      return user.permittedForms.includes(formCode);
    }

    return false;
  }

  /**
   * Return the list of form codes accessible to a user
   */
  public getPermittedForms(user: UserProfile | null): string[] {
    if (!user || !user.isActive) return [];
    const allFormCodes = Object.keys(FORM_REGISTRY);

    if (user.role === 'Super Admin' || user.role === 'Admin') {
      return allFormCodes;
    }

    if (Array.isArray(user.permittedForms) && user.permittedForms.length > 0) {
      return user.permittedForms.filter(code => allFormCodes.includes(code));
    }

    return [];
  }

  /**
   * Setup initial first administrator password or reset admin
   */
  public async initializeAdmin(password: string): Promise<UserProfile> {
    const users = dataService.getUsers();
    let admin = users.find(u => u.role === 'Super Admin' || u.role === 'Admin');

    const passwordHash = await hashPassword(password);

    if (admin) {
      admin = {
        ...admin,
        passwordHash,
        username: admin.username || 'admin',
        isActive: true,
      };
      dataService.saveUser(admin);
    } else {
      admin = {
        id: `usr-admin-${Date.now()}`,
        username: 'admin',
        email: 'admin@ballyjute.com',
        displayName: 'SQC Administrator',
        role: 'Super Admin',
        departmentName: 'Quality Control',
        employeeCode: 'ADM-01',
        passwordHash,
        isActive: true,
        permittedForms: Object.keys(FORM_REGISTRY),
        createdAt: new Date().toISOString(),
      };
      dataService.saveUser(admin);
    }

    return admin;
  }
}

export const authService = new AuthService();
