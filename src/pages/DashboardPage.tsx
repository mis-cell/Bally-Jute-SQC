import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  ArrowUpRight,
  TrendingUp,
  Building,
  Cpu,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { StatCard, StatusBadge, ResultBadge } from '../components/common/Badges';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const inspections = dataService.getInspections();
  const settings = dataService.getSettings();

  // Metric aggregates
  const total = inspections.length;
  const drafts = inspections.filter(i => i.status === 'Draft').length;
  const submitted = inspections.filter(i => i.status === 'Submitted').length;
  const approved = inspections.filter(i => i.status === 'Approved').length;
  const rejected = inspections.filter(i => i.status === 'Rejected').length;
  const returned = inspections.filter(i => i.status === 'Returned').length;
  const outOfStandard = inspections.filter(i => i.result === 'FAIL').length;
  const warnings = inspections.filter(i => i.result === 'WARNING').length;

  // Department counts
  const deptMap: Record<string, number> = {};
  inspections.forEach(i => {
    deptMap[i.departmentName] = (deptMap[i.departmentName] || 0) + 1;
  });

  // Recent inspections
  const recentList = [...inspections].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 7);

  // Quick form shortcuts
  const popularForms = ['FORM-01', 'FORM-10', 'FORM-16', 'FORM-20', 'FORM-23', 'FORM-29'];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>SQC Mill Floor Live System</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Statistical Quality Control Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <strong className="text-slate-800">{currentUser.displayName}</strong> ({currentUser.role})
            • Mill: Bally Jute Co. Ltd.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="dash-new-inspection-btn"
            onClick={() => navigate('/new-inspection')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-800 text-white rounded-lg text-xs font-semibold hover:bg-emerald-900 transition-colors shadow-xs"
          >
            <PlusCircle size={15} />
            <span>New Inspection Entry</span>
          </button>
          <button
            id="dash-view-all-reports-btn"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
          >
            <FileSpreadsheet size={15} />
            <span>Generate Reports</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          id="stat-total"
          title="Total Inspections"
          value={total}
          subtitle="All recorded formats"
          icon={<ClipboardCheck size={18} />}
          color="slate"
        />
        <StatCard
          id="stat-drafts"
          title="Draft Records"
          value={drafts}
          subtitle="Pending inspector submit"
          icon={<Clock size={18} />}
          color="amber"
        />
        <StatCard
          id="stat-pending"
          title="Pending Approval"
          value={submitted}
          subtitle="Awaiting HOD review"
          icon={<TrendingUp size={18} />}
          color="blue"
        />
        <StatCard
          id="stat-approved"
          title="Approved (Locked)"
          value={approved}
          subtitle="Quality verified"
          icon={<CheckCircle2 size={18} />}
          color="emerald"
        />
        <StatCard
          id="stat-rejected"
          title="Rejected / Ret."
          value={rejected + returned}
          subtitle="Action required"
          icon={<RotateCcw size={18} />}
          color="rose"
        />
        <StatCard
          id="stat-failures"
          title="Out of Standard"
          value={outOfStandard}
          subtitle="Defect / Tolerance Fail"
          icon={<AlertTriangle size={18} />}
          color="rose"
        />
      </div>

      {/* Main Grid: Pending Approval Alert + Quick Form launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Activity & Pending Approvals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Approval Table if any */}
          {submitted > 0 && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Attention Required: Pending Inspection Approvals ({submitted})
                  </h3>
                </div>
                <button
                  id="dash-view-approvals-link"
                  onClick={() => navigate('/approvals')}
                  className="text-xs text-amber-800 hover:text-amber-950 font-semibold inline-flex items-center gap-1"
                >
                  <span>Review Workflow</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-amber-200 text-amber-900 font-semibold">
                      <th className="py-2 px-2">Inspection #</th>
                      <th className="py-2 px-2">Form</th>
                      <th className="py-2 px-2">Department</th>
                      <th className="py-2 px-2">Submitted By</th>
                      <th className="py-2 px-2">Result</th>
                      <th className="py-2 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {inspections
                      .filter(i => i.status === 'Submitted')
                      .slice(0, 4)
                      .map(item => (
                        <tr key={item.id} className="hover:bg-amber-100/50">
                          <td className="py-2 px-2 font-mono font-bold text-amber-900">{item.inspectionNo}</td>
                          <td className="py-2 px-2 text-slate-700">{item.formCode}</td>
                          <td className="py-2 px-2 text-slate-700">{item.departmentName}</td>
                          <td className="py-2 px-2 text-slate-700">{item.submittedBy || item.inspectorName}</td>
                          <td className="py-2 px-2">
                            <ResultBadge result={item.result} />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              id={`dash-review-btn-${item.id}`}
                              onClick={() => navigate(`/inspection/${item.id}`)}
                              className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-medium hover:bg-amber-700"
                            >
                              Open & Review
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Inspection Log */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Inspection Activities</h3>
                <p className="text-xs text-slate-500">Real-time submissions and audits across departments</p>
              </div>
              <button
                id="dash-view-all-inspections"
                onClick={() => navigate('/inspections')}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1"
              >
                <span>View Full Registry</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-3">Inspection #</th>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Form Description</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No inspection records found. Start live production entries using "New Inspection Entry".
                      </td>
                    </tr>
                  ) : (
                    recentList.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-emerald-900">
                        {rec.inspectionNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {rec.inspectionDate} <span className="text-[10px] text-slate-400">{rec.inspectionTime}</span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        <span className="font-mono text-emerald-700 mr-1.5">{rec.formCode}</span>
                        {rec.formTitle.split('–')[1]?.trim() || rec.formTitle}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{rec.departmentName}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={rec.status} />
                      </td>
                      <td className="py-2.5 px-3">
                        <ResultBadge result={rec.result} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          id={`dash-open-record-${rec.id}`}
                          onClick={() => navigate(`/inspection/${rec.id}`)}
                          className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2 py-1 rounded hover:bg-emerald-50"
                        >
                          View / Edit
                        </button>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Launch & Department Statistics */}
        <div className="space-y-6">
          {/* Quick Form Launchpad */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers size={14} className="text-emerald-700" />
              <span>High Frequency Inspection Launch</span>
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Direct access to primary digital forms defined in SQC standards
            </p>

            <div className="space-y-2">
              {popularForms.map(fCode => {
                const meta = FORM_REGISTRY[fCode];
                if (!meta) return null;
                return (
                  <button
                    key={fCode}
                    id={`quick-launch-${fCode.toLowerCase()}`}
                    onClick={() => navigate(`/new-inspection?form=${fCode}`)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                          {meta.code}
                        </span>
                        <span className="group-hover:text-emerald-950">{meta.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{meta.department} • {meta.sampleUnit}</p>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-400 group-hover:text-emerald-700" />
                  </button>
                );
              })}
            </div>

            <button
              id="dash-browse-all-forms-btn"
              onClick={() => navigate('/new-inspection')}
              className="w-full mt-3 py-2 text-center text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Browse All 36 Forms Registry →
            </button>
          </div>

          {/* Department Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Building size={14} className="text-emerald-700" />
              <span>Department Inspection Volume</span>
            </h3>

            <div className="space-y-2 text-xs">
              {Object.entries(deptMap).map(([dept, count]) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-slate-700 font-medium">
                      <span>{dept}</span>
                      <span className="font-mono font-bold text-emerald-900">{count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
