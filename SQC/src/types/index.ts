export type UserRole =
  | 'Admin'
  | 'HOD / Approver'
  | 'SQC Inspector / User'
  | 'Viewer / Auditor';

export type AppModule =
  | 'DASHBOARD'
  | 'INSPECTIONS'
  | 'APPROVALS'
  | 'REPORTS'
  | 'MASTERS'
  | 'USERS'
  | 'AUDIT_LOGS'
  | 'SETTINGS';

export type DataScope = 'OWN' | 'DEPARTMENT' | 'ALL';

export const GRANTABLE_MODULES: AppModule[] = [
  'DASHBOARD',
  'INSPECTIONS',
  'APPROVALS',
  'REPORTS',
  'MASTERS',
];

export const ADMIN_ONLY_MODULES: AppModule[] = ['USERS', 'AUDIT_LOGS', 'SETTINGS'];

export const ALL_MODULES: AppModule[] = [...GRANTABLE_MODULES, ...ADMIN_ONLY_MODULES];

export const MODULE_DEFINITIONS: Array<{
  id: AppModule;
  label: string;
  description: string;
  adminOnly: boolean;
}> = [
  {
    id: 'DASHBOARD',
    label: 'Floor Dashboard',
    description: 'View live SQC KPIs, pass/fail status, and quick-launch permitted forms.',
    adminOnly: false,
  },
  {
    id: 'INSPECTIONS',
    label: 'Quality Forms & Inspections',
    description: 'Open inspection registry and enter data for explicitly granted quality forms.',
    adminOnly: false,
  },
  {
    id: 'APPROVALS',
    label: 'Approvals Workflow',
    description: 'Review, approve, return, or reject submitted floor inspections within scope.',
    adminOnly: false,
  },
  {
    id: 'REPORTS',
    label: 'Reports & Analytics',
    description: 'View SQC analytics, summary trends, and export authorized inspection data.',
    adminOnly: false,
  },
  {
    id: 'MASTERS',
    label: 'Master Data',
    description: 'Access and manage departments, sections, machines, looms, qualities, and standards.',
    adminOnly: false,
  },
  {
    id: 'USERS',
    label: 'Users & Form Permissions',
    description: 'Admin-only: manage user accounts, module permissions, data scopes, and password resets.',
    adminOnly: true,
  },
  {
    id: 'AUDIT_LOGS',
    label: 'Audit Trail',
    description: 'Admin-only: inspect immutable authentication, permission, and inspection audit logs.',
    adminOnly: true,
  },
  {
    id: 'SETTINGS',
    label: 'System Settings',
    description: 'Admin-only: configure system parameters and toggle Maintenance Mode.',
    adminOnly: true,
  },
];

export type InspectionStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Returned';

export type InspectionResult = 'PASS' | 'WARNING' | 'FAIL';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  passwordHash?: string;
  displayName: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  employeeCode?: string;
  phone?: string;
  isActive: boolean;
  canEditEntries?: boolean;
  canDeleteEntries?: boolean;
  permittedModules?: AppModule[];
  permittedForms?: string[]; // Array of form codes e.g. ['FORM-01', 'FORM-02']. Empty by default for standard users.
  dataScope?: DataScope; // Explicit record visibility scope: 'OWN' (default), 'DEPARTMENT', or 'ALL'
  tokenVersion?: number;
  createdAt: string;
  lastLoginAt?: string;
}

export interface MasterRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  [key: string]: any;
}

export interface Department extends MasterRecord {
  hodName?: string;
}

export interface Section extends MasterRecord {
  departmentId: string;
  departmentCode?: string;
}

export interface Machine extends MasterRecord {
  departmentId: string;
  sectionId?: string;
  machineType: string;
  speedStandard?: number;
  speedUnit?: string;
}

export interface Loom extends MasterRecord {
  loomType: 'Broad Loom' | 'Narrow Loom' | 'Circular' | 'STB' | 'Ordinary';
  shed?: string;
  standardRpm?: number;
}

export interface QualityMaster extends MasterRecord {
  nominalCount?: number;
  standardMR?: number;
  warpCount?: number;
  weftCount?: number;
  category?: string;
}

export interface ProductSpecification extends MasterRecord {
  qualityId: string;
  specifiedLengthCm?: number;
  specifiedWidthCm?: number;
  specifiedWeightGms?: number;
  specifiedPicks?: number;
  specifiedEnds?: number;
  nominalBaleWeightKg?: number;
}

export interface StandardDefinition extends MasterRecord {
  standardCode: string;
  formCode: string;
  departmentId: string;
  qualityId?: string;
  parameter: string;
  nominalValue: number;
  lowerLimit: number;
  upperLimit: number;
  tolerance: string;
  unit: string;
  effectiveFrom: string;
  effectiveTo?: string;
  revisionNumber: number;
  approvedBy: string;
}

export interface InspectionRecord {
  id: string;
  inspectionNo: string;
  formId: string;
  formCode: string; // e.g. "FORM-01" to "FORM-36"
  formTitle: string;
  departmentId: string;
  departmentName: string;
  sectionId?: string;
  shiftId: string;
  shiftName: string;
  qualityId: string;
  qualityName: string;
  productSpecId?: string;
  productSpecName?: string;
  machineId?: string;
  machineNo?: string;
  loomId?: string;
  loomNo?: string;
  godownId?: string;
  godownName?: string;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: string;
  inspectionTime: string;
  status: InspectionStatus;
  result: InspectionResult;
  standardVersionId?: string;
  summaryMetrics?: Record<string, any>;
  formData: Record<string, any>;
  readingRows: Record<string, any>[];
  remarks?: string;
  correctionRemarks?: string;
  approvalRemarks?: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'DELETE' | 'EXPORT' | 'SETTINGS';
  module: string;
  recordId?: string;
  details: string;
  previousState?: any;
  newState?: any;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  linkUrl?: string;
  recipientRole?: UserRole;
  recipientUserId?: string;
}

export interface CustomerRecord {
  id?: number | string;
  name: string;
  email: string;
  phone?: string;
  created_at?: string;
}

export interface ApplicationSettings {
  companyName: string;
  companySubtitle: string;
  address: string;
  inspectionPrefix: string;
  financialYear: string;
  enableOfflineCache: boolean;
  requireDualApproval: boolean;
  autoApprovePass: boolean;
  // Local PostgreSQL & Cloudflare Tunnel Settings
  postgresApiUrl?: string;
  postgresApiKey?: string;
  enablePostgresSync?: boolean;
}
