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
import { postgresService } from '../services/postgresService';
import { DEFAULT_MAINTENANCE_MESSAGE } from '../services/maintenanceService';
import { useAuth } from '../context/AuthContext';
import { ApplicationSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentUser, isAdmin, maintenanceStatus, toggleMaintenanceMode } = useAuth();
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(
    maintenanceStatus.message || DEFAULT_MAINTENANCE_MESSAGE
  );
  const [maintenanceBusy, setMaintenanceBusy] = useState<boolean>(false);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState<boolean>(false);
  const [settings, setSettings] = useState<ApplicationSettings>(() => dataService.getSettings());
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEdit = isAdmin;

  useEffect(() => {
    if (maintenanceStatus.message) {
      setMaintenanceMessage(maintenanceStatus.message);
    }
  }, [maintenanceStatus.message]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    postgresService.fetchSettings().then(remote => {
      if (cancelled || !remote) return;
      setSettings(prev => ({
        ...prev,
        ...remote,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showNotice('error', 'Only Administrators are authorized to modify core system settings.');
      return;
    }

    setSavingSettings(true);
    try {
      const res = await dataService.updateSettings(settings);
      if (res.success) {
        setSettings(res.settings);
        showNotice('success', 'System settings saved to PostgreSQL.');
      } else {
        showNotice('error', res.message || 'Failed to save settings to PostgreSQL.');
      }
    } finally {
      setSavingSettings(false);
    }
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
            ? 'bg-[#E3DAB6] border-[#C6BA96]'
            : 'bg-[#FBF6E8] border-[#C6BA96]'
        }`}
      >
        <div className="border-b border-[#D7CBB0] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#3B2311] flex items-center gap-2 flex-wrap">
              <Wrench
                size={16}
                className={maintenanceStatus.enabled ? 'text-[#6B5B2E]' : 'text-[#4B5420]'}
              />
              <span>System Maintenance Mode Control</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                  maintenanceStatus.enabled
                    ? 'bg-amber-100 text-amber-950 border-amber-400'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {maintenanceStatus.enabled ? 'Maintenance Active' : 'System Online'}
              </span>
            </h3>
            <p className="text-xs text-[#5B4735] mt-0.5">
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
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
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
                  className="px-3.5 py-2 bg-[#555E27] hover:bg-[#6B5B2E] text-[#FBF6E8] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
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
            <label className="block font-semibold text-[#4C5324] mb-1">
              Maintenance Popup Message Shown to Users
            </label>
            <input
              id="maintenance-message-input"
              type="text"
              disabled={!canEdit}
              value={maintenanceMessage}
              onChange={e => setMaintenanceMessage(e.target.value)}
              placeholder={DEFAULT_MAINTENANCE_MESSAGE}
              className="w-full bg-[#FBF6E8] border border-[#C6BA96] rounded-lg p-2 text-xs text-[#3B2311] disabled:bg-[#F4ECD2]"
            />
          </div>

          {canEdit && maintenanceStatus.enabled && (
            <div>
              <button
                type="button"
                disabled={maintenanceBusy}
                onClick={() => handleApplyMaintenanceToggle(true)}
                className="w-full px-3 py-2 bg-[#4B5420] hover:bg-[#3F471A] text-[#FBF6E8] text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
              >
                Update Active Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ENTERPRISE SETTINGS & NUMBERING */}
      <form onSubmit={handleSave} className="bg-[#FBF6E8] rounded-xl border border-[#C6BA96] shadow-xs p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#4C5324] uppercase tracking-wider border-b border-[#D7CBB0] pb-2 flex items-center gap-2">
          <Building2 size={15} className="text-[#4B5420]" />
          <span>Company &amp; SQC Inspection Format Identity</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#4C5324] mb-1">Company Name</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.companyName}
              onChange={e => setSettings({ ...settings, companyName: e.target.value })}
              className="w-full bg-[#FBF6E8] border border-[#C6BA96] rounded-lg p-2 font-semibold text-[#3B2311] disabled:bg-[#F4ECD2]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#4C5324] mb-1">Department Subtitle</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.companySubtitle}
              onChange={e => setSettings({ ...settings, companySubtitle: e.target.value })}
              className="w-full bg-[#FBF6E8] border border-[#C6BA96] rounded-lg p-2 text-[#3B2311] disabled:bg-[#F4ECD2]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#4C5324] mb-1">Inspection Number Prefix</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.inspectionPrefix}
              onChange={e => setSettings({ ...settings, inspectionPrefix: e.target.value })}
              className="w-full bg-[#FBF6E8] border border-[#C6BA96] rounded-lg p-2 font-mono text-[#3B2311] disabled:bg-[#F4ECD2]"
            />
            <p className="text-[10px] text-[#5B4735] mt-1">Example: SQC/2026-27/FORM-01/000001</p>
          </div>

          <div>
            <label className="block font-semibold text-[#4C5324] mb-1">Active Financial Year</label>
            <input
              type="text"
              disabled={!canEdit}
              value={settings.financialYear}
              onChange={e => setSettings({ ...settings, financialYear: e.target.value })}
              className="w-full bg-[#FBF6E8] border border-[#C6BA96] rounded-lg p-2 text-[#3B2311] disabled:bg-[#F4ECD2]"
            />
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center justify-end pt-3 border-t border-[#D7CBB0]">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-2 bg-gradient-to-r from-[#4B5420] to-[#3F471A] hover:from-[#3F471A] hover:to-[#343B14] text-[#FBF6E8] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs border border-[#DFD2A6]/40 disabled:opacity-60 cursor-pointer"
            >
              <Save size={14} />
              <span>{savingSettings ? 'Saving...' : 'Save System Settings'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Inline Confirmation Modal for Activating Maintenance Mode */}
      {showMaintenanceConfirm && (
        <div className="fixed inset-0 bg-[#3B2311]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FBF6E8] rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#C6BA96] space-y-4">
            <div className="flex items-center justify-between border-b border-[#D7CBB0] pb-2">
              <h4 className="text-sm font-bold text-[#4C5324] flex items-center gap-2">
                <Wrench size={16} className="text-[#6B5B2E]" />
                <span>Activate Maintenance Mode?</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowMaintenanceConfirm(false)}
                className="text-[#5B4735] hover:text-[#3B2311] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#5B4735] leading-relaxed">
              Activating Maintenance Mode will immediately log out all active non-admin users and display the blocking notice:
            </p>
            <div className="p-2.5 rounded-lg bg-[#E3DAB6] border border-[#C6BA96] text-xs font-semibold text-[#4C5324]">
              &quot;{maintenanceMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE}&quot;
            </div>
            <p className="text-[11px] text-[#5B4735]">
              Your Administrator session will stay active so you can turn Maintenance Mode off when ready.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowMaintenanceConfirm(false)}
                className="px-3 py-1.5 border border-[#C6BA96] text-[#4C5324] text-xs rounded-lg hover:bg-[#F4ECD2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-activate-maintenance-btn"
                type="button"
                onClick={() => handleApplyMaintenanceToggle(true)}
                className="px-4 py-1.5 bg-[#4B5420] hover:bg-[#3F471A] text-[#FBF6E8] text-xs font-bold rounded-lg shadow-xs cursor-pointer"
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
