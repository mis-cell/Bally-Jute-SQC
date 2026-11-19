import React, { useState } from 'react';
import { FileSpreadsheet, Download, Printer } from 'lucide-react';
import { dataService } from '../services/dataService';
import { FORM_REGISTRY } from '../constants/formsRegistry';
import { ResultBadge, StatusBadge } from '../components/common/Badges';
import { useRealtimeData } from '../hooks/useRealtimeSync';
import { useAuth } from '../context/AuthContext';

export const ReportsPage: React.FC = () => {
  const { isAdmin, canAccessModule, canAccessForm, canViewRecord } = useAuth();
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedQuality, setSelectedQuality] = useState('ALL');
  const [selectedForm, setSelectedForm] = useState('ALL');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const rawInspections = useRealtimeData(() => dataService.getInspections());
  const inspections = rawInspections.filter(item => canViewRecord(item));
  const departments = useRealtimeData(() => dataService.getDepartments());
  const qualities = useRealtimeData(() => dataService.getQualities());

  const filtered = inspections.filter(item => {
    const matchDept = selectedDept === 'ALL' || item.departmentName === selectedDept;
    const matchQual = selectedQuality === 'ALL' || item.qualityId === selectedQuality;
    const matchForm = selectedForm === 'ALL' || item.formCode === selectedForm;
    const matchDate =
      (!startDate || item.inspectionDate >= startDate) &&
      (!endDate || item.inspectionDate <= endDate);
    return matchDept && matchQual && matchForm && matchDate;
  });

  const total = filtered.length;
  const passed = filtered.filter(i => i.result === 'PASS').length;
  const warned = filtered.filter(i => i.result === 'WARNING').length;
  const failed = filtered.filter(i => i.result === 'FAIL').length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '100.0';

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Inspection No',
      'Date',
      'Form Code',
      'Form Title',
      'Department',
      'Inspector',
      'Quality',
      'Status',
      'Result',
    ];
    const rows = filtered.map(i => [
      i.inspectionNo,
      i.inspectionDate,
      i.formCode,
      `"${i.formTitle.replace(/"/g, '""')}"`,
      `"${i.departmentName}"`,
      `"${i.inspectorName}"`,
      `"${i.qualityName}"`,
      i.status,
      i.result,
    ]);

    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Bally_Jute_SQC_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-[#FFFFFF] rounded-xl p-4 border border-[#F5D0CB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#393334] flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-[#EA5551]" />
            <span>SQC Department Quality &amp; Statistical Reports</span>
          </h2>
          <p className="text-xs text-[#806B68] mt-0.5">
            Statistical aggregation of floor inspections, count variations, moisture, and bag specs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 border border-[#F5D0CB] bg-[#FFFFFF] hover:bg-[#FFF1EE] text-[#EA5551] text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#EA5551] to-[#D46764] hover:from-[#D46764] hover:to-[#EA5551] text-[#FFFFFF] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs border border-[#FFE0DA]/40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Parameters */}
      <div className="bg-[#FFFFFF] rounded-xl p-3.5 border border-[#F5D0CB] shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-[#EA5551] mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded px-2 py-1.5 text-xs text-[#393334] tabular-nums"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#EA5551] mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded px-2 py-1.5 text-xs text-[#393334] tabular-nums"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#EA5551] mb-1">Department</label>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            aria-label="Filter by Department"
            className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded px-2 py-1.5 text-xs text-[#393334]"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#EA5551] mb-1">Quality</label>
          <select
            value={selectedQuality}
            onChange={e => setSelectedQuality(e.target.value)}
            aria-label="Filter by Quality"
            className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded px-2 py-1.5 text-xs text-[#393334]"
          >
            <option value="ALL">All Qualities</option>
            {qualities.map(q => (
              <option key={q.id} value={q.id}>
                {q.code} - {q.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#EA5551] mb-1">Form Format</label>
          <select
            value={selectedForm}
            onChange={e => setSelectedForm(e.target.value)}
            aria-label="Filter by Form Format"
            className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded px-2 py-1.5 text-xs text-[#393334]"
          >
            <option value="ALL">All Authorized Forms</option>
            {Object.values(FORM_REGISTRY)
              .filter(f => isAdmin || canAccessModule('APPROVALS') || canAccessForm(f.code))
              .map(f => (
                <option key={f.code} value={f.code}>
                  {f.code}: {f.title.split('–')[1]?.trim() || f.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Aggregate KPI Summary for Report */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#F5D0CB]">
          <span className="text-xs text-[#806B68] font-semibold uppercase">Total Inspections</span>
          <p className="text-2xl font-bold text-[#393334] mt-1 font-mono tabular-nums">{total}</p>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
          <span className="text-xs text-emerald-800 font-semibold uppercase">
            Pass Compliance Rate
          </span>
          <p className="text-2xl font-bold text-emerald-900 mt-1 font-mono tabular-nums">
            {passRate}%
          </p>
          <span className="text-[10px] text-emerald-700 tabular-nums">{passed} Passed</span>
        </div>
        <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#F5D0CB]">
          <span className="text-xs text-[#EA5551] font-semibold uppercase">Borderline Warnings</span>
          <p className="text-2xl font-bold text-[#EA5551] mt-1 font-mono tabular-nums">{warned}</p>
          <span className="text-[10px] text-[#EA5551]">Near Tolerance Limit</span>
        </div>
        <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200">
          <span className="text-xs text-[#EA5551] font-semibold uppercase">
            Out of Standard Fails
          </span>
          <p className="text-2xl font-bold text-[#EA5551] mt-1 font-mono tabular-nums">{failed}</p>
          <span className="text-[10px] text-[#EA5551]">Defect Occurrences</span>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-[#FFFFFF] rounded-xl border border-[#F5D0CB] shadow-xs overflow-hidden">
        <div className="p-3.5 bg-[#FFF1EE] border-b border-[#F5D0CB] flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-[#EA5551] uppercase tracking-wider">
            Report Data Rows ({filtered.length})
          </h3>
          <span className="text-[11px] text-[#806B68] font-mono">
            Bally Jute S.Q.C. Internal Audit Copy
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-semibold">
                <th className="py-2.5 px-3">Inspection #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Form Description</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Quality</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3">Inspector</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#806B68]">
                    No inspection records found for the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-[#FFEAE6] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551] tabular-nums">
                      {item.inspectionNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#393334] tabular-nums">
                      {item.inspectionDate}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[#EA5551] font-bold mr-1 tabular-nums">
                        {item.formCode}
                      </span>
                      <span className="text-[#393334] font-medium">
                        {item.formTitle.split('–')[1]?.trim() || item.formTitle}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#393334]">{item.departmentName}</td>
                    <td className="py-2.5 px-3 text-[#393334]">{item.qualityName}</td>
                    <td className="py-2.5 px-3 text-[#393334]">{item.shiftName.split(' ')[0]}</td>
                    <td className="py-2.5 px-3 text-[#393334]">{item.inspectorName}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      <ResultBadge result={item.result} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
