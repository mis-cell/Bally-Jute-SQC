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

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, maintenanceStatus, showMaintenanceModal } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <div className="relative min-h-screen overflow-hidden bg-[#FCF8EE] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Silk Ivory, Sweeping Antique Gold Flourish & Royal Crimson Velvet Draped Backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <svg
          className="h-full w-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="sqcIvoryGlow" cx="38%" cy="22%" r="68%">
              <stop offset="0%" stopColor="#FFFDF9" />
              <stop offset="55%" stopColor="#FAF1DC" />
              <stop offset="100%" stopColor="#EAD4A6" />
            </radialGradient>

            <linearGradient id="sqcCrimsonVelvet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A6121B" />
              <stop offset="45%" stopColor="#8B0A12" />
              <stop offset="82%" stopColor="#63050B" />
              <stop offset="100%" stopColor="#440207" />
            </linearGradient>

            <linearGradient id="sqcVelvetFold" x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor="#B81620" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#72060D" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#3B0205" stopOpacity="0.92" />
            </linearGradient>

            <linearGradient id="sqcAntiqueGold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B4831D" />
              <stop offset="35%" stopColor="#E9C96B" />
              <stop offset="65%" stopColor="#FFF0B8" />
              <stop offset="100%" stopColor="#C9962B" />
            </linearGradient>
          </defs>

          {/* Upper Silk Ivory Expanse */}
          <rect width="1440" height="900" fill="url(#sqcIvoryGlow)" />

          {/* Lower Royal Crimson Velvet Curtain Base */}
          <path
            d="M0,455 C320,565 690,615 1030,520 C1235,462 1365,365 1440,260 L1440,900 L0,900 Z"
            fill="url(#sqcCrimsonVelvet)"
          />

          {/* Velvet Draped Fold Highlights */}
          <path
            d="M0,560 C340,680 780,715 1135,585 C1285,530 1385,445 1440,360 L1440,900 L0,900 Z"
            fill="url(#sqcVelvetFold)"
          />
          <path
            d="M0,715 C420,825 890,825 1440,615 L1440,900 L0,900 Z"
            fill="#3C0206"
            opacity="0.72"
          />

          {/* Sweeping Metallic Antique Gold Ribbons */}
          <path
            d="M0,446 C335,556 710,598 1045,492 C1255,425 1378,290 1440,150"
            fill="none"
            stroke="url(#sqcAntiqueGold)"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.95"
          />
          <path
            d="M25,436 C380,535 760,572 1090,458 C1285,390 1392,262 1440,130"
            fill="none"
            stroke="url(#sqcAntiqueGold)"
            strokeWidth="4.5"
            strokeLinecap="round"
            opacity="0.88"
          />
          <path
            d="M118,452 C470,582 895,622 1225,495 C1330,454 1398,382 1435,315"
            fill="none"
            stroke="url(#sqcAntiqueGold)"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.82"
          />
          {/* Decorative Upper-Right Gold Flourish */}
          <path
            d="M1245,44 C1355,44 1418,125 1375,212 C1338,286 1230,275 1218,200 C1208,136 1272,102 1318,136"
            fill="none"
            stroke="url(#sqcAntiqueGold)"
            strokeWidth="6.5"
            strokeLinecap="round"
            opacity="0.78"
          />
          {/* Decorative Lower-Left Gold Swirl */}
          <path
            d="M350,482 C485,532 545,625 475,672 C428,704 378,662 414,622"
            fill="none"
            stroke="url(#sqcAntiqueGold)"
            strokeWidth="5.5"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* App Title & Branding */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B0A12] via-[#68050B] to-[#4E0308] shadow-lg shadow-[#68050B]/25 mb-3 border-2 border-[#D4AF37]">
          <ShieldCheck className="w-9 h-9 text-[#FFFDF8]" />
        </div>

        <h1 className="text-3xl font-black tracking-tight text-[#2B1114]">SQC</h1>
        <p className="mt-1 text-xs font-semibold text-[#5C080E] tracking-wide uppercase">
          Quality Control &amp; Statistical Process Management
        </p>
      </div>

      <div className="relative z-10 mt-7 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-[#FFFDF8]/95 backdrop-blur-xs py-8 px-6 shadow-2xl rounded-2xl border border-[#DFC378] sm:px-10">
          <div className="mb-6 pb-4 border-b border-[#EFE2C2] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#2B1114]">Sign In</h2>
              <p className="text-xs text-[#6E524B]">
                Enter your credentials to access SQC floor records
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-[#9B6E14] tabular-nums">
              Mill Portal
            </span>
          </div>

          {maintenanceStatus.enabled && (
            <div className="mb-4 p-3 rounded-xl bg-[#FDF5DC] border border-[#DFC378] text-[#2B1114] text-xs flex items-start justify-between gap-2.5 shadow-2xs">
              <div className="flex items-start gap-2">
                <Wrench size={15} className="text-[#9B6E14] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#7A560B]">Maintenance Mode Active</p>
                  <p className="text-[11px] text-[#6E524B] mt-0.5">
                    Only Administrators can sign in right now.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={showMaintenanceModal}
                className="text-[11px] font-bold text-[#8B0A12] hover:underline shrink-0 cursor-pointer"
              >
                View Notice
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle size={16} className="text-rose-700 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5C080E] mb-1">
                Username / Email / Employee Code
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B6D62]">
                  <User size={16} />
                </div>
                <input
                  id="login-identifier-input"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs text-[#2B1114] rounded-lg border border-[#E4D0A3] bg-[#FCF8EE] focus:bg-[#FFFDF8] focus:outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5C080E] mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B6D62]">
                  <Lock size={16} />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-9 pr-10 py-2.5 text-xs text-[#2B1114] rounded-lg border border-[#E4D0A3] bg-[#FCF8EE] focus:bg-[#FFFDF8] focus:outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8B6D62] hover:text-[#5C080E] cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-xs font-bold text-[#FFFDF8] bg-gradient-to-r from-[#8B0A12] via-[#75070E] to-[#5C080E] hover:from-[#68050B] hover:to-[#4E0308] border border-[#D4AF37]/50 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#FFFDF8] border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to SQC</span>
                    <ArrowRight size={14} />
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
