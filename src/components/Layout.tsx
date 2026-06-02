import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import Notifications from './Notifications';
import Search from './Search';
import { LayoutDashboard, Users, LogOut, Briefcase, Package, Plus, ChevronDown, Check, Settings, Trash2, Edit3, GripVertical, DollarSign, Clock, BarChart3, Stethoscope, Activity, Menu, X, Target, Sun, Moon, Lock, Unlock } from 'lucide-react';
import { Board, UserRole } from '../types';
import { db, doc, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { useData } from '../contexts/DataContext';
import { motion, AnimatePresence, Reorder } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  setTab: (t: string) => void;
  boards: Board[];
  currentBoardId: string | null;
  setCurrentBoardId: (id: string) => void;
  onAddBoard: () => void;
  onDeleteBoard: (id: string, name: string) => void;
  onReorderBoards: (newBoards: Board[]) => void;
}

interface MobileNavItemProps {
  key?: string | number;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function MobileNavItem({ icon, label, active = false, onClick }: MobileNavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 transition-all shrink-0 ${
        active ? 'text-blue-500 scale-110' : 'text-zinc-600 hover:text-zinc-400'
      }`}
    >
      <div className={active ? 'text-blue-500' : 'text-zinc-600'}>{icon}</div>
      <span className="text-[8px] font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
    </button>
  );
}

export default function Layout({ children, currentTab, setTab, boards, currentBoardId, setCurrentBoardId, onAddBoard, onDeleteBoard, onReorderBoards }: LayoutProps) {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { clinicSettings: clinicInfo, rolePermissions, isQuotaExceeded, isLayoutLocked, toggleLayoutLock } = useData();
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const allowedNavs = useMemo(() => {
    if (rolePermissions?.navigation) return rolePermissions.navigation;
    
    // Default fallbacks
    const defaults: Record<string, string[]> = {
      owner: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
      admin: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
      keuangan: ['overview', 'board', 'clinic-boards', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi'],
      dokter: ['overview', 'board', 'clinic-boards', 'doctor-report', 'attendance', 'patient-data', 'kpi'],
      perawat: ['overview', 'board', 'clinic-boards', 'nurse-report', 'attendance', 'patient-data', 'kpi'],
      apoteker: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi'],
      media: ['overview', 'board', 'clinic-boards', 'attendance', 'kpi'],
      PIC: ['overview', 'board', 'clinic-boards', 'team', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi', 'settings']
    };
    
    return profile?.role ? (defaults[profile.role] || ['board']) : ['board'];
  }, [rolePermissions, profile?.role]);

  const isAllowed = (navId: string) => allowedNavs.includes(navId);

  const board = boards.find(b => b.id === currentBoardId);
  const canManageBoards = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'PIC';
  const isDashboard = currentTab === 'board' && boards.indexOf(board as Board) === 0;

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-500/30 selection:text-white transition-colors duration-300">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <aside className={`hidden md:flex bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col z-30 transition-all duration-500 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex-1 flex flex-col overflow-hidden relative">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-20 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-950 text-white z-40 hover:scale-110 transition-transform"
          >
            {isSidebarCollapsed ? <Plus className="w-3 h-3 rotate-45" /> : <ChevronDown className="w-3 h-3 rotate-90" />}
          </button>

          <div className={`flex items-center gap-3 mb-10 shrink-0 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            {clinicInfo?.logoURL ? (
              <img src={clinicInfo.logoURL} className="w-10 h-10 object-contain shrink-0" alt="Logo" />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-2xl shadow-blue-900/20 shrink-0">
                <Package className="text-white w-6 h-6" />
              </div>
            )}
            {!isSidebarCollapsed && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <h1 className="text-lg font-black tracking-tighter text-zinc-900 dark:text-white truncate max-w-[140px]">
                  {clinicInfo?.name || 'Clinic Tools'}
                </h1>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Internal / OS</span>
              </motion.div>
            )}
          </div>
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Unified Scroll Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-8">
              <nav className="space-y-1">
                {isAllowed('overview') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('overview')}
                    active={currentTab === 'overview'}
                    icon={<LayoutDashboard className="w-4 h-4" />} 
                    label="Dashboard" 
                  />
                )}
                {isAllowed('analytics') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('analytics')}
                    active={currentTab === 'analytics'}
                    icon={<BarChart3 className="w-4 h-4" />} 
                    label="Analitik Visual" 
                  />
                )}
                {isAllowed('doctor-report') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('doctor-report')}
                    active={currentTab === 'doctor-report'}
                    icon={<Stethoscope className="w-4 h-4" />} 
                    label="Laporan Dokter" 
                  />
                )}
                {isAllowed('nurse-report') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('nurse-report')}
                    active={currentTab === 'nurse-report'}
                    icon={<Activity className="w-4 h-4" />} 
                    label="Laporan Perawat" 
                  />
                )}
                {isAllowed('admin-report') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('admin-report')}
                    active={currentTab === 'admin-report'}
                    icon={<Briefcase className="w-4 h-4" />} 
                    label="Laporan Admin" 
                  />
                )}
                {isAllowed('team') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('team')}
                    active={currentTab === 'team'}
                    icon={<Users className="w-4 h-4" />} 
                    label="Pusat Tim" 
                  />
                )}
                {isAllowed('finance') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('finance')}
                    active={currentTab === 'finance'}
                    icon={<Briefcase className="w-4 h-4" />} 
                    label="Kasir Clinic" 
                  />
                )}
                {isAllowed('payroll') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('payroll')}
                    active={currentTab === 'payroll'}
                    icon={<DollarSign className="w-4 h-4" />} 
                    label="Payroll" 
                  />
                )}
                {isAllowed('attendance') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('attendance')}
                    active={currentTab === 'attendance'}
                    icon={<Clock className="w-4 h-4" />} 
                    label="Absensi" 
                  />
                )}
                {isAllowed('patient-data') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('patient-data')}
                    active={currentTab === 'patient-data'}
                    icon={<Users className="w-4 h-4" />} 
                    label="Data Pasien" 
                  />
                )}
                {isAllowed('kpi') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('kpi')}
                    active={currentTab === 'kpi'}
                    icon={<Target className="w-4 h-4" />} 
                    label="Pusat KPI" 
                  />
                )}
                {isAllowed('settings') && (
                  <NavItem 
                    collapsed={isSidebarCollapsed}
                    onClick={() => setTab('settings')}
                    active={currentTab === 'settings'}
                    icon={<Settings className="w-4 h-4" />} 
                    label="Pengaturan" 
                  />
                )}
              </nav>

                {isAllowed('clinic-boards') && (
                  <div className="flex flex-col">
                    {!isSidebarCollapsed && (
                  <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                    <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-600 uppercase tracking-widest">Clinic Tools</span>
                    {canManageBoards && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={toggleLayoutLock}
                          className={`p-1 rounded transition-all flex items-center justify-center ${
                            isLayoutLocked 
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500' 
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500'
                          }`}
                          title={isLayoutLocked ? "Susunan Terkunci (Klik untuk edit posisi)" : "Susunan Terbuka (Geser posisi bebas - klik setelah selesai untuk kunci)"}
                        >
                          {isLayoutLocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button 
                          onClick={onAddBoard}
                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-blue-500 rounded transition-all"
                          title="Papan Baru"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                    )}
                    
                    <Reorder.Group 
                      axis="y" 
                      values={boards} 
                      onReorder={onReorderBoards}
                      className={`space-y-1 pb-4 ${isSidebarCollapsed ? 'px-2' : ''}`}
                    >
                      {boards.map(board => (
                        <Reorder.Item 
                          key={board.id} 
                          value={board}
                          dragListener={!isLayoutLocked && canManageBoards}
                          className="group/board relative"
                        >
                          <div className="flex items-center gap-1">
                            {canManageBoards && !isSidebarCollapsed && (
                              <div 
                                className={`p-0.5 transition-colors duration-200 ${
                                  isLayoutLocked 
                                    ? 'text-zinc-700 opacity-35 cursor-not-allowed' 
                                    : 'cursor-grab active:cursor-grabbing text-zinc-500 hover:text-blue-500'
                                }`}
                                title={isLayoutLocked ? "Susunan Terkunci" : "Seret untuk ubah susunan"}
                              >
                                {isLayoutLocked ? (
                                  <Lock className="w-3 h-3 text-zinc-650" />
                                ) : (
                                  <GripVertical className="w-3.5 h-3.5" />
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setCurrentBoardId(board.id);
                                setTab('board');
                              }}
                              title={board.name}
                              className={`flex-1 text-left rounded-lg text-xs font-bold transition-all truncate border ${isSidebarCollapsed ? 'p-2 flex justify-center' : 'px-3 py-2 pr-8'} ${
                                currentBoardId === board.id && currentTab === 'board'
                                  ? 'bg-blue-600/10 border-blue-500/20 text-blue-500 shadow-lg shadow-blue-900/5' 
                                  : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-800/30'
                              }`}
                            >
                              {isSidebarCollapsed ? board.name.charAt(0).toUpperCase() : board.name}
                            </button>
                          </div>
                          {canManageBoards && !isSidebarCollapsed && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteBoard(board.id, board.name);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-700 hover:text-red-500 opacity-0 group-hover/board:opacity-100 transition-all z-10"
                              title="Hapus Papan"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className={`mt-auto p-4 bg-zinc-100 dark:bg-zinc-950/50 border-t border-zinc-200 dark:border-zinc-800 shrink-0 ${isSidebarCollapsed ? 'flex flex-col items-center gap-4' : ''}`}>
          <div className={`flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 ${isSidebarCollapsed ? 'p-1' : 'mb-4 px-2 p-2'}`}>
            <img 
              src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}&background=3b82f6&color=fff`} 
              className={`rounded-lg grayscale hover:grayscale-0 transition-all border border-zinc-700 ${isSidebarCollapsed ? 'w-8 h-8' : 'w-10 h-10'}`}
              alt="Avatar"
            />
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-zinc-100 truncate">{profile?.displayName}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    profile?.role === 'admin' ? 'bg-blue-500' : 
                    profile?.role === 'keuangan' ? 'bg-emerald-500' : 
                    profile?.role === 'dokter' ? 'bg-indigo-500' : 
                    profile?.role === 'apoteker' ? 'bg-pink-500' :
                    profile?.role === 'media' ? 'bg-sky-500' :
                    profile?.role === 'PIC' ? 'bg-orange-500' :
                    'bg-purple-500'
                  }`} />
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold">
                    {profile?.role === 'admin' ? 'Administrator' : profile?.role === 'keuangan' ? 'Keuangan' : profile?.role}
                  </p>
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={logout}
            className={`flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all group ${isSidebarCollapsed ? 'justify-center p-2' : 'w-full px-3 py-2'}`}
            title="Keluar Sesi"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            {!isSidebarCollapsed && <span>Keluar Sesi</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Menu Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed top-0 right-0 bottom-0 w-[80%] max-w-sm bg-white dark:bg-zinc-900 z-50 md:hidden border-l border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-y-auto"
              >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        {clinicInfo?.logoURL ? (
                          <img src={clinicInfo.logoURL} className="w-8 h-8 object-contain shrink-0" alt="Logo" />
                        ) : (
                          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                            <Package className="text-white w-5 h-5" />
                          </div>
                        )}
                        <h2 className="text-sm font-black text-zinc-900 dark:text-white italic truncate max-w-[180px]">
                          {clinicInfo?.name || 'Clinic Tools'}
                        </h2>
                      </div>
                      <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-3">
                        {theme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-blue-400" />}
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{theme === 'light' ? 'Mode Terang' : 'Mode Gelap'}</span>
                      </div>
                      <button 
                        onClick={toggleTheme}
                        className="px-4 py-1.5 bg-white dark:bg-zinc-950 text-[10px] font-black uppercase rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm"
                      >
                        Ganti
                      </button>
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Laporan & Analitik</p>
                      <div className="grid grid-cols-2 gap-2">
                        {isAllowed('analytics') && (
                          <MenuGridItem 
                            icon={<BarChart3 className="w-4 h-4" />} 
                            label="Analitik" 
                            onClick={() => { setTab('analytics'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'analytics'}
                          />
                        )}
                        {isAllowed('doctor-report') && (
                          <MenuGridItem 
                            icon={<Stethoscope className="w-4 h-4" />} 
                            label="Dr. Report" 
                            onClick={() => { setTab('doctor-report'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'doctor-report'}
                          />
                        )}
                        {isAllowed('nurse-report') && (
                          <MenuGridItem 
                            icon={<Activity className="w-4 h-4" />} 
                            label="Nurse Report" 
                            onClick={() => { setTab('nurse-report'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'nurse-report'}
                          />
                        )}
                        {isAllowed('admin-report') && (
                          <MenuGridItem 
                            icon={<Briefcase className="w-4 h-4" />} 
                            label="Admin Report" 
                            onClick={() => { setTab('admin-report'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'admin-report'}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Operasional</p>
                      <div className="grid grid-cols-2 gap-2">
                        {isAllowed('finance') && (
                          <MenuGridItem 
                            icon={<Briefcase className="w-4 h-4" />} 
                            label="Kasir" 
                            onClick={() => { setTab('finance'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'finance'}
                          />
                        )}
                        {isAllowed('payroll') && (
                          <MenuGridItem 
                            icon={<DollarSign className="w-4 h-4" />} 
                            label="Payroll" 
                            onClick={() => { setTab('payroll'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'payroll'}
                          />
                        )}
                        {isAllowed('attendance') && (
                          <MenuGridItem 
                            icon={<Clock className="w-4 h-4" />} 
                            label="Absensi" 
                            onClick={() => { setTab('attendance'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'attendance'}
                          />
                        )}
                        {isAllowed('kpi') && (
                          <MenuGridItem 
                            icon={<Target className="w-4 h-4" />} 
                            label="KPI Tim" 
                            onClick={() => { setTab('kpi'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'kpi'}
                          />
                        )}
                        {isAllowed('team') && (
                          <MenuGridItem 
                            icon={<Users className="w-4 h-4" />} 
                            label="Tim" 
                            onClick={() => { setTab('team'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'team'}
                          />
                        )}
                        {isAllowed('settings') && (
                          <MenuGridItem 
                            icon={<Settings className="w-4 h-4" />} 
                            label="Setelan" 
                            onClick={() => { setTab('settings'); setIsMobileMenuOpen(false); }} 
                            active={currentTab === 'settings'}
                          />
                        )}
                      </div>
                    </div>

                    {isAllowed('clinic-boards') && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Papan (Clinic Boards)</p>
                        <div className="space-y-1">
                          {boards.map(b => (
                            <button 
                              key={b.id}
                              onClick={() => { setCurrentBoardId(b.id); setTab('board'); setIsMobileMenuOpen(false); }}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                                currentBoardId === b.id && currentTab === 'board'
                                  ? 'bg-blue-600/10 border-blue-500/20 text-blue-500'
                                  : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                              }`}
                            >
                              <span className="text-xs font-bold truncate">{b.name}</span>
                              {currentBoardId === b.id && currentTab === 'board' && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                      <button 
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-bold bg-red-500/10 rounded-xl"
                      >
                        <LogOut className="w-4 h-4" />
                        Keluar Sesi
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Mobile Header - Only visible on mobile */}
        <header className="md:hidden h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-40">
          <div className="flex items-center gap-3">
            {clinicInfo?.logoURL ? (
              <img src={clinicInfo.logoURL} className="w-8 h-8 object-contain shrink-0" alt="Logo" />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
                <Package className="text-white w-5 h-5" />
              </div>
            )}
            <h1 className="text-sm font-black tracking-tighter text-zinc-900 dark:text-white italic truncate max-w-[120px]">
              {clinicInfo?.name || 'Clinic Tools'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Notifications />
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Desktop Header - Only visible on desktop */}
        <header className="hidden md:flex h-16 bg-white/80 dark:bg-zinc-950/50 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 items-center justify-between px-8 z-20 shrink-0">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 pr-6 border-r border-zinc-200 dark:border-zinc-800">
              {clinicInfo?.logoURL ? (
                <img src={clinicInfo.logoURL} className="w-8 h-8 object-contain shrink-0" alt="Logo" />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20 shrink-0">
                  <Package className="text-white w-5 h-5" />
                </div>
              )}
              <h1 className="text-sm font-black tracking-tighter text-zinc-900 dark:text-white italic truncate max-w-[160px]">
                {clinicInfo?.name || 'Clinic Tools'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold text-zinc-500 tracking-widest uppercase truncate max-w-[200px]">
                {board?.name || 'Dashboard'} 
                {currentTab !== 'board' && <span className="text-zinc-300 dark:text-zinc-800 mx-2">/</span>} 
                {currentTab !== 'board' && <span className="text-zinc-900 dark:text-zinc-100 italic">{currentTab}</span>}
              </h2>
            </div>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <Search />
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleTheme}
              className="p-2 text-zinc-500 hover:text-blue-500 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-all"
              title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all">
              <Users className="w-3.5 h-3.5" />
              Undang
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <Notifications />
          </div>
        </header>

        {children}

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900 flex items-center justify-around px-4 z-40 pb-safe">
          {isAllowed('overview') && (
            <MobileNavItem 
              onClick={() => setTab('overview')}
              active={currentTab === 'overview'}
              icon={<LayoutDashboard className="w-5 h-5" />} 
              label="Home" 
            />
          )}
          {isAllowed('analytics') && (
            <MobileNavItem 
              onClick={() => setTab('analytics')}
              active={currentTab === 'analytics'}
              icon={<BarChart3 className="w-5 h-5" />} 
              label="Analitik" 
            />
          )}
          {isAllowed('finance') && (
            <MobileNavItem 
              onClick={() => setTab('finance')}
              active={currentTab === 'finance'}
              icon={<Briefcase className="w-5 h-5" />} 
              label="Kasir" 
            />
          )}
          {isAllowed('patient-data') && (
            <MobileNavItem 
              onClick={() => setTab('patient-data')}
              active={currentTab === 'patient-data'}
              icon={<Users className="w-5 h-5" />} 
              label="Pasien" 
            />
          )}
          <MobileNavItem 
            onClick={() => setIsMobileMenuOpen(true)}
            active={isMobileMenuOpen}
            icon={<Menu className="w-5 h-5" />} 
            label="Menu" 
          />
        </nav>

        {/* Status Bar */}
        <footer className="px-8 py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-600 font-bold uppercase tracking-wider shrink-0 bg-zinc-50 dark:bg-zinc-950">
          <div className="flex gap-6 items-center">
            {isQuotaExceeded ? (
              <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> 
                Simulasi Lokal (Offline)
              </span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 
                Sinkronisasi Cloud Aktif
              </span>
            )}
            <span className="text-zinc-300 dark:text-zinc-850">|</span>
            <button
              onClick={() => {
                const isForced = localStorage.getItem('force_local_simulation') === 'true';
                if (isForced) {
                  localStorage.removeItem('force_local_simulation');
                } else {
                  localStorage.setItem('force_local_simulation', 'true');
                }
                window.location.reload();
              }}
              className="px-2.5 py-1 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all uppercase text-[9px] font-black tracking-widest cursor-pointer active:scale-95"
              title="Klik untuk mengubah mode penyimpanan database"
            >
              {localStorage.getItem('force_local_simulation') === 'true' ? "🔗 Aktifkan Cloud" : "💾 Aktifkan Mode Offline (Hemat Kuota)"}
            </button>
            <span className="text-zinc-300 dark:text-zinc-850">|</span>
            <span className="hover:text-zinc-600 dark:hover:text-zinc-400 cursor-help transition-colors">V: 2.0.4 Bento</span>
          </div>
          <div className="flex gap-8 italic font-medium normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
            <span>Keuangan: Siap Audit</span>
            <span>Pemilik: 1 Tindakan Diperlukan</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, collapsed }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={`w-full flex items-center transition-all border ${collapsed ? 'justify-center p-2 rounded-xl' : 'gap-3 px-3 py-2.5 rounded-xl text-sm font-bold'} ${
        active 
          ? 'bg-zinc-800 dark:bg-zinc-800 border-zinc-700 text-white dark:text-zinc-100 shadow-xl dark:shadow-black/50' 
          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
      }`}
    >
      <span className={active ? 'text-blue-500' : 'text-zinc-400 dark:text-zinc-600'}>{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function MenuGridItem({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-2 ${
        active 
          ? 'bg-blue-600/10 border-blue-500/30 text-blue-500' 
          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
      }`}
    >
      <div className={active ? 'text-blue-500' : 'text-zinc-400 dark:text-zinc-500'}>{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-center">{label}</span>
    </button>
  );
}
