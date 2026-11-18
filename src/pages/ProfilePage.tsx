import React, { useState } from 'react';
import {
  User,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
  KeyRound,
  Layers,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MODULE_DEFINITIONS } from '../types';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const ProfilePage: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    permittedModules,
    permittedForms,
    updateOwnProfile,
    changeOwnPassword,
  } = useAuth();

  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    if (!displayName.trim()) {
      setProfileNotice({ type: 'error', text: 'Display name is required.' });
      return;
    }

    setProfileSaving(true);
    try {
      const res = await updateOwnProfile(displayName.trim(), phone.trim());
      setProfileNotice(
        res.success
          ? { type: 'success', text: 'Your profile details have been updated.' }
          : { type: 'error', text: res.message || 'Failed to update profile.' }
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);

    if (!currentPassword) {
      setPasswordNotice({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordNotice({
        type: 'error',
        text: 'New password must be at least 6 characters long.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await changeOwnPassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordNotice({
          type: 'success',
          text: res.message || 'Password updated cleanly. Old sessions have been invalidated.',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordNotice({
          type: 'error',
          text: res.message || 'Failed to change password.',
        });
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const scopeLabel = isAdmin
    ? 'ALL — Administrator Full Access'
    : currentUser.dataScope === 'ALL'
    ? 'ALL — All Mill Departments (Granted by Admin)'
    : currentUser.dataScope === 'DEPARTMENT'
    ? `DEPARTMENT — ${currentUser.departmentName || 'Assigned Department'}`
    : 'OWN — Own Records Only (Default)';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-[#FBF6E8] rounded-xl p-5 border border-[#C6BA96] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4B5420] to-[#4C5324] text-[#FBF6E8] border-2 border-[#DFD2A6] flex items-center justify-center font-black text-lg shadow-xs shrink-0">
            {currentUser.displayName?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#3B2311] flex items-center gap-2 flex-wrap">
              <span>My Profile &amp; Account Security</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#E3DAB6] text-[#4C5324] border border-[#C6BA96]">
                {currentUser.role}
              </span>
            </h2>
            <p className="text-xs text-[#5B4735] mt-0.5">
              Update your permitted contact details and rotate your own account password securely.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Profile Details */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-[#FBF6E8] rounded-xl border border-[#C6BA96] shadow-xs p-5 space-y-4"
        >
          <h3 className="text-xs font-bold text-[#4C5324] uppercase tracking-wider border-b border-[#D7CBB0] pb-2 flex items-center gap-2">
            <User size={15} className="text-[#4B5420]" />
            <span>Personal Profile Details</span>
          </h3>

          {profileNotice && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 font-medium border ${
                profileNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {profileNotice.type === 'success' ? (
                <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="text-rose-700 shrink-0" />
              )}
              <span>{profileNotice.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#4C5324] mb-1">Username</label>
              <input
                type="text"
                readOnly
                value={currentUser.username || '—'}
                className="w-full bg-[#F4ECD2] border border-[#C6BA96] rounded-lg p-2 font-mono text-[#5B4735]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#4C5324] mb-1">Employee Code</label>
              <input
                type="text"
                readOnly
                value={currentUser.employeeCode || '—'}
                className="w-full bg-[#F4ECD2] border border-[#C6BA96] rounded-lg p-2 font-mono text-[#5B4735]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#4C5324] mb-1">Email Address</label>
              <input
                type="text"
                readOnly
                value={currentUser.email || '—'}
                className="w-full bg-[#F4ECD2] border border-[#C6BA96] rounded-lg p-2 text-[#5B4735]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#4C5324] mb-1">Assigned Role</label>
              <input
                type="text"
                readOnly
                value={currentUser.role}
                className="w-full bg-[#F4ECD2] border border-[#C6BA96] rounded-lg p-2 font-semibold text-[#5B4735]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#4C5324] mb-1">Department</label>
              <input
                type="text"
                readOnly
                value={currentUser.departmentName || 'Not Assigned'}
                className="w-full bg-[#F4ECD2] border border-[#C6BA96] rounded-lg p-2 text-[#5B4735]"
              />
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-[#D7CBB0]">
              <label className="block font-bold text-[#4C5324] mb-1">
                Display Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="profile-display-name-input"
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-[#FBF6E8] border border-[#C6BA96] rounded-lg p-2 font-semibold text-[#3B2311]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-[#4C5324] mb-1">Phone / Contact</label>
              <input
                id="profile-phone-input"
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +91 98XXXXXXXX"
                className="w-full bg-[#FBF6E8] border border-[#C6BA96] rounded-lg p-2 text-[#3B2311]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#D7CBB0]">
            <button
              id="profile-save-btn"
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 bg-gradient-to-r from-[#4B5420] to-[#3F471A] hover:from-[#3F471A] hover:to-[#343B14] text-[#FBF6E8] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs border border-[#DFD2A6]/40 disabled:opacity-60 cursor-pointer"
            >
              <Save size={14} />
              <span>{profileSaving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>

        {/* Card 2: Change Own Password */}
        <form
          onSubmit={handleChangePassword}
          className="bg-[#FBF6E8] rounded-xl border border-[#C6BA96] shadow-xs p-5 space-y-4"
        >
          <h3 className="text-xs font-bold text-[#4C5324] uppercase tracking-wider border-b border-[#D7CBB0] pb-2 flex items-center gap-2">
            <KeyRound size={15} className="text-[#4B5420]" />
            <span>Change Your Own Password</span>
          </h3>

          <p className="text-[11px] text-[#5B4735] leading-relaxed">
            Your existing password is never stored or displayed in readable form. Enter your current password to verify your identity before setting a new password.
          </p>

          {passwordNotice && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 font-medium border ${
                passwordNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {passwordNotice.type === 'success' ? (
                <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="text-rose-700 shrink-0" />
              )}
              <span>{passwordNotice.text}</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[#4C5324] mb-1">
                Current Password <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="profile-current-password"
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full bg-[#F5EEDB] focus:bg-white border border-[#C6BA96] rounded-lg p-2 pr-9 text-[#3B2311]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-2.5 top-2 text-[#5B4735] cursor-pointer"
                  aria-label="Toggle current password visibility"
                >
                  {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#4C5324] mb-1">
                New Password <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="profile-new-password"
                  type={showNewPw ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-[#F5EEDB] focus:bg-white border border-[#C6BA96] rounded-lg p-2 pr-9 text-[#3B2311]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-2.5 top-2 text-[#5B4735] cursor-pointer"
                  aria-label="Toggle new password visibility"
                >
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#4C5324] mb-1">
                Confirm New Password <span className="text-rose-600">*</span>
              </label>
              <input
                id="profile-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-[#F5EEDB] focus:bg-white border border-[#C6BA96] rounded-lg p-2 text-[#3B2311]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#D7CBB0]">
            <button
              id="profile-change-password-btn"
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 bg-[#4B5420] hover:bg-[#3F471A] text-[#FBF6E8] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <Lock size={14} />
              <span>{passwordSaving ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Card 3: Assigned Permissions & Data Scope Overview */}
      <div className="bg-[#FBF6E8] rounded-xl border border-[#C6BA96] shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#D7CBB0] pb-2">
          <h3 className="text-xs font-bold text-[#4C5324] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={15} className="text-[#4B5420]" />
            <span>Assigned Access &amp; Data Scope (Admin Controlled)</span>
          </h3>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-[#E3DAB6] text-[#4C5324] border border-[#C6BA96]">
            Data Scope: {scopeLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Permitted Modules */}
          <div className="space-y-2">
            <div className="font-bold text-[#3B2311] flex items-center gap-1.5">
              <Layers size={14} className="text-[#4B5420]" />
              <span>Permitted Modules ({permittedModules.length})</span>
            </div>
            {permittedModules.length === 0 ? (
              <p className="p-3 rounded-lg bg-[#F5EEDB] border border-[#C6BA96] text-[#5B4735]">
                No modules assigned yet. Contact an Administrator to request module permissions.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {permittedModules.map(modId => {
                  const def = MODULE_DEFINITIONS.find(m => m.id === modId);
                  return (
                    <span
                      key={modId}
                      className="px-2.5 py-1 rounded-md bg-[#E3DAB6] text-[#4C5324] border border-[#C6BA96] font-bold text-[11px]"
                    >
                      {def?.label || modId}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Permitted Forms */}
          <div className="space-y-2">
            <div className="font-bold text-[#3B2311] flex items-center gap-1.5">
              <FileText size={14} className="text-[#4B5420]" />
              <span>Permitted Inspection Forms ({permittedForms.length})</span>
            </div>
            {permittedForms.length === 0 ? (
              <p className="p-3 rounded-lg bg-[#F5EEDB] border border-[#C6BA96] text-[#5B4735]">
                No quality forms granted. Ask an Administrator to assign specific forms.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {permittedForms.map(fCode => {
                  const meta = FORM_REGISTRY[fCode];
                  return (
                    <span
                      key={fCode}
                      className="px-2 py-0.5 rounded bg-[#F5EEDB] border border-[#C6BA96] font-mono text-[10px] font-bold text-[#4B5420]"
                      title={meta?.title || fCode}
                    >
                      {fCode}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
