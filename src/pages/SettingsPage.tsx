import React, { useState } from 'react';
import {
  Settings,
  Shield,
  RotateCcw,
  Save,
  CheckCircle,
  Database,
  Lock,
  Building2,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { ApplicationSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [settings, setSettings] = useState<ApplicationSettings>(() => dataService.getSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canEdit = currentUser.role === 'Super Admin';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert('Only Super Admin is authorized to modify core system settings.');
      return;
    }
    const updated = dataService.updateSettings(settings, currentUser);
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
    </div>
  );
};
