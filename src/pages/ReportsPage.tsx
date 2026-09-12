import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  Printer,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { FORM_REGISTRY } from '../constants/formsRegistry';
import { ResultBadge, StatusBadge } from '../components/common/Badges';

export const ReportsPage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedQuality, setSelectedQuality] = useState('ALL');
  const [selectedForm, setSelectedForm] = useState('ALL');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const inspections = dataService.getInspections();
  const departments = dataService.getDepartments();
  const qualities = dataService.getQualities();

  const filtered = inspections.filter(item => {
    const matchDept = selectedDept === 'ALL' || item.departmentName === selectedDept;
    const matchQual = selectedQuality === 'ALL' || item.qualityId === selectedQuality;
    const matchForm = selectedForm === 'ALL' || item.formCode === selectedForm;
    const matchDate = (!startDate || item.inspectionDate >= startDate) && (!endDate || item.inspectionDate <= endDate);
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
    const headers = ['Inspection No', 'Date', 'Form Code', 'Form Title', 'Department', 'Inspector', 'Quality', 'Status', 'Result'];
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

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Bally_Jute_SQC_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-700" />
            <span>SQC Department Quality & Statistical Reports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical aggregation of floor inspections, count variations, moisture, and bag specs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Parameters */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Department</label>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            aria-label="Filter by Department"
            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800"
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
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Quality</label>
          <select
            value={selectedQuality}
            onChange={e => setSelectedQuality(e.target.value)}
            aria-label="Filter by Quality"
            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800"
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
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Form Format</label>
          <select
            value={selectedForm}
            onChange={e => setSelectedForm(e.target.value)}
            aria-label="Filter by Form Format"
            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800"
          >
            <option value="ALL">All 36 Forms</option>
            {Object.values(FORM_REGISTRY).map(f => (
              <option key={f.code} value={f.code}>
                {f.code}: {f.title.split('–')[1]?.trim() || f.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Aggregate KPI Summary for Report */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Inspections</span>
          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{total}</p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
          <span className="text-xs text-emerald-800 font-semibold uppercase">Pass Compliance Rate</span>
          <p className="text-2xl font-bold text-emerald-900 mt-1 font-mono">{passRate}%</p>
          <span className="text-[10px] text-emerald-700">{passed} Passed</span>
        </div>
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
          <span className="text-xs text-amber-800 font-semibold uppercase">Borderline Warnings</span>
          <p className="text-2xl font-bold text-amber-900 mt-1 font-mono">{warned}</p>
          <span className="text-[10px] text-amber-700">Near Tolerance Limit</span>
        </div>
        <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200">
          <span className="text-xs text-rose-800 font-semibold uppercase">Out of Standard Fails</span>
          <p className="text-2xl font-bold text-rose-900 mt-1 font-mono">{failed}</p>
          <span className="text-[10px] text-rose-700">Defect Occurrences</span>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Report Data Rows ({filtered.length})
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Bally Jute S.Q.C. Internal Audit Copy</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
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
            <tbody className="divide-y divide-slate-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.inspectionNo}</td>
                  <td className="py-2.5 px-3 text-slate-700">{item.inspectionDate}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-emerald-800 font-bold mr-1">{item.formCode}</span>
                    <span className="text-slate-800 font-medium">{item.formTitle.split('–')[1]?.trim() || item.formTitle}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{item.departmentName}</td>
                  <td className="py-2.5 px-3 text-slate-700">{item.qualityName}</td>
                  <td className="py-2.5 px-3 text-slate-700">{item.shiftName.split(' ')[0]}</td>
                  <td className="py-2.5 px-3 text-slate-700">{item.inspectorName}</td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-2.5 px-3">
                    <ResultBadge result={item.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
