import React, { useState } from 'react';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Building,
  Sliders,
  Award,
  Layers,
  FileCheck,
  X,
  AlertTriangle,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { postgresService } from '../services/postgresService';
import { PostgresSyncModal } from '../components/PostgresSyncModal';
import { useAuth } from '../context/AuthContext';
import {
  Department,
  Section,
  Machine,
  Loom,
  QualityMaster,
  StandardDefinition,
} from '../types';

export const MastersPage: React.FC<{ tab?: string }> = ({ tab = 'departments' }) => {
  const [activeTab, setActiveTab] = useState(tab);
  const { currentUser, hasPermission } = useAuth();

  const [departments, setDepartments] = useState<Department[]>(() => dataService.getDepartments());
  const [sections, setSections] = useState<Section[]>(() => dataService.getSections());
  const [machines, setMachines] = useState<Machine[]>(() => dataService.getMachines());
  const [looms, setLooms] = useState<Loom[]>(() => dataService.getLooms());
  const [qualities, setQualities] = useState<QualityMaster[]>(() => dataService.getQualities());
  const [standards, setStandards] = useState<StandardDefinition[]>(() => dataService.getStandards());

  // Editing / Creation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeFormData, setActiveFormData] = useState<any>({});
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string; type: string } | null>(null);
  const [isPgModalOpen, setIsPgModalOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

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
    setIsEditing(true);
    setActiveFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'departments') {
      const res = dataService.saveDepartment(activeFormData, currentUser);
      setDepartments([...res]);
    } else if (activeTab === 'sections') {
      const res = dataService.saveSection(activeFormData, currentUser);
      setSections([...res]);
    } else if (activeTab === 'machines') {
      const res = dataService.saveMachine(activeFormData, currentUser);
      setMachines([...res]);
    } else if (activeTab === 'looms') {
      const res = dataService.saveLoom(activeFormData, currentUser);
      setLooms([...res]);
    } else if (activeTab === 'qualities') {
      const res = dataService.saveQuality(activeFormData, currentUser);
      setQualities([...res]);
    } else if (activeTab === 'standards') {
      const res = dataService.saveStandard(activeFormData, currentUser);
      setStandards([...res]);
    }
    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteCandidate) return;
    if (deleteCandidate.type === 'departments') {
      const res = dataService.deleteDepartment(deleteCandidate.id, currentUser);
      setDepartments([...res]);
    } else if (deleteCandidate.type === 'sections') {
      const res = dataService.deleteSection(deleteCandidate.id, currentUser);
      setSections([...res]);
    } else if (deleteCandidate.type === 'machines') {
      const res = dataService.deleteMachine(deleteCandidate.id, currentUser);
      setMachines([...res]);
    } else if (deleteCandidate.type === 'looms') {
      const res = dataService.deleteLoom(deleteCandidate.id, currentUser);
      setLooms([...res]);
    } else if (deleteCandidate.type === 'qualities') {
      const res = dataService.deleteQuality(deleteCandidate.id, currentUser);
      setQualities([...res]);
    } else if (deleteCandidate.type === 'standards') {
      const res = dataService.deleteStandard(deleteCandidate.id, currentUser);
      setStandards([...res]);
    }
    setDeleteCandidate(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database size={18} className="text-emerald-700" />
            <span>Master Data Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full CRUD: Add, edit, update specifications, and configure mill departments, machine inventory, and factory standards
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-masters-pg-sync"
            onClick={() => setIsPgModalOpen(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors border border-slate-700"
            title="Manage PostgreSQL replication and view database status"
          >
            <Database size={14} className="text-emerald-400" />
            <span>PostgreSQL Sync Hub</span>
          </button>

          {canEdit && (
            <button
              id="btn-add-master-entry"
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus size={15} />
              <span>+ Add New Entry</span>
            </button>
          )}
        </div>
      </div>

      {syncNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
          <span>{syncNotice}</span>
          <button
            onClick={() => setIsPgModalOpen(true)}
            className="underline font-bold text-emerald-950 hover:text-emerald-800"
          >
            Open DB Hub
          </button>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 py-2.5 px-3.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-emerald-800 text-emerald-950 font-bold bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* DEPARTMENTS TAB */}
        {activeTab === 'departments' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Department Name</th>
                <th className="py-2.5 px-3">HOD / Approver</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{d.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{d.name}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium">{d.hodName}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Active
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(d)}
                        title="Edit Department"
                        className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate({ id: d.id, name: d.name, type: 'departments' })}
                        title="Delete Department"
                        className="p-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* SECTIONS TAB */}
        {activeTab === 'sections' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">Section Code</th>
                <th className="py-2.5 px-3">Section Description</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sections.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{s.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{s.name}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium">{s.departmentCode}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        title="Edit Section"
                        className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate({ id: s.id, name: s.name, type: 'sections' })}
                        title="Delete Section"
                        className="p-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* MACHINES TAB */}
        {activeTab === 'machines' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">Machine Code</th>
                <th className="py-2.5 px-3">Machine Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Rated Standard Speed</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {machines.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{m.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{m.name}</td>
                  <td className="py-2.5 px-3 text-slate-700">{m.machineType}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-800 font-bold">
                    {m.speedStandard} {m.speedUnit}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        title="Edit Machine"
                        className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate({ id: m.id, name: m.name, type: 'machines' })}
                        title="Delete Machine"
                        className="p-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* LOOMS TAB */}
        {activeTab === 'looms' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">Loom Code</th>
                <th className="py-2.5 px-3">Name / Description</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Shed</th>
                <th className="py-2.5 px-3">Standard RPM</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {looms.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{l.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{l.name}</td>
                  <td className="py-2.5 px-3 text-slate-700">{l.loomType}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium">{l.shed}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-800 font-bold">{l.standardRpm} RPM</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(l)}
                        title="Edit Loom"
                        className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate({ id: l.id, name: l.name, type: 'looms' })}
                        title="Delete Loom"
                        className="p-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* QUALITIES TAB */}
        {activeTab === 'qualities' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">Quality Code</th>
                <th className="py-2.5 px-3">Quality Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Nominal Count</th>
                <th className="py-2.5 px-3">Standard M.R. %</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {qualities.map(q => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{q.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{q.name}</td>
                  <td className="py-2.5 px-3 text-slate-700">{q.category}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-800 font-bold">{q.nominalCount} lbs/spy</td>
                  <td className="py-2.5 px-3 font-mono text-slate-800 font-bold">{q.standardMR}%</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(q)}
                        title="Edit Quality"
                        className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate({ id: q.id, name: q.name, type: 'qualities' })}
                        title="Delete Quality"
                        className="p-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* STANDARDS TAB */}
        {activeTab === 'standards' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">Standard Code</th>
                <th className="py-2.5 px-3">Form Target</th>
                <th className="py-2.5 px-3">Standard Name & Parameter</th>
                <th className="py-2.5 px-3">Target Value</th>
                <th className="py-2.5 px-3">Acceptable Range</th>
                <th className="py-2.5 px-3">Tolerance Specification</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {standards.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">{s.code}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded inline-block my-1 border border-slate-200">
                    {s.formCode}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-[10px] text-slate-500">Param: {s.parameter}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    {s.nominalValue} {s.unit}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">
                    {s.lowerLimit} – {s.upperLimit} {s.unit}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 font-semibold">{s.tolerance}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        title="Edit Standard"
                        className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate({ id: s.id, name: s.name, type: 'standards' })}
                        title="Delete Standard"
                        className="p-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dynamic Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                {isEditing ? 'Edit' : 'Add New'} {tabs.find(t => t.id === activeTab)?.label}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Code / Identifier *</label>
                <input
                  type="text"
                  required
                  value={activeFormData.code || ''}
                  onChange={e => setActiveFormData({ ...activeFormData, code: e.target.value })}
                  placeholder="Unique identification code"
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Name / Title *</label>
                <input
                  type="text"
                  required
                  value={activeFormData.name || ''}
                  onChange={e => setActiveFormData({ ...activeFormData, name: e.target.value })}
                  placeholder="Full descriptive title"
                  className="w-full border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              {/* Department specific fields */}
              {activeTab === 'departments' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HOD / Approver Name</label>
                  <input
                    type="text"
                    value={activeFormData.hodName || ''}
                    onChange={e => setActiveFormData({ ...activeFormData, hodName: e.target.value })}
                    placeholder="e.g. S. Sen (HOD)"
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              )}

              {/* Section specific fields */}
              {activeTab === 'sections' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={activeFormData.departmentCode || ''}
                    onChange={e => setActiveFormData({ ...activeFormData, departmentCode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium"
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
                    <label className="block font-semibold text-slate-700 mb-1">Machine Type</label>
                    <input
                      type="text"
                      value={activeFormData.machineType || ''}
                      onChange={e => setActiveFormData({ ...activeFormData, machineType: e.target.value })}
                      placeholder="e.g. Drawing Frame"
                      className="w-full border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Standard Speed ({activeFormData.speedUnit || 'rpm'})</label>
                    <input
                      type="number"
                      step="any"
                      value={activeFormData.speedStandard ?? ''}
                      onChange={e => setActiveFormData({ ...activeFormData, speedStandard: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Loom specific fields */}
              {activeTab === 'looms' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Loom Type</label>
                    <input
                      type="text"
                      value={activeFormData.loomType || ''}
                      onChange={e => setActiveFormData({ ...activeFormData, loomType: e.target.value })}
                      placeholder="e.g. Sacking Ordinary"
                      className="w-full border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Standard RPM</label>
                    <input
                      type="number"
                      value={activeFormData.standardRpm ?? ''}
                      onChange={e => setActiveFormData({ ...activeFormData, standardRpm: parseInt(e.target.value, 10) || 0 })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Quality specific fields */}
              {activeTab === 'qualities' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nominal Count (lbs/spy)</label>
                    <input
                      type="number"
                      step="any"
                      value={activeFormData.nominalCount ?? ''}
                      onChange={e => setActiveFormData({ ...activeFormData, nominalCount: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Standard M.R. %</label>
                    <input
                      type="number"
                      step="any"
                      value={activeFormData.standardMR ?? ''}
                      onChange={e => setActiveFormData({ ...activeFormData, standardMR: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Standards specific fields */}
              {activeTab === 'standards' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Target Form (Code)</label>
                      <input
                        type="text"
                        value={activeFormData.formCode || ''}
                        onChange={e => setActiveFormData({ ...activeFormData, formCode: e.target.value })}
                        placeholder="e.g. FORM-01"
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
                      <input
                        type="text"
                        value={activeFormData.unit || ''}
                        onChange={e => setActiveFormData({ ...activeFormData, unit: e.target.value })}
                        placeholder="e.g. kg, %, lbs"
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Target Value</label>
                      <input
                        type="number"
                        step="any"
                        value={activeFormData.nominalValue ?? ''}
                        onChange={e => setActiveFormData({ ...activeFormData, nominalValue: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lower Limit</label>
                      <input
                        type="number"
                        step="any"
                        value={activeFormData.lowerLimit ?? ''}
                        onChange={e => setActiveFormData({ ...activeFormData, lowerLimit: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Upper Limit</label>
                      <input
                        type="number"
                        step="any"
                        value={activeFormData.upperLimit ?? ''}
                        onChange={e => setActiveFormData({ ...activeFormData, upperLimit: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle size={18} />
              <span>Confirm Master Record Deletion</span>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete record{' '}
              <strong className="text-slate-900">{deleteCandidate.name}</strong>?
              This will update the master catalog and log into the audit trail.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PostgreSQL Sync Modal */}
      <PostgresSyncModal isOpen={isPgModalOpen} onClose={() => setIsPgModalOpen(false)} />
    </div>
  );
};
