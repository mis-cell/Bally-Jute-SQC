import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Save,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Plus,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Info,
  Sparkles,
  Lock,
  Loader2,
  Database,
} from 'lucide-react';
import {
  FORM_REGISTRY,
  FormMetadata,
  normalizeFormKey,
  resolveFormByCode,
} from '../constants/formsRegistry';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { useAuth } from '../context/AuthContext';
import { InspectionRecord, InspectionStatus, InspectionResult } from '../types';
import { StatusBadge, ResultBadge } from '../components/common/Badges';

interface SaveFeedbackState {
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export const InspectionFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, hasPermission, canAccessForm } = useAuth();

  const [existingRecord, setExistingRecord] = useState<InspectionRecord | null>(null);
  const [selectedFormCode, setSelectedFormCode] = useState<string>(() =>
    normalizeFormKey(searchParams.get('form') || 'FORM-01')
  );
  const [isLoadingRecord, setIsLoadingRecord] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedbackState | null>(null);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);

  // Master options
  const qualities = dataService.getQualities();

  // Dynamic form fields & rows
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [readingRows, setReadingRows] = useState<Record<string, any>[]>([]);
  const [remarks, setRemarks] = useState('');
  const [approvalActionModal, setApprovalActionModal] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [workflowRemarks, setWorkflowRemarks] = useState('');

  const formMeta: FormMetadata = useMemo(
    () => resolveFormByCode(selectedFormCode),
    [selectedFormCode]
  );

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

  // Read any feedback passed through navigation state after creating a record
  useEffect(() => {
    const navState = location.state as { saveFeedback?: SaveFeedbackState } | null;
    if (navState?.saveFeedback) {
      setSaveFeedback(navState.saveFeedback);
    }
  }, [location.state]);

  // Load existing record (localStorage or PostgreSQL) or prepare new form from ?form=
  useEffect(() => {
    let isCancelled = false;

    const populateFromRecord = (rec: InspectionRecord) => {
      const normalizedKey = normalizeFormKey(rec.formCode || rec.formId);
      setExistingRecord(rec);
      setSelectedFormCode(normalizedKey);
      setFormData(rec.formData || {});
      setReadingRows(Array.isArray(rec.readingRows) ? rec.readingRows : []);
      setRemarks(rec.remarks || '');
      setGeneralInfo({
        inspectionNo: rec.inspectionNo,
        inspectionDate: rec.inspectionDate || new Date().toISOString().split('T')[0],
        inspectionTime: rec.inspectionTime || '',
        shiftId: rec.shiftId || 'Shift-A',
        shiftName: rec.shiftName || 'Shift A (06:00 - 14:00)',
        qualityId: rec.qualityId || qualities[0]?.id || 'q-1',
        qualityName: rec.qualityName || qualities[0]?.name || 'Standard Quality',
        departmentId: rec.departmentId || resolveFormByCode(normalizedKey).departmentCode,
        departmentName: rec.departmentName || resolveFormByCode(normalizedKey).department,
        machineNo: rec.machineNo || '',
        loomNo: rec.loomNo || '',
      });
    };

    if (id) {
      const localRec = dataService.getInspectionById(id);
      if (localRec) {
        populateFromRecord(localRec);
      } else {
        setIsLoadingRecord(true);
        postgresService
          .fetchInspectionById(id)
          .then(pgRec => {
            if (isCancelled) return;
            if (pgRec) {
              dataService.saveInspection(pgRec, currentUser, true);
              populateFromRecord(pgRec);
            } else {
              setSaveFeedback({
                type: 'error',
                title: 'Inspection Not Found',
                message: `Could not locate inspection record "${id}" locally or in PostgreSQL.`,
              });
            }
          })
          .finally(() => {
            if (!isCancelled) setIsLoadingRecord(false);
          });
      }
    } else {
      const qCode = searchParams.get('form') || 'FORM-01';
      const normalizedKey = normalizeFormKey(qCode);
      setExistingRecord(null);
      setRemarks('');
      if (!(location.state as any)?.saveFeedback) {
        setSaveFeedback(null);
      }
      setSelectedFormCode(normalizedKey);
    }

    return () => {
      isCancelled = true;
    };
  }, [id, searchParams]);

  // Initialize default fields & reading rows for new records
  useEffect(() => {
    if (id) return;

    const meta = resolveFormByCode(selectedFormCode);
    const initFields: Record<string, any> = {};
    meta.fields.forEach(f => {
      if (f.defaultValue !== undefined) initFields[f.key] = f.defaultValue;
    });
    setFormData(initFields);

    const initRows: Record<string, any>[] = [];
    for (let i = 1; i <= meta.defaultRowCount; i++) {
      const row: Record<string, any> = {
        sampleNo: i,
        rollNo: i,
        pieceNo: i,
        bagNo: i,
        bagSampleNo: i,
      };
      meta.columns.forEach(c => {
        if (c.type === 'select' && c.options && c.options.length > 0) {
          row[c.key] = c.options[0];
        } else if (c.type === 'readonly') {
          row[c.key] = row[c.key] ?? i;
        } else if (c.type === 'text' && (c.key === 'rollNo' || c.key === 'bagNo' || c.key === 'pieceNo')) {
          row[c.key] = String(i);
        } else if (row[c.key] === undefined) {
          row[c.key] = '';
        }
      });
      initRows.push(row);
    }
    setReadingRows(initRows);

    setGeneralInfo(prev => ({
      ...prev,
      inspectionNo: dataService.generateInspectionNumber(meta.code),
      departmentId: meta.departmentCode,
      departmentName: meta.department,
    }));
  }, [selectedFormCode, id]);

  // Recalculate metrics on each change
  const calculationResult = useMemo(() => {
    try {
      const clonedRows = readingRows.map(r => ({ ...r }));
      return formMeta.calculate(formData, clonedRows);
    } catch (e) {
      console.warn('Calculation error:', e);
      return { metrics: {}, result: 'WARNING' as InspectionResult };
    }
  }, [formMeta, formData, readingRows]);

  const isApproved = existingRecord?.status === 'Approved';
  const isSubmitted = existingRecord?.status === 'Submitted';
  const canEditRole = hasPermission('CREATE') || hasPermission('EDIT');
  const isReadOnly =
    !canEditRole ||
    isApproved ||
    (isSubmitted &&
      (currentUser.role === 'SQC Inspector / User' ||
        currentUser.role === 'Inspector' ||
        currentUser.role === 'Viewer / Auditor' ||
        currentUser.role === 'Auditor'));

  // Row operations
  const handleAddRow = () => {
    const newIdx = readingRows.length + 1;
    const row: Record<string, any> = {
      sampleNo: newIdx,
      rollNo: newIdx,
      pieceNo: newIdx,
      bagNo: newIdx,
      bagSampleNo: newIdx,
    };
    formMeta.columns.forEach(c => {
      if (c.type === 'select' && c.options && c.options.length > 0) {
        row[c.key] = c.options[0];
      } else if (c.type === 'readonly') {
        row[c.key] = row[c.key] ?? newIdx;
      } else if (c.type === 'text' && (c.key === 'rollNo' || c.key === 'bagNo' || c.key === 'pieceNo')) {
        row[c.key] = String(newIdx);
      } else if (row[c.key] === undefined) {
        row[c.key] = '';
      }
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
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  // Validate required header fields before final submission
  const validateForSubmit = (): string | null => {
    const missingFields: string[] = [];
    formMeta.fields.forEach(f => {
      if (f.required) {
        const val = formData[f.key] ?? f.defaultValue;
        if (val === undefined || val === null || String(val).trim() === '') {
          missingFields.push(f.label);
        }
      }
    });
    if (missingFields.length > 0) {
      return `Please fill required header field(s): ${missingFields.join(', ')}.`;
    }
    if (!readingRows || readingRows.length === 0) {
      return 'At least one sample reading row is required before submitting.';
    }
    return null;
  };

  // Core save & sync handler for both Draft and Submitted
  const buildAndSyncRecord = async (targetStatus: 'Draft' | 'Submitted') => {
    if (isSaving) return;

    if (targetStatus === 'Submitted') {
      const validationErr = validateForSubmit();
      if (validationErr) {
        setSaveFeedback({
          type: 'error',
          title: 'Required Information Missing',
          message: validationErr,
        });
        return;
      }
    }

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const computedRows = readingRows.map(r => ({ ...r }));
      const finalCalc = formMeta.calculate(formData, computedRows);
      setReadingRows(computedRows);

      const nowIso = new Date().toISOString();
      const baseRecord: InspectionRecord = {
        id: existingRecord?.id || `rec-${Date.now()}`,
        inspectionNo:
          generalInfo.inspectionNo || dataService.generateInspectionNumber(formMeta.code),
        formId: formMeta.code,
        formCode: formMeta.code,
        formTitle: formMeta.title,
        departmentId: generalInfo.departmentId || formMeta.departmentCode,
        departmentName: generalInfo.departmentName || formMeta.department,
        shiftId: generalInfo.shiftId,
        shiftName: generalInfo.shiftName,
        qualityId: generalInfo.qualityId,
        qualityName: generalInfo.qualityName,
        machineNo: generalInfo.machineNo,
        loomNo: generalInfo.loomNo,
        inspectorId: existingRecord?.inspectorId || currentUser.id,
        inspectorName: existingRecord?.inspectorName || currentUser.displayName,
        inspectionDate: generalInfo.inspectionDate,
        inspectionTime: generalInfo.inspectionTime,
        status: targetStatus as InspectionStatus,
        result: finalCalc.result,
        summaryMetrics: finalCalc.metrics,
        formData,
        readingRows: computedRows,
        remarks,
        version: existingRecord ? existingRecord.version + 1 : 1,
        createdBy: existingRecord?.createdBy || currentUser.displayName,
        createdAt: existingRecord?.createdAt || nowIso,
        updatedBy: currentUser.displayName,
        updatedAt: nowIso,
      };

      let finalRecord: InspectionRecord;
      if (targetStatus === 'Submitted') {
        const saved = dataService.saveInspection({ ...baseRecord, status: 'Draft' }, currentUser, true);
        const submitted = dataService.submitInspection(saved.id, currentUser, true);
        finalRecord = submitted || { ...saved, status: 'Submitted' };
      } else {
        finalRecord = dataService.saveInspection(baseRecord, currentUser, true);
      }

      setExistingRecord(finalRecord);

      const pgRes = await postgresService.syncInspectionToPostgres(finalRecord);
      const feedback: SaveFeedbackState = pgRes.success
        ? {
            type: 'success',
            title:
              targetStatus === 'Submitted'
                ? 'Submitted & Saved to PostgreSQL'
                : 'Draft Saved to PostgreSQL',
            message: `${finalRecord.inspectionNo} saved cleanly to PostgreSQL (inspections${
              pgRes.formTable ? ` + ${pgRes.formTable}` : ''
            }).`,
          }
        : {
            type: 'warning',
            title: 'Saved Locally — PostgreSQL Sync Failed',
            message:
              pgRes.message ||
              'Could not reach PostgreSQL backend. Verify server status in System Settings.',
          };

      setSaveFeedback(feedback);

      if (!id) {
        navigate(`/inspection/${finalRecord.id}`, {
          replace: true,
          state: { saveFeedback: feedback },
        });
      }
    } catch (err: any) {
      setSaveFeedback({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Unexpected error while saving inspection record.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => {
    void buildAndSyncRecord('Draft');
  };

  const handleSubmitInspectionClick = () => {
    const validationErr = validateForSubmit();
    if (validationErr) {
      setSaveFeedback({
        type: 'error',
        title: 'Required Information Missing',
        message: validationErr,
      });
      return;
    }
    setShowSubmitConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirmModal(false);
    void buildAndSyncRecord('Submitted');
  };

  // Approver actions
  const handleConfirmWorkflow = async () => {
    if (!existingRecord) return;
    setIsSaving(true);
    try {
      let updated: InspectionRecord | null = null;
      if (approvalActionModal === 'approve') {
        updated = dataService.approveInspection(
          existingRecord.id,
          workflowRemarks,
          currentUser,
          true
        );
      } else if (approvalActionModal === 'reject') {
        updated = dataService.rejectInspection(
          existingRecord.id,
          workflowRemarks,
          currentUser,
          true
        );
      } else if (approvalActionModal === 'return') {
        updated = dataService.returnInspectionForCorrection(
          existingRecord.id,
          workflowRemarks,
          currentUser,
          true
        );
      }

      if (updated) {
        setExistingRecord(updated);
        const pgRes = await postgresService.syncInspectionToPostgres(updated);
        setSaveFeedback(
          pgRes.success
            ? {
                type: 'success',
                title: `Inspection ${updated.status} in PostgreSQL`,
                message: `${updated.inspectionNo} updated in inspections${
                  pgRes.formTable ? ` and ${pgRes.formTable}` : ''
                }.`,
              }
            : {
                type: 'warning',
                title: `Updated Locally (${updated.status}) — PostgreSQL Sync Failed`,
                message: pgRes.message || 'Could not update PostgreSQL backend.',
              }
        );
      }
    } finally {
      setIsSaving(false);
      setApprovalActionModal(null);
      setWorkflowRemarks('');
    }
  };

  // Enforce per-form permissions
  const isPermitted = canAccessForm(formMeta.code);
  if (!isPermitted) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-[#F4C4C5] text-center max-w-lg mx-auto my-12 shadow-sm space-y-4">
        <div className="w-14 h-14 bg-[#FCE7E6] text-[#D95F68] rounded-2xl flex items-center justify-center mx-auto border border-[#F4C4C5]">
          <Lock size={26} />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#393334]">Form Access Restricted</h2>
          <p className="text-xs text-[#806B6C] mt-1.5 leading-relaxed">
            Your user account is not currently authorized to access or submit inspections for{' '}
            <strong className="text-[#393334]">
              {formMeta.code} ({formMeta.title})
            </strong>
            .
          </p>
          <p className="text-[11px] text-[#806B6C] mt-1">
            Please ask an SQC Administrator to assign permission for this form in the{' '}
            <strong>Users &amp; Form Permissions</strong> panel.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => navigate('/inspections')}
            className="px-4 py-2 bg-[#D95F68] hover:bg-[#C94E59] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Back to Inspections List
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingRecord) {
    return (
      <div className="bg-white rounded-xl p-10 border border-[#DFA2BA] text-center max-w-md mx-auto my-12 shadow-sm flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-[#701638]" />
        <p className="text-xs font-semibold text-[#701638]">
          Loading inspection record from PostgreSQL...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Save / PostgreSQL Sync Status Banner */}
      {saveFeedback && (
        <div
          role="status"
          className={`rounded-xl p-3.5 border shadow-sm flex items-start justify-between gap-3 text-xs ${
            saveFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : saveFeedback.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {saveFeedback.type === 'success' ? (
              <Database size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle
                size={18}
                className={
                  saveFeedback.type === 'warning'
                    ? 'text-amber-700 shrink-0 mt-0.5'
                    : 'text-rose-700 shrink-0 mt-0.5'
                }
              />
            )}
            <div>
              <p className="font-bold">{saveFeedback.title}</p>
              <p className="text-[11px] mt-0.5 opacity-90">{saveFeedback.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSaveFeedback(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 px-1.5 py-0.5"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-gradient-to-r from-[#FFF8FA] via-[#FCEAF1] to-[#F8E1EA] rounded-xl p-4 border border-[#DFA2BA] shadow-sm flex flex-col gap-4">
        {/* Header Section */}
        <div className="flex items-start gap-3">
          <button
            id="back-to-inspections-btn"
            type="button"
            onClick={() => navigate('/inspections')}
            className="p-2 rounded-lg border border-[#DFA2BA] hover:bg-[#F5D5E2] bg-white text-[#701638] transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-[#701638] text-white font-bold border border-[#500D28] shadow-sm">
                {formMeta.code}
              </span>

              <h2 className="text-base font-bold text-[#D95F68]">{formMeta.title}</h2>

              {existingRecord && <StatusBadge status={existingRecord.status} />}
            </div>

            <p className="text-xs text-[#D95F68] mt-2">
              Department: <strong className="text-[#D95F68]">{formMeta.department}</strong>
              <span className="mx-2 text-[#D18AA8]">•</span>
              Section: <strong className="text-[#D95F68]">{formMeta.section}</strong>
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-3 border-t border-[#DFA2BA]">
          <div className="flex items-center gap-2 flex-wrap">
            {!id && Object.keys(FORM_REGISTRY).length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#831843] font-semibold whitespace-nowrap">
                  Form:
                </span>
                <select
                  id="select-active-form-code"
                  value={selectedFormCode}
                  onChange={e =>
                    navigate(`/new-inspection?form=${encodeURIComponent(e.target.value)}`)
                  }
                  aria-label="Select Active Form Code"
                  className="text-xs bg-white border border-[#DFA2BA] rounded-lg px-2.5 py-1.5 font-semibold text-[#500D28] focus:outline-none focus:ring-1 focus:ring-[#BE185D] max-w-[340px]"
                >
                  {Object.entries(FORM_REGISTRY)
                    .filter(([, meta]) => canAccessForm(meta.code))
                    .map(([key, f]) => (
                      <option key={key} value={key}>
                        {f.code} - {f.title}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isReadOnly && (
              <>
                <button
                  id="save-draft-btn"
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveDraft}
                  className="px-3.5 py-2 rounded-lg border border-[#831843] bg-white text-[#701638] hover:bg-[#F5D5E2] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Draft</span>
                </button>

                <button
                  id="submit-inspection-btn"
                  type="button"
                  disabled={isSaving}
                  onClick={handleSubmitInspectionClick}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#701638] to-[#9D174D] text-white hover:from-[#500D28] hover:to-[#831843] text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{isSaving ? 'Saving to PostgreSQL...' : 'Submit to HOD'}</span>
                </button>
              </>
            )}

            {/* Approver Actions */}
            {isSubmitted && hasPermission('APPROVE') && (
              <div className="flex items-center gap-2 pl-2 border-l border-[#DFA2BA]">
                <button
                  id="btn-approve-inspection"
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setApprovalActionModal('approve');
                    setWorkflowRemarks('Conforms to SQC standards. Approved for production lot.');
                  }}
                  className="px-3 py-2 rounded-lg bg-[#701638] text-white text-xs font-bold hover:bg-[#500D28] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  <span>Approve</span>
                </button>

                <button
                  id="btn-return-inspection"
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setApprovalActionModal('return');
                    setWorkflowRemarks('Please verify the reading deviation.');
                  }}
                  className="px-3 py-2 rounded-lg bg-[#9D174D] text-white text-xs font-bold hover:bg-[#701638] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  <span>Return</span>
                </button>

                <button
                  id="btn-reject-inspection"
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setApprovalActionModal('reject');
                    setWorkflowRemarks('Readings severely out of specification limit.');
                  }}
                  className="px-3 py-2 rounded-lg bg-[#500D28] text-white text-xs font-bold hover:bg-[#35081B] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lock Notice if approved */}
      {isApproved && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-emerald-700" />
            <div>
              <span className="font-bold">Permanent Inspection Lock:</span> Approved by{' '}
              <strong>{existingRecord.approvedBy}</strong> on{' '}
              {new Date(existingRecord.approvedAt || '').toLocaleString()}.
              {existingRecord.approvalRemarks && (
                <span> Remarks: &quot;{existingRecord.approvalRemarks}&quot;</span>
              )}
            </div>
          </div>
          <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
            Record Ver. {existingRecord.version}
          </span>
        </div>
      )}

      <div className="bg-[#FFF4F3] text-[#574448] rounded-xl p-3.5 shadow-sm border border-[#F4C4C5] text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[#D95F68] font-bold uppercase tracking-wider text-[11px]">
            <Info size={14} />
            <span>Controlled Factory Standard Specification</span>
          </div>
          <p className="text-[#754D50] mt-1 font-medium">{formMeta.sourceStandardText}</p>
        </div>

        <div className="bg-white px-3 py-2 rounded-lg border border-[#F4C4C5] text-right min-w-[200px] shadow-sm">
          <span className="text-[10px] text-[#A47779] uppercase tracking-wider block">
            Live Evaluation
          </span>
          <div className="flex items-center justify-end gap-2 mt-0.5">
            <ResultBadge result={calculationResult.result} />
          </div>
        </div>
      </div>

      {/* General Inspection Context Fields */}
      <div className="bg-gradient-to-br from-[#FFF8FA] via-[#FCEAF1] to-[#F8E1EA] rounded-xl p-4 border border-[#DFA2BA] shadow-sm">
        <h3 className="text-xs font-bold text-[#D95F68] uppercase tracking-wider mb-3 border-b border-[#E8B4C8] pb-2">
          1. Common Inspection Context
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-[#831843] mb-1">Inspection #</label>
            <input
              type="text"
              readOnly
              value={generalInfo.inspectionNo || 'Auto Generated'}
              className="w-full bg-[#F5D5E2] border border-[#DFA2BA] rounded-md px-2.5 py-1.5 font-mono text-[#500D28] text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#831843] mb-1">
              Inspection Date
            </label>
            <input
              type="date"
              disabled={isReadOnly}
              value={generalInfo.inspectionDate}
              onChange={e => setGeneralInfo({ ...generalInfo, inspectionDate: e.target.value })}
              className="w-full bg-white border border-[#DFA2BA] rounded-md px-2.5 py-1.5 text-xs text-[#500D28] font-semibold focus:outline-none focus:ring-1 focus:ring-[#BE185D] focus:border-[#9D174D] disabled:bg-[#F5D5E2] disabled:text-[#831843]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#831843] mb-1">Shift</label>
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
              className="w-full bg-white border border-[#DFA2BA] rounded-md px-2.5 py-1.5 text-xs text-[#500D28] font-semibold focus:outline-none focus:ring-1 focus:ring-[#BE185D] focus:border-[#9D174D] disabled:bg-[#F5D5E2] disabled:text-[#831843]"
            >
              <option value="Shift-A">Shift A (06:00 - 14:00)</option>
              <option value="Shift-B">Shift B (14:00 - 22:00)</option>
              <option value="Shift-C">Shift C (22:00 - 06:00)</option>
              <option value="General">General Shift (08:00 - 17:00)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#831843] mb-1">
              Quality Master
            </label>
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
              className="w-full bg-white border border-[#DFA2BA] rounded-md px-2.5 py-1.5 text-xs text-[#500D28] font-semibold focus:outline-none focus:ring-1 focus:ring-[#BE185D] focus:border-[#9D174D] disabled:bg-[#F5D5E2] disabled:text-[#831843]"
            >
              {qualities.map(q => (
                <option key={q.id} value={q.id}>
                  {q.code} - {q.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#831843] mb-1">
              Machine / Frame (if any)
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={generalInfo.machineNo}
              placeholder="e.g. Card-01 / Frame-4"
              onChange={e => setGeneralInfo({ ...generalInfo, machineNo: e.target.value })}
              className="w-full bg-white border border-[#DFA2BA] rounded-md px-2.5 py-1.5 text-xs text-[#500D28] font-semibold placeholder:text-[#B78398] focus:outline-none focus:ring-1 focus:ring-[#BE185D] focus:border-[#9D174D] disabled:bg-[#F5D5E2] disabled:text-[#831843]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#831843] mb-1">Inspector</label>
            <input
              type="text"
              readOnly
              value={existingRecord?.inspectorName || currentUser.displayName}
              className="w-full bg-[#F5D5E2] border border-[#DFA2BA] rounded-md px-2.5 py-1.5 text-xs font-bold text-[#500D28]"
            />
          </div>
        </div>
      </div>

      {/* Form Specific Header Parameters */}
      {formMeta.fields.length > 0 && (
        <div className="bg-gradient-to-br from-[#FFF8FA] via-[#FCEAF1] to-[#F8E1EA] rounded-xl p-4 border border-[#DFA2BA] shadow-sm">
          <h3 className="text-xs font-bold text-[#D95F68] uppercase tracking-wider mb-3 border-b border-[#E8B4C8] pb-2">
            2. {formMeta.title} – Header Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {formMeta.fields.map(field => (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold text-[#831843] mb-1">
                  {field.label}{' '}
                  {field.unit && <span className="text-[#BE185D]">({field.unit})</span>}
                  {field.required && <span className="text-[#BE123C] ml-0.5">*</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    disabled={isReadOnly}
                    value={formData[field.key] ?? field.defaultValue ?? ''}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    aria-label={field.label}
                    className="w-full bg-white border border-[#DFA2BA] rounded-md px-2.5 py-1.5 text-xs text-[#500D28] font-medium focus:outline-none focus:ring-1 focus:ring-[#BE185D] focus:border-[#9D174D] disabled:bg-[#F5D5E2] disabled:text-[#831843]"
                  >
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      field.type === 'number'
                        ? 'number'
                        : field.type === 'date'
                        ? 'date'
                        : field.type === 'time'
                        ? 'time'
                        : 'text'
                    }
                    step={field.type === 'number' ? 'any' : undefined}
                    readOnly={field.type === 'readonly'}
                    disabled={isReadOnly}
                    value={formData[field.key] ?? field.defaultValue ?? ''}
                    onChange={e => {
                      if (field.type === 'number') {
                        const raw = e.target.value;
                        if (raw === '') {
                          handleFieldChange(field.key, '');
                        } else {
                          const parsed = parseFloat(raw);
                          handleFieldChange(field.key, Number.isNaN(parsed) ? '' : parsed);
                        }
                      } else {
                        handleFieldChange(field.key, e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-[#DFA2BA] rounded-md px-2.5 py-1.5 text-xs text-[#500D28] font-medium placeholder:text-[#B78398] focus:outline-none focus:ring-1 focus:ring-[#BE185D] focus:border-[#9D174D] disabled:bg-[#F5D5E2] disabled:text-[#831843]"
                  />
                )}

                {field.helpText && (
                  <p className="text-[10px] text-[#A16B82] mt-0.5">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repeatable Readings Table */}
      <div className="bg-white rounded-xl border border-[#F2D9D9] shadow-sm overflow-hidden">
        <div className="p-3.5 bg-[#FFF1F1] border-b border-[#F2D9D9] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#D95F68] uppercase tracking-wider">
              3. Sample Readings &amp; Measurements Grid ({readingRows.length} Samples)
            </h3>
            <p className="text-[11px] text-[#98777B]">
              Unit: <strong className="text-[#A34F5B]">{formMeta.sampleUnit}</strong>
            </p>
          </div>

          {!isReadOnly && (
            <button
              id="add-reading-row-btn"
              type="button"
              onClick={handleAddRow}
              className="px-2.5 py-1 bg-white border border-[#E8BFC3] hover:border-[#C56B78] hover:bg-[#FFF0F1] hover:text-[#9F4654] text-[#79535A] rounded text-xs font-semibold inline-flex items-center gap-1 shadow-sm transition-colors"
            >
              <Plus size={13} />
              <span>Add Sample Row</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#FCEAEA] border-b border-[#EBCFD1] text-[#D95F68] font-semibold">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                {formMeta.columns.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className="py-2.5 px-3 font-semibold text-[#D95F68]"
                  >
                    {col.label}{' '}
                    {col.unit && <span className="text-[#D95F68] font-normal">({col.unit})</span>}
                  </th>
                ))}
                {!isReadOnly && <th className="py-2.5 px-3 w-12 text-center">Action</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F5E5E6]">
              {readingRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#FFF6F6] transition-colors">
                  <td className="py-2 px-3 text-center text-[#B58D92] font-mono">{idx + 1}</td>

                  {formMeta.columns.map(col => (
                    <td key={col.key} className="py-1.5 px-2">
                      {col.type === 'readonly' ? (
                        <span className="font-mono text-[#815D63] font-semibold px-2 py-1 block">
                          {row[col.key] !== undefined && row[col.key] !== ''
                            ? row[col.key]
                            : idx + 1}
                        </span>
                      ) : col.type === 'select' ? (
                        <select
                          disabled={isReadOnly}
                          value={row[col.key] ?? col.options?.[0] ?? ''}
                          onChange={e => handleRowChange(idx, col.key, e.target.value)}
                          aria-label={`${col.label} Row ${idx + 1}`}
                          className="w-full bg-white border border-[#E8CBCD] rounded px-2 py-1 text-xs text-[#633F46] font-medium focus:border-[#C56B78] focus:ring-1 focus:ring-[#EBC1C6] outline-none"
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
                          placeholder={col.type === 'number' ? '0.00' : ''}
                          onChange={e => {
                            if (col.type === 'number') {
                              const raw = e.target.value;
                              const parsed = raw === '' ? '' : parseFloat(raw);
                              handleRowChange(
                                idx,
                                col.key,
                                raw === '' || Number.isNaN(parsed as number) ? '' : parsed
                              );
                            } else {
                              handleRowChange(idx, col.key, e.target.value);
                            }
                          }}
                          className="w-full bg-white border border-[#E8CBCD] rounded px-2 py-1 text-xs text-[#633F46] font-medium font-mono focus:border-[#C56B78] focus:bg-[#FFF1F2] focus:ring-1 focus:ring-[#EBC1C6] outline-none"
                        />
                      )}
                    </td>
                  ))}

                  {!isReadOnly && (
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        disabled={readingRows.length <= 1}
                        className="text-[#C49A9F] hover:text-[#C43D50] hover:bg-[#FCE4E7] rounded p-1 disabled:opacity-30 transition-colors"
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
      <div className="bg-gradient-to-br from-[#FFF8F7] via-[#FCEDEC] to-[#F8DDDC] text-[#574448] rounded-xl p-4 shadow-md border border-[#EABFC0]">
        <div className="flex items-center justify-between mb-3 border-b border-[#E8C1C1] pb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#C94F5B]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#D95F68]">
              4. System-Calculated Statistical Outputs &amp; Acceptance Result
            </h3>
          </div>

          <span className="text-[10px] bg-[#F4D8D7] text-[#93434B] px-2 py-0.5 rounded font-mono border border-[#E6B9B9]">
            Source Mathematical Standards Engine
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {Object.entries(calculationResult.metrics).map(([key, val]) => (
            <div
              key={key}
              className="bg-gradient-to-br from-white to-[#FBECEB] p-2.5 rounded-lg border border-[#EAC6C5] shadow-sm hover:shadow-md hover:border-[#D99A9D] transition-all duration-200"
            >
              <span className="text-[10px] text-[#A47779] font-semibold uppercase tracking-wider block">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>

              <span className="text-base font-bold font-mono text-[#693D43] mt-1 block">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-[#E8C1C1] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#D95F68] font-bold">Evaluation Verdict:</span>
            <ResultBadge result={calculationResult.result} />
            <span className="text-[#765C60] text-[11px]">
              {calculationResult.result === 'PASS'
                ? 'All sampled readings conform to SQC tolerances.'
                : calculationResult.result === 'WARNING'
                ? 'Readings approach limit boundary. Close process monitoring required.'
                : 'Defect or deviation exceeds allowable mill standard.'}
            </span>
          </div>

          <span className="text-[11px] text-[#A34D56] font-semibold">
            Read-only verified calculations • Cannot be manually altered
          </span>
        </div>
      </div>

      {/* Inspector Remarks */}
      <div className="bg-white rounded-xl p-4 border border-[#F2D9D9] shadow-sm">
        <label className="block text-xs font-bold text-[#D95F68] uppercase tracking-wider mb-2">
          5. Inspector Observations &amp; Floor Remarks
        </label>

        <textarea
          disabled={isReadOnly}
          rows={2}
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Enter machine condition, lot notes, corrective actions taken..."
          className="w-full bg-[#FFF6F6] border border-[#E8CBCD] rounded-lg p-2.5 text-xs text-[#633F46] placeholder:text-[#B58D92] focus:bg-white focus:border-[#C56B78] focus:ring-1 focus:ring-[#EBC1C6] outline-none transition-colors disabled:bg-[#F9F1F1] disabled:text-[#A58B8F]"
        ></textarea>
      </div>

      {/* Inline Submit Confirmation Modal (No native window.confirm) */}
      {showSubmitConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#DFA2BA] space-y-4">
            <div className="flex items-center justify-between border-b border-[#FCEAF1] pb-2">
              <h4 className="text-sm font-bold text-[#701638]">
                Confirm Submit Inspection Report
              </h4>
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Submit <strong className="font-mono text-[#701638]">{generalInfo.inspectionNo}</strong>{' '}
              (<strong>{formMeta.code}</strong>) for HOD approval and save directly to PostgreSQL?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="px-4 py-1.5 bg-[#701638] hover:bg-[#500D28] text-white text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Confirm &amp; Save to PostgreSQL</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval / Workflow Dialog Modal */}
      {approvalActionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-slate-900 capitalize">
                Confirm Action: {approvalActionModal} Inspection
              </h4>
              <button
                type="button"
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
                type="button"
                onClick={() => setApprovalActionModal(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWorkflow}
                disabled={isSaving}
                className={`px-4 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs disabled:opacity-50 ${
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
