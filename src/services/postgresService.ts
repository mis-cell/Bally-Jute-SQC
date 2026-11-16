// ==============================================================================
// SQC QUALITY CONTROL SYSTEM - Live PostgreSQL Client Service
// Pure live database API synchronization (zero localStorage/offline business fallbacks)
// ==============================================================================

import {
  UserProfile,
  Department,
  Section,
  Machine,
  Loom,
  QualityMaster,
  StandardDefinition,
  InspectionRecord,
  ApplicationSettings,
} from '../types';
import {
  emitMaintenanceLockout,
  maintenanceService,
  setCachedMaintenanceStatus,
} from './maintenanceService';

const STORAGE_KEYS = {
  API_URL: 'bj_sqc_pg_api_url',
  API_KEY: 'bj_sqc_pg_api_key',
  SYNC_ENABLED: 'bj_sqc_pg_sync_enabled',
};

// Clear any legacy status cache from localStorage
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bj_sqc_pg_last_status');
  }
} catch {
  // ignore
}

function getDefaultApiUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && !String(envUrl).includes('trycloudflare.com')) {
    return String(envUrl).trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://127.0.0.1:3001';
}

export const DEFAULT_API_URL = getDefaultApiUrl();
export const DEFAULT_API_KEY = (import.meta as any).env?.VITE_API_KEY || '';

export function hasStoredAuthToken(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(localStorage.getItem('sqc_auth_token'));
  } catch {
    return false;
  }
}

function emitAuthInvalidated(message?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bj_sqc_auth_invalidated', {
        detail: { message: message || 'Session expired or permissions updated. Please sign in again.' },
      })
    );
  }
}

function isPlaceholderOrDeadUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return (
    url.includes('blue-example.trycloudflare.com') ||
    url.includes('curtis-references-approximately-authorization.trycloudflare.com')
  );
}

export interface PostgresConnectionStatus {
  isConnected: boolean;
  message: string;
  checkedAt?: string;
  database?: string;
  user?: string;
  postgresVersion?: string;
  inspectionsCount?: number;
  usersCount?: number;
}

export interface PostgresSyncResult {
  success: boolean;
  message: string;
  error?: string;
  statusCode?: number;
  dbUnavailable?: boolean;
  formTable?: string;
  data?: any;
}

export interface RealtimeSyncState {
  isAutoSyncEnabled: boolean;
  isSyncing: boolean;
  hasLoaded: boolean;
  lastSyncTime: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncMessage: string;
  dbError: string | null;
  itemsCount: {
    inspections: number;
    users: number;
    departments: number;
    sections: number;
    machines: number;
    looms: number;
    qualities: number;
    standards: number;
  };
}

export interface AllPostgresPayload {
  users: UserProfile[];
  departments: Department[];
  sections: Section[];
  machines: Machine[];
  looms: Loom[];
  qualities: QualityMaster[];
  standards: StandardDefinition[];
  inspections: InspectionRecord[];
  settings?: Partial<ApplicationSettings>;
}

export function broadcastDataChange(source: string = 'postgres') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bj_sqc_data_synced', { detail: { source, timestamp: Date.now() } })
    );
  }
}

class PostgresService {
  private apiUrl: string;
  private apiKey: string;
  private syncEnabled: boolean;
  private cachedStatus: PostgresConnectionStatus | null = null;
  private listeners: Array<(status: PostgresConnectionStatus) => void> = [];
  private backendApiDetected: boolean | null = null;
  private probePromise: Promise<boolean> | null = null;

  private sessionUserContext: Partial<UserProfile> | null = null;
  private dataHydrator: ((data: AllPostgresPayload) => void) | null = null;

  // Live PostgreSQL Polling Loop
  private syncIntervalTimer: any = null;
  private syncStateListeners: Array<(state: RealtimeSyncState) => void> = [];
  private syncState: RealtimeSyncState = {
    isAutoSyncEnabled: true,
    isSyncing: false,
    hasLoaded: false,
    lastSyncTime: null,
    lastSyncStatus: 'idle',
    lastSyncMessage: 'Waiting for PostgreSQL connection...',
    dbError: null,
    itemsCount: {
      inspections: 0,
      users: 0,
      departments: 0,
      sections: 0,
      machines: 0,
      looms: 0,
      qualities: 0,
      standards: 0,
    },
  };

