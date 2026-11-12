import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Building2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, refreshUsers } = useAuth();

  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('Admin@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Setup / First-Time Admin Modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupSuccess, setSetupSuccess] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

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

  const handleQuickFill = (user: string, pass: string) => {
    setIdentifier(user);
    setPassword(pass);
    setErrorMessage(null);
  };

  const handleInitializeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    setSetupSuccess(null);

    if (!setupPassword || setupPassword.length < 6) {
      setSetupError('Password must be at least 6 characters long.');
      return;
    }

    if (setupPassword !== setupConfirm) {
      setSetupError('Passwords do not match.');
      return;
    }

    try {
      await authService.initializeAdmin(setupPassword);
      refreshUsers();
      setSetupSuccess('Administrator account initialized successfully! You can now log in.');
      setPassword(setupPassword);
      setIdentifier('admin');
      setTimeout(() => {
        setShowSetupModal(false);
        setSetupSuccess(null);
      }, 1800);
    } catch (err: any) {
      setSetupError(err.message || 'Failed to initialize administrator.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF9F9] via-[#FCE7E6] to-[#FFF4F3] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* App Title & Branding */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#D95F68] to-[#E87578] shadow-lg shadow-[#D95F68]/20 mb-3 border border-white">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-3xl font-black tracking-tight text-[#393334]">
          SQC
        </h1>
        <p className="mt-1 text-xs font-semibold text-[#806B6C] tracking-wide uppercase">
          Quality Control & Statistical Process Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-[#F4C4C5] sm:px-10">
          <div className="mb-6 pb-4 border-b border-[#F4C4C5] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#393334]">Sign In</h2>
              <p className="text-xs text-[#806B6C]">Enter your credentials to access SQC floor records</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FCE7E6] text-[#D95F68] border border-[#F4C4C5]">
              v2.8
            </span>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#574448] mb-1">
                Username / Email / Employee Code
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#806B6C]">
                  <User size={16} />
                </div>
                <input
                  id="login-identifier-input"
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="admin or email@domain.com"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs text-[#393334] rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D95F68] focus:border-transparent font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#574448] mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#806B6C]">
                  <Lock size={16} />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-10 py-2.5 text-xs text-[#393334] rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D95F68] focus:border-transparent font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#806B6C] hover:text-[#393334]"
                  tabIndex={-1}
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
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-xs font-bold text-white bg-gradient-to-r from-[#D95F68] to-[#C94E59] hover:from-[#C94E59] hover:to-[#B5414B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D95F68] disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

      {/* First Time Administrator Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#F4C4C5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#F4C4C5] pb-3">
              <div className="flex items-center gap-2 text-[#393334]">
                <KeyRound size={18} className="text-[#D95F68]" />
                <h3 className="font-bold text-sm">Configure Administrator Account</h3>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#806B6C] leading-relaxed">
              Define the master administrator password for the initial setup. Passwords are stored securely as cryptographic hashes with unique salts.
            </p>

            {setupError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-600 shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            {setupSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>{setupSuccess}</span>
              </div>
            )}

            <form onSubmit={handleInitializeAdmin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#574448] mb-1">
                  New Administrator Password
                </label>
                <input
                  type="password"
                  required
                  value={setupPassword}
                  onChange={e => setSetupPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full text-xs p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#574448] mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={setupConfirm}
                  onChange={e => setSetupConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full text-xs p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#D95F68] hover:bg-[#C94E59] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Administrator Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
