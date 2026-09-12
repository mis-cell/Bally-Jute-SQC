import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { InspectionRecord } from '../types';
import { StatusBadge, ResultBadge } from '../components/common/Badges';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();
  const [inspections, setInspections] = useState<InspectionRecord[]>(() => dataService.getInspections());
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);

  const pendingList = inspections.filter(i => i.status === 'Submitted');
  const recentlyApproved = inspections
    .filter(i => i.status === 'Approved' || i.status === 'Rejected' || i.status === 'Returned')
    .slice(0, 10);

  const canApprove = hasPermission('APPROVE');

  const handleExecuteAction = () => {
    if (!selectedRecord || !actionType) return;

    let updated: InspectionRecord | null = null;
    if (actionType === 'approve') {
      updated = dataService.approveInspection(selectedRecord.id, remarks || 'Conforms to SQC standards.', currentUser);
    } else if (actionType === 'reject') {
      updated = dataService.rejectInspection(selectedRecord.id, remarks || 'Out of specification limit.', currentUser);
    } else if (actionType === 'return') {
      updated = dataService.returnInspectionForCorrection(selectedRecord.id, remarks || 'Requires sample re-test.', currentUser);
    }

    if (updated) {
      setInspections(dataService.getInspections());
      setSelectedRecord(null);
      setActionType(null);
      setRemarks('');
      alert(`Action successfully recorded for ${updated.inspectionNo}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              Department Approvals & Compliance Workflow
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Two-stage validation for SQC quality tests: Inspector Submission → HOD / Chief SQC Locking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!canApprove && (
            <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
              <AlertCircle size={14} />
              <span>Current role ({currentUser.role}) has Read-Only access to Approvals</span>
            </div>
          )}
        </div>
      </div>

      {/* Pending Approval Inbox */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pending Inspection Submissions ({pendingList.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Awaiting HOD sign-off before manufacturing lot clearance
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Inspection #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Form Description</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Submitted By</th>
                <th className="py-2.5 px-3">Quality Verdict</th>
                <th className="py-2.5 px-3 text-right">Workflow Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    All inspection reports have been processed. No pending submissions in queue.
                  </td>
                </tr>
              ) : (
                pendingList.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-950">
                      {item.inspectionNo}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{item.inspectionDate}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-emerald-700 font-bold mr-1">{item.formCode}</span>
                      <span className="text-slate-800 font-medium">{item.formTitle}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{item.departmentName}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{item.submittedBy || item.inspectorName}</td>
                    <td className="py-2.5 px-3">
                      <ResultBadge result={item.result} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/inspection/${item.id}`)}
                          className="px-2 py-1 text-slate-700 hover:bg-slate-100 rounded border border-slate-200 text-[11px] font-medium"
                        >
                          View Form
                        </button>
                        {canApprove && (
                          <button
                            onClick={() => {
                              setSelectedRecord(item);
                              setActionType('approve');
                              setRemarks('Conforms to SQC standards. Approved for production lot.');
                            }}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold"
                          >
                            Approve
                          </button>
                        )}
                        {canApprove && (
                          <button
                            onClick={() => {
                              setSelectedRecord(item);
                              setActionType('return');
                              setRemarks('Please re-check reading values and provide verification.');
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold"
                          >
                            Return
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recently Processed Records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Recently Processed / Locked Inspections
          </h3>
          <span className="text-[11px] text-slate-500">History of approved, returned, or rejected reports</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Inspection #</th>
                <th className="py-2.5 px-3">Form</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Final Status</th>
                <th className="py-2.5 px-3">Approved / Rejected By</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentlyApproved.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.inspectionNo}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-mono">{item.formCode}</td>
                  <td className="py-2.5 px-3 text-slate-700">{item.departmentName}</td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 font-medium">
                    {item.approvedBy || item.rejectedBy || 'HOD Staff'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {item.approvedAt || item.rejectedAt ? new Date(item.approvedAt || item.rejectedAt || '').toLocaleString() : 'Recent'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => navigate(`/inspection/${item.id}`)}
                      className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedRecord && actionType && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 capitalize">
              Execute Workflow: {actionType} {selectedRecord.inspectionNo}
            </h4>
            <p className="text-xs text-slate-600">
              {selectedRecord.formTitle} ({selectedRecord.departmentName})
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Approver Notes & Instructions:
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  setActionType(null);
                }}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
