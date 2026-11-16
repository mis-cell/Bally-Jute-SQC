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
  Globe,
  UploadCloud,
  X,
  FileCode,
  ShieldCheck,
  Code2,
} from 'lucide-react';
import { postgresService, PostgresConnectionStatus } from '../services/postgresService';
import { dataService } from '../services/dataService';
import { LOCAL_SERVER_JS_CODE } from '../data/serverScript';
import { useAuth } from '../context/AuthContext';

interface PostgresSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PostgresSyncModal: React.FC<PostgresSyncModalProps> = ({ isOpen, onClose }) => {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<PostgresConnectionStatus | null>(
    postgresService.getCachedStatus()
  );
  const [config, setConfig] = useState(() => postgresService.getConfig());
  const [tunnelUrlInput, setTunnelUrlInput] = useState(config.apiUrl);
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey);
  const [syncEnabledInput, setSyncEnabledInput] = useState(config.syncEnabled);

  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'sql' | 'server'>('sync');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = postgresService.subscribe(newStatus => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen && isAdmin) {
      const cfg = postgresService.getConfig();
      setConfig(cfg);
      setTunnelUrlInput(cfg.apiUrl);
      setApiKeyInput(cfg.apiKey);
      setSyncEnabledInput(cfg.syncEnabled);
      handleTest();
    }
  }, [isOpen, isAdmin]);

  if (!isOpen || !isAdmin) return null;

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

  const handlePullAllData = async () => {
    setPulling(true);
    setSyncResult(null);
    try {
      const res = await postgresService.pullAndSyncAllData(true);
      if (res.success) {
        setSyncResult({
          success: true,
          message: `Successfully pulled all live data from PostgreSQL. Synced ${
            res.totalItems || 0
          } records across users, master data, and inspections.`,
        });
        handleTest();
      } else {
        setSyncResult({
          success: false,
          message:
            res.error || 'Failed to pull live data from PostgreSQL. Check backend connection.',
        });
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || 'Error pulling from PostgreSQL' });
    } finally {
      setPulling(false);
    }
  };

  const handleDownloadSql = () => {
    const fullState = dataService.getFullDatabaseState();
    const sql = postgresService.generateSqlDumpScript(fullState);
    postgresService.downloadSqlFile(
      sql,
      `bally_jute_sqc_full_dump_${new Date().toISOString().split('T')[0]}.sql`
    );
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B1114]/75 backdrop-blur-xs"
    >
      <div className="bg-[#FFFDF8] rounded-xl shadow-2xl border border-[#DFC378] w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#63050B] via-[#8B0A12] to-[#68050B] text-[#FFFDF8] flex items-center justify-between border-b-2 border-[#D4AF37]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#4E0308] flex items-center justify-center border border-[#D4AF37]">
              <Database size={22} className="text-[#E9C96B]" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-[#FFFDF8] flex items-center gap-2 flex-wrap">
                <span>Local Machine PostgreSQL Hub</span>
                {status?.isConnected ? (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                    ONLINE: {status.database}
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#4E0308] text-[#E9C96B] border border-[#D4AF37]/40 font-mono font-bold">
                    DISCONNECTED
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#FCF8EE]/80">
                Sync Users, Master Data, and Inspections into PostgreSQL (SQC database)
              </p>
            </div>
          </div>
          <button
            id="close-pg-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#FCF8EE]/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E4D0A3] bg-[#FBF4E1] px-6 pt-2 gap-2 text-xs font-bold overflow-x-auto">
          <button
            id="pg-tab-sync"
            onClick={() => setActiveTab('sync')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'sync'
                ? 'border-[#8B0A12] text-[#8B0A12] bg-[#FFFDF8] rounded-t-lg'
                : 'border-transparent text-[#6E524B] hover:text-[#2B1114]'
            }`}
          >
            <UploadCloud size={15} />
            Live Sync &amp; Status
          </button>
          <button
            id="pg-tab-config"
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'config'
                ? 'border-[#8B0A12] text-[#8B0A12] bg-[#FFFDF8] rounded-t-lg'
                : 'border-transparent text-[#6E524B] hover:text-[#2B1114]'
            }`}
          >
            <Globe size={15} />
            Tunnel Config &amp; Commands
          </button>
          <button
            id="pg-tab-sql"
            onClick={() => setActiveTab('sql')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'sql'
                ? 'border-[#8B0A12] text-[#8B0A12] bg-[#FFFDF8] rounded-t-lg'
                : 'border-transparent text-[#6E524B] hover:text-[#2B1114]'
            }`}
          >
            <FileCode size={15} />
            Instant SQL Dump
          </button>
          <button
            id="pg-tab-server"
            onClick={() => setActiveTab('server')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'server'
                ? 'border-[#8B0A12] text-[#8B0A12] bg-[#FFFDF8] rounded-t-lg'
                : 'border-transparent text-[#6E524B] hover:text-[#2B1114]'
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
                    : 'bg-[#FDF5DC] border-[#DFC378] text-[#2B1114]'
                }`}
              >
                {status?.isConnected ? (
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={24} className="text-[#9B6E14] shrink-0 mt-0.5" />
                )}
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-sm">
                      {status?.isConnected
                        ? `Connected to Local PostgreSQL (${status.database || 'SQC'})`
                        : 'Local Machine PostgreSQL Is Not Connected'}
                    </p>
                    <button
                      id="pg-retest-btn"
                      onClick={handleTest}
                      disabled={testing}
                      className="px-2.5 py-1 bg-[#FFFDF8] border border-[#E4D0A3] rounded shadow-2xs font-bold text-[#5C080E] hover:bg-[#FBF4E1] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={12} className={testing ? 'animate-spin' : ''} />
                      {testing ? 'Checking...' : 'Check Status'}
                    </button>
                  </div>
                  <p className="mt-1 text-[#6E524B]">
                    {status?.message ||
                      'Data created in this web app is retained locally until synchronized with PostgreSQL.'}
                  </p>
                  {status?.checkedAt && (
                    <p className="text-[11px] text-[#6E524B] mt-1">
                      Last checked: {status.checkedAt}
                    </p>
                  )}
                </div>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FBF4E1] border border-[#E4D0A3] p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-[#6E524B] uppercase">
                    Users &amp; Staff
                  </span>
                  <p className="text-xl font-black text-[#2B1114] tabular-nums">
                    {fullData.users.length}
                  </p>
                  <span className="text-[10px] text-[#6E524B]">Includes new additions</span>
                </div>
                <div className="bg-[#FBF4E1] border border-[#E4D0A3] p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-[#6E524B] uppercase">
                    Master Tables
                  </span>
                  <p className="text-xl font-black text-[#2B1114] tabular-nums">
                    {fullData.departments.length +
                      fullData.machines.length +
                      fullData.looms.length +
                      fullData.qualities.length +
                      fullData.standards.length}
                  </p>
                  <span className="text-[10px] text-[#6E524B]">Depts, Looms, Specs</span>
                </div>
                <div className="bg-[#FBF4E1] border border-[#E4D0A3] p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-[#6E524B] uppercase">Inspections</span>
                  <p className="text-xl font-black text-[#2B1114] tabular-nums">
                    {fullData.inspections.length}
                  </p>
                  <span className="text-[10px] text-[#6E524B]">Active records</span>
                </div>
                <div className="bg-[#FBF4E1] border border-[#E4D0A3] p-3 rounded-lg">
                  <span className="text-[11px] font-bold text-[#6E524B] uppercase">Sync Engine</span>
                  <p className="text-sm font-black text-[#8B0A12] mt-1 flex items-center gap-1">
                    <ShieldCheck size={16} /> Ready
                  </p>
                  <span className="text-[10px] text-[#6E524B]">Auto-upsert enabled</span>
                </div>
              </div>

              {/* Real-time Auto Sync Status Card */}
              <div className="p-4 bg-[#FDF5DC] border border-[#DFC378] rounded-xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-[#7A560B]">
                    Automatic Real-Time Synchronization Active
                  </h3>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#FFFDF8] text-[#5C080E] border border-[#E4D0A3] tabular-nums">
                    POLLING: EVERY 7s
                  </span>
                </div>
                <p className="text-xs text-[#6E524B] leading-relaxed">
                  Every time you create, edit, approve, or delete an inspection or master record, it is synchronized with your PostgreSQL database and broadcasted across tabs.
                </p>
              </div>

              {/* Sync Action Buttons */}
              <div className="p-4 bg-[#4E0308] rounded-xl text-[#FFFDF8] space-y-3 border border-[#D4AF37]/50">
                <div>
                  <h3 className="text-sm font-bold text-[#FFFDF8] flex items-center gap-2">
                    <UploadCloud size={18} className="text-[#E9C96B]" />
                    Bi-Directional Database Sync Controls
                  </h3>
                  <p className="text-xs text-[#FCF8EE]/80">
                    Sync users, master records, and inspections between PostgreSQL tables and the web application.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    id="pg-pull-all-btn"
                    onClick={handlePullAllData}
                    disabled={pulling || !status?.isConnected}
                    className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      status?.isConnected
                        ? 'bg-[#C9962B] hover:bg-[#D4AF37] text-[#2B1114] shadow-md'
                        : 'bg-[#2B1114] text-[#9E857C] cursor-not-allowed border border-[#68050B]'
                    }`}
                  >
                    <RefreshCw size={15} className={pulling ? 'animate-spin' : ''} />
                    {pulling ? 'Pulling from PostgreSQL...' : 'Pull Latest from PostgreSQL'}
                  </button>

                  <button
                    id="pg-push-all-btn"
                    onClick={handlePushAllData}
                    disabled={pushing || !status?.isConnected}
                    className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      status?.isConnected
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-md'
                        : 'bg-[#2B1114] text-[#9E857C] cursor-not-allowed border border-[#68050B]'
                    }`}
                  >
                    <UploadCloud size={16} />
                    {pushing ? 'Synchronizing with PostgreSQL...' : 'Push All Data to PostgreSQL'}
                  </button>

                  <button
                    id="pg-download-sql-sync-btn"
                    onClick={handleDownloadSql}
                    className="px-4 py-2 bg-[#68050B] hover:bg-[#8B0A12] text-[#FFFDF8] border border-[#D4AF37]/40 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download size={16} />
                    Download SQL File
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TUNNEL CONFIGURATION & COMMANDS */}
          {activeTab === 'config' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-[#FBF4E1] border border-[#E4D0A3] rounded-xl space-y-3">
                <h3 className="font-bold text-[#2B1114] text-sm flex items-center gap-2">
                  <Globe size={16} className="text-[#8B0A12]" />
                  Cloudflare Tunnel / Local Bridge Settings
                </h3>
                <p className="text-[#6E524B]">
                  Configure the bridge endpoint connecting this portal to your PostgreSQL server.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block font-bold text-[#5C080E] mb-1">
                      Bridge / Tunnel URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={tunnelUrlInput}
                        onChange={e => setTunnelUrlInput(e.target.value)}
                        placeholder="https://your-name.trycloudflare.com"
                        className="flex-1 px-3 py-2 bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg font-mono text-xs text-[#2B1114]"
                      />
                      <button
                        onClick={handleSaveConfig}
                        className="px-4 py-2 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Save &amp; Test
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#5C080E] mb-1">
                      Optional Bridge Header Key (if configured)
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg font-mono text-xs text-[#2B1114]"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#2B1114] text-[#FCF8EE] p-3.5 rounded-xl font-mono text-[11px] space-y-2 border border-[#68050B]">
                <div className="flex items-center justify-between text-[#E9C96B] border-b border-[#68050B] pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Terminal size={13} />
                    Local Config Template (.env)
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `DB_HOST=localhost\nDB_PORT=5432\nDB_USER=postgres\nDB_PASSWORD=your_password\nDB_NAME=SQC\nJWT_SECRET=set_a_strong_random_secret\nPORT=3000`,
                        'env-copy'
                      )
                    }
                    className="text-[#E9C96B] hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    {copiedKey === 'env-copy' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'env-copy' ? 'Copied' : 'Copy Template'}
                  </button>
                </div>
                <pre className="text-[#FCF8EE]/90 select-all overflow-x-auto">
{`DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=SQC
JWT_SECRET=set_a_strong_random_secret
PORT=3000`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: INSTANT SQL DUMP */}
          {activeTab === 'sql' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-[#FBF4E1] border border-[#E4D0A3] rounded-xl text-[#2B1114]">
                <p className="font-bold text-sm flex items-center gap-1.5 text-[#5C080E]">
                  <FileCode size={18} className="text-[#8B0A12]" />
                  Instant Direct Import
                </p>
                <p className="mt-1 text-[#6E524B]">
                  Download this SQL script or copy the SQL statements below and execute them in pgAdmin Query Tool or psql.
                </p>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleDownloadSql}
                    className="px-4 py-2 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] rounded-lg font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download size={15} />
                    Download import_sqc_data.sql
                  </button>
                  <button
                    onClick={() => handleCopy(sqlPreview, 'sql-copy')}
                    className="px-4 py-2 bg-[#FFFDF8] border border-[#DFC378] hover:bg-[#FDF5DC] text-[#5C080E] rounded-lg font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'sql-copy' ? (
                      <Check size={15} className="text-emerald-700" />
                    ) : (
                      <Copy size={15} />
                    )}
                    {copiedKey === 'sql-copy' ? 'Copied SQL to Clipboard!' : 'Copy SQL to Clipboard'}
                  </button>
                </div>
              </div>

              <div className="border border-[#E4D0A3] rounded-xl overflow-hidden">
                <div className="bg-[#4E0308] text-[#E9C96B] px-4 py-2 font-mono text-[11px] flex items-center justify-between border-b border-[#68050B]">
                  <span>
                    SQL Preview ({fullData.users.length} users, {fullData.departments.length} depts,{' '}
                    {fullData.inspections.length} records)
                  </span>
                </div>
                <pre className="p-4 bg-[#2B1114] text-[#FCF8EE] font-mono text-[11px] max-h-56 overflow-y-auto overflow-x-auto select-all leading-relaxed">
                  {sqlPreview.slice(0, 3000)}
                  {sqlPreview.length > 3000
                    ? '\n\n-- ... [Remaining SQL statements generated dynamically] ...'
                    : ''}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: SERVER.JS CODE */}
          {activeTab === 'server' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-[#FBF4E1] border border-[#E4D0A3] rounded-xl text-[#2B1114]">
                <p className="font-bold text-sm flex items-center gap-1.5 text-[#5C080E]">
                  <Code2 size={18} className="text-[#8B0A12]" />
                  Local Node.js API Server (server.js)
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleDownloadServerJs}
                    className="px-4 py-2 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] rounded-lg font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download size={15} />
                    Download server.js File
                  </button>
                  <button
                    onClick={() => handleCopy(LOCAL_SERVER_JS_CODE, 'srv-tab-copy')}
                    className="px-4 py-2 bg-[#FFFDF8] border border-[#DFC378] hover:bg-[#FDF5DC] text-[#5C080E] rounded-lg font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'srv-tab-copy' ? (
                      <Check size={15} className="text-emerald-700" />
                    ) : (
                      <Copy size={15} />
                    )}
                    {copiedKey === 'srv-tab-copy' ? 'Copied server.js Code!' : 'Copy server.js Code'}
                  </button>
                </div>
              </div>

              <div className="border border-[#E4D0A3] rounded-xl overflow-hidden">
                <div className="bg-[#4E0308] text-[#E9C96B] px-4 py-2 font-mono text-[11px] border-b border-[#68050B]">
                  <span>server.js Code Preview</span>
                </div>
                <pre className="p-4 bg-[#2B1114] text-[#FCF8EE] font-mono text-[11px] max-h-56 overflow-y-auto overflow-x-auto select-all leading-relaxed">
                  {LOCAL_SERVER_JS_CODE.slice(0, 3000)}
                  {LOCAL_SERVER_JS_CODE.length > 3000
                    ? '\n\n// ... [Full code ready in download and copy buttons] ...'
                    : ''}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FBF4E1] border-t border-[#E4D0A3] flex items-center justify-between text-xs">
          <span className="text-[#6E524B]">
            PostgreSQL Database: <strong className="text-[#2B1114]">SQC</strong> (Default Port 5432)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#FFFDF8] border border-[#E4D0A3] hover:bg-[#FDF5DC] text-[#5C080E] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
