import React, { useState } from 'react';
import {
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  AlertTriangle,
  Search,
  Mail,
  Building,
  KeyRound,
  Lock,
  Check,
  CheckSquare,
  Square,
  FileText,
  Eye,
  EyeOff,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { useRealtimeData } from '../hooks/useRealtimeSync';
import { UserProfile, UserRole } from '../types';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const UsersPage: React.FC = () => {
  const { currentUser, saveUser, deleteUser, allUsers } = useAuth();
  const users = useRealtimeData(() => dataService.getUsers());
  const departments = useRealtimeData(() => dataService.getDepartments());

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<UserProfile | null>(null);
  const [viewPermsCandidate, setViewPermsCandidate] = useState<UserProfile | null>(null);
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
    permittedForms: [],
    createdAt: new Date().toISOString(),
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [changePasswordToggle, setChangePasswordToggle] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const roles: UserRole[] = [
    'Super Admin',
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
      permittedForms: ['FORM-01', 'FORM-02', 'FORM-03', 'FORM-04', 'FORM-05'],
      createdAt: new Date().toISOString(),
    });
    setPasswordInput('Admin@123456');
    setChangePasswordToggle(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setIsEditing(true);
    setFormData({
      ...user,
      permittedForms: Array.isArray(user.permittedForms) ? [...user.permittedForms] : [],
    });
    setPasswordInput('');
    setChangePasswordToggle(false);
    setFormError('');
    setIsModalOpen(true);
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
      let next: string[];
      if (allSelected) {
        next = current.filter(f => !groupForms.includes(f));
      } else {
        next = Array.from(new Set([...current, ...groupForms]));
      }
      return { ...prev, permittedForms: next };
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim()) {
      setFormError('Display Name is required.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('A valid Email address is required.');
      return;
    }
    if (!formData.employeeCode.trim()) {
      setFormError('Employee Code is required.');
      return;
    }

    if (!isEditing || changePasswordToggle) {
      if (!passwordInput || passwordInput.length < 6) {
        setFormError('Password must be at least 6 characters long.');
        return;
      }
    }

    // Auto-generate username if not provided
    const userToSave: UserProfile = {
      ...formData,
      username: (formData.username || formData.email.split('@')[0] || formData.employeeCode).trim().toLowerCase(),
    };

    const res = await saveUser(userToSave, changePasswordToggle ? passwordInput : undefined);
    if (res.success) {
      setIsModalOpen(false);
      setStatusNotice({ isError: false, message: `✅ User "${userToSave.displayName}" saved successfully.` });
      setTimeout(() => setStatusNotice(null), 5000);
    } else {
      setFormError(res.message || 'Failed to save user.');
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteCandidate) return;
    if (deleteCandidate.id === currentUser.id) {
      setStatusNotice({ isError: true, message: 'You cannot delete your own currently active account!' });
      setDeleteCandidate(null);
      return;
    }

    const success = deleteUser(deleteCandidate.id);
    if (success) {
      setStatusNotice({ isError: false, message: `✅ User "${deleteCandidate.displayName}" deleted.` });
      setTimeout(() => setStatusNotice(null), 5000);
    }
    setDeleteCandidate(null);
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

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-xl p-4 border border-[#F4C4C5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#393334] flex items-center gap-2">
            <Users size={18} className="text-[#D95F68]" />
            <span>Personnel & Role-Based Access Control (RBAC)</span>
          </h2>
          <p className="text-xs text-[#806B6C] mt-0.5">
            Manage SQC user accounts, passwords, and assign/revoke access to individual floor inspection forms
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-add-new-user"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-[#D95F68] hover:bg-[#C94E59] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Add New User</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs ${
            statusNotice.isError
              ? 'bg-amber-50 border border-amber-300 text-amber-950'
              : 'bg-emerald-50 border border-emerald-300 text-emerald-900'
          }`}
        >
          <span>{statusNotice.message}</span>
          <button onClick={() => setStatusNotice(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Role explanation summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        <div className="bg-white p-3 rounded-lg border border-[#F4C4C5]">
          <span className="font-bold text-[#393334] block">Super Admin</span>
          <p className="text-[11px] text-[#806B6C] mt-1">Full access to all forms, users, masters, and audit controls</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-[#F4C4C5]">
          <span className="font-bold text-[#393334] block">Admin</span>
          <p className="text-[11px] text-[#806B6C] mt-1">Manage masters, user permissions, and review floor data</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-[#F4C4C5]">
          <span className="font-bold text-[#393334] block">HOD / Approver</span>
          <p className="text-[11px] text-[#806B6C] mt-1">Review, approve, or return inspections for assigned departments</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-[#F4C4C5]">
          <span className="font-bold text-[#393334] block">SQC Inspector</span>
          <p className="text-[11px] text-[#806B6C] mt-1">Enter measurements and submit inspections for permitted forms</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-[#F4C4C5]">
          <span className="font-bold text-[#393334] block">Viewer / Auditor</span>
          <p className="text-[11px] text-[#806B6C] mt-1">Read-only auditor access to verified reports and standards</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-3 border border-[#F4C4C5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search by name, username, email, code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D95F68]"
          />
          <Search size={14} className="absolute left-2.5 top-2 text-[#806B6C]" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#806B6C] font-semibold">Filter Role:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs bg-[#FFF9F9] border border-[#F4C4C5] rounded-lg px-2.5 py-1.5 font-medium text-[#393334]"
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
      <div className="bg-white rounded-xl border border-[#F4C4C5] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#FFF4F3] border-b border-[#F4C4C5] text-[#754D50] font-bold">
                <th className="py-3 px-4">User & Employee Code</th>
                <th className="py-3 px-4">Username & Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Permitted Forms Access</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FCE7E6]/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#806B6C]">
                    No users match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isUserAdmin = user.role === 'Super Admin' || user.role === 'SuperAdmin' || user.role === 'Admin';
                  const formCount = isUserAdmin
                    ? allFormCodes.length
                    : (user.permittedForms?.length || 0);

                  return (
                    <tr key={user.id} className="hover:bg-[#FFF9F9] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#D95F68] text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                            {user.displayName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-[#393334]">{user.displayName}</div>
                            <div className="font-mono text-[10px] text-[#806B6C] font-semibold">
                              ID: {user.employeeCode || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#D95F68]">{user.username || user.email.split('@')[0]}</div>
                        <div className="text-[11px] text-[#806B6C]">{user.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            user.role === 'Super Admin' || user.role === 'SuperAdmin'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : user.role === 'Admin'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : user.role === 'HOD / Approver'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#574448]">
                        {user.departmentName || 'All Departments'}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setViewPermsCandidate(user)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer border ${
                            isUserAdmin
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                              : formCount > 0
                              ? 'bg-[#FCE7E6] text-[#D95F68] border-[#F4C4C5] hover:bg-[#F9D6D7]'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                          title="Click to view full form permissions list"
                        >
                          <FileText size={12} />
                          <span>
                            {isUserAdmin ? 'Full Access (All Forms)' : `${formCount} Forms Permitted`}
                          </span>
                        </button>
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-[#806B6C] hover:text-[#D95F68] hover:bg-[#FCE7E6] rounded-md transition-colors cursor-pointer"
                            title="Edit User & Permissions"
                          >
                            <Edit2 size={14} />
                          </button>

                          {user.id !== currentUser.id && (
                            <button
                              onClick={() => setDeleteCandidate(user)}
                              className="p-1.5 text-[#806B6C] hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#F4C4C5] my-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F4C4C5] pb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#D95F68]" />
                <h3 className="font-bold text-sm text-[#393334]">
                  {isEditing ? `Edit User: ${formData.displayName}` : 'Create New SQC User'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
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
                  <label className="block font-bold text-[#574448] mb-1">
                    Full Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g. Rajesh Ghosh"
                    className="w-full p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#574448] mb-1">
                    Employee Code / ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode}
                    onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                    placeholder="e.g. BJ-311"
                    className="w-full p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#574448] mb-1">
                    Username / Login Handle
                  </label>
                  <input
                    type="text"
                    value={formData.username || ''}
                    onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                    placeholder="e.g. rajesh or rghosh"
                    className="w-full p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#574448] mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@ballyjute.com"
                    className="w-full p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#574448] mb-1">
                    System Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white font-semibold"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#574448] mb-1">
                    Assigned Department
                  </label>
                  <select
                    value={formData.departmentName}
                    onChange={e => {
                      const dept = departments.find(d => d.name === e.target.value);
                      setFormData({
                        ...formData,
                        departmentName: e.target.value,
                        departmentId: dept?.id || '',
                      });
                    }}
                    className="w-full p-2 rounded-lg border border-[#F4C4C5] bg-[#FFF9F9] focus:bg-white"
                  >
                    <option value="">All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password Management */}
              <div className="p-3 rounded-xl bg-[#FFF9F9] border border-[#F4C4C5] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#574448]">
                    <Lock size={14} className="text-[#D95F68]" />
                    <span>Security & Password</span>
                  </div>
                  {isEditing && (
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#806B6C] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={changePasswordToggle}
                        onChange={e => setChangePasswordToggle(e.target.checked)}
                      />
                      <span>Reset / Change Password</span>
                    </label>
                  )}
                </div>

                {(!isEditing || changePasswordToggle) && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                      className="w-full p-2 pr-9 text-xs rounded-lg border border-[#F4C4C5] bg-white font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-[#806B6C]"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <p className="text-[10px] text-[#806B6C] mt-1">
                      Passwords are automatically salted and hashed using SHA-256 before saving to the database.
                    </p>
                  </div>
                )}
              </div>

              {/* Per-Form Permissions Configuration */}
              <div className="space-y-2 pt-2 border-t border-[#F4C4C5]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-[#393334] flex items-center gap-1.5">
                      <Shield size={14} className="text-[#D95F68]" />
                      <span>Individual Form Permissions ({formData.permittedForms?.length || 0} / {allFormCodes.length} Selected)</span>
                    </h4>
                    <p className="text-[10px] text-[#806B6C]">
                      {formData.role === 'Super Admin' || formData.role === 'SuperAdmin' || formData.role === 'Admin'
                        ? 'Administrators have universal access to all forms by role.'
                        : 'Select which floor inspection forms this user is allowed to access and submit.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllForms}
                      className="px-2 py-1 bg-white hover:bg-[#FCE7E6] text-[#D95F68] border border-[#F4C4C5] rounded text-[11px] font-bold cursor-pointer"
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
                </div>

                {/* Form Group Checklists */}
                <div className="space-y-3 max-h-64 overflow-y-auto p-3 rounded-xl bg-[#FFF9F9] border border-[#F4C4C5]">
                  {formGroups.map((group, idx) => {
                    const allInGroupSelected = group.forms.every(f => (formData.permittedForms || []).includes(f));

                    return (
                      <div key={idx} className="space-y-1 pb-2 border-b border-[#F4C4C5]/60 last:border-b-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-[#701638] uppercase tracking-tight">
                            {group.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectGroupForms(group.forms)}
                            className="text-[10px] text-[#D95F68] hover:underline font-semibold"
                          >
                            {allInGroupSelected ? 'Deselect Group' : 'Select Group'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {group.forms.map(fCode => {
                            const meta = FORM_REGISTRY[fCode];
                            if (!meta) return null;
                            const isChecked = (formData.permittedForms || []).includes(fCode);

                            return (
                              <label
                                key={fCode}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-[#FCE7E6] border-[#D95F68] text-[#574448] font-bold'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFormPermission(fCode)}
                                  className="rounded text-[#D95F68] focus:ring-[#D95F68]"
                                />
                                <span className="font-mono text-[10px] bg-[#D95F68] text-white px-1 py-0.5 rounded">
                                  {meta.code.replace('FORM-', 'F')}
                                </span>
                                <span className="truncate">{meta.title.split('–')[1]?.trim() || meta.title}</span>
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
                  className="rounded text-[#D95F68]"
                />
                <label htmlFor="user-is-active" className="font-semibold text-xs text-[#393334] cursor-pointer">
                  Account is Active (permitted to log into SQC floor portal)
                </label>
              </div>

              <div className="pt-3 border-t border-[#F4C4C5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#D95F68] hover:bg-[#C94E59] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isEditing ? 'Save Changes' : 'Create User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Permitted Forms Popover Modal */}
      {viewPermsCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#F4C4C5] space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F4C4C5] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#393334]">
                  Permitted Forms for {viewPermsCandidate.displayName}
                </h3>
                <span className="text-[11px] text-[#806B6C]">
                  Role: <strong>{viewPermsCandidate.role}</strong>
                </span>
              </div>
              <button
                onClick={() => setViewPermsCandidate(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {viewPermsCandidate.role === 'Super Admin' || viewPermsCandidate.role === 'SuperAdmin' || viewPermsCandidate.role === 'Admin' ? (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                ✅ As an Administrator, this user has full, unrestricted access to all 37 floor inspection forms.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <p className="text-[#806B6C]">
                  This user is allowed to access and submit entries for the following {viewPermsCandidate.permittedForms?.length || 0} form(s):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-[#FFF9F9] rounded-xl border border-[#F4C4C5]">
                  {(viewPermsCandidate.permittedForms || []).map(fCode => {
                    const meta = FORM_REGISTRY[fCode];
                    return (
                      <div key={fCode} className="p-1.5 rounded bg-white border border-[#F4C4C5] flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-[#D95F68] text-white px-1.5 py-0.5 rounded font-bold">
                          {fCode}
                        </span>
                        <span className="text-[11px] font-semibold text-[#393334] truncate">
                          {meta?.title.split('–')[1]?.trim() || meta?.title || fCode}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewPermsCandidate(null)}
                className="px-4 py-1.5 rounded-lg bg-[#D95F68] text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle size={22} className="shrink-0" />
              <h3 className="font-bold text-sm">Delete User Account</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete user <strong>"{deleteCandidate.displayName}"</strong> ({deleteCandidate.email})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
