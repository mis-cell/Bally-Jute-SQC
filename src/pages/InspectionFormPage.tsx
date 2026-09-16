import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Printer,
  FileText,
  Plus,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';
import { FORM_REGISTRY, FormMetadata } from '../constants/formsRegistry';
import { dataService } from '../services/dataService';
import { postgresService, PostgresSyncResult } from '../services/postgresService';
import { useAuth } from '../context/AuthContext';
import { InspectionRecord, InspectionStatus, InspectionResult } from '../types';
import { StatusBadge, ResultBadge } from '../components/common/Badges';
import { Database, RefreshCw, ExternalLink } from 'lucide-react';

export const InspectionFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();

  const [existingRecord, setExistingRecord] = useState<InspectionRecord | null>(null);
  const [selectedFormCode, setSelectedFormCode] = useState<string>('FORM-01');
  const [pgSyncStatus, setPgSyncStatus] = useState<PostgresSyncResult | null>(null);
  const [isSyncingToPg, setIsSyncingToPg] = useState(false);

  // Load existing or new
  useEffect(() => {
    if (id) {
      const rec = dataService.getInspectionById(id);
      if (rec) {
        setExistingRecord(rec);
        setSelectedFormCode(rec.formCode);
        setFormData(rec.formData || {});
        setReadingRows(rec.readingRows || []);
        setRemarks(rec.remarks || '');
        setGeneralInfo({
          inspectionNo: rec.inspectionNo,
          inspectionDate: rec.inspectionDate,
          inspectionTime: rec.inspectionTime,
          shiftId: rec.shiftId,
          shiftName: rec.shiftName,
          qualityId: rec.qualityId,
          qualityName: rec.qualityName,
          departmentId: rec.departmentId,
          departmentName: rec.departmentName,
          machineNo: rec.machineNo || '',
          loomNo: rec.loomNo || '',
        });
      }
    } else {
      const qCode = searchParams.get('form') || 'FORM-01';
      if (FORM_REGISTRY[qCode]) {
        setSelectedFormCode(qCode);
      }
    }
  }, [id, searchParams]);

  const formMeta: FormMetadata = FORM_REGISTRY[selectedFormCode] || FORM_REGISTRY['FORM-01'];

  // Master options
  const departments = dataService.getDepartments();
  const qualities = dataService.getQualities();
  const machines = dataService.getMachines();
  const looms = dataService.getLooms();

  // General form metadata
  const [generalInfo, setGeneralInfo] = useState({
    inspectionNo: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    inspectionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    shiftId: 'Shift-A',
    shiftName: 'Shift A (06:00 - 14:00)',
    qualityId: qualities[0]?.id || 'q-1',
    qualityName: qualities[0]?.name || 'Standard Quality',
    departmentId: formMeta.departmentCode,
    departmentName: formMeta.department,
    machineNo: '',
    loomNo: '',
  });

  // Dynamic form fields
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [readingRows, setReadingRows] = useState<Record<string, any>[]>([]);
  const [remarks, setRemarks] = useState('');
  const [approvalActionModal, setApprovalActionModal] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [workflowRemarks, setWorkflowRemarks] = useState('');

  // Initialize fields and rows for new record
  useEffect(() => {
    if (!id) {
      // Default form fields
      const initFields: Record<string, any> = {};
      formMeta.fields.forEach(f => {
        if (f.defaultValue !== undefined) initFields[f.key] = f.defaultValue;
      });
      setFormData(initFields);

      // Default rows
      const initRows: Record<string, any>[] = [];
      for (let i = 1; i <= formMeta.defaultRowCount; i++) {
        const row: Record<string, any> = { sampleNo: i, rollNo: i, pieceNo: i, bagNo: i, bagSampleNo: i };
        formMeta.columns.forEach(c => {
          if (c.type === 'number') row[c.key] = '';
          else if (c.type === 'select' && c.options) row[c.key] = c.options[0];
          else row[c.key] = '';
        });
        initRows.push(row);
      }
      setReadingRows(initRows);

      setGeneralInfo(prev => ({
        ...prev,
        inspectionNo: dataService.generateInspectionNumber(formMeta.code),
        departmentId: formMeta.departmentCode,
        departmentName: formMeta.department,
      }));
    }
  }, [selectedFormCode, id]);

  // Recalculate metrics on each change
  const calculationResult = useMemo(() => {
    try {
      return formMeta.calculate(formData, readingRows);
    } catch (e) {
      console.warn('Calculation error:', e);
      return { metrics: {}, result: 'WARNING' as InspectionResult };
    }
  }, [formMeta, formData, readingRows]);

  const isApproved = existingRecord?.status === 'Approved';
  const isSubmitted = existingRecord?.status === 'Submitted';
  const isReadOnly = isApproved || (isSubmitted && currentUser.role === 'SQC Inspector / User');

  // Row operations
  const handleAddRow = () => {
    const newIdx = readingRows.length + 1;
    const row: Record<string, any> = { sampleNo: newIdx, rollNo: newIdx, pieceNo: newIdx, bagNo: newIdx, bagSampleNo: newIdx };
    formMeta.columns.forEach(c => {
      row[c.key] = '';
    });
    setReadingRows([...readingRows, row]);
  };

  const handleRemoveRow = (idx: number) => {
    if (readingRows.length <= 1) return;
    const next = [...readingRows];
    next.splice(idx, 1);
    setReadingRows(next);
  };

  const handleRowChange = (idx: number, key: string, val: any) => {
    const next = [...readingRows];
    next[idx] = { ...next[idx], [key]: val };
    setReadingRows(next);
  };

  const handleFieldChange = (key: string, val: any) => {
    setFormData({ ...formData, [key]: val });
  };

  // Save Draft
  const handleSaveDraft = () => {
    const record: InspectionRecord = {
      id: existingRecord?.id || `rec-${Date.now()}`,
      inspectionNo: generalInfo.inspectionNo || dataService.generateInspectionNumber(formMeta.code),
      formId: formMeta.code,
      formCode: formMeta.code,
      formTitle: formMeta.title,
      departmentId: generalInfo.departmentId,
      departmentName: generalInfo.departmentName,
      shiftId: generalInfo.shiftId,
      shiftName: generalInfo.shiftName,
      qualityId: generalInfo.qualityId,
      qualityName: generalInfo.qualityName,
      machineNo: generalInfo.machineNo,
      loomNo: generalInfo.loomNo,
      inspectorId: currentUser.id,
      inspectorName: currentUser.displayName,
      inspectionDate: generalInfo.inspectionDate,
      inspectionTime: generalInfo.inspectionTime,
      status: 'Draft',
      result: calculationResult.result,
      summaryMetrics: calculationResult.metrics,
      formData,
      readingRows,
      remarks,
      version: existingRecord ? existingRecord.version + 1 : 1,
      createdBy: existingRecord?.createdBy || currentUser.displayName,
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
      updatedBy: currentUser.displayName,
      updatedAt: new Date().toISOString(),
    };

    const saved = dataService.saveInspection(record, currentUser);
    setExistingRecord(saved);

    // Attempt local PostgreSQL synchronization
    setIsSyncingToPg(true);
    postgresService.syncInspectionToPostgres(saved).then(res => {
      setPgSyncStatus(res);
      setIsSyncingToPg(false);
      if (res.success) {
        alert(`✅ Draft saved in browser & successfully written to local PostgreSQL!\nInspection No: ${saved.inspectionNo}`);
      } else {
        alert(`ℹ️ Draft saved in browser.\n\n⚠️ PostgreSQL Sync Note:\n${res.message}\n\n(Tip: Go to Settings to configure your Cloudflare Tunnel URL so data writes directly to your local PC database)`);
      }
    });

    navigate(`/inspection/${saved.id}`);
  };

  // Submit Inspection
  const handleSubmitInspection = () => {
    if (!confirm('Are you sure you want to submit this inspection report for HOD approval? Once submitted, it will be locked for editing.')) {
      return;
    }

    const record: InspectionRecord = {
      id: existingRecord?.id || `rec-${Date.now()}`,
      inspectionNo: generalInfo.inspectionNo || dataService.generateInspectionNumber(formMeta.code),
      formId: formMeta.code,
      formCode: formMeta.code,
      formTitle: formMeta.title,
      departmentId: generalInfo.departmentId,
      departmentName: generalInfo.departmentName,
      shiftId: generalInfo.shiftId,
      shiftName: generalInfo.shiftName,
      qualityId: generalInfo.qualityId,
      qualityName: generalInfo.qualityName,
      machineNo: generalInfo.machineNo,
      loomNo: generalInfo.loomNo,
      inspectorId: currentUser.id,
      inspectorName: currentUser.displayName,
      inspectionDate: generalInfo.inspectionDate,
      inspectionTime: generalInfo.inspectionTime,
      status: 'Draft',
      result: calculationResult.result,
      summaryMetrics: calculationResult.metrics,
      formData,
      readingRows,
      remarks,
      version: existingRecord ? existingRecord.version + 1 : 1,
      createdBy: existingRecord?.createdBy || currentUser.displayName,
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
      updatedBy: currentUser.displayName,
      updatedAt: new Date().toISOString(),
    };

    const saved = dataService.saveInspection(record, currentUser);
    const submitted = dataService.submitInspection(saved.id, currentUser);
    if (submitted) {
      setExistingRecord(submitted);

      // Attempt local PostgreSQL synchronization
      setIsSyncingToPg(true);
      postgresService.syncInspectionToPostgres(submitted).then(res => {
        setPgSyncStatus(res);
        setIsSyncingToPg(false);
        if (res.success) {
          alert(`✅ Inspection submitted & successfully saved to your local PostgreSQL!\nInspection No: ${submitted.inspectionNo}`);
        } else {
          alert(`ℹ️ Inspection submitted & saved in browser.\n\n⚠️ Local PostgreSQL Notice:\n${res.message}\n\n(Tip: Make sure 'node server.js' and 'cloudflared tunnel' are active on your computer, and check your URL in Settings)`);
        }
      });

      navigate(`/inspection/${submitted.id}`);
    }
  };

  // Manual trigger to re-sync current inspection into local PostgreSQL
  const handleManualPgSync = async () => {
    if (!existingRecord) return;
    setIsSyncingToPg(true);
    try {
      const res = await postgresService.syncInspectionToPostgres(existingRecord);
      setPgSyncStatus(res);
      if (res.success) {
        alert(`✅ Synced to Local PostgreSQL successfully!\nInspection No: ${existingRecord.inspectionNo}`);
      } else {
        alert(`⚠️ Local PostgreSQL sync notice:\n${res.message}`);
      }
    } catch (err: any) {
      alert(`⚠️ Connection error: ${err.message}`);
    } finally {
      setIsSyncingToPg(false);
    }
  };

  // Approver actions
  const handleConfirmWorkflow = () => {
    if (!existingRecord) return;
    if (approvalActionModal === 'approve') {
      const res = dataService.approveInspection(existingRecord.id, workflowRemarks, currentUser);
      if (res) setExistingRecord(res);
    } else if (approvalActionModal === 'reject') {
      const res = dataService.rejectInspection(existingRecord.id, workflowRemarks, currentUser);
      if (res) setExistingRecord(res);
    } else if (approvalActionModal === 'return') {
      const res = dataService.returnInspectionForCorrection(existingRecord.id, workflowRemarks, currentUser);
      if (res) setExistingRecord(res);
    }
    setApprovalActionModal(null);
    setWorkflowRemarks('');
  };

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="back-to-inspections-btn"
            onClick={() => navigate('/inspections')}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                {formMeta.code}
              </span>
              <h2 className="text-base font-bold text-slate-900">{formMeta.title}</h2>
              {existingRecord && <StatusBadge status={existingRecord.status} />}
              <ResultBadge result={calculationResult.result} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Department: <strong className="text-slate-700">{formMeta.department}</strong> • Section: {formMeta.section}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!id && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs text-slate-500 font-medium">Switch Form:</span>
              <select
                id="select-active-form-code"
                value={selectedFormCode}
                onChange={e => setSelectedFormCode(e.target.value)}
                aria-label="Select Active Form Code"
                className="text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-800"
              >
                {Object.values(FORM_REGISTRY).map(f => (
                  <option key={f.code} value={f.code}>
                    {f.code} - {f.title.split('–')[1]?.trim() || f.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            id="print-form-btn"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>

          {/* Local PostgreSQL Push button */}
          {existingRecord && (
            <button
              id="sync-to-postgres-btn"
              type="button"
              onClick={handleManualPgSync}
              disabled={isSyncingToPg}
              title="Push this inspection directly to your local PostgreSQL database"
              className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Database size={13} className={isSyncingToPg ? 'animate-spin text-blue-600' : 'text-blue-700'} />
              <span>{isSyncingToPg ? 'Syncing...' : 'Sync to PostgreSQL'}</span>
            </button>
          )}

          {!isReadOnly && (
            <>
              <button
                id="save-draft-btn"
                onClick={handleSaveDraft}
                className="px-3.5 py-1.5 rounded-lg border border-emerald-700 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>Save Draft</span>
              </button>

              <button
                id="submit-inspection-btn"
                onClick={handleSubmitInspection}
                className="px-4 py-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
              >
                <Send size={14} />
                <span>Submit to HOD</span>
              </button>
            </>
          )}

          {/* Approver actions when submitted */}
          {isSubmitted && hasPermission('APPROVE') && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <button
                id="btn-approve-inspection"
                onClick={() => {
                  setApprovalActionModal('approve');
                  setWorkflowRemarks('Conforms to SQC standards. Approved for production lot.');
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 inline-flex items-center gap-1"
              >
                <CheckCircle2 size={14} />
                <span>Approve</span>
              </button>
              <button
                id="btn-return-inspection"
                onClick={() => {
                  setApprovalActionModal('return');
                  setWorkflowRemarks('Please verify the reading deviation.');
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 inline-flex items-center gap-1"
              >
                <RotateCcw size={14} />
                <span>Return</span>
              </button>
              <button
                id="btn-reject-inspection"
                onClick={() => {
                  setApprovalActionModal('reject');
                  setWorkflowRemarks('Readings severely out of specification limit.');
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 inline-flex items-center gap-1"
              >
                <XCircle size={14} />
                <span>Reject</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Local PostgreSQL Cloudflare Tunnel Status Banner */}
      {postgresService.getConfig().isDefaultPlaceholder ? (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Local PostgreSQL Not Connected Yet:</span>{' '}
              Inspection data is currently saving to browser local storage only. To save records directly into your computer's PostgreSQL database table, configure your Cloudflare Tunnel URL.
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
          >
            <span>Configure Tunnel in Settings</span>
            <ExternalLink size={12} />
          </button>
        </div>
      ) : pgSyncStatus ? (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
            pgSyncStatus.success
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {pgSyncStatus.success ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            )}
            <div>
              <span className="font-bold">Local PostgreSQL Sync:</span> {pgSyncStatus.message}
            </div>
          </div>
          {!pgSyncStatus.success && existingRecord && (
            <button
              type="button"
              onClick={handleManualPgSync}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
            >
              <RefreshCw size={12} className={isSyncingToPg ? 'animate-spin' : ''} />
              <span>Retry Sync</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Lock Notice if approved */}
      {isApproved && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-emerald-700" />
            <div>
              <span className="font-bold">Permanent Inspection Lock:</span> Approved by{' '}
              <strong>{existingRecord.approvedBy}</strong> on{' '}
              {new Date(existingRecord.approvedAt || '').toLocaleString()}.
              {existingRecord.approvalRemarks && <span> Remarks: "{existingRecord.approvalRemarks}"</span>}
            </div>
          </div>
          <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
            Record Ver. {existingRecord.version}
          </span>
        </div>
      )}

      {/* Standards & Tolerance Banner */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 shadow-sm text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
            <Info size={14} />
            <span>Controlled Factory Standard Specification</span>
          </div>
          <p className="text-slate-200 mt-1 font-medium">{formMeta.sourceStandardText}</p>
        </div>
        <div className="bg-slate-800/90 px-3 py-2 rounded-lg border border-slate-700 text-right min-w-[200px]">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Live Evaluation</span>
          <div className="flex items-center justify-end gap-2 mt-0.5">
            <ResultBadge result={calculationResult.result} />
          </div>
        </div>
      </div>

      {/* General Inspection Context Fields */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          1. Common Inspection Context
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Inspection #</label>
            <input
              type="text"
              readOnly
              value={generalInfo.inspectionNo || 'Auto Generated'}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-slate-700 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Inspection Date</label>
            <input
              type="date"
              disabled={isReadOnly}
              value={generalInfo.inspectionDate}
              onChange={e => setGeneralInfo({ ...generalInfo, inspectionDate: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Shift</label>
            <select
              disabled={isReadOnly}
              value={generalInfo.shiftId}
              onChange={e =>
                setGeneralInfo({
                  ...generalInfo,
                  shiftId: e.target.value,
                  shiftName: e.target.options[e.target.selectedIndex].text,
                })
              }
              aria-label="Inspection Shift"
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
            >
              <option value="Shift-A">Shift A (06:00 - 14:00)</option>
              <option value="Shift-B">Shift B (14:00 - 22:00)</option>
              <option value="Shift-C">Shift C (22:00 - 06:00)</option>
              <option value="General">General Shift (08:00 - 17:00)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Quality Master</label>
            <select
              disabled={isReadOnly}
              value={generalInfo.qualityId}
              onChange={e =>
                setGeneralInfo({
                  ...generalInfo,
                  qualityId: e.target.value,
                  qualityName: e.target.options[e.target.selectedIndex].text,
                })
              }
              aria-label="Quality Master"
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
            >
              {qualities.map(q => (
                <option key={q.id} value={q.id}>
                  {q.code} - {q.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Machine / Frame (if any)</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={generalInfo.machineNo}
              placeholder="e.g. Card-01 / Frame-4"
              onChange={e => setGeneralInfo({ ...generalInfo, machineNo: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Inspector</label>
            <input
              type="text"
              readOnly
              value={existingRecord?.inspectorName || currentUser.displayName}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Form Specific Header Parameters */}
      {formMeta.fields.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            2. {formMeta.title} – Header Parameters
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {formMeta.fields.map(field => (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {field.label} {field.unit && <span className="text-emerald-700">({field.unit})</span>}
                  {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    disabled={isReadOnly}
                    value={formData[field.key] ?? field.defaultValue ?? ''}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    aria-label={field.label}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                  >
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    step={field.type === 'number' ? 'any' : undefined}
                    disabled={isReadOnly}
                    value={formData[field.key] ?? field.defaultValue ?? ''}
                    onChange={e => handleFieldChange(field.key, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                  />
                )}
                {field.helpText && <p className="text-[10px] text-slate-400 mt-0.5">{field.helpText}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repeatable Readings Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              3. Sample Readings & Measurements Grid ({readingRows.length} Samples)
            </h3>
            <p className="text-[11px] text-slate-500">
              Unit: <strong className="text-emerald-800">{formMeta.sampleUnit}</strong>
            </p>
          </div>

          {!isReadOnly && (
            <button
              id="add-reading-row-btn"
              onClick={handleAddRow}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:border-emerald-600 hover:text-emerald-800 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1 shadow-2xs"
            >
              <Plus size={13} />
              <span>Add Sample Row</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                {formMeta.columns.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className="py-2.5 px-3 font-semibold text-slate-700"
                  >
                    {col.label} {col.unit && <span className="text-emerald-700 font-normal">({col.unit})</span>}
                  </th>
                ))}
                {!isReadOnly && <th className="py-2.5 px-3 w-12 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {readingRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                  {formMeta.columns.map(col => (
                    <td key={col.key} className="py-1.5 px-2">
                      {col.type === 'readonly' ? (
                        <span className="font-mono text-slate-600 font-semibold px-2 py-1 block">
                          {row[col.key] || idx + 1}
                        </span>
                      ) : col.type === 'select' ? (
                        <select
                          disabled={isReadOnly}
                          value={row[col.key] ?? ''}
                          onChange={e => handleRowChange(idx, col.key, e.target.value)}
                          aria-label={`${col.label} Row ${idx + 1}`}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium"
                        >
                          {col.options?.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={col.type === 'number' ? 'number' : 'text'}
                          step="any"
                          disabled={isReadOnly}
                          value={row[col.key] ?? ''}
                          placeholder="0.00"
                          onChange={e =>
                            handleRowChange(
                              idx,
                              col.key,
                              col.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value
                            )
                          }
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium font-mono focus:border-emerald-600 focus:bg-emerald-50/20"
                        />
                      )}
                    </td>
                  ))}
                  {!isReadOnly && (
                    <td className="py-1.5 px-2 text-center">
                      <button
                        onClick={() => handleRemoveRow(idx)}
                        disabled={readingRows.length <= 1}
                        className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30"
                        title="Remove row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automatic System Calculations & Statistical Summary */}
      <div className="bg-emerald-950 text-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-900">
        <div className="flex items-center justify-between mb-3 border-b border-emerald-800 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              4. System-Calculated Statistical Outputs & Acceptance Result
            </h3>
          </div>
          <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded font-mono">
            Source Mathematical Standards Engine
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {Object.entries(calculationResult.metrics).map(([key, val]) => (
            <div key={key} className="bg-emerald-900/60 p-2.5 rounded-lg border border-emerald-800/80">
              <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider block">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="text-base font-bold font-mono text-white mt-1 block">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-emerald-800/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-300 font-semibold">Evaluation Verdict:</span>
            <ResultBadge result={calculationResult.result} />
            <span className="text-slate-300 text-[11px]">
              {calculationResult.result === 'PASS'
                ? 'All sampled readings conform to SQC tolerances.'
                : calculationResult.result === 'WARNING'
                ? 'Readings approach limit boundary. Close process monitoring required.'
                : 'Defect or deviation exceeds allowable mill standard.'}
            </span>
          </div>

          <span className="text-[11px] text-emerald-400 font-medium">
            Read-only verified calculations • Cannot be manually altered
          </span>
        </div>
      </div>

      {/* Inspector Remarks */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          5. Inspector Observations & Floor Remarks
        </label>
        <textarea
          disabled={isReadOnly}
          rows={2}
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Enter machine condition, lot notes, corrective actions taken..."
          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:border-emerald-600"
        ></textarea>
      </div>

      {/* Approval / Workflow Dialog Modal */}
      {approvalActionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-slate-900 capitalize">
                Confirm Action: {approvalActionModal} Inspection
              </h4>
              <button
                onClick={() => setApprovalActionModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Approver Remarks / Correction Instructions:
              </label>
              <textarea
                rows={3}
                value={workflowRemarks}
                onChange={e => setWorkflowRemarks(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                placeholder="Enter approval or rejection comments..."
              ></textarea>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApprovalActionModal(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWorkflow}
                className={`px-4 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs ${
                  approvalActionModal === 'approve'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : approvalActionModal === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Confirm {approvalActionModal.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
