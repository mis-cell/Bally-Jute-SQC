// ==============================================================================
// SQC - Authentication & Authorization Service
// Enforces Single Admin Role, Per-Module & Per-Form Permissions, and Data Scope
// ==============================================================================

import {
  ALL_MODULES,
  AppModule,
  DataScope,
  GRANTABLE_MODULES,
  InspectionRecord,
  UserProfile,
} from '../types';
import { dataService } from './dataService';
import { postgresService } from './postgresService';
import { verifyPassword } from '../utils/crypto';
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

export function isAdminRole(role?: string): boolean {
  return role === 'Admin';
}

function isLegacyElevatedRole(role?: string): boolean {
  const r = String(role || '').trim().toLowerCase();
  return r === 'superadmin' || r === 'super admin' || r === 'super_admin';
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

function stripSensitiveUserFields(user: UserProfile): UserProfile {
  const { passwordHash: _ph, ...safe } = user;
  return safe as UserProfile;
}

class AuthService {
  /**
   * Get currently authenticated user from storage (returns null if unauthenticated or legacy elevated)
   */
  public getCurrentUser(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER);
      if (!stored) return null;
      const parsed: UserProfile = JSON.parse(stored);

      // Force-invalidate any cached legacy elevated role immediately
      if (!parsed || isLegacyElevatedRole(parsed.role) || !parsed.isActive) {
        this.logout();
        return null;
      }

      if (isAdminRole(parsed.role)) {
        const users = dataService.getUsers();
        const fresh = users.find(
          u =>
            u.id === parsed.id ||
            (u.email && parsed.email && u.email.toLowerCase() === parsed.email.toLowerCase())
        );
        if (fresh) {
          if (!fresh.isActive || isLegacyElevatedRole(fresh.role)) {
            this.logout();
            return null;
          }
          return stripSensitiveUserFields(fresh);
        }
      }

      return stripSensitiveUserFields(parsed);
    } catch {
      return null;
    }
  }

  /**
   * Authenticate user against PostgreSQL backend first, with strict salted-hash offline fallback
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

    const prevUser = this.getCurrentUser();

    // 1. Attempt PostgreSQL / Express backend authentication
    const pgConfig = postgresService.getConfig();
    if (pgConfig.apiUrl && !pgConfig.isDefaultPlaceholder) {
      try {
        const res = await fetch(`${pgConfig.apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
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
            const loggedInUser = stripSensitiveUserFields({
              ...json.user,
              isActive: json.user.isActive !== false,
              lastLoginAt: new Date().toISOString(),
            });

            if (prevUser && prevUser.id !== loggedInUser.id) {
              dataService.clearSensitiveUserCaches();
            }

            if (isAdminRole(loggedInUser.role)) {
              dataService.saveUser(loggedInUser, undefined, true);
            } else {
              localStorage.removeItem('bj_sqc_users_prod_v1');
            }

            localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(loggedInUser));
            if (json.token) {
              localStorage.setItem(AUTH_STORAGE_KEYS.AUTH_TOKEN, json.token);
            }
            dataService.setCurrentUser(loggedInUser);
            return { success: true, user: loggedInUser };
          }

          if (res.status === 401 || res.status === 403 || res.status === 400) {
            return { success: false, message: json.message || 'Invalid username or password.' };
          }
        }
      } catch {
        // Network unreachable — fall through to offline verification only if cached hash exists
      }
    }

    // 2. Offline / disconnected fallback verification (no hardcoded default passwords)
    const users = dataService.getUsers();
    const user = users.find(
      u =>
        (u.username && u.username.toLowerCase() === cleanId) ||
        (u.email && u.email.toLowerCase() === cleanId) ||
        (u.employeeCode && u.employeeCode.toLowerCase() === cleanId)
    );

    if (!user || !user.passwordHash) {
      return {
        success: false,
        message: 'Unable to sign in offline without verified credentials. Ensure the SQC backend server is running.',
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        message: 'This user account is currently deactivated. Please contact an SQC administrator.',
      };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { success: false, message: 'Invalid username or password.' };
    }

    const cachedMaint = getCachedMaintenanceStatus();
    if (cachedMaint.enabled && !isAdminRole(user.role)) {
      return {
        success: false,
        maintenanceMode: true,
        message: cachedMaint.message || DEFAULT_MAINTENANCE_MESSAGE,
      };
    }

    const safeUser = stripSensitiveUserFields({
      ...user,
      lastLoginAt: new Date().toISOString(),
    });

    if (prevUser && prevUser.id !== safeUser.id) {
      dataService.clearSensitiveUserCaches();
    }

    localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(safeUser));
    dataService.setCurrentUser(safeUser);

    return { success: true, user: safeUser };
  }

  /**
   * Log out currently authenticated user and clear sensitive local caches
   */
  public logout(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER);
        if (stored) {
          const user = JSON.parse(stored) as UserProfile;
          if (user?.id) {
            dataService.logAudit({
              userId: user.id,
              userEmail: user.email,
              userRole: user.role,
              action: 'LOGOUT',
              module: 'Authentication',
              details: `User ${user.displayName} logged out.`,
            });
          }
        }
      } catch {
        // ignore
      }
      localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);
      dataService.clearSensitiveUserCaches();
    }
  }

  public isAdminRole(role?: string): boolean {
    return isAdminRole(role);
  }

  public getPermittedModules(user: UserProfile | null): AppModule[] {
    if (!user || !user.isActive) return [];
    if (isAdminRole(user.role)) return [...ALL_MODULES];
    const mods = Array.isArray(user.permittedModules) ? user.permittedModules : [];
    const allowed = new Set<AppModule>(GRANTABLE_MODULES);
    return Array.from(new Set(mods.filter((m): m is AppModule => allowed.has(m))));
  }

  public canAccessModule(user: UserProfile | null, moduleCode: AppModule): boolean {
    if (!user || !user.isActive) return false;
    if (isAdminRole(user.role)) return true;
    return this.getPermittedModules(user).includes(moduleCode);
  }

  public getDataScope(user: UserProfile | null): DataScope {
    if (!user || !user.isActive) return 'OWN';
    if (isAdminRole(user.role)) return 'ALL';
    if (user.dataScope === 'DEPARTMENT' || user.dataScope === 'ALL') {
      return user.dataScope;
    }
    return 'OWN';
  }

  /**
   * Check if a user has access to a specific form code (and has INSPECTIONS module if standard user)
   */
  public canAccessForm(user: UserProfile | null, formCode: string): boolean {
    if (!user || !user.isActive) return false;
    if (isAdminRole(user.role)) return true;
    if (!this.canAccessModule(user, 'INSPECTIONS')) return false;

    if (Array.isArray(user.permittedForms)) {
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

    if (isAdminRole(user.role)) {
      return allFormCodes;
    }

    if (!this.canAccessModule(user, 'INSPECTIONS')) {
      return [];
    }

    if (Array.isArray(user.permittedForms) && user.permittedForms.length > 0) {
      return allFormCodes.filter(code => this.canAccessForm(user, code));
    }

    return [];
  }

  /**
   * Verify whether a user is authorized to view a specific inspection record under module + dataScope + form rules
   */
  public canViewInspectionRecord(
    user: UserProfile | null,
    record: Partial<InspectionRecord> | null | undefined
  ): boolean {
    if (!user || !user.isActive || !record) return false;
    if (isAdminRole(user.role)) return true;

    const mods = this.getPermittedModules(user);
    const hasAnyDataMod =
      mods.includes('DASHBOARD') ||
      mods.includes('INSPECTIONS') ||
      mods.includes('APPROVALS') ||
      mods.includes('REPORTS');
    if (!hasAnyDataMod) return false;

    const scope = this.getDataScope(user);
    let scopeOk = false;
    if (scope === 'ALL') {
      scopeOk = true;
    } else if (scope === 'DEPARTMENT') {
      const isOwner = Boolean(record.inspectorId) && record.inspectorId === user.id;
      const sameDeptId =
        Boolean(user.departmentId) && Boolean(record.departmentId) && record.departmentId === user.departmentId;
      const sameDeptName =
        Boolean(user.departmentName) &&
        Boolean(record.departmentName) &&
        String(record.departmentName).trim().toLowerCase() === user.departmentName.trim().toLowerCase();
      scopeOk = isOwner || sameDeptId || sameDeptName;
    } else {
      scopeOk = Boolean(record.inspectorId) && record.inspectorId === user.id;
    }

    if (!scopeOk) return false;

    // Without Approvals module, record must also match explicitly granted form codes
    if (!mods.includes('APPROVALS')) {
      const targetCode = String(record.formCode || record.formId || '').trim().toUpperCase();
      if (!targetCode) return false;
      const aliases = expandFormAliases(targetCode);
      const userSet = new Set((user.permittedForms || []).map(f => String(f).trim().toUpperCase()));
      return aliases.some(a => userSet.has(a));
    }

    return true;
  }
}

export const authService = new AuthService();
