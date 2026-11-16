import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  FileBarChart,
  Database,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  User,
  LogOut,
  Layers,
  History,
  Wrench,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    isAdmin,
    logout,
    canAccessModule,
    canAccessForm,
    maintenanceStatus,
    toggleMaintenanceMode,
  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [disablingMaintenance, setDisablingMaintenance] = useState(false);
  const [formsSubmenuOpen, setFormsSubmenuOpen] = useState(true);
  const [mastersSubmenuOpen, setMastersSubmenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const notifications = dataService.getNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !canAccessModule('INSPECTIONS')) return;
    navigate(`/inspections?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formGroups = [
    { title: 'Raw Fiber & Spreader', forms: ['FORM-01', 'FORM-02', 'FORM-03', 'FORM-04', 'FORM-05'] },
    { title: 'Carding & Drawing', forms: ['FORM-06', 'FORM-07', 'FORM-08', 'FORM-09', 'FORM-37'] },
    { title: 'Spinning & Winding', forms: ['FORM-10', 'FORM-11', 'FORM-12'] },
    { title: 'Beaming & Weaving', forms: ['FORM-13', 'FORM-14', 'FORM-15', 'FORM-16'] },
    { title: 'Finishing & Cutting', forms: ['FORM-17', 'FORM-18', 'FORM-19', 'FORM-20', 'FORM-21'] },
    { title: 'Godown & Sacksewing', forms: ['FORM-22', 'FORM-23', 'FORM-24'] },
    { title: 'Press & Broad Loom', forms: ['FORM-25', 'FORM-26', 'FORM-27', 'FORM-28'] },
    { title: 'Central Laboratory', forms: ['FORM-29', 'FORM-30', 'FORM-31', 'FORM-32', 'FORM-33', 'FORM-34'] },
    { title: 'Engineering & Study', forms: ['FORM-35', 'FORM-36'] },
  ];

  // Filter form groups so each user only sees forms they are permitted to access
  const visibleFormGroups = formGroups
    .map(group => ({
      ...group,
      forms: group.forms.filter(fCode => canAccessForm(fCode)),
    }))
    .filter(group => group.forms.length > 0);

  const showDashboard = canAccessModule('DASHBOARD');
  const showInspections = canAccessModule('INSPECTIONS');
  const showApprovals = canAccessModule('APPROVALS');
  const showReports = canAccessModule('REPORTS');
  const showMasters = canAccessModule('MASTERS');

  return (
    <div className="min-h-screen bg-[#FCF8EE] flex flex-col font-sans text-[#2B1114]">
      {/* Top Header */}
      <header
        id="main-topbar"
        className="bg-gradient-to-r from-[#63050B] via-[#8B0A12] to-[#75070E] text-[#FFFDF8] sticky top-0 z-40 shadow-sm border-b-2 border-[#D4AF37]"
      >
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-[#D4AF37]/20 text-[#FFFDF8] transition-colors flex items-center gap-1.5 border border-[#D4AF37]/45 bg-[#4E0308]/40 cursor-pointer whitespace-nowrap shrink-0"
              aria-label="Toggle Sidebar"
              title="Toggle Menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              <span className="text-xs font-bold hidden sm:inline">Menu</span>
            </button>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#4E0308] flex items-center justify-center font-black text-[#D4AF37] text-xs shadow-inner border border-[#D4AF37]">
                SQC
              </div>
              <div className="leading-tight">
                <h1 className="text-sm font-black tracking-tight text-[#FFFDF8] whitespace-nowrap">
                  SQC Quality Portal
                </h1>
                <p className="text-[10px] text-[#FCF8EE]/80 font-medium whitespace-nowrap">
                  Statistical Quality Control
                </p>
              </div>
            </div>
          </div>

          {/* Quick Search (Only shown when INSPECTIONS module is permitted) */}
          {showInspections ? (
            <div className="hidden md:flex items-center max-w-md w-full mx-4">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <input
                  id="header-global-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search inspections, lot #, machine, quality, form code..."
                  className="w-full bg-[#4E0308]/45 text-[#FFFDF8] placeholder-[#FCF8EE]/70 text-xs rounded-lg pl-9 pr-4 py-1.5 border border-[#E4D0A3]/40 focus:outline-none"
                />
                <Search className="absolute left-2.5 top-2 text-[#E4D0A3]" size={14} />
              </form>
            </div>
          ) : (
            <div className="hidden md:block flex-1" />
          )}

          {/* User Account & Actions Menu */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                id="notifications-bell-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-1.5 rounded-lg hover:bg-[#D4AF37]/20 text-[#FFFDF8] relative transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#D4AF37] text-[#2B1114] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#FFFDF8] rounded-xl shadow-xl border border-[#DFC378] p-3 z-50 text-[#2B1114] space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EFE2C2]">
                    <span className="font-bold text-xs text-[#5C080E]">Notifications</span>
                    <button
                      onClick={() => dataService.markNotificationsAsRead()}
                      className="text-[10px] text-[#8B0A12] hover:underline font-semibold cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
                    {notifications.length === 0 ? (
                      <p className="text-[#6E524B] text-center py-4 text-xs">No notifications</p>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div key={n.id} className="p-2 rounded bg-[#FCF8EE] border border-[#E4D0A3]">
                          <p className="font-semibold text-[#2B1114] text-[11px]">{n.title}</p>
                          <p className="text-[#6E524B] text-[10px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Link & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#D4AF37]/35">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="hidden sm:flex flex-col text-right hover:opacity-85 transition-opacity cursor-pointer"
                title="Open My Profile & Password"
              >
                <span className="text-xs font-bold text-[#FFFDF8] truncate max-w-[140px]">
                  {currentUser.displayName}
                </span>
                <span className="text-[10px] text-[#E9C96B] font-medium">
                  {currentUser.role}
                </span>
              </button>

              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-lg bg-[#4E0308]/50 hover:bg-[#D4AF37]/25 text-[#FFFDF8] text-xs font-bold inline-flex items-center gap-1.5 transition-colors border border-[#D4AF37]/45 cursor-pointer whitespace-nowrap shrink-0"
                title="Sign out of SQC"
              >
                <LogOut size={14} />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Active Maintenance Mode Alert Bar */}
      {isAdmin && maintenanceStatus.enabled && (
        <div
          id="admin-maintenance-banner"
          className="bg-[#FDF5DC] text-[#2B1114] px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs border-b border-[#DFC378]"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Wrench size={15} className="shrink-0 text-[#9B6E14]" />
            <span>
              <strong className="text-[#8B0A12]">MAINTENANCE MODE ACTIVE:</strong> All non-admin users are automatically logged out and locked out (&quot;{maintenanceStatus.message}&quot;).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disablingMaintenance}
              onClick={async () => {
                setDisablingMaintenance(true);
                try {
                  await toggleMaintenanceMode(false, maintenanceStatus.message);
                } finally {
                  setDisablingMaintenance(false);
                }
              }}
              className="px-3 py-1 rounded-md bg-[#8B0A12] text-[#FFFDF8] hover:bg-[#68050B] font-bold text-[11px] shadow-2xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {disablingMaintenance ? 'Restoring...' : 'Turn Off Maintenance Mode'}
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left-Hand Sidebar Navigation */}
        <aside
          id="main-sidebar"
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-[#FFFBF1] border-r border-[#E4D0A3] flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-3.5 bg-[#FBF4E1] border-b border-[#E4D0A3] flex items-center justify-between">
            <span className="text-xs font-black text-[#5C080E] uppercase tracking-wider">
              SQC Navigation
            </span>
            <span className="text-[11px] font-mono font-bold text-[#9B6E14]">
              {isAdmin ? 'Admin Access' : 'Scoped Access'}
            </span>
          </div>

          {/* Navigation Links Scroll Container */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {/* Dashboard */}
            {showDashboard && (
              <NavLink
                to="/"
                id="nav-link-dashboard"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] shadow-sm border border-[#D4AF37]/60'
                      : 'text-[#5C080E] hover:bg-[#FBF4E1] hover:text-[#8B0A12]'
                  }`
                }
              >
                <LayoutDashboard size={18} className="shrink-0" />
                <span>Floor Dashboard</span>
              </NavLink>
            )}

            {/* Inspections Master Container */}
            {showInspections && (
              <div className="space-y-1 pt-1">
                <button
                  id="toggle-inspection-forms-menu"
                  onClick={() => setFormsSubmenuOpen(!formsSubmenuOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[#5C080E] font-bold text-[13px] rounded-lg hover:bg-[#FBF4E1] hover:text-[#8B0A12] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList size={18} className="shrink-0" />
                    <span>
                      Quality Forms ({visibleFormGroups.reduce((acc, g) => acc + g.forms.length, 0)})
                    </span>
                  </div>
                  {formsSubmenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {formsSubmenuOpen && (
                  <div className="pl-2 pr-1 space-y-2 bg-[#FCF8EE] rounded-lg p-2 border border-[#E4D0A3] text-xs">
                    <NavLink
                      to="/inspections"
                      id="nav-link-all-inspections"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-2.5 py-1.5 rounded-md font-bold transition-colors whitespace-nowrap ${
                          isActive
                            ? 'text-[#FFFDF8] bg-[#8B0A12] border border-[#D4AF37]'
                            : 'text-[#5C080E] hover:bg-[#FBF4E1]'
                        }`
                      }
                    >
                      <Layers size={14} className="text-[#C9962B] shrink-0" />
                      <span>All Inspection Records</span>
                    </NavLink>

                    <div className="pt-2 pb-1 text-[11px] font-black text-[#6E524B] uppercase tracking-wider px-2">
                      Permitted Forms
                    </div>

                    {visibleFormGroups.length === 0 ? (
                      <div className="p-3 text-center text-xs text-[#6E524B]">
                        No individual forms assigned to your account. Contact SQC Administrator.
                      </div>
                    ) : (
                      visibleFormGroups.map((group, gIdx) => (
                        <div key={gIdx} className="space-y-0.5 pt-1">
                          <div className="text-[11px] font-black text-[#5C080E] px-2 pt-1 uppercase tracking-tight">
                            {group.title}
                          </div>

                          {group.forms.map(fCode => {
                            const meta = FORM_REGISTRY[fCode];
                            if (!meta) return null;

                            const isMatch = new URLSearchParams(location.search).get('form') === fCode;

                            return (
                              <NavLink
                                key={fCode}
                                to={`/new-inspection?form=${fCode}`}
                                id={`nav-form-${fCode.toLowerCase()}`}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center px-2 py-1.5 rounded-md text-xs font-semibold truncate transition-all duration-150 border ${
                                  isMatch
                                    ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] font-bold border-[#D4AF37] shadow-sm'
                                    : 'bg-transparent text-[#2B1114] border-transparent hover:bg-[#FBF4E1] hover:text-[#8B0A12] hover:border-[#E4D0A3]'
                                }`}
                                title={`${meta.code}: ${meta.title}`}
                              >
                                <span
                                  className={`inline-flex items-center justify-center font-mono font-black min-w-[42px] h-[22px] mr-2 px-1.5 rounded text-[10px] leading-none shrink-0 border tabular-nums ${
                                    isMatch
                                      ? 'bg-[#4E0308] text-[#E9C96B] border-[#D4AF37]'
                                      : 'bg-[#8B0A12] text-[#FFFDF8] border-[#68050B]'
                                  }`}
                                >
                                  {meta.code.replace('FORM-', 'F')}
                                </span>
                                <span className="truncate">
                                  {meta.title.split('–')[1]?.trim() || meta.title}
                                </span>
                              </NavLink>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Approvals */}
            {showApprovals && (
              <NavLink
                to="/approvals"
                id="nav-link-approvals"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] shadow-sm border border-[#D4AF37]/60'
                      : 'text-[#5C080E] hover:bg-[#FBF4E1] hover:text-[#8B0A12]'
                  }`
                }
              >
                <CheckCircle2 size={18} className="shrink-0" />
                <span>Approvals Workflow</span>
              </NavLink>
            )}

            {/* Reports */}
            {showReports && (
              <NavLink
                to="/reports"
                id="nav-link-reports"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] shadow-sm border border-[#D4AF37]/60'
                      : 'text-[#5C080E] hover:bg-[#FBF4E1] hover:text-[#8B0A12]'
                  }`
                }
              >
                <FileBarChart size={18} className="shrink-0" />
                <span>Reports &amp; Analytics</span>
              </NavLink>
            )}

            {/* Master Data (Visible only if MASTERS module granted or Admin) */}
            {showMasters && (
              <div>
                <button
                  id="toggle-masters-menu"
                  onClick={() => setMastersSubmenuOpen(!mastersSubmenuOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[#5C080E] font-bold text-[13px] rounded-lg hover:bg-[#FBF4E1] hover:text-[#8B0A12] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <div className="flex items-center gap-3">
                    <Database size={18} className="shrink-0" />
                    <span>Master Data</span>
                  </div>
                  {mastersSubmenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {mastersSubmenuOpen && (
                  <div className="mt-1 pl-2 pr-1 space-y-1 bg-[#FFFDF8] rounded-lg p-2.5 border border-[#E4D0A3] text-xs font-bold">
                    <NavLink
                      to="/masters/departments"
                      id="nav-master-dept"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-2.5 py-1.5 text-[#5C080E] hover:text-[#8B0A12] hover:bg-[#FBF4E1] rounded"
                    >
                      Departments &amp; HODs
                    </NavLink>
                    <NavLink
                      to="/masters/sections"
                      id="nav-master-sec"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-2.5 py-1.5 text-[#5C080E] hover:text-[#8B0A12] hover:bg-[#FBF4E1] rounded"
                    >
                      Sections &amp; Stages
                    </NavLink>
                    <NavLink
                      to="/masters/machines"
                      id="nav-master-mach"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-2.5 py-1.5 text-[#5C080E] hover:text-[#8B0A12] hover:bg-[#FBF4E1] rounded"
                    >
                      Machines &amp; Speeds
                    </NavLink>
                    <NavLink
                      to="/masters/looms"
                      id="nav-master-loom"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-2.5 py-1.5 text-[#5C080E] hover:text-[#8B0A12] hover:bg-[#FBF4E1] rounded"
                    >
                      Looms Master
                    </NavLink>
                    <NavLink
                      to="/masters/qualities"
                      id="nav-master-qual"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-2.5 py-1.5 text-[#5C080E] hover:text-[#8B0A12] hover:bg-[#FBF4E1] rounded"
                    >
                      Qualities &amp; Counts
                    </NavLink>
                    <NavLink
                      to="/masters/specs"
                      id="nav-master-spec"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-2.5 py-1.5 text-[#5C080E] hover:text-[#8B0A12] hover:bg-[#FBF4E1] rounded"
                    >
                      Product &amp; Bag Specs
                    </NavLink>
                    <NavLink
                      to="/masters/standards"
                      id="nav-master-std"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-2.5 py-1.5 text-[#5C080E] hover:text-[#8B0A12] hover:bg-[#FBF4E1] rounded"
                    >
                      Standards &amp; Tolerances
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {/* Self-Service Profile & Password */}
            <NavLink
              to="/profile"
              id="nav-link-profile"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] shadow-sm border border-[#D4AF37]/60'
                    : 'text-[#5C080E] hover:bg-[#FBF4E1] hover:text-[#8B0A12]'
                }`
              }
            >
              <KeyRound size={17} className="shrink-0" />
              <span>My Profile &amp; Password</span>
            </NavLink>

            {!showDashboard && !showInspections && !showApprovals && !showReports && !showMasters && !isAdmin && (
              <div className="p-3 rounded-lg bg-[#FDF5DC] border border-[#DFC378] text-[11px] text-[#7A560B] leading-relaxed">
                No modules are currently assigned to your account. Contact an SQC Administrator to request access.
              </div>
            )}

            {/* System Administration (Strictly Admin Only) */}
            {isAdmin && (
              <div className="pt-3 border-t border-[#E4D0A3] mt-2">
                <div className="text-[11px] font-black text-[#7A560B] uppercase tracking-wider px-3 py-1 bg-[#FDF5DC] rounded-md border border-[#DFC378] mb-1.5">
                  Administration
                </div>
                <NavLink
                  to="/admin/users"
                  id="nav-link-users"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] shadow-sm border border-[#D4AF37]/60'
                        : 'text-[#5C080E] hover:bg-[#FBF4E1] hover:text-[#8B0A12]'
                    }`
                  }
                >
                  <User size={17} className="shrink-0" />
                  <span>Users &amp; Form Permissions</span>
                </NavLink>
                <NavLink
                  to="/admin/audit-logs"
                  id="nav-link-audit-logs"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] shadow-sm border border-[#D4AF37]/60'
                        : 'text-[#5C080E] hover:bg-[#FBF4E1] hover:text-[#8B0A12]'
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
                    `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-r from-[#8B0A12] to-[#68050B] text-[#FFFDF8] shadow-sm border border-[#D4AF37]/60'
                        : 'text-[#5C080E] hover:bg-[#FBF4E1] hover:text-[#8B0A12]'
                    }`
                  }
                >
                  <Settings size={17} className="shrink-0" />
                  <span>System Settings</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* User Profile Footer */}
          <div className="p-3.5 bg-[#FBF4E1] border-t border-[#E4D0A3]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  navigate('/profile');
                }}
                className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 cursor-pointer"
                title="Open My Profile & Password"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B0A12] to-[#68050B] text-[#FFFDF8] border border-[#D4AF37] font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {currentUser.displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#2B1114] truncate">
                    {currentUser.displayName}
                  </p>
                  <p className="text-[10px] font-semibold text-[#6E524B] truncate">
                    {currentUser.role}
                  </p>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[#6E524B] hover:text-[#8B0A12] hover:bg-[#FDF5DC] transition-colors shrink-0 cursor-pointer"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-[#2B1114]/55 backdrop-blur-2xs z-20 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Main Content Viewport */}
        <main id="app-main-content" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#FCF8EE]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
