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
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { FORM_REGISTRY } from '../constants/formsRegistry';
import { postgresService, PostgresConnectionStatus } from '../services/postgresService';
import { PostgresSyncModal } from '../components/PostgresSyncModal';
import { usePostgresSyncState } from '../hooks/useRealtimeSync';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, allUsers, switchUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formsSubmenuOpen, setFormsSubmenuOpen] = useState(true);
  const [mastersSubmenuOpen, setMastersSubmenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pgModalOpen, setPgModalOpen] = useState(false);
  const [pgStatus, setPgStatus] = useState<PostgresConnectionStatus | null>(() => postgresService.getCachedStatus());
  const syncState = usePostgresSyncState();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsub = postgresService.subscribe(status => {
      setPgStatus(status);
    });
    // Quick background check
    postgresService.testConnection().catch(() => {});
    return unsub;
  }, []);

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
              className="p-1.5 rounded-lg hover:bg-emerald-800 text-emerald-100 transition-colors flex items-center gap-1.5 border border-emerald-700/60 bg-emerald-800/40"
              aria-label="Toggle Sidebar"
              title="Toggle Menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              <span className="text-xs font-bold hidden sm:inline">Menu</span>
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
          <div className="flex items-center gap-2.5">
            {/* Real-time Sync Hub & Live Indicator */}
            <div className="flex items-center bg-emerald-950/90 rounded-lg p-0.5 border border-emerald-700/70 shadow-2xs">
              <button
                id="topbar-pg-status-btn"
                onClick={() => setPgModalOpen(true)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                  pgStatus?.isConnected
                    ? 'text-emerald-200 hover:bg-emerald-900/80'
                    : 'text-amber-300 hover:bg-amber-900/60'
                }`}
                title="Open PostgreSQL Real-Time Sync Hub"
              >
                <Database size={13} className={pgStatus?.isConnected ? 'text-emerald-400' : 'text-amber-400'} />
                <span className="hidden sm:inline">
                  {pgStatus?.isConnected ? `PG: ${pgStatus.database || 'SQC'}` : 'Local PG'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncState.isSyncing
                      ? 'bg-blue-400 animate-ping'
                      : pgStatus?.isConnected
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                  title={syncState.isSyncing ? 'Syncing...' : pgStatus?.isConnected ? 'Live Connected' : 'Offline'}
                />
              </button>

              {/* Instant Manual Sync Pull Button */}
              {postgresService.isSyncEnabled() && (
                <button
                  id="topbar-quick-sync-btn"
                  onClick={async () => {
                    setIsManualSyncing(true);
                    await postgresService.pullAndSyncAllData(true);
                    setTimeout(() => setIsManualSyncing(false), 600);
                  }}
                  disabled={isManualSyncing || syncState.isSyncing}
                  className="p-1 text-emerald-300 hover:text-white hover:bg-emerald-800 rounded transition-all"
                  title={`Live Sync Active. Last synced: ${syncState.lastSyncTime || 'Just now'}. Click to sync now.`}
                  aria-label="Synchronize Realtime Database"
                >
                  <RefreshCw
                    size={13}
                    className={isManualSyncing || syncState.isSyncing ? 'animate-spin text-emerald-200' : ''}
                  />
                </button>
              )}
            </div>

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
          className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-50 border-r-2 border-slate-300 flex flex-col transition-transform duration-200 ease-in-out shadow-sm ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-3.5 bg-white border-b-2 border-slate-200 flex items-center justify-between shadow-2xs">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Navigation Menu</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 font-mono font-bold border border-emerald-300">
                v2.6 Enterprise
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                title="Close Navigation Menu"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
            {/* Dashboard */}
            <NavLink
              to="/"
              id="nav-link-dashboard"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'text-slate-900 hover:bg-emerald-50 hover:text-emerald-950'
                }`
              }
            >
              <LayoutDashboard size={18} className="shrink-0" />
              <span>Dashboard Overview</span>
            </NavLink>

            {/* Inspections Header */}
            <div>
              <button
                id="toggle-inspection-forms-menu"
                onClick={() => setFormsSubmenuOpen(!formsSubmenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-slate-900 font-bold text-[13px] rounded-lg hover:bg-emerald-50 hover:text-emerald-950 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ClipboardList size={18} className="text-emerald-800 shrink-0" />
                  <span>SQC Inspection (1–36)</span>
                </div>
                {formsSubmenuOpen ? <ChevronDown size={16} className="text-slate-700" /> : <ChevronRight size={16} className="text-slate-700" />}
              </button>

              {formsSubmenuOpen && (
                <div className="mt-1 pl-2 pr-1 space-y-1 bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
                  <NavLink
                    to="/inspections"
                    id="nav-link-all-inspections"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                        isActive ? 'text-emerald-950 bg-emerald-100 border border-emerald-300' : 'text-slate-800 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Layers size={15} className="text-emerald-800" />
                    <span>All Inspection Records</span>
                  </NavLink>

                  <NavLink
                    to="/new-inspection"
                    id="nav-link-create-inspection"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                        isActive ? 'text-emerald-950 bg-emerald-100 border border-emerald-300' : 'text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100'
                      }`
                    }
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
                    <span>+ New Inspection Entry</span>
                  </NavLink>

                  <div className="pt-2.5 pb-1 text-[11px] font-black text-slate-800 uppercase tracking-wider px-2">
                    Department Form Lists
                  </div>

                  {formGroups.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-0.5 pt-1">
                      <div className="text-[11px] font-black text-slate-900 px-2 pt-1 uppercase tracking-tight">
                        {group.title}
                      </div>
                      {group.forms.map(fCode => {
                        const meta = FORM_REGISTRY[fCode];
                        if (!meta) return null;
                        const isMatch = location.search.includes(fCode);
                        return (
                          <NavLink
                            key={fCode}
                            to={`/new-inspection?form=${fCode}`}
                            id={`nav-form-${fCode.toLowerCase()}`}
                            onClick={() => setSidebarOpen(false)}
                            className={
                              `flex items-center px-2 py-1.5 rounded text-xs font-semibold truncate transition-colors ${
                                isMatch
                                  ? 'bg-emerald-800 text-white font-bold'
                                  : 'text-slate-800 hover:bg-emerald-50 hover:text-emerald-950'
                              }`
                            }
                            title={`${meta.code}: ${meta.title}`}
                          >
                            <span className={`font-mono mr-1.5 font-bold px-1 py-0.5 rounded text-[10px] shrink-0 border ${
                              isMatch ? 'bg-white text-emerald-950 border-white' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}>
                              {meta.code.replace('FORM-', 'F')}
                            </span>
                            <span className="truncate">{meta.title.split('–')[1]?.trim() || meta.title}</span>
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
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'text-slate-900 hover:bg-emerald-50 hover:text-emerald-950'
                }`
              }
            >
              <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
              <span>Approvals Workflow</span>
            </NavLink>

            {/* Reports */}
            <NavLink
              to="/reports"
              id="nav-link-reports"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'text-slate-900 hover:bg-emerald-50 hover:text-emerald-950'
                }`
              }
            >
              <FileBarChart size={18} className="text-emerald-700 shrink-0" />
              <span>Reports & Analytics</span>
            </NavLink>

            {/* Masters */}
            <div>
              <button
                id="toggle-masters-menu"
                onClick={() => setMastersSubmenuOpen(!mastersSubmenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-slate-900 font-bold text-[13px] rounded-lg hover:bg-emerald-50 hover:text-emerald-950 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Database size={18} className="text-emerald-800 shrink-0" />
                  <span>Master Data</span>
                </div>
                {mastersSubmenuOpen ? <ChevronDown size={16} className="text-slate-700" /> : <ChevronRight size={16} className="text-slate-700" />}
              </button>

              {mastersSubmenuOpen && (
                <div className="mt-1 pl-2 pr-1 space-y-1 bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs text-xs font-bold">
                  <NavLink to="/masters/departments" id="nav-master-dept" className="block px-2.5 py-1.5 text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 rounded">Departments & HODs</NavLink>
                  <NavLink to="/masters/sections" id="nav-master-sec" className="block px-2.5 py-1.5 text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 rounded">Sections & Stages</NavLink>
                  <NavLink to="/masters/machines" id="nav-master-mach" className="block px-2.5 py-1.5 text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 rounded">Machines & Speeds</NavLink>
                  <NavLink to="/masters/looms" id="nav-master-loom" className="block px-2.5 py-1.5 text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 rounded">Looms Master</NavLink>
                  <NavLink to="/masters/qualities" id="nav-master-qual" className="block px-2.5 py-1.5 text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 rounded">Qualities & Counts</NavLink>
                  <NavLink to="/masters/specs" id="nav-master-spec" className="block px-2.5 py-1.5 text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 rounded">Product & Bag Specs</NavLink>
                  <NavLink to="/masters/standards" id="nav-master-std" className="block px-2.5 py-1.5 text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 rounded">Standards & Tolerances</NavLink>
                </div>
              )}
            </div>

            {/* System Administration */}
            <div className="pt-3 border-t-2 border-slate-200 mt-2">
              <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider px-3 py-1 bg-slate-200/90 rounded-md border border-slate-300 mb-1.5">
                Administration
              </div>
              <NavLink
                to="/admin/users"
                id="nav-link-users"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                    isActive
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'text-slate-900 hover:bg-emerald-50 hover:text-emerald-950'
                  }`
                }
              >
                <User size={17} className="shrink-0" />
                <span>Users & Roles (RBAC)</span>
              </NavLink>
              <NavLink
                to="/admin/audit-logs"
                id="nav-link-audit-logs"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                    isActive
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'text-slate-900 hover:bg-emerald-50 hover:text-emerald-950'
                  }`
                }
              >
                <History size={17} className="shrink-0" />
                <span>Audit Trail</span>
              </NavLink>
              <NavLink
                to="/admin/settings"
                id="nav-link-settings"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                    isActive
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'text-slate-900 hover:bg-emerald-50 hover:text-emerald-950'
                  }`
                }
              >
                <Settings size={17} className="shrink-0" />
                <span>System Settings</span>
              </NavLink>

              {/* PostgreSQL Sync Hub */}
              <button
                id="sidebar-pg-hub-btn"
                onClick={() => {
                  setPgModalOpen(true);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] text-slate-900 hover:bg-emerald-50 hover:text-emerald-950 transition-colors text-left"
              >
                <Database size={17} className="text-emerald-800 shrink-0" />
                <span>PostgreSQL DB Hub</span>
                <span
                  className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    pgStatus?.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {pgStatus?.isConnected ? 'Connected' : 'Offline'}
                </span>
              </button>
            </div>
          </div>

          {/* User Profile Footer */}
          <div className="p-3.5 bg-white border-t-2 border-slate-300 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-800 text-white font-black flex items-center justify-center text-sm shadow-xs border border-emerald-600">
                {currentUser.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-950 truncate">{currentUser.displayName}</p>
                <p className="text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block truncate mt-0.5">
                  {currentUser.role}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Backdrop Overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xs z-20 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Main Content Viewport */}
        <main id="app-main-content" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50/80">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* PostgreSQL Bridge & Synchronization Modal */}
      <PostgresSyncModal isOpen={pgModalOpen} onClose={() => setPgModalOpen(false)} />
    </div>
  );
};
