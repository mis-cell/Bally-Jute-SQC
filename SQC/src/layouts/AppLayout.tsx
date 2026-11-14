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
  Shield,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { FORM_REGISTRY } from '../constants/formsRegistry';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, allUsers, switchUser, logout, canAccessForm, isRole, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const roleStr = currentUser?.role as string;
  const isAdmin = roleStr === 'Super Admin' || roleStr === 'SuperAdmin' || roleStr === 'Admin';

  return (
    <div className="min-h-screen bg-[#FFF9F9] flex flex-col font-sans text-[#393334]">
      {/* Top Header */}
      <header id="main-topbar" className="bg-[#E87578] text-white sticky top-0 z-40 shadow-sm border-b border-[#F4C4C5]">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-[#D95F68] text-white transition-colors flex items-center gap-1.5 border border-white/30 bg-white/10"
              aria-label="Toggle Sidebar"
              title="Toggle Menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              <span className="text-xs font-bold hidden sm:inline">Menu</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#D95F68] flex items-center justify-center font-black text-white text-sm shadow-inner border border-white/50">
                SQC
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                  <span>SQC</span>
                </h1>
                <p className="text-[11px] text-white/90 font-medium">
                  SQC
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
                className="w-full bg-white/20 text-white placeholder-white/80 text-xs rounded-lg pl-9 pr-4 py-1.5 border border-white/30 focus:outline-none focus:ring-1 focus:ring-white"
              />
              <Search className="absolute left-2.5 top-2 text-white/80" size={14} />
            </form>
          </div>

          {/* User Account & Actions Menu */}
          <div className="flex items-center gap-3">
            {/* Admin Persona Quick Switcher (Available to Admins for Floor Verification) */}
            {isAdmin && (
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
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id} className="bg-[#500D28] text-white">
                      {u.displayName} [{u.role}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="notifications-bell-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-1.5 rounded-lg hover:bg-[#D95F68] text-white relative transition-colors"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-white text-[#D95F68] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#F4C4C5] p-3 z-50 text-slate-800 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F4C4C5]">
                    <span className="font-bold text-xs text-[#393334]">Notifications</span>
                    <button
                      onClick={() => dataService.markNotificationsAsRead()}
                      className="text-[10px] text-[#D95F68] hover:underline font-semibold"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
                    {notifications.length === 0 ? (
                      <p className="text-slate-400 text-center py-4 text-xs">No notifications</p>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div key={n.id} className="p-2 rounded bg-[#FFF9F9] border border-[#F4C4C5]/50">
                          <p className="font-semibold text-slate-800 text-[11px]">{n.title}</p>
                          <p className="text-slate-600 text-[10px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/30">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-white truncate max-w-[130px]">
                  {currentUser.displayName}
                </span>
                <span className="text-[10px] text-white/80 font-medium">
                  {currentUser.role}
                </span>
              </div>

              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-[#D95F68] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors border border-white/20 cursor-pointer"
                title="Sign out of SQC"
              >
                <LogOut size={14} />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left-Hand Sidebar Navigation */}
        <aside
          id="main-sidebar"
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-[#FFFAFA] border-r border-[#F4C4C5] flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-3.5 bg-white border-b border-[#F4C4C5] flex items-center justify-between">
            <span className="text-xs font-black text-[#574448] uppercase tracking-wider">
              SQC Navigation
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded bg-[#FCE7E6] text-[#D95F68] font-mono font-bold border border-[#F4C4C5]">
                SQC System
              </span>
            </div>
          </div>

          {/* Navigation Links Scroll Container */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {/* Dashboard */}
            <NavLink
              to="/"
              id="nav-link-dashboard"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#D95F68] text-white shadow-sm'
                    : 'text-[#574448] hover:bg-[#FCE7E6] hover:text-[#C4515B]'
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
                className="w-full flex items-center justify-between px-3 py-2.5 text-[#574448] font-bold text-[13px] rounded-lg hover:bg-[#FCE7E6] hover:text-[#C4515B] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ClipboardList size={18} className="shrink-0" />
                  <span>Quality Forms ({visibleFormGroups.reduce((acc, g) => acc + g.forms.length, 0)})</span>
                </div>
                {formsSubmenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {formsSubmenuOpen && (
                <div className="pl-2 pr-1 space-y-2 bg-[#FFF9F9] rounded-lg p-2 border border-[#F4C4C5] text-xs">
                  <NavLink
                    to="/inspections"
                    id="nav-link-all-inspections"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2.5 py-1.5 rounded-md font-bold transition-colors ${
                        isActive ? 'text-[#D95F68] bg-[#FCE7E6] border border-[#F4C4C5]' : 'text-[#574448] hover:bg-[#FCE7E6]'
                      }`
                    }
                  >
                    <Layers size={14} className="text-[#D95F68]" />
                    <span>All Inspection Records</span>
                  </NavLink>

                  <div className="pt-2 pb-1 text-[11px] font-black text-[#574448] uppercase tracking-wider px-2">
                    Permitted Forms
                  </div>

                  {visibleFormGroups.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[#806B6C]">
                      No individual forms assigned to your role. Contact SQC Administrator.
                    </div>
                  ) : (
                    visibleFormGroups.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-0.5 pt-1">
                        <div className="text-[11px] font-black text-[#701638] px-2 pt-1 uppercase tracking-tight">
                          {group.title}
                        </div>

                        {group.forms.map((fCode) => {
                          const meta = FORM_REGISTRY[fCode];
                          if (!meta) return null;

                          const isMatch = new URLSearchParams(location.search).get('form') === fCode;

                          return (
                            <NavLink
                              key={fCode}
                              to={`/new-inspection?form=${fCode}`}
                              id={`nav-form-${fCode.toLowerCase()}`}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center px-2 py-1.5 rounded-md text-xs font-semibold truncate transition-all duration-200 border ${
                                isMatch
                                  ? 'bg-gradient-to-r from-[#701638] to-[#9D174D] text-white font-bold border-[#701638] shadow-md'
                                  : 'bg-transparent text-[#831843] border-transparent hover:bg-[#F8D7E5] hover:text-[#701638] hover:border-[#D98BAA]'
                              }`}
                              title={`${meta.code}: ${meta.title}`}
                            >
                              <span
                                className={`inline-flex items-center justify-center font-mono font-black min-w-[42px] h-[22px] mr-2 px-1.5 rounded text-[10px] leading-none shrink-0 border ${
                                  isMatch
                                    ? 'bg-[#500D28] text-white border-[#500D28]'
                                    : 'bg-[#701638] text-white border-[#701638]'
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

            {/* Approvals */}
            <NavLink
              to="/approvals"
              id="nav-link-approvals"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#D95F68] text-white shadow-sm'
                    : 'text-[#574448] hover:bg-[#FCE7E6] hover:text-[#C4515B]'
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
                    ? 'bg-[#D95F68] text-white shadow-sm'
                    : 'text-[#574448] hover:bg-[#FCE7E6] hover:text-[#C4515B]'
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
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[#574448] font-bold text-[13px] rounded-lg hover:bg-[#FCE7E6] hover:text-[#C4515B] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Database size={18} className="shrink-0" />
                    <span>Master Data</span>
                  </div>
                  {mastersSubmenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {mastersSubmenuOpen && (
                  <div className="mt-1 pl-2 pr-1 space-y-1 bg-white rounded-lg p-2.5 border border-[#F4C4C5] text-xs font-bold">
                    <NavLink to="/masters/departments" id="nav-master-dept" className="block px-2.5 py-1.5 text-[#574448] hover:text-[#C4515B] hover:bg-[#FCE7E6] rounded">Departments & HODs</NavLink>
                    <NavLink to="/masters/sections" id="nav-master-sec" className="block px-2.5 py-1.5 text-[#574448] hover:text-[#C4515B] hover:bg-[#FCE7E6] rounded">Sections & Stages</NavLink>
                    <NavLink to="/masters/machines" id="nav-master-mach" className="block px-2.5 py-1.5 text-[#574448] hover:text-[#C4515B] hover:bg-[#FCE7E6] rounded">Machines & Speeds</NavLink>
                    <NavLink to="/masters/looms" id="nav-master-loom" className="block px-2.5 py-1.5 text-[#574448] hover:text-[#C4515B] hover:bg-[#FCE7E6] rounded">Looms Master</NavLink>
                    <NavLink to="/masters/qualities" id="nav-master-qual" className="block px-2.5 py-1.5 text-[#574448] hover:text-[#C4515B] hover:bg-[#FCE7E6] rounded">Qualities & Counts</NavLink>
                    <NavLink to="/masters/specs" id="nav-master-spec" className="block px-2.5 py-1.5 text-[#574448] hover:text-[#C4515B] hover:bg-[#FCE7E6] rounded">Product & Bag Specs</NavLink>
                    <NavLink to="/masters/standards" id="nav-master-std" className="block px-2.5 py-1.5 text-[#574448] hover:text-[#C4515B] hover:bg-[#FCE7E6] rounded">Standards & Tolerances</NavLink>
                  </div>
                )}
              </div>
            )}

            {/* System Administration (Admins Only) */}
            {isAdmin && (
              <div className="pt-3 border-t border-[#F4C4C5] mt-2">
                <div className="text-[11px] font-black text-[#754D50] uppercase tracking-wider px-3 py-1 bg-[#FCE7E6] rounded-md border border-[#F4C4C5] mb-1.5">
                  Administration
                </div>
                <NavLink
                  to="/admin/users"
                  id="nav-link-users"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                      isActive
                        ? 'bg-[#D95F68] text-white shadow-sm'
                        : 'text-[#574448] hover:bg-[#FCE7E6] hover:text-[#C4515B]'
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
                        ? 'bg-[#D95F68] text-white shadow-sm'
                        : 'text-[#574448] hover:bg-[#FCE7E6] hover:text-[#C4515B]'
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
                        ? 'bg-[#D95F68] text-white shadow-sm'
                        : 'text-[#574448] hover:bg-[#FCE7E6] hover:text-[#C4515B]'
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
          <div className="p-3.5 bg-white border-t border-[#F4C4C5]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#D95F68] text-white font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  {currentUser.displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#393334] truncate">{currentUser.displayName}</p>
                  <p className="text-[10px] font-semibold text-[#806B6C] truncate">{currentUser.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[#806B6C] hover:text-[#D95F68] hover:bg-[#FCE7E6] transition-colors shrink-0"
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
            className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-20 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Main Content Viewport */}
        <main id="app-main-content" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#FFF9F9]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
