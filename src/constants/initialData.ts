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

export const INITIAL_SETTINGS: ApplicationSettings = {
  companyName: 'SQC',
  companySubtitle: 'SQC',
  address: '',
  inspectionPrefix: 'SQC/2026-27/',
  financialYear: '2026-2027',
  enableOfflineCache: false,
  requireDualApproval: false,
  autoApprovePass: false,
};

export const INITIAL_DEPARTMENTS: Department[] = [];

export const INITIAL_SECTIONS: Section[] = [];

export const INITIAL_QUALITIES: QualityMaster[] = [];

export const INITIAL_PRODUCT_SPECS: ProductSpecification[] = [];

export const INITIAL_MACHINES: Machine[] = [];

export const INITIAL_LOOMS: Loom[] = [];

export const INITIAL_STANDARDS: StandardDefinition[] = [];

export const INITIAL_USERS: UserProfile[] = [];

export const SEED_INSPECTIONS: InspectionRecord[] = [];

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
