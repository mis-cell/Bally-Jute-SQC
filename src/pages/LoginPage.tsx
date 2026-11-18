import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import juteMillBackdrop from '../assets/images/jute_mill_backdrop_1795004931867.jpg';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, maintenanceStatus, showMaintenanceModal } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backdropLoaded, setBackdropLoaded] = useState(true);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await login(identifier, password);
      if (res.success) {
        navigate(from, { replace: true });
      } else {
        setErrorMessage(res.message || 'Login failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#EFE6D2] flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      {/* Natural Jute Burlap, Yarn Spools & Heritage Jute Mill Backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        {backdropLoaded ? (
          <img
            src={juteMillBackdrop}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBackdropLoaded(false)}
            className="h-full w-full object-cover object-center select-none"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_50%_35%,#FBF6E8_0%,#EFE3C6_55%,#DFCFA9_100%)]" />
        )}
        {/* Subtle warm center luminance veil so header & card stay crisp on every screen ratio */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(253,249,238,0.45)_0%,rgba(253,249,238,0.12)_50%,rgba(235,222,192,0.08)_100%)]" />
      </div>

      {/* Centered Brand Header + Login Card */}
      <div className="relative z-10 w-full max-w-[465px] flex flex-col items-center">
        {/* Shield Badge */}
        <div className="inline-flex items-center justify-center w-[68px] h-[68px] rounded-[18px] bg-gradient-to-b from-[#4F5822] via-[#41491A] to-[#343B14] border-[2px] border-[#DFD2A6] shadow-[0_8px_20px_rgba(60,44,18,0.22)]">
          <ShieldCheck className="w-9 h-9 text-[#FAF6EA]" strokeWidth={2.2} />
        </div>

        {/* Brand Wordmark & Subtitle */}
        <h1 className="mt-2.5 text-[42px] leading-none font-black tracking-tight text-[#3B2311]">
          SQC
        </h1>
        <p className="mt-1.5 text-[11px] sm:text-[12px] font-semibold text-[#4B2E18] tracking-[0.04em] uppercase text-center">
          Quality Control &amp; Statistical Process Management
        </p>

        {/* Olive Spool Ornamental Divider */}
        <div className="mt-2.5 mb-5 flex items-center justify-center gap-3 w-full max-w-[330px]" aria-hidden="true">
          <div className="h-[1.5px] flex-1 bg-gradient-to-l from-[#565E29] via-[#7A814E]/60 to-transparent" />
          <svg
            width="22"
            height="24"
            viewBox="0 0 24 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#4B5420] shrink-0"
          >
            <rect x="4" y="2" width="16" height="3.2" rx="1" stroke="currentColor" strokeWidth="1.7" />
            <rect x="4" y="20.8" width="16" height="3.2" rx="1" stroke="currentColor" strokeWidth="1.7" />
            <path d="M6.5 5.2V20.8M17.5 5.2V20.8" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M6.5 8.5L17.5 11.5M6.5 12L17.5 15M6.5 15.5L17.5 18.5M17.5 8.5L6.5 11.5M17.5 12L6.5 15M17.5 15.5L6.5 18.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
          <div className="h-[1.5px] flex-1 bg-gradient-to-r from-[#565E29] via-[#7A814E]/60 to-transparent" />
        </div>

        {/* Sign In Card */}
        <div className="w-full bg-[#FBF6E8]/96 backdrop-blur-[2px] rounded-[20px] border border-[#C6BA96] shadow-[0_18px_42px_rgba(62,42,18,0.18)] px-6 py-6 sm:px-9 sm:py-7">
          {/* Card Header */}
          <div className="pb-4 mb-5 border-b border-[#D7CBB0] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[25px] leading-tight font-extrabold text-[#3B2311]">
                Sign In
              </h2>
              <p className="mt-1 text-[12.5px] text-[#5B4735] font-normal">
                Enter your credentials to access SQC floor records
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 pt-1">
              <span className="h-6 w-px bg-[#B7AA86]" aria-hidden="true" />
              <span className="inline-flex items-center px-3.5 py-1 rounded-[10px] bg-[#E3DAB6] text-[#4C5324] text-[12.5px] font-bold whitespace-nowrap shrink-0">
                Mill Portal
              </span>
            </div>
          </div>

          {maintenanceStatus.enabled && (
            <div className="mb-4 p-3 rounded-xl bg-[#F4ECD2] border border-[#CBBF96] text-[#3B2311] text-xs flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2">
                <Wrench size={15} className="text-[#4B5420] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#3B2311]">Maintenance Mode Active</p>
                  <p className="text-[11px] text-[#5B4735] mt-0.5">
                    Only Administrators can sign in right now.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={showMaintenanceModal}
                className="text-[11px] font-bold text-[#4B5420] hover:underline shrink-0 cursor-pointer"
              >
                View Notice
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-700 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier Input */}
            <div>
              <label
                htmlFor="login-identifier-input"
                className="block text-[13px] font-bold text-[#3B2311] mb-1.5"
              >
                Username / Email / Employee Code
              </label>
              <div className="flex items-center rounded-[10px] border border-[#7E7657] bg-[#FAF6EA] focus-within:bg-[#FFFDF7] focus-within:border-[#4B5420] focus-within:ring-2 focus-within:ring-[#4B5420]/15 transition-colors">
                <div className="pl-3.5 pr-2.5 py-2.5 flex items-center gap-2.5 pointer-events-none text-[#4C452C]">
                  <User size={17} strokeWidth={1.8} />
                  <span className="h-5 w-px bg-[#C7BC9C]" aria-hidden="true" />
                </div>
                <input
                  id="login-identifier-input"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="block w-full pr-3 py-2.5 text-[13.5px] text-[#3B2311] placeholder:text-[#7B705D] bg-transparent focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="login-password-input"
                className="block text-[13px] font-bold text-[#3B2311] mb-1.5"
              >
                Password
              </label>
              <div className="flex items-center rounded-[10px] border border-[#7E7657] bg-[#FAF6EA] focus-within:bg-[#FFFDF7] focus-within:border-[#4B5420] focus-within:ring-2 focus-within:ring-[#4B5420]/15 transition-colors">
                <div className="pl-3.5 pr-2.5 py-2.5 flex items-center gap-2.5 pointer-events-none text-[#4C452C]">
                  <Lock size={17} strokeWidth={1.8} />
                  <span className="h-5 w-px bg-[#C7BC9C]" aria-hidden="true" />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full py-2.5 text-[13.5px] text-[#3B2311] placeholder:text-[#7B705D] bg-transparent focus:outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3.5 py-2.5 flex items-center text-[#3E3823] hover:text-[#3B2311] cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <div className="pt-2">
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2.5 py-3 px-5 rounded-[14px] text-[15px] font-bold text-[#FAF6EA] bg-gradient-to-b from-[#555E27] via-[#4A5320] to-[#3F471A] hover:from-[#495121] hover:to-[#353C15] shadow-[0_6px_14px_rgba(63,71,26,0.34)] disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#FAF6EA] border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to SQC</span>
                    <ArrowRight size={17} strokeWidth={2.2} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
