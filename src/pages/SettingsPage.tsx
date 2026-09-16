import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  RotateCcw,
  Save,
  CheckCircle,
  Database,
  Lock,
  Building2,
  Server,
  Globe,
  Key,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Copy,
  Terminal,
  FileCode,
  Layers,
  HardDriveDownload,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { useAuth } from '../context/AuthContext';
import { ApplicationSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<ApplicationSettings>(() => dataService.getSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // PostgreSQL / Cloudflare Tunnel Integration State
  const initialPgConfig = postgresService.getConfig();
  const [tunnelUrl, setTunnelUrl] = useState(initialPgConfig.apiUrl);
  const [apiKey, setApiKey] = useState(initialPgConfig.apiKey);
  const [syncEnabled, setSyncEnabled] = useState(initialPgConfig.syncEnabled);

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    database?: string;
    user?: string;
    inspectionsCount?: number;
    time?: string;
  } | null>(null);

  // Live PostgreSQL inspections list state
  const [pgInspections, setPgInspections] = useState<any[]>([]);
  const [loadingPgInspections, setLoadingPgInspections] = useState(false);
  const [deletingNo, setDeletingNo] = useState<string | null>(null);

  // SQL / Guide Tabs
  const [activeSqlTab, setActiveSqlTab] = useState<'wipe' | 'schema' | 'server'>('wipe');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const canEdit = currentUser.role === 'Super Admin';

  const showNotice = (type: 'success' | 'error', text: string) => {
    setActionNotice({ type, text });
    setTimeout(() => setActionNotice(null), 5000);
  };

  // 1. Purge all dummy data from browser web app
  const handlePurgeWebDummyData = () => {
    dataService.clearAllInspections(currentUser);
    showNotice('success', '✅ All dummy inspections, logs, and test data purged from browser. Ready for clean production entries!');
  };

  // 2. Truncate all records in local PostgreSQL
  const handleTruncatePgData = async () => {
    if (!tunnelUrl || tunnelUrl.includes('blue-example.trycloudflare.com')) {
      showNotice('error', '⚠️ Please configure your real Cloudflare Tunnel URL first.');
      return;
    }

    postgresService.setConfig(tunnelUrl, apiKey, syncEnabled);
    try {
      const res = await postgresService.clearAllInspectionsFromPostgres();
      if (res.success) {
        showNotice('success', '🧹 All inspection rows truncated and reset in local PostgreSQL.');
        handleLoadPgInspections();
      } else {
        showNotice('error', `⚠️ PostgreSQL truncate notice: ${res.message}`);
      }
    } catch (err: any) {
      showNotice('error', `⚠️ Connection error: ${err.message}`);
    }
  };

  // 3. Test connection to PostgreSQL via Tunnel
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);

    postgresService.setConfig(tunnelUrl, apiKey, syncEnabled);

    try {
      const res = await postgresService.testConnection();
      setConnectionResult({
        success: res.isConnected,
        message: res.message,
        database: res.database,
        user: res.user,
        inspectionsCount: res.inspectionsCount,
        time: res.checkedAt,
      });

      if (res.isConnected) {
        handleLoadPgInspections();
      }
    } catch (err: any) {
      setConnectionResult({
        success: false,
        message: err.message || 'Connection test failed',
        time: new Date().toLocaleTimeString(),
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // 4. Fetch inspection rows currently in PostgreSQL
  const handleLoadPgInspections = async () => {
    setLoadingPgInspections(true);
    try {
      const data = await postgresService.loadInspections();
      setPgInspections(data);
    } catch (err) {
      console.error('Failed to load inspections from PostgreSQL:', err);
    } finally {
      setLoadingPgInspections(false);
    }
  };

  // 5. Delete specific inspection from PostgreSQL
  const handleDeletePgInspection = async (inspectionNo: string) => {
    setDeletingNo(inspectionNo);
    try {
      const ok = await postgresService.deleteInspectionFromPostgres(inspectionNo);
      if (ok) {
        showNotice('success', `Inspection #${inspectionNo} deleted from local PostgreSQL.`);
        setPgInspections(prev => prev.filter(r => (r.inspectionNo || r.inspection_no) !== inspectionNo));
      } else {
        showNotice('error', `Failed to delete #${inspectionNo} from PostgreSQL.`);
      }
    } catch (err: any) {
      showNotice('error', err.message);
    } finally {
      setDeletingNo(null);
    }
  };

  // 6. Save settings form
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showNotice('error', 'Only Super Admin is authorized to modify core system settings.');
      return;
    }

    postgresService.setConfig(tunnelUrl, apiKey, syncEnabled);

    const updated = dataService.updateSettings(
      {
        ...settings,
        postgresApiUrl: tunnelUrl,
        postgresApiKey: apiKey,
        enablePostgresSync: syncEnabled,
      },
      currentUser
    );
    setSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCopyCode = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2500);
  };

  // SQL code snippets
  const sqlWipe = `-- ==============================================================================
-- WIPE ALL DUMMY DATA IN POSTGRESQL (Run in DBeaver or pgAdmin on Database: SQC)
-- ==============================================================================

-- 1. Wipe all inspection entries and restart auto-increment IDs
TRUNCATE TABLE inspections RESTART IDENTITY CASCADE;

-- 2. Wipe audit logs and restart IDs (if audit_logs table exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- 3. Drop legacy customers test table if it was created
DROP TABLE IF EXISTS customers CASCADE;

-- Verification query
SELECT COUNT(*) AS total_inspections_remaining FROM inspections;`;

  const sqlSchema = `-- ==============================================================================
-- BALLY JUTE SQC - LOCAL POSTGRESQL PRODUCTION TABLE SETUP
-- Run this in DBeaver or pgAdmin 4 (Database: SQC)
-- ==============================================================================

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
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (inspection_date);`;

  const serverJsCode = `// Save as: C:\\my-local-api\\server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'change-this-to-a-long-secret-key-123456';

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || '127.0.0.1',
  database: process.env.PGDATABASE || 'SQC',
  password: process.env.PGPASSWORD || 'postgres',
  port: parseInt(process.env.PGPORT || '5432', 10),
});

function checkApiKey(req, res, next) {
  const reqKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!reqKey || reqKey !== API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid x-api-key' });
  }
  next();
}

// Health check
app.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT current_database() as database, current_user as user');
    res.json({ status: 'online', database: r.rows[0].database, user: r.rows[0].user });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// GET inspections
app.get('/api/inspections', checkApiKey, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM inspections ORDER BY id DESC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST inspection
app.post('/api/inspections', checkApiKey, async (req, res) => {
  const b = req.body;
  const no = b.inspection_no || b.inspectionNo;
  if (!no) return res.status(400).json({ message: 'inspection_no required' });

  try {
    const q = \`
      INSERT INTO inspections (
        inspection_no, form_id, form_code, form_title,
        department_id, shift_id, shift_name, inspector_id, inspector_name,
        inspection_date, status, result, form_data, reading_rows, summary_metrics, remarks, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
      ON CONFLICT (inspection_no) DO UPDATE SET
        status = EXCLUDED.status, result = EXCLUDED.result,
        form_data = EXCLUDED.form_data, reading_rows = EXCLUDED.reading_rows,
        summary_metrics = EXCLUDED.summary_metrics, remarks = EXCLUDED.remarks, updated_at = NOW()
      RETURNING *;
    \`;
    const v = [
      no, b.form_id || b.formId, b.form_code || b.formCode, b.form_title || b.formTitle,
      b.department_id || b.departmentId, b.shift_id || b.shiftId, b.shift_name || b.shiftName,
      b.inspector_id || b.inspectorId, b.inspector_name || b.inspectorName,
      b.inspection_date || b.inspectionDate, b.status || 'Draft', b.result || 'PASS',
      JSON.stringify(b.form_data || b.formData || {}),
      JSON.stringify(b.reading_rows || b.readingRows || []),
      JSON.stringify(b.summary_metrics || b.summaryMetrics || {}),
      b.remarks || ''
    ];
    const saved = await pool.query(q, v);
    res.json({ success: true, record: saved.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE inspection
app.delete('/api/inspections/:inspectionNo', checkApiKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM inspections WHERE inspection_no = $1', [req.params.inspectionNo]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Truncate
app.post('/api/inspections/truncate', checkApiKey, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE inspections RESTART IDENTITY CASCADE;');
    res.json({ success: true, message: 'All inspections truncated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(\`SQC Backend running on http://127.0.0.1:\${PORT}\`);
});`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings size={20} className="text-emerald-700" />
            <span>SQC Production System & Local PostgreSQL Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your local PC PostgreSQL connection, purge dummy test data, and configure inspection standards
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md font-mono font-semibold">
            PostgreSQL: Local (SQC)
          </span>
          <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md font-medium">
            Firebase: Disabled
          </span>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 font-medium border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-rose-700 shrink-0" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* CARD 1: PRODUCTION READY DATA CLEANUP (PURGE DUMMY DATA) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Trash2 size={16} className="text-rose-600" />
              <span>Production Readiness: Purge Dummy Data</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanently clear all test samples and initial seed data from both the web browser and local PostgreSQL
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="purge-web-dummy-btn"
              type="button"
              onClick={handlePurgeWebDummyData}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} />
              <span>Purge Dummy Data (Web App)</span>
            </button>

            <button
              id="truncate-pg-dummy-btn"
              type="button"
              onClick={handleTruncatePgData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Truncate PostgreSQL Inspections</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Production Ready Check: </span>
            All hardcoded sample data (`rec-01` to `rec-05`, test logs) have been deleted from this app codebase.
            Use the buttons above to wipe existing records from your browser and database so that only genuine SQC inspections are saved.
          </div>
        </div>
      </div>

      {/* CARD 2: LOCAL POSTGRESQL & CLOUDFLARE TUNNEL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database size={17} className="text-blue-600" />
              <span>Local PostgreSQL & Cloudflare Tunnel Connection</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure bridge linking this web interface to your Windows PostgreSQL database (<code className="text-slate-700 font-mono bg-slate-100 px-1 rounded">Database: SQC</code>)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="test-connection-btn"
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RefreshCw size={13} className={testingConnection ? 'animate-spin' : ''} />
              <span>{testingConnection ? 'Testing Connection...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>

        {/* Connection status notification */}
        {connectionResult && (
          <div
            className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
              connectionResult.success
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            {connectionResult.success ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-semibold">{connectionResult.message}</div>
              {connectionResult.success && (
                <div className="text-[11px] text-emerald-700 mt-1 flex flex-wrap items-center gap-3">
                  <span>Database: <strong>{connectionResult.database || 'SQC'}</strong></span>
                  <span>User: <strong>{connectionResult.user || 'postgres'}</strong></span>
                  {typeof connectionResult.inspectionsCount === 'number' && (
                    <span>Stored Inspections in DB: <strong>{connectionResult.inspectionsCount}</strong></span>
                  )}
                  {connectionResult.time && <span>Checked at: {connectionResult.time}</span>}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe size={13} className="text-slate-400" />
              <span>Cloudflare Tunnel Public URL</span>
            </label>
            <input
              id="tunnel-url-input"
              type="url"
              value={tunnelUrl}
              onChange={e => setTunnelUrl(e.target.value)}
              placeholder="https://xxxx-xxxx.trycloudflare.com"
              className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Paste the URL generated when running <code className="font-mono bg-slate-100 px-1 rounded">cloudflared tunnel --url http://127.0.0.1:3000</code>
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key size={13} className="text-slate-400" />
              <span>API Secret Key (<code className="font-mono text-slate-500">x-api-key</code>)</span>
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="change-this-to-a-long-secret-key-123456"
              className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Must match the <code className="font-mono bg-slate-100 px-1 rounded">API_KEY</code> variable in your local Node.js <code className="font-mono">.env</code>
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              id="sync-enabled-toggle"
              type="checkbox"
              checked={syncEnabled}
              onChange={e => setSyncEnabled(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-800">
              Auto-save all SQC inspections directly into local PostgreSQL table <code className="font-mono text-blue-700 bg-blue-50 px-1 rounded">inspections</code>
            </span>
          </label>

          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
          >
            <Save size={13} />
            <span>Save URL & Key</span>
          </button>
        </div>

        {/* Live Records Table from PostgreSQL */}
        <div className="border-t border-slate-100 pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-blue-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Live PostgreSQL Records (<code className="font-mono lowercase text-[11px]">public.inspections</code>)
              </h4>
              <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {pgInspections.length} rows
              </span>
            </div>

            <button
              id="refresh-pg-list-btn"
              type="button"
              onClick={handleLoadPgInspections}
              disabled={loadingPgInspections}
              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium inline-flex items-center gap-1"
            >
              <RefreshCw size={11} className={loadingPgInspections ? 'animate-spin' : ''} />
              <span>Refresh From DB</span>
            </button>
          </div>

          {pgInspections.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                  <tr>
                    <th className="p-2 border-b border-slate-200">ID</th>
                    <th className="p-2 border-b border-slate-200">Inspection No</th>
                    <th className="p-2 border-b border-slate-200">Form</th>
                    <th className="p-2 border-b border-slate-200">Date</th>
                    <th className="p-2 border-b border-slate-200">Status</th>
                    <th className="p-2 border-b border-slate-200">Result</th>
                    <th className="p-2 border-b border-slate-200 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {pgInspections.map((row: any, i: number) => {
                    const no = row.inspectionNo || row.inspection_no;
                    return (
                      <tr key={row.id || i} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-slate-500">{row.id}</td>
                        <td className="p-2 font-mono font-bold text-emerald-900">{no}</td>
                        <td className="p-2 font-medium">{row.formCode || row.form_code}</td>
                        <td className="p-2 text-slate-600">{row.inspectionDate || row.inspection_date}</td>
                        <td className="p-2">{row.status}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.result === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.result === 'WARNING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.result}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeletePgInspection(no)}
                            disabled={deletingNo === no}
                            className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold px-2 py-0.5 rounded hover:bg-rose-50"
                          >
                            {deletingNo === no ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
              {loadingPgInspections ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-blue-600" />
                  <span>Loading inspections from local PostgreSQL...</span>
                </div>
              ) : (
                <span>
                  No inspections in local PostgreSQL yet. Create an inspection via <strong>"New Inspection Entry"</strong> or test your connection.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CARD 3: SQL QUERIES & NODE.JS SCRIPT HELPER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Terminal size={17} className="text-slate-700" />
              <span>PostgreSQL SQL Scripts & Local Server Configuration</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ready-to-use scripts to execute in DBeaver / pgAdmin and on your local computer
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveSqlTab('wipe')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeSqlTab === 'wipe'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Wipe Dummy Data SQL
            </button>
            <button
              type="button"
              onClick={() => setActiveSqlTab('schema')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeSqlTab === 'schema'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Table SQL
            </button>
            <button
              type="button"
              onClick={() => setActiveSqlTab('server')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeSqlTab === 'server'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              server.js Code
            </button>
          </div>
        </div>

        {/* Tab 1: Wipe SQL */}
        {activeSqlTab === 'wipe' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Execute this in DBeaver or pgAdmin 4 (Database: SQC) to purge dummy data:
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(sqlWipe, 'wipe')}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded inline-flex items-center gap-1"
              >
                <Copy size={12} />
                <span>{copiedTab === 'wipe' ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
              {sqlWipe}
            </pre>
          </div>
        )}

        {/* Tab 2: Schema SQL */}
        {activeSqlTab === 'schema' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Create table <code className="font-mono text-emerald-800 font-bold">inspections</code> in pgAdmin 4 / DBeaver:
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(sqlSchema, 'schema')}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded inline-flex items-center gap-1"
              >
                <Copy size={12} />
                <span>{copiedTab === 'schema' ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
              {sqlSchema}
            </pre>
          </div>
        )}

        {/* Tab 3: server.js */}
        {activeSqlTab === 'server' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Complete, production-ready server code (<code className="font-mono">C:\my-local-api\server.js</code>):
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(serverJsCode, 'server')}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded inline-flex items-center gap-1"
              >
                <Copy size={12} />
                <span>{copiedTab === 'server' ? 'Copied!' : 'Copy server.js'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed max-h-72 overflow-y-auto border border-slate-800">
              {serverJsCode}
            </pre>
          </div>
        )}
      </div>

      {/* CARD 4: ENTERPRISE SETTINGS & NUMBERING */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <Building2 size={15} className="text-emerald-700" />
          <span>Company & SQC Inspection Format Identity</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.companyName}
              onChange={e => setSettings({ ...settings, companyName: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Department Subtitle</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.companySubtitle}
              onChange={e => setSettings({ ...settings, companySubtitle: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inspection Number Prefix</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.inspectionPrefix}
              onChange={e => setSettings({ ...settings, inspectionPrefix: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-800 disabled:bg-slate-50"
            />
            <p className="text-[10px] text-slate-400 mt-1">Example: SQC/2026-27/FORM-01/000001</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Active Financial Year</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.financialYear}
              onChange={e => setSettings({ ...settings, financialYear: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 disabled:bg-slate-50"
            />
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
            >
              <Save size={14} />
              <span>Save System Settings</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
