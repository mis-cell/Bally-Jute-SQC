import React, { useState } from 'react';
import {
  Users,
  Shield,
  Plus,
  Key,
  Building,
  UserCheck,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole } from '../types';

export const UsersPage: React.FC = () => {
  const { currentUser, switchUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>(() => dataService.getUsers());

  const roles: UserRole[] = [
    'Super Admin',
    'Admin',
    'HOD / Approver',
    'SQC Inspector / User',
    'Viewer / Auditor',
  ];

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
            Manage SQC department accounts, inspectors, HOD signers, and external auditors
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          Currently active as: <strong className="text-emerald-900">{currentUser.displayName}</strong>
        </div>
      </div>

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

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="py-2.5 px-3">Emp Code</th>
              <th className="py-2.5 px-3">Name & Email</th>
              <th className="py-2.5 px-3">Department</th>
              <th className="py-2.5 px-3">Assigned Role</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Instant Switch Persona</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{u.employeeCode}</td>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-slate-900">{u.displayName}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                </td>
                <td className="py-2.5 px-3 text-slate-600">{u.departmentName}</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                    {u.role}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Active
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
