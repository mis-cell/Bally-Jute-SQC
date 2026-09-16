// Local PostgreSQL via Cloudflare Tunnel Client Service
import { CustomerRecord, InspectionRecord } from '../types';

const STORAGE_KEYS = {
  API_URL: 'bj_sqc_pg_api_url',
  API_KEY: 'bj_sqc_pg_api_key',
  SYNC_ENABLED: 'bj_sqc_pg_sync_enabled',
};

// Default fallback configuration matching user setup
export const DEFAULT_API_URL =
  (import.meta as any).env?.VITE_API_URL || 'https://blue-example.trycloudflare.com';
export const DEFAULT_API_KEY =
  (import.meta as any).env?.VITE_API_KEY || 'change-this-to-a-long-secret-key-123456';

export interface PostgresConnectionStatus {
  isConnected: boolean;
  message: string;
  checkedAt?: string;
  database?: string;
  user?: string;
  inspectionsCount?: number;
}

export interface PostgresSyncResult {
  success: boolean;
  message: string;
  error?: string;
  data?: any;
}

class PostgresService {
  private apiUrl: string;
  private apiKey: string;
  private syncEnabled: boolean;

  constructor() {
    this.apiUrl = localStorage.getItem(STORAGE_KEYS.API_URL) || DEFAULT_API_URL;
    this.apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || DEFAULT_API_KEY;
    const storedSync = localStorage.getItem(STORAGE_KEYS.SYNC_ENABLED);
    this.syncEnabled = storedSync !== null ? storedSync === 'true' : true;
  }

  public getConfig() {
    return {
      apiUrl: this.apiUrl,
      apiKey: this.apiKey,
      syncEnabled: this.syncEnabled,
      isDefaultPlaceholder: this.apiUrl.includes('blue-example.trycloudflare.com'),
    };
  }

  public setConfig(url: string, key: string, syncEnabled: boolean) {
    this.apiUrl = url.trim().replace(/\/+$/, '');
    this.apiKey = key.trim();
    this.syncEnabled = syncEnabled;

    localStorage.setItem(STORAGE_KEYS.API_URL, this.apiUrl);
    localStorage.setItem(STORAGE_KEYS.API_KEY, this.apiKey);
    localStorage.setItem(STORAGE_KEYS.SYNC_ENABLED, String(syncEnabled));
  }

  public isSyncEnabled(): boolean {
    return this.syncEnabled && !!this.apiUrl;
  }

  /**
   * loadCustomers()
   * Loads customer test records from the local PostgreSQL database via Cloudflare Tunnel.
   */
  public async loadCustomers(): Promise<CustomerRecord[]> {
    if (this.apiUrl.includes('blue-example.trycloudflare.com')) {
      throw new Error(
        'Please enter your real Cloudflare Tunnel URL in Settings. (Currently set to placeholder: blue-example.trycloudflare.com)'
      );
    }

    const url = `${this.apiUrl}/api/customers`;
    console.log(`[PostgresService] Fetching customers from: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('[PostgresService] Customers loaded:', data);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error('[PostgresService] Failed to load customers:', error);
      throw error;
    }
  }

  /**
   * createCustomer()
   * Inserts a customer record into local PostgreSQL
   */
  public async createCustomer(customer: {
    name: string;
    email: string;
    phone?: string;
  }): Promise<CustomerRecord> {
    const url = `${this.apiUrl}/api/customers`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customer),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      console.log('[PostgresService] Customer saved to PostgreSQL:', result);
      return result;
    } catch (error: any) {
      console.error('[PostgresService] Error creating customer:', error);
      throw error;
    }
  }

  /**
   * syncInspectionToPostgres()
   * Transmits a saved inspection form directly into local PostgreSQL table `inspections`.
   * Returns a detailed result object so UI can tell the user if local PostgreSQL sync succeeded or failed.
   */
  public async syncInspectionToPostgres(inspection: InspectionRecord): Promise<PostgresSyncResult> {
    if (!this.syncEnabled) {
      return {
        success: false,
        message: 'PostgreSQL auto-sync is disabled in Settings.',
      };
    }

    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return {
        success: false,
        message:
          'Cloudflare Tunnel URL not configured yet. Go to Settings and enter your actual trycloudflare.com URL.',
        error: 'Placeholder URL detected',
      };
    }

    const url = `${this.apiUrl}/api/inspections`;
    console.log(`[PostgresService] Sending inspection ${inspection.inspectionNo} to local PostgreSQL at: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          inspection_no: inspection.inspectionNo,
          form_id: inspection.formId,
          form_code: inspection.formCode,
          form_title: inspection.formTitle,
          department_id: inspection.departmentId || 'dept-general',
          shift_id: inspection.shiftId || 'A',
          shift_name: inspection.shiftName || 'General',
          inspector_id: inspection.inspectorId || 'u1',
          inspector_name: inspection.inspectorName || 'SQC Inspector',
          inspection_date: inspection.inspectionDate || new Date().toISOString().split('T')[0],
          status: inspection.status || 'Draft',
          result: inspection.result || 'PASS',
          form_data: inspection.formData || {},
          reading_rows: inspection.readingRows || [],
          summary_metrics: inspection.summaryMetrics || {},
          remarks: inspection.remarks || '',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[PostgresService] Local server returned HTTP ${response.status}:`, errorBody);
        return {
          success: false,
          message: `Local API error (HTTP ${response.status}): ${errorBody || response.statusText}`,
          error: errorBody,
        };
      }

      const saved = await response.json();
      console.log('✅ [PostgresService] Inspection saved to local PostgreSQL successfully:', saved);
      return {
        success: true,
        message: `Successfully saved to local PostgreSQL (Inspection #${inspection.inspectionNo})`,
        data: saved,
      };
    } catch (err: any) {
      console.error('[PostgresService] Network / Tunnel Error while saving to PostgreSQL:', err);
      return {
        success: false,
        message: `Cannot reach local server at ${this.apiUrl}. Ensure 'node server.js' and 'cloudflared tunnel' are running.`,
        error: err.message,
      };
    }
  }

