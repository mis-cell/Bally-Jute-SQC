// Bally Jute Company Limited - SQC System Types
export type UserRole = 'Super Admin' | 'Admin' | 'HOD / Approver' | 'SQC Inspector / User' | 'Viewer / Auditor';

export type InspectionStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Returned';

export type InspectionResult = 'PASS' | 'WARNING' | 'FAIL';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  employeeCode?: string;
  phone?: string;
  isActive: boolean;
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

export interface ApplicationSettings {
  companyName: string;
  companySubtitle: string;
  address: string;
  inspectionPrefix: string;
  financialYear: string;
  enableOfflineCache: boolean;
  requireDualApproval: boolean;
  autoApprovePass: boolean;
}
