import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, RefreshCw } from 'lucide-react';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { AuditLogItem } from '../types';

export const AuditTrailPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>(() => dataService.getAuditLogs());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await postgresService.fetchAuditLogs();
      if (res.success && Array.isArray(res.logs)) {
        const local = dataService.getAuditLogs();
        const seenIds = new Set(res.logs.map((r: any) => String(r.id)));
        const merged = [
          ...res.logs,
          ...local.filter(l => !seenIds.has(String(l.id))),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(merged);
      } else {
        setLogs(dataService.getAuditLogs());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filtered = logs.filter(l => {
    const matchSearch =
      !searchTerm ||
      (l.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.module || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const getBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'SUBMIT':
        return 'bg-sky-50 text-sky-900 border-sky-300';
      case 'APPROVE':
        return 'bg-emerald-700 text-white border-emerald-700';
      case 'REJECT':
      case 'DELETE':
        return 'bg-[#EA5551] text-[#FFFFFF] border-[#D46764]';
      case 'RETURN':
        return 'bg-[#FFFFFF] text-[#EA5551] border-[#F5D0CB]';
      case 'SETTINGS':
        return 'bg-[#FFF1EE] text-[#EA5551] border-[#D46764]';
      default:
        return 'bg-[#FFF1EE] text-[#EA5551] border-[#F5D0CB]';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#FFFFFF] rounded-xl p-4 border border-[#F5D0CB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#393334] flex items-center gap-2">
            <History size={18} className="text-[#EA5551]" />
            <span>SQC Digital Compliance Audit Trail</span>
          </h2>
          <p className="text-xs text-[#806B68] mt-0.5">
            Immutable server &amp; local log of logins, role/permission updates, password resets, and inspection lifecycle events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadLogs()}
            className="px-3 py-1.5 rounded-lg border border-[#F5D0CB] bg-[#FFF1EE] hover:bg-[#FFFFFF] text-[#EA5551] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <span className="text-xs font-mono font-bold bg-[#FFFFFF] text-[#EA5551] px-3 py-1.5 rounded-lg border border-[#F5D0CB] tabular-nums">
            {filtered.length} Events
          </span>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-[#FFFFFF] rounded-xl p-3 border border-[#F5D0CB] shadow-xs flex flex-col sm:flex-row gap-3 text-xs">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search audit details, user email, module..."
            className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#393334] placeholder:text-[#806B68]"
          />
          <Search size={14} className="absolute left-2.5 top-2 text-[#806B68]" />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          aria-label="Filter by Audit Action"
          className="bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg px-3 py-1.5 text-xs text-[#393334] font-medium"
        >
          <option value="ALL">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="SUBMIT">SUBMIT</option>
          <option value="APPROVE">APPROVE</option>
          <option value="REJECT">REJECT</option>
          <option value="RETURN">RETURN</option>
          <option value="SETTINGS">SETTINGS</option>
          <option value="LOGIN">LOGIN</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#FFFFFF] rounded-xl border border-[#F5D0CB] shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-semibold">
            <tr>
              <th className="py-2.5 px-3 w-44">Timestamp</th>
              <th className="py-2.5 px-3 w-28">Action</th>
              <th className="py-2.5 px-3 w-36">Module</th>
              <th className="py-2.5 px-3 w-48">User &amp; Role</th>
              <th className="py-2.5 px-3">Audit Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#FDE8E4]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#806B68]">
                  No audit events recorded matching current filters.
                </td>
              </tr>
            ) : (
              filtered.map(l => (
                <tr key={l.id} className="hover:bg-[#FFEAE6]">
                  <td className="py-2.5 px-3 font-mono text-[#806B68] tabular-nums">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(l.action)}`}>
                      {l.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#393334]">{l.module}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-[#393334]">{l.userEmail}</div>
                    <div className="text-[10px] text-[#806B68]">{l.userRole}</div>
                  </td>
                  <td className="py-2.5 px-3 text-[#393334] font-medium">{l.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
