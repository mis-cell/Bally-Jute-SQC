import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  ArrowUpRight,
  Download,
  AlertTriangle,
  Edit2,
  Trash2,
  Lock,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { useAuth } from '../context/AuthContext';
import { InspectionRecord } from '../types';
import { StatusBadge, ResultBadge } from '../components/common/Badges';
import { FORM_REGISTRY } from '../constants/formsRegistry';
import { useRealtimeData } from '../hooks/useRealtimeSync';

export const InspectionsListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    currentUser,
    isAdmin,
    permittedForms,
    hasPermission,
    canAccessModule,
    canAccessForm,
    canViewRecord,
    canEditSavedEntry,
    canDeleteSavedEntry,
  } = useAuth();
  const rawInspections = useRealtimeData(() => dataService.getInspections());
  const inspections = useMemo(
    () => rawInspections.filter(item => canViewRecord(item)),
    [rawInspections, canViewRecord]
  );
  const [deleteTarget, setDeleteTarget] = useState<InspectionRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canCreate = hasPermission('CREATE') && permittedForms.length > 0;
  const canEditSaved = canEditSavedEntry();
  const canDeleteSaved = canDeleteSavedEntry();

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
      <div className="bg-[#FFFDF8] rounded-xl p-4 border border-[#E4D0A3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#2B1114] flex items-center gap-2 flex-wrap">
            <span>SQC Inspection Registry (Forms 1–36)</span>
            <span className="text-xs font-mono font-bold bg-[#FDF5DC] text-[#7A560B] px-2.5 py-0.5 rounded border border-[#DFC378] tabular-nums">
              {filtered.length} of {inspections.length} Records
            </span>
          </h2>
          <p className="text-xs text-[#6E524B] mt-0.5">
            Digital audit trail and testing records for all mill production stages
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-[#E4D0A3] bg-[#FFFDF8] hover:bg-[#FBF4E1] text-[#5C080E] text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          {canCreate && (
            <button
              id="create-new-inspection-btn"
              onClick={() => navigate(`/new-inspection?form=${encodeURIComponent(permittedForms[0])}`)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#8B0A12] to-[#68050B] hover:from-[#68050B] hover:to-[#4E0308] text-[#FFFDF8] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs border border-[#D4AF37]/40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle size={14} />
              <span>New Inspection</span>
            </button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border flex items-center justify-between ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button onClick={() => setActionNotice(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#FFFDF8] rounded-xl p-3 border border-[#E4D0A3] shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        {/* Search */}
        <div className="relative">
          <input
            id="registry-search-input"
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search inspection #, inspector..."
            className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#2B1114] placeholder:text-[#8B6D62]"
          />
          <Search size={14} className="absolute left-2.5 top-2 text-[#8B6D62]" />
        </div>

        {/* Department Filter */}
        <select
          id="filter-dept-select"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          aria-label="Filter by Department"
          className="bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg px-2.5 py-1.5 text-xs text-[#2B1114] font-medium"
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
          className="bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg px-2.5 py-1.5 text-xs text-[#2B1114] font-medium"
        >
          <option value="ALL">All Permitted Form Formats</option>
          {Object.values(FORM_REGISTRY)
            .filter(f => isAdmin || canAccessModule('APPROVALS') || canAccessForm(f.code))
            .map(f => (
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
          className="bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg px-2.5 py-1.5 text-xs text-[#2B1114] font-medium"
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
          className="bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg px-2.5 py-1.5 text-xs text-[#2B1114] font-medium"
        >
          <option value="ALL">All Results (Pass/Warn/Fail)</option>
          <option value="PASS">PASS Only</option>
          <option value="WARNING">WARNING Only</option>
          <option value="FAIL">FAIL (Out of Standard)</option>
        </select>
      </div>

      {/* Table Data */}
      <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#FBF4E1] border-b border-[#E4D0A3] text-[#5C080E] font-semibold">
                <th className="py-2.5 px-3">Inspection No.</th>
                <th className="py-2.5 px-3">Date &amp; Shift</th>
                <th className="py-2.5 px-3">Form Description</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Inspector</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Result</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE2C2]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6E524B]">
                    No inspection records found matching the active filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const isRecApproved = item.status === 'Approved';
                  const rowCanEdit = canEditSaved && !isRecApproved;
                  const rowCanDelete = canDeleteSaved;

                  return (
                    <tr key={item.id} className="hover:bg-[#FCF3DE] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#8B0A12] tabular-nums whitespace-nowrap">
                        {item.inspectionNo}
                      </td>
                      <td className="py-2.5 px-3 text-[#2B1114] tabular-nums whitespace-nowrap">
                        <div>{item.inspectionDate}</div>
                        <div className="text-[10px] text-[#6E524B]">{item.shiftName.split(' ')[0]}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#2B1114] flex items-center gap-1.5">
                          <span className="font-mono text-[10px] bg-[#FDF5DC] text-[#7A560B] px-1.5 py-0.5 rounded border border-[#DFC378] tabular-nums">
                            {item.formCode}
                          </span>
                          <span>{item.formTitle.split('–')[1]?.trim() || item.formTitle}</span>
                        </div>
                        <div className="text-[10px] text-[#6E524B] mt-0.5">
                          Quality: {item.qualityName}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#2B1114]">{item.departmentName}</td>
                      <td className="py-2.5 px-3 text-[#2B1114]">{item.inspectorName}</td>
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
                            className="px-2 py-1 bg-[#FDF5DC] text-[#7A560B] hover:bg-[#F5E4AE] rounded text-xs font-bold inline-flex items-center gap-1 border border-[#DFC378] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>Open</span>
                            <ArrowUpRight size={13} />
                          </button>

                          <button
                            id={`edit-rec-${item.id}`}
                            disabled={!rowCanEdit}
                            onClick={() => {
                              if (!rowCanEdit) return;
                              navigate(`/inspection/${item.id}`);
                            }}
                            title={
                              isRecApproved
                                ? 'Approved records are permanently locked'
                                : !canEditSaved
                                ? 'Locked — Ask Admin to enable Edit permission in Users & Form Permissions'
                                : 'Edit Inspection Data'
                            }
                            className={`p-1.5 rounded border transition-colors shrink-0 ${
                              rowCanEdit
                                ? 'text-[#8B0A12] bg-[#FFFDF8] border-[#E4D0A3] hover:bg-[#8B0A12] hover:text-[#FFFDF8] cursor-pointer'
                                : 'text-[#9E857C] bg-[#FBF4E1]/60 border-[#EFE2C2] cursor-not-allowed opacity-70'
                            }`}
                          >
                            {rowCanEdit ? <Edit2 size={13} /> : <Lock size={12} />}
                          </button>

                          <button
                            id={`del-rec-${item.id}`}
                            disabled={!rowCanDelete}
                            onClick={() => {
                              if (!rowCanDelete) return;
                              setDeleteTarget(item);
                            }}
                            title={
                              rowCanDelete
                                ? 'Delete Inspection'
                                : 'Locked — Ask Admin to enable Delete permission in Users & Form Permissions'
                            }
                            className={`p-1.5 rounded border transition-colors shrink-0 ${
                              rowCanDelete
                                ? 'text-[#8B0A12] bg-[#FFFDF8] border-rose-200 hover:bg-rose-50 cursor-pointer'
                                : 'text-[#9E857C] bg-[#FBF4E1]/60 border-[#EFE2C2] cursor-not-allowed opacity-70'
                            }`}
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-[#2B1114]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF8] rounded-xl max-w-sm w-full p-5 shadow-2xl border border-[#DFC378] space-y-3">
            <div className="flex items-center gap-2 text-[#8B0A12] font-bold text-sm">
              <AlertTriangle size={18} />
              <span>Confirm Inspection Deletion</span>
            </div>
            <p className="text-xs text-[#6E524B]">
              Are you sure you want to permanently delete inspection{' '}
              <strong className="text-[#2B1114] font-mono">{deleteTarget.inspectionNo}</strong>?
              This will remove the entry from browser storage, PostgreSQL database, and record an audit log.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 border border-[#E4D0A3] text-[#5C080E] text-xs font-semibold rounded-lg hover:bg-[#FBF4E1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={async () => {
                  if (!canDeleteSaved || !canViewRecord(deleteTarget) || deleteBusy) return;
                  setDeleteBusy(true);
                  try {
                    if (postgresService.isSyncEnabled()) {
                      const pgRes = await postgresService.deleteInspectionFromPostgresDetailed(
                        deleteTarget.inspectionNo
                      );
                      if (!pgRes.success) {
                        setActionNotice({
                          type: 'error',
                          text: pgRes.message || 'Server denied inspection deletion.',
                        });
                        setDeleteTarget(null);
                        return;
                      }
                    }
                    dataService.deleteInspection(deleteTarget.id, currentUser);
                    setActionNotice({
                      type: 'success',
                      text: `Deleted inspection ${deleteTarget.inspectionNo}.`,
                    });
                    setDeleteTarget(null);
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
                className="px-3.5 py-1.5 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] text-xs font-bold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {deleteBusy ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
