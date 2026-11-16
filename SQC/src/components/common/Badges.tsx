import React from 'react';
import { InspectionStatus, InspectionResult } from '../../types';

export const StatusBadge: React.FC<{ status: InspectionStatus; id?: string }> = ({ status, id }) => {
  const styles: Record<InspectionStatus, string> = {
    Draft: 'bg-[#FDF5DC] text-[#7A560B] border-[#DFC378]',
    Submitted: 'bg-sky-50 text-sky-900 border-sky-300',
    'Under Review': 'bg-[#FBF4E1] text-[#5C080E] border-[#C9962B]',
    Approved: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    Rejected: 'bg-rose-50 text-[#8B0A12] border-rose-300',
    Returned: 'bg-orange-50 text-orange-900 border-orange-300',
  };

  return (
    <span
      id={id || `status-${status.toLowerCase().replace(/\s+/g, '-')}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
        styles[status] || 'bg-[#FBF4E1] text-[#5C080E] border-[#E4D0A3]'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-75"></span>
      {status}
    </span>
  );
};

export const ResultBadge: React.FC<{ result: InspectionResult; id?: string }> = ({ result, id }) => {
  const styles: Record<InspectionResult, { container: string; dot: string }> = {
    PASS: {
      container: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      dot: 'bg-emerald-600',
    },
    WARNING: {
      container: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
      dot: 'bg-amber-500',
    },
    FAIL: {
      container: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
      dot: 'bg-rose-600',
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
    emerald: 'border-[#E4D0A3] bg-[#FFFDF8] text-[#2B1114]',
    blue: 'border-[#E4D0A3] bg-[#FFFDF8] text-[#2B1114]',
    amber: 'border-[#DFC378] bg-[#FFFDF8] text-[#2B1114]',
    rose: 'border-[#E4D0A3] bg-[#FFFDF8] text-[#2B1114]',
    slate: 'border-[#E4D0A3] bg-[#FFFDF8] text-[#2B1114]',
  };

  const iconBg = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    blue: 'bg-[#FBF4E1] text-[#8B0A12] border-[#E4D0A3]',
    amber: 'bg-[#FDF5DC] text-[#9B6E14] border-[#DFC378]',
    rose: 'bg-rose-50 text-[#8B0A12] border-rose-200',
    slate: 'bg-[#FBF4E1] text-[#5C080E] border-[#E4D0A3]',
  };

  return (
    <div
      id={id}
      className={`p-4 rounded-xl border shadow-2xs transition-all hover:shadow-sm ${colorSchemes[color]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#6E524B] uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg border shrink-0 ${iconBg[color]}`}>{icon}</div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-[#2B1114] tabular-nums">
          {value}
        </span>
      </div>
      {subtitle && <p className="mt-1 text-xs text-[#6E524B]">{subtitle}</p>}
    </div>
  );
};