  constructor() {
    let storedUrl: string | null = null;
    try {
      storedUrl = localStorage.getItem(STORAGE_KEYS.API_URL);
      if (storedUrl && !isPlaceholderOrDeadUrl(storedUrl)) {
        this.apiUrl = storedUrl.trim().replace(/\/+$/, '');
      } else {
        this.apiUrl = getDefaultApiUrl();
        if (storedUrl && isPlaceholderOrDeadUrl(storedUrl)) {
          localStorage.removeItem(STORAGE_KEYS.API_URL);
        }
      }
      this.apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || DEFAULT_API_KEY;
      const storedSync = localStorage.getItem(STORAGE_KEYS.SYNC_ENABLED);
      this.syncEnabled = storedSync !== null ? storedSync === 'true' : true;
    } catch {
      this.apiUrl = getDefaultApiUrl();
      this.apiKey = DEFAULT_API_KEY;
      this.syncEnabled = true;
    }

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.startAutoSync(6000);
      }, 1200);

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isSyncEnabled() && hasStoredAuthToken()) {
          void this.pullAndSyncAllData(false);
        }
      });
      window.addEventListener('focus', () => {
        if (this.isSyncEnabled() && hasStoredAuthToken()) {
          void this.pullAndSyncAllData(false);
        }
      });
    }
  }

  public setSessionUserContext(user: Partial<UserProfile> | null): void {
    this.sessionUserContext = user;
  }

  public isSessionAdmin(): boolean {
    return this.sessionUserContext?.role === 'Admin';
  }

  public registerDataHydrator(hydrator: (data: AllPostgresPayload) => void): void {
    this.dataHydrator = hydrator;
  }

  public clearSyncData(): void {
    this.cachedStatus = null;
    this.notifySyncState({
      isSyncing: false,
      hasLoaded: false,
      lastSyncTime: null,
      lastSyncStatus: 'idle',
      lastSyncMessage: 'Signed out',
      dbError: null,
      itemsCount: {
        inspections: 0,
        users: 0,
        departments: 0,
        sections: 0,
        machines: 0,
        looms: 0,
        qualities: 0,
        standards: 0,
      },
    });
  }

  private isJsonResponse(res: Response): boolean {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return ct.includes('application/json');
  }

  public async checkBackendApiAvailable(forceRecheck: boolean = false): Promise<boolean> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      this.backendApiDetected = false;
      return false;
    }
    if (!forceRecheck && this.backendApiDetected !== null) {
      return this.backendApiDetected;
    }
    if (this.probePromise && !forceRecheck) {
      return this.probePromise;
    }

    this.probePromise = (async () => {
      try {
        const res = await fetch(`${this.apiUrl}/api/health`, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
          cache: 'no-store',
        });
        const detected = this.isJsonResponse(res);
        this.backendApiDetected = detected;
        return detected;
      } catch {
        this.backendApiDetected = false;
        return false;
      } finally {
        this.probePromise = null;
      }
    })();

    return this.probePromise;
  }

  public subscribeRealtimeSync(callback: (state: RealtimeSyncState) => void) {
    this.syncStateListeners.push(callback);
    callback(this.syncState);
    return () => {
      this.syncStateListeners = this.syncStateListeners.filter(l => l !== callback);
    };
  }

  private notifySyncState(partial: Partial<RealtimeSyncState>) {
    this.syncState = { ...this.syncState, ...partial };
    this.syncStateListeners.forEach(cb => cb(this.syncState));
  }

  public getSyncState(): RealtimeSyncState {
    return this.syncState;
  }

  public startAutoSync(intervalMs: number = 6000) {
    if (this.syncIntervalTimer) {
      clearInterval(this.syncIntervalTimer);
    }
    this.notifySyncState({ isAutoSyncEnabled: true });
    this.syncIntervalTimer = setInterval(() => {
      if (this.isSyncEnabled() && !this.syncState.isSyncing && hasStoredAuthToken()) {
        void this.pullAndSyncAllData(false);
      }
    }, intervalMs);
  }

  public stopAutoSync() {
    if (this.syncIntervalTimer) {
      clearInterval(this.syncIntervalTimer);
      this.syncIntervalTimer = null;
    }
    this.notifySyncState({ isAutoSyncEnabled: false });
  }

  public async pullAndSyncAllData(isUserInitiated: boolean = false): Promise<{
    success: boolean;
    totalItems?: number;
    error?: string;
    dbUnavailable?: boolean;
  }> {
    if (!this.isSyncEnabled()) {
      return { success: false, error: 'Sync is disabled or backend URL is not configured.' };
    }
    if (!hasStoredAuthToken()) {
      return { success: false, error: 'Authentication required.' };
    }
    if (this.syncState.isSyncing && !isUserInitiated) {
      return { success: false, error: 'Sync already in progress.' };
    }

    this.notifySyncState({ isSyncing: true, lastSyncStatus: 'syncing' });

    const res = await this.fetchAllDataFromPostgresDetailed();
    if (!res.success || !res.data) {
      const errMsg = res.error || 'Failed to retrieve live data from PostgreSQL database.';
      this.notifySyncState({
        isSyncing: false,
        lastSyncStatus: 'error',
        lastSyncMessage: errMsg,
        dbError: errMsg,
      });
      return { success: false, error: errMsg, dbUnavailable: res.dbUnavailable };
    }

    const data = res.data;
    // Unconditionally hydrate in-memory live store (even empty arrays [] so deletes persist)
    this.dataHydrator?.(data);

    const totalItems =
      (data.users?.length || 0) +
      (data.departments?.length || 0) +
      (data.sections?.length || 0) +
      (data.machines?.length || 0) +
      (data.looms?.length || 0) +
      (data.qualities?.length || 0) +
      (data.standards?.length || 0) +
      (data.inspections?.length || 0);

    const nowStr = new Date().toLocaleTimeString();
    this.notifySyncState({
      isSyncing: false,
      hasLoaded: true,
      lastSyncTime: nowStr,
      lastSyncStatus: 'success',
      lastSyncMessage: `Live PostgreSQL synced (${data.inspections?.length || 0} inspections)`,
      dbError: null,
      itemsCount: {
        inspections: data.inspections?.length || 0,
        users: data.users?.length || 0,
        departments: data.departments?.length || 0,
        sections: data.sections?.length || 0,
        machines: data.machines?.length || 0,
        looms: data.looms?.length || 0,
        qualities: data.qualities?.length || 0,
        standards: data.standards?.length || 0,
      },
    });

    broadcastDataChange('postgres_poll');
    return { success: true, totalItems };
  }

  public async fetchAllDataFromPostgresDetailed(): Promise<{
    success: boolean;
    data?: AllPostgresPayload;
    statusCode?: number;
    error?: string;
    dbUnavailable?: boolean;
  }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return { success: false, dbUnavailable: true, error: 'Backend server URL is not configured.' };
    }
    if (!hasStoredAuthToken()) {
      return { success: false, statusCode: 401, error: 'Authentication required.' };
    }

    try {
      const res = await fetch(`${this.apiUrl}/api/all-data`, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });

      if (!this.isJsonResponse(res)) {
        this.backendApiDetected = false;
        return {
          success: false,
          statusCode: res.status,
          dbUnavailable: true,
          error: 'SQC backend server did not return a JSON API response. Check that server.cjs is running.',
        };
      }

      this.backendApiDetected = true;
      const json = await res.json().catch(() => ({}));

      if (res.status === 503) {
        if (json?.maintenanceMode) {
          emitMaintenanceLockout(json.message);
          return { success: false, statusCode: 503, error: json.message };
        }
        return {
          success: false,
          statusCode: 503,
          dbUnavailable: true,
          error: json.message || 'PostgreSQL database is currently unavailable.',
        };
      }

      if (res.status === 401) {
        emitAuthInvalidated(json?.message);
        return { success: false, statusCode: 401, error: json?.message || 'Unauthorized.' };
      }

      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          error: json?.message || `PostgreSQL query failed (HTTP ${res.status}).`,
        };
      }

      if (json.maintenanceMode) {
        setCachedMaintenanceStatus(json.maintenanceMode);
      }

      const raw = json.data ? json.data : json;
      return {
        success: true,
        data: {
          users: Array.isArray(raw.users) ? raw.users : [],
          departments: Array.isArray(raw.departments) ? raw.departments : [],
          sections: Array.isArray(raw.sections) ? raw.sections : [],
          machines: Array.isArray(raw.machines) ? raw.machines : [],
          looms: Array.isArray(raw.looms) ? raw.looms : [],
          qualities: Array.isArray(raw.qualities) ? raw.qualities : [],
          standards: Array.isArray(raw.standards) ? raw.standards : [],
          inspections: Array.isArray(raw.inspections) ? raw.inspections : [],
          settings: raw.settings || undefined,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        dbUnavailable: true,
        error: `Cannot reach SQC server / PostgreSQL: ${err?.message || 'Network error'}.`,
      };
    }
  }

  public async fetchAllDataFromPostgres(): Promise<AllPostgresPayload | null> {
    const res = await this.fetchAllDataFromPostgresDetailed();
    return res.success && res.data ? res.data : null;
  }

  public subscribe(callback: (status: PostgresConnectionStatus) => void) {
    this.listeners.push(callback);
    if (this.cachedStatus) {
      callback(this.cachedStatus);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyStatus(status: PostgresConnectionStatus) {
    this.cachedStatus = status;
    this.listeners.forEach(l => l(status));
  }

  public getCachedStatus(): PostgresConnectionStatus | null {
    return this.cachedStatus;
  }

  public getConfig() {
    return {
      apiUrl: this.apiUrl,
      apiKey: this.apiKey,
      syncEnabled: this.syncEnabled,
      isDefaultPlaceholder: isPlaceholderOrDeadUrl(this.apiUrl),
    };
  }

  public setConfig(url: string, key: string, syncEnabled: boolean) {
    this.apiUrl = (url || getDefaultApiUrl()).trim().replace(/\/+$/, '');
    this.apiKey = key.trim();
    this.syncEnabled = syncEnabled;
    this.backendApiDetected = null;
    maintenanceService.resetApiDetection();

    try {
      localStorage.setItem(STORAGE_KEYS.API_URL, this.apiUrl);
      localStorage.setItem(STORAGE_KEYS.API_KEY, this.apiKey);
      localStorage.setItem(STORAGE_KEYS.SYNC_ENABLED, String(syncEnabled));
    } catch {
      // ignore
    }
  }

  public isSyncEnabled(): boolean {
    return this.syncEnabled && !!this.apiUrl && !isPlaceholderOrDeadUrl(this.apiUrl);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('sqc_auth_token') : null;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // ignore
    }
    return headers;
  }

  private async handleMaintenanceResponse(res: Response): Promise<boolean> {
    if (res.status === 503 && this.isJsonResponse(res)) {
      try {
        const clone = res.clone();
        const json = await clone.json();
        if (json?.maintenanceMode) {
          emitMaintenanceLockout(json.message);
          return true;
        }
      } catch {
        // Ignore parse failures
      }
    }
    if (res.status === 401 && hasStoredAuthToken()) {
      emitAuthInvalidated();
    }
    return false;
  }

  // ==========================================
  // 1. CONNECTION TESTING
  // ==========================================
  public async testConnection(): Promise<PostgresConnectionStatus> {
    const checkedAt = new Date().toLocaleTimeString();
    this.backendApiDetected = null;
    maintenanceService.resetApiDetection();

    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      const res: PostgresConnectionStatus = {
        isConnected: false,
        message: 'No live PostgreSQL backend URL configured.',
        checkedAt,
      };
      this.notifyStatus(res);
      return res;
    }

    try {
      const healthRes = await fetch(`${this.apiUrl}/api/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });

      if (!this.isJsonResponse(healthRes)) {
        this.backendApiDetected = false;
        const res: PostgresConnectionStatus = {
          isConnected: false,
          message: `Express API server not attached at ${this.apiUrl}. Start server.cjs.`,
          checkedAt,
        };
        this.notifyStatus(res);
        return res;
      }

      if (!healthRes.ok) {
        let errorMsg = `HTTP ${healthRes.status}`;
        try {
          const errorJson = await healthRes.json();
          errorMsg = errorJson.error || errorJson.message || errorMsg;
        } catch {
          // ignore
        }
        const res: PostgresConnectionStatus = {
          isConnected: false,
          message: errorMsg,
          checkedAt,
        };
        this.notifyStatus(res);
        return res;
      }

      this.backendApiDetected = true;
      const healthData = await healthRes.json();
      if (healthData.maintenanceMode) {
        setCachedMaintenanceStatus(healthData.maintenanceMode);
      }
      const dbName = healthData.database || 'SQC';
      const dbUser = healthData.user || 'postgres';
      const inspectionsCount =
        healthData.stats?.inspections_count !== undefined
          ? Number(healthData.stats.inspections_count)
          : undefined;
      const usersCount =
        healthData.stats?.users_count !== undefined
          ? Number(healthData.stats.users_count)
          : undefined;

      const isOk = healthData.databaseConnected !== false;
      const res: PostgresConnectionStatus = {
        isConnected: isOk,
        message: isOk
          ? `Connected to PostgreSQL database "${dbName}" (User: ${dbUser})!`
          : healthData.error || 'PostgreSQL database is not connected.',
        checkedAt,
        database: dbName,
        user: dbUser,
        postgresVersion: healthData.postgresVersion,
        inspectionsCount,
        usersCount,
      };
      this.notifyStatus(res);
      return res;
    } catch (err: any) {
      const res: PostgresConnectionStatus = {
        isConnected: false,
        message: err.message || 'Backend unreachable. Ensure server is running.',
        checkedAt,
      };
      this.notifyStatus(res);
      return res;
    }
  }

  private cleanErrorMessage(status: number, rawText: string, endpoint: string): string {
    if (!rawText) return `Backend server returned HTTP ${status}`;
    if (
      rawText.includes('Cannot POST') ||
      rawText.includes('Cannot GET') ||
      rawText.includes('Cannot DELETE') ||
      rawText.includes('Cannot PUT') ||
      status === 404
    ) {
      return `Backend route '${endpoint}' returned HTTP 404. Ensure the updated backend server is running.`;
    }
    try {
      const parsed = JSON.parse(rawText);
      if (parsed?.message) return parsed.message;
    } catch {
      // not JSON
    }
    if (rawText.includes('<!DOCTYPE html>') || rawText.includes('<html')) {
      const stripped = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      return stripped.slice(0, 180);
    }
    return rawText;
  }

  // ==========================================
  // 2. USER & SESSION SECURITY APIS
  // ==========================================
  public async fetchCurrentSessionUser(): Promise<{
    ok: boolean;
    status: number;
    user?: UserProfile;
    maintenanceMode?: any;
    dbUnavailable?: boolean;
    message?: string;
  }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl) || !hasStoredAuthToken()) {
      return { ok: false, status: 0 };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/me`, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      if (!this.isJsonResponse(res)) {
        return {
          ok: false,
          status: 503,
          dbUnavailable: true,
          message: 'SQC backend API server did not respond with JSON.',
        };
      }
      const json = await res.json().catch(() => ({}));
      if (res.status === 503) {
        if (json?.maintenanceMode) {
          emitMaintenanceLockout(json.message);
          return { ok: false, status: 503, maintenanceMode: json.maintenanceMode, message: json.message };
        }
        return {
          ok: false,
          status: 503,
          dbUnavailable: true,
          message: json?.message || 'PostgreSQL database is unavailable.',
        };
      }
      if (res.status === 401 || res.status === 403) {
        emitAuthInvalidated(json.message);
        return { ok: false, status: res.status, message: json.message };
      }
      if (res.ok && json.success && json.user) {
        return { ok: true, status: 200, user: json.user, maintenanceMode: json.maintenanceMode };
      }
      return { ok: false, status: res.status, message: json.message };
    } catch (err: any) {
      return {
        ok: false,
        status: 503,
        dbUnavailable: true,
        message: err?.message || 'Unable to connect to SQC server or PostgreSQL.',
      };
    }
  }

  public async updateOwnProfile(
    displayName: string,
    phone: string
  ): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return { success: false, message: 'Backend server URL not configured.' };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ displayName, phone }),
      });
      await this.handleMaintenanceResponse(res);
      if (!this.isJsonResponse(res)) {
        return { success: false, message: 'Express backend API not responding.' };
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: json.message || `HTTP ${res.status}` };
      }
      return { success: true, user: json.user };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error updating profile.' };
    }
  }

  public async changeOwnPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; token?: string; message?: string }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return { success: false, message: 'Backend server URL not configured.' };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await this.handleMaintenanceResponse(res);
      if (!this.isJsonResponse(res)) {
        return { success: false, message: 'Express backend API not responding.' };
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: json.message || `HTTP ${res.status}` };
      }
      return { success: true, token: json.token, message: json.message || 'Password updated.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error updating password.' };
    }
  }

  public async adminResetUserPassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return { success: false, message: 'Backend server URL not configured.' };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      await this.handleMaintenanceResponse(res);
      if (!this.isJsonResponse(res)) {
        return { success: false, message: 'Express backend API not responding.' };
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: json.message || `HTTP ${res.status}` };
      }
      return { success: true, message: json.message || 'Password reset successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error resetting password.' };
    }
  }

  public async syncUserToPostgres(user: UserProfile, plainPassword?: string): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) {
      return { success: false, message: 'PostgreSQL sync disabled or backend URL not set.' };
    }

    const url = `${this.apiUrl}/api/users`;
    try {
      const payload: Record<string, any> = {
        id: user.id,
        username: user.username || (user.email ? user.email.split('@')[0] : user.id),
        employeeCode: user.employeeCode || '',
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId || '',
        departmentName: user.departmentName || '',
        phone: user.phone || '',
        isActive: user.isActive,
        canEditEntries: Boolean(user.canEditEntries),
        canDeleteEntries: Boolean(user.canDeleteEntries),
        permittedModules: Array.isArray(user.permittedModules) ? user.permittedModules : [],
        permittedForms: Array.isArray(user.permittedForms) ? user.permittedForms : [],
        dataScope: user.dataScope || 'OWN',
      };
      if (plainPassword && plainPassword.trim()) {
        payload.password = plainPassword.trim();
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      await this.handleMaintenanceResponse(response);

      if (!response.ok) {
        const err = await response.text();
        const cleanMsg = this.cleanErrorMessage(response.status, err, '/api/users');
        return {
          success: false,
          statusCode: response.status,
          dbUnavailable: response.status === 503,
          message: cleanMsg,
        };
      }

      if (!this.isJsonResponse(response)) {
        return { success: false, dbUnavailable: true, message: 'Express backend API not responding with JSON.' };
      }

      const res = await response.json();
      return { success: true, message: 'User saved to PostgreSQL', data: res.user || res };
    } catch (err: any) {
      return { success: false, dbUnavailable: true, message: err.message || 'Network error syncing user' };
    }
  }

  public async deleteUserFromPostgresDetailed(userId: string): Promise<{ success: boolean; message?: string }> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      await this.handleMaintenanceResponse(res);
      if (res.ok) return { success: true };
      const errText = await res.text();
      return { success: false, message: this.cleanErrorMessage(res.status, errText, '/api/users/:id') };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error deleting user' };
    }
  }

  public async deleteUserFromPostgres(userId: string): Promise<boolean> {
    const res = await this.deleteUserFromPostgresDetailed(userId);
    return res.success;
  }

  public async loadUsersDetailed(): Promise<{
    success: boolean;
    users: UserProfile[];
    message?: string;
    dbUnavailable?: boolean;
  }> {
    if (!this.isSyncEnabled() || !hasStoredAuthToken()) {
      return { success: false, users: [], message: 'Authentication required.' };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/users`, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      await this.handleMaintenanceResponse(res);
      if (!this.isJsonResponse(res)) {
        return {
          success: false,
          users: [],
          dbUnavailable: true,
          message: 'SQC backend API server is not returning JSON.',
        };
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          users: [],
          dbUnavailable: res.status === 503 && Boolean(json?.dbUnavailable),
          message: json?.message || `Failed to load users (HTTP ${res.status}).`,
        };
      }
      return { success: true, users: Array.isArray(json) ? json : [] };
    } catch (err: any) {
      return {
        success: false,
        users: [],
        dbUnavailable: true,
        message: err?.message || 'Unable to load users from PostgreSQL.',
      };
    }
  }

  public async loadUsers(): Promise<UserProfile[]> {
    const res = await this.loadUsersDetailed();
    return res.success ? res.users : [];
  }

  public async fetchAuditLogs(): Promise<{
    success: boolean;
    logs: any[];
    message?: string;
    dbUnavailable?: boolean;
  }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl) || !hasStoredAuthToken()) {
      return { success: false, logs: [], message: 'Authentication or backend URL required.' };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/audit-logs`, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      await this.handleMaintenanceResponse(res);
      if (!this.isJsonResponse(res)) {
        return {
          success: false,
          logs: [],
          dbUnavailable: true,
          message: 'Express backend API is not returning JSON.',
        };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          logs: [],
          dbUnavailable: res.status === 503 && Boolean(data?.dbUnavailable),
          message: data?.message || `Failed to fetch audit logs (HTTP ${res.status}).`,
        };
      }
      return { success: true, logs: Array.isArray(data) ? data : [] };
    } catch (err: any) {
      return {
        success: false,
        logs: [],
        dbUnavailable: true,
        message: err?.message || 'Network error fetching audit logs from PostgreSQL.',
      };
    }
  }

  public async fetchSettingsDetailed(): Promise<{
    success: boolean;
    settings?: any;
    message?: string;
    dbUnavailable?: boolean;
  }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl) || !hasStoredAuthToken()) {
      return { success: false, message: 'Authentication required.' };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/settings`, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      await this.handleMaintenanceResponse(res);
      if (!this.isJsonResponse(res)) {
        return { success: false, dbUnavailable: true, message: 'Express backend API not responding.' };
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          dbUnavailable: res.status === 503 && Boolean(json?.dbUnavailable),
          message: json?.message || `Failed to load settings (HTTP ${res.status}).`,
        };
      }
      return { success: true, settings: json.settings || null };
    } catch (err: any) {
      return {
        success: false,
        dbUnavailable: true,
        message: err?.message || 'Network error loading settings from PostgreSQL.',
      };
    }
  }

  public async fetchSettings(): Promise<any | null> {
    const res = await this.fetchSettingsDetailed();
    return res.success ? res.settings : null;
  }

  public async saveSettingsToPostgres(settings: any): Promise<{ success: boolean; settings?: any; message?: string }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return { success: false, message: 'Backend URL not configured.' };
    }
    try {
      const res = await fetch(`${this.apiUrl}/api/settings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(settings),
      });
      await this.handleMaintenanceResponse(res);
      if (!this.isJsonResponse(res)) {
        return { success: false, message: 'Express backend API not responding.' };
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: json.message || `HTTP ${res.status}` };
      }
      return { success: true, settings: json.settings };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error saving settings.' };
    }
  }

  // ==========================================
  // 3. MASTER DATA SYNCHRONIZATION
  // ==========================================
  public async syncDepartmentToPostgres(dept: Department): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/departments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(dept),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/departments') };
      }
      return { success: true, message: 'Department saved in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteDepartmentFromPostgres(id: string): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/departments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/departments/:id') };
      }
      return { success: true, message: 'Department deleted in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }

  public async syncSectionToPostgres(section: Section): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/sections`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(section),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/sections') };
      }
      return { success: true, message: 'Section saved in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteSectionFromPostgres(id: string): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/sections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/sections/:id') };
      }
      return { success: true, message: 'Section deleted in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }

  public async syncMachineToPostgres(mch: Machine): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/machines`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(mch),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/machines') };
      }
      return { success: true, message: 'Machine saved in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteMachineFromPostgres(id: string): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/machines/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/machines/:id') };
      }
      return { success: true, message: 'Machine deleted in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }

  public async syncLoomToPostgres(loom: Loom): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/looms`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(loom),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/looms') };
      }
      return { success: true, message: 'Loom saved in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteLoomFromPostgres(id: string): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/looms/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/looms/:id') };
      }
      return { success: true, message: 'Loom deleted in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }

  public async syncQualityToPostgres(quality: QualityMaster): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/qualities`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(quality),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/qualities') };
      }
      return { success: true, message: 'Quality saved in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteQualityFromPostgres(id: string): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/qualities/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/qualities/:id') };
      }
      return { success: true, message: 'Quality deleted in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }

  public async syncStandardToPostgres(std: StandardDefinition): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/standards`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: std.id,
          code: std.code || std.standardCode,
          formCode: std.formCode,
          name: std.name,
          parameter: std.parameter,
          nominalValue: std.nominalValue,
          lowerLimit: std.lowerLimit,
          upperLimit: std.upperLimit,
          unit: std.unit,
          tolerance: std.tolerance,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/standards') };
      }
      return { success: true, message: 'Standard saved in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteStandardFromPostgres(id: string): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) return { success: false, message: 'Sync disabled' };
    try {
      const res = await fetch(`${this.apiUrl}/api/standards/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, message: this.cleanErrorMessage(res.status, err, '/api/standards/:id') };
      }
      return { success: true, message: 'Standard deleted in PostgreSQL' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }

  // ==========================================
  // 4. INSPECTION SYNCHRONIZATION
  // ==========================================
  public async syncInspectionToPostgres(inspection: InspectionRecord): Promise<PostgresSyncResult> {
    if (!this.syncEnabled) {
      return { success: false, message: 'PostgreSQL sync is disabled in Settings.' };
    }

    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return {
        success: false,
        dbUnavailable: true,
        message: 'Backend PostgreSQL URL not configured.',
        error: 'Placeholder URL detected',
      };
    }

    const url = `${this.apiUrl}/api/inspections`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: inspection.id,
          inspectionNo: inspection.inspectionNo,
          formId: inspection.formId || inspection.formCode,
          formCode: inspection.formCode,
          formTitle: inspection.formTitle,
          departmentId: inspection.departmentId || '',
          departmentName: inspection.departmentName || '',
          sectionId: inspection.sectionId || '',
          shiftId: inspection.shiftId || 'Shift-A',
          shiftName: inspection.shiftName || 'Shift A',
          qualityId: inspection.qualityId || '',
          qualityName: inspection.qualityName || '',
          productSpecId: inspection.productSpecId || '',
          productSpecName: inspection.productSpecName || '',
          machineId: inspection.machineId || '',
          machineNo: inspection.machineNo || '',
          loomId: inspection.loomId || '',
          loomNo: inspection.loomNo || '',
          godownId: inspection.godownId || '',
          godownName: inspection.godownName || '',
          inspectorId: inspection.inspectorId || '',
          inspectorName: inspection.inspectorName || 'SQC Inspector',
          inspectionDate: inspection.inspectionDate || new Date().toISOString().split('T')[0],
          inspectionTime: inspection.inspectionTime || '',
          status: inspection.status || 'Draft',
          result: inspection.result || 'PASS',
          formData: inspection.formData || {},
          readingRows: inspection.readingRows || [],
          summaryMetrics: inspection.summaryMetrics || {},
          remarks: inspection.remarks || '',
          correctionRemarks: inspection.correctionRemarks || '',
          approvalRemarks: inspection.approvalRemarks || '',
          approvedBy: inspection.approvedBy || null,
          approvedAt: inspection.approvedAt || null,
          submittedBy: inspection.submittedBy || null,
          submittedAt: inspection.submittedAt || null,
          rejectedBy: inspection.rejectedBy || null,
          rejectedAt: inspection.rejectedAt || null,
          version: inspection.version || 1,
          createdBy: inspection.createdBy || inspection.inspectorName || '',
          updatedBy: inspection.updatedBy || inspection.inspectorName || '',
        }),
      });

      if (await this.handleMaintenanceResponse(response)) {
        return {
          success: false,
          message: 'Server is under maintenance. We will be back shortly.',
          error: 'MAINTENANCE_MODE',
        };
      }

      if (!response.ok) {
        const errorBody = await response.text();
        const cleanMsg = this.cleanErrorMessage(response.status, errorBody, '/api/inspections');
        return {
          success: false,
          statusCode: response.status,
          dbUnavailable: response.status === 503,
          message: cleanMsg,
          error: errorBody,
        };
      }

      if (!this.isJsonResponse(response)) {
        return {
          success: false,
          dbUnavailable: true,
          message: `Backend server at ${this.apiUrl} did not return JSON API response.`,
        };
      }

      const saved = await response.json();
      return {
        success: true,
        message: saved.message || `Saved to PostgreSQL (${inspection.inspectionNo})`,
        formTable: saved.formTable,
        data: saved.inspection || saved,
      };
    } catch (err: any) {
      return {
        success: false,
        dbUnavailable: true,
        message: `Cannot reach backend server at ${this.apiUrl}. Ensure server and PostgreSQL are running.`,
        error: err.message,
      };
    }
  }

  public async fetchInspectionByIdDetailed(idOrNo: string): Promise<{
    success: boolean;
    record?: InspectionRecord;
    statusCode?: number;
    dbUnavailable?: boolean;
    message?: string;
  }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl) || !hasStoredAuthToken()) {
      return { success: false, statusCode: 0, message: 'Authentication required.' };
    }
    try {
      const response = await fetch(`${this.apiUrl}/api/inspections/${encodeURIComponent(idOrNo)}`, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      await this.handleMaintenanceResponse(response);
      if (!this.isJsonResponse(response)) {
        return {
          success: false,
          statusCode: response.status,
          dbUnavailable: true,
          message: 'SQC backend server did not return JSON.',
        };
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          dbUnavailable: response.status === 503 && Boolean(data?.dbUnavailable),
          message: data?.message || `Failed to load inspection (HTTP ${response.status}).`,
        };
      }
      return data && data.inspectionNo
        ? { success: true, record: data }
        : { success: false, statusCode: 404, message: 'Inspection record not found in PostgreSQL.' };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 503,
        dbUnavailable: true,
        message: err?.message || 'Unable to connect to PostgreSQL backend.',
      };
    }
  }

  public async fetchInspectionById(idOrNo: string): Promise<InspectionRecord | null> {
    const res = await this.fetchInspectionByIdDetailed(idOrNo);
    return res.success && res.record ? res.record : null;
  }

  public async loadInspections(): Promise<any[]> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl) || !hasStoredAuthToken()) {
      return [];
    }

    const url = `${this.apiUrl}/api/inspections`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      });
      await this.handleMaintenanceResponse(response);

      if (!response.ok || !this.isJsonResponse(response)) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  public async deleteInspectionFromPostgresDetailed(
    inspectionNo: string
  ): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return { success: false, message: 'Backend URL not configured.' };
    }

    const url = `${this.apiUrl}/api/inspections/${encodeURIComponent(inspectionNo)}`;
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      await this.handleMaintenanceResponse(response);
      if (response.ok) return { success: true };
      const errText = await response.text();
      return {
        success: false,
        statusCode: response.status,
        message: this.cleanErrorMessage(response.status, errText, '/api/inspections/:id'),
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error deleting record.' };
    }
  }

  public async deleteInspectionFromPostgres(inspectionNo: string): Promise<boolean> {
    const res = await this.deleteInspectionFromPostgresDetailed(inspectionNo);
    return res.success;
  }

  public async clearAllInspectionsFromPostgres(): Promise<{ success: boolean; message: string }> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return { success: false, message: 'Backend URL not configured.' };
    }

    const url = `${this.apiUrl}/api/inspections/truncate`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (response.ok && this.isJsonResponse(response)) {
        const res = await response.json();
        return { success: true, message: res.message || 'All inspections cleared in PostgreSQL.' };
      } else {
        const errText = await response.text();
        return { success: false, message: `Failed to truncate: ${errText}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error connecting to backend server.' };
    }
  }

  // ==========================================
  // 5. BULK SYNC ALL DATA
  // ==========================================
  public async syncAllDataToPostgres(data: {
    users: UserProfile[];
    departments: Department[];
    sections: Section[];
    machines: Machine[];
    looms: Loom[];
    qualities: QualityMaster[];
    standards: StandardDefinition[];
    inspections: InspectionRecord[];
  }): Promise<PostgresSyncResult> {
    if (!this.apiUrl || isPlaceholderOrDeadUrl(this.apiUrl)) {
      return {
        success: false,
        message: 'Backend server URL is not configured.',
      };
    }

    const url = `${this.apiUrl}/api/sync-all`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (await this.handleMaintenanceResponse(response)) {
        return {
          success: false,
          message: 'Server is under maintenance. We will be back shortly.',
        };
      }

      if (!response.ok || !this.isJsonResponse(response)) {
        const errText = await response.text();
        return { success: false, message: this.cleanErrorMessage(response.status, errText, '/api/sync-all') };
      }

      const res = await response.json();
      return {
        success: true,
        message: res.message || 'Successfully synchronized all data to PostgreSQL!',
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to reach backend server: ${err.message}.`,
      };
    }
  }

  // ==========================================
  // 6. SQL EXPORT HELPER (from live data only)
  // ==========================================
  public generateSqlDumpScript(data: {
    users: UserProfile[];
    departments: Department[];
    sections: Section[];
    machines: Machine[];
    looms: Loom[];
    qualities: QualityMaster[];
    standards: StandardDefinition[];
    inspections: InspectionRecord[];
  }): string {
    const escapeSql = (str: string | undefined | null) => {
      if (str === undefined || str === null) return "''";
      return `'${String(str).replace(/'/g, "''")}'`;
    };

    let sql = `-- ==============================================================================
-- SQC QUALITY CONTROL SYSTEM
-- PostgreSQL Live Data Export Script
-- Database Name: SQC (Port: 5432)
-- Generated on: ${new Date().toISOString()}
-- ==============================================================================

BEGIN;
`;

    sql += `\n-- USERS (${data.users.length} records)\n`;
    data.users.forEach(u => {
      const modsJson = JSON.stringify(Array.isArray(u.permittedModules) ? u.permittedModules : []).replace(/'/g, "''");
      sql += `INSERT INTO users (id, employee_code, display_name, email, role, department_id, department_name, permitted_modules, data_scope, is_active, updated_at)
VALUES (${escapeSql(u.id)}, ${escapeSql(u.employeeCode || u.id)}, ${escapeSql(u.displayName)}, ${escapeSql(u.email)}, ${escapeSql(u.role)}, ${escapeSql(u.departmentId)}, ${escapeSql(u.departmentName)}, '${modsJson}'::jsonb, ${escapeSql(u.dataScope || 'OWN')}, ${u.isActive ? 'TRUE' : 'FALSE'}, NOW())
ON CONFLICT (email) DO UPDATE SET
  employee_code = EXCLUDED.employee_code,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  department_name = EXCLUDED.department_name,
  permitted_modules = EXCLUDED.permitted_modules,
  data_scope = EXCLUDED.data_scope,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();\n`;
    });

    sql += `\n-- DEPARTMENTS (${data.departments.length} records)\n`;
    data.departments.forEach(d => {
      sql += `INSERT INTO departments (id, code, name, hod_name, status, updated_at)
VALUES (${escapeSql(d.id)}, ${escapeSql(d.code)}, ${escapeSql(d.name)}, ${escapeSql(d.hodName)}, ${escapeSql(d.status || 'Active')}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, hod_name = EXCLUDED.hod_name, status = EXCLUDED.status, updated_at = NOW();\n`;
    });

    sql += `\n-- SECTIONS (${data.sections.length} records)\n`;
    data.sections.forEach(s => {
      sql += `INSERT INTO sections (id, code, name, department_code, updated_at)
VALUES (${escapeSql(s.id)}, ${escapeSql(s.code)}, ${escapeSql(s.name)}, ${escapeSql(s.departmentCode)}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_code = EXCLUDED.department_code, updated_at = NOW();\n`;
    });

    sql += `\n-- MACHINES (${data.machines.length} records)\n`;
    data.machines.forEach(m => {
      sql += `INSERT INTO machines (id, code, name, machine_type, department_code, speed_standard, speed_unit, updated_at)
VALUES (${escapeSql(m.id)}, ${escapeSql(m.code)}, ${escapeSql(m.name)}, ${escapeSql(m.machineType)}, ${escapeSql(m.departmentCode)}, ${Number(m.speedStandard || 0)}, ${escapeSql(m.speedUnit || 'rpm')}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, machine_type = EXCLUDED.machine_type, department_code = EXCLUDED.department_code, speed_standard = EXCLUDED.speed_standard, speed_unit = EXCLUDED.speed_unit, updated_at = NOW();\n`;
    });

    sql += `\n-- LOOMS (${data.looms.length} records)\n`;
    data.looms.forEach(l => {
      sql += `INSERT INTO looms (id, code, name, loom_type, shed, standard_rpm, updated_at)
VALUES (${escapeSql(l.id)}, ${escapeSql(l.code)}, ${escapeSql(l.name)}, ${escapeSql(l.loomType)}, ${escapeSql(l.shed)}, ${Number(l.standardRpm || 140)}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, loom_type = EXCLUDED.loom_type, shed = EXCLUDED.shed, standard_rpm = EXCLUDED.standard_rpm, updated_at = NOW();\n`;
    });

    sql += `\n-- QUALITIES (${data.qualities.length} records)\n`;
    data.qualities.forEach(q => {
      sql += `INSERT INTO qualities (id, code, name, category, nominal_count, standard_mr, updated_at)
VALUES (${escapeSql(q.id)}, ${escapeSql(q.code)}, ${escapeSql(q.name)}, ${escapeSql(q.category)}, ${Number(q.nominalCount || 0)}, ${Number(q.standardMR || 17)}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, nominal_count = EXCLUDED.nominal_count, standard_mr = EXCLUDED.standard_mr, updated_at = NOW();\n`;
    });

    sql += `\n-- STANDARDS (${data.standards.length} records)\n`;
    data.standards.forEach(st => {
      sql += `INSERT INTO standards (id, code, form_code, name, parameter, nominal_value, lower_limit, upper_limit, unit, tolerance, updated_at)
VALUES (${escapeSql(st.id)}, ${escapeSql(st.code || (st as any).standardCode)}, ${escapeSql(st.formCode)}, ${escapeSql(st.name)}, ${escapeSql(st.parameter)}, ${Number(st.nominalValue || 0)}, ${Number(st.lowerLimit || 0)}, ${Number(st.upperLimit || 0)}, ${escapeSql(st.unit)}, ${escapeSql(st.tolerance)}, NOW())
ON CONFLICT (code) DO UPDATE SET form_code = EXCLUDED.form_code, name = EXCLUDED.name, parameter = EXCLUDED.parameter, nominal_value = EXCLUDED.nominal_value, lower_limit = EXCLUDED.lower_limit, upper_limit = EXCLUDED.upper_limit, unit = EXCLUDED.unit, tolerance = EXCLUDED.tolerance, updated_at = NOW();\n`;
    });

    sql += `\n-- INSPECTIONS (${data.inspections.length} records)\n`;
    data.inspections.forEach(i => {
      const fData = JSON.stringify(i.formData || {}).replace(/'/g, "''");
      const rRows = JSON.stringify(i.readingRows || []).replace(/'/g, "''");
      const sMetrics = JSON.stringify(i.summaryMetrics || {}).replace(/'/g, "''");

      sql += `INSERT INTO inspections (
  inspection_no, form_id, form_code, form_title, department_id,
  shift_id, shift_name, inspector_id, inspector_name, inspection_date,
  status, result, form_data, reading_rows, summary_metrics, remarks, updated_at
) VALUES (
  ${escapeSql(i.inspectionNo)}, ${escapeSql(i.formId)}, ${escapeSql(i.formCode)}, ${escapeSql(i.formTitle)}, ${escapeSql(i.departmentId)},
  ${escapeSql(i.shiftId)}, ${escapeSql(i.shiftName)}, ${escapeSql(i.inspectorId)}, ${escapeSql(i.inspectorName)}, ${escapeSql(i.inspectionDate)},
  ${escapeSql(i.status)}, ${escapeSql(i.result)}, '${fData}'::jsonb, '${rRows}'::jsonb, '${sMetrics}'::jsonb, ${escapeSql(i.remarks)}, NOW()
) ON CONFLICT (inspection_no) DO UPDATE SET
  form_id = EXCLUDED.form_id, form_code = EXCLUDED.form_code, form_title = EXCLUDED.form_title,
  status = EXCLUDED.status, result = EXCLUDED.result, form_data = EXCLUDED.form_data,
  reading_rows = EXCLUDED.reading_rows, summary_metrics = EXCLUDED.summary_metrics, remarks = EXCLUDED.remarks, updated_at = NOW();\n`;
    });

    sql += `\nCOMMIT;\n`;
    return sql;
  }

  public downloadSqlFile(sqlContent: string, fileName: string = 'sqc_live_export.sql') {
    const blob = new Blob([sqlContent], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const postgresService = new PostgresService();
