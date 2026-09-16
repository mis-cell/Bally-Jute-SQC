// ==============================================================================
// BALLY JUTE COMPANY LIMITED - S.Q.C. QUALITY CONTROL SYSTEM
// Production Local PostgreSQL API Server (for Windows PowerShell / C:\my-local-api)
// Comprehensive CRUD & Synchronization for Users, Masters, and Inspections
// ==============================================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'change-this-to-a-long-secret-key-123456';

// 1. CORS Configuration (Supports Cloudflare Tunnel, Ngrok & AI Studio Web App)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'ngrok-skip-browser-warning'],
}));

app.use(express.json({ limit: '20mb' }));

// 2. PostgreSQL Connection Pool
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || '127.0.0.1',
  database: process.env.PGDATABASE || 'SQC',
  password: process.env.PGPASSWORD || 'postgres',
  port: parseInt(process.env.PGPORT || '5432', 10),
});

// Auto-initialize tables on startup
async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('📦 Connected to PostgreSQL database:', process.env.PGDATABASE || 'SQC');

    // Users Table
    await client.query(`
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
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_users_emp ON users (employee_code);
    `);

    // Departments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        hod_name VARCHAR(150),
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Sections Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        department_code VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Machines Table
    await client.query(`
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
    `);

    // Looms Table
    await client.query(`
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
    `);

    // Qualities Table
    await client.query(`
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
    `);

    // Standards Table
    await client.query(`
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
    `);

    // Inspections Table
    await client.query(`
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
      CREATE INDEX IF NOT EXISTS idx_inspections_no ON inspections (inspection_no);
      CREATE INDEX IF NOT EXISTS idx_inspections_form ON inspections (form_code);
      CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (inspection_date);
    `);

    // Audit Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        user_email VARCHAR(150),
        user_role VARCHAR(50),
        action VARCHAR(50),
        module VARCHAR(100),
        record_id VARCHAR(100),
        details TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (timestamp DESC);
    `);

    client.release();
    console.log('✅ SQC database tables and schema verified successfully.');
  } catch (err) {
    console.error('⚠️ Database connection / initialization notice:', err.message);
  }
}

initDatabase();

// 3. Authentication Middleware
function checkApiKey(req, res, next) {
  const reqKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!reqKey || reqKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing x-api-key header.',
    });
  }
  next();
}

// 4. API Endpoints

// Root Health Check (Public - used by Cloudflare tunnel and connection testing)
app.get('/', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT current_database() as database, current_user as user, version()');
    const countsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM inspections) as inspections_count,
        (SELECT COUNT(*) FROM departments) as departments_count
    `);

    res.json({
      status: 'online',
      service: 'Bally Jute SQC Local PostgreSQL Engine',
      database: dbRes.rows[0].database,
      user: dbRes.rows[0].user,
      postgresVersion: dbRes.rows[0].version.split(' ')[1],
      stats: countsRes.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'database_error',
      message: 'Node.js server running, but failed to connect to PostgreSQL.',
      error: err.message,
    });
  }
});

// ==========================================
// 4.1 USERS CRUD (Full PostgreSQL Sync)
// ==========================================

