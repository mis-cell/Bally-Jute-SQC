// ==============================================================================
// SQC - STATISTICAL QUALITY CONTROL MANAGEMENT SYSTEM
// Production Backend Server
// Target Server : BJCL
// Target DB     : "SQC"
// Default Port  : 3001
// ==============================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const API_KEY = process.env.API_KEY || 'change-this-to-a-long-secret-key-123456';
const JWT_SECRET = process.env.JWT_SECRET || 'bjcl-sqc-jwt-secret-2026-quality-control';
const DB_NAME = process.env.PGDATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME || 'SQC';
const DB_HOST = process.env.PGHOST || process.env.LOCAL_DB_HOST || process.env.DB_HOST || '127.0.0.1';

// 1. CORS Configuration for Local & Static IP Remote Access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'ngrok-skip-browser-warning'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 2. PostgreSQL Connection Pool
const pool = new Pool({
  host: DB_HOST,
  port: parseInt(process.env.PGPORT || process.env.LOCAL_DB_PORT || process.env.DB_PORT || '5432', 10),
  database: DB_NAME,
  user: process.env.PGUSER || process.env.LOCAL_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.LOCAL_DB_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let isDatabaseConnected = false;

// Global Maintenance Mode state (persisted in PostgreSQL `system_settings`)
let maintenanceState = {
  enabled: false,
  message: 'Server is under maintenance. We will be back shortly.',
  activatedBy: null,
  activatedAt: null,
};

// 3. Individual 38 Form Table Registry (module-level for ALL endpoints)
const FORM_TABLE_MAP = {
  'FORM-01': 'form_01_raw_jute_moisture',
  'FORM-02': 'form_02_emulsion_test',
  'FORM-03': 'form_03_breaker_card',
  'FORM-04': 'form_04_finisher_card',
  'FORM-05': 'form_05_drawing_1',
  'FORM-06': 'form_06_drawing_2',
  'FORM-07': 'form_07_drawing_3',
  'FORM-08': 'form_08_spinning_quality_ratio',
  'FORM-09': 'form_09_warp_winding',
  'FORM-09 A': 'form_09a_weft_winding',
  'FORM-09 B': 'form_09b_beaming',
  'FORM-10': 'form_10_weaving_efficiency',
  'FORM-11': 'form_11_hessian_quality',
  'FORM-12': 'form_12_sacking_quality',
  'FORM-13': 'form_13_damping_calendering',
  'FORM-14': 'form_14_cutting_check',
  'FORM-15': 'form_15_hemming_stitch',
  'FORM-16': 'form_16_herackle_stitch',
  'FORM-17': 'form_17_bag_inspection',
  'FORM-18': 'form_18_baling_press',
  'FORM-19': 'form_19_dispatch_container',
  'FORM-20': 'form_20_central_testing_lab',
  'FORM-21': 'form_21_moisture_meter_calibration',
  'FORM-22': 'form_22_scale_calibration',
  'FORM-23': 'form_23_warp_twist',
  'FORM-24': 'form_24_weft_twist',
  'FORM-25': 'form_25_jute_fineness',
  'FORM-26': 'form_26_oil_droplet',
  'FORM-27': 'form_27_waste_analysis',
  'FORM-28': 'form_28_roller_slippage',
  'FORM-29': 'form_29_tape_tension',
  'FORM-30': 'form_30_warp_stop_motion',
  'FORM-31': 'form_31_weft_feeler',
  'FORM-32': 'form_32_seam_strength',
  'FORM-33': 'form_33_drop_test',
  'FORM-34': 'form_34_ash_content',
  'FORM-35': 'form_35_oil_content',
  'FORM-36': 'form_36_humidity_temperature',
  'FORM-37': 'form_09b_beaming',
};

const UNIQUE_FORM_TABLES = Array.from(new Set(Object.values(FORM_TABLE_MAP)));

function resolveFormTable(formCode) {
  if (!formCode) return null;
  const raw = String(formCode).trim().toUpperCase();
  if (FORM_TABLE_MAP[raw]) return FORM_TABLE_MAP[raw];
  if (raw === 'FORM-09A') return FORM_TABLE_MAP['FORM-09 A'];
  if (raw === 'FORM-09B') return FORM_TABLE_MAP['FORM-09 B'];
  const compact = raw.replace(/\s+/g, ' ');
  return FORM_TABLE_MAP[compact] || null;
}

const ALLOWED_ROLES = [
  'Admin',
  'HOD / Approver',
  'SQC Inspector / User',
  'Viewer / Auditor',
];
const GRANTABLE_MODULES = ['DASHBOARD', 'INSPECTIONS', 'APPROVALS', 'REPORTS', 'MASTERS'];
const ADMIN_ONLY_MODULES = ['USERS', 'AUDIT_LOGS', 'SETTINGS'];
const ALL_MODULES = [...GRANTABLE_MODULES, ...ADMIN_ONLY_MODULES];
const ALLOWED_DATA_SCOPES = ['OWN', 'DEPARTMENT', 'ALL'];
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

// In-memory fallback users (used ONLY if PostgreSQL is offline; never uses plaintext bypasses)
const fallbackUsers = new Map([
  [
    'usr-admin-01',
    {
      id: 'usr-admin-01',
      username: 'admin',
      password_hash: 'bjcl_sqc_salt_2026:5d5a621bd54309c980763fcb42e09fd15c0ad7b82994b1ff985b30475b42c2fc',
      employee_code: 'EMP-001',
      display_name: 'System Administrator',
      email: 'admin@ballyjute.com',
      role: 'Admin',
      department_id: '',
      department_name: 'Administration',
      phone: '',
      is_active: true,
      can_edit_entries: true,
      can_delete_entries: true,
      permitted_modules: [...ALL_MODULES],
      data_scope: 'ALL',
      token_version: 1,
      permittedForms: ['*'],
    },
  ],
]);

function isAdminRole(role) {
  return role === 'Admin';
}

function isHodRole(role) {
  return role === 'HOD / Approver' || role === 'HOD' || role === 'Approver';
}

function isLegacyElevatedRole(role) {
  const compact = String(role || '').replace(/\s+/g, '').toLowerCase();
  return compact === 'superadmin';
}

function sanitizeRole(role, fallback = 'SQC Inspector / User') {
  if (ALLOWED_ROLES.includes(role)) return role;
  if (role === 'HOD' || role === 'Approver') return 'HOD / Approver';
  if (role === 'Inspector' || role === 'Operator') return 'SQC Inspector / User';
  if (role === 'Auditor') return 'Viewer / Auditor';
  return fallback;
}

function sanitizeModules(modules, role) {
  if (isAdminRole(role)) return [...ALL_MODULES];
  if (!Array.isArray(modules)) return [];
  const valid = new Set(GRANTABLE_MODULES);
  return Array.from(
    new Set(
      modules
        .map(m => String(m || '').trim().toUpperCase())
        .filter(m => valid.has(m))
    )
  );
}

function sanitizeDataScope(scope, role) {
  if (isAdminRole(role)) return 'ALL';
  const clean = String(scope || '').trim().toUpperCase();
  return ALLOWED_DATA_SCOPES.includes(clean) ? clean : 'OWN';
}

function hasModuleAccess(user, moduleCode) {
  if (!user || !user.is_active) return false;
  if (isAdminRole(user.role)) return true;
  const mods = Array.isArray(user.permittedModules)
    ? user.permittedModules
    : sanitizeModules(parseJsonSafe(user.permitted_modules, []), user.role);
  return mods.includes(String(moduleCode || '').trim().toUpperCase());
}

function hasAnyModuleAccess(user, moduleCodes = []) {
  return moduleCodes.some(m => hasModuleAccess(user, m));
}

function expandFormCodeAliases(formCode) {
  const c = String(formCode || '').trim().toUpperCase();
  const out = new Set([c]);
  if (c === 'FORM-09' || c === 'FORM-09 A' || c === 'FORM-09A') {
    out.add('FORM-09');
    out.add('FORM-09 A');
  }
  if (c === 'FORM-37' || c === 'FORM-09 B' || c === 'FORM-09B') {
    out.add('FORM-37');
    out.add('FORM-09 B');
  }
  return Array.from(out);
}

// 4. Cryptographic Password Hashing (scrypt + legacy hash migration support, no shortcuts)
function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

function hashPassword(password, customSalt = null) {
  const salt = customSalt || generateSalt();
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function safeHexEqual(hexA, hexB) {
  try {
    const a = Buffer.from(hexA, 'hex');
    const b = Buffer.from(hexB, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false;
    const derived = crypto.scryptSync(String(password), parts[1], 64).toString('hex');
    return safeHexEqual(derived, parts[2]);
  }

  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || !parts[2] || !parts[3]) return false;
    const derived = crypto.pbkdf2Sync(String(password), parts[2], iterations, 32, 'sha256').toString('hex');
    return safeHexEqual(derived, parts[3]);
  }

  const colonParts = storedHash.split(':');
  if (colonParts.length === 2 && colonParts[0] && colonParts[1]) {
    const [salt, expectedHash] = colonParts;
    const computedHash = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
    return safeHexEqual(computedHash, expectedHash);
  }

  return false;
}

function signAuthToken({ userId, tokenVersion = 1 }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId,
    tokenVersion: Number(tokenVersion || 1),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sigB64}`;
}

function verifySignedToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(parts[0]).digest('base64url');
    const a = Buffer.from(parts[1], 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!payload || !payload.userId) return null;
    if (payload.exp && Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseJsonSafe(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val;
}

// 5. DTO Mappers (PostgreSQL snake_case -> Frontend camelCase; never exposes password_hash)
function mapUserRow(u, permittedForms) {
  const role = isAdminRole(u.role) ? 'Admin' : sanitizeRole(u.role);
  const permittedModules = sanitizeModules(parseJsonSafe(u.permitted_modules, []), role);
  const dataScope = sanitizeDataScope(u.data_scope, role);
  return {
    id: u.id,
    username: u.username || (u.email ? u.email.split('@')[0] : u.id),
    employeeCode: u.employee_code || '',
    displayName: u.display_name,
    email: u.email,
    role,
    departmentId: u.department_id || '',
    departmentName: u.department_name || '',
    phone: u.phone || '',
    isActive: u.is_active !== false,
    canEditEntries: isAdminRole(role) || Boolean(u.can_edit_entries),
    canDeleteEntries: isAdminRole(role) || Boolean(u.can_delete_entries),
    permittedModules,
    permittedForms: isAdminRole(role) ? ['*'] : (permittedForms || []),
    dataScope,
    tokenVersion: Number(u.token_version || 1),
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

function mapInspectionRow(r) {
  return {
    id: r.id,
    inspectionNo: r.inspection_no,
    formId: r.form_id || r.form_code,
    formCode: r.form_code,
    formTitle: r.form_title,
    departmentId: r.department_id || '',
    departmentName: r.department_name || '',
    sectionId: r.section_id || '',
    shiftId: r.shift_id || '',
    shiftName: r.shift_name || '',
    qualityId: r.quality_id || '',
    qualityName: r.quality_name || '',
    productSpecId: r.product_spec_id || '',
    productSpecName: r.product_spec_name || '',
    machineId: r.machine_id || '',
    machineNo: r.machine_no || '',
    loomId: r.loom_id || '',
    loomNo: r.loom_no || '',
    godownId: r.godown_id || '',
    godownName: r.godown_name || '',
    inspectorId: r.inspector_id || '',
    inspectorName: r.inspector_name || '',
    inspectionDate: r.inspection_date || '',
    inspectionTime: r.inspection_time || '',
    status: r.status || 'Draft',
    result: r.result || 'PASS',
    formData: parseJsonSafe(r.form_data, {}),
    readingRows: parseJsonSafe(r.reading_rows, []),
    summaryMetrics: parseJsonSafe(r.summary_metrics, {}),
    remarks: r.remarks || '',
    correctionRemarks: r.correction_remarks || '',
    approvalRemarks: r.approval_remarks || '',
    approvedBy: r.approved_by || undefined,
    approvedAt: r.approved_at || undefined,
    version: Number(r.version || 1),
    createdBy: r.created_by || '',
    createdAt: r.created_at,
    updatedBy: r.updated_by || '',
    updatedAt: r.updated_at,
  };
}

function mapDepartmentRow(d) {
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description || '',
    hodName: d.hod_name || '',
    orderIndex: Number(d.order_index || 0),
    status: d.status || 'Active',
    isActive: d.is_active !== false,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapSectionRow(s) {
  return {
    id: s.id,
    departmentId: s.department_id || '',
    departmentCode: s.department_code || '',
    code: s.code,
    name: s.name,
    description: s.description || '',
    isActive: s.is_active !== false,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function mapMachineRow(m) {
  return {
    id: m.id,
    departmentId: m.department_id || '',
    departmentCode: m.department_code || '',
    sectionId: m.section_id || '',
    code: m.code,
    name: m.name,
    type: m.type || m.machine_type || '',
    machineType: m.machine_type || m.type || '',
    capacity: m.capacity || '',
    speedStandard: Number(m.speed_standard || 0),
    speedUnit: m.speed_unit || 'rpm',
    isActive: m.is_active !== false,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

function mapLoomRow(l) {
  return {
    id: l.id,
    loomNo: l.loom_no || l.code,
    code: l.code,
    name: l.name,
    shed: l.shed || '',
    shedType: l.shed_type || '',
    loomType: l.loom_type || '',
    reedSpace: l.reed_space || '',
    rpm: Number(l.rpm || l.standard_rpm || 140),
    standardRpm: Number(l.standard_rpm || l.rpm || 140),
    isActive: l.is_active !== false,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

function mapQualityRow(q) {
  return {
    id: q.id,
    code: q.code,
    name: q.name,
    category: q.category || '',
    nominalCount: q.nominal_count !== null && q.nominal_count !== undefined ? Number(q.nominal_count) : undefined,
    standardMR: q.standard_mr !== null && q.standard_mr !== undefined ? Number(q.standard_mr) : undefined,
    warpCount: q.warp_count !== null && q.warp_count !== undefined ? Number(q.warp_count) : undefined,
    weftCount: q.weft_count !== null && q.weft_count !== undefined ? Number(q.weft_count) : undefined,
    description: q.description || '',
    isActive: q.is_active !== false,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  };
}

function mapStandardRow(s) {
  return {
    id: s.id,
    code: s.standard_code || s.id,
    standardCode: s.standard_code || '',
    formCode: s.form_code,
    departmentId: s.department_id || '',
    qualityId: s.quality_id || '',
    name: s.name || s.parameter_name || s.parameter || '',
    parameterName: s.parameter_name || s.parameter || '',
    parameter: s.parameter || s.parameter_name || '',
    nominalValue: s.nominal_value !== null && s.nominal_value !== undefined ? Number(s.nominal_value) : undefined,
    lowerLimit: s.lower_limit !== null && s.lower_limit !== undefined ? Number(s.lower_limit) : undefined,
    upperLimit: s.upper_limit !== null && s.upper_limit !== undefined ? Number(s.upper_limit) : undefined,
    standardValue: s.standard_value !== null && s.standard_value !== undefined ? Number(s.standard_value) : undefined,
    tolerance: s.tolerance || '',
    unit: s.unit || '',
    isActive: s.is_active !== false,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function normalizeInspectionPayload(raw = {}) {
  const inspectionNo = raw.inspectionNo || raw.inspection_no;
  const formCode = raw.formCode || raw.form_code;
  const formId = raw.formId || raw.form_id || formCode;
  const formTitle = raw.formTitle || raw.form_title || formCode;
  return {
    id: raw.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    inspectionNo,
    formId,
    formCode,
    formTitle,
    departmentId: raw.departmentId || raw.department_id || '',
    departmentName: raw.departmentName || raw.department_name || '',
    sectionId: raw.sectionId || raw.section_id || '',
    shiftId: raw.shiftId || raw.shift_id || '',
    shiftName: raw.shiftName || raw.shift_name || '',
    qualityId: raw.qualityId || raw.quality_id || '',
    qualityName: raw.qualityName || raw.quality_name || '',
    productSpecId: raw.productSpecId || raw.product_spec_id || '',
    productSpecName: raw.productSpecName || raw.product_spec_name || '',
    machineId: raw.machineId || raw.machine_id || '',
    machineNo: raw.machineNo || raw.machine_no || '',
    loomId: raw.loomId || raw.loom_id || '',
    loomNo: raw.loomNo || raw.loom_no || '',
    godownId: raw.godownId || raw.godown_id || '',
    godownName: raw.godownName || raw.godown_name || '',
    inspectorId: raw.inspectorId || raw.inspector_id || '',
    inspectorName: raw.inspectorName || raw.inspector_name || '',
    inspectionDate: raw.inspectionDate || raw.inspection_date || new Date().toISOString().split('T')[0],
    inspectionTime: raw.inspectionTime || raw.inspection_time || '',
    status: raw.status || 'Draft',
    result: raw.result || 'PASS',
    formData: raw.formData || raw.form_data || {},
    readingRows: raw.readingRows || raw.reading_rows || [],
    summaryMetrics: raw.summaryMetrics || raw.summary_metrics || {},
    remarks: raw.remarks || '',
    correctionRemarks: raw.correctionRemarks || raw.correction_remarks || '',
    approvalRemarks: raw.approvalRemarks || raw.approval_remarks || '',
    approvedBy: raw.approvedBy || raw.approved_by || null,
    approvedAt: raw.approvedAt || raw.approved_at || null,
    version: Number(raw.version || 1),
    createdBy: raw.createdBy || raw.created_by || raw.inspectorName || raw.inspector_name || '',
    updatedBy: raw.updatedBy || raw.updated_by || raw.inspectorName || raw.inspector_name || '',
  };
}

// 6. Database Schema Auto-Initialization & Self-Healing
async function initDatabase() {
  try {
    const client = await pool.connect();
    isDatabaseConnected = true;
    console.log(`📦 Connected to PostgreSQL database "${DB_NAME}" on host "${DB_HOST}"`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        employee_code VARCHAR(50),
        display_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'SQC Inspector / User',
        department_id VARCHAR(100),
        department_name VARCHAR(150),
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        can_edit_entries BOOLEAN DEFAULT FALSE,
        can_delete_entries BOOLEAN DEFAULT FALSE,
        permitted_modules JSONB DEFAULT '[]'::jsonb,
        data_scope VARCHAR(20) NOT NULL DEFAULT 'OWN',
        token_version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(150);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'SQC Inspector / User';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_name VARCHAR(150);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_entries BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS can_delete_entries BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permitted_modules JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS data_scope VARCHAR(20) DEFAULT 'OWN';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

      CREATE TABLE IF NOT EXISTS user_form_permissions (
        user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        form_code VARCHAR(50) NOT NULL,
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        granted_by VARCHAR(100),
        PRIMARY KEY (user_id, form_code)
      );
      CREATE INDEX IF NOT EXISTS idx_user_perms_uid ON user_form_permissions (user_id);
      CREATE INDEX IF NOT EXISTS idx_user_perms_form ON user_form_permissions (form_code);

      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        hod_name VARCHAR(150),
        order_index INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Active',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS hod_name VARCHAR(150);
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS sections (
        id VARCHAR(100) PRIMARY KEY,
        department_id VARCHAR(100),
        department_code VARCHAR(50),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS department_code VARCHAR(50);
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS machines (
        id VARCHAR(100) PRIMARY KEY,
        department_id VARCHAR(100),
        department_code VARCHAR(50),
        section_id VARCHAR(100),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(100),
        machine_type VARCHAR(100),
        capacity VARCHAR(100),
        speed_standard NUMERIC DEFAULT 0,
        speed_unit VARCHAR(30) DEFAULT 'rpm',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS department_code VARCHAR(50);
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS section_id VARCHAR(100);
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS type VARCHAR(100);
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_type VARCHAR(100);
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS capacity VARCHAR(100);
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS speed_standard NUMERIC DEFAULT 0;
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS speed_unit VARCHAR(30) DEFAULT 'rpm';
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE machines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS looms (
        id VARCHAR(100) PRIMARY KEY,
        loom_no VARCHAR(50),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        shed VARCHAR(50),
        shed_type VARCHAR(50),
        loom_type VARCHAR(50),
        reed_space VARCHAR(50),
        rpm INT DEFAULT 140,
        standard_rpm INT DEFAULT 140,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS loom_no VARCHAR(50);
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS shed VARCHAR(50);
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS shed_type VARCHAR(50);
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS loom_type VARCHAR(50);
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS reed_space VARCHAR(50);
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS rpm INT DEFAULT 140;
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS standard_rpm INT DEFAULT 140;
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE looms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS qualities (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(50),
        nominal_count NUMERIC(10,2),
        standard_mr NUMERIC(10,2),
        warp_count NUMERIC(10,2),
        weft_count NUMERIC(10,2),
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS category VARCHAR(50);
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS nominal_count NUMERIC(10,2);
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS standard_mr NUMERIC(10,2);
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS warp_count NUMERIC(10,2);
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS weft_count NUMERIC(10,2);
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE qualities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS quality_standards (
        id VARCHAR(100) PRIMARY KEY,
        standard_code VARCHAR(50),
        form_code VARCHAR(50) NOT NULL,
        department_id VARCHAR(100),
        quality_id VARCHAR(100),
        name VARCHAR(200),
        parameter_name VARCHAR(150),
        parameter VARCHAR(150),
        nominal_value NUMERIC(10,4),
        lower_limit NUMERIC(10,4),
        upper_limit NUMERIC(10,4),
        standard_value NUMERIC(10,4),
        max_value NUMERIC(10,4),
        min_value NUMERIC(10,4),
        tolerance VARCHAR(50),
        tolerance_percentage NUMERIC(6,2),
        unit VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS standard_code VARCHAR(50);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS quality_id VARCHAR(100);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS name VARCHAR(200);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS parameter_name VARCHAR(150);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS parameter VARCHAR(150);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS nominal_value NUMERIC(10,4);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS lower_limit NUMERIC(10,4);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS upper_limit NUMERIC(10,4);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS standard_value NUMERIC(10,4);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS tolerance VARCHAR(50);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS inspections (
        id VARCHAR(100) PRIMARY KEY,
        inspection_no VARCHAR(100) UNIQUE NOT NULL,
        form_id VARCHAR(50) NOT NULL,
        form_code VARCHAR(30) NOT NULL,
        form_title VARCHAR(255) NOT NULL,
        department_id VARCHAR(100),
        department_name VARCHAR(150),
        section_id VARCHAR(100),
        shift_id VARCHAR(50),
        shift_name VARCHAR(100),
        quality_id VARCHAR(100),
        quality_name VARCHAR(150),
        product_spec_id VARCHAR(100),
        product_spec_name VARCHAR(150),
        machine_id VARCHAR(100),
        machine_no VARCHAR(100),
        loom_id VARCHAR(100),
        loom_no VARCHAR(100),
        godown_id VARCHAR(100),
        godown_name VARCHAR(150),
        inspector_id VARCHAR(100),
        inspector_name VARCHAR(150),
        inspection_date VARCHAR(30),
        inspection_time VARCHAR(30),
        status VARCHAR(50) DEFAULT 'Draft',
        result VARCHAR(30) DEFAULT 'PASS',
        form_data JSONB DEFAULT '{}'::jsonb,
        reading_rows JSONB DEFAULT '[]'::jsonb,
        summary_metrics JSONB DEFAULT '{}'::jsonb,
        remarks TEXT,
        correction_remarks TEXT,
        approval_remarks TEXT,
        approved_by VARCHAR(150),
        approved_at TIMESTAMP WITH TIME ZONE,
        version INT DEFAULT 1,
        created_by VARCHAR(150),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(150),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_id VARCHAR(50);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_code VARCHAR(30);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_title VARCHAR(255);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS department_name VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS section_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS shift_id VARCHAR(50);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS shift_name VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS quality_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS quality_name VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS product_spec_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS product_spec_name VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS machine_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS machine_no VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS loom_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS loom_no VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS godown_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS godown_name VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspector_id VARCHAR(100);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspector_name VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspection_date VARCHAR(30);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspection_time VARCHAR(30);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS result VARCHAR(30) DEFAULT 'PASS';
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS reading_rows JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS summary_metrics JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS remarks TEXT;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS correction_remarks TEXT;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approval_remarks TEXT;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS created_by VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        performed_by_id VARCHAR(100),
        performed_by_name VARCHAR(150),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        details JSONB DEFAULT '{}'::jsonb
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB DEFAULT '{}'::jsonb,
        updated_by VARCHAR(150),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Load persisted Maintenance Mode setting from PostgreSQL
    await client.query(`
      INSERT INTO system_settings (key, value, updated_by)
      VALUES (
        'maintenance_mode',
        '{"enabled": false, "message": "Server is under maintenance. We will be back shortly.", "activatedBy": null, "activatedAt": null}'::jsonb,
        'SYSTEM'
      )
      ON CONFLICT (key) DO NOTHING;
    `);
    const maintRes = await client.query(`SELECT value FROM system_settings WHERE key = 'maintenance_mode' LIMIT 1`);
    if (maintRes.rows[0]?.value) {
      const val = parseJsonSafe(maintRes.rows[0].value, {});
      maintenanceState = {
        enabled: !!val.enabled,
        message: val.message || 'Server is under maintenance. We will be back shortly.',
        activatedBy: val.activatedBy || null,
        activatedAt: val.activatedAt || null,
      };
    }

    // Ensure default Admin account exists (Admin is the ONLY privileged role)
    const adminCheck = await client.query(`SELECT id, role FROM users WHERE LOWER(username) = 'admin' LIMIT 1`);
    let adminUserId = adminCheck.rows[0]?.id;
    const allModulesJson = JSON.stringify(ALL_MODULES);
    if (!adminUserId) {
      adminUserId = 'usr-admin-01';
      const adminHash = 'bjcl_sqc_salt_2026:5d5a621bd54309c980763fcb42e09fd15c0ad7b82994b1ff985b30475b42c2fc';
      await client.query(`
        INSERT INTO users (id, username, password_hash, employee_code, display_name, email, role, department_name, is_active, can_edit_entries, can_delete_entries, permitted_modules, data_scope, token_version)
        VALUES ('usr-admin-01', 'admin', $1, 'EMP-001', 'System Administrator', 'admin@ballyjute.com', 'Admin', 'Administration', TRUE, TRUE, TRUE, $2::jsonb, 'ALL', 1)
        ON CONFLICT DO NOTHING
      `, [adminHash, allModulesJson]);
      console.log('✅ Administrator account initialized: admin (Role: Admin)');
    }

    // Migrate any legacy elevated accounts cleanly: 'admin' becomes 'Admin', all other legacy elevated accounts are downgraded to standard user with zero modules & OWN scope
    const legacyMigrated = await client.query(`
      UPDATE users
      SET role = CASE WHEN LOWER(username) = 'admin' THEN 'Admin' ELSE 'SQC Inspector / User' END,
          data_scope = CASE WHEN LOWER(username) = 'admin' THEN 'ALL' ELSE 'OWN' END,
          permitted_modules = CASE WHEN LOWER(username) = 'admin' THEN $1::jsonb ELSE '[]'::jsonb END,
          can_edit_entries = CASE WHEN LOWER(username) = 'admin' THEN TRUE ELSE FALSE END,
          can_delete_entries = CASE WHEN LOWER(username) = 'admin' THEN TRUE ELSE FALSE END,
          token_version = COALESCE(token_version, 1) + 1
      WHERE LOWER(REPLACE(COALESCE(role, ''), ' ', '')) = 'superadmin'
      RETURNING id, username, email, role
    `, [allModulesJson]);

    if (legacyMigrated.rows.length > 0) {
      console.log('🔒 Migrated legacy elevated role assignments:', legacyMigrated.rows.map(r => `${r.username} -> ${r.role}`).join(', '));
      for (const mig of legacyMigrated.rows) {
        if (!isAdminRole(mig.role)) {
          await client.query(`DELETE FROM user_form_permissions WHERE user_id = $1`, [mig.id]);
        }
        await client.query(
          `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by_id, performed_by_name, details)
           VALUES ($1, 'USER', $2, 'ROLE_MIGRATION', 'SYSTEM', 'Security Migration', $3)`,
          [
            `log-mig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            mig.id,
            JSON.stringify({ username: mig.username, email: mig.email, migratedRole: mig.role }),
          ]
        );
      }
    }

    // Normalize existing Admin accounts and sanitize non-Admin data scopes & module lists
    await client.query(`
      UPDATE users
      SET permitted_modules = $1::jsonb,
          data_scope = 'ALL',
          can_edit_entries = TRUE,
          can_delete_entries = TRUE
      WHERE role = 'Admin'
    `, [allModulesJson]);

    await client.query(`
      UPDATE users
      SET data_scope = 'OWN'
      WHERE role <> 'Admin' AND (data_scope IS NULL OR data_scope NOT IN ('OWN', 'DEPARTMENT', 'ALL'))
    `);

    const allFormCodes = Object.keys(FORM_TABLE_MAP);
    for (const fc of allFormCodes) {
      await client.query(`
        INSERT INTO user_form_permissions (user_id, form_code, granted_by)
        VALUES ($1, $2, 'SYSTEM')
        ON CONFLICT DO NOTHING
      `, [adminUserId, fc]);
    }

    // Create / upgrade all 38 individual form tables
    for (const [fCode, tblName] of Object.entries(FORM_TABLE_MAP)) {
      if (fCode === 'FORM-37') continue; // shares form_09b_beaming with FORM-09 B
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tblName} (
          id VARCHAR(100) PRIMARY KEY,
          inspection_no VARCHAR(100) UNIQUE NOT NULL,
          form_code VARCHAR(30) DEFAULT '${fCode}',
          department_id VARCHAR(100),
          department_name VARCHAR(150),
          section_id VARCHAR(100),
          shift_id VARCHAR(50),
          shift_name VARCHAR(100),
          quality_id VARCHAR(100),
          quality_name VARCHAR(150),
          product_spec_id VARCHAR(100),
          product_spec_name VARCHAR(150),
          machine_id VARCHAR(100),
          machine_no VARCHAR(100),
          loom_id VARCHAR(100),
          loom_no VARCHAR(100),
          godown_id VARCHAR(100),
          godown_name VARCHAR(150),
          inspector_id VARCHAR(100),
          inspector_name VARCHAR(150),
          inspection_date VARCHAR(30),
          inspection_time VARCHAR(30),
          status VARCHAR(50) DEFAULT 'Draft',
          result VARCHAR(30) DEFAULT 'PASS',
          form_data JSONB DEFAULT '{}'::jsonb,
          reading_rows JSONB DEFAULT '[]'::jsonb,
          summary_metrics JSONB DEFAULT '{}'::jsonb,
          remarks TEXT,
          correction_remarks TEXT,
          approval_remarks TEXT,
          approved_by VARCHAR(150),
          approved_at TIMESTAMP WITH TIME ZONE,
          version INT DEFAULT 1,
          created_by VARCHAR(150),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_by VARCHAR(150),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS product_spec_id VARCHAR(100);
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS product_spec_name VARCHAR(150);
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS machine_id VARCHAR(100);
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS loom_id VARCHAR(100);
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS godown_id VARCHAR(100);
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS godown_name VARCHAR(150);
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS correction_remarks TEXT;
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS created_by VARCHAR(150);
        ALTER TABLE ${tblName} ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
        CREATE INDEX IF NOT EXISTS idx_${tblName}_no ON ${tblName} (inspection_no);
        CREATE INDEX IF NOT EXISTS idx_${tblName}_date ON ${tblName} (inspection_date);
      `);
    }

    client.release();
    console.log('✅ SQC database tables and all 38 form tables verified & upgraded successfully.');
  } catch (err) {
    isDatabaseConnected = false;
    console.warn('⚠️ PostgreSQL Connection Notice:', err.message);
    console.log('ℹ️ Server will continue running in fallback mode.');
  }
}

initDatabase();

// 7. Authentication & Authorization Middleware (Fail-Closed RBAC + Signed Tokens)
async function resolveUserFromToken(token) {
  const decoded = verifySignedToken(token);
  if (!decoded || !decoded.userId) return null;

  try {
    if (isDatabaseConnected) {
      const userRes = await pool.query(
        `SELECT * FROM users WHERE id = $1 LIMIT 1`,
        [decoded.userId]
      );
      if (userRes.rows.length === 0) return null;
      const row = userRes.rows[0];
      if (!row.is_active) return null;
      if (Number(row.token_version || 1) !== Number(decoded.tokenVersion || 1)) {
        return null;
      }

      const role = isAdminRole(row.role) ? 'Admin' : sanitizeRole(row.role);
      let permittedForms = ['*'];
      if (!isAdminRole(role)) {
        const permRes = await pool.query(
          `SELECT form_code FROM user_form_permissions WHERE user_id = $1`,
          [row.id]
        );
        permittedForms = permRes.rows.map(r => r.form_code);
      }

      return {
        ...row,
        role,
        permittedModules: sanitizeModules(parseJsonSafe(row.permitted_modules, []), role),
        permittedForms,
        dataScope: sanitizeDataScope(row.data_scope, role),
      };
    }

    const fb = fallbackUsers.get(decoded.userId);
    if (!fb || !fb.is_active) return null;
    if (Number(fb.token_version || 1) !== Number(decoded.tokenVersion || 1)) return null;
    return {
      ...fb,
      permittedModules: sanitizeModules(fb.permitted_modules, fb.role),
      dataScope: sanitizeDataScope(fb.data_scope, fb.role),
    };
  } catch {
    return null;
  }
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const user = await resolveUserFromToken(token);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid, expired, or revoked authentication session.' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only Administrators can perform this action.',
    });
  }
  next();
}

function requireModule(moduleCode) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (hasModuleAccess(req.user, moduleCode)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Access Denied: You do not have permission for the ${moduleCode} module.`,
    });
  };
}

