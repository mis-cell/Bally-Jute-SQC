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
      className="fixed inset-0 z-[100] bg-[#393334]/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full shadow-2xl border-2 border-[#F5D0CB] overflow-hidden">
        {/* Top Accent Banner */}
        <div className="bg-gradient-to-r from-[#EA5551] via-[#EA5551] to-[#D46764] px-6 py-5 text-[#FFFFFF] text-center border-b-2 border-[#FFE0DA]">
          <div className="w-14 h-14 rounded-2xl bg-[#EA5551]/70 border border-[#FFE0DA] flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Wrench size={26} className="text-[#FFFFFF]" />
          </div>
          <h2 id="maintenance-modal-title" className="text-lg font-black tracking-tight">
            System Under Maintenance
          </h2>
          <p className="text-[11px] text-[#FFFFFF] mt-1 font-semibold uppercase tracking-wider">
            SQC Quality Control Portal
          </p>
        </div>

        {/* Message Body */}
        <div className="p-6 space-y-4 text-center">
          {wasForcedLogout && (
            <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#F5D0CB] text-[#EA5551] text-xs font-semibold flex items-center justify-center gap-2">
              <ShieldAlert size={15} className="text-[#EA5551] shrink-0" />
              <span>Your active session was signed out because maintenance started.</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#FFF1EE] border border-[#F5D0CB]">
            <p className="text-sm font-bold text-[#393334] leading-relaxed">
              {message || DEFAULT_MAINTENANCE_MESSAGE}
            </p>
            {(activatedBy || activatedAt) && (
              <p className="text-[11px] text-[#806B68] mt-2">
                {activatedBy ? `Initiated by ${activatedBy}` : 'Scheduled Maintenance'}
                {activatedAt ? ` · ${new Date(activatedAt).toLocaleString()}` : ''}
              </p>
            )}
          </div>

          <p className="text-xs text-[#806B68] leading-relaxed">
            All floor entries, approvals, and user logins are temporarily paused while administrators perform maintenance. This screen will automatically clear once service resumes.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              id="maintenance-check-status-btn"
              type="button"
              onClick={handleCheckAgain}
              disabled={checking}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#D46764] to-[#D46764] hover:from-[#EA5551] hover:to-[#EA5551] text-[#FFFFFF] text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm border border-[#FFE0DA]/40 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              <span>{checking ? 'Checking Server Status...' : 'Check Server Status'}</span>
            </button>

            {onAdminBypassToLogin && (
              <button
                id="maintenance-admin-signin-btn"
                type="button"
                onClick={onAdminBypassToLogin}
                className="w-full py-2 px-4 rounded-xl border border-[#F5D0CB] hover:bg-[#FFF1EE] text-[#EA5551] text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
