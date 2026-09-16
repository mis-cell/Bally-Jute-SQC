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
  UserPlus,
  Users,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { useAuth } from '../context/AuthContext';
import { ApplicationSettings, CustomerRecord } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<ApplicationSettings>(() => dataService.getSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // PostgreSQL / Cloudflare Tunnel Integration State
  const initialPgConfig = postgresService.getConfig();
  const [tunnelUrl, setTunnelUrl] = useState(initialPgConfig.apiUrl);
  const [apiKey, setApiKey] = useState(initialPgConfig.apiKey);
  const [syncEnabled, setSyncEnabled] = useState(initialPgConfig.syncEnabled);

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    time?: string;
  } | null>(null);

  // Customers test state
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerSuccess, setCustomerSuccess] = useState<string | null>(null);

  const canEdit = currentUser.role === 'Super Admin';

  // Test connection and load customers
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);

    // Update active service config before testing
    postgresService.setConfig(tunnelUrl, apiKey, syncEnabled);

    try {
      const res = await postgresService.testConnection();
      if (res.isConnected) {
        setConnectionResult({
          success: true,
          message: res.message,
          time: res.checkedAt,
        });
        // Also fetch customer list
        handleLoadCustomers();
      } else {
        setConnectionResult({
          success: false,
          message: res.message,
          time: res.checkedAt,
        });
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

  const handleLoadCustomers = async () => {
    setLoadingCustomers(true);
    setCustomerSuccess(null);
    try {
      const data = await postgresService.loadCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.email) {
      alert('Name and Email are required');
      return;
    }

    setSavingCustomer(true);
    try {
      const created = await postgresService.createCustomer(newCustomer);
      setCustomerSuccess(`Customer "${created.name}" saved to PostgreSQL!`);
      setNewCustomer({ name: '', email: '', phone: '' });
      setShowAddCustomer(false);
      handleLoadCustomers();
      setTimeout(() => setCustomerSuccess(null), 4000);
    } catch (err: any) {
      alert(`Failed to save customer: ${err.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert('Only Super Admin is authorized to modify core system settings.');
      return;
    }

    // Save PostgreSQL tunnel configuration
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

  const handleReset = () => {
    if (!canEdit) return;
    if (
      confirm(
        'WARNING: This will reset all inspection records, standards, and masters back to the factory sample specification. Continue?'
      )
    ) {
      dataService.resetToFactoryDefaults(currentUser);
      setSettings(dataService.getSettings());
      alert('Application database reset to original factory specifications.');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings size={18} className="text-emerald-700" />
            <span>System Configuration & Policy Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise application parameters, prefix rules, and approval workflow triggers
          </p>
        </div>

        {!canEdit && (
          <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg flex items-center gap-1.5 font-medium">
            <Lock size={13} />
            <span>Read-Only Mode (Super Admin Required)</span>
          </span>
        )}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
          <CheckCircle size={16} className="text-emerald-700" />
          <span>Settings saved and audited successfully.</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
          Company & Header Identity
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

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Factory Location & Address</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.address}
              onChange={e => setSettings({ ...settings, address: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 disabled:bg-slate-50"
            />
          </div>
        </div>

        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 pt-3">
          Inspection Numbering & Number Sequence
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inspection Number Prefix</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.inspectionPrefix}
              onChange={e => setSettings({ ...settings, inspectionPrefix: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-800 disabled:bg-slate-50"
            />
            <p className="text-[10px] text-slate-400 mt-1">Example output: SQC/2026-27/FORM-01/000045</p>
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

        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 pt-3">
          Workflow Policies
        </h3>

        <div className="space-y-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={settings.enableOfflineCache}
              onChange={e => setSettings({ ...settings, enableOfflineCache: e.target.checked })}
              className="rounded border-slate-300 text-emerald-700"
            />
            <span className="font-semibold text-slate-800">
              Enable Mill Floor Offline Caching
            </span>
            <span className="text-slate-400 text-[11px]">— allows uninterrupted testing in low-signal sheds</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={settings.requireDualApproval}
              onChange={e => setSettings({ ...settings, requireDualApproval: e.target.checked })}
              className="rounded border-slate-300 text-emerald-700"
            />
            <span className="font-semibold text-slate-800">
              Enforce Dual Approval on Borderline WARNING Records
            </span>
          </label>
        </div>

        {canEdit && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              <span>Reset to Factory Defaults</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
            >
              <Save size={14} />
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </form>

      {/* Local PostgreSQL & Cloudflare Tunnel Integration Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              <span>Local PostgreSQL & Cloudflare Tunnel Integration</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect this GitHub web app to your local PC PostgreSQL instance via Cloudflare Tunnel (<code className="text-slate-700 font-mono bg-slate-100 px-1 py-0.5 rounded">trycloudflare.com</code>)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={13} className={testingConnection ? 'animate-spin' : ''} />
              <span>{testingConnection ? 'Testing Tunnel...' : 'Test Connection & Load Data'}</span>
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
              {connectionResult.time && (
                <div className="text-[11px] opacity-75 mt-0.5">Checked at: {connectionResult.time}</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe size={13} className="text-slate-400" />
              <span>Cloudflare Tunnel URL (<code className="font-mono text-slate-500">API_URL</code>)</span>
            </label>
            <input
              type="url"
              value={tunnelUrl}
              onChange={e => setTunnelUrl(e.target.value)}
              placeholder="https://blue-example.trycloudflare.com"
              className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Generated when running <code className="font-mono bg-slate-100 px-1 rounded">cloudflared tunnel --url http://localhost:3000</code>
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key size={13} className="text-slate-400" />
              <span>API Secret Key (<code className="font-mono text-slate-500">x-api-key</code>)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="change-this-to-a-long-secret-key-123456"
              className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Matches <code className="font-mono bg-slate-100 px-1 rounded">API_KEY</code> in your local Node.js <code className="font-mono">.env</code>
            </p>
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={e => setSyncEnabled(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-800">
              Auto-replicate all SQC Form submissions directly into local PostgreSQL table <code className="font-mono text-blue-700 bg-blue-50 px-1 rounded">inspections</code>
            </span>
          </label>
        </div>

        {/* Live Customer Testing Section */}
        <div className="border-t border-slate-100 pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                PostgreSQL Customers Table Test (<code className="font-mono lowercase">loadCustomers()</code>)
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadCustomers}
                disabled={loadingCustomers}
                className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium inline-flex items-center gap-1"
              >
                <RefreshCw size={11} className={loadingCustomers ? 'animate-spin' : ''} />
                <span>Refresh List</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddCustomer(!showAddCustomer)}
                className="px-2.5 py-1 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-medium inline-flex items-center gap-1"
              >
                <UserPlus size={11} />
                <span>Add Test Customer</span>
              </button>
            </div>
          </div>

          {customerSuccess && (
            <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-600" />
              <span>{customerSuccess}</span>
            </div>
          )}

          {/* Quick Add Customer Form */}
          {showAddCustomer && (
            <form onSubmit={handleCreateCustomer} className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3 space-y-3">
              <div className="text-xs font-semibold text-slate-800">
                Insert Test Row into Local PostgreSQL (<code className="font-mono text-[11px]">INSERT INTO customers</code>)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Customer Name (e.g. Rahul Das)"
                  required
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="border border-slate-300 rounded p-1.5 bg-white text-slate-800"
                />
                <input
                  type="email"
                  placeholder="Email (e.g. rahul@example.com)"
                  required
                  value={newCustomer.email}
                  onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="border border-slate-300 rounded p-1.5 bg-white text-slate-800"
                />
                <input
                  type="text"
                  placeholder="Phone (optional)"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="border border-slate-300 rounded p-1.5 bg-white text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
                  className="px-2.5 py-1 text-xs border border-slate-300 text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-3 py-1 text-xs bg-emerald-800 text-white font-semibold rounded hover:bg-emerald-900"
                >
                  {savingCustomer ? 'Saving to Postgres...' : 'Save to Local PostgreSQL'}
                </button>
              </div>
            </form>
          )}

          {/* Customer Records Table */}
          {customers.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                  <tr>
                    <th className="p-2 border-b border-slate-200">ID</th>
                    <th className="p-2 border-b border-slate-200">Name</th>
                    <th className="p-2 border-b border-slate-200">Email</th>
                    <th className="p-2 border-b border-slate-200">Phone</th>
                    <th className="p-2 border-b border-slate-200">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {customers.map((c, i) => (
                    <tr key={c.id || i} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-slate-500">{c.id}</td>
                      <td className="p-2 font-medium">{c.name}</td>
                      <td className="p-2">{c.email}</td>
                      <td className="p-2 text-slate-600">{c.phone || '—'}</td>
                      <td className="p-2 text-[11px] text-slate-400">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
              {loadingCustomers ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-blue-600" />
                  <span>Loading customer records from local PostgreSQL...</span>
                </div>
              ) : (
                <span>
                  No customers fetched yet. Click <strong>"Test Connection & Load Data"</strong> above to retrieve rows from your PostgreSQL database.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
