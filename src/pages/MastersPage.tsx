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
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import {
  Department,
  Section,
  Machine,
  Loom,
  QualityMaster,
  ProductSpecification,
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

  // Editing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const canEdit = hasPermission('MANAGE_MASTERS');

  const tabs = [
    { id: 'departments', label: 'Departments & HODs', icon: <Building size={15} /> },
    { id: 'sections', label: 'Sections', icon: <Layers size={15} /> },
    { id: 'machines', label: 'Machines & Speeds', icon: <Sliders size={15} /> },
    { id: 'looms', label: 'Looms', icon: <Sliders size={15} /> },
    { id: 'qualities', label: 'Qualities & Counts', icon: <Award size={15} /> },
    { id: 'standards', label: 'SQC Standards & Limits', icon: <FileCheck size={15} /> },
  ];

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
            Configure mill departments, machine inventory, quality parameters, and factory standards
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              setEditingItem({});
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={14} />
            <span>Add New Entry</span>
          </button>
        )}
      </div>

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
        {activeTab === 'departments' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Department Name</th>
                <th className="py-2.5 px-3">HOD / Approver</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{d.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{d.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{d.hodName}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'sections' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Section Code</th>
                <th className="py-2.5 px-3">Section Description</th>
                <th className="py-2.5 px-3">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sections.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{s.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{s.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{s.departmentCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'machines' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Machine Code</th>
                <th className="py-2.5 px-3">Machine Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Rated Standard Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {machines.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{m.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{m.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{m.machineType}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">
                    {m.speedStandard} {m.speedUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'looms' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Loom Code</th>
                <th className="py-2.5 px-3">Name / Description</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Shed</th>
                <th className="py-2.5 px-3">Standard RPM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {looms.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{l.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{l.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.loomType}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.shed}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{l.standardRpm} RPM</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'qualities' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Quality Code</th>
                <th className="py-2.5 px-3">Quality Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Nominal Count</th>
                <th className="py-2.5 px-3">Standard M.R. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {qualities.map(q => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{q.code}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{q.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{q.category}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{q.nominalCount} lbs/spy</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{q.standardMR}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'standards' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Standard Code</th>
                <th className="py-2.5 px-3">Form Target</th>
                <th className="py-2.5 px-3">Standard Name & Parameter</th>
                <th className="py-2.5 px-3">Target Value</th>
                <th className="py-2.5 px-3">Acceptable Range</th>
                <th className="py-2.5 px-3">Tolerance Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {standards.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{s.code}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{s.formCode}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-[10px] text-slate-500">Param: {s.parameter}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {s.nominalValue} {s.unit}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {s.lowerLimit} – {s.upperLimit} {s.unit}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-medium">{s.tolerance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal dialog for creating masters if triggered */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Add New Master Record ({activeTab})</h4>
            <p className="text-xs text-slate-500">
              Enter master parameters to register in Bally Jute SQC system.
            </p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Code / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. MCH-10 / QUAL-01"
                  className="w-full border border-slate-300 rounded p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Name / Title</label>
                <input
                  type="text"
                  placeholder="Full descriptive title"
                  className="w-full border border-slate-300 rounded p-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('Master record saved successfully.');
                  setIsModalOpen(false);
                }}
                className="px-4 py-1.5 bg-emerald-800 text-white text-xs font-bold rounded-lg"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
