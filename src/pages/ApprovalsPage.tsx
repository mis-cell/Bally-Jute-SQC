import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { useAuth } from '../context/AuthContext';
import { InspectionRecord } from '../types';
import { StatusBadge, ResultBadge } from '../components/common/Badges';
import { useRealtimeData } from '../hooks/useRealtimeSync';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, hasPermission, canViewRecord } = useAuth();
  const rawInspections = useRealtimeData(() => dataService.getInspections());
  const inspections = rawInspections.filter(i => canViewRecord(i));
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pendingList = inspections.filter(i => i.status === 'Submitted');
  const recentlyApproved = inspections
    .filter(i => i.status === 'Approved' || i.status === 'Rejected' || i.status === 'Returned')
    .slice(0, 10);

  const canApprove = hasPermission('APPROVE');

  const handleExecuteAction = async () => {
    if (!selectedRecord || !actionType || submitting) return;
    if (!canApprove || !canViewRecord(selectedRecord)) {
      setFeedback({ type: 'error', text: 'Forbidden: You are not authorized to approve or return this record.' });
      setSelectedRecord(null);
      setActionType(null);
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    const nowIso = new Date().toISOString();
    const statusMap = {
      approve: 'Approved',
      reject: 'Rejected',
      return: 'Returned',
    } as const;
    const newStatus = statusMap[actionType];
    const updated: InspectionRecord = {
      ...selectedRecord,
      status: newStatus,
      approvedBy: actionType === 'approve' ? currentUser.displayName : undefined,
      approvedAt: actionType === 'approve' ? nowIso : undefined,
      rejectedBy: actionType === 'reject' ? currentUser.displayName : undefined,
      rejectedAt: actionType === 'reject' ? nowIso : undefined,
      approvalRemarks: remarks || (actionType === 'approve' ? 'Conforms to SQC standards.' : 'Reviewed by HOD.'),
      version: (selectedRecord.version || 1) + 1,
      updatedBy: currentUser.displayName,
      updatedAt: nowIso,
    };

    dataService.upsertInMemoryInspection(updated);
    const pgRes = await postgresService.syncInspectionToPostgres(updated);
    setFeedback({
      type: pgRes.success ? 'success' : 'error',
      text: pgRes.success
        ? `${updated.inspectionNo} (${updated.status}) saved to PostgreSQL.`
        : `PostgreSQL sync failed: ${pgRes.message}`,
    });
    setSelectedRecord(null);
    setActionType(null);
    setRemarks('');
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-[#FFFDF8] rounded-xl p-4 border border-[#E4D0A3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#8B0A12]" />
            <h2 className="text-base font-bold text-[#2B1114]">
              Department Approvals &amp; Compliance Workflow
            </h2>
          </div>
          <p className="text-xs text-[#6E524B] mt-0.5">
            Two-stage validation for SQC quality tests: Inspector Submission → HOD / Chief SQC Locking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!canApprove && (
            <div className="text-xs bg-[#FDF5DC] text-[#7A560B] border border-[#DFC378] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
              <AlertCircle size={14} />
              <span>Current role ({currentUser.role}) has Read-Only access to Approvals</span>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Pending Approval Inbox */}
      <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] shadow-xs overflow-hidden">
        <div className="p-3.5 bg-[#FBF4E1] border-b border-[#E4D0A3] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#9B6E14]" />
            <h3 className="text-xs font-bold text-[#5C080E] uppercase tracking-wider">
              Pending Inspection Submissions ({pendingList.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#6E524B]">
            Awaiting HOD sign-off before manufacturing lot clearance
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
                <th className="py-2.5 px-3">Submitted By</th>
                <th className="py-2.5 px-3">Quality Verdict</th>
                <th className="py-2.5 px-3 text-right">Workflow Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE2C2]">
              {pendingList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6E524B] font-medium">
                    All inspection reports have been processed. No pending submissions in queue.
                  </td>
                </tr>
              ) : (
                pendingList.map(item => (
                  <tr key={item.id} className="hover:bg-[#FCF3DE] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#8B0A12] tabular-nums">
                      {item.inspectionNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114] tabular-nums">{item.inspectionDate}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[#7A560B] font-bold mr-1 tabular-nums">
                        {item.formCode}
                      </span>
                      <span className="text-[#2B1114] font-medium">{item.formTitle}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114]">{item.departmentName}</td>
                    <td className="py-2.5 px-3 text-[#2B1114] font-medium">
                      {item.submittedBy || item.inspectorName}
                    </td>
                    <td className="py-2.5 px-3">
                      <ResultBadge result={item.result} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/inspection/${item.id}`)}
                          className="px-2 py-1 text-[#5C080E] hover:bg-[#FBF4E1] rounded border border-[#E4D0A3] text-[11px] font-medium whitespace-nowrap cursor-pointer"
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
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold whitespace-nowrap cursor-pointer"
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
                            className="px-2.5 py-1 bg-[#C9962B] hover:bg-[#9B6E14] text-[#FFFDF8] rounded text-[11px] font-bold whitespace-nowrap cursor-pointer"
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
      <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] shadow-xs overflow-hidden">
        <div className="p-3.5 bg-[#FBF4E1] border-b border-[#E4D0A3] flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-[#5C080E] uppercase tracking-wider">
            Recently Processed / Locked Inspections
          </h3>
          <span className="text-[11px] text-[#6E524B]">
            History of approved, returned, or rejected reports
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#FBF4E1] border-b border-[#E4D0A3] text-[#5C080E] font-semibold">
                <th className="py-2.5 px-3">Inspection #</th>
                <th className="py-2.5 px-3">Form</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Final Status</th>
                <th className="py-2.5 px-3">Approved / Rejected By</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE2C2]">
              {recentlyApproved.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#6E524B]">
                    No approved, rejected, or returned inspections on record.
                  </td>
                </tr>
              ) : (
                recentlyApproved.map(item => (
                  <tr key={item.id} className="hover:bg-[#FCF3DE] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#8B0A12] tabular-nums">
                      {item.inspectionNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114] font-mono tabular-nums">
                      {item.formCode}
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114]">{item.departmentName}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114] font-medium">
                      {item.approvedBy || item.rejectedBy || 'HOD Staff'}
                    </td>
                    <td className="py-2.5 px-3 text-[#6E524B] tabular-nums">
                      {item.approvedAt || item.rejectedAt
                        ? new Date(item.approvedAt || item.rejectedAt || '').toLocaleString()
                        : 'Recent'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => navigate(`/inspection/${item.id}`)}
                        className="text-xs font-semibold text-[#8B0A12] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>View</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedRecord && actionType && (
        <div className="fixed inset-0 bg-[#2B1114]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF8] rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#DFC378] space-y-4">
            <h4 className="text-sm font-bold text-[#2B1114] capitalize">
              Execute Workflow: {actionType} {selectedRecord.inspectionNo}
            </h4>
            <p className="text-xs text-[#6E524B]">
              {selectedRecord.formTitle} ({selectedRecord.departmentName})
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#5C080E] mb-1">
                Approver Notes &amp; Instructions:
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg p-2 text-xs text-[#2B1114]"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  setActionType(null);
                }}
                className="px-3 py-1.5 border border-[#E4D0A3] text-[#5C080E] text-xs rounded-lg hover:bg-[#FBF4E1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                className="px-4 py-1.5 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] text-xs font-bold rounded-lg shadow-xs cursor-pointer"
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
