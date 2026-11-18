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
      className="fixed inset-0 z-[100] bg-[#3B2311]/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[#FBF6E8] rounded-2xl max-w-md w-full shadow-2xl border-2 border-[#C6BA96] overflow-hidden">
        {/* Top Accent Banner */}
        <div className="bg-gradient-to-r from-[#343B14] via-[#4B5420] to-[#3F471A] px-6 py-5 text-[#FAF6EA] text-center border-b-2 border-[#DFD2A6]">
          <div className="w-14 h-14 rounded-2xl bg-[#343B14]/70 border border-[#DFD2A6] flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Wrench size={26} className="text-[#DFD2A6]" />
          </div>
          <h2 id="maintenance-modal-title" className="text-lg font-black tracking-tight">
            System Under Maintenance
          </h2>
          <p className="text-[11px] text-[#DFD2A6] mt-1 font-semibold uppercase tracking-wider">
            SQC Quality Control Portal
          </p>
        </div>

        {/* Message Body */}
        <div className="p-6 space-y-4 text-center">
          {wasForcedLogout && (
            <div className="p-2.5 rounded-xl bg-[#E3DAB6] border border-[#C6BA96] text-[#4C5324] text-xs font-semibold flex items-center justify-center gap-2">
              <ShieldAlert size={15} className="text-[#4B5420] shrink-0" />
              <span>Your active session was signed out because maintenance started.</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#F4ECD2] border border-[#C6BA96]">
            <p className="text-sm font-bold text-[#3B2311] leading-relaxed">
              {message || DEFAULT_MAINTENANCE_MESSAGE}
            </p>
            {(activatedBy || activatedAt) && (
              <p className="text-[11px] text-[#5B4735] mt-2">
                {activatedBy ? `Initiated by ${activatedBy}` : 'Scheduled Maintenance'}
                {activatedAt ? ` · ${new Date(activatedAt).toLocaleString()}` : ''}
              </p>
            )}
          </div>

          <p className="text-xs text-[#5B4735] leading-relaxed">
            All floor entries, approvals, and user logins are temporarily paused while administrators perform maintenance. This screen will automatically clear once service resumes.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              id="maintenance-check-status-btn"
              type="button"
              onClick={handleCheckAgain}
              disabled={checking}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#555E27] to-[#3F471A] hover:from-[#495121] hover:to-[#343B14] text-[#FAF6EA] text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm border border-[#DFD2A6]/40 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              <span>{checking ? 'Checking Server Status...' : 'Check Server Status'}</span>
            </button>

            {onAdminBypassToLogin && (
              <button
                id="maintenance-admin-signin-btn"
                type="button"
                onClick={onAdminBypassToLogin}
                className="w-full py-2 px-4 rounded-xl border border-[#C6BA96] hover:bg-[#F4ECD2] text-[#4C5324] text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
