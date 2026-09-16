// ==============================================================================
// BALLY JUTE COMPANY LIMITED - S.Q.C. QUALITY CONTROL SYSTEM
// Production Local PostgreSQL API Server (for Windows PowerShell / C:\my-local-api)
// ==============================================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'change-this-to-a-long-secret-key-123456';

// 1. CORS Configuration (Supports Cloudflare Tunnel & AI Studio web app)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'ngrok-skip-browser-warning'],
}));

app.use(express.json({ limit: '10mb' }));

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

    client.release();
    console.log('✅ SQC database tables and indexes verified successfully.');
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
    res.json({
      status: 'online',
      service: 'Bally Jute SQC Local PostgreSQL Engine',
      database: dbRes.rows[0].database,
      user: dbRes.rows[0].user,
      postgresVersion: dbRes.rows[0].version.split(' ')[1],
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

// GET /api/inspections - List all saved inspection records
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
  if (!b.inspection_no && !b.inspectionNo) {
    return res.status(400).json({ success: false, message: 'inspection_no is required' });
  }

  const inspectionNo = b.inspection_no || b.inspectionNo;
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

// DELETE /api/inspections/:inspectionNo - Delete inspection
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

// POST /api/inspections/truncate - Wipes dummy records and restarts ID sequence
app.post('/api/inspections/truncate', checkApiKey, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE inspections RESTART IDENTITY CASCADE;');
    console.log('🧹 [PostgreSQL] All inspections truncated and reset.');
    res.json({ success: true, message: 'All inspection records wiped successfully in local PostgreSQL.' });
  } catch (err) {
    console.error('Error truncating inspections:', err);
    res.status(500).json({ success: false, error: err.message });
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