function requireAnyModule(moduleCodes) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (hasAnyModuleAccess(req.user, moduleCodes)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access Denied: You have no assigned module permissions for this resource.',
    });
  };
}

// Enforce Maintenance Mode globally on all protected /api/* routes for non-Admin users
app.use('/api', async (req, res, next) => {
  const openPaths = ['/health', '/maintenance/status', '/auth/login'];
  if (!maintenanceState.enabled || openPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const user = token ? await resolveUserFromToken(token) : null;

  if (user && isAdminRole(user.role)) {
    req.user = user;
    return next();
  }

  return res.status(503).json({
    success: false,
    maintenanceMode: true,
    message: maintenanceState.message || 'Server is under maintenance. We will be back shortly.',
  });
});

async function verifyFormPermission(userId, userRole, formCode, preloadedForms = null) {
  if (isAdminRole(userRole)) return true;
  const aliases = expandFormCodeAliases(formCode);
  if (Array.isArray(preloadedForms)) {
    if (preloadedForms.includes('*')) return true;
    const set = new Set(preloadedForms.map(f => String(f || '').trim().toUpperCase()));
    return aliases.some(a => set.has(a));
  }
  if (!isDatabaseConnected) return false;
  const permRes = await pool.query(
    `SELECT 1 FROM user_form_permissions WHERE user_id = $1 AND form_code = ANY($2::text[]) LIMIT 1`,
    [userId, aliases]
  );
  return permRes.rows.length > 0;
}

function expandAllPermittedAliases(permittedForms = []) {
  const set = new Set();
  for (const fc of permittedForms) {
    for (const alias of expandFormCodeAliases(fc)) {
      set.add(alias);
    }
  }
  return Array.from(set);
}

function canAccessInspectionRow(user, row) {
  if (!user || !user.is_active) return false;
  if (isAdminRole(user.role)) return true;
  if (!hasAnyModuleAccess(user, ['INSPECTIONS', 'APPROVALS', 'DASHBOARD', 'REPORTS'])) return false;

  const scope = sanitizeDataScope(user.dataScope || user.data_scope, user.role);
  let scopeOk = false;
  if (scope === 'ALL') {
    scopeOk = true;
  } else if (scope === 'DEPARTMENT') {
    const isOwner = row.inspector_id === user.id;
    const sameDeptId = Boolean(user.department_id) && row.department_id === user.department_id;
    const sameDeptName =
      Boolean(user.department_name) &&
      String(row.department_name || '').trim().toLowerCase() === String(user.department_name).trim().toLowerCase();
    scopeOk = isOwner || sameDeptId || sameDeptName;
  } else {
    scopeOk = row.inspector_id === user.id;
  }
  if (!scopeOk) return false;

  // If user does not have Approvals module, enforce explicit form permission on inspection rows
  if (!hasModuleAccess(user, 'APPROVALS')) {
    const allowedAliases = expandAllPermittedAliases(user.permittedForms || []);
    return allowedAliases.includes(String(row.form_code || '').trim().toUpperCase());
  }
  return true;
}

function buildInspectionScopeWhere(user, params) {
  if (isAdminRole(user.role)) return '';
  let clause = '';
  const scope = sanitizeDataScope(user.dataScope || user.data_scope, user.role);
  if (scope === 'DEPARTMENT') {
    params.push(user.id);
    const uidIdx = params.length;
    params.push(user.department_id || '');
    const didIdx = params.length;
    params.push(user.department_name || '');
    const dnameIdx = params.length;
    clause += ` AND (inspector_id = $${uidIdx} OR ($${didIdx} <> '' AND department_id = $${didIdx}) OR ($${dnameIdx} <> '' AND LOWER(COALESCE(department_name, '')) = LOWER($${dnameIdx})))`;
  } else if (scope === 'OWN') {
    params.push(user.id);
    clause += ` AND inspector_id = $${params.length}`;
  }

  if (!hasModuleAccess(user, 'APPROVALS')) {
    const aliases = expandAllPermittedAliases(user.permittedForms || []);
    if (aliases.length === 0) {
      clause += ` AND 1=0`;
    } else {
      params.push(aliases);
      clause += ` AND UPPER(form_code) = ANY($${params.length}::text[])`;
    }
  }

  return clause;
}

async function logAuditEvent(dbClient, { entityType, entityId, action, user, details }) {
  if (!isDatabaseConnected && dbClient === pool) return;
  try {
    await dbClient.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by_id, performed_by_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entityType,
        String(entityId || 'SYSTEM'),
        action,
        user?.id || 'SYSTEM',
        user?.display_name || user?.displayName || user?.username || 'System',
        JSON.stringify(details || {}),
      ]
    );
  } catch (e) {
    console.warn('Audit log write notice:', e.message);
  }
}

