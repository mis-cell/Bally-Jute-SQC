import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  ArrowUpRight,
  TrendingUp,
  Building,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { StatCard, StatusBadge, ResultBadge } from '../components/common/Badges';
import { FORM_REGISTRY } from '../constants/formsRegistry';
import { useRealtimeData } from '../hooks/useRealtimeSync';

export const DashboardPage: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    permittedForms,
    canAccessModule,
    canAccessForm,
    canViewRecord,
    hasPermission,
  } = useAuth();
  const navigate = useNavigate();
  const rawInspections = useRealtimeData(() => dataService.getInspections());
  const inspections = rawInspections.filter(rec => canViewRecord(rec));

  // Metric aggregates
  const total = inspections.length;
  const drafts = inspections.filter(i => i.status === 'Draft').length;
  const submitted = inspections.filter(i => i.status === 'Submitted').length;
  const approved = inspections.filter(i => i.status === 'Approved').length;
  const rejected = inspections.filter(i => i.status === 'Rejected').length;
  const returned = inspections.filter(i => i.status === 'Returned').length;
  const outOfStandard = inspections.filter(i => i.result === 'FAIL').length;

  // Department counts
  const deptMap: Record<string, number> = {};
  inspections.forEach(i => {
    deptMap[i.departmentName] = (deptMap[i.departmentName] || 0) + 1;
  });

  // Recent inspections
  const recentList = [...inspections]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 7);

  // Quick form shortcuts filtered to forms the user may access
  const candidateForms = ['FORM-01', 'FORM-10', 'FORM-16', 'FORM-20', 'FORM-23', 'FORM-29'];
  const popularForms = candidateForms.filter(f => canAccessForm(f));
  const fallbackForms =
    popularForms.length > 0 ? popularForms : permittedForms.slice(0, 6).filter(f => canAccessForm(f));
  const canCreateEntry = hasPermission('CREATE') && permittedForms.length > 0;
  const scopeLabel = isAdmin ? 'ALL (Admin)' : currentUser.dataScope || 'OWN';

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-[#FFFDF8] rounded-xl p-5 border border-[#E4D0A3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-[#9B6E14] uppercase tracking-wider">
            SQC Mill Floor System · Bally Jute Co. Ltd.
          </p>
          <h2 className="text-xl font-bold text-[#2B1114] mt-1">SQC Dashboard</h2>
          <p className="text-xs text-[#6E524B] mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              Logged in as <strong className="text-[#5C080E]">{currentUser.displayName}</strong> (
              {currentUser.role})
            </span>
            <span className="px-2 py-0.5 rounded bg-[#FDF5DC] text-[#7A560B] border border-[#DFC378] text-[10px] font-bold font-mono">
              Scope: {scopeLabel}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canCreateEntry && (
            <button
              id="dash-new-inspection-btn"
              onClick={() => navigate(`/new-inspection?form=${encodeURIComponent(permittedForms[0])}`)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] rounded-lg text-xs font-bold hover:from-[#68050B] hover:to-[#4E0308] border border-[#D4AF37]/40 transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle size={15} />
              <span>New Inspection Entry</span>
            </button>
          )}
          {canAccessModule('REPORTS') && (
            <button
              id="dash-view-all-reports-btn"
              onClick={() => navigate('/reports')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#FBF4E1] border border-[#E4D0A3] text-[#5C080E] rounded-lg text-xs font-semibold hover:bg-[#FDF5DC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Generate Reports</span>
            </button>
          )}
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
            <div className="bg-[#FDF5DC]/75 border border-[#DFC378] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#7A560B] uppercase tracking-wider">
                  Attention Required: Pending Inspection Approvals ({submitted})
                </h3>
                {canAccessModule('APPROVALS') && (
                  <button
                    id="dash-view-approvals-link"
                    onClick={() => navigate('/approvals')}
                    className="text-xs text-[#8B0A12] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Review Workflow</span>
                    <ArrowUpRight size={13} />
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#DFC378] text-[#5C080E] font-semibold">
                      <th className="py-2 px-2">Inspection #</th>
                      <th className="py-2 px-2">Form</th>
                      <th className="py-2 px-2">Department</th>
                      <th className="py-2 px-2">Submitted By</th>
                      <th className="py-2 px-2">Result</th>
                      <th className="py-2 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE2C2]">
                    {inspections
                      .filter(i => i.status === 'Submitted')
                      .slice(0, 4)
                      .map(item => (
                        <tr key={item.id} className="hover:bg-[#FBF4E1]">
                          <td className="py-2 px-2 font-mono font-bold text-[#8B0A12] tabular-nums">
                            {item.inspectionNo}
                          </td>
                          <td className="py-2 px-2 text-[#2B1114] font-mono">{item.formCode}</td>
                          <td className="py-2 px-2 text-[#2B1114]">{item.departmentName}</td>
                          <td className="py-2 px-2 text-[#2B1114]">
                            {item.submittedBy || item.inspectorName}
                          </td>
                          <td className="py-2 px-2">
                            <ResultBadge result={item.result} />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              id={`dash-review-btn-${item.id}`}
                              onClick={() => navigate(`/inspection/${item.id}`)}
                              className="px-2.5 py-1 bg-[#8B0A12] text-[#FFFDF8] rounded text-[11px] font-semibold hover:bg-[#68050B] cursor-pointer whitespace-nowrap"
                            >
                              Open &amp; Review
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
          <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#2B1114]">Recent Inspection Activities</h3>
                <p className="text-xs text-[#6E524B]">
                  Authorized records matching your assigned module &amp; data scope
                </p>
              </div>
              {canAccessModule('INSPECTIONS') && (
                <button
                  id="dash-view-all-inspections"
                  onClick={() => navigate('/inspections')}
                  className="text-xs text-[#8B0A12] hover:underline font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <span>View Full Registry</span>
                  <ArrowUpRight size={13} />
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#E4D0A3] text-[#5C080E] font-semibold bg-[#FBF4E1]">
                    <th className="py-2.5 px-3">Inspection #</th>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Form Description</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE2C2]">
                  {recentList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#6E524B]">
                        No inspection records found. Start live production entries using &quot;New Inspection Entry&quot;.
                      </td>
                    </tr>
                  ) : (
                    recentList.map(rec => (
                      <tr key={rec.id} className="hover:bg-[#FCF3DE] transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#8B0A12] tabular-nums">
                          {rec.inspectionNo}
                        </td>
                        <td className="py-2.5 px-3 text-[#2B1114] tabular-nums whitespace-nowrap">
                          {rec.inspectionDate}{' '}
                          <span className="text-[10px] text-[#6E524B]">{rec.inspectionTime}</span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#2B1114]">
                          <span className="font-mono text-[#7A560B] font-bold mr-1.5 tabular-nums">
                            {rec.formCode}
                          </span>
                          {rec.formTitle.split('–')[1]?.trim() || rec.formTitle}
                        </td>
                        <td className="py-2.5 px-3 text-[#2B1114]">{rec.departmentName}</td>
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
                            className="text-xs font-semibold text-[#8B0A12] hover:bg-[#FDF5DC] px-2 py-1 rounded whitespace-nowrap cursor-pointer"
                          >
                            View / Check
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Launch & Department Statistics */}
        <div className="space-y-6">
          {/* Quick Form Launchpad */}
          <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] p-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#5C080E] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers size={14} className="text-[#8B0A12]" />
              <span>Permitted Form Quick Launch</span>
            </h3>
            <p className="text-[11px] text-[#6E524B] mb-3">
              Direct access to digital quality forms granted to your account
            </p>

            {fallbackForms.length === 0 ? (
              <div className="p-3 rounded-lg bg-[#FCF8EE] border border-[#E4D0A3] text-[11px] text-[#6E524B]">
                No inspection forms are assigned to your account.
              </div>
            ) : (
              <div className="space-y-2">
                {fallbackForms.map(fCode => {
                  const meta = FORM_REGISTRY[fCode];
                  if (!meta) return null;
                  return (
                    <button
                      key={fCode}
                      id={`quick-launch-${fCode.toLowerCase()}`}
                      onClick={() => navigate(`/new-inspection?form=${fCode}`)}
                      className="w-full text-left p-2.5 rounded-lg border border-[#EFE2C2] hover:border-[#DFC378] hover:bg-[#FBF4E1] transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#2B1114] flex items-center gap-1.5">
                          <span className="font-mono text-[#FFFDF8] bg-[#8B0A12] px-1.5 py-0.5 rounded text-[10px] tabular-nums shrink-0">
                            {meta.code}
                          </span>
                          <span className="group-hover:text-[#8B0A12] truncate">{meta.title}</span>
                        </div>
                        <p className="text-[10px] text-[#6E524B] mt-0.5 truncate">
                          {meta.department} · {meta.sampleUnit}
                        </p>
                      </div>
                      <ArrowUpRight size={14} className="text-[#9B6E14] group-hover:text-[#8B0A12] shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {canCreateEntry && (
              <button
                id="dash-browse-all-forms-btn"
                onClick={() => navigate(`/new-inspection?form=${encodeURIComponent(permittedForms[0])}`)}
                className="w-full mt-3 py-2 text-center text-xs font-bold text-[#7A560B] hover:text-[#5C080E] bg-[#FDF5DC] border border-[#DFC378] rounded-lg hover:bg-[#F5E4AE] transition-colors cursor-pointer"
              >
                Open Permitted Forms ({permittedForms.length}) →
              </button>
            )}
          </div>

          {/* Department Breakdown */}
          <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] p-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#5C080E] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Building size={14} className="text-[#8B0A12]" />
              <span>Department Inspection Volume</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              {Object.entries(deptMap).length === 0 ? (
                <p className="text-[11px] text-[#6E524B]">No inspection data recorded yet.</p>
              ) : (
                Object.entries(deptMap).map(([dept, count]) => {
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex justify-between text-[#2B1114] font-medium">
                        <span>{dept}</span>
                        <span className="font-mono font-bold text-[#8B0A12] tabular-nums">
                          {count}
                        </span>
                      </div>
                      <div className="w-full bg-[#FBF4E1] rounded-full h-1.5 overflow-hidden border border-[#EFE2C2]">
                        <div
                          className="bg-gradient-to-r from-[#8B0A12] to-[#C9962B] h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
