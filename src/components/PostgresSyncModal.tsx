import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Copy,
  Check,
  Terminal,
  Server,
  Key,
  Globe,
  UploadCloud,
  X,
  FileCode,
  ShieldCheck,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { postgresService, PostgresConnectionStatus } from '../services/postgresService';
import { dataService } from '../services/dataService';
import { LOCAL_SERVER_JS_CODE } from '../data/serverScript';

interface PostgresSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PostgresSyncModal: React.FC<PostgresSyncModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<PostgresConnectionStatus | null>(postgresService.getCachedStatus());
  const [config, setConfig] = useState(() => postgresService.getConfig());
  const [tunnelUrlInput, setTunnelUrlInput] = useState(config.apiUrl);
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey);
  const [syncEnabledInput, setSyncEnabledInput] = useState(config.syncEnabled);

  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'sql' | 'server'>('sync');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = postgresService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen) {
      const cfg = postgresService.getConfig();
      setConfig(cfg);
      setTunnelUrlInput(cfg.apiUrl);
      setApiKeyInput(cfg.apiKey);
      setSyncEnabledInput(cfg.syncEnabled);
      handleTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setSyncResult(null);
    postgresService.setConfig(tunnelUrlInput, apiKeyInput, syncEnabledInput);
    try {
      const res = await postgresService.testConnection();
      setStatus(res);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    postgresService.setConfig(tunnelUrlInput, apiKeyInput, syncEnabledInput);
    setConfig(postgresService.getConfig());
    await handleTest();
  };

  const handlePushAllData = async () => {
    setPushing(true);
    setSyncResult(null);
    try {
      const fullState = dataService.getFullDatabaseState();
      const res = await postgresService.syncAllDataToPostgres(fullState);
      setSyncResult(res);
      if (res.success) {
        handleTest();
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || 'Error pushing to PostgreSQL' });
    } finally {
      setPushing(false);
    }
  };

  const handleDownloadSql = () => {
    const fullState = dataService.getFullDatabaseState();
    const sql = postgresService.generateSqlDumpScript(fullState);
    postgresService.downloadSqlFile(sql, `bally_jute_sqc_full_dump_${new Date().toISOString().split('T')[0]}.sql`);
  };

  const handleDownloadServerJs = () => {
    const blob = new Blob([LOCAL_SERVER_JS_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const fullData = dataService.getFullDatabaseState();
  const sqlPreview = postgresService.generateSqlDumpScript(fullData);

  return (
    <div
      id="postgres-sync-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-700/80 flex items-center justify-center border border-emerald-500">
              <Database size={22} className="text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Local Machine PostgreSQL Hub
                {status?.isConnected ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ONLINE: {status.database}
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    DISCONNECTED
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Sync Users, Master Data, and Inspections into your local PostgreSQL (SQC database)
              </p>
            </div>
          </div>
          <button
            id="close-pg-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-6 pt-2 gap-2 text-xs font-bold">
          <button
            id="pg-tab-sync"
            onClick={() => setActiveTab('sync')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'sync'
                ? 'border-emerald-600 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud size={15} />
            Live Sync & Status
          </button>
          <button
            id="pg-tab-config"
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe size={15} />
            Tunnel Config & Commands
          </button>
          <button
            id="pg-tab-sql"
            onClick={() => setActiveTab('sql')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode size={15} />
            Instant SQL Dump
          </button>
          <button
            id="pg-tab-server"
            onClick={() => setActiveTab('server')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'server'
                ? 'border-emerald-600 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 size={15} />
            Node.js server.js
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: LIVE SYNC & STATUS */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  status?.isConnected
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}
              >
                {status?.isConnected ? (
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-sm">
                      {status?.isConnected
                        ? `Connected to Local PostgreSQL (${status.database || 'SQC'})`
                        : 'Local Machine PostgreSQL Is Not Connected'}
                    </p>
                    <button
                      id="pg-retest-btn"
                      onClick={handleTest}
                      disabled={testing}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded shadow-2xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw size={12} className={testing ? 'animate-spin' : ''} />
                      {testing ? 'Checking...' : 'Check Status'}
                    </button>
                  </div>
                  <p className="mt-1 text-slate-700">
                    {status?.message ||
                      'Data created in this web app is currently retained in browser storage until synchronized with your local PostgreSQL.'}
                  </p>
                  {status?.message && (status.message.toLowerCase().includes('password') || status.message.toLowerCase().includes('authentication failed')) && (
                    <div className="mt-2.5 p-3 bg-rose-100 border border-rose-300 rounded-lg text-rose-950 space-y-1.5">
                      <p className="font-bold flex items-center gap-1.5 text-xs text-rose-900">
                        <AlertTriangle size={14} className="text-rose-700" />
                        Quick Fix: Update your PostgreSQL password in .env
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        The Cloudflare Tunnel is connected, but Node.js was rejected by PostgreSQL due to an incorrect password.
                      </p>
                      <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-800 font-mono bg-white/80 p-2 rounded border border-rose-200">
                        <li>Open <code className="text-rose-800 font-bold">C:\my-local-api\.env</code> in Notepad.</li>
                        <li>Change <code className="text-emerald-800 font-bold">PGPASSWORD=your_actual_postgres_password</code> (the password you use in pgAdmin / DBeaver).</li>
                        <li>In Terminal 1 (where <code className="text-slate-800">node server.js</code> is running), press <code className="text-slate-800">Ctrl + C</code>, then run <code className="text-emerald-800">node server.js</code> again.</li>
                        <li>Click <strong>Check Status</strong> above!</li>
                      </ol>
                    </div>
                  )}
                  {status?.checkedAt && (
                    <p className="text-[11px] text-slate-500 mt-1">Last checked: {status.checkedAt}</p>
                  )}
                </div>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Users & Staff</span>
                  <p className="text-xl font-black text-slate-900">{fullData.users.length}</p>
                  <span className="text-[10px] text-slate-500">Includes new additions</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Master Tables</span>
                  <p className="text-xl font-black text-slate-900">
                    {fullData.departments.length +
                      fullData.machines.length +
                      fullData.looms.length +
                      fullData.qualities.length +
                      fullData.standards.length}
                  </p>
                  <span className="text-[10px] text-slate-500">Depts, Looms, Specs</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Inspections</span>
                  <p className="text-xl font-black text-slate-900">{fullData.inspections.length}</p>
                  <span className="text-[10px] text-slate-500">Active records</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Sync Engine</span>
                  <p className="text-sm font-black text-emerald-800 mt-1 flex items-center gap-1">
                    <ShieldCheck size={16} /> Ready
                  </p>
                  <span className="text-[10px] text-slate-500">Auto-upsert enabled</span>
                </div>
              </div>

              {/* Sync Action Buttons */}
              <div className="p-4 bg-slate-900 rounded-xl text-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <UploadCloud size={18} className="text-emerald-400" />
                      Push All Data to Local Machine PostgreSQL
                    </h3>
                    <p className="text-xs text-slate-300">
                      Writes all users, master records, and inspections directly into PostgreSQL tables (`users`, `departments`, `inspections`, etc.).
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    id="pg-push-all-btn"
                    onClick={handlePushAllData}
                    disabled={pushing || !status?.isConnected}
                    className={`px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
                      status?.isConnected
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <UploadCloud size={16} className={pushing ? 'animate-bounce' : ''} />
                    {pushing ? 'Synchronizing with PostgreSQL...' : '⚡ Push All Data to PostgreSQL Now'}
                  </button>

                  <button
                    id="pg-download-sql-sync-btn"
                    onClick={handleDownloadSql}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors"
                  >
                    <Download size={16} />
                    Download SQL File (Direct Import)
                  </button>
                </div>

                {syncResult && (
                  <div
                    className={`p-3.5 rounded-lg text-xs font-medium mt-2 flex flex-col gap-2 ${
                      syncResult.success
                        ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                        : 'bg-rose-950/80 border border-rose-700 text-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {syncResult.success ? (
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                      )}
                      <span>{syncResult.message}</span>
                    </div>

                    {!syncResult.success && (syncResult.message.includes('server.js') || syncResult.message.includes('sync-all')) && (
                      <div className="pt-2 border-t border-rose-800/60 flex flex-wrap gap-2 items-center">
                        <button
                          onClick={handleDownloadServerJs}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Download size={14} />
                          📥 Download Updated server.js
                        </button>
                        <button
                          onClick={() => {
                            handleCopy(LOCAL_SERVER_JS_CODE, 'srv-err');
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          {copiedKey === 'srv-err' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          {copiedKey === 'srv-err' ? 'Copied server.js Code!' : 'Copy server.js Code'}
                        </button>
                        <button
                          onClick={() => setActiveTab('server')}
                          className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700/80 rounded-md font-bold text-xs transition-colors"
                        >
                          View Setup Instructions &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TUNNEL CONFIGURATION & COMMANDS */}
          {activeTab === 'config' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Globe size={16} className="text-emerald-700" />
                  Cloudflare Tunnel / Local Bridge Settings
                </h3>
                <p className="text-slate-600">
                  Because this web application is hosted securely in the cloud (HTTPS), connecting to your local machine PostgreSQL requires a lightweight bridge server and tunnel.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Cloudflare Tunnel URL (e.g. https://xxxx.trycloudflare.com or Ngrok URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={tunnelUrlInput}
                        onChange={(e) => setTunnelUrlInput(e.target.value)}
                        placeholder="https://your-name.trycloudflare.com"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-emerald-600"
                      />
                      <button
                        onClick={handleSaveConfig}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
                      >
                        Save & Test
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">API Authentication Key (x-api-key)</label>
                    <input
                      type="text"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="change-this-to-a-long-secret-key-123456"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* 2-Step Local Commands */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Terminal size={16} className="text-slate-700" />
                  Commands to Run on Your Local Computer (Windows PowerShell)
                </h4>

                {/* .env configuration box */}
                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                    <span>Local Config File: C:\my-local-api\.env</span>
                    <button
                      onClick={() =>
                        handleCopy(
                          `DB_HOST=localhost\nDB_PORT=5432\nDB_USER=postgres\nDB_PASSWORD=Verified@3656\nDB_NAME=SQC\nAPI_KEY=change-this-to-a-long-secret-key-123456\nPORT=3000`,
                          'env-copy'
                        )
                      }
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedKey === 'env-copy' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === 'env-copy' ? 'Copied' : 'Copy Template'}
                    </button>
                  </div>
                  <pre className="text-slate-300 select-all overflow-x-auto">
{`DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=Verified@3656
DB_NAME=SQC
API_KEY=change-this-to-a-long-secret-key-123456
PORT=3000`}
                  </pre>
                  <p className="text-[10px] text-amber-300">
                    💡 If your PostgreSQL password in pgAdmin/DBeaver is not "postgres", update <code className="bg-slate-800 px-1 py-0.5 rounded">PGPASSWORD</code> here.
                  </p>
                </div>

                <div className="bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                    <span>Terminal 1: Start PostgreSQL Local API</span>
                    <button
                      onClick={() => handleCopy('cd C:\\my-local-api; node server.js', 't1')}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedKey === 't1' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === 't1' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-emerald-400 select-all overflow-x-auto">
                    cd C:\my-local-api{'\n'}node server.js
                  </pre>
                </div>

                <div className="bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                    <span>Terminal 2: Start Cloudflare Tunnel</span>
                    <button
                      onClick={() => handleCopy('cloudflared tunnel --url http://127.0.0.1:3000', 't2')}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedKey === 't2' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === 't2' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-emerald-400 select-all overflow-x-auto">
                    cloudflared tunnel --url http://127.0.0.1:3000
                  </pre>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Copy the generated <code className="text-amber-300">https://xxxx.trycloudflare.com</code> URL and paste it into the field above!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSTANT SQL DUMP (DIRECT IMPORT) */}
          {activeTab === 'sql' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950">
                <p className="font-bold text-sm flex items-center gap-1.5">
                  <FileCode size={18} className="text-emerald-700" />
                  Instant Direct Import (Zero Setup Required)
                </p>
                <p className="mt-1 text-slate-700">
                  You do not need to run the tunnel server to get your data into PostgreSQL right now! Download this SQL script or copy the SQL statements below and execute them in <strong>pgAdmin Query Tool</strong> or <strong>psql</strong>. All your users (including newly created ones), departments, and inspections are ready to insert.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={handleDownloadSql}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Download size={15} />
                    Download import_sqc_data.sql
                  </button>
                  <button
                    onClick={() => handleCopy(sqlPreview, 'sql-copy')}
                    className="px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-900 rounded-lg font-bold flex items-center gap-2 transition-colors"
                  >
                    {copiedKey === 'sql-copy' ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    {copiedKey === 'sql-copy' ? 'Copied SQL to Clipboard!' : 'Copy SQL to Clipboard'}
                  </button>
                </div>
              </div>

              {/* psql Command Helper */}
              <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] flex items-center justify-between">
                <span>psql command: <code className="text-emerald-400">psql -U postgres -d SQC -f bally_jute_sqc_full_dump.sql</code></span>
                <button
                  onClick={() => handleCopy('psql -U postgres -d SQC -f bally_jute_sqc_full_dump.sql', 'psql-cmd')}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[10px]"
                >
                  {copiedKey === 'psql-cmd' ? <Check size={12} /> : <Copy size={12} />}
                  Copy
                </button>
              </div>

              {/* Preview Window */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <div className="bg-slate-800 text-slate-300 px-4 py-2 font-mono text-[11px] flex items-center justify-between border-b border-slate-700">
                  <span>SQL Preview ({fullData.users.length} users, {fullData.departments.length} depts, {fullData.inspections.length} records)</span>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-[11px] max-h-56 overflow-y-auto overflow-x-auto select-all leading-relaxed">
                  {sqlPreview.slice(0, 3000)}
                  {sqlPreview.length > 3000 ? '\n\n-- ... [Remaining SQL statements generated dynamically] ...' : ''}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: COMPLETE SERVER.JS CODE */}
          {activeTab === 'server' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-950">
                <p className="font-bold text-sm flex items-center gap-1.5">
                  <Code2 size={18} className="text-blue-700" />
                  Updated Local Node.js API Server (`server.js`)
                </p>
                <p className="mt-1 text-slate-700 leading-relaxed">
                  Save this file to <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-bold text-blue-900">C:\my-local-api\server.js</code>. It includes support for your <code className="font-mono text-emerald-800 font-bold">DB_PASSWORD / DB_*</code> environment variables, automatic table creation on startup, and the bulk sync <code className="font-mono text-blue-800 font-bold">/api/sync-all</code> route.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleDownloadServerJs}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Download size={15} />
                    Download server.js File
                  </button>
                  <button
                    onClick={() => handleCopy(LOCAL_SERVER_JS_CODE, 'srv-tab-copy')}
                    className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-100/50 text-blue-900 rounded-lg font-bold flex items-center gap-2 transition-colors"
                  >
                    {copiedKey === 'srv-tab-copy' ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    {copiedKey === 'srv-tab-copy' ? 'Copied server.js Code!' : 'Copy server.js Code'}
                  </button>
                </div>
              </div>

              {/* Quick 2-Step Restart Guide */}
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="font-sans font-bold text-emerald-400">Restart Server in PowerShell:</span>
                  <button
                    onClick={() => handleCopy('cd C:\\my-local-api; node server.js', 'srv-restart-cmd')}
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[10px]"
                  >
                    {copiedKey === 'srv-restart-cmd' ? <Check size={12} /> : <Copy size={12} />}
                    Copy
                  </button>
                </div>
                <pre className="text-emerald-400 select-all overflow-x-auto">
                  # 1. In Terminal 1 where node server.js is running, press Ctrl + C to stop it{'\n'}
                  # 2. Replace C:\my-local-api\server.js with the downloaded file{'\n'}
                  # 3. Start the updated server:{'\n'}
                  node server.js
                </pre>
              </div>

              {/* server.js code preview */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <div className="bg-slate-800 text-slate-300 px-4 py-2 font-mono text-[11px] flex items-center justify-between border-b border-slate-700">
                  <span>server.js Code Preview</span>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-[11px] max-h-56 overflow-y-auto overflow-x-auto select-all leading-relaxed">
                  {LOCAL_SERVER_JS_CODE.slice(0, 3000)}
                  {LOCAL_SERVER_JS_CODE.length > 3000 ? '\n\n// ... [Full 900+ lines ready in download and copy buttons] ...' : ''}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            PostgreSQL Database: <strong className="text-slate-900">SQC</strong> (Default Port 5432)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-lg shadow-2xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
