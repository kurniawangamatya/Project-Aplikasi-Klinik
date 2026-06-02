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
import GlowingWorldMap from './components/GlowingWorldMap';
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

  const { registerOffline } = useAuth();
  const [loginTab, setLoginTab] = useState<'sso' | 'login' | 'register'>('login');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<any>('dokter');
  const [regSpecialization, setRegSpecialization] = useState('');
  const [regSalary, setRegSalary] = useState(8000000);
  const [regHourlyRate, setRegHourlyRate] = useState(35000);

  useEffect(() => {
    switch (regRole) {
      case 'dokter':
        setRegSalary(8000000);
        setRegHourlyRate(35000);
        break;
      case 'perawat':
        setRegSalary(3000000);
        setRegHourlyRate(15000);
        break;
      case 'admin':
        setRegSalary(4000000);
        setRegHourlyRate(15000);
        break;
      case 'keuangan':
        setRegSalary(3500000);
        setRegHourlyRate(12000);
        break;
      case 'apoteker':
        setRegSalary(3500000);
        setRegHourlyRate(15000);
        break;
      default:
        setRegSalary(3000000);
        setRegHourlyRate(12000);
        break;
    }
  }, [regRole]);

  const [isLocalSim, setIsLocalSim] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('force_local_simulation') === 'true';
    }
    return false;
  });

  const toggleLocalSimulation = () => {
    const nextVal = !isLocalSim;
    setIsLocalSim(nextVal);
    if (nextVal) {
      localStorage.setItem('force_local_simulation', 'true');
    } else {
      localStorage.removeItem('force_local_simulation');
    }
    window.location.reload();
  };

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

    const handleRegSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
        alert("Harap lengkapi nama lengkap, email, dan password Anda.");
        return;
      }
      setLoggingIn(true);
      setLoginError(null);
      setSuccessMsg(null);
      try {
        await registerOffline({
          displayName: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
          specialization: regSpecialization,
          salary: Number(regSalary),
          hourlyRate: Number(regHourlyRate)
        });
        setSuccessMsg("Pendaftaran sukses! Menghubungkan database...");
      } catch (err: any) {
        setLoginError(err.message || String(err));
      } finally {
        setLoggingIn(false);
      }
    };

    const loginVibe = customizationSettings?.loginVibe || 'minimal_slate';
    const loginSubtitleText = customizationSettings?.loginSubtitle || 'Operasional Keuangan Digital | AI Studio Secure Edition';
    const brandColor = customizationSettings?.primaryBrandColor || '#8B5CF6';
    const hideQuickLogin = customizationSettings?.hideQuickLogin || false;
    const showCredit = customizationSettings?.showDeveloperCredit !== false;

    // Fixed High-fidelity purple theme by default for premium visual response
    const vibeBgClass = 'bg-[#030014] text-white';
    const glassCardClass = 'bg-zinc-950/75 border border-violet-500/15 backdrop-blur-3xl shadow-[0_0_80px_-10px_rgba(139,92,246,0.25)]';
    const accentGradientText = 'bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400';

    const loginPresets = [
      { role: 'admin', title: 'ADMIN PORTAL', name: 'Alun Pratama', color: 'border-blue-500/20 hover:border-blue-500/50 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10', initial: 'AD', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]' },
      { role: 'owner', title: 'OWNER PORTAL', name: 'drg. Diana Sp.KGA', color: 'border-purple-500/20 hover:border-purple-500/50 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10', initial: 'OW', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]' },
      { role: 'keuangan', title: 'FINANCE GATE', name: 'Rere Kasir', color: 'border-emerald-500/20 hover:border-emerald-500/50 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10', initial: 'FN', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]' },
      { role: 'perawat', title: 'STAFF SYSTEM', name: 'Suster Nina', color: 'border-orange-500/20 hover:border-orange-500/50 text-orange-400 bg-orange-500/5 hover:bg-orange-500/10', initial: 'NS', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' }
    ];

    return (
      <div className={`min-h-screen ${vibeBgClass} flex items-center justify-center p-4 sm:p-8 font-sans transition-colors duration-700 relative overflow-hidden`}>
        {/* Ambient Grid Wallpaper */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-[#030014] to-[#010103] z-0" />
        
        {/* Soft Background Drift Particles using hardware-accelerated CSS animations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[15%] w-1.5 h-1.5 rounded-full bg-violet-400 opacity-20 animate-pulse" />
          <div className="absolute top-[35%] right-[25%] w-2 h-2 rounded-full bg-fuchsia-400 opacity-25 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-[20%] left-[45%] w-1 h-1 rounded-full bg-indigo-400 opacity-30 animate-pulse" style={{ animationDelay: '2.5s' }} />
          <div className="absolute top-[60%] left-[8%] w-2 h-2 rounded-full bg-violet-500 opacity-15 animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute bottom-[15%] right-[12%] w-1.5 h-1.5 rounded-full bg-fuchsia-500 opacity-20 animate-pulse" style={{ animationDelay: '3s' }} />
        </div>

        {/* Outer Grid lines overlay */}
        <div className="absolute inset-0 bg-[#030014] bg-[linear-gradient(to_right,#0c0a24_1px,transparent_1px),linear-gradient(to_bottom,#0c0a24_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none z-0" />

        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* LEFT PANEL: Professional Clinical Operational Showcase & Glowing World Map */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-5 flex flex-col justify-center items-center hidden lg:flex pr-6"
          >
            {/* Glowing Map Container Card */}
            <div className="p-3 w-full rounded-[2.5rem] bg-zinc-950/20 border border-violet-950/10 backdrop-blur-md">
              <GlowingWorldMap />
            </div>
          </motion.div>

          {/* RIGHT PANEL: Elegant Secure Login Form */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-7 w-full max-w-xl mx-auto"
          >
            <div className={`p-8 sm:p-10 rounded-[3rem] ${glassCardClass} relative overflow-hidden`}>
              {/* Premium top aesthetic line */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600" />
              
              <div className="text-center mb-6">
                <span className="text-[9px] font-mono tracking-[0.25em] text-violet-400 uppercase font-black">Secure Authentication</span>
                <h3 className="text-2xl font-black tracking-tight text-white mt-1">Masuk Sistem</h3>
                <p className="text-zinc-400 text-xs font-medium mt-1 leading-relaxed">
                  {loginSubtitleText}
                </p>
              </div>

              {/* Force Local Simulation Toggle Switch */}
              <div className="mb-6 p-4 rounded-2xl bg-zinc-950/60 border border-violet-950/40 flex items-center justify-between text-left gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-300">
                    <ShieldCheck className={`w-4 h-4 ${isLocalSim ? 'text-emerald-400' : 'text-blue-400'}`} />
                    <span>{isLocalSim ? 'Database Lokal Offline (Hemat Kuota - Aktif)' : 'Mode Database Online (Firebase Terkoneksi)'}</span>
                  </div>
                  <p className="text-[9.5px]/relaxed text-zinc-400 mt-1">
                    {isLocalSim 
                      ? "Mode penyimpanan aman browser aktif. Semua pendaftaran & data tersinkronisasi instan bebas dari limitasi database."
                      : "Mode sinkronisasi cloud real-time aktif menggunakan database Firebase Firestore."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleLocalSimulation}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isLocalSim ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isLocalSim ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

               {loginError && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4 p-4 bg-red-950/30 border border-red-900/40 text-left rounded-2xl relative overflow-hidden text-zinc-300 animate-pulse"
                  id="login-popup-error-banner"
                >
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" id="login-error-icon" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-red-400" id="login-error-title">
                        Otentikasi Gagal atau Akun Ganda
                      </h4>
                      <p className="text-zinc-400 text-[10px] mt-0.5 leading-relaxed" id="login-error-desc">
                        {loginError}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {successMsg && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4 p-4 bg-emerald-950/40 border border-emerald-900/40 text-left rounded-2xl relative overflow-hidden"
                  id="login-success-banner"
                >
                  <div className="flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-emerald-400">
                        Proses Berhasil
                      </h4>
                      <p className="text-zinc-400 text-[10px] mt-0.5 leading-relaxed">
                        {successMsg}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Login Method Toggle Tab */}
              <div className="flex bg-zinc-950/60 border border-violet-950/40 p-1 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => setLoginTab('login')}
                  className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase rounded-xl transition-all ${loginTab === 'login' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.25)]' : 'text-zinc-400 hover:text-white'}`}
                >
                  Masuk Staf
                </button>
                <button
                  type="button"
                  onClick={() => setLoginTab('register')}
                  className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase rounded-xl transition-all ${loginTab === 'register' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.25)]' : 'text-zinc-400 hover:text-white'}`}
                >
                  Daftar Staff Baru
                </button>
                <button
                  type="button"
                  onClick={() => setLoginTab('sso')}
                  className={`flex-1 py-2.5 text-[10px] font-mono font-bold uppercase rounded-xl transition-all ${loginTab === 'sso' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.25)]' : 'text-zinc-400 hover:text-white'}`}
                >
                  Google SSO
                </button>
              </div>

              {/* Secure Login Method Panels */}
              <div className="space-y-6 pt-2">
                {loginTab === 'sso' ? (
                  <div className="space-y-4 text-center">
                    <button 
                      type="button"
                      onClick={login}
                      disabled={loggingIn}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 hover:from-violet-500 hover:via-fuchsia-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm tracking-wide transition-all active:scale-[0.98] group shadow-[0_0_30px_rgba(139,92,246,0.3)]"
                    >
                      <LogIn className="w-5 h-5 text-white group-hover:translate-x-0.5 transition-transform animate-pulse" />
                      {loggingIn ? 'MEMVALIDASI...' : 'MASUK DENGAN GOOGLE'}
                    </button>

                    <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                      Gunakan Akun Google Staf resmi Anda untuk masuk ke sistem secara terenkripsi.
                    </p>
                  </div>
                ) : loginTab === 'login' ? (
                  <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
                    {/* EMAIL INPUT WITH ICON */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono font-bold uppercase text-violet-400 tracking-wider">
                        Alamat Email Staf
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                          <Mail className="w-4 h-4 text-violet-400" />
                        </div>
                        <input 
                          type="email"
                          required
                          value={email}
                          disabled={loggingIn}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@klinik.com"
                          className="w-full bg-zinc-950/80 border border-violet-950/60 rounded-2xl pl-11 pr-5 py-3.5 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25 transition-all focus:shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                        />
                      </div>
                    </div>

                    {/* PASSWORD INPUT WITH ICON */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-mono font-bold uppercase text-violet-400 tracking-wider">
                          Kata Sandi
                        </label>
                        <span className="text-[8px] font-mono text-zinc-500 font-medium">Lupa/Sandi Pertama? Masukkan sandi apa saja.</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                          <Lock className="w-4 h-4 text-violet-400" />
                        </div>
                        <input 
                          type="password"
                          required
                          value={password}
                          disabled={loggingIn}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-zinc-950/80 border border-violet-950/60 rounded-2xl pl-11 pr-5 py-3.5 text-xs text-white placeholder-zinc-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25 transition-all focus:shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        type="submit"
                        disabled={loggingIn}
                        className="w-full py-3.5 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 hover:from-violet-500 hover:via-fuchsia-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-mono font-bold uppercase tracking-widest text-center shadow-[0_4px_20px_rgba(139,92,246,0.25)] transition-all active:scale-[0.98]"
                      >
                        {loggingIn ? 'MEMVALIDASI...' : 'MASUK KE SYSTEM'}
                      </button>
                    </div>
                  </form>
                ) : (
                  // REGISTRATION FORM WITH EXACT REQUIRED FIELDS FOR DB INTEGRATIONS
                  <form onSubmit={handleRegSubmit} className="space-y-4 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* FULL NAME */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono font-bold uppercase text-violet-400 tracking-wider">
                          Nama Lengkap
                        </label>
                        <input 
                          type="text"
                          required
                          value={regName}
                          disabled={loggingIn}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="drg. Amanda Christie"
                          className="w-full bg-zinc-950/80 border border-violet-950/60 rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                        />
                      </div>

                      {/* EMAIL ADDRESS */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono font-bold uppercase text-violet-400 tracking-wider">
                          Alamat Email
                        </label>
                        <input 
                          type="email"
                          required
                          value={regEmail}
                          disabled={loggingIn}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="amanda@klinik.com"
                          className="w-full bg-zinc-950/80 border border-violet-950/60 rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* PASSWORD */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono font-bold uppercase text-violet-400 tracking-wider">
                          Kata Sandi Baru
                        </label>
                        <input 
                          type="password"
                          required
                          value={regPassword}
                          disabled={loggingIn}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Min. 6 karakter"
                          className="w-full bg-zinc-950/80 border border-violet-950/60 rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                        />
                      </div>

                      {/* ROLE SELECTOR (Owner, Admin, Dokter, Perawat, Keuangan, Apoteker etc) */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono font-bold uppercase text-violet-400 tracking-wider">
                          Pilih Jabatan / Peran
                        </label>
                        <select
                          value={regRole}
                          disabled={loggingIn}
                          onChange={(e) => setRegRole(e.target.value as any)}
                          className="w-full bg-zinc-950 border border-violet-950/60 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-violet-500"
                        >
                          <option value="dokter">Dokter Sistem (Praktik)</option>
                          <option value="perawat">Perawat / Asisten Medis</option>
                          <option value="admin">Administrator (Sistem)</option>
                          <option value="owner">Pemilik Klinik (Owner)</option>
                          <option value="keuangan">Bendahara / Staf Keuangan</option>
                          <option value="apoteker">Staf Farmasi / Apoteker</option>
                          <option value="media">Staf Media & Rontgen</option>
                          <option value="PIC">PIC Klinik / Supervisor</option>
                        </select>
                      </div>
                    </div>

                    {/* DYNAMIC SPECIALIZATION - SHOWED ONLY FOR MEDICAL STAFF ROUTE CODES */}
                    {(regRole === 'dokter' || regRole === 'perawat') && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono font-bold uppercase text-violet-400 tracking-wider">
                          Bidang Spesialisasi Medis
                        </label>
                        <input 
                          type="text"
                          value={regSpecialization}
                          disabled={loggingIn}
                          onChange={(e) => setRegSpecialization(e.target.value)}
                          placeholder="Spesialis Konservasi Gigi / Gigi Anak / Bedah Mulut"
                          className="w-full bg-zinc-950/80 border border-violet-950/60 rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    )}

                    <div className="pt-2">
                      <button 
                        type="submit"
                        disabled={loggingIn}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-fuchsia-600 to-violet-600 hover:from-emerald-500 hover:via-fuchsia-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-mono font-bold uppercase tracking-widest text-center shadow-[0_4px_20px_rgba(16,185,129,0.25)] transition-all active:scale-[0.98]"
                      >
                        {loggingIn ? 'MENDAFTARKAN...' : 'DAFTARKAN & SEJAJKAN KE DATABASE'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Subtle Backup Demo bypass in case Google login has sandbox popup restrictions */}
                <div className="border-t border-violet-950/30 pt-4 mt-2 space-y-2">
                  <span className="text-[8px] font-mono font-bold uppercase text-violet-500/70 tracking-[0.12em] block text-center">
                    Gunakan Akses Demo Instan:
                  </span>
                  <div className="flex flex-wrap gap-1.5 justify-center items-center">
                    <button 
                      type="button" 
                      onClick={() => handlePresetLogin('admin')} 
                      className="text-[8px] font-mono font-bold px-3 py-1.5 rounded-full border border-violet-950/60 hover:border-violet-700 bg-violet-950/10 text-violet-400 hover:bg-violet-900/30 transition-all active:scale-95"
                    >
                      ADMIN PORTAL
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handlePresetLogin('owner')} 
                      className="text-[8px] font-mono font-bold px-3 py-1 rounded-full border border-violet-950/60 hover:border-violet-700 bg-violet-950/10 text-violet-400 hover:bg-violet-900/30 transition-all active:scale-95"
                    >
                      OWNER PORTAL
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handlePresetLogin('keuangan')} 
                      className="text-[8px] font-mono font-bold px-3 py-1 rounded-full border border-violet-950/60 hover:border-violet-700 bg-violet-950/10 text-violet-400 hover:bg-violet-900/30 transition-all active:scale-95"
                    >
                      FINANCE PORTAL
                    </button>
                  </div>
                </div>
              </div>

              {/* Connected Systems Bottom Badge Panel */}
              {showCredit && (
                <div className="mt-8 flex justify-center gap-3 border-t border-violet-950/40 pt-4 text-[7px] font-mono font-bold text-zinc-500">
                  <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" /> ADMIN</span>
                  <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-purple-500 animate-pulse" /> OWNER</span>
                  <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> FINANCE</span>
                  <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" /> NURSE</span>
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