// 8. Core Helper: Upsert Inspection into BOTH `inspections` AND dedicated `form_*` table
async function upsertInspectionAndFormTable(client, rawIns) {
  const ins = normalizeInspectionPayload(rawIns);

  const mainQuery = `
    INSERT INTO inspections (
      id, inspection_no, form_id, form_code, form_title,
      department_id, department_name, section_id, shift_id, shift_name,
      quality_id, quality_name, product_spec_id, product_spec_name,
      machine_id, machine_no, loom_id, loom_no, godown_id, godown_name,
      inspector_id, inspector_name, inspection_date, inspection_time,
      status, result, form_data, reading_rows, summary_metrics,
      remarks, correction_remarks, approval_remarks, approved_by, approved_at,
      version, created_by, updated_by, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29,
      $30, $31, $32, $33, $34, $35, $36, $37, NOW()
    )
    ON CONFLICT (inspection_no) DO UPDATE SET
      form_id = EXCLUDED.form_id,
      form_code = EXCLUDED.form_code,
      form_title = EXCLUDED.form_title,
      department_id = EXCLUDED.department_id,
      department_name = EXCLUDED.department_name,
      section_id = EXCLUDED.section_id,
      shift_id = EXCLUDED.shift_id,
      shift_name = EXCLUDED.shift_name,
      quality_id = EXCLUDED.quality_id,
      quality_name = EXCLUDED.quality_name,
      product_spec_id = EXCLUDED.product_spec_id,
      product_spec_name = EXCLUDED.product_spec_name,
      machine_id = EXCLUDED.machine_id,
      machine_no = EXCLUDED.machine_no,
      loom_id = EXCLUDED.loom_id,
      loom_no = EXCLUDED.loom_no,
      godown_id = EXCLUDED.godown_id,
      godown_name = EXCLUDED.godown_name,
      inspector_id = EXCLUDED.inspector_id,
      inspector_name = EXCLUDED.inspector_name,
      inspection_date = EXCLUDED.inspection_date,
      inspection_time = EXCLUDED.inspection_time,
      status = EXCLUDED.status,
      result = EXCLUDED.result,
      form_data = EXCLUDED.form_data,
      reading_rows = EXCLUDED.reading_rows,
      summary_metrics = EXCLUDED.summary_metrics,
      remarks = EXCLUDED.remarks,
      correction_remarks = EXCLUDED.correction_remarks,
      approval_remarks = EXCLUDED.approval_remarks,
      approved_by = EXCLUDED.approved_by,
      approved_at = EXCLUDED.approved_at,
      version = EXCLUDED.version,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *;
  `;

  const mainValues = [
    ins.id,
    ins.inspectionNo,
    ins.formId,
    ins.formCode,
    ins.formTitle,
    ins.departmentId,
    ins.departmentName,
    ins.sectionId,
    ins.shiftId,
    ins.shiftName,
    ins.qualityId,
    ins.qualityName,
    ins.productSpecId,
    ins.productSpecName,
    ins.machineId,
    ins.machineNo,
    ins.loomId,
    ins.loomNo,
    ins.godownId,
    ins.godownName,
    ins.inspectorId,
    ins.inspectorName,
    ins.inspectionDate,
    ins.inspectionTime,
    ins.status,
    ins.result,
    JSON.stringify(ins.formData),
    JSON.stringify(ins.readingRows),
    JSON.stringify(ins.summaryMetrics),
    ins.remarks,
    ins.correctionRemarks,
    ins.approvalRemarks,
    ins.approvedBy,
    ins.approvedAt ? new Date(ins.approvedAt) : null,
    ins.version,
    ins.createdBy,
    ins.updatedBy,
  ];

  const mainRes = await client.query(mainQuery, mainValues);
  const savedRow = mainRes.rows[0];

  // Also insert/update into the specific dedicated form_* table!
  const formTable = resolveFormTable(ins.formCode) || resolveFormTable(ins.formId);
  if (formTable) {
    const formQuery = `
      INSERT INTO ${formTable} (
        id, inspection_no, form_code,
        department_id, department_name, section_id, shift_id, shift_name,
        quality_id, quality_name, product_spec_id, product_spec_name,
        machine_id, machine_no, loom_id, loom_no, godown_id, godown_name,
        inspector_id, inspector_name, inspection_date, inspection_time,
        status, result, form_data, reading_rows, summary_metrics,
        remarks, correction_remarks, approval_remarks, approved_by, approved_at,
        version, created_by, updated_by, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33, $34, $35, NOW()
      )
      ON CONFLICT (inspection_no) DO UPDATE SET
        form_code = EXCLUDED.form_code,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        section_id = EXCLUDED.section_id,
        shift_id = EXCLUDED.shift_id,
        shift_name = EXCLUDED.shift_name,
        quality_id = EXCLUDED.quality_id,
        quality_name = EXCLUDED.quality_name,
        product_spec_id = EXCLUDED.product_spec_id,
        product_spec_name = EXCLUDED.product_spec_name,
        machine_id = EXCLUDED.machine_id,
        machine_no = EXCLUDED.machine_no,
        loom_id = EXCLUDED.loom_id,
        loom_no = EXCLUDED.loom_no,
        godown_id = EXCLUDED.godown_id,
        godown_name = EXCLUDED.godown_name,
        inspector_id = EXCLUDED.inspector_id,
        inspector_name = EXCLUDED.inspector_name,
        inspection_date = EXCLUDED.inspection_date,
        inspection_time = EXCLUDED.inspection_time,
        status = EXCLUDED.status,
        result = EXCLUDED.result,
        form_data = EXCLUDED.form_data,
        reading_rows = EXCLUDED.reading_rows,
        summary_metrics = EXCLUDED.summary_metrics,
        remarks = EXCLUDED.remarks,
        correction_remarks = EXCLUDED.correction_remarks,
        approval_remarks = EXCLUDED.approval_remarks,
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        version = EXCLUDED.version,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
    `;

    await client.query(formQuery, [
      savedRow.id,
      ins.inspectionNo,
      ins.formCode,
      ins.departmentId,
      ins.departmentName,
      ins.sectionId,
      ins.shiftId,
      ins.shiftName,
      ins.qualityId,
      ins.qualityName,
      ins.productSpecId,
      ins.productSpecName,
      ins.machineId,
      ins.machineNo,
      ins.loomId,
      ins.loomNo,
      ins.godownId,
      ins.godownName,
      ins.inspectorId,
      ins.inspectorName,
      ins.inspectionDate,
      ins.inspectionTime,
      ins.status,
      ins.result,
      JSON.stringify(ins.formData),
      JSON.stringify(ins.readingRows),
      JSON.stringify(ins.summaryMetrics),
      ins.remarks,
      ins.correctionRemarks,
      ins.approvalRemarks,
      ins.approvedBy,
      ins.approvedAt ? new Date(ins.approvedAt) : null,
      ins.version,
      ins.createdBy,
      ins.updatedBy,
    ]);
  }

  return {
    inspection: mapInspectionRow(savedRow),
    formTable,
  };
}