// GET /api/users
app.get('/api/users', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    const mapped = result.rows.map(r => ({
      id: r.id,
      employeeCode: r.employee_code,
      displayName: r.display_name,
      email: r.email,
      role: r.role,
      departmentId: r.department_id,
      departmentName: r.department_name,
      isActive: r.is_active,
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users - Upsert user into PostgreSQL
app.post('/api/users', checkApiKey, async (req, res) => {
  const b = req.body;
  const id = b.id || `u-${Date.now()}`;
  const employeeCode = b.employeeCode || b.employee_code || `EMP-${Date.now()}`;
  const displayName = b.displayName || b.display_name;
  const email = b.email;
  const role = b.role || 'SQC Inspector / User';
  const departmentId = b.departmentId || b.department_id || 'dept-general';
  const departmentName = b.departmentName || b.department_name || 'General';
  const isActive = b.isActive !== undefined ? b.isActive : true;

  if (!displayName || !email) {
    return res.status(400).json({ success: false, message: 'displayName and email are required.' });
  }

  try {
    const query = `
      INSERT INTO users (id, employee_code, display_name, email, role, department_id, department_name, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (email) DO UPDATE SET
        employee_code = EXCLUDED.employee_code,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [id, employeeCode, displayName, email, role, departmentId, departmentName, isActive];
    const result = await pool.query(query, values);
    console.log(`👤 [PostgreSQL] Saved user ${displayName} (${email}) in table 'users'.`);
    res.json({ success: true, record: result.rows[0] });
  } catch (err) {
    console.error('Error saving user:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', checkApiKey, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 OR employee_code = $1 OR email = $1 RETURNING id', [id]);
    console.log(`🗑️ [PostgreSQL] Deleted user ${id}`);
    res.json({ success: true, deleted: result.rowCount > 0 });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4.2 MASTER TABLES CRUD
// ==========================================

// DEPARTMENTS
app.get('/api/departments', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY code ASC');
    res.json(result.rows.map(r => ({ id: r.id, code: r.code, name: r.name, hodName: r.hod_name, status: r.status })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/departments', checkApiKey, async (req, res) => {
  const b = req.body;
  try {
    const q = `
      INSERT INTO departments (id, code, name, hod_name, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        hod_name = EXCLUDED.hod_name,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *;
    `;
    const r = await pool.query(q, [b.id || `dept-${Date.now()}`, b.code, b.name, b.hodName || b.hod_name || '', b.status || 'Active']);
    console.log(`🏢 [PostgreSQL] Saved Department ${b.code}`);
    res.json({ success: true, record: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/departments/:id', checkApiKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM departments WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SECTIONS
app.get('/api/sections', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sections ORDER BY code ASC');
    res.json(result.rows.map(r => ({ id: r.id, code: r.code, name: r.name, departmentCode: r.department_code })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sections', checkApiKey, async (req, res) => {
  const b = req.body;
  try {
    const q = `
      INSERT INTO sections (id, code, name, department_code, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        department_code = EXCLUDED.department_code,
        updated_at = NOW()
      RETURNING *;
    `;
    const r = await pool.query(q, [b.id || `sec-${Date.now()}`, b.code, b.name, b.departmentCode || b.department_code || '']);
    res.json({ success: true, record: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/sections/:id', checkApiKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM sections WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// MACHINES
app.get('/api/machines', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY code ASC');
    res.json(result.rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      machineType: r.machine_type,
      departmentCode: r.department_code,
      speedStandard: Number(r.speed_standard),
      speedUnit: r.speed_unit,
    })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/machines', checkApiKey, async (req, res) => {
  const b = req.body;
  try {
    const q = `
      INSERT INTO machines (id, code, name, machine_type, department_code, speed_standard, speed_unit, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        machine_type = EXCLUDED.machine_type,
        department_code = EXCLUDED.department_code,
        speed_standard = EXCLUDED.speed_standard,
        speed_unit = EXCLUDED.speed_unit,
        updated_at = NOW()
      RETURNING *;
    `;
    const r = await pool.query(q, [
      b.id || `mch-${Date.now()}`,
      b.code,
      b.name,
      b.machineType || b.machine_type || '',
      b.departmentCode || b.department_code || '',
      Number(b.speedStandard || b.speed_standard || 0),
      b.speedUnit || b.speed_unit || 'rpm',
    ]);
    res.json({ success: true, record: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/machines/:id', checkApiKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM machines WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// LOOMS
app.get('/api/looms', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM looms ORDER BY code ASC');
    res.json(result.rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      loomType: r.loom_type,
      shed: r.shed,
      standardRpm: r.standard_rpm,
    })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/looms', checkApiKey, async (req, res) => {
  const b = req.body;
  try {
    const q = `
      INSERT INTO looms (id, code, name, loom_type, shed, standard_rpm, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        loom_type = EXCLUDED.loom_type,
        shed = EXCLUDED.shed,
        standard_rpm = EXCLUDED.standard_rpm,
        updated_at = NOW()
      RETURNING *;
    `;
    const r = await pool.query(q, [
      b.id || `loom-${Date.now()}`,
      b.code,
      b.name,
      b.loomType || b.loom_type || '',
      b.shed || '',
      Number(b.standardRpm || b.standard_rpm || 140),
    ]);
    res.json({ success: true, record: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/looms/:id', checkApiKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM looms WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// QUALITIES
app.get('/api/qualities', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM qualities ORDER BY code ASC');
    res.json(result.rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      nominalCount: Number(r.nominal_count),
      standardMR: Number(r.standard_mr),
    })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/qualities', checkApiKey, async (req, res) => {
  const b = req.body;
  try {
    const q = `
      INSERT INTO qualities (id, code, name, category, nominal_count, standard_mr, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        nominal_count = EXCLUDED.nominal_count,
        standard_mr = EXCLUDED.standard_mr,
        updated_at = NOW()
      RETURNING *;
    `;
    const r = await pool.query(q, [
      b.id || `qual-${Date.now()}`,
      b.code,
      b.name,
      b.category || '',
      Number(b.nominalCount || b.nominal_count || 0),
      Number(b.standardMR || b.standard_mr || 17),
    ]);
    res.json({ success: true, record: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/qualities/:id', checkApiKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM qualities WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// STANDARDS
app.get('/api/standards', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM standards ORDER BY form_code ASC, code ASC');
    res.json(result.rows.map(r => ({
      id: r.id,
      code: r.code,
      formCode: r.form_code,
      name: r.name,
      parameter: r.parameter,
      nominalValue: Number(r.nominal_value),
      lowerLimit: Number(r.lower_limit),
      upperLimit: Number(r.upper_limit),
      unit: r.unit,
      tolerance: r.tolerance,
    })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/standards', checkApiKey, async (req, res) => {
  const b = req.body;
  try {
    const q = `
      INSERT INTO standards (id, code, form_code, name, parameter, nominal_value, lower_limit, upper_limit, unit, tolerance, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (code) DO UPDATE SET
        form_code = EXCLUDED.form_code,
        name = EXCLUDED.name,
        parameter = EXCLUDED.parameter,
        nominal_value = EXCLUDED.nominal_value,
        lower_limit = EXCLUDED.lower_limit,
        upper_limit = EXCLUDED.upper_limit,
        unit = EXCLUDED.unit,
        tolerance = EXCLUDED.tolerance,
        updated_at = NOW()
      RETURNING *;
    `;
    const r = await pool.query(q, [
      b.id || `std-${Date.now()}`,
      b.code,
      b.formCode || b.form_code || 'FORM-01',
      b.name,
      b.parameter || '',
      Number(b.nominalValue || b.nominal_value || 0),
      Number(b.lowerLimit || b.lower_limit || 0),
      Number(b.upperLimit || b.upper_limit || 0),
      b.unit || '',
      b.tolerance || '',
    ]);
    res.json({ success: true, record: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/standards/:id', checkApiKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM standards WHERE id = $1 OR code = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4.3 INSPECTIONS CRUD
// ==========================================

// GET /api/inspections
app.get('/api/inspections', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        inspection_no AS "inspectionNo",
        form_id AS "formId",
        form_code AS "formCode",
        form_title AS "formTitle",
        department_id AS "departmentId",
        shift_id AS "shiftId",
        shift_name AS "shiftName",
        inspector_id AS "inspectorId",
        inspector_name AS "inspectorName",
        inspection_date AS "inspectionDate",
        status,
        result,
        form_data AS "formData",
        reading_rows AS "readingRows",
        summary_metrics AS "summaryMetrics",
        remarks,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM inspections
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inspections:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/inspections - Upsert inspection record
app.post('/api/inspections', checkApiKey, async (req, res) => {
  const b = req.body;
  const inspectionNo = b.inspection_no || b.inspectionNo;
  if (!inspectionNo) {
    return res.status(400).json({ success: false, message: 'inspection_no is required' });
  }

  const formId = b.form_id || b.formId || 'FORM-GENERAL';
  const formCode = b.form_code || b.formCode || formId;
  const formTitle = b.form_title || b.formTitle || 'SQC Inspection Form';
  const departmentId = b.department_id || b.departmentId || 'dept-general';
  const shiftId = b.shift_id || b.shiftId || 'A';
  const shiftName = b.shift_name || b.shiftName || 'General';
  const inspectorId = b.inspector_id || b.inspectorId || 'u1';
  const inspectorName = b.inspector_name || b.inspectorName || 'SQC Inspector';
  const inspectionDate = b.inspection_date || b.inspectionDate || new Date().toISOString().split('T')[0];
  const status = b.status || 'Draft';
  const result = b.result || 'PASS';
  const formData = JSON.stringify(b.form_data || b.formData || {});
  const readingRows = JSON.stringify(b.reading_rows || b.readingRows || []);
  const summaryMetrics = JSON.stringify(b.summary_metrics || b.summaryMetrics || {});
  const remarks = b.remarks || '';

  try {
    const query = `
      INSERT INTO inspections (
        inspection_no, form_id, form_code, form_title,
        department_id, shift_id, shift_name,
        inspector_id, inspector_name, inspection_date,
        status, result, form_data, reading_rows, summary_metrics, remarks,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (inspection_no) DO UPDATE SET
        form_id = EXCLUDED.form_id,
        form_code = EXCLUDED.form_code,
        form_title = EXCLUDED.form_title,
        department_id = EXCLUDED.department_id,
        shift_id = EXCLUDED.shift_id,
        shift_name = EXCLUDED.shift_name,
        inspector_id = EXCLUDED.inspector_id,
        inspector_name = EXCLUDED.inspector_name,
        inspection_date = EXCLUDED.inspection_date,
        status = EXCLUDED.status,
        result = EXCLUDED.result,
        form_data = EXCLUDED.form_data,
        reading_rows = EXCLUDED.reading_rows,
        summary_metrics = EXCLUDED.summary_metrics,
        remarks = EXCLUDED.remarks,
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [
      inspectionNo, formId, formCode, formTitle,
      departmentId, shiftId, shiftName,
      inspectorId, inspectorName, inspectionDate,
      status, result, formData, readingRows, summaryMetrics, remarks
    ];

    const dbRes = await pool.query(query, values);
    console.log(`✅ [PostgreSQL] Saved inspection #${inspectionNo} (Status: ${status}, Result: ${result})`);
    res.json({ success: true, record: dbRes.rows[0] });
  } catch (err) {
    console.error('Error saving inspection:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/inspections/:inspectionNo
app.delete('/api/inspections/:inspectionNo', checkApiKey, async (req, res) => {
  const { inspectionNo } = req.params;
  try {
    const delRes = await pool.query('DELETE FROM inspections WHERE inspection_no = $1 RETURNING id', [inspectionNo]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }
    console.log(`🗑️ [PostgreSQL] Deleted inspection #${inspectionNo}`);
    res.json({ success: true, message: `Deleted inspection ${inspectionNo}` });
  } catch (err) {
    console.error('Error deleting inspection:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/inspections/truncate
app.post('/api/inspections/truncate', checkApiKey, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE inspections RESTART IDENTITY CASCADE;');
    console.log('🧹 [PostgreSQL] All inspections truncated.');
    res.json({ success: true, message: 'All inspection records wiped successfully in local PostgreSQL.' });
  } catch (err) {
    console.error('Error truncating inspections:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4.4 BULK SYNC ALL DATA (One-Click Sync)
// ==========================================
app.post('/api/sync-all', checkApiKey, async (req, res) => {
  const { users = [], departments = [], sections = [], machines = [], looms = [], qualities = [], standards = [], inspections = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Sync Users
    for (const u of users) {
      if (!u.email || !u.displayName) continue;
      await client.query(`
        INSERT INTO users (id, employee_code, display_name, email, role, department_id, department_name, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (email) DO UPDATE SET
          employee_code = EXCLUDED.employee_code,
          display_name = EXCLUDED.display_name,
          role = EXCLUDED.role,
          department_id = EXCLUDED.department_id,
          department_name = EXCLUDED.department_name,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `, [u.id || `u-${Date.now()}`, u.employeeCode || `EMP-${Date.now()}`, u.displayName, u.email, u.role || 'SQC Inspector / User', u.departmentId || '', u.departmentName || '', true]);
    }

    // 2. Sync Departments
    for (const d of departments) {
      if (!d.code || !d.name) continue;
      await client.query(`
        INSERT INTO departments (id, code, name, hod_name, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          hod_name = EXCLUDED.hod_name,
          status = EXCLUDED.status,
          updated_at = NOW();
      `, [d.id || `dept-${Date.now()}`, d.code, d.name, d.hodName || '', d.status || 'Active']);
    }

    // 3. Sync Sections
    for (const s of sections) {
      if (!s.code || !s.name) continue;
      await client.query(`
        INSERT INTO sections (id, code, name, department_code, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          department_code = EXCLUDED.department_code,
          updated_at = NOW();
      `, [s.id || `sec-${Date.now()}`, s.code, s.name, s.departmentCode || '']);
    }

    // 4. Sync Machines
    for (const m of machines) {
      if (!m.code || !m.name) continue;
      await client.query(`
        INSERT INTO machines (id, code, name, machine_type, department_code, speed_standard, speed_unit, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          machine_type = EXCLUDED.machine_type,
          department_code = EXCLUDED.department_code,
          speed_standard = EXCLUDED.speed_standard,
          speed_unit = EXCLUDED.speed_unit,
          updated_at = NOW();
      `, [m.id || `mch-${Date.now()}`, m.code, m.name, m.machineType || '', m.departmentCode || '', Number(m.speedStandard || 0), m.speedUnit || 'rpm']);
    }

    // 5. Sync Looms
    for (const l of looms) {
      if (!l.code || !l.name) continue;
      await client.query(`
        INSERT INTO looms (id, code, name, loom_type, shed, standard_rpm, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          loom_type = EXCLUDED.loom_type,
          shed = EXCLUDED.shed,
          standard_rpm = EXCLUDED.standard_rpm,
          updated_at = NOW();
      `, [l.id || `loom-${Date.now()}`, l.code, l.name, l.loomType || '', l.shed || '', Number(l.standardRpm || 140)]);
    }

    // 6. Sync Qualities
    for (const q of qualities) {
      if (!q.code || !q.name) continue;
      await client.query(`
        INSERT INTO qualities (id, code, name, category, nominal_count, standard_mr, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          nominal_count = EXCLUDED.nominal_count,
          standard_mr = EXCLUDED.standard_mr,
          updated_at = NOW();
      `, [q.id || `qual-${Date.now()}`, q.code, q.name, q.category || '', Number(q.nominalCount || 0), Number(q.standardMR || 17)]);
    }

    // 7. Sync Standards
    for (const st of standards) {
      if (!st.code || !st.name) continue;
      await client.query(`
        INSERT INTO standards (id, code, form_code, name, parameter, nominal_value, lower_limit, upper_limit, unit, tolerance, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (code) DO UPDATE SET
          form_code = EXCLUDED.form_code,
          name = EXCLUDED.name,
          parameter = EXCLUDED.parameter,
          nominal_value = EXCLUDED.nominal_value,
          lower_limit = EXCLUDED.lower_limit,
          upper_limit = EXCLUDED.upper_limit,
          unit = EXCLUDED.unit,
          tolerance = EXCLUDED.tolerance,
          updated_at = NOW();
      `, [st.id || `std-${Date.now()}`, st.code, st.formCode || 'FORM-01', st.name, st.parameter || '', Number(st.nominalValue || 0), Number(st.lowerLimit || 0), Number(st.upperLimit || 0), st.unit || '', st.tolerance || '']);
    }

    // 8. Sync Inspections
    for (const i of inspections) {
      if (!i.inspectionNo) continue;
      await client.query(`
        INSERT INTO inspections (
          inspection_no, form_id, form_code, form_title,
          department_id, shift_id, shift_name,
          inspector_id, inspector_name, inspection_date,
          status, result, form_data, reading_rows, summary_metrics, remarks,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (inspection_no) DO UPDATE SET
          form_id = EXCLUDED.form_id,
          form_code = EXCLUDED.form_code,
          form_title = EXCLUDED.form_title,
          department_id = EXCLUDED.department_id,
          shift_id = EXCLUDED.shift_id,
          shift_name = EXCLUDED.shift_name,
          inspector_id = EXCLUDED.inspector_id,
          inspector_name = EXCLUDED.inspector_name,
          inspection_date = EXCLUDED.inspection_date,
          status = EXCLUDED.status,
          result = EXCLUDED.result,
          form_data = EXCLUDED.form_data,
          reading_rows = EXCLUDED.reading_rows,
          summary_metrics = EXCLUDED.summary_metrics,
          remarks = EXCLUDED.remarks,
          updated_at = NOW();
      `, [
        i.inspectionNo, i.formId || 'FORM-01', i.formCode || 'FORM-01', i.formTitle || 'Inspection',
        i.departmentId || '', i.shiftId || 'A', i.shiftName || 'General',
        i.inspectorId || '', i.inspectorName || '', i.inspectionDate || new Date().toISOString().split('T')[0],
        i.status || 'Draft', i.result || 'PASS',
        JSON.stringify(i.formData || {}), JSON.stringify(i.readingRows || []),
        JSON.stringify(i.summaryMetrics || {}), i.remarks || ''
      ]);
    }

    await client.query('COMMIT');
    console.log(`⚡ [PostgreSQL] Bulk sync complete: ${users.length} users, ${departments.length} depts, ${inspections.length} inspections.`);
    res.json({
      success: true,
      message: `Bulk synchronized ${users.length} users, ${departments.length} departments, ${machines.length} machines, ${looms.length} looms, ${qualities.length} qualities, and ${inspections.length} inspections to local PostgreSQL.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during bulk sync:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Start Server binding to IPv4 127.0.0.1
app.listen(PORT, '127.0.0.1', () => {
  console.log('==================================================================');
  console.log(`🚀 Bally Jute SQC Backend API running on http://127.0.0.1:${PORT}`);
  console.log(`🔑 Required Header: x-api-key: ${API_KEY}`);
  console.log('🌐 Start Cloudflare tunnel with:');
  console.log(`   cloudflared tunnel --url http://127.0.0.1:${PORT}`);
  console.log('==================================================================');
});
