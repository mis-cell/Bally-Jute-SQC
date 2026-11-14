// ==============================================================================
// SQC - Authentication & Authorization Service
// Enforces Per-Form Permissions, Password Hashing, and PostgreSQL Session Auth
// ==============================================================================

import { UserProfile } from '../types';
import { dataService } from './dataService';
import { postgresService } from './postgresService';
import { hashPassword, verifyPassword, DEFAULT_ADMIN_PASSWORD_HASH } from '../utils/crypto';
import { FORM_REGISTRY } from '../constants/formsRegistry';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  getCachedMaintenanceStatus,
  setCachedMaintenanceStatus,
} from './maintenanceService';

const AUTH_STORAGE_KEYS = {
  CURRENT_USER: 'sqc_auth_current_user',
  AUTH_TOKEN: 'sqc_auth_token',
};

function isAdminRole(role?: string): boolean {
  return role === 'SuperAdmin' || role === 'Super Admin' || role === 'Admin';
}

function expandFormAliases(code: string): string[] {
  const c = (code || '').trim().toUpperCase();
  const out = new Set<string>([c]);
  if (c === 'FORM-09' || c === 'FORM-09 A' || c === 'FORM-09A') {
    out.add('FORM-09');
    out.add('FORM-09 A');
  }
  if (c === 'FORM-37' || c === 'FORM-09 B' || c === 'FORM-09B') {
    out.add('FORM-37');
    out.add('FORM-09 B');
  }
  return Array.from(out);
}

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

      const users = dataService.getUsers();
      const fresh = users.find(
        u => u.id === parsed.id || (u.email && parsed.email && u.email.toLowerCase() === parsed.email.toLowerCase())
      );
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
   * Authenticate user against PostgreSQL backend first, with local fallback when offline
   */
  public async login(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; message?: string; maintenanceMode?: boolean }> {
    const cleanRaw = (identifier || '').trim();
    const cleanId = cleanRaw.toLowerCase();
    if (!cleanId || !password) {
      return { success: false, message: 'Please enter both username/email and password.' };
    }

    // 1. Attempt PostgreSQL backend authentication
    const pgConfig = postgresService.getConfig();
    if (pgConfig.apiUrl && !pgConfig.isDefaultPlaceholder) {
      try {
        const res = await fetch(`${pgConfig.apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': pgConfig.apiKey,
          },
          body: JSON.stringify({ username: cleanRaw, password }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          if (json.maintenanceMode && typeof json.maintenanceMode === 'object') {
            setCachedMaintenanceStatus(json.maintenanceMode);
          }

          if (res.status === 503 || json.maintenanceMode === true) {
            const msg = json.message || DEFAULT_MAINTENANCE_MESSAGE;
            setCachedMaintenanceStatus({ enabled: true, message: msg });
            return {
              success: false,
              maintenanceMode: true,
              message: msg,
            };
          }

          if (res.ok && json.success && json.user) {
            const loggedInUser: UserProfile = {
              ...json.user,
              isActive: json.user.isActive !== false,
              lastLoginAt: new Date().toISOString(),
            };
            dataService.saveUser(loggedInUser, undefined, true);
            localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(loggedInUser));
            if (json.token) {
              localStorage.setItem(AUTH_STORAGE_KEYS.AUTH_TOKEN, json.token);
            }
            dataService.setCurrentUser(loggedInUser);
            return { success: true, user: loggedInUser };
          }
          // If server explicitly rejected password/inactive user (401/403), return its exact message
          if (res.status === 401 || res.status === 403) {
            return { success: false, message: json.message || 'Invalid username or password.' };
          }
        }
      } catch {
        // Network unreachable — fall through to local offline verification
      }
    }

    // 2. Offline / fallback local verification
    const users = dataService.getUsers();
    const user = users.find(
      u =>
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

    let isValid = false;
    if (user.passwordHash) {
      isValid = await verifyPassword(password, user.passwordHash);
    } else if (isAdminRole(user.role)) {
      isValid = (await verifyPassword(password, DEFAULT_ADMIN_PASSWORD_HASH)) || password === 'Admin@123456' || password === 'Admin@1234';
    }

    if (!isValid) {
      return { success: false, message: 'Invalid password. Please try again.' };
    }

    const cachedMaint = getCachedMaintenanceStatus();
    if (cachedMaint.enabled && !isAdminRole(user.role as string)) {
      return {
        success: false,
        maintenanceMode: true,
        message: cachedMaint.message || DEFAULT_MAINTENANCE_MESSAGE,
      };
    }

    const updatedUser: UserProfile = {
      ...user,
      lastLoginAt: new Date().toISOString(),
    };
    dataService.saveUser(updatedUser, undefined, true);

    localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    localStorage.setItem(
      AUTH_STORAGE_KEYS.AUTH_TOKEN,
      btoa(JSON.stringify({ userId: updatedUser.id, username: updatedUser.username, role: updatedUser.role }))
    );
    dataService.setCurrentUser(updatedUser);

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
    if (isAdminRole(user.role as string)) return true;

    if (Array.isArray(user.permittedForms)) {
      if (user.permittedForms.includes('*')) return true;
      const aliases = expandFormAliases(formCode);
      const userSet = new Set(user.permittedForms.map(f => f.trim().toUpperCase()));
      return aliases.some(a => userSet.has(a));
    }

    return false;
  }

  /**
   * Return the list of form codes accessible to a user
   */
  public getPermittedForms(user: UserProfile | null): string[] {
    if (!user || !user.isActive) return [];
    const allFormCodes = Object.keys(FORM_REGISTRY);

    if (isAdminRole(user.role as string)) {
      return allFormCodes;
    }

    if (Array.isArray(user.permittedForms) && user.permittedForms.length > 0) {
      if (user.permittedForms.includes('*')) return allFormCodes;
      return allFormCodes.filter(code => this.canAccessForm(user, code));
    }

    return [];
  }

  /**
   * Setup initial first administrator password or reset admin
   */
  public async initializeAdmin(password: string): Promise<UserProfile> {
    const users = dataService.getUsers();
    let admin = users.find(u => isAdminRole(u.role as string));

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
