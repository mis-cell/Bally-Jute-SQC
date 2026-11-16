// ==============================================================================
// SQC - Maintenance Mode Service
// Coordinates live PostgreSQL maintenance state, polling, and forced logout
// ==============================================================================

import { UserProfile } from '../types';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  activatedBy?: string | null;
  activatedAt?: string | null;
  dbUnavailable?: boolean;
  error?: string;
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  'Server is under maintenance. We will be back shortly.';

// Remove any legacy cached maintenance key on load
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bj_sqc_maintenance_mode');
  }
} catch {
  // ignore
}

let inMemoryStatus: MaintenanceStatus = {
  enabled: false,
  message: DEFAULT_MAINTENANCE_MESSAGE,
  activatedBy: null,
  activatedAt: null,
  dbUnavailable: false,
};

function resolveApiUrl(): string {
  try {
    const stored = localStorage.getItem('bj_sqc_pg_api_url');
    if (
      stored &&
      !stored.includes('blue-example.trycloudflare.com') &&
      !stored.includes('curtis-references-approximately-authorization.trycloudflare.com')
    ) {
      return stored.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && !String(envUrl).includes('trycloudflare.com')) {
    return String(envUrl).trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://127.0.0.1:3001';
}

function getAuthHeaders(): Record<string, string> {
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

export function getCachedMaintenanceStatus(): MaintenanceStatus {
  return inMemoryStatus;
}

export function setCachedMaintenanceStatus(status: Partial<MaintenanceStatus>): MaintenanceStatus {
  inMemoryStatus = {
    enabled: Boolean(status.enabled),
    message: (status.message || '').trim() || DEFAULT_MAINTENANCE_MESSAGE,
    activatedBy: status.activatedBy || null,
    activatedAt: status.activatedAt || null,
    dbUnavailable: Boolean(status.dbUnavailable),
    error: status.error,
  };
  return inMemoryStatus;
}

export function emitMaintenanceLockout(message?: string): void {
  const msg = (message || '').trim() || inMemoryStatus.message || DEFAULT_MAINTENANCE_MESSAGE;
  setCachedMaintenanceStatus({
    ...inMemoryStatus,
    enabled: true,
    message: msg,
    dbUnavailable: false,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bj_sqc_maintenance_forced_logout', {
        detail: { message: msg },
      })
    );
  }
}

class MaintenanceService {
  private isJsonResponse(res: Response): boolean {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return ct.includes('application/json');
  }

  public resetApiDetection(): void {
    // No sticky false cache; every fetch probes live server
  }

  public getCached(): MaintenanceStatus {
    return getCachedMaintenanceStatus();
  }

  public async fetchStatus(_forceRecheck: boolean = false): Promise<MaintenanceStatus> {
    const apiUrl = resolveApiUrl();
    try {
      const res = await fetch(`${apiUrl}/api/maintenance/status`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        cache: 'no-store',
      });
      if (!this.isJsonResponse(res)) {
        return {
          ...inMemoryStatus,
          dbUnavailable: true,
          error: 'SQC backend API server did not respond with JSON.',
        };
      }
      const json = await res.json().catch(() => ({}));
      if (res.status === 503 && json?.dbUnavailable) {
        return {
          ...inMemoryStatus,
          dbUnavailable: true,
          error: json.message || 'PostgreSQL database is currently unavailable.',
        };
      }
      if (res.ok) {
        return setCachedMaintenanceStatus({
          enabled: !!json.enabled,
          message: json.message || DEFAULT_MAINTENANCE_MESSAGE,
          activatedBy: json.activatedBy || null,
          activatedAt: json.activatedAt || null,
          dbUnavailable: false,
          error: undefined,
        });
      }
      return {
        ...inMemoryStatus,
        dbUnavailable: true,
        error: json.message || `Server returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        ...inMemoryStatus,
        dbUnavailable: true,
        error: err?.message || 'Unable to connect to SQC backend server.',
      };
    }
  }

  public async setMaintenanceMode(
    enabled: boolean,
    message: string,
    actor?: UserProfile
  ): Promise<{ success: boolean; status: MaintenanceStatus; notice: string }> {
    const cleanMessage = (message || '').trim() || DEFAULT_MAINTENANCE_MESSAGE;
    const actorName = actor?.displayName || actor?.username || 'Administrator';
    const apiUrl = resolveApiUrl();

    try {
      const res = await fetch(`${apiUrl}/api/maintenance/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          enabled,
          message: cleanMessage,
          activatedBy: actorName,
        }),
      });

      const isJson = this.isJsonResponse(res);
      const json = isJson ? await res.json().catch(() => ({})) : {};
      if (!res.ok || !isJson) {
        return {
          success: false,
          status: inMemoryStatus,
          notice: !isJson
            ? 'SQC Express backend API is not reachable. Start the server and ensure PostgreSQL is running.'
            : json.message || `Failed to update Maintenance Mode in PostgreSQL (HTTP ${res.status}).`,
        };
      }

      const saved = setCachedMaintenanceStatus({
        enabled: !!json.enabled,
        message: json.message || cleanMessage,
        activatedBy: json.activatedBy || null,
        activatedAt: json.activatedAt || null,
        dbUnavailable: false,
        error: undefined,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bj_sqc_maintenance_changed', { detail: saved }));
      }

      return {
        success: true,
        status: saved,
        notice:
          json.notice ||
          (enabled
            ? 'Maintenance Mode activated in PostgreSQL. All non-admin users are locked out.'
            : 'Maintenance Mode deactivated in PostgreSQL. Normal user access restored.'),
      };
    } catch (err: any) {
      return {
        success: false,
        status: inMemoryStatus,
        notice: `Unable to reach server or PostgreSQL database: ${err?.message || 'Network error'}.`,
      };
    }
  }
}

export const maintenanceService = new MaintenanceService();
