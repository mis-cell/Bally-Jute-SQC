// ==============================================================================
// SQC - Authentication & Authorization Service
// Enforces Single Admin Role, Per-Module & Per-Form Permissions, and Data Scope
// Live PostgreSQL session & token verification only (no local/offline user fallback)
// ==============================================================================

import {
  ALL_MODULES,
  AppModule,
  DataScope,
  GRANTABLE_MODULES,
  InspectionRecord,
  UserProfile,
} from '../types';
import { postgresService } from './postgresService';
import { FORM_REGISTRY } from '../constants/formsRegistry';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  setCachedMaintenanceStatus,
} from './maintenanceService';

export const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const AUTH_TOKEN_KEY = 'sqc_auth_token';
export const SESSION_EXPIRES_AT_KEY = 'sqc_session_expires_at';
export const SESSION_LOCKED_USER_KEY = 'sqc_session_locked_user';

export interface LockedSessionInfo {
  username: string;
  displayName: string;
  employeeCode?: string;
  role?: string;
  lockedAt?: string;
}

// Remove any legacy localStorage cached user profile on module load
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sqc_auth_current_user');
    localStorage.removeItem('bj_sqc_active_user_prod_v1');
    localStorage.removeItem('bj_sqc_users_prod_v1');
  }
} catch {
  // ignore
}

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

export function stripSensitiveUserFields(user: UserProfile): UserProfile {
  const { passwordHash: _ph, ...safe } = user;
  return safe as UserProfile;
}

class AuthService {
  private activeUser: UserProfile | null = null;

  public hasToken(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
    } catch {
      return false;
    }
  }

  public getToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public setToken(token: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }

  public clearToken(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore
    }
  }

  public getSessionExpiresAt(): number | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  public touchSessionDeadline(now: number = Date.now()): number {
    const expiresAt = now + SESSION_TIMEOUT_MS;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
      } catch {
        // ignore
      }
    }
    return expiresAt;
  }

  public ensureSessionDeadline(now: number = Date.now()): number {
    const existing = this.getSessionExpiresAt();
    if (existing && existing > now) {
      return existing;
    }
    return this.touchSessionDeadline(now);
  }

  public getRemainingSessionMs(now: number = Date.now()): number {
    const expiresAt = this.getSessionExpiresAt();
    if (!expiresAt) return SESSION_TIMEOUT_MS;
    return Math.max(0, expiresAt - now);
  }

  public isSessionExpired(now: number = Date.now()): boolean {
    const expiresAt = this.getSessionExpiresAt();
    if (!expiresAt) return false;
    return now >= expiresAt;
  }

  public getLockedUser(): LockedSessionInfo | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SESSION_LOCKED_USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.username === 'string' && parsed.username.trim()) {
        return {
          username: parsed.username,
          displayName: parsed.displayName || parsed.username,
          employeeCode: parsed.employeeCode || undefined,
          role: parsed.role || undefined,
          lockedAt: parsed.lockedAt || undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  public setLockedUser(info: LockedSessionInfo | null): void {
    if (typeof window === 'undefined') return;
    try {
      if (info && info.username) {
        localStorage.setItem(SESSION_LOCKED_USER_KEY, JSON.stringify(info));
      } else {
        localStorage.removeItem(SESSION_LOCKED_USER_KEY);
      }
    } catch {
      // ignore
    }
  }

  public clearSessionMeta(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
      localStorage.removeItem(SESSION_LOCKED_USER_KEY);
    } catch {
      // ignore
    }
  }

  public lockSession(user?: Partial<UserProfile> | null): LockedSessionInfo | null {
    const existingLocked = this.getLockedUser();
    const username = (user?.username || user?.email || existingLocked?.username || '').trim();
    const lockInfo: LockedSessionInfo | null = username
      ? {
          username,
          displayName: user?.displayName || existingLocked?.displayName || username,
          employeeCode: user?.employeeCode || existingLocked?.employeeCode,
          role: user?.role || existingLocked?.role,
          lockedAt: existingLocked?.lockedAt || new Date().toISOString(),
        }
      : null;

    this.activeUser = null;
    this.clearToken();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
      } catch {
        // ignore
      }
    }
    this.setLockedUser(lockInfo);
    postgresService.setSessionUserContext(null);
    postgresService.clearSyncData();
    return lockInfo;
  }

  public setAuthenticatedUser(user: UserProfile | null): UserProfile | null {
    if (!user || isLegacyElevatedRole(user.role) || !user.isActive) {
      this.activeUser = null;
      postgresService.setSessionUserContext(null);
      return null;
    }
    const safe = stripSensitiveUserFields(user);
    this.activeUser = safe;
    postgresService.setSessionUserContext(safe);
    return safe;
  }

  public getCurrentUser(): UserProfile | null {
    return this.activeUser;
  }

  /**
   * Authenticate strictly against the Express + PostgreSQL /api/auth/login endpoint.
   * Never falls back to hardcoded, cached, or offline credentials.
   */
  public async login(
    identifier: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: UserProfile;
    message?: string;
    maintenanceMode?: boolean;
    dbUnavailable?: boolean;
  }> {
    const cleanRaw = (identifier || '').trim();
    if (!cleanRaw || !password) {
      return { success: false, message: 'Please enter both username/email and password.' };
    }

    const pgConfig = postgresService.getConfig();
    if (!pgConfig.apiUrl || pgConfig.isDefaultPlaceholder) {
      return {
        success: false,
        dbUnavailable: true,
        message: 'SQC backend API URL is not configured.',
      };
    }

    try {
      const res = await fetch(`${pgConfig.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ username: cleanRaw, password }),
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          dbUnavailable: true,
          message: 'SQC backend server is not responding cleanly. Ensure Express API & PostgreSQL are running.',
        };
      }

      const json = await res.json().catch(() => ({}));

      if (res.status === 503 && json.dbUnavailable) {
        return {
          success: false,
          dbUnavailable: true,
          message:
            json.message || 'PostgreSQL database is unavailable. Verify database connectivity and retry.',
        };
      }

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

      if (res.ok && json.success && json.user && json.token) {
        const rawUser: UserProfile = {
          ...json.user,
          isActive: json.user.isActive !== false,
          lastLoginAt: new Date().toISOString(),
        };
        if (isLegacyElevatedRole(rawUser.role) || !rawUser.isActive) {
          this.logout();
          return {
            success: false,
            message: 'Account access is disabled or holds an invalid role.',
          };
        }

        this.setLockedUser(null);
        this.setToken(json.token);
        this.touchSessionDeadline();
        const loggedInUser = this.setAuthenticatedUser(rawUser)!;
        return { success: true, user: loggedInUser };
      }

      return {
        success: false,
        message: json.message || `Authentication failed (HTTP ${res.status}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        dbUnavailable: true,
        message: `Cannot reach SQC server or PostgreSQL (${err?.message || 'Network error'}).`,
      };
    }
  }

  /**
   * Log out currently authenticated user and clear all in-memory, token, and lock state
   */
  public logout(): void {
    this.activeUser = null;
    this.clearToken();
    this.clearSessionMeta();
    postgresService.setSessionUserContext(null);
    postgresService.clearSyncData();
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
