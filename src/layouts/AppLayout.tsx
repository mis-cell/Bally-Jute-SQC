import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  FileBarChart,
  Database,
  ShieldAlert,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  User,
  LogOut,
  Building2,
  Sliders,
  Award,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, allUsers, switchUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formsSubmenuOpen, setFormsSubmenuOpen] = useState(true);
  const [mastersSubmenuOpen, setMastersSubmenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const notifications = dataService.getNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  const settings = dataService.getSettings();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/inspections?search=${encodeURIComponent(searchQuery)}`);
  };

  const formGroups = [
    { title: 'Raw Fiber & Spreader', forms: ['FORM-01', 'FORM-02', 'FORM-03', 'FORM-04', 'FORM-05'] },
    { title: 'Carding & Drawing', forms: ['FORM-06', 'FORM-07', 'FORM-08', 'FORM-09'] },
    { title: 'Spinning & Winding', forms: ['FORM-10', 'FORM-11', 'FORM-12'] },
    { title: 'Beaming & Weaving', forms: ['FORM-13', 'FORM-14', 'FORM-15', 'FORM-16'] },
    { title: 'Finishing & Cutting', forms: ['FORM-17', 'FORM-18', 'FORM-19', 'FORM-20', 'FORM-21'] },
    { title: 'Godown & Sacksewing', forms: ['FORM-22', 'FORM-23', 'FORM-24'] },
    { title: 'Press & Broad Loom', forms: ['FORM-25', 'FORM-26', 'FORM-27', 'FORM-28'] },
    { title: 'Central Laboratory', forms: ['FORM-29', 'FORM-30', 'FORM-31', 'FORM-32', 'FORM-33', 'FORM-34'] },
    { title: 'Engineering & Study', forms: ['FORM-35', 'FORM-36'] },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Professional ERP Header */}
      <header id="main-topbar" className="bg-emerald-900 text-white sticky top-0 z-40 shadow-md border-b border-emerald-800">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-md hover:bg-emerald-800 text-emerald-100 transition-colors"
              aria-label="Toggle Sidebar"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-base shadow-inner border border-emerald-400">
                BJ
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>{settings.companyName}</span>
                  <span className="bg-emerald-700/80 text-emerald-200 text-[10px] px-2 py-0.5 rounded font-mono font-medium border border-emerald-600">
                    S.Q.C. PORTAL
                  </span>
                </h1>
                <p className="text-[11px] text-emerald-300 font-normal">
                  {settings.companySubtitle} • FY {settings.financialYear}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Search */}
          <div className="hidden md:flex items-center max-w-md w-full mx-6">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                id="header-global-search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search inspections, lot #, machine, quality, form code..."
                className="w-full bg-emerald-950/60 text-emerald-50 text-xs rounded-lg pl-9 pr-4 py-1.5 border border-emerald-700/60 focus:outline-hidden focus:border-emerald-400 placeholder:text-emerald-400"
              />
              <Search className="absolute left-2.5 top-2 text-emerald-400" size={14} />
            </form>
          </div>

          {/* Right Action Menu & Multi-Role Persona Switcher */}
          <div className="flex items-center gap-3">
            {/* Quick Multi-Role Switcher */}
            <div className="flex items-center bg-emerald-950/70 rounded-lg p-1 border border-emerald-700/60">
              <span className="text-[10px] text-emerald-300 uppercase px-2 font-semibold">Active Role:</span>
              <select
                id="active-role-switcher"
                value={currentUser.id}
                onChange={e => switchUser(e.target.value)}
                aria-label="Switch User Persona / Role"
                className="bg-emerald-800 text-white text-xs rounded px-2 py-1 border border-emerald-600 focus:outline-hidden cursor-pointer font-medium"
              >
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} [{u.role}]
                  </option>
                ))}
              </select>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="notifications-toggle-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-1.5 rounded-lg hover:bg-emerald-800 text-emerald-200 relative"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div id="notifications-popover" className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 text-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Notifications & Alerts</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{notifications.length} Total</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          dataService.markNotificationRead(n.id);
                          if (n.linkUrl) navigate(n.linkUrl);
                          setNotificationsOpen(false);
                        }}
                        className={`p-2.5 text-xs hover:bg-slate-50 cursor-pointer ${!n.read ? 'bg-emerald-50/60' : ''}`}
                      >
                        <p className="font-semibold text-slate-800">{n.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left ERP Sidebar */}
        <aside
          id="main-sidebar"
          className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Navigation Menu</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-semibold border border-emerald-200">
              v2.6 Enterprise
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
            <NavLink
              to="/"
              id="nav-link-dashboard"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isActive ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>

            {/* Inspections Header */}
            <div>
              <button
                id="toggle-inspection-forms-menu"
                onClick={() => setFormsSubmenuOpen(!formsSubmenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardList size={16} className="text-emerald-700" />
                  <span>SQC Inspection (1–36)</span>
                </div>
                {formsSubmenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {formsSubmenuOpen && (
                <div className="mt-1 pl-4 pr-1 space-y-1">
                  <NavLink
                    to="/inspections"
                    id="nav-link-all-inspections"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium ${
                        isActive ? 'text-emerald-800 bg-emerald-50 font-bold' : 'text-slate-600 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Layers size={13} />
                    <span>All Inspection Records</span>
                  </NavLink>

                  <NavLink
                    to="/new-inspection"
                    id="nav-link-create-inspection"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium ${
                        isActive ? 'text-emerald-800 bg-emerald-50 font-bold' : 'text-emerald-700 hover:bg-emerald-50/50'
                      }`
                    }
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    <span>+ New Inspection Entry</span>
                  </NavLink>

                  <div className="pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    Department Form Lists
                  </div>

                  {formGroups.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-0.5">
                      <div className="text-[10px] font-semibold text-slate-500 px-2 pt-1">{group.title}</div>
                      {group.forms.map(fCode => {
                        const meta = FORM_REGISTRY[fCode];
                        if (!meta) return null;
                        return (
                          <NavLink
                            key={fCode}
                            to={`/new-inspection?form=${fCode}`}
                            id={`nav-form-${fCode.toLowerCase()}`}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                              `block px-2.5 py-1 rounded text-[11px] truncate transition-colors ${
                                location.search.includes(fCode) ? 'bg-emerald-100 text-emerald-900 font-bold' : 'text-slate-600 hover:bg-slate-100'
                              }`
                            }
                            title={`${meta.code}: ${meta.title}`}
                          >
                            <span className="font-mono text-emerald-800 mr-1.5 font-semibold">{meta.code.replace('FORM-', 'F')}</span>
                            {meta.title.split('–')[1]?.trim() || meta.title}
                          </NavLink>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approvals */}
            <NavLink
              to="/approvals"
              id="nav-link-approvals"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isActive ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Approvals Workflow</span>
            </NavLink>

            {/* Reports */}
            <NavLink
              to="/reports"
              id="nav-link-reports"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isActive ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <FileBarChart size={16} className="text-emerald-600" />
              <span>Reports & Analytics</span>
            </NavLink>

            {/* Masters */}
            <div>
              <button
                id="toggle-masters-menu"
                onClick={() => setMastersSubmenuOpen(!mastersSubmenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Database size={16} className="text-emerald-700" />
                  <span>Master Data</span>
                </div>
                {mastersSubmenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {mastersSubmenuOpen && (
                <div className="mt-1 pl-6 pr-1 space-y-0.5 text-[11px]">
                  <NavLink to="/masters/departments" id="nav-master-dept" className="block py-1 text-slate-600 hover:text-emerald-800">Departments & HODs</NavLink>
                  <NavLink to="/masters/sections" id="nav-master-sec" className="block py-1 text-slate-600 hover:text-emerald-800">Sections & Stages</NavLink>
                  <NavLink to="/masters/machines" id="nav-master-mach" className="block py-1 text-slate-600 hover:text-emerald-800">Machines & Speeds</NavLink>
                  <NavLink to="/masters/looms" id="nav-master-loom" className="block py-1 text-slate-600 hover:text-emerald-800">Looms Master</NavLink>
                  <NavLink to="/masters/qualities" id="nav-master-qual" className="block py-1 text-slate-600 hover:text-emerald-800">Qualities & Counts</NavLink>
                  <NavLink to="/masters/specs" id="nav-master-spec" className="block py-1 text-slate-600 hover:text-emerald-800">Product & Bag Specs</NavLink>
                  <NavLink to="/masters/standards" id="nav-master-std" className="block py-1 text-slate-600 hover:text-emerald-800">Standards & Tolerances</NavLink>
                </div>
              )}
            </div>

            {/* System Administration */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pb-1">
                Administration
              </div>
              <NavLink
                to="/admin/users"
                id="nav-link-users"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-medium text-xs ${
                    isActive ? 'bg-slate-100 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <User size={15} />
                <span>Users & Roles</span>
              </NavLink>
              <NavLink
                to="/admin/audit-logs"
                id="nav-link-audit-logs"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-medium text-xs ${
                    isActive ? 'bg-slate-100 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <History size={15} />
                <span>Audit Trail</span>
              </NavLink>
              <NavLink
                to="/admin/settings"
                id="nav-link-settings"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-1.5 rounded-lg font-medium text-xs ${
                    isActive ? 'bg-slate-100 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <Settings size={15} />
                <span>System Settings</span>
              </NavLink>
            </div>
          </div>

          {/* User Profile Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                {currentUser.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{currentUser.displayName}</p>
                <p className="text-[10px] text-emerald-700 font-medium truncate">{currentUser.role}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main id="app-main-content" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50/80">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
