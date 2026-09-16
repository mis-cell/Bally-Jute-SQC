import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  PlusCircle,
  ArrowUpRight,
  Download,
  Calendar,
  Layers,
  Building,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Printer,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { InspectionRecord, InspectionStatus, InspectionResult } from '../types';
import { StatusBadge, ResultBadge } from '../components/common/Badges';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const InspectionsListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [inspections, setInspections] = useState<InspectionRecord[]>(() => dataService.getInspections());
  const [deleteTarget, setDeleteTarget] = useState<InspectionRecord | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [formFilter, setFormFilter] = useState('ALL');

  const departments = dataService.getDepartments();

  const filtered = useMemo(() => {
    return inspections.filter(item => {
      const matchSearch =
        !searchTerm ||
        item.inspectionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.formCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.formTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.inspectorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.departmentName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = deptFilter === 'ALL' || item.departmentName === deptFilter;
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchResult = resultFilter === 'ALL' || item.result === resultFilter;
      const matchForm = formFilter === 'ALL' || item.formCode === formFilter;

      return matchSearch && matchDept && matchStatus && matchResult && matchForm;
    });
  }, [inspections, searchTerm, deptFilter, statusFilter, resultFilter, formFilter]);

  const handleExportCSV = () => {
    const headers = ['Inspection No', 'Form Code', 'Form Title', 'Department', 'Date', 'Shift', 'Inspector', 'Status', 'Result'];
    const rows = filtered.map(i => [
      i.inspectionNo,
      i.formCode,
      `"${i.formTitle.replace(/"/g, '""')}"`,
      `"${i.departmentName}"`,
      i.inspectionDate,
      i.shiftName,
      `"${i.inspectorName}"`,
      i.status,
      i.result,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BallyJute_SQC_Inspections_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>SQC Inspection Registry (Forms 1–36)</span>
            <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
              {filtered.length} of {inspections.length} Records
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Digital audit trail and testing records for all mill production stages
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            id="create-new-inspection-btn"
            onClick={() => navigate('/new-inspection')}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle size={14} />
            <span>New Inspection</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        {/* Search */}
        <div className="relative">
          <input
            id="registry-search-input"
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search inspection #, inspector..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:border-emerald-600 text-slate-800"
          />
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
        </div>

        {/* Department Filter */}
        <select
          id="filter-dept-select"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          aria-label="Filter by Department"
          className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
        >
          <option value="ALL">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Form Filter */}
        <select
          id="filter-form-select"
          value={formFilter}
          onChange={e => setFormFilter(e.target.value)}
          aria-label="Filter by Form Format"
          className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
        >
          <option value="ALL">All Form Formats (1–36)</option>
          {Object.values(FORM_REGISTRY).map(f => (
            <option key={f.code} value={f.code}>
              {f.code}: {f.title.split('–')[1]?.trim() || f.title}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          id="filter-status-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by Workflow Status"
          className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
        >
          <option value="ALL">All Workflow Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted (Pending Review)</option>
          <option value="Approved">Approved (Locked)</option>
          <option value="Returned">Returned for Correction</option>
          <option value="Rejected">Rejected</option>
        </select>

        {/* Result Filter */}
        <select
          id="filter-result-select"
          value={resultFilter}
          onChange={e => setResultFilter(e.target.value)}
          aria-label="Filter by Quality Result"
          className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
        >
          <option value="ALL">All Results (Pass/Warn/Fail)</option>
          <option value="PASS">PASS Only</option>
          <option value="WARNING">WARNING Only</option>
          <option value="FAIL">FAIL (Out of Standard)</option>
        </select>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Inspection No.</th>
                <th className="py-2.5 px-3">Date & Shift</th>
                <th className="py-2.5 px-3">Form Description</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Inspector</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Result</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No inspection records found matching the active filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-950">
                      {item.inspectionNo}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>{item.inspectionDate}</div>
                      <div className="text-[10px] text-slate-400">{item.shiftName.split(' ')[0]}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">
                          {item.formCode}
                        </span>
                        <span>{item.formTitle.split('–')[1]?.trim() || item.formTitle}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Quality: {item.qualityName}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{item.departmentName}</td>
                    <td className="py-2.5 px-3 text-slate-700">{item.inspectorName}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      <ResultBadge result={item.result} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`view-rec-${item.id}`}
                          onClick={() => navigate(`/inspection/${item.id}`)}
                          title="Open Inspection Details"
                          className="px-2 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded text-xs font-semibold inline-flex items-center gap-1 border border-emerald-200"
                        >
                          <span>Open</span>
                          <ArrowUpRight size={13} />
                        </button>
                        <button
                          id={`edit-rec-${item.id}`}
                          onClick={() => navigate(`/inspection/${item.id}`)}
                          title="Edit Inspection Data"
                          className="p-1 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          id={`del-rec-${item.id}`}
                          onClick={() => setDeleteTarget(item)}
                          title="Delete Inspection"
                          className="p-1 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle size={18} />
              <span>Confirm Inspection Deletion</span>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete inspection{' '}
              <strong className="text-slate-900 font-mono">{deleteTarget.inspectionNo}</strong>?
              This will remove the entry from browser storage, PostgreSQL database, and record an audit log.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dataService.deleteInspection(deleteTarget.id, currentUser);
                  setInspections(dataService.getInspections());
                  setDeleteTarget(null);
                }}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
