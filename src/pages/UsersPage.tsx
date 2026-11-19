import React, { useState } from 'react';
import {
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Search,
  Lock,
  FileText,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  KeyRound,
  Layers,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { useRealtimeData } from '../hooks/useRealtimeSync';
import {
  ALL_MODULES,
  AppModule,
  DataScope,
  GRANTABLE_MODULES,
  MODULE_DEFINITIONS,
  UserProfile,
  UserRole,
} from '../types';
import { FORM_REGISTRY } from '../constants/formsRegistry';

function isAdminUser(role?: string): boolean {
  return role === 'Admin';
}

export const UsersPage: React.FC = () => {
  const { currentUser, saveUser, deleteUser, adminResetUserPassword } = useAuth();
  const users = useRealtimeData(() => dataService.getUsers());
  const departments = useRealtimeData(() => dataService.getDepartments());

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal State for Add / Edit / Reset Password / Delete / View
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [viewPermsCandidate, setViewPermsCandidate] = useState<UserProfile | null>(null);
  const [resetPwCandidate, setResetPwCandidate] = useState<UserProfile | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwShow, setResetPwShow] = useState(false);
  const [resetPwError, setResetPwError] = useState('');
  const [resetPwBusy, setResetPwBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ isError: boolean; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState<UserProfile>({
    id: '',
    employeeCode: '',
    displayName: '',
    username: '',
    email: '',
    phone: '',
    role: 'SQC Inspector / User',
    departmentId: '',
    departmentName: '',
    isActive: true,
    canEditEntries: false,
    canDeleteEntries: false,
    permittedModules: [],
    permittedForms: [],
    dataScope: 'OWN',
    createdAt: new Date().toISOString(),
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [changePasswordToggle, setChangePasswordToggle] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const roles: UserRole[] = [
    'Admin',
    'HOD / Approver',
    'SQC Inspector / User',
    'Viewer / Auditor',
  ];

  const allFormCodes = Object.keys(FORM_REGISTRY);

  const formGroups = [
    { title: 'Raw Fiber & Spreader', forms: ['FORM-01', 'FORM-02', 'FORM-03', 'FORM-04', 'FORM-05'] },
    { title: 'Carding & Drawing', forms: ['FORM-06', 'FORM-07', 'FORM-08', 'FORM-09', 'FORM-37'] },
    { title: 'Spinning & Winding', forms: ['FORM-10', 'FORM-11', 'FORM-12'] },
    { title: 'Beaming & Weaving', forms: ['FORM-13', 'FORM-14', 'FORM-15', 'FORM-16'] },
    { title: 'Finishing & Cutting', forms: ['FORM-17', 'FORM-18', 'FORM-19', 'FORM-20', 'FORM-21'] },
    { title: 'Godown & Sacksewing', forms: ['FORM-22', 'FORM-23', 'FORM-24'] },
    { title: 'Press & Broad Loom', forms: ['FORM-25', 'FORM-26', 'FORM-27', 'FORM-28'] },
    { title: 'Central Laboratory', forms: ['FORM-29', 'FORM-30', 'FORM-31', 'FORM-32', 'FORM-33', 'FORM-34'] },
    { title: 'Engineering & Study', forms: ['FORM-35', 'FORM-36'] },
  ];

  const handleOpenAdd = () => {
    setIsEditing(false);
    const defaultDept = departments[0];
    setFormData({
      id: `u-${Date.now()}`,
      employeeCode: `BJ-${Math.floor(100 + Math.random() * 900)}`,
      displayName: '',
      username: '',
      email: '',
      phone: '',
      role: 'SQC Inspector / User',
      departmentId: defaultDept?.id || '',
      departmentName: defaultDept?.name || 'Selection',
      isActive: true,
      canEditEntries: false,
      canDeleteEntries: false,
      permittedModules: [],
      permittedForms: [],
      dataScope: 'OWN',
      createdAt: new Date().toISOString(),
    });
    setPasswordInput('');
    setChangePasswordToggle(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setIsEditing(true);
    const adminUser = isAdminUser(user.role);
    setFormData({
      ...user,
      canEditEntries: adminUser ? true : Boolean(user.canEditEntries),
      canDeleteEntries: adminUser ? true : Boolean(user.canDeleteEntries),
      permittedModules: adminUser
        ? [...ALL_MODULES]
        : Array.isArray(user.permittedModules)
        ? [...user.permittedModules]
        : [],
      permittedForms: Array.isArray(user.permittedForms) ? [...user.permittedForms] : [],
      dataScope: adminUser ? 'ALL' : user.dataScope || 'OWN',
    });
    setPasswordInput('');
    setChangePasswordToggle(false);
    setFormError('');
    setIsModalOpen(true);
  };

  const toggleModulePermission = (modCode: AppModule) => {
    setFormData(prev => {
      const current = prev.permittedModules || [];
      const next = current.includes(modCode)
        ? current.filter(m => m !== modCode)
        : [...current, modCode];
      return { ...prev, permittedModules: next };
    });
  };

  const toggleFormPermission = (formCode: string) => {
    setFormData(prev => {
      const current = prev.permittedForms || [];
      const next = current.includes(formCode)
        ? current.filter(c => c !== formCode)
        : [...current, formCode];
      return { ...prev, permittedForms: next };
    });
  };

  const handleSelectAllForms = () => {
    setFormData(prev => ({
      ...prev,
      permittedForms: [...allFormCodes],
    }));
  };

  const handleClearAllForms = () => {
    setFormData(prev => ({
      ...prev,
      permittedForms: [],
    }));
  };

  const handleSelectGroupForms = (groupForms: string[]) => {
    setFormData(prev => {
      const current = prev.permittedForms || [];
      const allSelected = groupForms.every(f => current.includes(f));
      const next = allSelected
        ? current.filter(f => !groupForms.includes(f))
        : Array.from(new Set([...current, ...groupForms]));
      return { ...prev, permittedForms: next };
    });
  };

  const handleQuickToggleEntryPrivilege = async (
    user: UserProfile,
    field: 'canEditEntries' | 'canDeleteEntries'
  ) => {
    if (isAdminUser(user.role)) return;
    setTogglingId(`${user.id}-${field}`);
    try {
      const updatedUser: UserProfile = {
        ...user,
        [field]: !user[field],
      };
      const res = await saveUser(updatedUser);
      if (res.success) {
        const label = field === 'canEditEntries' ? 'Edit Entries' : 'Delete Entries';
        setStatusNotice({
          isError: false,
          message: `${label} ${updatedUser[field] ? 'activated' : 'deactivated'} for "${user.displayName}".`,
        });
      } else {
        setStatusNotice({
          isError: true,
          message: res.message || 'Failed to update entry permission.',
        });
      }
      setTimeout(() => setStatusNotice(null), 4000);
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.displayName.trim()) {
      setFormError('Display Name is required.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('A valid Email address is required.');
      return;
    }
    if (!formData.employeeCode?.trim()) {
      setFormError('Employee Code is required.');
      return;
    }

    if (!isEditing || changePasswordToggle) {
      if (!passwordInput || passwordInput.length < 6) {
        setFormError('Password must be at least 6 characters long.');
        return;
      }
    }

    const adminRole = isAdminUser(formData.role);
    const sanitizedModules = adminRole
      ? [...ALL_MODULES]
      : (formData.permittedModules || []).filter((m): m is AppModule =>
          GRANTABLE_MODULES.includes(m)
        );
    const sanitizedForms = adminRole ? [...allFormCodes] : formData.permittedForms || [];
    const sanitizedScope: DataScope = adminRole ? 'ALL' : formData.dataScope || 'OWN';

    const userToSave: UserProfile = {
      ...formData,
      canEditEntries: adminRole ? true : Boolean(formData.canEditEntries),
      canDeleteEntries: adminRole ? true : Boolean(formData.canDeleteEntries),
      permittedModules: sanitizedModules,
      permittedForms: sanitizedForms,
      dataScope: sanitizedScope,
      username: (formData.username || formData.email.split('@')[0] || formData.employeeCode)
        .trim()
        .toLowerCase(),
    };

    setIsSavingUser(true);
    try {
      const res = await saveUser(userToSave, changePasswordToggle ? passwordInput : undefined);
      if (res.success) {
        setIsModalOpen(false);
        setStatusNotice({
          isError: false,
          message: `User "${userToSave.displayName}" saved. Changes take effect immediately on next request.`,
        });
        setTimeout(() => setStatusNotice(null), 5000);
      } else {
        setFormError(res.message || 'Failed to save user.');
      }
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate || isDeletingUser) return;
    if (deleteCandidate.id === currentUser.id) {
      setStatusNotice({ isError: true, message: 'You cannot delete your own active Administrator account.' });
      setDeleteCandidate(null);
      return;
    }

    setIsDeletingUser(true);
    try {
      const res = await deleteUser(deleteCandidate.id);
      if (res.success) {
        setStatusNotice({ isError: false, message: `User "${deleteCandidate.displayName}" deleted.` });
      } else {
        setStatusNotice({ isError: true, message: res.message || 'Failed to delete user.' });
      }
      setTimeout(() => setStatusNotice(null), 5000);
      setDeleteCandidate(null);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwCandidate) return;
    setResetPwError('');
    if (!resetPwValue || resetPwValue.length < 6) {
      setResetPwError('New password must be at least 6 characters long.');
      return;
    }
    setResetPwBusy(true);
    try {
      const res = await adminResetUserPassword(resetPwCandidate.id, resetPwValue);
      if (res.success) {
        setStatusNotice({
          isError: false,
          message: `Password reset for "${resetPwCandidate.displayName}". All prior sessions for this user have been invalidated.`,
        });
        setTimeout(() => setStatusNotice(null), 5000);
        setResetPwCandidate(null);
        setResetPwValue('');
      } else {
        setResetPwError(res.message || 'Failed to reset user password.');
      }
    } finally {
      setResetPwBusy(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.employeeCode && u.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.departmentName && u.departmentName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const modalIsAdmin = isAdminUser(formData.role);
  const modalHasInspections = modalIsAdmin || (formData.permittedModules || []).includes('INSPECTIONS');

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-[#FFFFFF] rounded-xl p-4 border border-[#F5D0CB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#393334] flex items-center gap-2">
            <Users size={18} className="text-[#EA5551]" />
            <span>Users, Module Access, Data Scope &amp; Form Permissions</span>
          </h2>
          <p className="text-xs text-[#806B68] mt-0.5">
            Admin-only control: assign roles, grant/revoke per-module access, restrict record scope, and manage passwords
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-add-new-user"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-gradient-to-r from-[#EA5551] to-[#D46764] hover:from-[#D46764] hover:to-[#EA5551] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-sm border border-[#FFE0DA]/40 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Add New User</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs border ${
            statusNotice.isError
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <span>{statusNotice.message}</span>
          <button onClick={() => setStatusNotice(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Role explanation summary (4 standard roles — Admin is the sole privileged role) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-[#FFFFFF] p-3 rounded-lg border border-[#F5D0CB]">
          <span className="font-bold text-[#EA5551] block">Admin (Sole Privileged Role)</span>
          <p className="text-[11px] text-[#806B68] mt-1">
            Full access to all modules, users, permissions, audit trail, settings, and mill records
          </p>
        </div>
        <div className="bg-[#FFFFFF] p-3 rounded-lg border border-[#F5D0CB]">
          <span className="font-bold text-[#393334] block">HOD / Approver</span>
          <p className="text-[11px] text-[#806B68] mt-1">
            Standard account: only opens granted modules (e.g. Approvals) within assigned data scope
          </p>
        </div>
        <div className="bg-[#FFFFFF] p-3 rounded-lg border border-[#F5D0CB]">
          <span className="font-bold text-[#393334] block">SQC Inspector / User</span>
          <p className="text-[11px] text-[#806B68] mt-1">
            Standard account: zero access until Admin grants specific modules, forms, and scope
          </p>
        </div>
        <div className="bg-[#FFFFFF] p-3 rounded-lg border border-[#F5D0CB]">
          <span className="font-bold text-[#393334] block">Viewer / Auditor</span>
          <p className="text-[11px] text-[#806B68] mt-1">
            Read-only account restricted strictly to granted Dashboard/Reports modules and data scope
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFFFF] rounded-xl p-3 border border-[#F5D0CB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search by name, username, email, code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white focus:outline-none text-[#393334]"
          />
          <Search size={14} className="absolute left-2.5 top-2 text-[#806B68]" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#806B68] font-semibold">Filter Role:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs bg-[#FFF8F6] border border-[#F5D0CB] rounded-lg px-2.5 py-1.5 font-medium text-[#393334]"
          >
            <option value="ALL">All Roles ({users.length})</option>
            {roles.map(r => (
              <option key={r} value={r}>
                {r} ({users.filter(u => u.role === r).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#FFFFFF] rounded-xl border border-[#F5D0CB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-bold">
                <th className="py-3 px-4">User &amp; Employee Code</th>
                <th className="py-3 px-4">Username &amp; Email</th>
                <th className="py-3 px-4">Role &amp; Dept</th>
                <th className="py-3 px-4">Modules &amp; Scope</th>
                <th className="py-3 px-4">Permitted Forms</th>
                <th className="py-3 px-4">Entry Edit / Delete</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#806B68]">
                    No users match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isUserAdmin = isAdminUser(user.role);
                  const modCount = isUserAdmin ? ALL_MODULES.length : (user.permittedModules?.length || 0);
                  const formCount = isUserAdmin ? allFormCodes.length : (user.permittedForms?.length || 0);
                  const scope = isUserAdmin ? 'ALL' : user.dataScope || 'OWN';
                  const canEditEntries = isUserAdmin || Boolean(user.canEditEntries);
                  const canDeleteEntries = isUserAdmin || Boolean(user.canDeleteEntries);

                  return (
                    <tr key={user.id} className="hover:bg-[#FFEAE6]/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EA5551] to-[#EA5551] text-[#FFFFFF] font-bold flex items-center justify-center text-xs shrink-0 border border-[#FFE0DA]/60 shadow-2xs">
                            {user.displayName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-[#393334]">{user.displayName}</div>
                            <div className="font-mono text-[10px] text-[#806B68] font-semibold">
                              ID: {user.employeeCode || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#EA5551]">
                          {user.username || user.email.split('@')[0]}
                        </div>
                        <div className="text-[11px] text-[#806B68]">{user.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isUserAdmin
                              ? 'bg-[#EA5551] text-[#FFFFFF] border-[#FFE0DA]'
                              : user.role === 'HOD / Approver'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              : 'bg-[#FFFFFF] text-[#EA5551] border-[#F5D0CB]'
                          }`}
                        >
                          {user.role}
                        </span>
                        <div className="text-[11px] text-[#806B68] mt-1">
                          {user.departmentName || 'Unassigned Dept'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#393334]">
                            <Layers size={12} className="text-[#EA5551]" />
                            {isUserAdmin ? 'All 8 Modules (Admin)' : `${modCount} Module(s)`}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#EA5551]">
                            <Database size={11} />
                            Scope: {scope}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setViewPermsCandidate(user)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer border ${
                            isUserAdmin
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                              : formCount > 0
                              ? 'bg-[#FFFFFF] text-[#EA5551] border-[#F5D0CB] hover:bg-[#FFFFFF]'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                          title="Click to inspect modules & forms"
                        >
                          <FileText size={12} />
                          <span>{isUserAdmin ? 'All Forms (Admin)' : `${formCount} Forms`}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 size={11} /> Enabled (Admin)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              disabled={togglingId === `${user.id}-canEditEntries`}
                              onClick={() => handleQuickToggleEntryPrivilege(user, 'canEditEntries')}
                              className={`px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                                canEditEntries
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-[#FFF8F6] text-[#806B68] border-[#F5D0CB] hover:bg-[#FFF1EE]'
                              }`}
                              title="Activate or deactivate Edit Saved Entries permission"
                            >
                              {canEditEntries ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              <span>Edit: {canEditEntries ? 'ON' : 'OFF'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={togglingId === `${user.id}-canDeleteEntries`}
                              onClick={() => handleQuickToggleEntryPrivilege(user, 'canDeleteEntries')}
                              className={`px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                                canDeleteEntries
                                  ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                  : 'bg-[#FFF8F6] text-[#806B68] border-[#F5D0CB] hover:bg-[#FFF1EE]'
                              }`}
                              title="Activate or deactivate Delete Saved Entries permission"
                            >
                              {canDeleteEntries ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              <span>Delete: {canDeleteEntries ? 'ON' : 'OFF'}</span>
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            user.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-[#806B68] hover:text-[#EA5551] hover:bg-[#FFFFFF] rounded-md transition-colors cursor-pointer"
                            title="Edit User & Permissions"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResetPwCandidate(user);
                              setResetPwValue('');
                              setResetPwShow(false);
                              setResetPwError('');
                            }}
                            className="p-1.5 text-[#806B68] hover:text-[#EA5551] hover:bg-[#FFFFFF] rounded-md transition-colors cursor-pointer"
                            title="Reset User Password"
                          >
                            <KeyRound size={14} />
                          </button>

                          {user.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => setDeleteCandidate(user)}
                              className="p-1.5 text-[#806B68] hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#393334]/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#F5D0CB] my-8 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F5D0CB] pb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#EA5551]" />
                <h3 className="font-bold text-sm text-[#393334]">
                  {isEditing ? `Edit User: ${formData.displayName}` : 'Create New SQC User'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#806B68] hover:text-[#393334] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#EA5551] mb-1">
                    Full Display Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g. Rajesh Ghosh"
                    className="w-full p-2 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white text-[#393334]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#EA5551] mb-1">
                    Employee Code / ID <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode || ''}
                    onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                    placeholder="e.g. BJ-311"
                    className="w-full p-2 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white text-[#393334]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#EA5551] mb-1">
                    Username / Login Handle
                  </label>
                  <input
                    type="text"
                    value={formData.username || ''}
                    onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                    placeholder="e.g. rajesh"
                    className="w-full p-2 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white font-mono text-[#393334]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#EA5551] mb-1">
                    Email Address <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@ballyjute.com"
                    className="w-full p-2 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white text-[#393334]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#EA5551] mb-1">
                    System Role <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full p-2 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white font-semibold text-[#393334]"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#EA5551] mb-1">
                    Assigned Department
                  </label>
                  <select
                    value={formData.departmentName || ''}
                    onChange={e => {
                      const dept = departments.find(d => d.name === e.target.value);
                      setFormData({
                        ...formData,
                        departmentName: e.target.value,
                        departmentId: dept?.id || '',
                      });
                    }}
                    className="w-full p-2 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white text-[#393334]"
                  >
                    <option value="">All Departments / General</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password Management (New password entry only — never reads or displays existing password) */}
              <div className="p-3 rounded-xl bg-[#FFF8F6] border border-[#F5D0CB] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#EA5551]">
                    <Lock size={14} className="text-[#EA5551]" />
                    <span>Account Password</span>
                  </div>
                  {isEditing && (
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#806B68] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={changePasswordToggle}
                        onChange={e => setChangePasswordToggle(e.target.checked)}
                      />
                      <span>Set New Password (Reset)</span>
                    </label>
                  )}
                </div>

                {(!isEditing || changePasswordToggle) && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="Enter password (min 6 characters)"
                      className="w-full p-2 pr-9 text-xs rounded-lg border border-[#F5D0CB] bg-white font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-[#806B68] cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <p className="text-[10px] text-[#806B68] mt-1">
                      Passwords are hashed with random per-user cryptographic salts. Existing passwords are never visible.
                    </p>
                  </div>
                )}
              </div>

              {/* Module Permissions Section */}
              <div className="p-3.5 rounded-xl bg-[#FFF8F6] border border-[#F5D0CB] space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-[#EA5551] flex items-center gap-1.5">
                      <Layers size={14} className="text-[#EA5551]" />
                      <span>Module Access Permissions</span>
                    </h4>
                    <p className="text-[11px] text-[#806B68]">
                      {modalIsAdmin
                        ? 'Admin role automatically includes all operational and administration modules.'
                        : 'Grant only the specific modules this user may access. Unassigned modules are hidden and blocked.'}
                    </p>
                  </div>
                  {!modalIsAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData(prev => ({ ...prev, permittedModules: [...GRANTABLE_MODULES] }))
                        }
                        className="px-2 py-1 bg-white hover:bg-[#FFFFFF] text-[#EA5551] border border-[#F5D0CB] rounded text-[11px] font-bold cursor-pointer"
                      >
                        Grant All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, permittedModules: [] }))}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Revoke All
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODULE_DEFINITIONS.map(mod => {
                    const isAdminModule = mod.adminOnly;
                    const isChecked = modalIsAdmin
                      ? true
                      : !isAdminModule && (formData.permittedModules || []).includes(mod.id);
                    const disabled = modalIsAdmin || isAdminModule;

                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                          disabled
                            ? isAdminModule && !modalIsAdmin
                              ? 'bg-[#FFF1EE]/70 border-[#FDE8E4] opacity-70 cursor-not-allowed'
                              : 'bg-emerald-50/70 border-emerald-300 cursor-not-allowed'
                            : isChecked
                            ? 'bg-[#FFFFFF] border-[#EA5551] cursor-pointer'
                            : 'bg-white border-[#F5D0CB] hover:bg-[#FFF1EE] cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={isChecked}
                          onChange={() => !disabled && toggleModulePermission(mod.id)}
                          className="mt-0.5 rounded text-[#EA5551]"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-[#393334] block">
                            {mod.label}
                            {isAdminModule && (
                              <span className="ml-1.5 text-[10px] font-mono text-[#EA5551]">
                                (Admin Only)
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-[#806B68] leading-snug block">
                            {mod.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Explicit Data Scope Selector */}
              <div className="p-3.5 rounded-xl bg-[#FFF1EE] border border-[#F5D0CB] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-[#EA5551] flex items-center gap-1.5">
                    <Database size={14} className="text-[#EA5551]" />
                    <span>Data Visibility Scope Within Assigned Modules</span>
                  </h4>
                  {modalIsAdmin && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                      ALL (Admin)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        value: 'OWN',
                        title: 'Own Records Only (Default)',
                        desc: 'User sees only records they created.',
                      },
                      {
                        value: 'DEPARTMENT',
                        title: 'Assigned Department',
                        desc: 'User sees own records plus records in their assigned department.',
                      },
                      {
                        value: 'ALL',
                        title: 'All Mill Departments',
                        desc: 'Explicit wide access across all departments (for permitted forms/modules).',
                      },
                    ] as Array<{ value: DataScope; title: string; desc: string }>
                  ).map(opt => {
                    const selected = (modalIsAdmin ? 'ALL' : formData.dataScope || 'OWN') === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${
                          modalIsAdmin
                            ? 'opacity-75 cursor-not-allowed bg-[#FFFFFF] border-[#F5D0CB]'
                            : selected
                            ? 'bg-white border-[#EA5551] shadow-2xs cursor-pointer'
                            : 'bg-[#FFFFFF] border-[#F5D0CB] hover:bg-[#FFF8F6] cursor-pointer'
                        }`}
                      >
                        <input
                          type="radio"
                          name="user-data-scope"
                          disabled={modalIsAdmin}
                          checked={selected}
                          onChange={() => setFormData({ ...formData, dataScope: opt.value })}
                          className="mt-0.5 text-[#EA5551]"
                        />
                        <div>
                          <span className="font-bold text-[#393334] block text-[11px]">
                            {opt.title}
                          </span>
                          <span className="text-[10px] text-[#806B68] leading-snug block">
                            {opt.desc}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Individual Form Log Privileges */}
              <div className="p-3.5 rounded-xl bg-[#FFF1EE] border border-[#F5D0CB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-[#EA5551] flex items-center gap-1.5">
                    <Shield size={14} className="text-[#EA5551]" />
                    <span>Individual Form Log Privileges</span>
                  </h4>
                  {modalIsAdmin && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                      Always Enabled for Admin
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${
                      modalIsAdmin
                        ? 'bg-emerald-50/70 border-emerald-300 opacity-80 cursor-not-allowed'
                        : formData.canEditEntries
                        ? 'bg-white border-[#EA5551] text-[#393334] cursor-pointer shadow-2xs'
                        : 'bg-[#FFFFFF] border-[#F5D0CB] text-[#806B68] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={modalIsAdmin}
                      checked={modalIsAdmin ? true : Boolean(formData.canEditEntries)}
                      onChange={e => setFormData({ ...formData, canEditEntries: e.target.checked })}
                      className="rounded text-[#EA5551] focus:ring-[#EA5551]"
                    />
                    <div>
                      <span className="font-bold block text-xs">Allow Edit Saved Form Entries</span>
                      <span className="text-[10px] text-[#806B68]">
                        Permits updating non-approved records within scope
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${
                      modalIsAdmin
                        ? 'bg-emerald-50/70 border-emerald-300 opacity-80 cursor-not-allowed'
                        : formData.canDeleteEntries
                        ? 'bg-white border-rose-600 text-[#393334] cursor-pointer shadow-2xs'
                        : 'bg-[#FFFFFF] border-[#F5D0CB] text-[#806B68] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={modalIsAdmin}
                      checked={modalIsAdmin ? true : Boolean(formData.canDeleteEntries)}
                      onChange={e => setFormData({ ...formData, canDeleteEntries: e.target.checked })}
                      className="rounded text-rose-700 focus:ring-rose-700"
                    />
                    <div>
                      <span className="font-bold block text-xs">Allow Delete Saved Form Entries</span>
                      <span className="text-[10px] text-[#806B68]">
                        Permits deleting authorized records from form logs
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Per-Form Permissions Configuration */}
              <div className="space-y-2 pt-2 border-t border-[#F5D0CB]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-[#393334] flex items-center gap-1.5">
                      <Shield size={14} className="text-[#EA5551]" />
                      <span>
                        Individual Form Permissions ({modalIsAdmin ? allFormCodes.length : formData.permittedForms?.length || 0} /{' '}
                        {allFormCodes.length} Selected)
                      </span>
                    </h4>
                    <p className="text-[10px] text-[#806B68]">
                      {modalIsAdmin
                        ? 'Administrators have universal access to all forms by role.'
                        : !modalHasInspections
                        ? 'Note: Enable the "Quality Forms & Inspections" module above so this user can open selected forms.'
                        : 'Select specific inspection forms this user can view and submit.'}
                    </p>
                  </div>

                  {!modalIsAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllForms}
                        className="px-2 py-1 bg-white hover:bg-[#FFFFFF] text-[#EA5551] border border-[#F5D0CB] rounded text-[11px] font-bold cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllForms}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                {/* Form Group Checklists */}
                <div className="space-y-3 max-h-56 overflow-y-auto p-3 rounded-xl bg-[#FFF8F6] border border-[#F5D0CB]">
                  {formGroups.map((group, idx) => {
                    const allInGroupSelected = group.forms.every(f =>
                      (formData.permittedForms || []).includes(f)
                    );

                    return (
                      <div key={idx} className="space-y-1 pb-2 border-b border-[#F5D0CB]/60 last:border-b-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-[#EA5551] uppercase tracking-tight">
                            {group.title}
                          </span>
                          {!modalIsAdmin && (
                            <button
                              type="button"
                              onClick={() => handleSelectGroupForms(group.forms)}
                              className="text-[10px] text-[#EA5551] hover:underline font-semibold cursor-pointer"
                            >
                              {allInGroupSelected ? 'Deselect Group' : 'Select Group'}
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {group.forms.map(fCode => {
                            const meta = FORM_REGISTRY[fCode];
                            if (!meta) return null;
                            const isChecked = modalIsAdmin || (formData.permittedForms || []).includes(fCode);

                            return (
                              <label
                                key={fCode}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border text-[11px] transition-colors ${
                                  modalIsAdmin
                                    ? 'bg-emerald-50/70 border-emerald-200 cursor-not-allowed'
                                    : isChecked
                                    ? 'bg-[#FFFFFF] border-[#EA5551] text-[#393334] font-bold cursor-pointer'
                                    : 'bg-white border-[#FDE8E4] text-[#806B68] hover:bg-[#FFF1EE] cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={modalIsAdmin}
                                  checked={isChecked}
                                  onChange={() => !modalIsAdmin && toggleFormPermission(fCode)}
                                  className="rounded text-[#EA5551] focus:ring-[#EA5551]"
                                />
                                <span className="font-mono text-[10px] bg-[#EA5551] text-white px-1 py-0.5 rounded">
                                  {meta.code.replace('FORM-', 'F')}
                                </span>
                                <span className="truncate">
                                  {meta.title.split('–')[1]?.trim() || meta.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="user-is-active"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-[#EA5551]"
                />
                <label htmlFor="user-is-active" className="font-semibold text-xs text-[#393334] cursor-pointer">
                  Account is Active (permitted to log into SQC portal)
                </label>
              </div>

              <div className="pt-3 border-t border-[#F5D0CB] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-[#F5D0CB] text-xs font-semibold hover:bg-[#FFF1EE] text-[#806B68] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#EA5551] to-[#D46764] hover:from-[#D46764] hover:to-[#EA5551] text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSavingUser ? 'Saving...' : isEditing ? 'Save Changes' : 'Create User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Permitted Modules & Forms Popover Modal */}
      {viewPermsCandidate && (
        <div className="fixed inset-0 z-50 bg-[#393334]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#F5D0CB] space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F5D0CB] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#393334]">
                  Permissions Overview: {viewPermsCandidate.displayName}
                </h3>
                <span className="text-[11px] text-[#806B68]">
                  Role: <strong>{viewPermsCandidate.role}</strong> · Data Scope:{' '}
                  <strong>{isAdminUser(viewPermsCandidate.role) ? 'ALL' : viewPermsCandidate.dataScope || 'OWN'}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewPermsCandidate(null)}
                className="text-[#806B68] hover:text-[#393334] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isAdminUser(viewPermsCandidate.role) ? (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                Admin has full access to all 8 modules, all 37 forms, all mill data scopes, and entry edit/delete controls.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-bold text-[#EA5551] mb-1">
                    Permitted Modules ({viewPermsCandidate.permittedModules?.length || 0}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(viewPermsCandidate.permittedModules || []).length === 0 ? (
                      <span className="text-[#806B68]">No modules assigned.</span>
                    ) : (
                      (viewPermsCandidate.permittedModules || []).map(m => (
                        <span
                          key={m}
                          className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#F5D0CB] text-[#EA5551] font-bold text-[10px]"
                        >
                          {MODULE_DEFINITIONS.find(d => d.id === m)?.label || m}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-bold text-[#EA5551] mb-1">
                    Permitted Forms ({viewPermsCandidate.permittedForms?.length || 0}):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 bg-[#FFF8F6] rounded-xl border border-[#F5D0CB]">
                    {(viewPermsCandidate.permittedForms || []).length === 0 ? (
                      <span className="text-[#806B68] col-span-2 p-2 text-center">
                        No inspection forms granted.
                      </span>
                    ) : (
                      (viewPermsCandidate.permittedForms || []).map(fCode => {
                        const meta = FORM_REGISTRY[fCode];
                        return (
                          <div key={fCode} className="p-1.5 rounded bg-white border border-[#F5D0CB] flex items-center gap-1.5">
                            <span className="font-mono text-[10px] bg-[#EA5551] text-white px-1.5 py-0.5 rounded font-bold">
                              {fCode}
                            </span>
                            <span className="text-[11px] font-semibold text-[#393334] truncate">
                              {meta?.title.split('–')[1]?.trim() || meta?.title || fCode}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewPermsCandidate(null)}
                className="px-4 py-1.5 rounded-lg bg-[#EA5551] text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Admin Password Reset Modal */}
      {resetPwCandidate && (
        <div className="fixed inset-0 z-50 bg-[#393334]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#F5D0CB] space-y-4">
            <div className="flex items-center justify-between border-b border-[#FDE8E4] pb-2">
              <h3 className="font-bold text-sm text-[#393334] flex items-center gap-2">
                <KeyRound size={16} className="text-[#EA5551]" />
                <span>Reset Password</span>
              </h3>
              <button
                type="button"
                onClick={() => setResetPwCandidate(null)}
                className="text-[#806B68] hover:text-[#393334] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#806B68] leading-relaxed">
              Set a new temporary or permanent password for{' '}
              <strong className="text-[#393334]">{resetPwCandidate.displayName}</strong> (
              {resetPwCandidate.username || resetPwCandidate.email}). Previous sessions will be logged out immediately.
            </p>

            {resetPwError && (
              <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {resetPwError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3 text-xs">
              <div className="relative">
                <input
                  type={resetPwShow ? 'text' : 'password'}
                  required
                  value={resetPwValue}
                  onChange={e => setResetPwValue(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full p-2 pr-9 rounded-lg border border-[#F5D0CB] bg-[#FFF8F6] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setResetPwShow(!resetPwShow)}
                  className="absolute right-2.5 top-2.5 text-[#806B68] cursor-pointer"
                >
                  {resetPwShow ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResetPwCandidate(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#F5D0CB] text-xs font-semibold hover:bg-[#FFF1EE] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPwBusy}
                  className="px-3.5 py-1.5 rounded-lg bg-[#EA5551] hover:bg-[#D46764] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {resetPwBusy ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-[#393334]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-300 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle size={22} className="shrink-0" />
              <h3 className="font-bold text-sm">Delete User Account</h3>
            </div>
            <p className="text-xs text-[#806B68] leading-relaxed">
              Are you sure you want to delete user <strong className="text-[#393334]">&quot;{deleteCandidate.displayName}&quot;</strong> ({deleteCandidate.email})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-3 py-1.5 rounded-lg border border-[#F5D0CB] text-xs font-semibold hover:bg-[#FFF1EE] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
