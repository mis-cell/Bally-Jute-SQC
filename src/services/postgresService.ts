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
  customersCount?: number;
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
   * Matches the requested pattern:
   * const response = await fetch(`${API_URL}/api/customers`, { headers: { "x-api-key": API_KEY } });
   */
  public async loadCustomers(): Promise<CustomerRecord[]> {
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
   */
  public async syncInspectionToPostgres(inspection: InspectionRecord): Promise<boolean> {
    if (!this.isSyncEnabled()) {
      return false;
    }

    const url = `${this.apiUrl}/api/inspections`;
    console.log(`[PostgresService] Syncing inspection ${inspection.inspectionNo} to ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inspection_no: inspection.inspectionNo,
          form_id: inspection.formId,
          form_code: inspection.formCode,
          form_title: inspection.formTitle,
          department_id: inspection.departmentId,
          shift_id: inspection.shiftId,
          shift_name: inspection.shiftName,
          inspector_id: inspection.inspectorId,
          inspector_name: inspection.inspectorName,
          inspection_date: inspection.inspectionDate,
          status: inspection.status,
          result: inspection.result,
          form_data: inspection.formData,
          reading_rows: inspection.readingRows,
          summary_metrics: inspection.summaryMetrics,
          remarks: inspection.remarks,
        }),
      });

      if (!response.ok) {
        console.warn(`[PostgresService] Sync returned HTTP ${response.status}`);
        return false;
      }

      const saved = await response.json();
      console.log('[PostgresService] Inspection saved to PostgreSQL:', saved);
      return true;
    } catch (err) {
      console.warn('[PostgresService] Could not sync inspection to Postgres (Tunnel might be offline):', err);
      return false;
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
      // 1. First test root health check
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

      // 2. Test authenticated endpoint with API key
      const customers = await this.loadCustomers();

      return {
        isConnected: true,
        message: `Successfully connected to local PostgreSQL via Cloudflare Tunnel!`,
        checkedAt,
        customersCount: customers.length,
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