  /**
   * loadInspections()
   * Retrieves inspection records directly from the local PostgreSQL database.
   */
  public async loadInspections(): Promise<any[]> {
    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return [];
    }

    const url = `${this.apiUrl}/api/inspections`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[PostgresService] Failed to load inspections from PostgreSQL:', err);
      return [];
    }
  }

  /**
   * deleteInspectionFromPostgres()
   * Deletes a specific inspection record from local PostgreSQL by inspection number.
   */
  public async deleteInspectionFromPostgres(inspectionNo: string): Promise<boolean> {
    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return false;
    }

    const url = `${this.apiUrl}/api/inspections/${encodeURIComponent(inspectionNo)}`;
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });
      return response.ok;
    } catch (err) {
      console.error('[PostgresService] Failed to delete inspection from PostgreSQL:', err);
      return false;
    }
  }

  /**
   * clearAllInspectionsFromPostgres()
   * Wipes/truncates the inspections table in the local PostgreSQL database.
   */
  public async clearAllInspectionsFromPostgres(): Promise<{ success: boolean; message: string }> {
    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return { success: false, message: 'Tunnel URL not configured.' };
    }

    const url = `${this.apiUrl}/api/inspections/truncate`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.ok) {
        const res = await response.json();
        return { success: true, message: res.message || 'All inspections cleared in local PostgreSQL.' };
      } else {
        const errText = await response.text();
        return { success: false, message: `Failed to truncate inspections: ${errText}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error connecting to local server.' };
    }
  }

  /**
   * testConnection()
   * Runs a test to check if the Node.js API and PostgreSQL are accessible through the tunnel.
   */
  public async testConnection(): Promise<PostgresConnectionStatus> {
    const checkedAt = new Date().toLocaleTimeString();

    if (!this.apiUrl) {
      return {
        isConnected: false,
        message: 'No Cloudflare Tunnel URL configured.',
        checkedAt,
      };
    }

    try {
      // 1. First test root health check (verifies Node server + PostgreSQL connectivity)
      const rootRes = await fetch(`${this.apiUrl}/`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!rootRes.ok) {
        return {
          isConnected: false,
          message: `API reachable but returned HTTP ${rootRes.status}`,
          checkedAt,
        };
      }

      let rootData: any = {};
      try {
        rootData = await rootRes.json();
      } catch {
        // Ignored if non-JSON
      }

      // 2. Test authenticated inspections endpoint
      let inspectionsCount: number | undefined;
      try {
        const inspRes = await fetch(`${this.apiUrl}/api/inspections`, {
          method: 'GET',
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        });
        if (inspRes.ok) {
          const inspData = await inspRes.json();
          if (Array.isArray(inspData)) {
            inspectionsCount = inspData.length;
          }
        }
      } catch {
        // Root already confirmed online
      }

      const dbName = rootData.database || 'SQC';
      const dbUser = rootData.user || 'postgres';

      return {
        isConnected: true,
        message: `Successfully connected to local PostgreSQL database "${dbName}" (User: ${dbUser})!`,
        checkedAt,
        database: dbName,
        user: dbUser,
        inspectionsCount,
      };
    } catch (err: any) {
      return {
        isConnected: false,
        message: err.message || 'Tunnel unreachable or server not running.',
        checkedAt,
      };
    }
  }
}

export const postgresService = new PostgresService();
