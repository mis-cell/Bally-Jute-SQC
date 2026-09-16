// ==============================================================================
// BALLY JUTE COMPANY LIMITED - S.Q.C. QUALITY CONTROL SYSTEM
// Local PostgreSQL via Cloudflare Tunnel Client Service
// Comprehensive Synchronization for Users, Masters, and Inspections
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
  CustomerRecord,
} from '../types';

const STORAGE_KEYS = {
  API_URL: 'bj_sqc_pg_api_url',
  API_KEY: 'bj_sqc_pg_api_key',
  SYNC_ENABLED: 'bj_sqc_pg_sync_enabled',
  LAST_STATUS: 'bj_sqc_pg_last_status',
};

// Default fallback configuration
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
  postgresVersion?: string;
  inspectionsCount?: number;
  usersCount?: number;
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
  private cachedStatus: PostgresConnectionStatus | null = null;
  private listeners: Array<(status: PostgresConnectionStatus) => void> = [];

  constructor() {
    this.apiUrl = localStorage.getItem(STORAGE_KEYS.API_URL) || DEFAULT_API_URL;
    this.apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || DEFAULT_API_KEY;
    const storedSync = localStorage.getItem(STORAGE_KEYS.SYNC_ENABLED);
    this.syncEnabled = storedSync !== null ? storedSync === 'true' : true;

    try {
      const savedStatus = localStorage.getItem(STORAGE_KEYS.LAST_STATUS);
      if (savedStatus) {
        this.cachedStatus = JSON.parse(savedStatus);
      }
    } catch {
      // Ignore
    }
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
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_STATUS, JSON.stringify(status));
    } catch {
      // Ignore
    }
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
    return this.syncEnabled && !!this.apiUrl && !this.apiUrl.includes('blue-example.trycloudflare.com');
  }

  private getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
  }

  // ==========================================
  // 1. CONNECTION TESTING
  // ==========================================
  public async testConnection(): Promise<PostgresConnectionStatus> {
    const checkedAt = new Date().toLocaleTimeString();

    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      const res: PostgresConnectionStatus = {
        isConnected: false,
        message: 'No live Cloudflare Tunnel URL configured. Go to Settings or click Postgres Status to configure.',
        checkedAt,
      };
      this.notifyStatus(res);
      return res;
    }

    try {
      const rootRes = await fetch(`${this.apiUrl}/`, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

      if (!rootRes.ok) {
        let errorMsg = `HTTP ${rootRes.status}`;
        try {
          const errorJson = await rootRes.json();
          if (errorJson.error) {
            if (errorJson.error.includes('password authentication failed')) {
              errorMsg = `PostgreSQL Password Mismatch: The password in your .env file does not match your local PostgreSQL password. Open C:\\my-local-api\\.env, update PGPASSWORD with your actual PostgreSQL password, and restart node server.js.`;
            } else if (errorJson.error.toLowerCase().includes('does not exist') && errorJson.error.includes('SQC')) {
              errorMsg = `Database "SQC" does not exist yet in PostgreSQL. Create it in pgAdmin or DBeaver using: CREATE DATABASE "SQC";`;
            } else {
              errorMsg = errorJson.error;
            }
          } else if (errorJson.message) {
            errorMsg = errorJson.message;
          }
        } catch {
          try {
            errorMsg = await rootRes.text();
          } catch {
            // ignore
          }
        }
        const res: PostgresConnectionStatus = {
          isConnected: false,
          message: errorMsg,
          checkedAt,
        };
        this.notifyStatus(res);
        return res;
      }

      const rootData = await rootRes.json();
      const dbName = rootData.database || 'SQC';
      const dbUser = rootData.user || 'postgres';
      const inspectionsCount = rootData.stats?.inspections_count ? Number(rootData.stats.inspections_count) : undefined;
      const usersCount = rootData.stats?.users_count ? Number(rootData.stats.users_count) : undefined;

      const res: PostgresConnectionStatus = {
        isConnected: true,
        message: `Connected to PostgreSQL database "${dbName}" (User: ${dbUser})!`,
        checkedAt,
        database: dbName,
        user: dbUser,
        postgresVersion: rootData.postgresVersion,
        inspectionsCount,
        usersCount,
      };
      this.notifyStatus(res);
      return res;
    } catch (err: any) {
      const res: PostgresConnectionStatus = {
        isConnected: false,
        message: err.message || 'Tunnel unreachable. Ensure node server.js and cloudflared tunnel are running.',
        checkedAt,
      };
      this.notifyStatus(res);
      return res;
    }
  }

  // ==========================================
  // 2. USER SYNCHRONIZATION
  // ==========================================
  public async syncUserToPostgres(user: UserProfile): Promise<PostgresSyncResult> {
    if (!this.isSyncEnabled()) {
      return { success: false, message: 'PostgreSQL sync disabled or tunnel URL not set.' };
    }

    const url = `${this.apiUrl}/api/users`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: user.id,
          employeeCode: user.employeeCode,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId || '',
          departmentName: user.departmentName || '',
          isActive: user.isActive,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, message: `Local API Error: ${err}` };
      }

      const res = await response.json();
      console.log(`👤 [PostgresService] User ${user.displayName} synced to PostgreSQL`);
      return { success: true, message: `User saved to local PostgreSQL`, data: res };
    } catch (err: any) {
      console.error('[PostgresService] Failed to sync user to PostgreSQL:', err);
      return { success: false, message: err.message || 'Network error syncing user' };
    }
  }

  public async deleteUserFromPostgres(userId: string): Promise<boolean> {
    if (!this.isSyncEnabled()) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (err) {
      console.error('[PostgresService] Failed to delete user from PostgreSQL:', err);
      return false;
    }
  }

  public async loadUsers(): Promise<UserProfile[]> {
    if (!this.isSyncEnabled()) return [];
    try {
      const res = await fetch(`${this.apiUrl}/api/users`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch {
      return [];
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
      return { success: res.ok, message: res.ok ? 'Department saved in PostgreSQL' : await res.text() };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteDepartmentFromPostgres(id: string): Promise<boolean> {
    if (!this.isSyncEnabled()) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/departments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
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
      return { success: res.ok, message: res.ok ? 'Section saved in PostgreSQL' : await res.text() };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteSectionFromPostgres(id: string): Promise<boolean> {
    if (!this.isSyncEnabled()) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/sections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
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
      return { success: res.ok, message: res.ok ? 'Machine saved in PostgreSQL' : await res.text() };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteMachineFromPostgres(id: string): Promise<boolean> {
    if (!this.isSyncEnabled()) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/machines/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
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
      return { success: res.ok, message: res.ok ? 'Loom saved in PostgreSQL' : await res.text() };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteLoomFromPostgres(id: string): Promise<boolean> {
    if (!this.isSyncEnabled()) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/looms/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
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
      return { success: res.ok, message: res.ok ? 'Quality saved in PostgreSQL' : await res.text() };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteQualityFromPostgres(id: string): Promise<boolean> {
    if (!this.isSyncEnabled()) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/qualities/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
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
      return { success: res.ok, message: res.ok ? 'Standard saved in PostgreSQL' : await res.text() };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteStandardFromPostgres(id: string): Promise<boolean> {
    if (!this.isSyncEnabled()) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/standards/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ==========================================
  // 4. INSPECTION SYNCHRONIZATION
  // ==========================================
  public async syncInspectionToPostgres(inspection: InspectionRecord): Promise<PostgresSyncResult> {
    if (!this.syncEnabled) {
      return { success: false, message: 'PostgreSQL auto-sync is disabled in Settings.' };
    }

    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return {
        success: false,
        message: 'Cloudflare Tunnel URL not configured yet. Go to Settings and enter your actual trycloudflare.com URL.',
        error: 'Placeholder URL detected',
      };
    }

    const url = `${this.apiUrl}/api/inspections`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
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
        return {
          success: false,
          message: `Local API error (HTTP ${response.status}): ${errorBody || response.statusText}`,
          error: errorBody,
        };
      }

      const saved = await response.json();
      console.log('✅ [PostgresService] Inspection saved to local PostgreSQL:', saved);
      return {
        success: true,
        message: `Saved to local PostgreSQL (Inspection #${inspection.inspectionNo})`,
        data: saved,
      };
    } catch (err: any) {
      console.error('[PostgresService] Tunnel Error while saving to PostgreSQL:', err);
      return {
        success: false,
        message: `Cannot reach local server at ${this.apiUrl}. Ensure 'node server.js' and 'cloudflared tunnel' are running.`,
        error: err.message,
      };
    }
  }

  public async loadInspections(): Promise<any[]> {
    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return [];
    }

    const url = `${this.apiUrl}/api/inspections`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  public async deleteInspectionFromPostgres(inspectionNo: string): Promise<boolean> {
    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return false;
    }

    const url = `${this.apiUrl}/api/inspections/${encodeURIComponent(inspectionNo)}`;
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async clearAllInspectionsFromPostgres(): Promise<{ success: boolean; message: string }> {
    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return { success: false, message: 'Tunnel URL not configured.' };
    }

    const url = `${this.apiUrl}/api/inspections/truncate`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (response.ok) {
        const res = await response.json();
        return { success: true, message: res.message || 'All inspections cleared in local PostgreSQL.' };
      } else {
        const errText = await response.text();
        return { success: false, message: `Failed to truncate: ${errText}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error connecting to local server.' };
    }
  }

  // ==========================================
  // 5. BULK SYNC ALL DATA (ONE-CLICK PUSH)
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
    if (!this.apiUrl || this.apiUrl.includes('blue-example.trycloudflare.com')) {
      return {
        success: false,
        message: 'Please configure your live Cloudflare Tunnel URL in Settings first.',
      };
    }

    const url = `${this.apiUrl}/api/sync-all`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errText = await response.text();
        if (response.status === 404 || errText.includes('Cannot POST /api/sync-all')) {
          return {
            success: false,
            message:
              '⚠️ Local server.js needs to be updated: The running server.js file is an older version that does not have the /api/sync-all route. Please download or copy the updated server.js from the "Tunnel Config & Commands" tab, replace C:\\my-local-api\\server.js, and restart node server.js.',
          };
        }
        return { success: false, message: `Bulk Sync Error: ${errText}` };
      }

      const res = await response.json();
      return {
        success: true,
        message: res.message || 'Successfully synchronized all data to local PostgreSQL!',
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to reach local server: ${err.message}. Make sure server.js and cloudflared tunnel are running.`,
      };
    }
  }

  // ==========================================
  // 6. INSTANT SQL DUMP SCRIPT GENERATOR
  // ==========================================
  /**
   * Generates a fully compliant SQL file that the user can execute directly
   * in psql or pgAdmin: `psql -U postgres -d SQC -f import_sqc_data.sql`
   */
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
-- BALLY JUTE COMPANY LIMITED - S.Q.C. QUALITY CONTROL SYSTEM
-- Local PostgreSQL Bulk Database Import Script
-- Database Name: SQC (Port: 5432)
-- Generated on: ${new Date().toISOString()}
-- ==============================================================================

BEGIN;

-- 1. Ensure Tables Exist
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL,
  department_id VARCHAR(100),
  department_name VARCHAR(150),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  hod_name VARCHAR(150),
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sections (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  department_code VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS machines (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  machine_type VARCHAR(100),
  department_code VARCHAR(50),
  speed_standard NUMERIC DEFAULT 0,
  speed_unit VARCHAR(30) DEFAULT 'rpm',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS looms (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  loom_type VARCHAR(100),
  shed VARCHAR(100),
  standard_rpm INTEGER DEFAULT 140,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qualities (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  nominal_count NUMERIC DEFAULT 0,
  standard_mr NUMERIC DEFAULT 17,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standards (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  form_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  parameter VARCHAR(150),
  nominal_value NUMERIC DEFAULT 0,
  lower_limit NUMERIC DEFAULT 0,
  upper_limit NUMERIC DEFAULT 0,
  unit VARCHAR(50),
  tolerance VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  inspection_no VARCHAR(100) UNIQUE NOT NULL,
  form_id VARCHAR(50) NOT NULL,
  form_code VARCHAR(30) NOT NULL,
  form_title VARCHAR(255) NOT NULL,
  department_id VARCHAR(100),
  shift_id VARCHAR(50),
  shift_name VARCHAR(100),
  inspector_id VARCHAR(100),
  inspector_name VARCHAR(150),
  inspection_date VARCHAR(30),
  status VARCHAR(50) DEFAULT 'Draft',
  result VARCHAR(30) DEFAULT 'PASS',
  form_data JSONB DEFAULT '{}'::jsonb,
  reading_rows JSONB DEFAULT '[]'::jsonb,
  summary_metrics JSONB DEFAULT '{}'::jsonb,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. USERS (${data.users.length} records)
-- =====================================================
`;

    data.users.forEach(u => {
      sql += `INSERT INTO users (id, employee_code, display_name, email, role, department_id, department_name, is_active, updated_at)
VALUES (${escapeSql(u.id)}, ${escapeSql(u.employeeCode || u.id)}, ${escapeSql(u.displayName)}, ${escapeSql(u.email)}, ${escapeSql(u.role)}, ${escapeSql(u.departmentId)}, ${escapeSql(u.departmentName)}, ${u.isActive ? 'TRUE' : 'FALSE'}, NOW())
ON CONFLICT (email) DO UPDATE SET
  employee_code = EXCLUDED.employee_code,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  department_name = EXCLUDED.department_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();\n`;
    });

    sql += `\n-- =====================================================
-- 3. DEPARTMENTS (${data.departments.length} records)
-- =====================================================\n`;
    data.departments.forEach(d => {
      sql += `INSERT INTO departments (id, code, name, hod_name, status, updated_at)
VALUES (${escapeSql(d.id)}, ${escapeSql(d.code)}, ${escapeSql(d.name)}, ${escapeSql(d.hodName)}, ${escapeSql(d.status || 'Active')}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, hod_name = EXCLUDED.hod_name, status = EXCLUDED.status, updated_at = NOW();\n`;
    });

    sql += `\n-- =====================================================
-- 4. SECTIONS (${data.sections.length} records)
-- =====================================================\n`;
    data.sections.forEach(s => {
      sql += `INSERT INTO sections (id, code, name, department_code, updated_at)
VALUES (${escapeSql(s.id)}, ${escapeSql(s.code)}, ${escapeSql(s.name)}, ${escapeSql(s.departmentCode)}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department_code = EXCLUDED.department_code, updated_at = NOW();\n`;
    });

    sql += `\n-- =====================================================
-- 5. MACHINES (${data.machines.length} records)
-- =====================================================\n`;
    data.machines.forEach(m => {
      sql += `INSERT INTO machines (id, code, name, machine_type, department_code, speed_standard, speed_unit, updated_at)
VALUES (${escapeSql(m.id)}, ${escapeSql(m.code)}, ${escapeSql(m.name)}, ${escapeSql(m.machineType)}, ${escapeSql(m.departmentCode)}, ${Number(m.speedStandard || 0)}, ${escapeSql(m.speedUnit || 'rpm')}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, machine_type = EXCLUDED.machine_type, department_code = EXCLUDED.department_code, speed_standard = EXCLUDED.speed_standard, speed_unit = EXCLUDED.speed_unit, updated_at = NOW();\n`;
    });

    sql += `\n-- =====================================================
-- 6. LOOMS (${data.looms.length} records)
-- =====================================================\n`;
    data.looms.forEach(l => {
      sql += `INSERT INTO looms (id, code, name, loom_type, shed, standard_rpm, updated_at)
VALUES (${escapeSql(l.id)}, ${escapeSql(l.code)}, ${escapeSql(l.name)}, ${escapeSql(l.loomType)}, ${escapeSql(l.shed)}, ${Number(l.standardRpm || 140)}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, loom_type = EXCLUDED.loom_type, shed = EXCLUDED.shed, standard_rpm = EXCLUDED.standard_rpm, updated_at = NOW();\n`;
    });

    sql += `\n-- =====================================================
-- 7. QUALITIES (${data.qualities.length} records)
-- =====================================================\n`;
    data.qualities.forEach(q => {
      sql += `INSERT INTO qualities (id, code, name, category, nominal_count, standard_mr, updated_at)
VALUES (${escapeSql(q.id)}, ${escapeSql(q.code)}, ${escapeSql(q.name)}, ${escapeSql(q.category)}, ${Number(q.nominalCount || 0)}, ${Number(q.standardMR || 17)}, NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, nominal_count = EXCLUDED.nominal_count, standard_mr = EXCLUDED.standard_mr, updated_at = NOW();\n`;
    });

    sql += `\n-- =====================================================
-- 8. STANDARDS (${data.standards.length} records)
-- =====================================================\n`;
    data.standards.forEach(st => {
      sql += `INSERT INTO standards (id, code, form_code, name, parameter, nominal_value, lower_limit, upper_limit, unit, tolerance, updated_at)
VALUES (${escapeSql(st.id)}, ${escapeSql(st.code || (st as any).standardCode)}, ${escapeSql(st.formCode)}, ${escapeSql(st.name)}, ${escapeSql(st.parameter)}, ${Number(st.nominalValue || 0)}, ${Number(st.lowerLimit || 0)}, ${Number(st.upperLimit || 0)}, ${escapeSql(st.unit)}, ${escapeSql(st.tolerance)}, NOW())
ON CONFLICT (code) DO UPDATE SET form_code = EXCLUDED.form_code, name = EXCLUDED.name, parameter = EXCLUDED.parameter, nominal_value = EXCLUDED.nominal_value, lower_limit = EXCLUDED.lower_limit, upper_limit = EXCLUDED.upper_limit, unit = EXCLUDED.unit, tolerance = EXCLUDED.tolerance, updated_at = NOW();\n`;
    });

    sql += `\n-- =====================================================
-- 9. INSPECTIONS (${data.inspections.length} records)
-- =====================================================\n`;
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

    sql += `\nCOMMIT;\n\n-- Finished successfully. Verify with:\n-- SELECT COUNT(*) FROM users;\n-- SELECT COUNT(*) FROM departments;\n-- SELECT COUNT(*) FROM inspections;\n`;
    return sql;
  }

  /**
   * Helper to trigger browser download of the SQL file
   */
  public downloadSqlFile(sqlContent: string, fileName: string = 'bally_jute_sqc_export.sql') {
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

  // Deprecated customer methods for backward compatibility
  public async loadCustomers(): Promise<CustomerRecord[]> {
    return [];
  }
  public async createCustomer(): Promise<any> {
    return {};
  }
}

export const postgresService = new PostgresService();
