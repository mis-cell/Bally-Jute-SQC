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
  UserCheck,
  Search,
  Mail,
  Building,
  BadgeAlert,
  Database,
  UploadCloud,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { PostgresSyncModal } from '../components/PostgresSyncModal';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole } from '../types';
import { useRealtimeData } from '../hooks/useRealtimeSync';

export const UsersPage: React.FC = () => {
  const { currentUser, switchUser } = useAuth();
  const users = useRealtimeData(() => dataService.getUsers());
  const departments = useRealtimeData(() => dataService.getDepartments());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<UserProfile | null>(null);
  const [isPgModalOpen, setIsPgModalOpen] = useState(false);
  const [syncStatusNotice, setSyncStatusNotice] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<UserProfile>({
    id: '',
    employeeCode: '',
    displayName: '',
    email: '',
    role: 'SQC Inspector / User',
    departmentId: 'dept-selection',
    departmentName: 'Selection',
  });

  const [formError, setFormError] = useState('');

  const roles: UserRole[] = [
    'Super Admin',
    'Admin',
    'HOD / Approver',
    'SQC Inspector / User',
    'Viewer / Auditor',
  ];

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: `u-${Date.now()}`,
      employeeCode: `BJ-${Math.floor(100 + Math.random() * 900)}`,
      displayName: '',
      email: '',
      role: 'SQC Inspector / User',
      departmentId: departments[0]?.id || 'dept-selection',
      departmentName: departments[0]?.name || 'Selection',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setIsEditing(true);
    setFormData({ ...user });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
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

    // Save user in dataService
    dataService.saveUser(formData, currentUser);
    setIsModalOpen(false);

    // Provide immediate sync feedback
    setSyncStatusNotice(`User "${formData.displayName}" saved. Replicating to local PostgreSQL...`);
    postgresService.syncUserToPostgres(formData).then(res => {
      if (res.success) {
        setSyncStatusNotice(`✅ User "${formData.displayName}" successfully saved in local PostgreSQL!`);
      } else {
        setSyncStatusNotice(`⚠️ Saved locally. Local PG Notice: ${res.message}`);
      }
      setTimeout(() => setSyncStatusNotice(null), 6000);
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteCandidate) return;
    if (deleteCandidate.id === currentUser.id) {
      alert('You cannot delete your own currently active account!');
      setDeleteCandidate(null);
      return;
    }
    dataService.deleteUser(deleteCandidate.id, currentUser);
    setDeleteCandidate(null);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.departmentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users size={18} className="text-emerald-700" />
            <span>Personnel & Role-Based Access Control (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full CRUD administration: Add, edit, remove, and manage SQC staff accounts, inspectors, and HOD signers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-users-pg-sync"
            onClick={() => setIsPgModalOpen(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors border border-slate-700"
            title="Manage PostgreSQL replication and view database status"
          >
            <Database size={14} className="text-emerald-400" />
            <span>PostgreSQL Sync Hub</span>
          </button>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            Active: <strong className="text-emerald-900">{currentUser.displayName}</strong>
          </div>
          <button
            id="btn-add-new-user"
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus size={15} />
            <span>+ Add New User</span>
          </button>
        </div>
      </div>

      {syncStatusNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
          <span>{syncStatusNotice}</span>
          <button
            onClick={() => setIsPgModalOpen(true)}
            className="underline font-bold text-emerald-950 hover:text-emerald-800"
          >
            Open DB Hub
          </button>
        </div>
      )}

      {/* Role explanation summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        <div className="bg-white p-3 rounded-lg border border-slate-200">
          <span className="font-bold text-slate-900 block">Super Admin</span>
          <p className="text-[11px] text-slate-500 mt-1">Full system privilege, config, master override & audit wipe</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200">
          <span className="font-bold text-slate-900 block">Admin</span>
          <p className="text-[11px] text-slate-500 mt-1">Manage masters, review submissions, and manage user roles</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200">
          <span className="font-bold text-slate-900 block">HOD / Approver</span>
          <p className="text-[11px] text-slate-500 mt-1">Approve, reject, or return inspections; view dept analytics</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200">
          <span className="font-bold text-slate-900 block">SQC Inspector</span>
          <p className="text-[11px] text-slate-500 mt-1">Create drafts, record sample measurements, and submit to HOD</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200">
          <span className="font-bold text-slate-900 block">Viewer / Auditor</span>
          <p className="text-[11px] text-slate-500 mt-1">BIS auditor read-only access to inspections & reports</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, employee code..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-semibold whitespace-nowrap">Role Filter:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="ALL">All Roles ({users.length})</option>
            {roles.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-3 px-3">Emp Code</th>
                <th className="py-3 px-3">Name & Email</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Assigned Role</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">CRUD Actions</th>
                <th className="py-3 px-3 text-right">Instant Switch Persona</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No users found matching "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.employeeCode}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-xs">{u.displayName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{u.departmentName}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Edit User"
                          className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(u)}
                          title="Delete User"
                          disabled={users.length <= 1}
                          className="p-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => switchUser(u.id)}
                        className={`px-3 py-1 rounded text-xs font-semibold ${
                          currentUser.id === u.id
                            ? 'bg-slate-100 text-slate-400 cursor-default'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        }`}
                      >
                        {currentUser.id === u.id ? 'Current User' : 'Login As User'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users size={16} className="text-emerald-700" />
                <span>{isEditing ? 'Edit User Details' : 'Add New SQC User'}</span>
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g. Ramesh Chandra (QC Executive)"
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 font-medium focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employee Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode}
                    onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                    placeholder="e.g. BJ-401"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Role *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. ramesh@ballyjute.com"
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 font-medium focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={formData.departmentName}
                  onChange={e => {
                    const sel = departments.find(d => d.name === e.target.value);
                    setFormData({
                      ...formData,
                      departmentName: e.target.value,
                      departmentId: sel ? sel.id : formData.departmentId,
                    });
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  {isEditing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle size={18} />
              <span>Confirm User Deletion</span>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete user{' '}
              <strong className="text-slate-900">{deleteCandidate.displayName}</strong> ({deleteCandidate.employeeCode})?
              This action will be logged in the audit trail.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PostgreSQL Sync Modal */}
      <PostgresSyncModal isOpen={isPgModalOpen} onClose={() => setIsPgModalOpen(false)} />
    </div>
  );
};
