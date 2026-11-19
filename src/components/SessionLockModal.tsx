import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, LogOut, Clock, ArrowRight } from 'lucide-react';
import { LockedSessionInfo } from '../services/authService';

interface SessionLockModalProps {
  isOpen: boolean;
  lockedUser: LockedSessionInfo | null;
  onUnlock: (password: string) => Promise<{ success: boolean; message?: string }>;
  onSignOut: () => void;
}

export const SessionLockModal: React.FC<SessionLockModalProps> = ({
  isOpen,
  lockedUser,
  onUnlock,
  onSignOut,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !lockedUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMessage('Please enter your password to unlock your session.');
      return;
    }
    setErrorMessage(null);
    setIsUnlocking(true);
    try {
      const res = await onUnlock(password);
      if (res.success) {
        setPassword('');
        setShowPassword(false);
      } else {
        setErrorMessage(res.message || 'Invalid password. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to verify credentials.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSignOutClick = () => {
    setPassword('');
    setErrorMessage(null);
    onSignOut();
  };

  return (
    <div
      id="session-autolock-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
      className="fixed inset-0 z-[95] bg-[#3B2311]/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[#FBF6E8] rounded-[20px] max-w-md w-full shadow-2xl border-2 border-[#C6BA96] overflow-hidden">
        {/* Top Accent Banner */}
        <div className="bg-gradient-to-r from-[#343B14] via-[#4B5420] to-[#3F471A] px-6 py-5 text-[#FAF6EA] text-center border-b-2 border-[#DFD2A6]">
          <div className="w-14 h-14 rounded-2xl bg-[#343B14]/75 border border-[#DFD2A6] flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Lock size={25} className="text-[#DFD2A6]" />
          </div>
          <h2 id="session-lock-title" className="text-lg font-black tracking-tight">
            Session Auto-Locked
          </h2>
          <p className="text-[11px] text-[#DFD2A6] mt-1 font-semibold inline-flex items-center justify-center gap-1.5">
            <Clock size={12} />
            <span>15-Minute Inactivity Timeout Reached</span>
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Locked User Card */}
          <div className="p-3.5 rounded-xl bg-[#F4ECD2] border border-[#C6BA96] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4B5420] to-[#343B14] text-[#FAF6EA] border border-[#DFD2A6] font-black flex items-center justify-center text-sm shrink-0">
              {lockedUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#3B2311] truncate">{lockedUser.displayName}</p>
              <p className="text-[11px] text-[#5B4735] truncate">
                @{lockedUser.username}
                {lockedUser.employeeCode ? ` · ${lockedUser.employeeCode}` : ''}
                {lockedUser.role ? ` · ${lockedUser.role}` : ''}
              </p>
            </div>
          </div>

          <p className="text-xs text-[#5B4735] leading-relaxed">
            Your SQC portal session was automatically locked after 15 minutes of inactivity. Enter your password to unlock and resume where you left off.
          </p>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="text-rose-700 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="session-unlock-password-input"
                className="block text-xs font-bold text-[#3B2311] mb-1.5"
              >
                Password
              </label>
              <div className="flex items-center rounded-[10px] border border-[#7E7657] bg-[#FAF6EA] focus-within:bg-[#FFFDF7] focus-within:border-[#4B5420] focus-within:ring-2 focus-within:ring-[#4B5420]/15 transition-colors">
                <div className="pl-3 pr-2 py-2 flex items-center pointer-events-none text-[#4C452C]">
                  <Lock size={15} />
                </div>
                <input
                  id="session-unlock-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password to unlock"
                  className="block w-full py-2 text-xs text-[#3B2311] placeholder:text-[#7B705D] bg-transparent focus:outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 py-2 flex items-center text-[#3E3823] hover:text-[#3B2311] cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              id="session-unlock-submit-btn"
              type="submit"
              disabled={isUnlocking}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-b from-[#555E27] via-[#4A5320] to-[#3F471A] hover:from-[#495121] hover:to-[#353C15] text-[#FAF6EA] text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm border border-[#DFD2A6]/40 transition-all disabled:opacity-60 cursor-pointer"
            >
              {isUnlocking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#FAF6EA] border-t-transparent rounded-full animate-spin" />
                  <span>Unlocking Session...</span>
                </>
              ) : (
                <>
                  <span>Unlock Session</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <button
              id="session-lock-signout-btn"
              type="button"
              onClick={handleSignOutClick}
              disabled={isUnlocking}
              className="w-full py-2 px-4 rounded-xl border border-[#C6BA96] bg-[#F4ECD2] hover:bg-[#E3DAB6] text-[#4C5324] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <LogOut size={13} />
              <span>Sign Out &amp; Switch Account</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
