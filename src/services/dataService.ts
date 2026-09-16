// Data Store & Offline Persistence Service
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
import {
  INITIAL_DEPARTMENTS,
  INITIAL_SECTIONS,
  INITIAL_MACHINES,
  INITIAL_LOOMS,
  INITIAL_QUALITIES,
  INITIAL_PRODUCT_SPECS,
  INITIAL_STANDARDS,
  INITIAL_USERS,
  SEED_INSPECTIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_SETTINGS,
} from '../constants/initialData';
import { postgresService, broadcastDataChange } from './postgresService';

// Auto-purge all legacy test & dummy keys on module load
try {
  const legacyKeys = [
    'bj_sqc_inspections',
    'bj_sqc_inspections_v2',
    'bj_sqc_inspections_prod',
    'bj_sqc_audit_logs',
    'bj_sqc_notifications',
    'bj_sqc_test_customers',
  ];
  legacyKeys.forEach(k => {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  });
} catch (e) {
  // Ignore in SSR
}

const STORAGE_KEYS = {
  SETTINGS: 'bj_sqc_settings_prod_v1',
  DEPARTMENTS: 'bj_sqc_departments_prod_v1',
  SECTIONS: 'bj_sqc_sections_prod_v1',
  MACHINES: 'bj_sqc_machines_prod_v1',
  LOOMS: 'bj_sqc_looms_prod_v1',
  QUALITIES: 'bj_sqc_qualities_prod_v1',
  SPECS: 'bj_sqc_specs_prod_v1',
  STANDARDS: 'bj_sqc_standards_prod_v1',
  USERS: 'bj_sqc_users_prod_v1',
  INSPECTIONS: 'bj_sqc_inspections_prod_clean',
  AUDIT_LOGS: 'bj_sqc_audit_logs_prod_clean',
  NOTIFICATIONS: 'bj_sqc_notifications_prod_clean',
  CURRENT_USER: 'bj_sqc_active_user_prod_v1',
};

function getFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Error loading key ${key} from storage:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving key ${key} to storage:`, e);
  }
}

class DataService {
  // Settings
  getSettings(): ApplicationSettings {
    return getFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  }

  updateSettings(settings: Partial<ApplicationSettings>, user: UserProfile): ApplicationSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    saveToStorage(STORAGE_KEYS.SETTINGS, updated);
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'SETTINGS',
      module: 'System Settings',
      details: 'Updated application settings configuration.',
      previousState: current,
      newState: updated,
    });
    return updated;
  }

  // Active User / Auth simulation with real multi-role switching
  getCurrentUser(): UserProfile {
    return getFromStorage(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
  }

  setCurrentUser(user: UserProfile): void {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGIN',
      module: 'Authentication',
      details: `User logged in / switched session to ${user.displayName} (${user.role}).`,
    });
  }

  // Inspections
  getInspections(): InspectionRecord[] {
    const records = getFromStorage<InspectionRecord[]>(STORAGE_KEYS.INSPECTIONS, []);
    // Completely purge any legacy test/dummy demo records
    const clean = records.filter(r => {
      if (!r || !r.id || !r.inspectionNo) return false;
      if (r.id.startsWith('rec-0') || r.id.startsWith('test-')) return false;
      // Filter out specific test records created during dev tests
      if (
        r.inspectionNo.includes('000006') ||
        r.inspectionNo.includes('000007') ||
        r.inspectionNo.includes('000008') ||
        r.inspectionNo.includes('000009')
      ) {
        return false;
      }
      return true;
    });
    if (clean.length !== records.length) {
      saveToStorage(STORAGE_KEYS.INSPECTIONS, clean);
    }
    return clean;
  }

  getInspectionById(id: string): InspectionRecord | undefined {
    return this.getInspections().find(i => i.id === id);
  }

  deleteInspection(id: string, user: UserProfile): boolean {
    const records = this.getInspections();
    const target = records.find(r => r.id === id);
    if (!target) return false;

    const remaining = records.filter(r => r.id !== id);
    saveToStorage(STORAGE_KEYS.INSPECTIONS, remaining);
    broadcastDataChange('local_delete');

    // Also attempt deletion in local PostgreSQL
    postgresService.deleteInspectionFromPostgres(target.inspectionNo).catch(() => {});

    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Inspection',
      recordId: target.id,
      details: `Deleted inspection ${target.inspectionNo} (${target.formCode}).`,
    });

    return true;
  }

  clearAllInspections(user?: UserProfile): void {
    saveToStorage(STORAGE_KEYS.INSPECTIONS, []);
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, []);
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, []);
    localStorage.removeItem('bj_sqc_test_customers');
    if (user) {
      this.addAuditLog({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'DELETE',
        module: 'System Administration',
        details: 'All inspection records and dummy test logs purged for production readiness.',
      });
    }
  }

  saveInspection(record: InspectionRecord, user: UserProfile): InspectionRecord {
    const records = this.getInspections();
    const idx = records.findIndex(r => r.id === record.id);
    let updatedRecord = { ...record };

    if (idx >= 0) {
      updatedRecord.updatedAt = new Date().toISOString();
      updatedRecord.updatedBy = user.displayName;
      records[idx] = updatedRecord;
      this.addAuditLog({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UPDATE',
        module: 'Inspection',
        recordId: record.id,
        details: `Updated inspection ${record.inspectionNo} (${record.formCode}). Status: ${record.status}.`,
      });
    } else {
      updatedRecord.createdAt = new Date().toISOString();
      updatedRecord.createdBy = user.displayName;
      updatedRecord.version = 1;
      records.unshift(updatedRecord);
      this.addAuditLog({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'CREATE',
        module: 'Inspection',
        recordId: record.id,
        details: `Created new inspection ${record.inspectionNo} (${record.formCode}). Result: ${record.result}.`,
      });
    }

    saveToStorage(STORAGE_KEYS.INSPECTIONS, records);
    broadcastDataChange('local_save');

    // Asynchronously replicate to local PostgreSQL via Cloudflare Tunnel
    postgresService.syncInspectionToPostgres(updatedRecord).catch(() => {});

    return updatedRecord;
  }

  submitInspection(id: string, user: UserProfile): InspectionRecord | null {
    const records = this.getInspections();
    const record = records.find(r => r.id === id);
    if (!record) return null;

    record.status = 'Submitted';
    record.submittedBy = user.displayName;
    record.submittedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    record.updatedBy = user.displayName;

    saveToStorage(STORAGE_KEYS.INSPECTIONS, records);
    broadcastDataChange('local_submit');

    // Asynchronously replicate status change to local PostgreSQL
    postgresService.syncInspectionToPostgres(record).catch(() => {});

    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'SUBMIT',
      module: 'Inspection Workflow',
      recordId: record.id,
      details: `Submitted inspection ${record.inspectionNo} for HOD Approval.`,
    });

    this.addNotification({
      title: 'Inspection Submitted for Approval',
      message: `${record.inspectionNo} (${record.formCode}) submitted by ${user.displayName}.`,
      type: 'info',
      linkUrl: `/inspection/${record.id}`,
      recipientRole: 'HOD / Approver',
    });

    return record;
  }

  approveInspection(id: string, remarks: string, user: UserProfile): InspectionRecord | null {
    const records = this.getInspections();
    const record = records.find(r => r.id === id);
    if (!record) return null;

    record.status = 'Approved';
    record.approvedBy = user.displayName;
    record.approvedAt = new Date().toISOString();
    record.approvalRemarks = remarks;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = user.displayName;

    saveToStorage(STORAGE_KEYS.INSPECTIONS, records);
    broadcastDataChange('local_approve');

    // Asynchronously replicate approval status to local PostgreSQL
    postgresService.syncInspectionToPostgres(record).catch(() => {});

    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'APPROVE',
      module: 'Inspection Approval',
      recordId: record.id,
      details: `Approved inspection ${record.inspectionNo}. Remarks: ${remarks || 'None'}.`,
    });

    this.addNotification({
      title: 'Inspection Approved',
      message: `${record.inspectionNo} approved by ${user.displayName}.`,
      type: 'success',
      linkUrl: `/inspection/${record.id}`,
      recipientRole: 'SQC Inspector / User',
    });

    return record;
  }

  rejectInspection(id: string, remarks: string, user: UserProfile): InspectionRecord | null {
    const records = this.getInspections();
    const record = records.find(r => r.id === id);
    if (!record) return null;

    record.status = 'Rejected';
    record.rejectedBy = user.displayName;
    record.rejectedAt = new Date().toISOString();
    record.approvalRemarks = remarks;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = user.displayName;

    saveToStorage(STORAGE_KEYS.INSPECTIONS, records);
    broadcastDataChange('local_reject');

    // Asynchronously replicate rejection status to local PostgreSQL
    postgresService.syncInspectionToPostgres(record).catch(() => {});

    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'REJECT',
      module: 'Inspection Approval',
      recordId: record.id,
      details: `Rejected inspection ${record.inspectionNo}. Reason: ${remarks}.`,
    });

    this.addNotification({
      title: 'Inspection Rejected',
      message: `${record.inspectionNo} rejected by ${user.displayName}. Reason: ${remarks}`,
      type: 'error',
      linkUrl: `/inspection/${record.id}`,
      recipientRole: 'SQC Inspector / User',
    });

    return record;
  }

  returnInspectionForCorrection(id: string, remarks: string, user: UserProfile): InspectionRecord | null {
    const records = this.getInspections();
    const record = records.find(r => r.id === id);
    if (!record) return null;

    record.status = 'Returned';
    record.correctionRemarks = remarks;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = user.displayName;

    saveToStorage(STORAGE_KEYS.INSPECTIONS, records);
    broadcastDataChange('local_return');
    postgresService.syncInspectionToPostgres(record).catch(() => {});

    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'RETURN',
      module: 'Inspection Approval',
      recordId: record.id,
      details: `Returned inspection ${record.inspectionNo} for correction. Note: ${remarks}.`,
    });

    this.addNotification({
      title: 'Inspection Returned for Correction',
      message: `${record.inspectionNo} returned by ${user.displayName}. Remarks: ${remarks}`,
      type: 'warning',
      linkUrl: `/inspection/${record.id}`,
      recipientRole: 'SQC Inspector / User',
    });

    return record;
  }

  // Masters
  getDepartments(): Department[] {
    return getFromStorage(STORAGE_KEYS.DEPARTMENTS, INITIAL_DEPARTMENTS);
  }

  saveDepartment(dept: Department, user: UserProfile): Department[] {
    const list = this.getDepartments();
    const idx = list.findIndex(d => d.id === dept.id);
    if (idx >= 0) {
      list[idx] = { ...dept, updatedAt: new Date().toISOString(), updatedBy: user.displayName };
    } else {
      list.push({ ...dept, createdAt: new Date().toISOString(), createdBy: user.displayName, updatedAt: new Date().toISOString(), updatedBy: user.displayName });
    }
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, list);
    broadcastDataChange('dept_save');
    postgresService.syncDepartmentToPostgres(list[idx >= 0 ? idx : list.length - 1]).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'Master Data',
      recordId: dept.id,
      details: `${idx >= 0 ? 'Updated' : 'Created'} Department ${dept.code} - ${dept.name}`,
    });
    return list;
  }

  deleteDepartment(id: string, user: UserProfile): Department[] {
    const list = this.getDepartments().filter(d => d.id !== id);
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, list);
    broadcastDataChange('dept_delete');
    postgresService.deleteDepartmentFromPostgres(id).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Master Data',
      recordId: id,
      details: `Deleted Department ID ${id}`,
    });
    return list;
  }

  getSections(): Section[] {
    return getFromStorage(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS);
  }

  saveSection(section: Section, user: UserProfile): Section[] {
    const list = this.getSections();
    const idx = list.findIndex(s => s.id === section.id);
    if (idx >= 0) {
      list[idx] = { ...section };
    } else {
      list.push(section);
    }
    saveToStorage(STORAGE_KEYS.SECTIONS, list);
    broadcastDataChange('sec_save');
    postgresService.syncSectionToPostgres(list[idx >= 0 ? idx : list.length - 1]).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'Master Data',
      recordId: section.id,
      details: `${idx >= 0 ? 'Updated' : 'Created'} Section ${section.code} - ${section.name}`,
    });
    return list;
  }

  deleteSection(id: string, user: UserProfile): Section[] {
    const list = this.getSections().filter(s => s.id !== id);
    saveToStorage(STORAGE_KEYS.SECTIONS, list);
    broadcastDataChange('sec_delete');
    postgresService.deleteSectionFromPostgres(id).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Master Data',
      recordId: id,
      details: `Deleted Section ID ${id}`,
    });
    return list;
  }

  getMachines(): Machine[] {
    return getFromStorage(STORAGE_KEYS.MACHINES, INITIAL_MACHINES);
  }

  saveMachine(machine: Machine, user: UserProfile): Machine[] {
    const list = this.getMachines();
    const idx = list.findIndex(m => m.id === machine.id);
    if (idx >= 0) {
      list[idx] = { ...machine, updatedAt: new Date().toISOString(), updatedBy: user.displayName };
    } else {
      list.push({ ...machine, createdAt: new Date().toISOString(), createdBy: user.displayName, updatedAt: new Date().toISOString(), updatedBy: user.displayName });
    }
    saveToStorage(STORAGE_KEYS.MACHINES, list);
    broadcastDataChange('mch_save');
    postgresService.syncMachineToPostgres(list[idx >= 0 ? idx : list.length - 1]).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'Master Data',
      recordId: machine.id,
      details: `${idx >= 0 ? 'Updated' : 'Created'} Machine ${machine.code} - ${machine.name}`,
    });
    return list;
  }

  deleteMachine(id: string, user: UserProfile): Machine[] {
    const list = this.getMachines().filter(m => m.id !== id);
    saveToStorage(STORAGE_KEYS.MACHINES, list);
    broadcastDataChange('mch_delete');
    postgresService.deleteMachineFromPostgres(id).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Master Data',
      recordId: id,
      details: `Deleted Machine ID ${id}`,
    });
    return list;
  }

  getLooms(): Loom[] {
    return getFromStorage(STORAGE_KEYS.LOOMS, INITIAL_LOOMS);
  }

  saveLoom(loom: Loom, user: UserProfile): Loom[] {
    const list = this.getLooms();
    const idx = list.findIndex(l => l.id === loom.id);
    if (idx >= 0) {
      list[idx] = { ...loom, updatedAt: new Date().toISOString(), updatedBy: user.displayName };
    } else {
      list.push({ ...loom, createdAt: new Date().toISOString(), createdBy: user.displayName, updatedAt: new Date().toISOString(), updatedBy: user.displayName });
    }
    saveToStorage(STORAGE_KEYS.LOOMS, list);
    broadcastDataChange('loom_save');
    postgresService.syncLoomToPostgres(list[idx >= 0 ? idx : list.length - 1]).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'Master Data',
      recordId: loom.id,
      details: `${idx >= 0 ? 'Updated' : 'Created'} Loom ${loom.code} - ${loom.name}`,
    });
    return list;
  }

  deleteLoom(id: string, user: UserProfile): Loom[] {
    const list = this.getLooms().filter(l => l.id !== id);
    saveToStorage(STORAGE_KEYS.LOOMS, list);
    broadcastDataChange('loom_delete');
    postgresService.deleteLoomFromPostgres(id).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Master Data',
      recordId: id,
      details: `Deleted Loom ID ${id}`,
    });
    return list;
  }

  getQualities(): QualityMaster[] {
    return getFromStorage(STORAGE_KEYS.QUALITIES, INITIAL_QUALITIES);
  }

  saveQuality(quality: QualityMaster, user: UserProfile): QualityMaster[] {
    const list = this.getQualities();
    const idx = list.findIndex(q => q.id === quality.id);
    if (idx >= 0) {
      list[idx] = { ...quality, updatedAt: new Date().toISOString(), updatedBy: user.displayName };
    } else {
      list.push({ ...quality, createdAt: new Date().toISOString(), createdBy: user.displayName, updatedAt: new Date().toISOString(), updatedBy: user.displayName });
    }
    saveToStorage(STORAGE_KEYS.QUALITIES, list);
    broadcastDataChange('qual_save');
    postgresService.syncQualityToPostgres(list[idx >= 0 ? idx : list.length - 1]).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'Master Data',
      recordId: quality.id,
      details: `${idx >= 0 ? 'Updated' : 'Created'} Quality ${quality.code} - ${quality.name}`,
    });
    return list;
  }

  deleteQuality(id: string, user: UserProfile): QualityMaster[] {
    const list = this.getQualities().filter(q => q.id !== id);
    saveToStorage(STORAGE_KEYS.QUALITIES, list);
    broadcastDataChange('qual_delete');
    postgresService.deleteQualityFromPostgres(id).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Master Data',
      recordId: id,
      details: `Deleted Quality ID ${id}`,
    });
    return list;
  }

  getProductSpecs(): ProductSpecification[] {
    return getFromStorage(STORAGE_KEYS.SPECS, INITIAL_PRODUCT_SPECS);
  }

  getStandards(): StandardDefinition[] {
    return getFromStorage(STORAGE_KEYS.STANDARDS, INITIAL_STANDARDS);
  }

  saveStandard(std: StandardDefinition, user: UserProfile): StandardDefinition[] {
    const list = this.getStandards();
    const idx = list.findIndex(s => s.id === std.id);
    if (idx >= 0) {
      list[idx] = { ...std, updatedAt: new Date().toISOString(), updatedBy: user.displayName };
    } else {
      list.push({ ...std, createdAt: new Date().toISOString(), createdBy: user.displayName, updatedAt: new Date().toISOString(), updatedBy: user.displayName });
    }
    saveToStorage(STORAGE_KEYS.STANDARDS, list);
    broadcastDataChange('std_save');
    postgresService.syncStandardToPostgres(list[idx >= 0 ? idx : list.length - 1]).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'Master Data',
      recordId: std.id,
      details: `${idx >= 0 ? 'Updated' : 'Created'} Standard ${std.code} - ${std.name}`,
    });
    return list;
  }

  deleteStandard(id: string, user: UserProfile): StandardDefinition[] {
    const list = this.getStandards().filter(s => s.id !== id);
    saveToStorage(STORAGE_KEYS.STANDARDS, list);
    broadcastDataChange('std_delete');
    postgresService.deleteStandardFromPostgres(id).catch(() => {});
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'DELETE',
      module: 'Master Data',
      recordId: id,
      details: `Deleted Standard ID ${id}`,
    });
    return list;
  }

  getUsers(): UserProfile[] {
    return getFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
  }

  saveUser(userData: UserProfile, actorUser?: UserProfile): UserProfile[] {
    const list = this.getUsers();
    const idx = list.findIndex(u => u.id === userData.id);
    if (idx >= 0) {
      list[idx] = { ...userData };
    } else {
      list.push(userData);
    }
    saveToStorage(STORAGE_KEYS.USERS, list);
    broadcastDataChange('user_save');
    postgresService.syncUserToPostgres(userData).catch(() => {});
    if (actorUser) {
      this.addAuditLog({
        userId: actorUser.id,
        userEmail: actorUser.email,
        userRole: actorUser.role,
        action: idx >= 0 ? 'UPDATE' : 'CREATE',
        module: 'User Management',
        recordId: userData.id,
        details: `${idx >= 0 ? 'Updated' : 'Created'} User ${userData.displayName} (${userData.role})`,
      });
    }
    return list;
  }

  deleteUser(id: string, actorUser?: UserProfile): UserProfile[] {
    const list = this.getUsers().filter(u => u.id !== id);
    saveToStorage(STORAGE_KEYS.USERS, list);
    broadcastDataChange('user_delete');
    postgresService.deleteUserFromPostgres(id).catch(() => {});
    if (actorUser) {
      this.addAuditLog({
        userId: actorUser.id,
        userEmail: actorUser.email,
        userRole: actorUser.role,
        action: 'DELETE',
        module: 'User Management',
        recordId: id,
        details: `Deleted User ID ${id}`,
      });
    }
    return list;
  }

  // Audit Logs
  getAuditLogs(): AuditLogItem[] {
    const logs = getFromStorage<AuditLogItem[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    const clean = logs.filter(
      l =>
        !l.id.startsWith('log-1') &&
        !l.id.startsWith('log-2') &&
        !l.id.startsWith('log-3') &&
        !l.details?.includes('000006') &&
        !l.details?.includes('000007') &&
        !l.details?.includes('000008') &&
        !l.details?.includes('000009')
    );
    if (clean.length !== logs.length) {
      saveToStorage(STORAGE_KEYS.AUDIT_LOGS, clean);
    }
    return clean;
  }

  addAuditLog(item: Omit<AuditLogItem, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLogItem = {
      ...item,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // Notifications
  getNotifications(): AppNotification[] {
    const notifs = getFromStorage<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const clean = notifs.filter(
      n =>
        !n.id.startsWith('notif-1') &&
        !n.id.startsWith('notif-2') &&
        !n.message?.includes('000006') &&
        !n.message?.includes('000007') &&
        !n.message?.includes('000008') &&
        !n.message?.includes('000009')
    );
    if (clean.length !== notifs.length) {
      saveToStorage(STORAGE_KEYS.NOTIFICATIONS, clean);
    }
    return clean;
  }

  addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const list = this.getNotifications();
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    list.unshift(newNotif);
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, list);
  }

  markNotificationRead(id: string): void {
    const list = this.getNotifications();
    const item = list.find(n => n.id === id);
    if (item) {
      item.read = true;
      saveToStorage(STORAGE_KEYS.NOTIFICATIONS, list);
    }
  }

  // Sequence generator
  generateInspectionNumber(formCode: string): string {
    const settings = this.getSettings();
    const prefix = settings.inspectionPrefix || 'SQC/2026-27/';
    const records = this.getInspections();
    const count = records.length + 1;
    const pad = String(count).padStart(6, '0');
    return `${prefix}${formCode}/${pad}`;
  }

  // Export all current entities for PostgreSQL bulk sync
  getFullDatabaseState() {
    return {
      users: this.getUsers(),
      departments: this.getDepartments(),
      sections: this.getSections(),
      machines: this.getMachines(),
      looms: this.getLooms(),
      qualities: this.getQualities(),
      standards: this.getStandards(),
      inspections: this.getInspections(),
    };
  }

  // Reset to sample state
  resetToFactoryDefaults(user: UserProfile): void {
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, INITIAL_DEPARTMENTS);
    saveToStorage(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS);
    saveToStorage(STORAGE_KEYS.MACHINES, INITIAL_MACHINES);
    saveToStorage(STORAGE_KEYS.LOOMS, INITIAL_LOOMS);
    saveToStorage(STORAGE_KEYS.QUALITIES, INITIAL_QUALITIES);
    saveToStorage(STORAGE_KEYS.SPECS, INITIAL_PRODUCT_SPECS);
    saveToStorage(STORAGE_KEYS.STANDARDS, INITIAL_STANDARDS);
    saveToStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
    saveToStorage(STORAGE_KEYS.INSPECTIONS, []);
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, []);
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, []);
    saveToStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    this.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'SETTINGS',
      module: 'System Administration',
      details: 'Reset application database to initial factory standards.',
    });
  }
}

export const dataService = new DataService();
