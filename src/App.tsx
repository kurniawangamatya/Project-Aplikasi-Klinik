import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import BoardView from './components/BoardView';
import TeamHub from './components/TeamHub';
import Cashier from './components/Cashier';
import Payroll from './components/Payroll';
import Attendance from './components/Attendance';
import OverviewDashboard from './components/OverviewDashboard';
import FinancialDashboard from './components/FinancialDashboard';
import DoctorReport from './components/DoctorReport';
import MemberReport from './components/MemberReport';
import PatientData from './components/PatientData';
import KPICenter from './components/KPICenter';
import Settings from './components/Settings';
import { db, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, handleFirestoreError, OperationType } from './lib/firebase';
import { Board } from './types';
import { LogIn, Plus, Layout as LayoutIcon, Loader2, AlertCircle, ExternalLink, Mail, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider, useData } from './contexts/DataContext';

function AppContent() {
  const { user, profile, loading, login, loginWithEmail, loginError, setLoginError } = useAuth();
  const { boards, clinicSettings, customizationSettings, loading: dataLoading } = useData();
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('board');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailSignIn, setIsEmailSignIn] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const clinicName = clinicSettings?.name || 'Clinic Tools';

  useEffect(() => {
    if (boards.length > 0 && !currentBoardId) {
      setCurrentBoardId(boards[0].id);
    }
  }, [boards, currentBoardId]);

  const createInitialBoard = async () => {
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'owner')) return;
    try {
      const boardRef = await addDoc(collection(db, 'boards'), {
        name: 'Papan Strategis Baru',
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        order: boards.length
      });
      setCurrentBoardId(boardRef.id);
    } catch (e) {
      console.error(e);
    }
  };

  const moveBoard = async (newBoards: Board[]) => {
    // Optimistic update handled by local state in components if needed, 
    // but here we just update DB. DataContext will pick up the changes.
    try {
      const updates = newBoards.map((b, i) => 
        updateDoc(doc(db, 'boards', b.id), { order: i })
      );
      await Promise.all(updates);
    } catch (e) {
      console.error('Error reordering boards:', e);
    }
  };

  const deleteBoard = async (id: string, name: string) => {
    if (!canCreateBoard) return;
    try {
      await deleteDoc(doc(db, 'boards', id));
      if (currentBoardId === id) {
        setCurrentBoardId(null);
      }
    } catch (e) {
      console.error('Delete board error:', e);
    }
  };

  if (loading || (user && dataLoading)) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    const handlePresetLogin = async (role: string) => {
      setLoggingIn(true);
      setLoginError(null);
      try {
        const testEmail = `${role}@klinik.com`;
        const testPass = `${role}123`;
        await loginWithEmail(testEmail, testPass);
      } catch (err: any) {
        setLoginError(err.message || String(err));
      } finally {
        setLoggingIn(false);
      }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !password.trim()) {
        alert("Harap isi email dan password.");
        return;
      }
      setLoggingIn(true);
      setLoginError(null);
      try {
        await loginWithEmail(email.trim(), password.trim());
      } catch (err: any) {
        setLoginError(err.message || String(err));
      } finally {
        setLoggingIn(false);
      }
    };

    const loginVibe = customizationSettings?.loginVibe || 'minimal_slate';
    const loginSubtitleText = customizationSettings?.loginSubtitle || 'Operasional Keuangan Digital | AI Studio Secure Edition';
    const brandColor = customizationSettings?.primaryBrandColor || '#3B82F6';
    const hideQuickLogin = customizationSettings?.hideQuickLogin || false;
    const showCredit = customizationSettings?.showDeveloperCredit !== false;

    // Vibe theme classes
    let vibeBgClass = 'bg-zinc-950 text-white';
    let cardClass = 'bg-zinc-900 border-zinc-800 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)]';
    let sidePanelBg = 'bg-zinc-900/50 border-zinc-850';
    let accentGradientText = 'bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400';

    if (loginVibe === 'cosmic_space') {
      vibeBgClass = 'bg-slate-950 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-950/45 via-zinc-950 to-slate-950 text-white';
      cardClass = 'bg-zinc-900/80 backdrop-blur-xl border-indigo-950/40 shadow-[0_64px_128px_-32px_rgba(30,12,74,0.6)]';
      sidePanelBg = 'bg-indigo-95/5 backdrop-blur-xl border-indigo-900/30';
      accentGradientText = 'bg-gradient-to-r from-violet-400 via-fuchsia-300 to-indigo-300';
    } else if (loginVibe === 'clinic_emerald') {
      vibeBgClass = 'bg-zinc-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950 to-zinc-950 text-white';
      cardClass = 'bg-zinc-900/90 backdrop-blur-lg border-emerald-900/30 shadow-[0_64px_128px_-32px_rgba(6,78,59,0.3)]';
      sidePanelBg = 'bg-emerald-950/10 backdrop-blur-md border-emerald-905/10';
      accentGradientText = 'bg-gradient-to-r from-emerald-400 to-teal-300';
    } else if (loginVibe === 'warm_sunset') {
      vibeBgClass = 'bg-zinc-950 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-amber-950/20 via-zinc-950 to-zinc-950 text-white';
      cardClass = 'bg-zinc-900/90 backdrop-blur-lg border-amber-900/20 shadow-[0_64px_128px_-32px_rgba(115,115,115,0.4)]';
      sidePanelBg = 'bg-amber-950/5 backdrop-blur-md border-amber-900/10';
      accentGradientText = 'bg-gradient-to-r from-amber-400 to-rose-300';
    } else if (loginVibe === 'high_contrast_glass') {
      vibeBgClass = 'bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black text-white';
      cardClass = 'bg-zinc-950/70 backdrop-blur-2xl border-zinc-700/60 shadow-[0_80px_160px_-40px_rgba(0,0,0,0.9)]';
      sidePanelBg = 'bg-zinc-950/30 backdrop-blur-xl border-zinc-800';
      accentGradientText = 'bg-gradient-to-r from-white via-zinc-300 to-zinc-400';
    }

    const loginPresets = [
      { role: 'admin', title: 'Admin', name: 'Alun Pratama', color: 'border-blue-500/20 hover:border-blue-500 text-blue-400 bg-blue-500/5', initial: 'AD' },
      { role: 'owner', title: 'Owner', name: 'drg. Diana Sp.KGA', color: 'border-purple-500/20 hover:border-purple-500 text-purple-400 bg-purple-500/5', initial: 'OW' },
      { role: 'keuangan', title: 'Finance', name: 'Rere Kasir', color: 'border-emerald-500/20 hover:border-emerald-500 text-emerald-400 bg-emerald-500/5', initial: 'FN' },
      { role: 'perawat', title: 'Nurse', name: 'Suster Nina', color: 'border-orange-500/20 hover:border-orange-505 text-orange-400 bg-orange-500/5', initial: 'NS' }
    ];

    return (
      <div className={`min-h-screen ${vibeBgClass} flex items-center justify-center p-4 sm:p-8 font-sans transition-colors duration-700 relative overflow-hidden`}>
        {/* Backdrop Decorative Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-[130px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-[130px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* LEFT PANEL: Professional Clinical Operational Showcase */}
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-6 space-y-8 hidden lg:block pr-8"
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-[1.75rem] flex items-center justify-center shadow-lg rotate-6 hover:rotate-0 transition-all duration-300"
                style={{ backgroundColor: brandColor }}
              >
                <LayoutIcon className="text-white w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Platform Portal</span>
                <h2 className="text-3xl font-black text-white tracking-tighter leading-none mt-0.5">{clinicName}</h2>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] text-white">
                Operasional Digital <br />
                <span className={`bg-clip-text text-transparent ${accentGradientText}`}>
                  Efisien & Transparan
                </span>
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-md font-medium">
                Sistem pengelolaan transaksi kasir, log aktivitas harian dokter, persetujuan lembur perawat, serta laporan arus kas digital dalam satu dasbor terintegrasi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`p-5 rounded-3xl border ${sidePanelBg} transition-all hover:scale-[1.02]`}>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-3">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-zinc-200 uppercase tracking-wider">Akses Terenkripsi</h4>
                <p className="text-[10px] text-zinc-500 font-bold mt-1 leading-relaxed">Firebase Securing Guard membatasi menu berdasarkan hak akses staf.</p>
              </div>

              <div className={`p-5 rounded-3xl border ${sidePanelBg} transition-all hover:scale-[1.02]`}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-zinc-200 uppercase tracking-wider">Lembur & Audit</h4>
                <p className="text-[10px] text-zinc-500 font-bold mt-1 leading-relaxed">Penghitungan komisi dan pengajuan bonus lembur otomatis.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 text-xs font-bold text-zinc-650">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600">Sistem Online & Beroperasi Normal</span>
            </div>
          </motion.div>

          {/* RIGHT PANEL: Elegant Secure Login Form */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 w-full max-w-md mx-auto"
          >
            <div className={`p-8 sm:p-10 rounded-[3.5rem] border ${cardClass} relative overflow-hidden`}>
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-700 via-indigo-500 to-purple-500" />
              
              <div className="text-center mb-6">
                {/* Compact branding on mobile */}
                <div className="lg:hidden flex items-center justify-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <LayoutIcon className="text-white w-5 h-5" />
                  </div>
                  <h1 className="text-xl font-black text-white tracking-tight">{clinicName}</h1>
                </div>

                <h3 className="text-2xl font-black tracking-tight text-white mb-1">Selamat Datang</h3>
                <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                  {loginSubtitleText}
                </p>
              </div>

              {loginError && (
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-6 p-4 bg-red-950/40 border border-red-800/50 text-left rounded-2xl relative overflow-hidden text-zinc-350"
                  id="login-popup-error-banner"
                >
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" id="login-error-icon" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-red-400" id="login-error-title">
                        Kendala Masuk Akun
                      </h4>
                      <p className="text-zinc-405 text-[10px] mt-1 leading-relaxed" id="login-error-desc">
                        OAuth browser diblokir di frame ini. Gunakan **Akun Staf Demo** atau isi **Form email** di bawah dengan aman.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Toggle views or unified container */}
              {!isEmailSignIn ? (
                <div className="space-y-6">
                  {/* Preset Fast Login Section ( Netflix style select account ) */}
                  {!hideQuickLogin && (
                    <div className="space-y-3 bg-zinc-950/40 border border-zinc-800/50 p-4.5 rounded-3xl">
                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest block mb-2 text-center">Masuk Aman Sebagai Staf Demo</span>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        {loginPresets.map((preset) => (
                          <button
                            key={preset.role}
                            onClick={() => handlePresetLogin(preset.role)}
                            disabled={loggingIn}
                            className={`p-3 rounded-2xl border text-left transition-all active:scale-95 flex items-center gap-2 block ${preset.color}`}
                          >
                            <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center font-black text-xs shrink-0 border border-zinc-850">
                              {preset.initial}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-zinc-250 truncate leading-tight">{preset.name.split(' ')[0]} {preset.name.split(' ')[1] || ''}</p>
                              <p className="text-[8px] text-zinc-505 font-bold uppercase tracking-wider mt-0.5">{preset.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hideQuickLogin && (
                    <div className="flex gap-2 items-center text-zinc-700">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Atau Autentikasi Mandiri</span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                  )}

                  {/* Standard Sign In triggers */}
                  <div className="space-y-2">
                    <button 
                      onClick={() => setIsEmailSignIn(true)}
                      className="w-full flex items-center justify-center gap-3 py-3.5 bg-zinc-950 border border-zinc-805 hover:border-zinc-700 text-zinc-300 rounded-2xl font-bold text-xs hover:bg-zinc-900 transition-all active:scale-95"
                    >
                      <Mail className="w-4 h-4 text-zinc-400" />
                      Gunakan Email & Password
                    </button>

                    <button 
                      onClick={login}
                      disabled={loggingIn}
                      className="w-full flex items-center justify-center gap-3 py-3.5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-2xl font-black text-xs transition-all active:scale-95 group shadow-lg shadow-black/30"
                    >
                      <LogIn className="w-4 h-4 text-zinc-950 group-hover:translate-x-1 transition-transform" />
                      Masuk dengan Akun Google
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
                  {/* EMAIL INPUT WITH ICON */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Alamat Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input 
                        type="email"
                        required
                        value={email}
                        disabled={loggingIn}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@klinik.com"
                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl pl-11 pr-5 py-3.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  {/* PASSWORD INPUT WITH ICON */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Kata Sandi</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input 
                        type="password"
                        required
                        value={password}
                        disabled={loggingIn}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan sandi..."
                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl pl-11 pr-5 py-3.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <p className="text-[9px] text-zinc-500 leading-relaxed italic block mt-1">
                    *Tip: Jika email belum pernah didaftarkan ke sistem, akun baru akan secara otomatis dibuat sewaktu Anda menekan tombol Masuk.
                  </p>

                  <div className="pt-2 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsEmailSignIn(false)}
                      className="flex-1 py-3.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      disabled={loggingIn}
                      className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg"
                    >
                      {loggingIn ? 'Menilai...' : 'Masuk'}
                    </button>
                  </div>
                </form>
              )}

              {/* Active Roles bottom tag */}
              {showCredit && (
                <div className="mt-8 flex justify-center gap-3 border-t border-zinc-800/60 pt-4 text-[8px] font-bold text-zinc-500">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" /> ADMIN</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" /> OWNER</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> KEUANGAN</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" /> PERAWAT</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const canCreateBoard = profile?.role === 'admin' || profile?.role === 'owner';

  return (
    <Layout 
      currentTab={activeTab} 
      setTab={setActiveTab}
      boards={boards}
      currentBoardId={currentBoardId}
      setCurrentBoardId={setCurrentBoardId}
      onAddBoard={createInitialBoard}
      onDeleteBoard={deleteBoard}
      onReorderBoards={moveBoard}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + (activeTab === 'board' ? currentBoardId : '')}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {activeTab === 'overview' ? (
            <OverviewDashboard setTab={setActiveTab} boards={boards} setCurrentBoardId={setCurrentBoardId} />
          ) : activeTab === 'team' ? (
            <TeamHub />
          ) : activeTab === 'analytics' ? (
            <FinancialDashboard />
          ) : activeTab === 'doctor-report' ? (
            <DoctorReport />
          ) : activeTab === 'nurse-report' ? (
            <MemberReport role="perawat" title="Laporan Perawat" />
          ) : activeTab === 'admin-report' ? (
            <MemberReport role="admin" title="Laporan Admin" />
          ) : activeTab === 'finance' ? (
            <Cashier />
          ) : activeTab === 'payroll' ? (
            <Payroll setTab={setActiveTab} />
          ) : activeTab === 'attendance' ? (
            <Attendance />
          ) : activeTab === 'patient-data' ? (
            <PatientData />
          ) : activeTab === 'kpi' ? (
            <KPICenter />
          ) : activeTab === 'settings' ? (
            <Settings />
          ) : (boards.length === 0 && activeTab === 'board') ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-32 h-32 bg-zinc-900 border border-zinc-800 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner shadow-black/50"
              >
                <LayoutIcon className="w-12 h-12 text-zinc-700" />
              </motion.div>
              <h3 className="text-2xl font-black text-white mb-3">
                {canCreateBoard ? 'Inisialisasi Dashboard' : 'Papan Tidak Tersedia'}
              </h3>
              <p className="text-zinc-500 mb-10 max-w-sm font-medium">
                {canCreateBoard 
                  ? 'Buat papan keuangan strategis pertama Anda untuk mulai pelacakan dan persetujuan waktu nyata.' 
                  : 'Tidak ada papan aktif ditemukan. Silakan hubungi administrator atau pemilik untuk ditugaskan ke papan.'}
              </p>
              {canCreateBoard && (
                <button 
                  onClick={createInitialBoard}
                  className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/20 active:scale-95"
                >
                  <Plus className="w-6 h-6" />
                  Sediakan Papan Baru
                </button>
              )}
            </div>
          ) : (
            <BoardView boardId={currentBoardId || boards[0].id} />
          )}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
