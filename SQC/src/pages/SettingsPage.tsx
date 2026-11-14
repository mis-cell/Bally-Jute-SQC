import React, { useState, useEffect } from 'react';
import {
  Save,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Power,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { DEFAULT_MAINTENANCE_MESSAGE } from '../services/maintenanceService';
import { useAuth } from '../context/AuthContext';
import { ApplicationSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentUser, maintenanceStatus, toggleMaintenanceMode } = useAuth();
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(
    maintenanceStatus.message || DEFAULT_MAINTENANCE_MESSAGE
  );
  const [maintenanceBusy, setMaintenanceBusy] = useState<boolean>(false);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState<boolean>(false);
  const [settings, setSettings] = useState<ApplicationSettings>(() => dataService.getSettings());
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const roleStr = currentUser?.role as string;
  const canEdit = roleStr === 'Super Admin' || roleStr === 'SuperAdmin' || roleStr === 'Admin';

  useEffect(() => {
    if (maintenanceStatus.message) {
      setMaintenanceMessage(maintenanceStatus.message);
    }
  }, [maintenanceStatus.message]);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setActionNotice({ type, text });
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleApplyMaintenanceToggle = async (targetEnabled: boolean) => {
    if (!canEdit) {
      showNotice('error', 'Only Administrators can toggle Maintenance Mode.');
      return;
    }
    setMaintenanceBusy(true);
    setShowMaintenanceConfirm(false);
    try {
      const res = await toggleMaintenanceMode(
        targetEnabled,
        maintenanceMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE
      );
      showNotice(res.success ? 'success' : 'error', res.notice);
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showNotice('error', 'Only Super Admin is authorized to modify core system settings.');
      return;
    }

    const updated = dataService.updateSettings(settings, currentUser);
    setSettings(updated);
    showNotice('success', 'System settings saved successfully.');
  };

  return (
    <div className="space-y-6 max-w-5xl">
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

      {/* CARD 0: SYSTEM MAINTENANCE MODE CONTROL (ADMIN ONLY) */}
      <div
        className={`rounded-xl border shadow-xs p-5 space-y-4 ${
          maintenanceStatus.enabled
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="border-b border-slate-200/80 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wrench
                size={16}
                className={maintenanceStatus.enabled ? 'text-amber-700' : 'text-[#D95F68]'}
              />
              <span>System Maintenance Mode Control</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  maintenanceStatus.enabled
                    ? 'bg-amber-200 text-amber-950 border border-amber-400'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {maintenanceStatus.enabled ? 'Maintenance Active' : 'System Online'}
              </span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              When activated, all active non-admin sessions are immediately logged out and blocked with the maintenance notice popup until restored.
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              {maintenanceStatus.enabled ? (
                <button
                  id="deactivate-maintenance-btn"
                  type="button"
                  disabled={maintenanceBusy}
                  onClick={() => handleApplyMaintenanceToggle(false)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <Power size={14} />
                  <span>{maintenanceBusy ? 'Updating...' : 'Turn Off Maintenance Mode'}</span>
                </button>
              ) : (
                <button
                  id="activate-maintenance-btn"
                  type="button"
                  disabled={maintenanceBusy}
                  onClick={() => setShowMaintenanceConfirm(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <Wrench size={14} />
                  <span>{maintenanceBusy ? 'Updating...' : 'Activate Maintenance Mode'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end text-xs">
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Maintenance Popup Message Shown to Users
            </label>
            <input
              id="maintenance-message-input"
              type="text"
              disabled={!canEdit}
              value={maintenanceMessage}
              onChange={e => setMaintenanceMessage(e.target.value)}
              placeholder={DEFAULT_MAINTENANCE_MESSAGE}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:border-[#D95F68] focus:ring-1 focus:ring-[#D95F68] disabled:bg-slate-100"
            />
          </div>

          {canEdit && maintenanceStatus.enabled && (
            <div>
              <button
                type="button"
                disabled={maintenanceBusy}
                onClick={() => handleApplyMaintenanceToggle(true)}
                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
              >
                Update Active Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ENTERPRISE SETTINGS & NUMBERING */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <Building2 size={15} className="text-emerald-700" />
          <span>Company &amp; SQC Inspection Format Identity</span>
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

      {/* Inline Confirmation Modal for Activating Maintenance Mode */}
      {showMaintenanceConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-amber-300 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Wrench size={16} className="text-amber-600" />
                <span>Activate Maintenance Mode?</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowMaintenanceConfirm(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Activating Maintenance Mode will immediately log out all active non-admin users and display the blocking notice:
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-950">
              &quot;{maintenanceMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE}&quot;
            </div>
            <p className="text-[11px] text-slate-500">
              Your Administrator session will stay active so you can turn Maintenance Mode off when ready.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowMaintenanceConfirm(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                id="confirm-activate-maintenance-btn"
                type="button"
                onClick={() => handleApplyMaintenanceToggle(true)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                Confirm &amp; Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
