import React from 'react';
import { InspectionStatus, InspectionResult } from '../../types';

export const StatusBadge: React.FC<{ status: InspectionStatus; id?: string }> = ({ status, id }) => {
  const styles: Record<InspectionStatus, string> = {
    Draft: 'bg-amber-100 text-amber-800 border-amber-300',
    Submitted: 'bg-blue-100 text-blue-800 border-blue-300',
    'Under Review': 'bg-purple-100 text-purple-800 border-purple-300',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Rejected: 'bg-rose-100 text-rose-800 border-rose-300',
    Returned: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  return (
    <span
      id={id || `status-${status.toLowerCase().replace(/\s+/g, '-')}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
        styles[status] || 'bg-slate-100 text-slate-800 border-slate-300'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {status}
    </span>
  );
};

export const ResultBadge: React.FC<{ result: InspectionResult; id?: string }> = ({ result, id }) => {
  const styles: Record<InspectionResult, { container: string; dot: string }> = {
    PASS: {
      container: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold',
      dot: 'bg-emerald-500',
    },
    WARNING: {
      container: 'bg-amber-50 text-amber-700 border-amber-300 font-bold',
      dot: 'bg-amber-500',
    },
    FAIL: {
      container: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
      dot: 'bg-rose-500',
    },
  };

  const current = styles[result] || styles.WARNING;

  return (
    <span
      id={id || `result-badge-${result.toLowerCase()}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs tracking-wider border whitespace-nowrap uppercase ${current.container}`}
    >
      <span className={`w-2 h-2 rounded-full mr-1.5 ${current.dot}`}></span>
      {result}
    </span>
  );
};

export const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
  id?: string;
}> = ({ title, value, subtitle, icon, color = 'emerald', id }) => {
  const colorSchemes = {
    emerald: 'border-emerald-200 bg-white text-emerald-950',
    blue: 'border-sky-200 bg-white text-sky-950',
    amber: 'border-amber-200 bg-white text-amber-950',
    rose: 'border-rose-200 bg-white text-rose-950',
    slate: 'border-slate-200 bg-white text-slate-950',
  };

  const iconBg = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div
      id={id}
      className={`p-4 rounded-xl border shadow-xs transition-all hover:shadow-md ${colorSchemes[color]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg border ${iconBg[color]}`}>{icon}</div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
};