// Helper for upserting user + permissions inside a client/pool (Admin-only caller)
async function upsertUserRecord(client, u, actorId = 'ADMIN') {
  if (isLegacyElevatedRole(u.role)) {
    const err = new Error('Legacy elevated role is disabled. Only Admin or standard user roles are allowed.');
    err.statusCode = 400;
    throw err;
  }

  const email = (u.email || `${u.username || 'user'}@ballyjute.com`).trim();
  const username = (u.username || email.split('@')[0]).trim();
  const incomingId = u.id || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  const existingRes = await client.query(
    `SELECT * FROM users WHERE id = $1 OR LOWER(email) = LOWER($2) OR LOWER(username) = LOWER($3) LIMIT 1`,
    [incomingId, email, username]
  );

  const existing = existingRes.rows[0];
  const userId = existing ? existing.id : incomingId;

  const requestedRole = u.role !== undefined ? sanitizeRole(u.role) : (existing ? sanitizeRole(existing.role) : 'SQC Inspector / User');

  // Guard against demoting or deactivating the last active Admin
  if (existing && isAdminRole(existing.role)) {
    const nextActive = u.isActive !== undefined ? Boolean(u.isActive) : Boolean(existing.is_active);
    if (!isAdminRole(requestedRole) || !nextActive) {
      const otherAdmins = await client.query(
        `SELECT COUNT(*) AS cnt FROM users WHERE role = 'Admin' AND is_active = TRUE AND id <> $1`,
        [userId]
      );
      if (Number(otherAdmins.rows[0]?.cnt || 0) === 0) {
        const err = new Error('Cannot demote or deactivate the last active Administrator account.');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  let passwordHash = existing ? existing.password_hash : null;
  let bumpTokenVersion = false;
  if (u.password && String(u.password).trim()) {
    const pw = String(u.password).trim();
    if (pw.length < 6) {
      const err = new Error('Password must be at least 6 characters.');
      err.statusCode = 400;
      throw err;
    }
    passwordHash = hashPassword(pw);
    bumpTokenVersion = true;
  } else if (!existing) {
    const err = new Error('A password of at least 6 characters is required when creating a new user.');
    err.statusCode = 400;
    throw err;
  }

  const nextActive = u.isActive !== undefined ? Boolean(u.isActive) : (existing ? existing.is_active : true);
  if (existing && existing.is_active && !nextActive) {
    bumpTokenVersion = true;
  }

  const targetCanEdit = isAdminRole(requestedRole)
    ? true
    : u.canEditEntries !== undefined
    ? Boolean(u.canEditEntries)
    : Boolean(existing?.can_edit_entries);
  const targetCanDelete = isAdminRole(requestedRole)
    ? true
    : u.canDeleteEntries !== undefined
    ? Boolean(u.canDeleteEntries)
    : Boolean(existing?.can_delete_entries);

  const existingModules = existing ? parseJsonSafe(existing.permitted_modules, []) : [];
  const targetModules = u.permittedModules !== undefined
    ? sanitizeModules(u.permittedModules, requestedRole)
    : sanitizeModules(existingModules, requestedRole);

  const targetDataScope = u.dataScope !== undefined
    ? sanitizeDataScope(u.dataScope, requestedRole)
    : sanitizeDataScope(existing?.data_scope, requestedRole);

  const nextTokenVersion = existing
    ? Number(existing.token_version || 1) + (bumpTokenVersion ? 1 : 0)
    : 1;

  let savedUserRow;
  if (existing) {
    const updRes = await client.query(
      `UPDATE users SET
        username = $2,
        password_hash = $3,
        employee_code = $4,
        display_name = $5,
        email = $6,
        role = $7,
        department_id = $8,
        department_name = $9,
        phone = $10,
        is_active = $11,
        can_edit_entries = $12,
        can_delete_entries = $13,
        permitted_modules = $14::jsonb,
        data_scope = $15,
        token_version = $16,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        userId,
        username,
        passwordHash,
        u.employeeCode !== undefined ? u.employeeCode : existing.employee_code || '',
        u.displayName || existing.display_name,
        email,
        requestedRole,
        u.departmentId !== undefined ? u.departmentId : existing.department_id || '',
        u.departmentName !== undefined ? u.departmentName : existing.department_name || '',
        u.phone !== undefined ? u.phone : existing.phone || '',
        nextActive,
        targetCanEdit,
        targetCanDelete,
        JSON.stringify(targetModules),
        targetDataScope,
        nextTokenVersion,
      ]
    );
    savedUserRow = updRes.rows[0];
  } else {
    const insRes = await client.query(
      `INSERT INTO users (id, username, password_hash, employee_code, display_name, email, role, department_id, department_name, phone, is_active, can_edit_entries, can_delete_entries, permitted_modules, data_scope, token_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, NOW())
       RETURNING *`,
      [
        userId,
        username,
        passwordHash,
        u.employeeCode || '',
        u.displayName || username,
        email,
        requestedRole,
        u.departmentId || '',
        u.departmentName || '',
        u.phone || '',
        nextActive,
        targetCanEdit,
        targetCanDelete,
        JSON.stringify(targetModules),
        targetDataScope,
        nextTokenVersion,
      ]
    );
    savedUserRow = insRes.rows[0];
  }

  if (Array.isArray(u.permittedForms) && !isAdminRole(requestedRole)) {
    await client.query(`DELETE FROM user_form_permissions WHERE user_id = $1`, [userId]);
    for (const fc of u.permittedForms) {
      if (fc && fc !== '*') {
        await client.query(
          `INSERT INTO user_form_permissions (user_id, form_code, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [userId, fc, actorId]
        );
      }
    }
  } else if (isAdminRole(requestedRole)) {
    for (const fc of Object.keys(FORM_TABLE_MAP)) {
      await client.query(
        `INSERT INTO user_form_permissions (user_id, form_code, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [userId, fc, actorId]
      );
    }
  }

  const permRes = await client.query(`SELECT form_code FROM user_form_permissions WHERE user_id = $1`, [userId]);
  return mapUserRow(savedUserRow, permRes.rows.map(r => r.form_code));
}

// ==============================================================================
// 9. MAINTENANCE MODE & AUTHENTICATION API ROUTES
// ==============================================================================

app.get('/api/maintenance/status', async (req, res) => {
  try {
    if (isDatabaseConnected) {
      const r = await pool.query(`SELECT value FROM system_settings WHERE key = 'maintenance_mode' LIMIT 1`);
      if (r.rows[0]?.value) {
        const val = parseJsonSafe(r.rows[0].value, {});
        maintenanceState = {
          enabled: !!val.enabled,
          message: val.message || 'Server is under maintenance. We will be back shortly.',
          activatedBy: val.activatedBy || null,
          activatedAt: val.activatedAt || null,
        };
      }
    }
    res.json({ success: true, ...maintenanceState });
  } catch (err) {
    res.json({ success: true, ...maintenanceState });
  }
});

app.post('/api/maintenance/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const customMsg = (req.body?.message || '').trim();
    const actor = req.user.display_name || req.user.username || 'Administrator';

    maintenanceState = {
      enabled,
      message: customMsg || 'Server is under maintenance. We will be back shortly.',
      activatedBy: enabled ? actor : null,
      activatedAt: enabled ? new Date().toISOString() : null,
    };

    if (isDatabaseConnected) {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_by, updated_at)
         VALUES ('maintenance_mode', $1::jsonb, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [JSON.stringify(maintenanceState), actor]
      );
      await logAuditEvent(pool, {
        entityType: 'SYSTEM',
        entityId: 'maintenance_mode',
        action: enabled ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF',
        user: req.user,
        details: maintenanceState,
      });
    }

    res.json({
      success: true,
      ...maintenanceState,
      notice: enabled
        ? 'Maintenance Mode activated. All non-admin users have been locked out.'
        : 'Maintenance Mode deactivated. Normal user access restored.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const cleanId = String(username).trim();

  try {
    if (!isDatabaseConnected) {
      const fbUser = Array.from(fallbackUsers.values()).find(
        u =>
          (u.username && u.username.toLowerCase() === cleanId.toLowerCase()) ||
          (u.email && u.email.toLowerCase() === cleanId.toLowerCase()) ||
          (u.employee_code && u.employee_code.toLowerCase() === cleanId.toLowerCase())
      );

      if (!fbUser || !verifyPassword(password, fbUser.password_hash)) {
        if (maintenanceState.enabled && (!fbUser || !isAdminRole(fbUser.role))) {
          return res.status(503).json({
            success: false,
            maintenanceMode: true,
            message: maintenanceState.message || 'Server is under maintenance. We will be back shortly.',
          });
        }
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      if (!fbUser.is_active) {
        return res.status(403).json({ success: false, message: 'User account is deactivated. Contact Administrator.' });
      }
      if (maintenanceState.enabled && !isAdminRole(fbUser.role)) {
        return res.status(503).json({
          success: false,
          maintenanceMode: true,
          message: maintenanceState.message || 'Server is under maintenance. We will be back shortly.',
        });
      }

      const token = signAuthToken({ userId: fbUser.id, tokenVersion: fbUser.token_version });
      return res.json({
        success: true,
        token,
        maintenanceMode: maintenanceState,
        user: mapUserRow(fbUser, fbUser.permittedForms || []),
      });
    }

    const userRes = await pool.query(
      `SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR LOWER(employee_code) = LOWER($1) LIMIT 1`,
      [cleanId]
    );

    if (userRes.rows.length === 0) {
      if (maintenanceState.enabled) {
        return res.status(503).json({
          success: false,
          maintenanceMode: true,
          message: maintenanceState.message || 'Server is under maintenance. We will be back shortly.',
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'User account is deactivated. Contact Administrator.' });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      if (maintenanceState.enabled && !isAdminRole(user.role)) {
        return res.status(503).json({
          success: false,
          maintenanceMode: true,
          message: maintenanceState.message || 'Server is under maintenance. We will be back shortly.',
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
    }

    if (maintenanceState.enabled && !isAdminRole(user.role)) {
      return res.status(503).json({
        success: false,
        maintenanceMode: true,
        message: maintenanceState.message || 'Server is under maintenance. We will be back shortly.',
      });
    }

    // Transparently upgrade legacy hashes to scrypt on login
    if (user.password_hash && !user.password_hash.startsWith('scrypt$')) {
      try {
        const upgraded = hashPassword(password);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [upgraded, user.id]);
      } catch (_) {}
    }

    const permRes = await pool.query(
      `SELECT form_code FROM user_form_permissions WHERE user_id = $1`,
      [user.id]
    );
    const permittedForms = permRes.rows.map(r => r.form_code);
    const token = signAuthToken({ userId: user.id, tokenVersion: user.token_version || 1 });

    await logAuditEvent(pool, {
      entityType: 'AUTH',
      entityId: user.id,
      action: 'LOGIN',
      user,
      details: { username: user.username, role: user.role },
    });

    res.json({
      success: true,
      token,
      maintenanceMode: maintenanceState,
      user: mapUserRow(user, permittedForms),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      maintenanceMode: maintenanceState,
      user: mapUserRow(user, user.permittedForms || []),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Self-service profile update (ONLY own displayName and phone; never role/modules/forms/scope)
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { displayName, phone } = req.body || {};
  const cleanName = typeof displayName === 'string' ? displayName.trim() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';

  if (!cleanName) {
    return res.status(400).json({ success: false, message: 'Display name is required.' });
  }

  try {
    if (!isDatabaseConnected) {
      const fb = fallbackUsers.get(req.user.id);
      if (!fb) return res.status(404).json({ success: false, message: 'User not found.' });
      fb.display_name = cleanName;
      fb.phone = cleanPhone;
      return res.json({ success: true, user: mapUserRow(fb, fb.permittedForms || []) });
    }

    const upd = await pool.query(
      `UPDATE users SET display_name = $2, phone = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.user.id, cleanName, cleanPhone]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await logAuditEvent(pool, {
      entityType: 'USER',
      entityId: req.user.id,
      action: 'PROFILE_UPDATE',
      user: req.user,
      details: { displayName: cleanName, phone: cleanPhone },
    });

    res.json({
      success: true,
      user: mapUserRow(upd.rows[0], req.user.permittedForms || []),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Self-service password change (ONLY own password after verifying currentPassword)
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
  }
  const cleanNew = String(newPassword).trim();
  if (cleanNew.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  try {
    if (!isDatabaseConnected) {
      const fb = fallbackUsers.get(req.user.id);
      if (!fb || !verifyPassword(String(currentPassword), fb.password_hash)) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      }
      fb.password_hash = hashPassword(cleanNew);
      fb.token_version = Number(fb.token_version || 1) + 1;
      const newToken = signAuthToken({ userId: fb.id, tokenVersion: fb.token_version });
      return res.json({ success: true, token: newToken, message: 'Your password has been changed.' });
    }

    const r = await pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [req.user.id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }
    const userRow = r.rows[0];
    if (!verifyPassword(String(currentPassword), userRow.password_hash)) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = hashPassword(cleanNew);
    const upd = await pool.query(
      `UPDATE users SET password_hash = $2, token_version = COALESCE(token_version, 1) + 1, updated_at = NOW()
       WHERE id = $1 RETURNING token_version`,
      [req.user.id, newHash]
    );
    const newVersion = upd.rows[0]?.token_version || 1;
    const newToken = signAuthToken({ userId: req.user.id, tokenVersion: newVersion });

    await logAuditEvent(pool, {
      entityType: 'USER',
      entityId: req.user.id,
      action: 'PASSWORD_CHANGE',
      user: req.user,
      details: { selfService: true },
    });

    res.json({ success: true, token: newToken, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 10. USER MANAGEMENT & FORM PERMISSIONS API (ADMIN-ONLY)
// ==============================================================================

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isDatabaseConnected) {
      return res.json(Array.from(fallbackUsers.values()).map(u => mapUserRow(u, u.permittedForms || [])));
    }
    const usersRes = await pool.query(
      `SELECT id, username, employee_code, display_name, email, role, department_id, department_name, phone, is_active, can_edit_entries, can_delete_entries, permitted_modules, data_scope, token_version, created_at, updated_at FROM users ORDER BY display_name ASC`
    );

    const permsRes = await pool.query(`SELECT user_id, form_code FROM user_form_permissions`);
    const permsMap = {};
    permsRes.rows.forEach(p => {
      if (!permsMap[p.user_id]) permsMap[p.user_id] = [];
      permsMap[p.user_id].push(p.form_code);
    });

    res.json(usersRes.rows.map(u => mapUserRow(u, permsMap[u.id] || [])));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const u = req.body || {};
  if (!u.displayName && !u.username) {
    return res.status(400).json({ success: false, message: 'Display name or username is required.' });
  }

  try {
    if (!isDatabaseConnected) {
      if (isLegacyElevatedRole(u.role)) {
        return res.status(400).json({ success: false, message: 'Invalid role selected.' });
      }
      const existing = fallbackUsers.get(u.id);
      const role = sanitizeRole(u.role || existing?.role);
      const password = u.password && String(u.password).trim();
      if (!existing && (!password || password.length < 6)) {
        return res.status(400).json({ success: false, message: 'Password of at least 6 characters is required.' });
      }
      const id = existing ? existing.id : (u.id || `usr-${Date.now()}`);
      const next = {
        id,
        username: u.username || existing?.username || id,
        password_hash: password ? hashPassword(password) : existing.password_hash,
        employee_code: u.employeeCode ?? existing?.employee_code ?? '',
        display_name: u.displayName || existing?.display_name || u.username,
        email: u.email || existing?.email || `${u.username}@ballyjute.com`,
        role,
        department_id: u.departmentId ?? existing?.department_id ?? '',
        department_name: u.departmentName ?? existing?.department_name ?? '',
        phone: u.phone ?? existing?.phone ?? '',
        is_active: u.isActive !== undefined ? Boolean(u.isActive) : (existing?.is_active ?? true),
        can_edit_entries: isAdminRole(role) ? true : Boolean(u.canEditEntries ?? existing?.can_edit_entries),
        can_delete_entries: isAdminRole(role) ? true : Boolean(u.canDeleteEntries ?? existing?.can_delete_entries),
        permitted_modules: sanitizeModules(u.permittedModules ?? existing?.permitted_modules, role),
        data_scope: sanitizeDataScope(u.dataScope ?? existing?.data_scope, role),
        token_version: Number(existing?.token_version || 1) + (password ? 1 : 0),
        permittedForms: isAdminRole(role) ? ['*'] : (Array.isArray(u.permittedForms) ? u.permittedForms : (existing?.permittedForms || [])),
      };
      fallbackUsers.set(id, next);
      return res.json({ success: true, user: mapUserRow(next, next.permittedForms) });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const savedUser = await upsertUserRecord(client, u, req.user.id);
      await logAuditEvent(client, {
        entityType: 'USER',
        entityId: savedUser.id,
        action: 'USER_SAVED',
        user: req.user,
        details: {
          username: savedUser.username,
          role: savedUser.role,
          dataScope: savedUser.dataScope,
          permittedModules: savedUser.permittedModules,
          permittedFormsCount: savedUser.permittedForms?.length || 0,
          isActive: savedUser.isActive,
        },
      });
      await client.query('COMMIT');
      res.json({ success: true, user: savedUser });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// Admin-only password reset for another user (invalidates user's existing tokens)
app.post('/api/users/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body || {};
  const cleanPw = String(newPassword || '').trim();
  if (cleanPw.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  try {
    if (!isDatabaseConnected) {
      const fb = fallbackUsers.get(id);
      if (!fb) return res.status(404).json({ success: false, message: 'User not found.' });
      fb.password_hash = hashPassword(cleanPw);
      fb.token_version = Number(fb.token_version || 1) + 1;
      return res.json({ success: true, message: 'Password reset successfully.' });
    }

    const newHash = hashPassword(cleanPw);
    const upd = await pool.query(
      `UPDATE users SET password_hash = $2, token_version = COALESCE(token_version, 1) + 1, updated_at = NOW()
       WHERE id = $1 RETURNING id, username, display_name`,
      [id, newHash]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await logAuditEvent(pool, {
      entityType: 'USER',
      entityId: id,
      action: 'ADMIN_PASSWORD_RESET',
      user: req.user,
      details: { targetUsername: upd.rows[0].username },
    });

    res.json({ success: true, message: `Password reset for ${upd.rows[0].display_name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own active Administrator account.' });
  }

  try {
    if (!isDatabaseConnected) {
      const target = fallbackUsers.get(id);
      if (target && isAdminRole(target.role)) {
        const otherAdmins = Array.from(fallbackUsers.values()).filter(u => u.id !== id && isAdminRole(u.role) && u.is_active);
        if (otherAdmins.length === 0) {
          return res.status(400).json({ success: false, message: 'Cannot delete the last active Administrator account.' });
        }
      }
      fallbackUsers.delete(id);
      return res.json({ success: true, message: `User ${id} removed.` });
    }

    const targetRes = await pool.query(`SELECT id, username, role FROM users WHERE id = $1 LIMIT 1`, [id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const target = targetRes.rows[0];
    if (isAdminRole(target.role)) {
      const otherAdmins = await pool.query(
        `SELECT COUNT(*) AS cnt FROM users WHERE role = 'Admin' AND is_active = TRUE AND id <> $1`,
        [id]
      );
      if (Number(otherAdmins.rows[0]?.cnt || 0) === 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last active Administrator account.' });
      }
    }

    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    await logAuditEvent(pool, {
      entityType: 'USER',
      entityId: id,
      action: 'DELETE',
      user: req.user,
      details: { deletedUsername: target.username },
    });
    res.json({ success: true, message: `User ${id} removed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 10B. ADMIN AUDIT LOGS & SYSTEM SETTINGS APIS
// ==============================================================================

app.get('/api/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json([]);
    const r = await pool.query(
      `SELECT id, entity_type, entity_id, action, performed_by_id, performed_by_name, timestamp, details
       FROM audit_logs ORDER BY timestamp DESC LIMIT 500`
    );
    const formatted = r.rows.map(row => {
      const det = parseJsonSafe(row.details, {});
      return {
        id: row.id,
        timestamp: row.timestamp,
        userId: row.performed_by_id || 'SYSTEM',
        userEmail: det.username || row.performed_by_id || 'SYSTEM',
        userRole: det.role || 'System',
        action: row.action,
        module: row.entity_type,
        recordId: row.entity_id,
        details: typeof row.details === 'string' ? row.details : JSON.stringify(det),
        performedByName: row.performed_by_name,
      };
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json({ success: true, settings: null });
    const r = await pool.query(`SELECT value FROM system_settings WHERE key = 'app_settings' LIMIT 1`);
    res.json({ success: true, settings: r.rows[0]?.value ? parseJsonSafe(r.rows[0].value, null) : null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  const s = req.body || {};
  const sanitized = {
    companyName: String(s.companyName || 'SQC').trim(),
    companySubtitle: String(s.companySubtitle || 'SQC').trim(),
    address: String(s.address || '').trim(),
    inspectionPrefix: String(s.inspectionPrefix || 'SQC/2026-27/').trim(),
    financialYear: String(s.financialYear || '2026-2027').trim(),
    requireDualApproval: Boolean(s.requireDualApproval),
    autoApprovePass: Boolean(s.autoApprovePass),
  };
  try {
    if (isDatabaseConnected) {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_by, updated_at)
         VALUES ('app_settings', $1::jsonb, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [JSON.stringify(sanitized), req.user.display_name || req.user.username]
      );
      await logAuditEvent(pool, {
        entityType: 'SETTINGS',
        entityId: 'app_settings',
        action: 'SETTINGS',
        user: req.user,
        details: sanitized,
      });
    }
    res.json({ success: true, settings: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 11. INSPECTIONS API (Enforces Module, Form, Edit/Delete, & Data Scope RBAC)
// ==============================================================================

app.get(
  '/api/inspections',
  authenticateToken,
  requireAnyModule(['DASHBOARD', 'INSPECTIONS', 'APPROVALS', 'REPORTS']),
  async (req, res) => {
    const { formCode, status, result, departmentId, fromDate, toDate, limit = 500 } = req.query;
    try {
      if (!isDatabaseConnected) return res.json([]);

      if (formCode && !isAdminRole(req.user.role) && !hasModuleAccess(req.user, 'APPROVALS')) {
        const canViewForm = await verifyFormPermission(req.user.id, req.user.role, formCode, req.user.permittedForms);
        if (!canViewForm) {
          return res.status(403).json({
            success: false,
            message: `Access Denied: You are not permitted to view records for ${formCode}.`,
          });
        }
      }

      let query = `SELECT * FROM inspections WHERE 1=1`;
      const params = [];

      // Enforce Data Scope + Permitted Forms at the SQL query layer
      query += buildInspectionScopeWhere(req.user, params);

      if (formCode) {
        const aliases = expandFormCodeAliases(formCode);
        params.push(aliases);
        query += ` AND UPPER(form_code) = ANY($${params.length}::text[])`;
      }
      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      if (result) {
        params.push(result);
        query += ` AND result = $${params.length}`;
      }
      if (departmentId) {
        params.push(departmentId);
        query += ` AND department_id = $${params.length}`;
      }
      if (fromDate) {
        params.push(fromDate);
        query += ` AND inspection_date >= $${params.length}`;
      }
      if (toDate) {
        params.push(toDate);
        query += ` AND inspection_date <= $${params.length}`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(Math.min(parseInt(limit, 10) || 500, 1000));

      const r = await pool.query(query, params);
      res.json(r.rows.map(mapInspectionRow));
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

app.get(
  '/api/inspections/:id',
  authenticateToken,
  requireAnyModule(['DASHBOARD', 'INSPECTIONS', 'APPROVALS', 'REPORTS']),
  async (req, res) => {
    const { id } = req.params;
    try {
      if (!isDatabaseConnected) return res.status(404).json({ success: false, message: 'Not found' });
      const r = await pool.query(`SELECT * FROM inspections WHERE id = $1 OR inspection_no = $1 LIMIT 1`, [id]);
      if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Inspection not found' });
      const row = r.rows[0];
      if (!canAccessInspectionRow(req.user, row)) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: This inspection record is outside your authorized scope or form permissions.',
        });
      }
      res.json(mapInspectionRow(row));
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

app.post('/api/inspections/truncate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isDatabaseConnected) {
      return res.json({ success: true, message: 'Truncated (fallback mode).' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`TRUNCATE TABLE inspections, audit_logs RESTART IDENTITY CASCADE`);
      for (const tbl of UNIQUE_FORM_TABLES) {
        await client.query(`TRUNCATE TABLE ${tbl} RESTART IDENTITY CASCADE`);
      }
      await logAuditEvent(client, {
        entityType: 'SYSTEM',
        entityId: 'inspections',
        action: 'TRUNCATE',
        user: req.user,
        details: { truncatedBy: req.user.username },
      });
      await client.query('COMMIT');
      res.json({ success: true, message: 'All inspections and 38 form tables truncated cleanly.' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/inspections', authenticateToken, async (req, res) => {
  const normalized = normalizeInspectionPayload(req.body);
  if (!normalized.formCode || !normalized.inspectionNo) {
    return res.status(400).json({ success: false, message: 'Form code and inspection number are required.' });
  }

  const isWorkflowAction = ['Approved', 'Rejected', 'Returned'].includes(normalized.status);
  const actorName = req.user.display_name || req.user.username || 'SQC User';

  try {
    if (!isDatabaseConnected) {
      if (isWorkflowAction) {
        if (!isAdminRole(req.user.role) && !(isHodRole(req.user.role) && hasModuleAccess(req.user, 'APPROVALS'))) {
          return res.status(403).json({ success: false, message: 'Permission Denied: Approvals module access required.' });
        }
      } else {
        if (!hasModuleAccess(req.user, 'INSPECTIONS')) {
          return res.status(403).json({ success: false, message: 'Permission Denied: Inspections module access required.' });
        }
      }
      normalized.inspectorId = req.user.id;
      normalized.inspectorName = actorName;
      normalized.createdBy = actorName;
      normalized.updatedBy = actorName;
      return res.json({
        success: true,
        inspection: normalized,
        formTable: resolveFormTable(normalized.formCode),
        message: 'Saved in offline fallback mode (PostgreSQL disconnected).',
      });
    }

    const existingIns = await pool.query(
      `SELECT * FROM inspections WHERE id = $1 OR inspection_no = $2 LIMIT 1`,
      [normalized.id, normalized.inspectionNo]
    );
    const existingRow = existingIns.rows[0];

    if (isWorkflowAction) {
      if (!existingRow) {
        return res.status(404).json({ success: false, message: 'Inspection record not found for workflow action.' });
      }
      if (!isAdminRole(req.user.role)) {
        if (!isHodRole(req.user.role) || !hasModuleAccess(req.user, 'APPROVALS')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You are not authorized to approve, reject, or return inspections.',
          });
        }
        if (!canAccessInspectionRow(req.user, existingRow)) {
          return res.status(403).json({
            success: false,
            message: 'Access Denied: This record is outside your authorized data scope.',
          });
        }
      }
      // Preserve creator & inspector identity on approval transitions
      normalized.id = existingRow.id;
      normalized.inspectorId = existingRow.inspector_id;
      normalized.inspectorName = existingRow.inspector_name;
      normalized.createdBy = existingRow.created_by;
      normalized.updatedBy = actorName;
      if (normalized.status === 'Approved') {
        normalized.approvedBy = actorName;
        normalized.approvedAt = new Date().toISOString();
      }
    } else {
      if (!hasModuleAccess(req.user, 'INSPECTIONS')) {
        return res.status(403).json({
          success: false,
          message: 'Permission Denied: You do not have access to the Inspections & Quality Forms module.',
        });
      }

      const hasFormPerm = await verifyFormPermission(req.user.id, req.user.role, normalized.formCode, req.user.permittedForms);
      if (!hasFormPerm) {
        return res.status(403).json({
          success: false,
          message: `Permission Denied: You do not have permission to enter or save ${normalized.formCode}.`,
        });
      }

      if (existingRow) {
        if (!isAdminRole(req.user.role)) {
          if (!req.user.can_edit_entries) {
            return res.status(403).json({
              success: false,
              message: 'Permission Denied: Admin has not activated Edit permission for your account.',
            });
          }
          if (!canAccessInspectionRow(req.user, existingRow)) {
            return res.status(403).json({
              success: false,
              message: 'Access Denied: You can only edit inspection records within your authorized scope.',
            });
          }
        }
        normalized.id = existingRow.id;
        normalized.inspectorId = existingRow.inspector_id || req.user.id;
        normalized.inspectorName = existingRow.inspector_name || actorName;
        normalized.createdBy = existingRow.created_by || actorName;
        normalized.updatedBy = actorName;
        if (!isAdminRole(req.user.role)) {
          normalized.approvedBy = existingRow.approved_by || null;
          normalized.approvedAt = existingRow.approved_at || null;
        }
      } else {
        // Server-authoritative ownership on newly created inspections
        if (!isAdminRole(req.user.role)) {
          normalized.inspectorId = req.user.id;
          normalized.inspectorName = actorName;
          normalized.createdBy = actorName;
          normalized.approvedBy = null;
          normalized.approvedAt = null;
        } else {
          normalized.inspectorId = normalized.inspectorId || req.user.id;
          normalized.inspectorName = normalized.inspectorName || actorName;
          normalized.createdBy = normalized.createdBy || actorName;
        }
        normalized.updatedBy = actorName;
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { inspection, formTable } = await upsertInspectionAndFormTable(client, normalized);

      await logAuditEvent(client, {
        entityType: 'INSPECTION',
        entityId: inspection.id,
        action: isWorkflowAction ? normalized.status.toUpperCase() : (inspection.status === 'Submitted' ? 'SUBMIT' : 'SAVE'),
        user: req.user,
        details: {
          inspectionNo: inspection.inspectionNo,
          formCode: inspection.formCode,
          formTable,
          status: inspection.status,
          result: inspection.result,
        },
      });

      await client.query('COMMIT');
      res.json({
        success: true,
        inspection,
        formTable,
        message: `Saved to PostgreSQL (inspections${formTable ? ` + ${formTable}` : ''})`,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ [POST /api/inspections] PostgreSQL Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/inspections/:id', authenticateToken, requireModule('INSPECTIONS'), async (req, res) => {
  const { id } = req.params;
  if (!isAdminRole(req.user.role) && !req.user.can_delete_entries) {
    return res.status(403).json({
      success: false,
      message: 'Permission Denied: Admin has not activated Delete permission for your account.',
    });
  }
  try {
    if (isDatabaseConnected) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query(
          `SELECT * FROM inspections WHERE id = $1 OR inspection_no = $1`,
          [id]
        );
        if (found.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Inspection not found.' });
        }
        for (const row of found.rows) {
          if (!isAdminRole(req.user.role)) {
            const hasFormPerm = await verifyFormPermission(req.user.id, req.user.role, row.form_code, req.user.permittedForms);
            if (!hasFormPerm || !canAccessInspectionRow(req.user, row)) {
              await client.query('ROLLBACK');
              return res.status(403).json({
                success: false,
                message: 'Access Denied: You can only delete permitted inspection records within your authorized scope.',
              });
            }
          }
          const formTable = resolveFormTable(row.form_code);
          if (formTable) {
            await client.query(`DELETE FROM ${formTable} WHERE id = $1 OR inspection_no = $2`, [row.id, row.inspection_no]);
          }
          await logAuditEvent(client, {
            entityType: 'INSPECTION',
            entityId: row.id,
            action: 'DELETE',
            user: req.user,
            details: { inspectionNo: row.inspection_no, formCode: row.form_code },
          });
        }
        await client.query(`DELETE FROM inspections WHERE id = $1 OR inspection_no = $1`, [id]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    res.json({ success: true, message: `Inspection ${id} deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==============================================================================
// 12. MASTER DATA APIS (Departments, Sections, Machines, Looms, Qualities, Standards)
// ==============================================================================

async function upsertDepartment(client, d) {
  const r = await client.query(
    `INSERT INTO departments (id, code, name, description, hod_name, order_index, status, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name, description = EXCLUDED.description,
       hod_name = EXCLUDED.hod_name, order_index = EXCLUDED.order_index,
       status = EXCLUDED.status, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *;`,
    [
      d.id || `dept-${Date.now()}`,
      d.code,
      d.name,
      d.description || '',
      d.hodName || d.hod || '',
      Number(d.orderIndex || 0),
      d.status || 'Active',
      d.isActive !== undefined ? d.isActive : true,
    ]
  );
  return mapDepartmentRow(r.rows[0]);
}

async function upsertSection(client, s) {
  const r = await client.query(
    `INSERT INTO sections (id, department_id, department_code, code, name, description, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (code) DO UPDATE SET
       department_id = EXCLUDED.department_id, department_code = EXCLUDED.department_code,
       name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *;`,
    [
      s.id || `sec-${Date.now()}`,
      s.departmentId || '',
      s.departmentCode || '',
      s.code,
      s.name,
      s.description || '',
      s.isActive !== undefined ? s.isActive : true,
    ]
  );
  return mapSectionRow(r.rows[0]);
}

async function upsertMachine(client, m) {
  const r = await client.query(
    `INSERT INTO machines (id, department_id, department_code, section_id, code, name, type, machine_type, capacity, speed_standard, speed_unit, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT (code) DO UPDATE SET
       department_id = EXCLUDED.department_id, department_code = EXCLUDED.department_code,
       section_id = EXCLUDED.section_id, name = EXCLUDED.name, type = EXCLUDED.type,
       machine_type = EXCLUDED.machine_type, capacity = EXCLUDED.capacity,
       speed_standard = EXCLUDED.speed_standard, speed_unit = EXCLUDED.speed_unit,
       is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *;`,
    [
      m.id || `mac-${Date.now()}`,
      m.departmentId || '',
      m.departmentCode || '',
      m.sectionId || '',
      m.code,
      m.name,
      m.type || m.machineType || '',
      m.machineType || m.type || '',
      m.capacity || '',
      Number(m.speedStandard || 0),
      m.speedUnit || 'rpm',
      m.isActive !== undefined ? m.isActive : true,
    ]
  );
  return mapMachineRow(r.rows[0]);
}

async function upsertLoom(client, l) {
  const r = await client.query(
    `INSERT INTO looms (id, loom_no, code, name, shed, shed_type, loom_type, reed_space, rpm, standard_rpm, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (code) DO UPDATE SET
       loom_no = EXCLUDED.loom_no, name = EXCLUDED.name, shed = EXCLUDED.shed,
       shed_type = EXCLUDED.shed_type, loom_type = EXCLUDED.loom_type,
       reed_space = EXCLUDED.reed_space, rpm = EXCLUDED.rpm, standard_rpm = EXCLUDED.standard_rpm,
       is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *;`,
    [
      l.id || `loom-${Date.now()}`,
      l.loomNo || l.code,
      l.code,
      l.name,
      l.shed || '',
      l.shedType || '',
      l.loomType || '',
      l.reedSpace || '',
      Number(l.rpm || l.standardRpm || 140),
      Number(l.standardRpm || l.rpm || 140),
      l.isActive !== undefined ? l.isActive : true,
    ]
  );
  return mapLoomRow(r.rows[0]);
}

async function upsertQuality(client, q) {
  const r = await client.query(
    `INSERT INTO qualities (id, code, name, category, nominal_count, standard_mr, warp_count, weft_count, description, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name, category = EXCLUDED.category, nominal_count = EXCLUDED.nominal_count,
       standard_mr = EXCLUDED.standard_mr, warp_count = EXCLUDED.warp_count, weft_count = EXCLUDED.weft_count,
       description = EXCLUDED.description, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *;`,
    [
      q.id || `qual-${Date.now()}`,
      q.code,
      q.name,
      q.category || '',
      q.nominalCount !== undefined && q.nominalCount !== '' ? Number(q.nominalCount) : null,
      q.standardMR !== undefined && q.standardMR !== '' ? Number(q.standardMR) : (q.standardMr ? Number(q.standardMr) : null),
      q.warpCount !== undefined && q.warpCount !== '' ? Number(q.warpCount) : null,
      q.weftCount !== undefined && q.weftCount !== '' ? Number(q.weftCount) : null,
      q.description || '',
      q.isActive !== undefined ? q.isActive : true,
    ]
  );
  return mapQualityRow(r.rows[0]);
}

async function upsertStandard(client, s) {
  const stdId = s.id || `std-${Date.now()}`;
  const r = await client.query(
    `INSERT INTO quality_standards (id, standard_code, form_code, department_id, quality_id, name, parameter_name, parameter, nominal_value, lower_limit, upper_limit, standard_value, tolerance, unit, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
     ON CONFLICT (id) DO UPDATE SET
       standard_code = EXCLUDED.standard_code, form_code = EXCLUDED.form_code,
       name = EXCLUDED.name, parameter_name = EXCLUDED.parameter_name, parameter = EXCLUDED.parameter,
       nominal_value = EXCLUDED.nominal_value, lower_limit = EXCLUDED.lower_limit,
       upper_limit = EXCLUDED.upper_limit, standard_value = EXCLUDED.standard_value,
       tolerance = EXCLUDED.tolerance, unit = EXCLUDED.unit, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *;`,
    [
      stdId,
      s.code || s.standardCode || stdId,
      s.formCode,
      s.departmentId || '',
      s.qualityId || '',
      s.name || s.parameterName || s.parameter || '',
      s.parameterName || s.parameter || s.name || '',
      s.parameter || s.parameterName || s.name || '',
      s.nominalValue !== undefined && s.nominalValue !== '' ? Number(s.nominalValue) : null,
      s.lowerLimit !== undefined && s.lowerLimit !== '' ? Number(s.lowerLimit) : null,
      s.upperLimit !== undefined && s.upperLimit !== '' ? Number(s.upperLimit) : null,
      s.standardValue !== undefined && s.standardValue !== '' ? Number(s.standardValue) : null,
      s.tolerance || '',
      s.unit || '',
      s.isActive !== undefined ? s.isActive : true,
    ]
  );
  return mapStandardRow(r.rows[0]);
}

// Master Data Read & Write Authorization Guards
const requireMasterReadAccess = [authenticateToken, requireAnyModule(GRANTABLE_MODULES)];
const requireMasterWriteAccess = [authenticateToken, requireModule('MASTERS')];

// Departments
app.get('/api/departments', ...requireMasterReadAccess, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json([]);
    const r = await pool.query('SELECT * FROM departments ORDER BY order_index ASC, name ASC');
    res.json(r.rows.map(mapDepartmentRow));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/departments', ...requireMasterWriteAccess, async (req, res) => {
  const d = req.body;
  if (!d.code || !d.name) return res.status(400).json({ success: false, message: 'code and name required' });
  try {
    if (!isDatabaseConnected) return res.json({ success: true, department: d });
    const dept = await upsertDepartment(pool, d);
    res.json({ success: true, department: dept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/departments/:id', ...requireMasterWriteAccess, async (req, res) => {
  try {
    if (isDatabaseConnected) await pool.query('DELETE FROM departments WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Sections
app.get('/api/sections', ...requireMasterReadAccess, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json([]);
    const r = await pool.query('SELECT * FROM sections ORDER BY name ASC');
    res.json(r.rows.map(mapSectionRow));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sections', ...requireMasterWriteAccess, async (req, res) => {
  const s = req.body;
  if (!s.code || !s.name) return res.status(400).json({ success: false, message: 'code and name required' });
  try {
    if (!isDatabaseConnected) return res.json({ success: true, section: s });
    const section = await upsertSection(pool, s);
    res.json({ success: true, section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/sections/:id', ...requireMasterWriteAccess, async (req, res) => {
  try {
    if (isDatabaseConnected) await pool.query('DELETE FROM sections WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Machines
app.get('/api/machines', ...requireMasterReadAccess, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json([]);
    const r = await pool.query('SELECT * FROM machines ORDER BY name ASC');
    res.json(r.rows.map(mapMachineRow));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/machines', ...requireMasterWriteAccess, async (req, res) => {
  const m = req.body;
  if (!m.code || !m.name) return res.status(400).json({ success: false, message: 'code and name required' });
  try {
    if (!isDatabaseConnected) return res.json({ success: true, machine: m });
    const machine = await upsertMachine(pool, m);
    res.json({ success: true, machine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/machines/:id', ...requireMasterWriteAccess, async (req, res) => {
  try {
    if (isDatabaseConnected) await pool.query('DELETE FROM machines WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Looms
app.get('/api/looms', ...requireMasterReadAccess, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json([]);
    const r = await pool.query('SELECT * FROM looms ORDER BY loom_no ASC');
    res.json(r.rows.map(mapLoomRow));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/looms', ...requireMasterWriteAccess, async (req, res) => {
  const l = req.body;
  if (!l.code || !l.name) return res.status(400).json({ success: false, message: 'code and name required' });
  try {
    if (!isDatabaseConnected) return res.json({ success: true, loom: l });
    const loom = await upsertLoom(pool, l);
    res.json({ success: true, loom });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/looms/:id', ...requireMasterWriteAccess, async (req, res) => {
  try {
    if (isDatabaseConnected) await pool.query('DELETE FROM looms WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Qualities
app.get('/api/qualities', ...requireMasterReadAccess, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json([]);
    const r = await pool.query('SELECT * FROM qualities ORDER BY name ASC');
    res.json(r.rows.map(mapQualityRow));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/qualities', ...requireMasterWriteAccess, async (req, res) => {
  const q = req.body;
  if (!q.code || !q.name) return res.status(400).json({ success: false, message: 'code and name required' });
  try {
    if (!isDatabaseConnected) return res.json({ success: true, quality: q });
    const quality = await upsertQuality(pool, q);
    res.json({ success: true, quality });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/qualities/:id', ...requireMasterWriteAccess, async (req, res) => {
  try {
    if (isDatabaseConnected) await pool.query('DELETE FROM qualities WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Standards
app.get('/api/standards', ...requireMasterReadAccess, async (req, res) => {
  try {
    if (!isDatabaseConnected) return res.json([]);
    const r = await pool.query('SELECT * FROM quality_standards ORDER BY form_code ASC, parameter_name ASC');
    res.json(r.rows.map(mapStandardRow));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/standards', ...requireMasterWriteAccess, async (req, res) => {
  const s = req.body;
  if (!s.formCode) return res.status(400).json({ success: false, message: 'formCode required' });
  try {
    if (!isDatabaseConnected) return res.json({ success: true, standard: s });
    const standard = await upsertStandard(pool, s);
    res.json({ success: true, standard });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/standards/:id', ...requireMasterWriteAccess, async (req, res) => {
  try {
    if (isDatabaseConnected) await pool.query('DELETE FROM quality_standards WHERE id = $1 OR standard_code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Full Combined Snapshot Sync (/api/all-data) - Strictly Scoped Per Authenticated User
app.get('/api/all-data', authenticateToken, async (req, res) => {
  try {
    const admin = isAdminRole(req.user.role);
    const hasAnyGranted = admin || hasAnyModuleAccess(req.user, GRANTABLE_MODULES);
    const canViewInspections = admin || hasAnyModuleAccess(req.user, ['DASHBOARD', 'INSPECTIONS', 'APPROVALS', 'REPORTS']);

    if (!isDatabaseConnected) {
      const empty = {
        users: admin ? Array.from(fallbackUsers.values()).map(u => mapUserRow(u, u.permittedForms || [])) : [],
        departments: [],
        sections: [],
        machines: [],
        looms: [],
        qualities: [],
        standards: [],
        inspections: [],
      };
      return res.json({ success: true, ...empty, data: empty });
    }

    const insParams = [];
    const insScopeSql = canViewInspections ? buildInspectionScopeWhere(req.user, insParams) : ' AND 1=0';

    const [u, perms, d, s, m, l, q, std, ins] = await Promise.all([
      admin
        ? pool.query('SELECT id, username, employee_code, display_name, email, role, department_id, department_name, phone, is_active, can_edit_entries, can_delete_entries, permitted_modules, data_scope, token_version, created_at, updated_at FROM users ORDER BY display_name ASC')
        : Promise.resolve({ rows: [] }),
      admin
        ? pool.query('SELECT user_id, form_code FROM user_form_permissions')
        : Promise.resolve({ rows: [] }),
      hasAnyGranted ? pool.query('SELECT * FROM departments ORDER BY order_index ASC, name ASC') : Promise.resolve({ rows: [] }),
      hasAnyGranted ? pool.query('SELECT * FROM sections ORDER BY name ASC') : Promise.resolve({ rows: [] }),
      hasAnyGranted ? pool.query('SELECT * FROM machines ORDER BY name ASC') : Promise.resolve({ rows: [] }),
      hasAnyGranted ? pool.query('SELECT * FROM looms ORDER BY loom_no ASC') : Promise.resolve({ rows: [] }),
      hasAnyGranted ? pool.query('SELECT * FROM qualities ORDER BY name ASC') : Promise.resolve({ rows: [] }),
      hasAnyGranted ? pool.query('SELECT * FROM quality_standards ORDER BY form_code ASC') : Promise.resolve({ rows: [] }),
      canViewInspections
        ? pool.query(`SELECT * FROM inspections WHERE 1=1 ${insScopeSql} ORDER BY created_at DESC LIMIT 500`, insParams)
        : Promise.resolve({ rows: [] }),
    ]);

    const permsMap = {};
    perms.rows.forEach(p => {
      if (!permsMap[p.user_id]) permsMap[p.user_id] = [];
      permsMap[p.user_id].push(p.form_code);
    });

    const payload = {
      users: admin ? u.rows.map(row => mapUserRow(row, permsMap[row.id] || [])) : [],
      departments: d.rows.map(mapDepartmentRow),
      sections: s.rows.map(mapSectionRow),
      machines: m.rows.map(mapMachineRow),
      looms: l.rows.map(mapLoomRow),
      qualities: q.rows.map(mapQualityRow),
      standards: std.rows.map(mapStandardRow),
      inspections: ins.rows.map(mapInspectionRow),
    };

    res.json({
      success: true,
      ...payload,
      data: payload,
      maintenanceMode: maintenanceState,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Bulk Push Sync handler (Admin-only)
async function handleBulkSync(req, res) {
  const { users, departments, sections, machines, looms, qualities, standards, inspections } = req.body || {};
  try {
    if (!isDatabaseConnected) {
      return res.json({ success: true, message: 'Received data (fallback mode).' });
    }

    const client = await pool.connect();
    const counts = {
      users: 0,
      departments: 0,
      sections: 0,
      machines: 0,
      looms: 0,
      qualities: 0,
      standards: 0,
      inspections: 0,
    };

    try {
      await client.query('BEGIN');

      if (Array.isArray(users)) {
        for (const u of users) {
          if (!u || (!u.displayName && !u.username)) continue;
          // Skip inserting new users via bulk sync if they don't carry a password/existing record
          const exists = await client.query(
            `SELECT id FROM users WHERE id = $1 OR LOWER(username) = LOWER($2) LIMIT 1`,
            [u.id || '', u.username || '']
          );
          if (exists.rows.length === 0 && !u.password) continue;
          await upsertUserRecord(client, u, req.user.id);
          counts.users++;
        }
      }
      if (Array.isArray(departments)) {
        for (const d of departments) {
          if (!d || !d.code || !d.name) continue;
          await upsertDepartment(client, d);
          counts.departments++;
        }
      }
      if (Array.isArray(sections)) {
        for (const s of sections) {
          if (!s || !s.code || !s.name) continue;
          await upsertSection(client, s);
          counts.sections++;
        }
      }
      if (Array.isArray(machines)) {
        for (const m of machines) {
          if (!m || !m.code || !m.name) continue;
          await upsertMachine(client, m);
          counts.machines++;
        }
      }
      if (Array.isArray(looms)) {
        for (const l of looms) {
          if (!l || !l.code || !l.name) continue;
          await upsertLoom(client, l);
          counts.looms++;
        }
      }
      if (Array.isArray(qualities)) {
        for (const q of qualities) {
          if (!q || !q.code || !q.name) continue;
          await upsertQuality(client, q);
          counts.qualities++;
        }
      }
      if (Array.isArray(standards)) {
        for (const st of standards) {
          if (!st || !st.formCode) continue;
          await upsertStandard(client, st);
          counts.standards++;
        }
      }
      if (Array.isArray(inspections)) {
        for (const ins of inspections) {
          const norm = normalizeInspectionPayload(ins);
          if (!norm.inspectionNo || !norm.formCode) continue;
          await upsertInspectionAndFormTable(client, norm);
          counts.inspections++;
        }
      }

      await client.query('COMMIT');
      res.json({
        success: true,
        counts,
        message: `Synchronized ${counts.inspections} inspections (with dedicated form tables), ${counts.users} users, and masters to PostgreSQL.`,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ [Bulk Sync] Error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

app.post('/api/sync/all', authenticateToken, requireAdmin, handleBulkSync);
app.post('/api/sync-all', authenticateToken, requireAdmin, handleBulkSync);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const infoRes = await pool.query(`SELECT current_database() AS db, current_user AS usr, version() AS ver`);
    const countIns = await pool.query(`SELECT COUNT(*) AS cnt FROM inspections`);
    const countUsers = await pool.query(`SELECT COUNT(*) AS cnt FROM users`);
    isDatabaseConnected = true;

    res.json({
      status: 'online',
      appName: 'SQC',
      serverHost: DB_HOST,
      database: infoRes.rows[0]?.db || DB_NAME,
      user: infoRes.rows[0]?.usr || 'postgres',
      postgresVersion: infoRes.rows[0]?.ver || '',
      databaseConnected: true,
      maintenanceMode: maintenanceState,
      stats: {
        inspections_count: Number(countIns.rows[0]?.cnt || 0),
        users_count: Number(countUsers.rows[0]?.cnt || 0),
      },
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    isDatabaseConnected = false;
    res.status(503).json({
      status: 'degraded',
      appName: 'SQC',
      serverHost: DB_HOST,
      database: DB_NAME,
      databaseConnected: false,
      error: err.message,
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  }
});

// ==============================================================================
// 13. SERVE STATIC FRONTEND BUILD (Single Combined Port 3001)
// ==============================================================================
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log(`📂 Serving static production frontend from: ${distPath}`);
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      name: 'SQC Production API Server',
      status: 'active',
      server: DB_HOST,
      database: DB_NAME,
      port: PORT,
      note: 'Run `npm run build` to generate and serve the frontend web client on this port.',
    });
  });
}

// 14. Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================================');
  console.log(`🚀 SQC Management System running on http://0.0.0.0:${PORT}`);
  console.log(`🖥️  Host Server : ${DB_HOST}`);
  console.log(`📦 Database    : "${DB_NAME}"`);
  console.log(`🌐 Public Port : ${PORT}`);
  console.log('==================================================================');
});
