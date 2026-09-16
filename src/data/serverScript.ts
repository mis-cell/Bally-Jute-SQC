// Complete Production-Ready Local PostgreSQL API Server for Windows PowerShell
export const LOCAL_SERVER_JS_CODE = `// ==============================================================================
// BALLY JUTE COMPANY LIMITED - S.Q.C. QUALITY CONTROL SYSTEM
// Production Local PostgreSQL API Server (for Windows PowerShell / C:\\\\my-local-api)
// Comprehensive Self-Healing CRUD & Synchronization for Users, Masters, and Inspections
// ==============================================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'change-this-to-a-long-secret-key-123456';

// 1. CORS Configuration (Supports Cloudflare Tunnel, Ngrok & Web App)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'ngrok-skip-browser-warning'],
}));

app.use(express.json({ limit: '25mb' }));

// 2. PostgreSQL Connection Pool (Supports both DB_* and PG* variable names)
const pool = new Pool({
  user: process.env.DB_USER || process.env.PGUSER || 'postgres',
  host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'SQC',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
});

// Auto-initialize and self-heal tables on startup
async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('📦 Connected to PostgreSQL database:', process.env.DB_NAME || process.env.PGDATABASE || 'SQC');

    // Users Table
    await client.query(\`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        employee_code VARCHAR(50),
        display_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        department_id VARCHAR(100),
        department_name VARCHAR(150),
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(150);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_name VARCHAR(150);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_users_emp ON users (employee_code);
    \`);

    // Departments Table
    await client.query(\`
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
      CREATE INDEX IF NOT EXISTS idx_departments_code ON departments (code);
    \`);

    // Sections Table
    await client.query(\`
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
      CREATE INDEX IF NOT EXISTS idx_sections_code ON sections (code);
    \`);

    // Machines Table
    await client.query(\`
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
      CREATE INDEX IF NOT EXISTS idx_machines_code ON machines (code);
    \`);

    // Looms Table
    await client.query(\`
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
      CREATE INDEX IF NOT EXISTS idx_looms_code ON looms (code);
    \`);

    // Qualities Table
    await client.query(\`
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
      CREATE INDEX IF NOT EXISTS idx_qualities_code ON qualities (code);
    \`);

    // Quality Standards Table
    await client.query(\`
      CREATE TABLE IF NOT EXISTS quality_standards (
        id VARCHAR(100) PRIMARY KEY,
        standard_code VARCHAR(50),
        form_code VARCHAR(50) NOT NULL,
        department_id VARCHAR(100),
        quality_id VARCHAR(100),
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
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS form_code VARCHAR(50);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
      ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS quality_id VARCHAR(100);
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
    \`);

    // Inspections Table
    await client.query(\`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
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
        version INT DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS department_name VARCHAR(150);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS section_id VARCHAR(100);
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
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspection_time VARCHAR(30);
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS correction_remarks TEXT;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approval_remarks TEXT;
      ALTER TABLE inspections ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
      CREATE INDEX IF NOT EXISTS idx_inspections_no ON inspections (inspection_no);
      CREATE INDEX IF NOT EXISTS idx_inspections_form ON inspections (form_code);
      CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (inspection_date);
    \`);

    client.release();
    console.log('✅ SQC database tables and schema verified & upgraded successfully.');
  } catch (err) {
    console.error('❌ PostgreSQL Initialization Error:', err.message);
  }
}

initDatabase();

// 3. API Key Authentication Middleware
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

// 4. Health Check / Status Route
app.get('/', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT current_database() as database, current_user as user, version() as version, NOW() as server_time');
    const inspectionsCount = await pool.query('SELECT COUNT(*) as count FROM inspections');
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    res.json({
      status: 'online',
      message: 'Bally Jute SQC Quality Control PostgreSQL API is running!',
      database: dbResult.rows[0].database,
      user: dbResult.rows[0].user,
      totalUsers: parseInt(usersCount.rows[0].count, 10),
      totalInspections: parseInt(inspectionsCount.rows[0].count, 10),
      serverTime: dbResult.rows[0].server_time,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to query PostgreSQL database',
      error: err.message,
    });
  }
});

// 5. USERS API
app.get('/api/users', checkApiKey, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. INSPECTIONS API
app.get('/api/inspections', checkApiKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inspections ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inspections', checkApiKey, async (req, res) => {
  const b = req.body;
  const no = b.inspection_no || b.inspectionNo;
  if (!no) {
    return res.status(400).json({ success: false, message: 'inspection_no is required' });
  }

  try {
    const query = \`
      INSERT INTO inspections (
        inspection_no, form_id, form_code, form_title,
        department_id, department_name, section_id,
        shift_id, shift_name,
        quality_id, quality_name,
        machine_id, machine_no,
        loom_id, loom_no,
        godown_id, godown_name,
        inspector_id, inspector_name,
        inspection_date, inspection_time,
        status, result,
        form_data, reading_rows, summary_metrics,
        remarks, correction_remarks, approval_remarks,
        version, updated_at
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,
        $8,$9,
        $10,$11,
        $12,$13,
        $14,$15,
        $16,$17,
        $18,$19,
        $20,$21,
        $22,$23,
        $24,$25,$26,
        $27,$28,$29,
        $30, NOW()
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
        version = EXCLUDED.version,
        updated_at = NOW()
      RETURNING *;
    \`;

    const values = [
      no,
      b.form_id || b.formId || 'FORM-01',
      b.form_code || b.formCode || 'FORM-01',
      b.form_title || b.formTitle || 'Inspection',
      b.department_id || b.departmentId || '',
      b.department_name || b.departmentName || '',
      b.section_id || b.sectionId || '',
      b.shift_id || b.shiftId || 'A',
      b.shift_name || b.shiftName || 'Morning Shift',
      b.quality_id || b.qualityId || '',
      b.quality_name || b.qualityName || '',
      b.machine_id || b.machineId || '',
      b.machine_no || b.machineNo || '',
      b.loom_id || b.loomId || '',
      b.loom_no || b.loomNo || '',
      b.godown_id || b.godownId || '',
      b.godown_name || b.godownName || '',
      b.inspector_id || b.inspectorId || '',
      b.inspector_name || b.inspectorName || '',
      b.inspection_date || b.inspectionDate || new Date().toISOString().split('T')[0],
      b.inspection_time || b.inspectionTime || new Date().toTimeString().split(' ')[0],
      b.status || 'Draft',
      b.result || 'PASS',
      JSON.stringify(b.form_data || b.formData || {}),
      JSON.stringify(b.reading_rows || b.readingRows || []),
      JSON.stringify(b.summary_metrics || b.summaryMetrics || {}),
      b.remarks || '',
      b.correction_remarks || b.correctionRemarks || '',
      b.approval_remarks || b.approvalRemarks || '',
      Number(b.version || 1),
    ];

    const result = await pool.query(query, values);
    res.json({ success: true, record: result.rows[0] });
  } catch (err) {
    console.error('Error saving inspection:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/inspections/:inspectionNo', checkApiKey, async (req, res) => {
  const { inspectionNo } = req.params;
  try {
    const delRes = await pool.query('DELETE FROM inspections WHERE inspection_no = $1 RETURNING id', [inspectionNo]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }
    res.json({ success: true, message: \`Deleted inspection \${inspectionNo}\` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inspections/truncate', checkApiKey, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE inspections RESTART IDENTITY CASCADE;');
    res.json({ success: true, message: 'All inspections cleared in local PostgreSQL.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. BULK SYNC ALL DATA (Users, Masters, Inspections)
app.post('/api/sync-all', checkApiKey, async (req, res) => {
  const {
    users = [],
    departments = [],
    sections = [],
    machines = [],
    looms = [],
    qualities = [],
    standards = [],
    inspections = [],
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Sync Users (Upsert by Email)
    for (const u of users) {
      if (!u.email) continue;
      await client.query(\`
        INSERT INTO users (
          id, employee_code, display_name, email, role,
          department_id, department_name, phone, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (email) DO UPDATE SET
          id = EXCLUDED.id,
          employee_code = EXCLUDED.employee_code,
          display_name = EXCLUDED.display_name,
          role = EXCLUDED.role,
          department_id = EXCLUDED.department_id,
          department_name = EXCLUDED.department_name,
          phone = EXCLUDED.phone,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      \`, [
        u.id || \`u-\${Date.now()}\`,
        u.employeeCode || u.employee_code || '',
        u.displayName || u.display_name || '',
        u.email,
        u.role || 'SQC Inspector / User',
        u.departmentId || u.department_id || '',
        u.departmentName || u.department_name || '',
        u.phone || '',
        u.isActive !== undefined ? u.isActive : true,
      ]);
    }

    // 2. Sync Departments (Upsert by Code)
    for (const d of departments) {
      if (!d.code || !d.name) continue;
      await client.query(\`
        INSERT INTO departments (
          id, code, name, description, hod_name, order_index, status, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          hod_name = EXCLUDED.hod_name,
          order_index = EXCLUDED.order_index,
          status = EXCLUDED.status,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      \`, [
        d.id || \`dept-\${Date.now()}\`,
        d.code,
        d.name,
        d.description || '',
        d.hodName || d.hod_name || '',
        Number(d.orderIndex || d.order_index || 0),
        d.status || 'Active',
        d.isActive !== undefined ? d.isActive : true,
      ]);
    }

    // 3. Sync Sections (Upsert by Code)
    for (const s of sections) {
      if (!s.code || !s.name) continue;
      await client.query(\`
        INSERT INTO sections (
          id, department_id, department_code, code, name, description, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO UPDATE SET
          department_id = EXCLUDED.department_id,
          department_code = EXCLUDED.department_code,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      \`, [
        s.id || \`sec-\${Date.now()}\`,
        s.departmentId || s.department_id || '',
        s.departmentCode || s.department_code || '',
        s.code,
        s.name,
        s.description || '',
        s.isActive !== undefined ? s.isActive : true,
      ]);
    }

    // 4. Sync Machines (Upsert by Code)
    for (const m of machines) {
      if (!m.code || !m.name) continue;
      await client.query(\`
        INSERT INTO machines (
          id, department_id, department_code, section_id, code, name,
          type, machine_type, capacity, speed_standard, speed_unit, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (code) DO UPDATE SET
          department_id = EXCLUDED.department_id,
          department_code = EXCLUDED.department_code,
          section_id = EXCLUDED.section_id,
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          machine_type = EXCLUDED.machine_type,
          capacity = EXCLUDED.capacity,
          speed_standard = EXCLUDED.speed_standard,
          speed_unit = EXCLUDED.speed_unit,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      \`, [
        m.id || \`mch-\${Date.now()}\`,
        m.departmentId || m.department_id || '',
        m.departmentCode || m.department_code || '',
        m.sectionId || m.section_id || '',
        m.code,
        m.name,
        m.type || m.machineType || '',
        m.machineType || m.type || '',
        m.capacity || '',
        Number(m.speedStandard || m.speed_standard || 0),
        m.speedUnit || m.speed_unit || 'rpm',
        m.isActive !== undefined ? m.isActive : true,
      ]);
    }

    // 5. Sync Looms (Upsert by Code)
    for (const l of looms) {
      if (!l.code || !l.name) continue;
      await client.query(\`
        INSERT INTO looms (
          id, loom_no, code, name, shed, shed_type, loom_type,
          reed_space, rpm, standard_rpm, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (code) DO UPDATE SET
          loom_no = EXCLUDED.loom_no,
          name = EXCLUDED.name,
          shed = EXCLUDED.shed,
          shed_type = EXCLUDED.shed_type,
          loom_type = EXCLUDED.loom_type,
          reed_space = EXCLUDED.reed_space,
          rpm = EXCLUDED.rpm,
          standard_rpm = EXCLUDED.standard_rpm,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      \`, [
        l.id || \`loom-\${Date.now()}\`,
        l.loomNo || l.loom_no || l.code,
        l.code,
        l.name,
        l.shed || '',
        l.shedType || l.shed_type || '',
        l.loomType || l.loom_type || 'Ordinary',
        l.reedSpace || l.reed_space || '',
        Number(l.rpm || l.standardRpm || 140),
        Number(l.standardRpm || l.rpm || 140),
        l.isActive !== undefined ? l.isActive : true,
      ]);
    }

    // 6. Sync Qualities (Upsert by Code)
    for (const q of qualities) {
      if (!q.code || !q.name) continue;
      await client.query(\`
        INSERT INTO qualities (
          id, code, name, category, nominal_count, standard_mr,
          warp_count, weft_count, description, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          nominal_count = EXCLUDED.nominal_count,
          standard_mr = EXCLUDED.standard_mr,
          warp_count = EXCLUDED.warp_count,
          weft_count = EXCLUDED.weft_count,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      \`, [
        q.id || \`qual-\${Date.now()}\`,
        q.code,
        q.name,
        q.category || '',
        Number(q.nominalCount || q.nominal_count || 0),
        Number(q.standardMR || q.standard_mr || 0),
        Number(q.warpCount || q.warp_count || 0),
        Number(q.weftCount || q.weft_count || 0),
        q.description || '',
        q.isActive !== undefined ? q.isActive : true,
      ]);
    }

    // 7. Sync Quality Standards (Upsert by ID)
    for (const st of standards) {
      if (!st.id) continue;
      await client.query(\`
        INSERT INTO quality_standards (
          id, standard_code, form_code, department_id, quality_id,
          parameter_name, parameter, nominal_value, lower_limit, upper_limit,
          standard_value, min_value, max_value, tolerance, unit, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (id) DO UPDATE SET
          standard_code = EXCLUDED.standard_code,
          form_code = EXCLUDED.form_code,
          department_id = EXCLUDED.department_id,
          quality_id = EXCLUDED.quality_id,
          parameter_name = EXCLUDED.parameter_name,
          parameter = EXCLUDED.parameter,
          nominal_value = EXCLUDED.nominal_value,
          lower_limit = EXCLUDED.lower_limit,
          upper_limit = EXCLUDED.upper_limit,
          standard_value = EXCLUDED.standard_value,
          min_value = EXCLUDED.min_value,
          max_value = EXCLUDED.max_value,
          tolerance = EXCLUDED.tolerance,
          unit = EXCLUDED.unit,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      \`, [
        st.id,
        st.standardCode || st.standard_code || '',
        st.formCode || st.form_code || '',
        st.departmentId || st.department_id || '',
        st.qualityId || st.quality_id || '',
        st.parameter || st.parameterName || st.parameter_name || '',
        st.parameter || st.parameterName || st.parameter_name || '',
        Number(st.nominalValue || st.nominal_value || st.standardValue || 0),
        Number(st.lowerLimit || st.lower_limit || st.minValue || 0),
        Number(st.upperLimit || st.upper_limit || st.maxValue || 0),
        Number(st.standardValue || st.standard_value || st.nominalValue || 0),
        Number(st.minValue || st.min_value || st.lowerLimit || 0),
        Number(st.maxValue || st.max_value || st.upperLimit || 0),
        String(st.tolerance || ''),
        st.unit || '',
        st.isActive !== undefined ? st.isActive : true,
      ]);
    }

    // 8. Sync Inspections (Upsert by inspection_no)
    for (const i of inspections) {
      const inspectionNo = i.inspectionNo || i.inspection_no;
      if (!inspectionNo) continue;
      await client.query(\`
        INSERT INTO inspections (
          inspection_no, form_id, form_code, form_title,
          department_id, department_name, section_id,
          shift_id, shift_name,
          quality_id, quality_name,
          product_spec_id, product_spec_name,
          machine_id, machine_no,
          loom_id, loom_no,
          godown_id, godown_name,
          inspector_id, inspector_name,
          inspection_date, inspection_time,
          status, result,
          form_data, reading_rows, summary_metrics,
          remarks, correction_remarks, approval_remarks,
          version, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9,
          $10, $11,
          $12, $13,
          $14, $15,
          $16, $17,
          $18, $19,
          $20, $21,
          $22, $23,
          $24, $25,
          $26, $27, $28,
          $29, $30, $31,
          $32, NOW()
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
          version = EXCLUDED.version,
          updated_at = NOW();
      \`, [
        inspectionNo,
        i.formId || i.form_id || 'FORM-01',
        i.formCode || i.form_code || 'FORM-01',
        i.formTitle || i.form_title || 'Inspection',
        i.departmentId || i.department_id || '',
        i.departmentName || i.department_name || '',
        i.sectionId || i.section_id || '',
        i.shiftId || i.shift_id || 'A',
        i.shiftName || i.shift_name || 'General',
        i.qualityId || i.quality_id || '',
        i.qualityName || i.quality_name || '',
        i.productSpecId || i.product_spec_id || '',
        i.productSpecName || i.product_spec_name || '',
        i.machineId || i.machine_id || '',
        i.machineNo || i.machine_no || '',
        i.loomId || i.loom_id || '',
        i.loomNo || i.loom_no || '',
        i.godownId || i.godown_id || '',
        i.godownName || i.godown_name || '',
        i.inspectorId || i.inspector_id || '',
        i.inspectorName || i.inspector_name || '',
        i.inspectionDate || i.inspection_date || new Date().toISOString().split('T')[0],
        i.inspectionTime || i.inspection_time || new Date().toTimeString().split(' ')[0],
        i.status || 'Draft',
        i.result || 'PASS',
        JSON.stringify(i.formData || i.form_data || {}),
        JSON.stringify(i.readingRows || i.reading_rows || []),
        JSON.stringify(i.summaryMetrics || i.summary_metrics || {}),
        i.remarks || '',
        i.correctionRemarks || i.correction_remarks || '',
        i.approvalRemarks || i.approval_remarks || '',
        Number(i.version || 1),
      ]);
    }

    await client.query('COMMIT');
    console.log(\`⚡ [PostgreSQL] Bulk sync complete: \${users.length} users, \${departments.length} depts, \${sections.length} secs, \${machines.length} mchs, \${looms.length} looms, \${qualities.length} quals, \${standards.length} stds, \${inspections.length} inspections.\`);
    res.json({
      success: true,
      message: \`Bulk synchronized \${users.length} users, \${departments.length} departments, \${sections.length} sections, \${machines.length} machines, \${looms.length} looms, \${qualities.length} qualities, \${standards.length} standards, and \${inspections.length} inspections into local PostgreSQL.\`,
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
  console.log(\`🚀 Bally Jute SQC Backend API running on http://127.0.0.1:\${PORT}\`);
  console.log(\`🔑 Required Header: x-api-key: \${API_KEY}\`);
  console.log('==================================================================');
});
`;
