import React, { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
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
  Shield,
  KeyRound,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    currentUser,
    allUsers,
    switchUser,
    logout,
    canAccessForm,
    isRole,
    hasPermission,
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

    if (!searchQuery.trim()) return;

    navigate(`/inspections?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formGroups = [
    {
      title: 'Raw Fiber & Spreader',
      forms: ['FORM-01', 'FORM-02', 'FORM-03', 'FORM-04', 'FORM-05','FORM-38'],
    },
    {
      title: 'Carding & Drawing',
      forms: ['FORM-06', 'FORM-07', 'FORM-08', 'FORM-09', 'FORM-37'],
    },
    {
      title: 'Spinning & Winding',
      forms: ['FORM-10', 'FORM-11', 'FORM-12'],
    },
    {
      title: 'Beaming & Weaving',
      forms: ['FORM-13', 'FORM-14', 'FORM-15', 'FORM-16'],
    },
    {
      title: 'Finishing & Cutting',
      forms: ['FORM-17', 'FORM-18', 'FORM-19', 'FORM-20', 'FORM-21'],
    },
    {
      title: 'Godown & Sacksewing',
      forms: ['FORM-22', 'FORM-23', 'FORM-24'],
    },
    {
      title: 'Press & Broad Loom',
      forms: ['FORM-25', 'FORM-26', 'FORM-27', 'FORM-28'],
    },
    {
      title: 'Central Laboratory',
      forms: [
        'FORM-29',
        'FORM-30',
        'FORM-31',
        'FORM-32',
        'FORM-33',
        'FORM-34',
      ],
    },
    {
      title: 'Engineering & Study',
      forms: ['FORM-35', 'FORM-36'],
    },
  ];

  // Filter form groups so each user only sees forms they are permitted to access
  const visibleFormGroups = formGroups
    .map(group => ({
      ...group,
      forms: group.forms.filter(fCode => canAccessForm(fCode)),
    }))
    .filter(group => group.forms.length > 0);

  const roleStr = currentUser?.role as string;

  const isAdmin =
    roleStr === 'Super Admin' ||
    roleStr === 'SuperAdmin' ||
    roleStr === 'Admin';

  return (
    <div className="h-dvh w-full overflow-hidden bg-[#FFF8F6] flex flex-col font-sans text-[#393334]">
      {/* Top Header */}
      <header
        id="main-topbar"
        className="shrink-0 bg-[#EA5551] text-[#FFFFFF] z-40 shadow-sm border-b-2 border-[#FFE0DA]"
      >
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-[#D46764] text-[#FFFFFF] transition-colors flex items-center gap-1.5 border border-[#FFE0DA]/40 bg-white/10 cursor-pointer"
              aria-label="Toggle Sidebar"
              title="Toggle Menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              <span className="text-xs font-bold hidden sm:inline">Menu</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="hidden md:flex items-center max-w-md w-full mx-6">
            {/* <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                id="header-global-search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search inspections, lot #, machine, quality, form code..."
                className="w-full bg-white/20 text-white placeholder-white/80 text-xs rounded-lg pl-9 pr-4 py-1.5 border border-white/30 focus:outline-none focus:ring-1 focus:ring-white"
              />
              <Search className="absolute left-2.5 top-2 text-white/80" size={14} />
            </form> */}
          </div>

          {/* User Account & Actions Menu */}
          <div className="flex items-center gap-3">
            {/* Admin Persona Quick Switcher (Available to Admins for Floor Verification) */}
            {/* {isAdmin && (
              <div className="hidden lg:flex items-center bg-[#500D28]/90 rounded-lg p-1 border border-[#9D174D]/70 shadow-2xs">
                <span className="text-[10px] text-[#F9C5D8] uppercase px-1.5 font-bold">
                  Active User:
                </span>
                <select
                  id="active-role-switcher"
                  value={currentUser.id}
                  onChange={e => switchUser(e.target.value)}
                  aria-label="Switch User Persona / Role"
                  className="bg-[#831843] text-white text-xs rounded px-2 py-0.5 border border-[#BE185D] focus:outline-none cursor-pointer font-semibold"
                >
                  {allUsers.map(u => {
                    const isOptionAdmin =
                      u.role === 'Super Admin' ||
                      u.role === 'SuperAdmin' ||
                      u.role === 'Admin';

                    const disabledOption =
                      maintenanceStatus.enabled && !isOptionAdmin;

                    return (
                      <option
                        key={u.id}
                        value={u.id}
                        disabled={disabledOption}
                        className="bg-[#500D28] text-white"
                      >
                        {u.displayName} [{u.role}]
                        {disabledOption ? ' (Locked)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )} */}

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="notifications-bell-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-1.5 rounded-lg hover:bg-[#D46764] text-[#FFFFFF] relative transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={17} />

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#FFFFFF] text-[#EA5551] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#FFFFFF] rounded-xl shadow-xl border border-[#F5D0CB] p-3 z-50 text-[#393334] space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#FDE8E4]">
                    <span className="font-bold text-xs text-[#393334]">
                      Notifications
                    </span>

                    <button
                      onClick={() => dataService.markNotificationsAsRead()}
                      className="text-[10px] text-[#EA5551] hover:underline font-semibold cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
                    {notifications.length === 0 ? (
                      <p className="text-[#806B68] text-center py-4 text-xs">
                        No notifications
                      </p>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div
                          key={n.id}
                          className="p-2 rounded bg-[#FFF1EE] border border-[#FDE8E4]"
                        >
                          <p className="font-semibold text-[#393334] text-[11px]">
                            {n.title}
                          </p>

                          <p className="text-[#806B68] text-[10px]">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#FFE0DA]/35">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-[#FFFFFF] truncate max-w-[130px]">
                  {currentUser.displayName}
                </span>

                <span className="text-[10px] text-[#FFFFFF] font-medium">
                  {currentUser.role}
                </span>
              </div>

              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-[#D46764] text-[#FFFFFF] text-xs font-bold inline-flex items-center gap-1.5 transition-colors border border-[#FFE0DA]/35 cursor-pointer"
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
          className="bg-amber-600 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm border-b border-amber-700"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Wrench size={15} className="shrink-0" />

            <span>
              <strong>MAINTENANCE MODE ACTIVE:</strong> All non-admin users are
              automatically logged out and locked out (&quot;
              {maintenanceStatus.message}&quot;).
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disablingMaintenance}
              onClick={async () => {
                setDisablingMaintenance(true);

                try {
                  await toggleMaintenanceMode(
                    false,
                    maintenanceStatus.message,
                  );
                } finally {
                  setDisablingMaintenance(false);
                }
              }}
              className="px-3 py-1 rounded-md bg-white text-amber-900 hover:bg-amber-50 font-bold text-[11px] shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {disablingMaintenance
                ? 'Restoring...'
                : 'Turn Off Maintenance Mode'}
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        {/* Left-Hand Sidebar Navigation */}
        <aside
          id="main-sidebar"
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-[#FFF8F6] border-r border-[#F5D0CB] flex flex-col min-h-0 overflow-hidden transition-transform duration-200 ease-in-out lg:static lg:h-full lg:shrink-0 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Navigation Links - Independent Scroll */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-1.5 overscroll-contain"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* Dashboard */}
            <NavLink
              to="/"
              end
              id="nav-link-dashboard"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#B93E3A] text-[#FFFFFF] shadow-sm'
                    : 'text-[#393334] hover:bg-[#FFFFFF] hover:text-[#EA5551]'
                }`
              }
            >
              <LayoutDashboard size={18} className="shrink-0" />
              <span>Floor Dashboard</span>
            </NavLink>

            {/* Inspections Master Container */}
            <div className="space-y-1 pt-1">
              <button
                id="toggle-inspection-forms-menu"
                onClick={() => setFormsSubmenuOpen(!formsSubmenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[#393334] font-bold text-[13px] rounded-lg hover:bg-[#FFFFFF] hover:text-[#EA5551] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ClipboardList size={18} className="shrink-0" />

                  <span>
                    Quality Forms (
                    {visibleFormGroups.reduce(
                      (acc, g) => acc + g.forms.length,
                      0,
                    )}
                    )
                  </span>
                </div>

                {formsSubmenuOpen ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>

              {formsSubmenuOpen && (
                <div className="pl-2 pr-1 space-y-2 bg-[#FFFFFF] rounded-lg p-2 border border-[#F5D0CB] text-xs">
                  <NavLink
                    to="/inspections"
                    id="nav-link-all-inspections"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-1.5 rounded-md font-bold transition-all border shadow-2xs ${
                        isActive
                          ? 'text-[#FFFFFF] bg-[#B93E3A] border-[#A0322E] shadow-sm'
                          : 'bg-[#FFFFFF] text-[#EA5551] border-[#F5D0CB] hover:bg-[#EA5551] hover:text-[#FFFFFF] hover:border-[#EA5551]'
                      }`
                    }
                  >
                    <Layers size={14} className="shrink-0" />
                    <span>All Inspection Records</span>
                  </NavLink>

                  {visibleFormGroups.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[#806B68]">
                      No individual forms assigned to your role. Contact SQC
                      Administrator.
                    </div>
                  ) : (
                    visibleFormGroups.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-0.5 pt-1">
                        <div className="text-[11px] font-black text-[#EA5551] px-2 pt-1 uppercase tracking-tight">
                          {group.title}
                        </div>

                        {group.forms.map(fCode => {
                          const meta = FORM_REGISTRY[fCode];

                          if (!meta) return null;

                          const isMatch =
                            new URLSearchParams(location.search).get('form') ===
                            fCode;

                          return (
                            <Link
                              key={fCode}
                              to={`/new-inspection?form=${fCode}`}
                              id={`nav-form-${fCode.toLowerCase()}`}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center px-2 py-1.5 rounded-md text-xs font-semibold truncate transition-all duration-200 border ${
                                isMatch
                                  ? 'bg-[#B93E3A] text-[#FFFFFF] font-bold border-[#A0322E] shadow-sm'
                                  : 'bg-[#FFFFFF] text-[#EA5551] border-[#F5D0CB] hover:bg-[#EA5551] hover:text-[#FFFFFF] hover:border-[#EA5551]'
                              }`}
                              title={`${meta.code}: ${meta.title}`}
                            >
                              <span
                                className={`inline-flex items-center justify-center font-mono font-black min-w-[42px] h-[22px] mr-2 px-1.5 rounded text-[10px] leading-none shrink-0 border ${
                                  isMatch
                                    ? 'bg-[#EA5551] text-[#FFFFFF] border-[#EA5551]'
                                    : 'bg-[#FFFFFF] text-[#EA5551] border-[#F5D0CB]'
                                }`}
                              >
                                {meta.code.replace('FORM-', 'F')}
                              </span>

                              <span className="whitespace-normal break-words leading-4 min-w-0 flex-1">
                                {meta.title.split('–')[1]?.trim() ||
                                  meta.title}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    ))
                  )}
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
                    ? 'bg-[#B93E3A] text-[#FFFFFF] shadow-sm'
                    : 'text-[#393334] hover:bg-[#FFFFFF] hover:text-[#EA5551]'
                }`
              }
            >
              <CheckCircle2 size={18} className="shrink-0" />
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
                    ? 'bg-[#B93E3A] text-[#FFFFFF] shadow-sm'
                    : 'text-[#393334] hover:bg-[#FFFFFF] hover:text-[#EA5551]'
                }`
              }
            >
              <FileBarChart size={18} className="shrink-0" />
              <span>Reports & Analytics</span>
            </NavLink>

            {/* Masters (Visible to Admins / HODs) */}
            {hasPermission('MANAGE_MASTERS') && (
              <div>
                <button
                  id="toggle-masters-menu"
                  onClick={() => setMastersSubmenuOpen(!mastersSubmenuOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[#393334] font-bold text-[13px] rounded-lg hover:bg-[#FFFFFF] hover:text-[#EA5551] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Database size={18} className="shrink-0" />
                    <span>Master Data</span>
                  </div>

                  {mastersSubmenuOpen ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>

                {mastersSubmenuOpen && (
                  <div className="mt-1 pl-2 pr-1 space-y-1 bg-[#FFFFFF] rounded-lg p-2.5 border border-[#F5D0CB] text-xs font-bold">
                    <NavLink
                      to="/masters/departments"
                      id="nav-master-dept"
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded transition-colors ${
                          isActive
                            ? 'bg-[#B93E3A] text-white'
                            : 'text-[#393334] hover:text-[#EA5551] hover:bg-[#FFFFFF]'
                        }`
                      }
                    >
                      Departments & HODs
                    </NavLink>

                    <NavLink
                      to="/masters/sections"
                      id="nav-master-sec"
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded transition-colors ${
                          isActive
                            ? 'bg-[#B93E3A] text-white'
                            : 'text-[#393334] hover:text-[#EA5551] hover:bg-[#FFFFFF]'
                        }`
                      }
                    >
                      Sections & Stages
                    </NavLink>

                    <NavLink
                      to="/masters/machines"
                      id="nav-master-mach"
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded transition-colors ${
                          isActive
                            ? 'bg-[#B93E3A] text-white'
                            : 'text-[#393334] hover:text-[#EA5551] hover:bg-[#FFFFFF]'
                        }`
                      }
                    >
                      Machines & Speeds
                    </NavLink>

                    <NavLink
                      to="/masters/looms"
                      id="nav-master-loom"
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded transition-colors ${
                          isActive
                            ? 'bg-[#B93E3A] text-white'
                            : 'text-[#393334] hover:text-[#EA5551] hover:bg-[#FFFFFF]'
                        }`
                      }
                    >
                      Looms Master
                    </NavLink>

                    <NavLink
                      to="/masters/qualities"
                      id="nav-master-qual"
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded transition-colors ${
                          isActive
                            ? 'bg-[#B93E3A] text-white'
                            : 'text-[#393334] hover:text-[#EA5551] hover:bg-[#FFFFFF]'
                        }`
                      }
                    >
                      Qualities & Counts
                    </NavLink>

                    <NavLink
                      to="/masters/specs"
                      id="nav-master-spec"
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded transition-colors ${
                          isActive
                            ? 'bg-[#B93E3A] text-white'
                            : 'text-[#393334] hover:text-[#EA5551] hover:bg-[#FFFFFF]'
                        }`
                      }
                    >
                      Product & Bag Specs
                    </NavLink>

                    <NavLink
                      to="/masters/standards"
                      id="nav-master-std"
                      className={({ isActive }) =>
                        `block px-2.5 py-1.5 rounded transition-colors ${
                          isActive
                            ? 'bg-[#B93E3A] text-white'
                            : 'text-[#393334] hover:text-[#EA5551] hover:bg-[#FFFFFF]'
                        }`
                      }
                    >
                      Standards & Tolerances
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {/* System Administration (Admins Only) */}
            {isAdmin && (
              <div className="pt-3 border-t border-[#F5D0CB] mt-2">
                <div className="text-[11px] font-black text-[#EA5551] uppercase tracking-wider px-3 py-1 bg-[#FFFFFF] rounded-md border border-[#F5D0CB] mb-1.5">
                  Administration
                </div>

                <NavLink
                  to="/admin/users"
                  id="nav-link-users"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                      isActive
                        ? 'bg-[#B93E3A] text-[#FFFFFF] shadow-sm'
                        : 'text-[#393334] hover:bg-[#FFFFFF] hover:text-[#EA5551]'
                    }`
                  }
                >
                  <User size={17} className="shrink-0" />
                  <span>Users & Form Permissions</span>
                </NavLink>

                <NavLink
                  to="/admin/audit-logs"
                  id="nav-link-audit-logs"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                      isActive
                        ? 'bg-[#B93E3A] text-[#FFFFFF] shadow-sm'
                        : 'text-[#393334] hover:bg-[#FFFFFF] hover:text-[#EA5551]'
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
                        ? 'bg-[#B93E3A] text-[#FFFFFF] shadow-sm'
                        : 'text-[#393334] hover:bg-[#FFFFFF] hover:text-[#EA5551]'
                    }`
                  }
                >
                  <Settings size={17} className="shrink-0" />
                  <span>System Settings</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* User Profile Footer - Always Fixed at Bottom */}
          <div className="shrink-0 p-3.5 bg-[#FFFFFF] border-t border-[#F5D0CB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#EA5551] text-[#FFFFFF] border border-[#FFE0DA] font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {currentUser.displayName.charAt(0)}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#393334] truncate">
                    {currentUser.displayName}
                  </p>

                  <p className="text-[10px] font-semibold text-[#806B68] truncate">
                    {currentUser.role}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[#806B68] hover:text-[#EA5551] hover:bg-[#FFFFFF] transition-colors shrink-0 cursor-pointer"
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
            className="fixed inset-0 bg-[#393334]/50 backdrop-blur-2xs z-20 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Main Content - Independent Scroll */}
        <main
          id="app-main-content"
          className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 bg-[#FFF8F6]"
        >
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};