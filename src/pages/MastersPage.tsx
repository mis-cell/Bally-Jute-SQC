import React, { useState } from 'react';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  Building,
  Sliders,
  Award,
  Layers,
  FileCheck,
  X,
  AlertTriangle,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useRealtimeData } from '../hooks/useRealtimeSync';

export const MastersPage: React.FC<{ tab?: string }> = ({ tab = 'departments' }) => {
  const [activeTab, setActiveTab] = useState(tab);
  const { currentUser, hasPermission } = useAuth();

  const departments = useRealtimeData(() => dataService.getDepartments());
  const sections = useRealtimeData(() => dataService.getSections());
  const machines = useRealtimeData(() => dataService.getMachines());
  const looms = useRealtimeData(() => dataService.getLooms());
  const qualities = useRealtimeData(() => dataService.getQualities());
  const standards = useRealtimeData(() => dataService.getStandards());

  // Editing / Creation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeFormData, setActiveFormData] = useState<any>({});
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string; type: string } | null>(null);
  const [isPgModalOpen, setIsPgModalOpen] = useState(false);
  const [syncNotice] = useState<string | null>(null);

  const canEdit = hasPermission('MANAGE_MASTERS');

  const tabs = [
    { id: 'departments', label: 'Departments & HODs', icon: <Building size={15} /> },
    { id: 'sections', label: 'Sections', icon: <Layers size={15} /> },
    { id: 'machines', label: 'Machines & Speeds', icon: <Sliders size={15} /> },
    { id: 'looms', label: 'Looms', icon: <Sliders size={15} /> },
    { id: 'qualities', label: 'Qualities & Counts', icon: <Award size={15} /> },
    { id: 'standards', label: 'SQC Standards & Limits', icon: <FileCheck size={15} /> },
  ];

  const handleOpenAdd = () => {
    if (!canEdit) return;
    setIsEditing(false);
    if (activeTab === 'departments') {
      setActiveFormData({
        id: `dept-${Date.now()}`,
        code: 'DEPT-',
        name: '',
        hodName: '',
        hodEmail: '',
        status: 'Active',
      });
    } else if (activeTab === 'sections') {
      setActiveFormData({
        id: `sec-${Date.now()}`,
        code: 'SEC-',
        name: '',
        departmentCode: departments[0]?.code || 'DEPT-SEL',
      });
    } else if (activeTab === 'machines') {
      setActiveFormData({
        id: `mch-${Date.now()}`,
        code: 'MCH-',
        name: '',
        departmentCode: 'DEPT-SEL',
        machineType: 'Standard Machine',
        speedStandard: 0,
        speedUnit: 'rpm',
      });
    } else if (activeTab === 'looms') {
      setActiveFormData({
        id: `loom-${Date.now()}`,
        code: 'LM-',
        name: '',
        loomType: 'Hessian Ordinary',
        shed: 'Shed 1',
        standardRpm: 140,
      });
    } else if (activeTab === 'qualities') {
      setActiveFormData({
        id: `qual-${Date.now()}`,
        code: 'QUAL-',
        name: '',
        category: 'Hessian',
        nominalCount: 8,
        standardMR: 17,
      });
    } else if (activeTab === 'standards') {
      setActiveFormData({
        id: `std-${Date.now()}`,
        code: 'STD-',
        formCode: 'FORM-01',
        name: '',
        parameter: '',
        nominalValue: 0,
        lowerLimit: 0,
        upperLimit: 0,
        unit: 'kg',
        tolerance: '±5%',
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    if (!canEdit) return;
    setIsEditing(true);
    setActiveFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (activeTab === 'departments') {
      await dataService.saveDepartment(activeFormData, currentUser);
    } else if (activeTab === 'sections') {
      await dataService.saveSection(activeFormData);
    } else if (activeTab === 'machines') {
      await dataService.saveMachine(activeFormData, currentUser);
    } else if (activeTab === 'looms') {
      await dataService.saveLoom(activeFormData, currentUser);
    } else if (activeTab === 'qualities') {
      await dataService.saveQuality(activeFormData, currentUser);
    } else if (activeTab === 'standards') {
      await dataService.saveStandard(activeFormData, currentUser);
    }
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate || !canEdit) return;
    if (deleteCandidate.type === 'departments') {
      await dataService.deleteDepartment(deleteCandidate.id);
    } else if (deleteCandidate.type === 'sections') {
      await dataService.deleteSection(deleteCandidate.id);
    } else if (deleteCandidate.type === 'machines') {
      await dataService.deleteMachine(deleteCandidate.id);
    } else if (deleteCandidate.type === 'looms') {
      await dataService.deleteLoom(deleteCandidate.id);
    } else if (deleteCandidate.type === 'qualities') {
      await dataService.deleteQuality(deleteCandidate.id);
    } else if (deleteCandidate.type === 'standards') {
      await dataService.deleteStandard(deleteCandidate.id);
    }
    setDeleteCandidate(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-[#FFFFFF] rounded-xl p-4 border border-[#F5D0CB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#393334] flex items-center gap-2">
            <Database size={18} className="text-[#EA5551]" />
            <span>Master Data Management</span>
          </h2>
          <p className="text-xs text-[#806B68] mt-0.5">
            Full CRUD: Add, edit, update specifications, and configure mill departments, machine inventory, and factory standards
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              id="btn-add-master-entry"
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#EA5551] to-[#D46764] hover:from-[#D46764] hover:to-[#EA5551] text-[#FFFFFF] text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs border border-[#FFE0DA]/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus size={15} />
              <span>Add New Entry</span>
            </button>
          )}
        </div>
      </div>

      {syncNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs">
          <span>{syncNotice}</span>
          <button
            onClick={() => setIsPgModalOpen(true)}
            className="underline font-bold text-emerald-950 hover:text-emerald-800 cursor-pointer"
          >
            Open DB Hub
          </button>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-[#F5D0CB] overflow-x-auto gap-2 text-xs">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 py-2.5 px-3.5 font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === t.id
                ? 'border-[#EA5551] text-[#EA5551] font-bold bg-[#FFFFFF] rounded-t-lg'
                : 'border-transparent text-[#806B68] hover:text-[#393334]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content Container */}
      <div className="bg-[#FFFFFF] rounded-xl border border-[#F5D0CB] shadow-xs overflow-x-auto">
        {/* DEPARTMENTS TAB */}
        {activeTab === 'departments' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-bold">
              <tr>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Department Name</th>
                <th className="py-2.5 px-3">HOD / Approver</th>
                <th className="py-2.5 px-3">Status</th>
                {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-[#FFEAE6]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551]">{d.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#393334]">{d.name}</td>
                  <td className="py-2.5 px-3 text-[#393334] font-medium">{d.hodName}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      Active
                    </span>
                  </td>
                  {canEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          title="Edit Department"
                          className="p-1.5 text-[#EA5551] hover:bg-[#FFFFFF] border border-[#F5D0CB] rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteCandidate({ id: d.id, name: d.name, type: 'departments' })
                          }
                          title="Delete Department"
                          className="p-1.5 text-[#EA5551] hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* SECTIONS TAB */}
        {activeTab === 'sections' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-bold">
              <tr>
                <th className="py-2.5 px-3">Section Code</th>
                <th className="py-2.5 px-3">Section Description</th>
                <th className="py-2.5 px-3">Department</th>
                {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {sections.map(s => (
                <tr key={s.id} className="hover:bg-[#FFEAE6]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551]">{s.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#393334]">{s.name}</td>
                  <td className="py-2.5 px-3 text-[#393334] font-medium">{s.departmentCode}</td>
                  {canEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Section"
                          className="p-1.5 text-[#EA5551] hover:bg-[#FFFFFF] border border-[#F5D0CB] rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteCandidate({ id: s.id, name: s.name, type: 'sections' })
                          }
                          title="Delete Section"
                          className="p-1.5 text-[#EA5551] hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* MACHINES TAB */}
        {activeTab === 'machines' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-bold">
              <tr>
                <th className="py-2.5 px-3">Machine Code</th>
                <th className="py-2.5 px-3">Machine Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Rated Standard Speed</th>
                {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {machines.map(m => (
                <tr key={m.id} className="hover:bg-[#FFEAE6]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551]">{m.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#393334]">{m.name}</td>
                  <td className="py-2.5 px-3 text-[#393334]">{m.machineType}</td>
                  <td className="py-2.5 px-3 font-mono text-[#EA5551] font-bold tabular-nums">
                    {m.speedStandard} {m.speedUnit}
                  </td>
                  {canEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          title="Edit Machine"
                          className="p-1.5 text-[#EA5551] hover:bg-[#FFFFFF] border border-[#F5D0CB] rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteCandidate({ id: m.id, name: m.name, type: 'machines' })
                          }
                          title="Delete Machine"
                          className="p-1.5 text-[#EA5551] hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* LOOMS TAB */}
        {activeTab === 'looms' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-bold">
              <tr>
                <th className="py-2.5 px-3">Loom Code</th>
                <th className="py-2.5 px-3">Name / Description</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Shed</th>
                <th className="py-2.5 px-3">Standard RPM</th>
                {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {looms.map(l => (
                <tr key={l.id} className="hover:bg-[#FFEAE6]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551]">{l.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#393334]">{l.name}</td>
                  <td className="py-2.5 px-3 text-[#393334]">{l.loomType}</td>
                  <td className="py-2.5 px-3 text-[#393334] font-medium">{l.shed}</td>
                  <td className="py-2.5 px-3 font-mono text-[#EA5551] font-bold tabular-nums">
                    {l.standardRpm} RPM
                  </td>
                  {canEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(l)}
                          title="Edit Loom"
                          className="p-1.5 text-[#EA5551] hover:bg-[#FFFFFF] border border-[#F5D0CB] rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteCandidate({ id: l.id, name: l.name, type: 'looms' })
                          }
                          title="Delete Loom"
                          className="p-1.5 text-[#EA5551] hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* QUALITIES TAB */}
        {activeTab === 'qualities' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-bold">
              <tr>
                <th className="py-2.5 px-3">Quality Code</th>
                <th className="py-2.5 px-3">Quality Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Nominal Count</th>
                <th className="py-2.5 px-3">Standard M.R. %</th>
                {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {qualities.map(q => (
                <tr key={q.id} className="hover:bg-[#FFEAE6]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551]">{q.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#393334]">{q.name}</td>
                  <td className="py-2.5 px-3 text-[#393334]">{q.category}</td>
                  <td className="py-2.5 px-3 font-mono text-[#EA5551] font-bold tabular-nums">
                    {q.nominalCount} lbs/spy
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#EA5551] font-bold tabular-nums">
                    {q.standardMR}%
                  </td>
                  {canEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(q)}
                          title="Edit Quality"
                          className="p-1.5 text-[#EA5551] hover:bg-[#FFFFFF] border border-[#F5D0CB] rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteCandidate({ id: q.id, name: q.name, type: 'qualities' })
                          }
                          title="Delete Quality"
                          className="p-1.5 text-[#EA5551] hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* STANDARDS TAB */}
        {activeTab === 'standards' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FFF1EE] border-b border-[#F5D0CB] text-[#EA5551] font-bold">
              <tr>
                <th className="py-2.5 px-3">Standard Code</th>
                <th className="py-2.5 px-3">Form Target</th>
                <th className="py-2.5 px-3">Standard Name &amp; Parameter</th>
                <th className="py-2.5 px-3">Target Value</th>
                <th className="py-2.5 px-3">Acceptable Range</th>
                <th className="py-2.5 px-3">Tolerance Specification</th>
                {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FDE8E4]">
              {standards.map(s => (
                <tr key={s.id} className="hover:bg-[#FFEAE6]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551]">{s.code}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#EA5551]">
                    <span className="bg-[#FFFFFF] px-2 py-0.5 rounded border border-[#F5D0CB]">
                      {s.formCode}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-[#393334]">{s.name}</div>
                    <div className="text-[10px] text-[#806B68]">Param: {s.parameter}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#393334] tabular-nums">
                    {s.nominalValue} {s.unit}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#806B68] tabular-nums">
                    {s.lowerLimit} – {s.upperLimit} {s.unit}
                  </td>
                  <td className="py-2.5 px-3 text-[#393334] font-semibold">{s.tolerance}</td>
                  {canEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Standard"
                          className="p-1.5 text-[#EA5551] hover:bg-[#FFFFFF] border border-[#F5D0CB] rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteCandidate({ id: s.id, name: s.name, type: 'standards' })
                          }
                          title="Delete Standard"
                          className="p-1.5 text-[#EA5551] hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dynamic Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#393334]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFFFF] rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#F5D0CB] space-y-4">
            <div className="flex items-center justify-between border-b border-[#FDE8E4] pb-3">
              <h4 className="text-sm font-bold text-[#393334]">
                {isEditing ? 'Edit' : 'Add New'} {tabs.find(t => t.id === activeTab)?.label}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#806B68] hover:text-[#393334] p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#EA5551] mb-1">
                  Code / Identifier *
                </label>
                <input
                  type="text"
                  required
                  value={activeFormData.code || ''}
                  onChange={e => setActiveFormData({ ...activeFormData, code: e.target.value })}
                  placeholder="Unique identification code"
                  className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#EA5551] mb-1">Name / Title *</label>
                <input
                  type="text"
                  required
                  value={activeFormData.name || ''}
                  onChange={e => setActiveFormData({ ...activeFormData, name: e.target.value })}
                  placeholder="Full descriptive title"
                  className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-medium text-[#393334]"
                />
              </div>

              {/* Department specific fields */}
              {activeTab === 'departments' && (
                <div>
                  <label className="block font-semibold text-[#EA5551] mb-1">
                    HOD / Approver Name
                  </label>
                  <input
                    type="text"
                    value={activeFormData.hodName || ''}
                    onChange={e =>
                      setActiveFormData({ ...activeFormData, hodName: e.target.value })
                    }
                    placeholder="e.g. S. Sen (HOD)"
                    className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 text-[#393334]"
                  />
                </div>
              )}

              {/* Section specific fields */}
              {activeTab === 'sections' && (
                <div>
                  <label className="block font-semibold text-[#EA5551] mb-1">Department</label>
                  <select
                    value={activeFormData.departmentCode || ''}
                    onChange={e =>
                      setActiveFormData({ ...activeFormData, departmentCode: e.target.value })
                    }
                    className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-medium text-[#393334]"
                  >
                    {departments.map(d => (
                      <option key={d.code} value={d.code}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Machine specific fields */}
              {activeTab === 'machines' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-[#EA5551] mb-1">
                      Machine Type
                    </label>
                    <input
                      type="text"
                      value={activeFormData.machineType || ''}
                      onChange={e =>
                        setActiveFormData({ ...activeFormData, machineType: e.target.value })
                      }
                      placeholder="e.g. Drawing Frame"
                      className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 text-[#393334]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#EA5551] mb-1">
                      Standard Speed ({activeFormData.speedUnit || 'rpm'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={activeFormData.speedStandard ?? ''}
                      onChange={e =>
                        setActiveFormData({
                          ...activeFormData,
                          speedStandard: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                    />
                  </div>
                </div>
              )}

              {/* Loom specific fields */}
              {activeTab === 'looms' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-[#EA5551] mb-1">Loom Type</label>
                    <input
                      type="text"
                      value={activeFormData.loomType || ''}
                      onChange={e =>
                        setActiveFormData({ ...activeFormData, loomType: e.target.value })
                      }
                      placeholder="e.g. Sacking Ordinary"
                      className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 text-[#393334]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#EA5551] mb-1">Standard RPM</label>
                    <input
                      type="number"
                      value={activeFormData.standardRpm ?? ''}
                      onChange={e =>
                        setActiveFormData({
                          ...activeFormData,
                          standardRpm: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                    />
                  </div>
                </div>
              )}

              {/* Quality specific fields */}
              {activeTab === 'qualities' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-[#EA5551] mb-1">
                      Nominal Count (lbs/spy)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={activeFormData.nominalCount ?? ''}
                      onChange={e =>
                        setActiveFormData({
                          ...activeFormData,
                          nominalCount: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#EA5551] mb-1">
                      Standard M.R. %
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={activeFormData.standardMR ?? ''}
                      onChange={e =>
                        setActiveFormData({
                          ...activeFormData,
                          standardMR: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                    />
                  </div>
                </div>
              )}

              {/* Standards specific fields */}
              {activeTab === 'standards' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-[#EA5551] mb-1">
                        Target Form (Code)
                      </label>
                      <input
                        type="text"
                        value={activeFormData.formCode || ''}
                        onChange={e =>
                          setActiveFormData({ ...activeFormData, formCode: e.target.value })
                        }
                        placeholder="e.g. FORM-01"
                        className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#EA5551] mb-1">
                        Unit of Measure
                      </label>
                      <input
                        type="text"
                        value={activeFormData.unit || ''}
                        onChange={e =>
                          setActiveFormData({ ...activeFormData, unit: e.target.value })
                        }
                        placeholder="e.g. kg, %, lbs"
                        className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-[#EA5551] mb-1">Target Value</label>
                      <input
                        type="number"
                        step="any"
                        value={activeFormData.nominalValue ?? ''}
                        onChange={e =>
                          setActiveFormData({
                            ...activeFormData,
                            nominalValue: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#EA5551] mb-1">Lower Limit</label>
                      <input
                        type="number"
                        step="any"
                        value={activeFormData.lowerLimit ?? ''}
                        onChange={e =>
                          setActiveFormData({
                            ...activeFormData,
                            lowerLimit: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#EA5551] mb-1">Upper Limit</label>
                      <input
                        type="number"
                        step="any"
                        value={activeFormData.upperLimit ?? ''}
                        onChange={e =>
                          setActiveFormData({
                            ...activeFormData,
                            upperLimit: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-[#FFFFFF] border border-[#F5D0CB] rounded-lg p-2 font-mono text-[#393334]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#FDE8E4]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 border border-[#F5D0CB] text-[#EA5551] text-xs font-semibold rounded-lg hover:bg-[#FFF1EE] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#EA5551] hover:bg-[#D46764] text-[#FFFFFF] text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  {isEditing ? 'Save Changes' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-[#393334]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FFFFFF] rounded-xl max-w-sm w-full p-5 shadow-2xl border border-[#F5D0CB] space-y-3">
            <div className="flex items-center gap-2 text-[#EA5551] font-bold text-sm">
              <AlertTriangle size={18} />
              <span>Confirm Master Record Deletion</span>
            </div>
            <p className="text-xs text-[#806B68]">
              Are you sure you want to permanently delete record{' '}
              <strong className="text-[#393334]">{deleteCandidate.name}</strong>? This will update
              the master catalog and log into the audit trail.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-3 py-1.5 border border-[#F5D0CB] text-[#EA5551] text-xs font-semibold rounded-lg hover:bg-[#FFF1EE] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-[#EA5551] hover:bg-[#D46764] text-[#FFFFFF] text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
