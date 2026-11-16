// ==============================================================================
// SQC Live In-Memory Store Synchronized Strictly With PostgreSQL
// Zero localStorage/sessionStorage/offline/fallback business data persistence
// ==============================================================================

import {
  Department,
  Section,
  Machine,
  Loom,
  QualityMaster,
  ProductSpecification,
  StandardDefinition,
  InspectionRecord,
  AuditLogItem,
  AppNotification,
  ApplicationSettings,
  UserProfile,
} from '../types';
import { INITIAL_SETTINGS } from '../constants/initialData';
import { postgresService, AllPostgresPayload, broadcastDataChange } from './postgresService';

const LEGACY_STORAGE_KEYS = [
  'bj_sqc_inspections',
  'bj_sqc_inspections_v2',
  'bj_sqc_inspections_prod',
  'bj_sqc_audit_logs',
  'bj_sqc_notifications',
  'bj_sqc_test_customers',
  'bj_sqc_settings_prod_v1',
  'bj_sqc_departments_prod_v1',
  'bj_sqc_sections_prod_v1',
  'bj_sqc_machines_prod_v1',
  'bj_sqc_looms_prod_v1',
  'bj_sqc_qualities_prod_v1',
  'bj_sqc_specs_prod_v1',
  'bj_sqc_standards_prod_v1',
  'bj_sqc_users_prod_v1',
  'bj_sqc_inspections_prod_clean',
  'bj_sqc_audit_logs_prod_clean',
  'bj_sqc_notifications_prod_clean',
  'bj_sqc_active_user_prod_v1',
  'sqc_auth_current_user',
  'bj_sqc_maintenance_mode',
  'bj_sqc_pg_last_status',
];

