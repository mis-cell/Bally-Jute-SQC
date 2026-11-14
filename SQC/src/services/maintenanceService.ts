// ==============================================================================
// SQC - Maintenance Mode Service
// Coordinates PostgreSQL persisted maintenance state, polling, and forced logout
// ==============================================================================

import { UserProfile } from '../types';
import { dataService } from './dataService';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  activatedBy?: string | null;
  activatedAt?: string | null;
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  'Server is under maintenance. We will be back shortly.';

const MAINTENANCE_STORAGE_KEY = 'bj_sqc_maintenance_mode';

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
    'x-api-key':
      (typeof window !== 'undefined' ? localStorage.getItem('bj_sqc_pg_api_key') : null) ||
      (import.meta as any).env?.VITE_API_KEY ||
      'change-this-to-a-long-secret-key-123456',
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
  try {
    const raw = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: !!parsed.enabled,
        message: parsed.message || DEFAULT_MAINTENANCE_MESSAGE,
        activatedBy: parsed.activatedBy || null,
        activatedAt: parsed.activatedAt || null,
      };
    }
  } catch {
    // ignore
  }
  return {
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    activatedBy: null,
    activatedAt: null,
  };
}

export function setCachedMaintenanceStatus(status: Partial<MaintenanceStatus>): MaintenanceStatus {
  const next: MaintenanceStatus = {
    enabled: !!status.enabled,
    message: (status.message || '').trim() || DEFAULT_MAINTENANCE_MESSAGE,
    activatedBy: status.activatedBy || null,
    activatedAt: status.activatedAt || null,
  };
  try {
    localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function emitMaintenanceLockout(message?: string): void {
  const msg = (message || '').trim() || getCachedMaintenanceStatus().message || DEFAULT_MAINTENANCE_MESSAGE;
  setCachedMaintenanceStatus({
    ...getCachedMaintenanceStatus(),
    enabled: true,
    message: msg,
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
  private apiAvailable: boolean | null = null;

  private isJsonResponse(res: Response): boolean {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return ct.includes('application/json');
  }

  public resetApiDetection(): void {
    this.apiAvailable = null;
  }

  public getCached(): MaintenanceStatus {
    return getCachedMaintenanceStatus();
  }

  public async fetchStatus(forceRecheck: boolean = false): Promise<MaintenanceStatus> {
    if (!forceRecheck && this.apiAvailable === false) {
      return getCachedMaintenanceStatus();
    }

    const apiUrl = resolveApiUrl();
    try {
      const res = await fetch(`${apiUrl}/api/maintenance/status`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        cache: 'no-store',
      });
      if (this.isJsonResponse(res)) {
        this.apiAvailable = true;
        if (res.ok) {
          const json = await res.json();
          const next = setCachedMaintenanceStatus({
            enabled: !!json.enabled,
            message: json.message || DEFAULT_MAINTENANCE_MESSAGE,
            activatedBy: json.activatedBy || null,
            activatedAt: json.activatedAt || null,
          });
          return next;
        }
      } else {
        this.apiAvailable = false;
      }
    } catch {
      this.apiAvailable = false;
    }
    return getCachedMaintenanceStatus();
  }

  public async setMaintenanceMode(
    enabled: boolean,
    message: string,
    actor?: UserProfile
  ): Promise<{ success: boolean; status: MaintenanceStatus; notice: string }> {
    this.apiAvailable = null;
    const cleanMessage = (message || '').trim() || DEFAULT_MAINTENANCE_MESSAGE;
    const actorName = actor?.displayName || actor?.username || 'Administrator';
    const optimistic: MaintenanceStatus = {
      enabled,
      message: cleanMessage,
      activatedBy: enabled ? actorName : null,
      activatedAt: enabled ? new Date().toISOString() : null,
    };

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
        if (!isJson) {
          // Vite preview fallback without Express API attached
          const saved = setCachedMaintenanceStatus(optimistic);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bj_sqc_maintenance_changed', { detail: saved }));
          }
          return {
            success: true,
            status: saved,
            notice: 'Updated locally (Express backend not attached to this preview).',
          };
        }
        return {
          success: false,
          status: getCachedMaintenanceStatus(),
          notice: json.message || `Failed to update Maintenance Mode (HTTP ${res.status}).`,
        };
      }

      const saved = setCachedMaintenanceStatus({
        enabled: !!json.enabled,
        message: json.message || cleanMessage,
        activatedBy: json.activatedBy || null,
        activatedAt: json.activatedAt || null,
      });

      if (actor) {
        dataService.addAuditLog({
          userId: actor.id,
          userEmail: actor.email,
          userRole: actor.role,
          action: 'SETTINGS',
          module: 'System Maintenance',
          details: enabled
            ? `Activated Maintenance Mode. Message: "${cleanMessage}"`
            : 'Deactivated Maintenance Mode and restored normal user access.',
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bj_sqc_maintenance_changed', { detail: saved }));
      }

      return {
        success: true,
        status: saved,
        notice:
          json.notice ||
          (enabled
            ? 'Maintenance Mode activated. All non-admin users are locked out.'
            : 'Maintenance Mode deactivated. Normal user access restored.'),
      };
    } catch (err: any) {
      // Offline local fallback toggle
      const saved = setCachedMaintenanceStatus(optimistic);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bj_sqc_maintenance_changed', { detail: saved }));
      }
      return {
        success: true,
        status: saved,
        notice: `Updated locally (${err?.message || 'server unreachable'}).`,
      };
    }
  }
}

export const maintenanceService = new MaintenanceService();
