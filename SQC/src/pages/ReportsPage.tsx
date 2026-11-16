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
      <div className="bg-[#FFFDF8] rounded-xl p-4 border border-[#E4D0A3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#2B1114] flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-[#8B0A12]" />
            <span>SQC Department Quality &amp; Statistical Reports</span>
          </h2>
          <p className="text-xs text-[#6E524B] mt-0.5">
            Statistical aggregation of floor inspections, count variations, moisture, and bag specs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 border border-[#E4D0A3] bg-[#FFFDF8] hover:bg-[#FBF4E1] text-[#5C080E] text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#8B0A12] to-[#68050B] hover:from-[#68050B] hover:to-[#4E0308] text-[#FFFDF8] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs border border-[#D4AF37]/40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Parameters */}
      <div className="bg-[#FFFDF8] rounded-xl p-3.5 border border-[#E4D0A3] shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-[#5C080E] mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded px-2 py-1.5 text-xs text-[#2B1114] tabular-nums"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#5C080E] mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded px-2 py-1.5 text-xs text-[#2B1114] tabular-nums"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#5C080E] mb-1">Department</label>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            aria-label="Filter by Department"
            className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded px-2 py-1.5 text-xs text-[#2B1114]"
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
          <label className="block text-[11px] font-semibold text-[#5C080E] mb-1">Quality</label>
          <select
            value={selectedQuality}
            onChange={e => setSelectedQuality(e.target.value)}
            aria-label="Filter by Quality"
            className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded px-2 py-1.5 text-xs text-[#2B1114]"
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
          <label className="block text-[11px] font-semibold text-[#5C080E] mb-1">Form Format</label>
          <select
            value={selectedForm}
            onChange={e => setSelectedForm(e.target.value)}
            aria-label="Filter by Form Format"
            className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded px-2 py-1.5 text-xs text-[#2B1114]"
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
        <div className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E4D0A3]">
          <span className="text-xs text-[#6E524B] font-semibold uppercase">Total Inspections</span>
          <p className="text-2xl font-bold text-[#2B1114] mt-1 font-mono tabular-nums">{total}</p>
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
        <div className="bg-[#FDF5DC] p-4 rounded-xl border border-[#DFC378]">
          <span className="text-xs text-[#7A560B] font-semibold uppercase">Borderline Warnings</span>
          <p className="text-2xl font-bold text-[#7A560B] mt-1 font-mono tabular-nums">{warned}</p>
          <span className="text-[10px] text-[#9B6E14]">Near Tolerance Limit</span>
        </div>
        <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200">
          <span className="text-xs text-[#8B0A12] font-semibold uppercase">
            Out of Standard Fails
          </span>
          <p className="text-2xl font-bold text-[#8B0A12] mt-1 font-mono tabular-nums">{failed}</p>
          <span className="text-[10px] text-[#8B0A12]">Defect Occurrences</span>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] shadow-xs overflow-hidden">
        <div className="p-3.5 bg-[#FBF4E1] border-b border-[#E4D0A3] flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-[#5C080E] uppercase tracking-wider">
            Report Data Rows ({filtered.length})
          </h3>
          <span className="text-[11px] text-[#6E524B] font-mono">
            Bally Jute S.Q.C. Internal Audit Copy
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#FBF4E1] border-b border-[#E4D0A3] text-[#5C080E] font-semibold">
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
            <tbody className="divide-y divide-[#EFE2C2]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#6E524B]">
                    No inspection records found for the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-[#FCF3DE] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#8B0A12] tabular-nums">
                      {item.inspectionNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114] tabular-nums">
                      {item.inspectionDate}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[#7A560B] font-bold mr-1 tabular-nums">
                        {item.formCode}
                      </span>
                      <span className="text-[#2B1114] font-medium">
                        {item.formTitle.split('–')[1]?.trim() || item.formTitle}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114]">{item.departmentName}</td>
                    <td className="py-2.5 px-3 text-[#2B1114]">{item.qualityName}</td>
                    <td className="py-2.5 px-3 text-[#2B1114]">{item.shiftName.split(' ')[0]}</td>
                    <td className="py-2.5 px-3 text-[#2B1114]">{item.inspectorName}</td>
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