function purgeLegacyBrowserStorage() {
  if (typeof window === 'undefined') return;
  LEGACY_STORAGE_KEYS.forEach(k => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
    try {
      sessionStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
}

purgeLegacyBrowserStorage();

class DataService {
  private settings: ApplicationSettings = { ...INITIAL_SETTINGS };
  private departments: Department[] = [];
  private sections: Section[] = [];
  private machines: Machine[] = [];
  private looms: Loom[] = [];
  private qualities: QualityMaster[] = [];
  private productSpecs: ProductSpecification[] = [];
  private standards: StandardDefinition[] = [];
  private users: UserProfile[] = [];
  private inspections: InspectionRecord[] = [];
  private auditLogs: AuditLogItem[] = [];
  private notifications: AppNotification[] = [];

  constructor() {
    postgresService.registerDataHydrator(payload => this.hydrateFromPostgres(payload));
  }

  public clearAllCaches(): void {
    purgeLegacyBrowserStorage();
    this.settings = { ...INITIAL_SETTINGS };
    this.departments = [];
    this.sections = [];
    this.machines = [];
    this.looms = [];
    this.qualities = [];
    this.productSpecs = [];
    this.standards = [];
    this.users = [];
    this.inspections = [];
    this.auditLogs = [];
    this.notifications = [];
    broadcastDataChange('clear_cache');
  }

  public clearSensitiveUserCaches(): void {
    purgeLegacyBrowserStorage();
    this.users = [];
    this.inspections = [];
    this.auditLogs = [];
    this.notifications = [];
  }

  /**
   * Unconditionally replaces in-memory live state from PostgreSQL payload (including empty arrays [])
   */
  public hydrateFromPostgres(data: AllPostgresPayload): void {
    purgeLegacyBrowserStorage();

    if (postgresService.isSessionAdmin() && Array.isArray(data.users)) {
      this.users = data.users
        .filter(u => u && u.id !== 'user-superadmin' && u.username !== 'superadmin')
        .map(({ passwordHash: _ph, ...rest }) => rest as UserProfile);
    } else if (!postgresService.isSessionAdmin()) {
      this.users = [];
    }

    if (Array.isArray(data.departments)) this.departments = [...data.departments];
    if (Array.isArray(data.sections)) this.sections = [...data.sections];
    if (Array.isArray(data.machines)) this.machines = [...data.machines];
    if (Array.isArray(data.looms)) this.looms = [...data.looms];
    if (Array.isArray(data.qualities)) this.qualities = [...data.qualities];
    if (Array.isArray(data.standards)) this.standards = [...data.standards];
    if (Array.isArray(data.inspections)) {
      this.inspections = [...data.inspections].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }
    if (data.settings) {
      this.settings = { ...INITIAL_SETTINGS, ...data.settings };
    }
  }

  // Settings
  getSettings(): ApplicationSettings {
    return this.settings;
  }

  setSettings(settings: Partial<ApplicationSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  async updateSettings(
    settings: Partial<ApplicationSettings>
  ): Promise<{ success: boolean; settings: ApplicationSettings; message?: string }> {
    const next = { ...this.settings, ...settings };
    const pgRes = await postgresService.saveSettingsToPostgres(next);
    if (!pgRes.success) {
      return {
        success: false,
        settings: this.settings,
        message: pgRes.message || 'Failed to save settings to PostgreSQL.',
      };
    }
    this.settings = pgRes.settings ? { ...INITIAL_SETTINGS, ...pgRes.settings } : next;
    broadcastDataChange('settings_save');
    return { success: true, settings: this.settings };
  }

  // Inspections (Live In-Memory Mirror of PostgreSQL)
  getInspections(): InspectionRecord[] {
    return this.inspections;
  }

  getInspectionById(id: string): InspectionRecord | undefined {
    return this.inspections.find(i => i.id === id || i.inspectionNo === id);
  }

  upsertInMemoryInspection(record: InspectionRecord): InspectionRecord {
    const idx = this.inspections.findIndex(
      r => r.id === record.id || r.inspectionNo === record.inspectionNo
    );
    if (idx >= 0) {
      this.inspections = [
        ...this.inspections.slice(0, idx),
        record,
        ...this.inspections.slice(idx + 1),
      ];
    } else {
      this.inspections = [record, ...this.inspections];
    }
    broadcastDataChange('inspection_upsert');
    return record;
  }

  removeInMemoryInspection(idOrNo: string): boolean {
    const before = this.inspections.length;
    this.inspections = this.inspections.filter(
      r => r.id !== idOrNo && r.inspectionNo !== idOrNo
    );
    if (this.inspections.length !== before) {
      broadcastDataChange('inspection_delete');
      return true;
    }
    return false;
  }

  async deleteInspection(
    id: string,
    user: UserProfile
  ): Promise<{ success: boolean; message?: string }> {
    const isAdmin = user?.role === 'Admin';
    if (!isAdmin && !user?.canDeleteEntries) {
      return { success: false, message: 'Forbidden: Delete permission is not enabled.' };
    }
    const target = this.getInspectionById(id);
    if (!target) {
      return { success: false, message: 'Inspection record not found.' };
    }

    const pgRes = await postgresService.deleteInspectionFromPostgresDetailed(target.inspectionNo);
    if (!pgRes.success) {
      return {
        success: false,
        message: pgRes.message || 'Failed to delete inspection in PostgreSQL.',
      };
    }

    this.removeInMemoryInspection(target.id);
    return { success: true };
  }

  async clearAllInspections(): Promise<{ success: boolean; message: string }> {
    const pgRes = await postgresService.clearAllInspectionsFromPostgres();
    if (!pgRes.success) {
      return pgRes;
    }
    this.inspections = [];
    broadcastDataChange('inspections_cleared');
    return pgRes;
  }

  // Masters (PostgreSQL-first writes; memory updates only on server confirmation)
  getDepartments(): Department[] {
    return this.departments;
  }

  async saveDepartment(
    dept: Department,
    user: UserProfile
  ): Promise<{ success: boolean; list: Department[]; message?: string }> {
    const existing = this.departments.findIndex(d => d.id === dept.id);
    const nowIso = new Date().toISOString();
    const record: Department =
      existing >= 0
        ? { ...dept, updatedAt: nowIso, updatedBy: user.displayName }
        : {
            ...dept,
            createdAt: dept.createdAt || nowIso,
            createdBy: dept.createdBy || user.displayName,
            updatedAt: nowIso,
            updatedBy: user.displayName,
          };

    const pgRes = await postgresService.syncDepartmentToPostgres(record);
    if (!pgRes.success) {
      return { success: false, list: this.departments, message: pgRes.message };
    }

    if (existing >= 0) {
      this.departments = [
        ...this.departments.slice(0, existing),
        record,
        ...this.departments.slice(existing + 1),
      ];
    } else {
      this.departments = [...this.departments, record];
    }
    broadcastDataChange('dept_save');
    return { success: true, list: this.departments };
  }

  async deleteDepartment(
    id: string
  ): Promise<{ success: boolean; list: Department[]; message?: string }> {
    const pgRes = await postgresService.deleteDepartmentFromPostgres(id);
    if (!pgRes.success) {
      return { success: false, list: this.departments, message: pgRes.message };
    }
    this.departments = this.departments.filter(d => d.id !== id);
    broadcastDataChange('dept_delete');
    return { success: true, list: this.departments };
  }

  getSections(): Section[] {
    return this.sections;
  }

  async saveSection(
    section: Section
  ): Promise<{ success: boolean; list: Section[]; message?: string }> {
    const pgRes = await postgresService.syncSectionToPostgres(section);
    if (!pgRes.success) {
      return { success: false, list: this.sections, message: pgRes.message };
    }
    const existing = this.sections.findIndex(s => s.id === section.id);
    if (existing >= 0) {
      this.sections = [
        ...this.sections.slice(0, existing),
        section,
        ...this.sections.slice(existing + 1),
      ];
    } else {
      this.sections = [...this.sections, section];
    }
    broadcastDataChange('sec_save');
    return { success: true, list: this.sections };
  }

  async deleteSection(
    id: string
  ): Promise<{ success: boolean; list: Section[]; message?: string }> {
    const pgRes = await postgresService.deleteSectionFromPostgres(id);
    if (!pgRes.success) {
      return { success: false, list: this.sections, message: pgRes.message };
    }
    this.sections = this.sections.filter(s => s.id !== id);
    broadcastDataChange('sec_delete');
    return { success: true, list: this.sections };
  }

  getMachines(): Machine[] {
    return this.machines;
  }

  async saveMachine(
    machine: Machine,
    user: UserProfile
  ): Promise<{ success: boolean; list: Machine[]; message?: string }> {
    const existing = this.machines.findIndex(m => m.id === machine.id);
    const nowIso = new Date().toISOString();
    const record: Machine =
      existing >= 0
        ? { ...machine, updatedAt: nowIso, updatedBy: user.displayName }
        : {
            ...machine,
            createdAt: machine.createdAt || nowIso,
            createdBy: machine.createdBy || user.displayName,
            updatedAt: nowIso,
            updatedBy: user.displayName,
          };

    const pgRes = await postgresService.syncMachineToPostgres(record);
    if (!pgRes.success) {
      return { success: false, list: this.machines, message: pgRes.message };
    }
    if (existing >= 0) {
      this.machines = [
        ...this.machines.slice(0, existing),
        record,
        ...this.machines.slice(existing + 1),
      ];
    } else {
      this.machines = [...this.machines, record];
    }
    broadcastDataChange('mch_save');
    return { success: true, list: this.machines };
  }

  async deleteMachine(
    id: string
  ): Promise<{ success: boolean; list: Machine[]; message?: string }> {
    const pgRes = await postgresService.deleteMachineFromPostgres(id);
    if (!pgRes.success) {
      return { success: false, list: this.machines, message: pgRes.message };
    }
    this.machines = this.machines.filter(m => m.id !== id);
    broadcastDataChange('mch_delete');
    return { success: true, list: this.machines };
  }

  getLooms(): Loom[] {
    return this.looms;
  }

  async saveLoom(
    loom: Loom,
    user: UserProfile
  ): Promise<{ success: boolean; list: Loom[]; message?: string }> {
    const existing = this.looms.findIndex(l => l.id === loom.id);
    const nowIso = new Date().toISOString();
    const record: Loom =
      existing >= 0
        ? { ...loom, updatedAt: nowIso, updatedBy: user.displayName }
        : {
            ...loom,
            createdAt: loom.createdAt || nowIso,
            createdBy: loom.createdBy || user.displayName,
            updatedAt: nowIso,
            updatedBy: user.displayName,
          };

    const pgRes = await postgresService.syncLoomToPostgres(record);
    if (!pgRes.success) {
      return { success: false, list: this.looms, message: pgRes.message };
    }
    if (existing >= 0) {
      this.looms = [
        ...this.looms.slice(0, existing),
        record,
        ...this.looms.slice(existing + 1),
      ];
    } else {
      this.looms = [...this.looms, record];
    }
    broadcastDataChange('loom_save');
    return { success: true, list: this.looms };
  }

  async deleteLoom(
    id: string
  ): Promise<{ success: boolean; list: Loom[]; message?: string }> {
    const pgRes = await postgresService.deleteLoomFromPostgres(id);
    if (!pgRes.success) {
      return { success: false, list: this.looms, message: pgRes.message };
    }
    this.looms = this.looms.filter(l => l.id !== id);
    broadcastDataChange('loom_delete');
    return { success: true, list: this.looms };
  }

  getQualities(): QualityMaster[] {
    return this.qualities;
  }

  async saveQuality(
    quality: QualityMaster,
    user: UserProfile
  ): Promise<{ success: boolean; list: QualityMaster[]; message?: string }> {
    const existing = this.qualities.findIndex(q => q.id === quality.id);
    const nowIso = new Date().toISOString();
    const record: QualityMaster =
      existing >= 0
        ? { ...quality, updatedAt: nowIso, updatedBy: user.displayName }
        : {
            ...quality,
            createdAt: quality.createdAt || nowIso,
            createdBy: quality.createdBy || user.displayName,
            updatedAt: nowIso,
            updatedBy: user.displayName,
          };

    const pgRes = await postgresService.syncQualityToPostgres(record);
    if (!pgRes.success) {
      return { success: false, list: this.qualities, message: pgRes.message };
    }
    if (existing >= 0) {
      this.qualities = [
        ...this.qualities.slice(0, existing),
        record,
        ...this.qualities.slice(existing + 1),
      ];
    } else {
      this.qualities = [...this.qualities, record];
    }
    broadcastDataChange('qual_save');
    return { success: true, list: this.qualities };
  }

  async deleteQuality(
    id: string
  ): Promise<{ success: boolean; list: QualityMaster[]; message?: string }> {
    const pgRes = await postgresService.deleteQualityFromPostgres(id);
    if (!pgRes.success) {
      return { success: false, list: this.qualities, message: pgRes.message };
    }
    this.qualities = this.qualities.filter(q => q.id !== id);
    broadcastDataChange('qual_delete');
    return { success: true, list: this.qualities };
  }

  getProductSpecs(): ProductSpecification[] {
    return this.productSpecs;
  }

  getStandards(): StandardDefinition[] {
    return this.standards;
  }

  async saveStandard(
    std: StandardDefinition,
    user: UserProfile
  ): Promise<{ success: boolean; list: StandardDefinition[]; message?: string }> {
    const existing = this.standards.findIndex(s => s.id === std.id);
    const nowIso = new Date().toISOString();
    const record: StandardDefinition =
      existing >= 0
        ? { ...std, updatedAt: nowIso, updatedBy: user.displayName }
        : {
            ...std,
            createdAt: std.createdAt || nowIso,
            createdBy: std.createdBy || user.displayName,
            updatedAt: nowIso,
            updatedBy: user.displayName,
          };

    const pgRes = await postgresService.syncStandardToPostgres(record);
    if (!pgRes.success) {
      return { success: false, list: this.standards, message: pgRes.message };
    }
    if (existing >= 0) {
      this.standards = [
        ...this.standards.slice(0, existing),
        record,
        ...this.standards.slice(existing + 1),
      ];
    } else {
      this.standards = [...this.standards, record];
    }
    broadcastDataChange('std_save');
    return { success: true, list: this.standards };
  }

  async deleteStandard(
    id: string
  ): Promise<{ success: boolean; list: StandardDefinition[]; message?: string }> {
    const pgRes = await postgresService.deleteStandardFromPostgres(id);
    if (!pgRes.success) {
      return { success: false, list: this.standards, message: pgRes.message };
    }
    this.standards = this.standards.filter(s => s.id !== id);
    broadcastDataChange('std_delete');
    return { success: true, list: this.standards };
  }

  // Users (Live mirror synced from /api/users or /api/all-data)
  getUsers(): UserProfile[] {
    return this.users;
  }

  setUsers(users: UserProfile[]): void {
    this.users = (users || [])
      .filter(u => u && u.id !== 'user-superadmin' && u.username !== 'superadmin')
      .map(({ passwordHash: _ph, ...u }) => u as UserProfile);
    broadcastDataChange('users_update');
  }

  // Audit Logs (in-memory only; AuditTrailPage fetches directly from PostgreSQL)
  getAuditLogs(): AuditLogItem[] {
    return this.auditLogs;
  }

  addAuditLog(item: Omit<AuditLogItem, 'id' | 'timestamp'>): void {
    const newLog: AuditLogItem = {
      ...item,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs = [newLog, ...this.auditLogs.slice(0, 499)];
  }

  logAudit(item: Omit<AuditLogItem, 'id' | 'timestamp'>): void {
    this.addAuditLog(item);
  }

  // Notifications (volatile session alerts only)
  getNotifications(): AppNotification[] {
    return this.notifications;
  }

  addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.notifications = [newNotif, ...this.notifications.slice(0, 99)];
  }

  markNotificationRead(id: string): void {
    this.notifications = this.notifications.map(n => (n.id === id ? { ...n, read: true } : n));
  }

  markNotificationsAsRead(): void {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
  }

  // Non-reusing Sequence generator based on highest existing sequence number
  generateInspectionNumber(formCode: string): string {
    const prefix = this.settings.inspectionPrefix || 'SQC/2026-27/';
    const targetPrefix = `${prefix}${formCode}/`;
    let maxSeq = 0;
    for (const r of this.inspections) {
      if (r.inspectionNo && r.inspectionNo.startsWith(targetPrefix)) {
        const m = r.inspectionNo.match(/(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n) && n > maxSeq) {
            maxSeq = n;
          }
        }
      }
    }
    const pad = String(maxSeq + 1).padStart(6, '0');
    return `${targetPrefix}${pad}`;
  }

  // Export all current live entities from memory (populated from PostgreSQL)
  getFullDatabaseState() {
    return {
      users: this.users,
      departments: this.departments,
      sections: this.sections,
      machines: this.machines,
      looms: this.looms,
      qualities: this.qualities,
      standards: this.standards,
      inspections: this.inspections,
    };
  }
}

export const dataService = new DataService();
