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
  Eye,
  Edit2,
  Search,
  ClipboardList,
  PlusCircle,
  X,
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
import { useRealtimeData } from '../hooks/useRealtimeSync';

interface SaveFeedbackState {
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

const getFormCodeAliases = (code: string): string[] => {
  const upper = String(code || '').toUpperCase().trim();
  if (upper === 'FORM-09' || upper === 'FORM-09 A' || upper === 'FORM-09A') {
    return ['FORM-09', 'FORM-09 A', 'FORM-09A'];
  }
  if (upper === 'FORM-37' || upper === 'FORM-09 B' || upper === 'FORM-09B') {
    return ['FORM-37', 'FORM-09 B', 'FORM-09B'];
  }
  return [upper];
};

export const InspectionFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    hasPermission,
    canAccessForm,
    canEditSavedEntry,
    canDeleteSavedEntry,
  } = useAuth();

  const allInspections = useRealtimeData(() => dataService.getInspections());

  const [existingRecord, setExistingRecord] = useState<InspectionRecord | null>(null);
  const [selectedFormCode, setSelectedFormCode] = useState<string>(() =>
    normalizeFormKey(searchParams.get('form') || 'FORM-01')
  );
  const [isLoadingRecord, setIsLoadingRecord] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedbackState | null>(null);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);

  // Per-form view mode & individual entry log controls
  const [activeViewTab, setActiveViewTab] = useState<'form' | 'log'>('form');
  const [logSearch, setLogSearch] = useState<string>('');
  const [onlyMyEntries, setOnlyMyEntries] = useState<boolean>(false);
  const [inspectingLogRecord, setInspectingLogRecord] = useState<InspectionRecord | null>(null);
  const [deleteLogTarget, setDeleteLogTarget] = useState<InspectionRecord | null>(null);

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
        sampleNo: i/* ,
        rollNo: i,
        pieceNo: i,
        bagNo: i,
        bagSampleNo: i, */
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

  const roleStr = currentUser?.role as string;
  const isAdmin = roleStr === 'Super Admin' || roleStr === 'SuperAdmin' || roleStr === 'Admin';
  const canCreate = hasPermission('CREATE');
  const canEditSaved = canEditSavedEntry();
  const canDeleteSaved = canDeleteSavedEntry();

  const isApproved = existingRecord?.status === 'Approved';
  const isSubmitted = existingRecord?.status === 'Submitted';
  const isEditingExisting = Boolean(existingRecord);

  // New records require CREATE permission; editing saved records requires Admin-activated Edit permission
  const isReadOnly = isEditingExisting
    ? isApproved || !canEditSaved
    : !canCreate;

  // Individual entries filtered strictly to the active form (plus Form-09 A/B aliases)
  const formLogs = useMemo(() => {
    const validCodes = getFormCodeAliases(formMeta.code);
    return allInspections
      .filter(rec => {
        const recCode = String(rec.formCode || rec.formId || '').toUpperCase().trim();
        return validCodes.includes(recCode);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allInspections, formMeta.code]);

  const filteredFormLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return formLogs.filter(rec => {
      if (onlyMyEntries) {
        const isMine =
          rec.inspectorId === currentUser.id ||
          rec.inspectorName?.toLowerCase() === currentUser.displayName.toLowerCase();
        if (!isMine) return false;
      }
      if (!q) return true;
      return (
        rec.inspectionNo.toLowerCase().includes(q) ||
        (rec.inspectorName || '').toLowerCase().includes(q) ||
        (rec.machineNo || '').toLowerCase().includes(q) ||
        (rec.qualityName || '').toLowerCase().includes(q) ||
        (rec.remarks || '').toLowerCase().includes(q)
      );
    });
  }, [formLogs, logSearch, onlyMyEntries, currentUser.id, currentUser.displayName]);

  // Row operations
  const handleAddRow = () => {
    const newIdx = readingRows.length + 1;
    const row: Record<string, any> = {
      sampleNo: newIdx/* ,
      rollNo: newIdx,
      pieceNo: newIdx,
      bagNo: newIdx,
      bagSampleNo: newIdx, */
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

    if (isEditingExisting && !canEditSaved) {
      setSaveFeedback({
        type: 'error',
        title: 'Edit Permission Locked',
        message:
          'Editing saved entries is disabled for your account. Ask an Admin to enable Edit access in Users & Form Permissions.',
      });
      return;
    }

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
      const isPermDenied = pgRes.message?.toLowerCase().includes('permission denied');
      const feedback: SaveFeedbackState = pgRes.success
        ? {
            type: 'success',
            title:
              targetStatus === 'Submitted'
                ? 'Submitted & Saved to PostgreSQL'
                : 'Draft Saved to PostgreSQL',
            message: `${finalRecord.inspectionNo} saved cleanly to PostgreSQL (inspections${
              pgRes.formTable ? ` + ${pgRes.formTable}` : ''
            }). Review your entry anytime in the Individual Form Log below.`,
          }
        : isPermDenied
        ? {
            type: 'error',
            title: 'Permission Denied by Server',
            message:
              pgRes.message ||
              'Admin has not activated Edit permission for your account.',
          }
        : {
            type: 'warning',
            title: 'Saved Locally — PostgreSQL Sync Failed',
            message:
              pgRes.message ||
              'Could not reach PostgreSQL backend. Verify server status.',
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

  const handleConfirmDeleteLog = () => {
    if (!deleteLogTarget || !canDeleteSaved) return;
    const removed = dataService.deleteInspection(deleteLogTarget.id, currentUser);
    const removedId = deleteLogTarget.id;
    const removedNo = deleteLogTarget.inspectionNo;
    setDeleteLogTarget(null);
    if (inspectingLogRecord?.id === removedId) {
      setInspectingLogRecord(null);
    }
    if (removed) {
      setSaveFeedback({
        type: 'success',
        title: 'Entry Deleted',
        message: `Removed ${removedNo} from local registry and PostgreSQL.`,
      });
      if (id === removedId) {
        navigate(`/new-inspection?form=${encodeURIComponent(formMeta.code)}`, { replace: true });
      }
    }
  };

  // Render helper for the Individual Form Entry Log block
  const renderIndividualFormLog = () => (
    <section
      id="individual-form-entry-log"
      className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] shadow-xs overflow-hidden"
    >
      <div className="p-4 bg-[#FBF4E1] border-b border-[#E4D0A3] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardList size={16} className="text-[#8B0A12]" />
            <h3 className="text-xs font-bold text-[#5C080E] uppercase tracking-wider">
              6. Individual Form Entry Log — {formMeta.code} ({filteredFormLogs.length} of {formLogs.length} Entries)
            </h3>
          </div>
          <p className="text-[11px] text-[#6E524B] mt-0.5">
            Verify saved submissions and readings for <strong>{formMeta.title}</strong>. Edit &amp; Delete actions are unlocked only when enabled by an Administrator.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              id="form-log-search-input"
              type="text"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Filter log # / inspector / remarks..."
              className="bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#2B1114] placeholder:text-[#8B6D62] w-56"
            />
            <Search size={13} className="absolute left-2.5 top-2 text-[#8B6D62]" />
          </div>

          <button
            type="button"
            onClick={() => setOnlyMyEntries(!onlyMyEntries)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              onlyMyEntries
                ? 'bg-[#8B0A12] text-[#FFFDF8] border-[#68050B]'
                : 'bg-[#FFFDF8] text-[#5C080E] border-[#E4D0A3] hover:bg-[#FDF5DC]'
            }`}
          >
            {onlyMyEntries ? 'Showing: My Entries' : 'My Entries Only'}
          </button>
        </div>
      </div>

      {/* Permission Summary Notice for Non-Admins */}
      {!isAdmin && (!canEditSaved || !canDeleteSaved) && (
        <div className="px-4 py-2 bg-[#FDF5DC] border-b border-[#E4D0A3] text-[11px] text-[#7A560B] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold">
            <Lock size={13} className="text-[#9B6E14] shrink-0" />
            <span>
              Individual Log Permissions: View / Check Data is active · Edit is{' '}
              <strong>{canEditSaved ? 'Enabled' : 'Locked by Admin'}</strong> · Delete is{' '}
              <strong>{canDeleteSaved ? 'Enabled' : 'Locked by Admin'}</strong>
            </span>
          </div>
          <span className="text-[10px] text-[#6E524B]">
            Contact Administrator to activate Edit or Delete access
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-[#FBF4E1] border-b border-[#E4D0A3] text-[#5C080E] font-semibold">
              <th className="py-2.5 px-3">Inspection #</th>
              <th className="py-2.5 px-3">Date &amp; Shift</th>
              <th className="py-2.5 px-3">Quality / Machine</th>
              <th className="py-2.5 px-3">Inspector</th>
              <th className="py-2.5 px-3 text-center">Samples</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Result</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE2C2]">
            {filteredFormLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#6E524B]">
                  <p className="font-semibold text-[#5C080E]">
                    No entries logged yet for {formMeta.code}.
                  </p>
                  <p className="text-[11px] mt-1">
                    Save a draft or submit measurements above — the record will appear here immediately for review.
                  </p>
                </td>
              </tr>
            ) : (
              filteredFormLogs.map(rec => {
                const isRecApproved = rec.status === 'Approved';
                const rowCanEdit = canEditSaved && !isRecApproved;
                const rowCanDelete = canDeleteSaved;
                const isCurrentOpen = existingRecord?.id === rec.id;

                return (
                  <tr
                    key={rec.id}
                    className={`transition-colors ${
                      isCurrentOpen ? 'bg-[#FDF5DC]/75' : 'hover:bg-[#FCF3DE]'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-[#8B0A12] tabular-nums whitespace-nowrap">
                      {rec.inspectionNo}
                      {isCurrentOpen && (
                        <span className="ml-1.5 text-[10px] font-sans font-bold text-[#7A560B]">
                          (Open)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114] tabular-nums whitespace-nowrap">
                      <div className="font-semibold">{rec.inspectionDate}</div>
                      <div className="text-[10px] text-[#6E524B]">
                        {rec.inspectionTime ? `${rec.inspectionTime} · ` : ''}
                        {(rec.shiftName || rec.shiftId || '').split(' ')[0]}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114]">
                      <div className="font-semibold truncate max-w-[180px]" title={rec.qualityName}>
                        {rec.qualityName}
                      </div>
                      {rec.machineNo && (
                        <div className="text-[10px] text-[#6E524B] font-mono">
                          Machine: {rec.machineNo}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#2B1114] font-medium">
                      {rec.inspectorName}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#5C080E] tabular-nums">
                      {rec.readingRows?.length || 0}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      <ResultBadge result={rec.result} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`log-check-${rec.id}`}
                          type="button"
                          onClick={() => setInspectingLogRecord(rec)}
                          className="px-2.5 py-1 rounded-md border border-[#DFC378] bg-[#FDF5DC] hover:bg-[#F5E4AE] text-[#7A560B] text-[11px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          title="Inspect submitted parameters, readings grid & statistical output"
                        >
                          <Eye size={12} />
                          <span>Check Data</span>
                        </button>

                        <button
                          id={`log-edit-${rec.id}`}
                          type="button"
                          disabled={!rowCanEdit}
                          onClick={() => {
                            if (!rowCanEdit) return;
                            setActiveViewTab('form');
                            navigate(`/inspection/${rec.id}`);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          title={
                            isRecApproved
                              ? 'Approved records are permanently locked'
                              : !canEditSaved
                              ? 'Locked — Ask Admin to enable Edit permission in Users & Form Permissions'
                              : 'Load entry into form editor'
                          }
                          className={`px-2 py-1 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                            rowCanEdit
                              ? 'bg-[#FFFDF8] border-[#E4D0A3] text-[#8B0A12] hover:bg-[#8B0A12] hover:text-[#FFFDF8] cursor-pointer'
                              : 'bg-[#FBF4E1]/60 border-[#EFE2C2] text-[#9E857C] cursor-not-allowed opacity-70'
                          }`}
                        >
                          {rowCanEdit ? <Edit2 size={12} /> : <Lock size={11} />}
                          <span>Edit</span>
                        </button>

                        <button
                          id={`log-delete-${rec.id}`}
                          type="button"
                          disabled={!rowCanDelete}
                          onClick={() => {
                            if (!rowCanDelete) return;
                            setDeleteLogTarget(rec);
                          }}
                          title={
                            rowCanDelete
                              ? 'Delete entry permanently'
                              : 'Locked — Ask Admin to enable Delete permission in Users & Form Permissions'
                          }
                          className={`p-1.5 rounded-md border transition-colors shrink-0 ${
                            rowCanDelete
                              ? 'bg-[#FFFDF8] border-rose-200 text-[#8B0A12] hover:bg-rose-50 cursor-pointer'
                              : 'bg-[#FBF4E1]/60 border-[#EFE2C2] text-[#9E857C] cursor-not-allowed opacity-70'
                          }`}
                        >
                          <Trash2 size={12} />
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
    </section>
  );

  // Enforce per-form permissions
  const isPermitted = canAccessForm(formMeta.code);
  if (!isPermitted) {
    return (
      <div className="bg-[#FFFDF8] rounded-xl p-8 border border-[#E4D0A3] text-center max-w-lg mx-auto my-12 shadow-sm space-y-4">
        <div className="w-14 h-14 bg-[#FDF5DC] text-[#8B0A12] rounded-xl flex items-center justify-center mx-auto border border-[#DFC378]">
          <Lock size={26} />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#2B1114]">Form Access Restricted</h2>
          <p className="text-xs text-[#6E524B] mt-1.5 leading-relaxed">
            Your user account is not currently authorized to access or submit inspections for{' '}
            <strong className="text-[#2B1114]">
              {formMeta.code} ({formMeta.title})
            </strong>
            .
          </p>
          <p className="text-[11px] text-[#6E524B] mt-1">
            Please ask an SQC Administrator to assign permission for this form in the{' '}
            <strong>Users &amp; Form Permissions</strong> panel.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => navigate('/inspections')}
            className="px-4 py-2 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Back to Inspections List
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingRecord) {
    return (
      <div className="bg-[#FFFDF8] rounded-xl p-10 border border-[#E4D0A3] text-center max-w-md mx-auto my-12 shadow-sm flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-[#8B0A12]" />
        <p className="text-xs font-semibold text-[#5C080E]">
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
          className={`rounded-xl p-3.5 border shadow-xs flex items-start justify-between gap-3 text-xs ${
            saveFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : saveFeedback.type === 'warning'
              ? 'bg-[#FDF5DC] border-[#DFC378] text-[#2B1114]'
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
                    ? 'text-[#9B6E14] shrink-0 mt-0.5'
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
            className="text-xs font-bold opacity-60 hover:opacity-100 px-1.5 py-0.5 cursor-pointer"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-[#FFFDF8] rounded-xl p-4 border border-[#E4D0A3] shadow-xs flex flex-col gap-4">
        {/* Header Section */}
        <div className="flex items-start gap-3">
          <button
            id="back-to-inspections-btn"
            type="button"
            onClick={() => navigate('/inspections')}
            className="p-2 rounded-lg border border-[#E4D0A3] hover:bg-[#FBF4E1] bg-[#FFFDF8] text-[#8B0A12] transition-colors shrink-0 cursor-pointer"
            title="Back to All Inspection Records"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] font-bold border border-[#D4AF37]/60 shadow-2xs tabular-nums">
                {formMeta.code}
              </span>

              <h2 className="text-base font-bold text-[#2B1114]">{formMeta.title}</h2>

              {existingRecord && <StatusBadge status={existingRecord.status} />}
            </div>

            <p className="text-xs text-[#6E524B] mt-1.5">
              Department: <strong className="text-[#5C080E]">{formMeta.department}</strong>
              <span className="mx-2 text-[#C9962B]" aria-hidden="true">·</span>
              Section: <strong className="text-[#5C080E]">{formMeta.section}</strong>
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-3 border-t border-[#EFE2C2]">
          <div className="flex items-center gap-3 flex-wrap">
            {!id && Object.keys(FORM_REGISTRY).length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#5C080E] font-semibold whitespace-nowrap">
                  Form:
                </span>
                <select
                  id="select-active-form-code"
                  value={selectedFormCode}
                  onChange={e =>
                    navigate(`/new-inspection?form=${encodeURIComponent(e.target.value)}`)
                  }
                  aria-label="Select Active Form Code"
                  className="text-xs bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg px-2.5 py-1.5 font-semibold text-[#2B1114] max-w-[320px]"
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

            {/* Segmented Switcher: Entry Sheet vs Individual Form Log */}
            <div className="inline-flex items-center gap-1 p-1 bg-[#FBF4E1] rounded-lg border border-[#E4D0A3]">
              <button
                id="tab-entry-sheet"
                type="button"
                onClick={() => setActiveViewTab('form')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeViewTab === 'form'
                    ? 'bg-[#8B0A12] text-[#FFFDF8] shadow-2xs'
                    : 'text-[#5C080E] hover:bg-[#FDF5DC]'
                }`}
              >
                Entry Sheet
              </button>
              <button
                id="tab-individual-log"
                type="button"
                onClick={() => setActiveViewTab('log')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  activeViewTab === 'log'
                    ? 'bg-[#8B0A12] text-[#FFFDF8] shadow-2xs'
                    : 'text-[#5C080E] hover:bg-[#FDF5DC]'
                }`}
              >
                Individual Form Log ({formLogs.length})
              </button>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {Boolean(id) && canCreate && (
              <button
                id="new-same-form-entry-btn"
                type="button"
                onClick={() => {
                  setActiveViewTab('form');
                  navigate(`/new-inspection?form=${encodeURIComponent(formMeta.code)}`);
                }}
                className="px-3 py-2 rounded-lg border border-[#DFC378] bg-[#FDF5DC] hover:bg-[#F5E4AE] text-[#7A560B] text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>New {formMeta.code} Entry</span>
              </button>
            )}

            {activeViewTab === 'form' && !isReadOnly && (
              <>
                <button
                  id="save-draft-btn"
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveDraft}
                  className="px-3.5 py-2 rounded-lg border border-[#E4D0A3] bg-[#FFFDF8] text-[#5C080E] hover:bg-[#FBF4E1] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Draft</span>
                </button>

                <button
                  id="submit-inspection-btn"
                  type="button"
                  disabled={isSaving}
                  onClick={handleSubmitInspectionClick}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] hover:from-[#68050B] hover:to-[#4E0308] text-xs font-bold inline-flex items-center gap-1.5 shadow-sm border border-[#D4AF37]/40 transition-all disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{isSaving ? 'Saving to PostgreSQL...' : 'Submit to HOD'}</span>
                </button>
              </>
            )}

            {/* Approver Actions */}
            {isSubmitted && hasPermission('APPROVE') && (
              <div className="flex items-center gap-2 pl-2 border-l border-[#E4D0A3]">
                <button
                  id="btn-approve-inspection"
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setApprovalActionModal('approve');
                    setWorkflowRemarks('Conforms to SQC standards. Approved for production lot.');
                  }}
                  className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
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
                  className="px-3 py-2 rounded-lg bg-[#C9962B] text-[#FFFDF8] text-xs font-bold hover:bg-[#9B6E14] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
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
                  className="px-3 py-2 rounded-lg bg-[#68050B] text-white text-xs font-bold hover:bg-[#4E0308] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Full Individual Form Log View */}
      {activeViewTab === 'log' ? (
        renderIndividualFormLog()
      ) : (
        <>
          {/* Lock Notice if approved */}
          {isApproved && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-950 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-emerald-700 shrink-0" />
                <div>
                  <span className="font-bold">Permanent Inspection Lock:</span> Approved by{' '}
                  <strong>{existingRecord.approvedBy}</strong> on{' '}
                  {new Date(existingRecord.approvedAt || '').toLocaleString()}.
                  {existingRecord.approvalRemarks && (
                    <span> Remarks: &quot;{existingRecord.approvalRemarks}&quot;</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold tabular-nums">
                Record Ver. {existingRecord.version}
              </span>
            </div>
          )}

          {/* Read-Only Edit Lock Notice for Non-Approved Existing Entries */}
          {isEditingExisting && !isApproved && !canEditSaved && (
            <div className="bg-[#FDF5DC] border border-[#DFC378] rounded-xl p-3.5 text-xs text-[#2B1114] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <Lock size={16} className="text-[#9B6E14] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#7A560B]">
                    Read-Only Verification Mode — Edit Locked by Admin:
                  </span>{' '}
                  You can inspect all entered readings below. To edit saved records, ask an SQC Administrator to activate <strong>Edit</strong> permission in{' '}
                  <strong>Users &amp; Form Permissions</strong>.
                </div>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => navigate(`/new-inspection?form=${encodeURIComponent(formMeta.code)}`)}
                  className="px-3 py-1.5 rounded-lg bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] text-[11px] font-bold shrink-0 whitespace-nowrap cursor-pointer"
                >
                  + Enter New Record
                </button>
              )}
            </div>
          )}

          <div className="bg-[#FBF4E1] text-[#2B1114] rounded-xl p-3.5 shadow-2xs border border-[#E4D0A3] text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[#8B0A12] font-bold uppercase tracking-wider text-[11px]">
                <Info size={14} />
                <span>Controlled Factory Standard Specification</span>
              </div>
              <p className="text-[#6E524B] mt-1 font-medium">{formMeta.sourceStandardText}</p>
            </div>

            <div className="bg-[#FFFDF8] px-3.5 py-2 rounded-lg border border-[#E4D0A3] text-right min-w-[200px]">
              <span className="text-[10px] text-[#6E524B] uppercase tracking-wider block font-semibold">
                Live Evaluation
              </span>
              <div className="flex items-center justify-end gap-2 mt-0.5">
                <ResultBadge result={calculationResult.result} />
              </div>
            </div>
          </div>

          {/* General Inspection Context Fields */}
          <div className="bg-[#FFFDF8] rounded-xl p-4 border border-[#E4D0A3] shadow-xs">
            <h3 className="text-xs font-bold text-[#8B0A12] uppercase tracking-wider mb-3 border-b border-[#EFE2C2] pb-2">
              1. Common Inspection Context
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#5C080E] mb-1">Inspection #</label>
                <input
                  type="text"
                  readOnly
                  value={generalInfo.inspectionNo || 'Auto Generated'}
                  className="w-full bg-[#FBF4E1] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 font-mono text-[#5C080E] text-xs font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C080E] mb-1">
                  Inspection Date
                </label>
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={generalInfo.inspectionDate}
                  onChange={e => setGeneralInfo({ ...generalInfo, inspectionDate: e.target.value })}
                  className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 text-xs text-[#2B1114] font-semibold tabular-nums disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C080E] mb-1">Shift</label>
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
                  className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 text-xs text-[#2B1114] font-semibold disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
                >
                  <option value="Shift-A">Shift A (06:00 - 14:00)</option>
                  <option value="Shift-B">Shift B (14:00 - 22:00)</option>
                  <option value="Shift-C">Shift C (22:00 - 06:00)</option>
                  <option value="General">General Shift (08:00 - 17:00)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C080E] mb-1">
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
                  className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 text-xs text-[#2B1114] font-semibold disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
                >
                  {qualities.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.code} - {q.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C080E] mb-1">
                  Machine / Frame (if any)
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={generalInfo.machineNo}
                  placeholder="e.g. Card-01 / Frame-4"
                  onChange={e => setGeneralInfo({ ...generalInfo, machineNo: e.target.value })}
                  className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 text-xs text-[#2B1114] font-semibold placeholder:text-[#8B6D62] disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C080E] mb-1">Inspector</label>
                <input
                  type="text"
                  readOnly
                  value={existingRecord?.inspectorName || currentUser.displayName}
                  className="w-full bg-[#FBF4E1] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 text-xs font-bold text-[#5C080E]"
                />
              </div>
            </div>
          </div>

          {/* Form Specific Header Parameters */}
          {formMeta.fields.length > 0 && (
            <div className="bg-[#FFFDF8] rounded-xl p-4 border border-[#E4D0A3] shadow-xs">
              <h3 className="text-xs font-bold text-[#8B0A12] uppercase tracking-wider mb-3 border-b border-[#EFE2C2] pb-2">
                2. {formMeta.title} – Header Parameters
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {formMeta.fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-[11px] font-semibold text-[#5C080E] mb-1">
                      {field.label}{' '}
                      {field.unit && <span className="text-[#9B6E14]">({field.unit})</span>}
                      {field.required && <span className="text-[#8B0A12] ml-0.5">*</span>}
                    </label>

                    {field.type === 'select' ? (
                      <select
                        disabled={isReadOnly}
                        value={formData[field.key] ?? field.defaultValue ?? ''}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                        aria-label={field.label}
                        className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 text-xs text-[#2B1114] font-medium disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
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
                        className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-md px-2.5 py-1.5 text-xs text-[#2B1114] font-medium placeholder:text-[#8B6D62] disabled:bg-[#FBF4E1] disabled:text-[#6E524B] tabular-nums"
                      />
                    )}

                    {field.helpText && (
                      <p className="text-[10px] text-[#6E524B] mt-0.5">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repeatable Readings Table */}
          <div className="bg-[#FFFDF8] rounded-xl border border-[#E4D0A3] shadow-xs overflow-hidden">
            <div className="p-3.5 bg-[#FBF4E1] border-b border-[#E4D0A3] flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#8B0A12] uppercase tracking-wider">
                  3. Sample Readings &amp; Measurements Grid ({readingRows.length} Samples)
                </h3>
                <p className="text-[11px] text-[#6E524B]">
                  Unit: <strong className="text-[#5C080E]">{formMeta.sampleUnit}</strong>
                </p>
              </div>

              {!isReadOnly && (
                <button
                  id="add-reading-row-btn"
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 bg-[#FFFDF8] border border-[#DFC378] hover:bg-[#FDF5DC] text-[#7A560B] rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Sample Row</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#FBF4E1] border-b border-[#E4D0A3] text-[#5C080E] font-semibold">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    {formMeta.columns.map(col => (
                      <th
                        key={col.key}
                        style={{ width: col.width }}
                        className="py-2.5 px-3 font-semibold text-[#5C080E]"
                      >
                        {col.label}{' '}
                        {col.unit && <span className="text-[#9B6E14] font-normal">({col.unit})</span>}
                      </th>
                    ))}
                    {!isReadOnly && <th className="py-2.5 px-3 w-12 text-center">Action</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#EFE2C2]">
                  {readingRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FCF3DE] transition-colors">
                      <td className="py-2 px-3 text-center text-[#6E524B] font-mono tabular-nums">
                        {idx + 1}
                      </td>

                      {formMeta.columns.map(col => (
                        <td key={col.key} className="py-1.5 px-2">
                          {col.type === 'readonly' ? (
                            <span className="font-mono text-[#5C080E] font-semibold px-2 py-1 block tabular-nums">
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
                              className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded px-2 py-1 text-xs text-[#2B1114] font-medium disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
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
                              className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded px-2 py-1 text-xs text-[#2B1114] font-medium font-mono tabular-nums disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
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
                            className="text-[#8B6D62] hover:text-[#8B0A12] hover:bg-[#FDF5DC] rounded p-1 disabled:opacity-30 transition-colors cursor-pointer"
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
          <div className="bg-[#FBF4E1] text-[#2B1114] rounded-xl p-4 shadow-xs border border-[#E4D0A3]">
            <div className="flex items-center justify-between mb-3 border-b border-[#E4D0A3] pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#C9962B]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B0A12]">
                  4. System-Calculated Statistical Outputs &amp; Acceptance Result
                </h3>
              </div>

              <span className="text-[10px] bg-[#FDF5DC] text-[#7A560B] px-2.5 py-0.5 rounded font-mono font-bold border border-[#DFC378]">
                Source Mathematical Standards Engine
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {Object.entries(calculationResult.metrics).map(([key, val]) => (
                <div
                  key={key}
                  className="bg-[#FFFDF8] p-2.5 rounded-lg border border-[#E4D0A3] shadow-2xs"
                >
                  <span className="text-[10px] text-[#6E524B] font-semibold uppercase tracking-wider block">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>

                  <span className="text-base font-bold font-mono text-[#5C080E] mt-1 block tabular-nums">
                    {typeof val === 'number' ? val.toLocaleString() : String(val)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#E4D0A3] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#8B0A12] font-bold">Evaluation Verdict:</span>
                <ResultBadge result={calculationResult.result} />
                <span className="text-[#6E524B] text-[11px]">
                  {calculationResult.result === 'PASS'
                    ? 'All sampled readings conform to SQC tolerances.'
                    : calculationResult.result === 'WARNING'
                    ? 'Readings approach limit boundary. Close process monitoring required.'
                    : 'Defect or deviation exceeds allowable mill standard.'}
                </span>
              </div>

              <span className="text-[11px] text-[#7A560B] font-semibold">
                Read-only verified calculations · Cannot be manually altered
              </span>
            </div>
          </div>

          {/* Inspector Remarks */}
          <div className="bg-[#FFFDF8] rounded-xl p-4 border border-[#E4D0A3] shadow-xs">
            <label className="block text-xs font-bold text-[#8B0A12] uppercase tracking-wider mb-2">
              5. Inspector Observations &amp; Floor Remarks
            </label>

            <textarea
              disabled={isReadOnly}
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Enter machine condition, lot notes, corrective actions taken..."
              className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg p-2.5 text-xs text-[#2B1114] placeholder:text-[#8B6D62] disabled:bg-[#FBF4E1] disabled:text-[#6E524B]"
            ></textarea>
          </div>

          {/* Per-Form Individual Entry Log always visible right below Section 5 */}
          {renderIndividualFormLog()}
        </>
      )}

      {/* Read-Only "Check Data" Verification Modal for Individual Entry Log */}
      {inspectingLogRecord && (
        <div className="fixed inset-0 bg-[#2B1114]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF8] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#DFC378] overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#68050B] via-[#8B0A12] to-[#68050B] text-[#FFFDF8] border-b-2 border-[#D4AF37] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#4E0308] border border-[#D4AF37]/60 font-bold tabular-nums">
                    {inspectingLogRecord.formCode}
                  </span>
                  <h4 className="text-sm font-bold truncate">
                    Entry Verification — {inspectingLogRecord.inspectionNo}
                  </h4>
                </div>
                <p className="text-[11px] text-[#FCF8EE]/85 mt-0.5">
                  Submitted by <strong>{inspectingLogRecord.inspectorName}</strong> ·{' '}
                  {inspectingLogRecord.inspectionDate}{' '}
                  {inspectingLogRecord.inspectionTime || ''} · {inspectingLogRecord.shiftName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLogRecord(null)}
                className="p-1.5 rounded-lg text-[#FFFDF8]/80 hover:text-white hover:bg-white/15 cursor-pointer"
                aria-label="Close entry details"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Top Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FBF4E1] p-3 rounded-xl border border-[#E4D0A3]">
                <div>
                  <span className="text-[10px] font-bold text-[#6E524B] uppercase block">
                    Department
                  </span>
                  <span className="font-bold text-[#2B1114]">{inspectingLogRecord.departmentName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#6E524B] uppercase block">
                    Quality Master
                  </span>
                  <span className="font-bold text-[#2B1114]">{inspectingLogRecord.qualityName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#6E524B] uppercase block">
                    Machine / Loom
                  </span>
                  <span className="font-bold text-[#2B1114] font-mono">
                    {inspectingLogRecord.machineNo || inspectingLogRecord.loomNo || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={inspectingLogRecord.status} />
                  <ResultBadge result={inspectingLogRecord.result} />
                </div>
              </div>

              {/* Entered Header Parameters */}
              {formMeta.fields.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold text-[#8B0A12] uppercase tracking-wider mb-2">
                    Entered Header Parameters
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {formMeta.fields.map(field => {
                      const val = inspectingLogRecord.formData?.[field.key];
                      return (
                        <div
                          key={field.key}
                          className="p-2.5 rounded-lg bg-[#FFFDF8] border border-[#EFE2C2]"
                        >
                          <span className="text-[10px] text-[#6E524B] block">
                            {field.label} {field.unit ? `(${field.unit})` : ''}
                          </span>
                          <span className="font-bold text-[#2B1114] font-mono tabular-nums mt-0.5 block">
                            {val !== undefined && val !== '' ? String(val) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sample Readings Table */}
              <div>
                <h5 className="text-[11px] font-bold text-[#8B0A12] uppercase tracking-wider mb-2">
                  Entered Sample Readings ({inspectingLogRecord.readingRows?.length || 0} Rows)
                </h5>
                <div className="overflow-x-auto border border-[#E4D0A3] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-[#FBF4E1] border-b border-[#E4D0A3] text-[#5C080E] font-semibold">
                        <th className="py-2 px-3 w-10 text-center">#</th>
                        {formMeta.columns.map(col => (
                          <th key={col.key} className="py-2 px-3">
                            {col.label}{' '}
                            {col.unit ? (
                              <span className="text-[#9B6E14] font-normal">({col.unit})</span>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE2C2]">
                      {(inspectingLogRecord.readingRows || []).map((r, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#FCF3DE]">
                          <td className="py-1.5 px-3 text-center font-mono text-[#6E524B] tabular-nums">
                            {rIdx + 1}
                          </td>
                          {formMeta.columns.map(col => (
                            <td
                              key={col.key}
                              className="py-1.5 px-3 font-mono text-[#2B1114] font-medium tabular-nums"
                            >
                              {r[col.key] !== undefined && r[col.key] !== ''
                                ? String(r[col.key])
                                : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Statistical Outputs */}
              {inspectingLogRecord.summaryMetrics &&
                Object.keys(inspectingLogRecord.summaryMetrics).length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-bold text-[#8B0A12] uppercase tracking-wider mb-2">
                      Calculated Statistical Outputs
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {Object.entries(inspectingLogRecord.summaryMetrics).map(([k, v]) => (
                        <div
                          key={k}
                          className="p-2.5 rounded-lg bg-[#FBF4E1] border border-[#E4D0A3]"
                        >
                          <span className="text-[10px] text-[#6E524B] uppercase block">
                            {k.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="font-mono font-bold text-[#5C080E] text-sm tabular-nums mt-0.5 block">
                            {typeof v === 'number' ? v.toLocaleString() : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Remarks */}
              {inspectingLogRecord.remarks && (
                <div className="p-3 rounded-lg bg-[#FBF4E1] border border-[#E4D0A3]">
                  <span className="text-[10px] font-bold text-[#8B0A12] uppercase block mb-1">
                    Inspector Observations &amp; Remarks
                  </span>
                  <p className="text-[#2B1114]">{inspectingLogRecord.remarks}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-[#FBF4E1] border-t border-[#E4D0A3] flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-[#6E524B] font-mono tabular-nums">
                Version {inspectingLogRecord.version} · Updated{' '}
                {new Date(inspectingLogRecord.updatedAt || inspectingLogRecord.createdAt).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                {canDeleteSaved && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = inspectingLogRecord;
                      setInspectingLogRecord(null);
                      setDeleteLogTarget(target);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 bg-[#FFFDF8] text-[#8B0A12] hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                )}

                {canEditSaved && inspectingLogRecord.status !== 'Approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = inspectingLogRecord.id;
                      setInspectingLogRecord(null);
                      setActiveViewTab('form');
                      navigate(`/inspection/${targetId}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>Load Into Editor</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setInspectingLogRecord(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#E4D0A3] bg-[#FFFDF8] hover:bg-[#FDF5DC] text-[#5C080E] text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entry Confirmation Modal */}
      {deleteLogTarget && (
        <div className="fixed inset-0 bg-[#2B1114]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF8] rounded-xl max-w-sm w-full p-5 shadow-2xl border border-[#DFC378] space-y-3">
            <div className="flex items-center gap-2 text-[#8B0A12] font-bold text-sm">
              <AlertTriangle size={18} />
              <span>Confirm Entry Deletion</span>
            </div>
            <p className="text-xs text-[#6E524B] leading-relaxed">
              Permanently delete entry{' '}
              <strong className="text-[#2B1114] font-mono">{deleteLogTarget.inspectionNo}</strong> ({deleteLogTarget.formCode})? This removes the record from PostgreSQL and records an audit entry.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteLogTarget(null)}
                className="px-3 py-1.5 border border-[#E4D0A3] bg-[#FFFDF8] text-[#5C080E] text-xs font-semibold rounded-lg hover:bg-[#FBF4E1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-form-log-btn"
                type="button"
                onClick={handleConfirmDeleteLog}
                className="px-3.5 py-1.5 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Submit Confirmation Modal (No native window.confirm) */}
      {showSubmitConfirmModal && (
        <div className="fixed inset-0 bg-[#2B1114]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF8] rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#DFC378] space-y-4">
            <div className="flex items-center justify-between border-b border-[#EFE2C2] pb-2">
              <h4 className="text-sm font-bold text-[#5C080E]">
                Confirm Submit Inspection Report
              </h4>
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                className="text-[#8B6D62] hover:text-[#2B1114] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#6E524B] leading-relaxed">
              Submit <strong className="font-mono text-[#8B0A12]">{generalInfo.inspectionNo}</strong>{' '}
              (<strong>{formMeta.code}</strong>) for HOD approval and save directly to PostgreSQL?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                className="px-3 py-1.5 border border-[#E4D0A3] text-[#5C080E] text-xs font-semibold rounded-lg hover:bg-[#FBF4E1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="px-4 py-1.5 bg-[#8B0A12] hover:bg-[#68050B] text-[#FFFDF8] text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 bg-[#2B1114]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFDF8] rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#DFC378] space-y-4">
            <div className="flex items-center justify-between border-b border-[#EFE2C2] pb-2">
              <h4 className="text-sm font-bold text-[#2B1114] capitalize">
                Confirm Action: {approvalActionModal} Inspection
              </h4>
              <button
                type="button"
                onClick={() => setApprovalActionModal(null)}
                className="text-[#8B6D62] hover:text-[#2B1114] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5C080E] mb-1">
                Approver Remarks / Correction Instructions:
              </label>
              <textarea
                rows={3}
                value={workflowRemarks}
                onChange={e => setWorkflowRemarks(e.target.value)}
                className="w-full bg-[#FFFDF8] border border-[#E4D0A3] rounded-lg p-2 text-xs text-[#2B1114]"
                placeholder="Enter approval or rejection comments..."
              ></textarea>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApprovalActionModal(null)}
                className="px-3 py-1.5 border border-[#E4D0A3] text-[#5C080E] text-xs font-semibold rounded-lg hover:bg-[#FBF4E1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWorkflow}
                disabled={isSaving}
                className={`px-4 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer ${
                  approvalActionModal === 'approve'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : approvalActionModal === 'reject'
                    ? 'bg-[#8B0A12] hover:bg-[#68050B]'
                    : 'bg-[#C9962B] hover:bg-[#9B6E14]'
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
