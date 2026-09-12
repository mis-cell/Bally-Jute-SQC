import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  Shield,
  Download,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { AuditLogItem } from '../types';

export const AuditTrailPage: React.FC = () => {
  const [logs] = useState<AuditLogItem[]>(() => dataService.getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filtered = logs.filter(l => {
    const matchSearch =
      !searchTerm ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.module.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const getBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'SUBMIT':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'APPROVE':
        return 'bg-emerald-600 text-white';
      case 'REJECT':
        return 'bg-rose-600 text-white';
      case 'RETURN':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'SETTINGS':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History size={18} className="text-emerald-700" />
            <span>SQC Digital Compliance Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all user logins, inspection creation, edits, approvals, and system changes
          </p>
        </div>

        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
          {filtered.length} Events Recorded
        </span>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 text-xs">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search audit details, user email, module..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800"
          />
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          aria-label="Filter by Audit Action"
          className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
        >
          <option value="ALL">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="SUBMIT">SUBMIT</option>
          <option value="APPROVE">APPROVE</option>
          <option value="REJECT">REJECT</option>
          <option value="RETURN">RETURN</option>
          <option value="SETTINGS">SETTINGS</option>
          <option value="LOGIN">LOGIN</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="py-2.5 px-3 w-40">Timestamp</th>
              <th className="py-2.5 px-3 w-28">Action</th>
              <th className="py-2.5 px-3 w-36">Module</th>
              <th className="py-2.5 px-3 w-48">User & Role</th>
              <th className="py-2.5 px-3">Audit Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-mono text-slate-600">
                  {new Date(l.timestamp).toLocaleString()}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(l.action)}`}>
                    {l.action}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-800">{l.module}</td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-slate-800">{l.userEmail}</div>
                  <div className="text-[10px] text-slate-400">{l.userRole}</div>
                </td>
                <td className="py-2.5 px-3 text-slate-700 font-medium">{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
