import React, { useState } from 'react';
import { Wrench, RefreshCw, ShieldAlert, LogIn } from 'lucide-react';
import { DEFAULT_MAINTENANCE_MESSAGE } from '../services/maintenanceService';

interface MaintenanceModalProps {
  isOpen: boolean;
  message?: string;
  activatedBy?: string | null;
  activatedAt?: string | null;
  wasForcedLogout?: boolean;
  onRefreshStatus: () => Promise<void>;
  onAdminBypassToLogin?: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  message,
  activatedBy,
  activatedAt,
  wasForcedLogout,
  onRefreshStatus,
  onAdminBypassToLogin,
}) => {
  const [checking, setChecking] = useState(false);

  if (!isOpen) return null;

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      await onRefreshStatus();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      id="maintenance-lockout-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-modal-title"
      className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border-2 border-[#D95F68] overflow-hidden">
        {/* Top Accent Banner */}
        <div className="bg-gradient-to-r from-[#701638] via-[#9D174D] to-[#D95F68] px-6 py-5 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Wrench size={28} className="text-white" />
          </div>
          <h2 id="maintenance-modal-title" className="text-lg font-black tracking-tight">
            System Under Maintenance
          </h2>
          <p className="text-[11px] text-white/90 mt-1 font-medium uppercase tracking-wider">
            SQC Quality Control Portal
          </p>
        </div>

        {/* Message Body */}
        <div className="p-6 space-y-4 text-center">
          {wasForcedLogout && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center justify-center gap-2">
              <ShieldAlert size={15} className="text-amber-700 shrink-0" />
              <span>Your active session was signed out because maintenance started.</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#FFF9F9] border border-[#F4C4C5]">
            <p className="text-sm font-bold text-[#393334] leading-relaxed">
              {message || DEFAULT_MAINTENANCE_MESSAGE}
            </p>
            {(activatedBy || activatedAt) && (
              <p className="text-[11px] text-[#806B6C] mt-2">
                {activatedBy ? `Initiated by ${activatedBy}` : 'Scheduled Maintenance'}
                {activatedAt ? ` • ${new Date(activatedAt).toLocaleString()}` : ''}
              </p>
            )}
          </div>

          <p className="text-xs text-[#806B6C] leading-relaxed">
            All floor entries, approvals, and user logins are temporarily paused while administrators perform maintenance. This screen will automatically clear once service resumes.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              id="maintenance-check-status-btn"
              type="button"
              onClick={handleCheckAgain}
              disabled={checking}
              className="w-full py-2.5 px-4 rounded-xl bg-[#D95F68] hover:bg-[#C94E59] text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              <span>{checking ? 'Checking Server Status...' : 'Check Server Status'}</span>
            </button>

            {onAdminBypassToLogin && (
              <button
                id="maintenance-admin-signin-btn"
                type="button"
                onClick={onAdminBypassToLogin}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogIn size={13} />
                <span>Administrator Sign-In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
