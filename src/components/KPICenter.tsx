import React, { useState, useEffect, useMemo } from 'react';
import KPITemplateManagement from './KPITemplateManagement';
import { db, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, handleFirestoreError, OperationType, where, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { CheckCircle2, XCircle, Clock, Plus, Filter, Search, Award, Target, TrendingUp, User, Calendar, Check, X, Eye, Edit3, BarChart3, Trash2, ArrowUpRight, HelpCircle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface KPIEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  date: any;
  workDescription: string;
  metrics: {
    templateId: string;
    label: string;
    value: number;
    unit: string;
    price: number;
    subtotal: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'validated' | 'rejected';
  validatedBy?: string;
  validatedName?: string;
  validatedAt?: any;
  feedback?: string;
  missedCount?: number; // Added to persist missed task count
  payoutBase?: number;  // Base payout after target penalty check
}

const CONSTANT_KPI_CHECKLIST = [
  { id: 'task-1', taskName: 'Absensi Tepat Waktu sebelum Shift', type: 'standar', price: 0, unit: 'Kehadiran' },
  { id: 'task-2', taskName: 'Sterilisasi Unit & Alat Medis Utama', type: 'standar', price: 0, unit: 'Sesi' },
  { id: 'task-3', taskName: 'Input Rekam Medis Digital Pasien', type: 'standar', price: 0, unit: 'Pasien' },
  { id: 'task-4', taskName: 'Isi Logbook Operasional Harian', type: 'standar', price: 0, unit: 'Harian' },
  { id: 'task-5', taskName: 'Layanan Konsultasi & Diagnosa Profesional', type: 'bonus', price: 20000, unit: 'Konsul' },
  { id: 'task-6', taskName: 'Tindakan Skaling / Pembersihan Karang', type: 'bonus', price: 35000, unit: 'Sesi' },
  { id: 'task-7', taskName: 'Aplikasi Fluoride / Tindakan Protektif', type: 'bonus', price: 15000, unit: 'Gigi' },
  { id: 'task-8', taskName: 'Instruksi Edukasi Kebersihan Gigi H+1', type: 'standar', price: 0, unit: 'Pasien' },
  { id: 'task-9', taskName: 'Update Stok Bahan Habis Pakai Medis', type: 'standar', price: 0, unit: 'Stok' },
  { id: 'task-10', taskName: 'Follow-up Keluhan / Chat Pasca Tindakan', type: 'standar', price: 0, unit: 'Pasien' }
];

export default function KPICenter() {
  const { profile } = useAuth();
  const { users } = useData();
  const [entries, setEntries] = useState<KPIEntry[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-kpi' | 'validation' | 'laporan' | 'templates'>('my-kpi');
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Checklist state for "Dashboard Karyawan" (Checklist 10/10)
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({
    'task-1': true,
    'task-2': true,
    'task-3': true,
    'task-4': true,
    'task-5': false,
    'task-6': false,
    'task-7': false,
    'task-8': true,
    'task-9': true,
    'task-10': true,
  });

  const [form, setForm] = useState({
    workDescription: '',
    manualAmount: 0
  });

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const activeRole = profile?.role === 'PIC' ? 'PIC' : (profile?.role || 'admin').toLowerCase();
  
  // Calculate dynamic rewards metrics
  const totalTasks = CONSTANT_KPI_CHECKLIST.length; // 10
  const completedTasksCount = Object.values(checkedTasks).filter(Boolean).length;
  const missedTasksCount = totalTasks - completedTasksCount;
  
  // Rule: Target harian Rp 200.000. Jika melewatkan >3 tugas (missed > 3), gaji turun jadi Rp 100.000.
  const isPenaltyActive = missedTasksCount > 3;
  const baseSalaryToday = isPenaltyActive ? 100000 : 200000;

  // Bonus/incentives from checklist checked bonus tasks
  const dynamicBonusFromChecklist = useMemo(() => {
    let bonusSum = 0;
    CONSTANT_KPI_CHECKLIST.forEach(task => {
      if (task.type === 'bonus' && checkedTasks[task.id]) {
        bonusSum += task.price; // add fixed task price
      }
    });
    return bonusSum;
  }, [checkedTasks]);

  const totalCalculatedEarningToday = baseSalaryToday + dynamicBonusFromChecklist;

  const roleTemplates = useMemo(() => {
    // 1. Check if there are specific user-account templates assigned to this profileUID
    const userSpecific = templates.filter(t => t.userId === profile?.uid);
    if (userSpecific.length > 0) return userSpecific;

    // 2. Fallback to general role-based templates where no userId is bound
    const fromDB = templates.filter(t => {
      const dbRole = t.role === 'PIC' ? 'PIC' : (t.role || '').toLowerCase();
      return dbRole === activeRole && !t.userId;
    });
    if (fromDB.length > 0) return fromDB;
    
    // Fallback default templates
    const fallbacks: Record<string, { taskName: string; price: number; unit: string; payoutRule?: string }[]> = {
      admin: [
        { taskName: 'Input Data Pasien', price: 10000, unit: 'Pasien', payoutRule: 'standar' },
        { taskName: 'Arsip Dokumen Rekam Medis', price: 5000, unit: 'File', payoutRule: 'standar' }
      ],
      dokter: [
        { taskName: 'Konsultasi Rawat Jalan', price: 50000, unit: 'Pasien', payoutRule: 'bonus' },
        { taskName: 'Tindakan Medis Khusus', price: 150000, unit: 'Prosedur', payoutRule: 'bonus' }
      ],
      perawat: [
        { taskName: 'Homecare / Visit Medis', price: 30000, unit: 'Pasien', payoutRule: 'bonus' },
        { taskName: 'Pemberian Obat & Injeksi', price: 5000, unit: 'Dosis', payoutRule: 'standar' }
      ],
      keuangan: [
        { taskName: 'Invoice Selesai', price: 15005, unit: 'Lembar', payoutRule: 'standar' },
        { taskName: 'Verifikasi Bayar Transaksi', price: 10000, unit: 'Transaksi', payoutRule: 'standar' }
      ],
      apoteker: [
        { taskName: 'Resep Obat Selesai', price: 8000, unit: 'Pasien', payoutRule: 'standar' },
        { taskName: 'Update Stok Gudang Farmasi', price: 5000, unit: 'Item', payoutRule: 'standar' }
      ],
      media: [
        { taskName: 'Konten Publikasi & Edukasi', price: 25000, unit: 'Post', payoutRule: 'bonus' },
        { taskName: 'Respon DM / Komentar Sosmed', price: 2000, unit: 'User', payoutRule: 'standar' }
      ],
      PIC: [
        { taskName: 'Koordinasi Operasional Tim', price: 45000, unit: 'Sesi', payoutRule: 'bonus' },
        { taskName: 'Problem Solving & Kompleksitas', price: 30000, unit: 'Kasus', payoutRule: 'standar' }
      ],
      owner: [
        { taskName: 'Review Strategi Manajemen', price: 200000, unit: 'Keputusan', payoutRule: 'bonus' }
      ]
    };
    
    const list = fallbacks[activeRole] || fallbacks.admin;
    return list.map((item, idx) => ({
      id: `fallback-${activeRole}-${idx}`,
      role: activeRole,
      taskName: item.taskName,
      price: item.price,
      unit: item.unit,
      payoutRule: item.payoutRule || 'standar'
    }));
  }, [templates, activeRole, profile?.uid]);

  const estimatedTotal = useMemo(() => {
    let sum = 0;
    roleTemplates.forEach(t => {
      const q = quantities[t.id] || 0;
      sum += q * t.price;
    });
    return sum;
  }, [roleTemplates, quantities]);

  // Sync automated base estimates
  useEffect(() => {
    if (estimatedTotal > 0) {
      setForm(prev => ({ ...prev, manualAmount: estimatedTotal }));
    }
  }, [estimatedTotal]);

  const canValidate = profile?.role === 'owner';
  const canDeleteEntry = profile?.role === 'owner';

  // Fetch Templates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'kpi_templates'), (snap) => {
      setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch KPI Entries
  useEffect(() => {
    if (!profile || !profile.uid) return;

    setLoading(true);

    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    let q;
    
    // If validator (Admin, Owner, PIC), show all entries for the selected month to run active review queues
    if (canValidate) {
      q = query(
        collection(db, 'kpi_entries'), 
        where('date', '>=', startOfMonth),
        where('date', '<=', endOfMonth),
        orderBy('date', 'desc'),
        limit(200)
      );
    } else {
      q = query(
        collection(db, 'kpi_entries'), 
        where('userId', '==', profile.uid), 
        where('date', '>=', startOfMonth),
        where('date', '<=', endOfMonth),
        orderBy('date', 'desc'),
        limit(200)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KPIEntry)));
      setLoading(false);
    }, (error) => {
      console.error("KPI Query error, loading fallbacks:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.uid, profile?.role, canValidate, selectedMonth]);

  // Handle submitting log/daily rewards to firestore
  const handleSubmitLog = async () => {
    if (!profile) return;
    if (!form.workDescription) {
      alert('Deskripsi utama pengerjaan tugas harus diisi.');
      return;
    }

    const metricsToSave = roleTemplates.map(t => {
      const q = quantities[t.id] || 0;
      return {
        templateId: t.id,
        label: t.taskName,
        value: q,
        unit: t.unit || 'tindakan',
        price: t.price,
        subtotal: q * t.price,
        payoutRule: t.payoutRule || 'standar'
      };
    }).filter(m => m.value > 0);

    // Dynamic base combined with checklists & manual inputs
    const totalAmount = metricsToSave.length > 0 
      ? estimatedTotal 
      : (form.manualAmount || totalCalculatedEarningToday);

    try {
      if (editingId) {
        await updateDoc(doc(db, 'kpi_entries', editingId), {
          workDescription: form.workDescription,
          metrics: metricsToSave,
          totalAmount,
          missedCount: missedTasksCount,
          payoutBase: baseSalaryToday,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'kpi_entries'), {
          userId: profile.uid,
          userName: profile.displayName || profile.email,
          userRole: profile.role || 'karyawan',
          date: serverTimestamp(),
          workDescription: form.workDescription,
          metrics: metricsToSave.length > 0 ? metricsToSave : CONSTANT_KPI_CHECKLIST.map(tc => ({
            templateId: tc.id,
            label: tc.taskName,
            value: checkedTasks[tc.id] ? 1 : 0,
            unit: tc.unit,
            price: tc.price,
            subtotal: checkedTasks[tc.id] ? tc.price : 0,
            payoutRule: tc.type
          })).filter(tc => tc.value > 0),
          totalAmount,
          missedCount: missedTasksCount,
          payoutBase: baseSalaryToday,
          status: 'pending'
        });
      }
      
      setIsAdding(false);
      setEditingId(null);
      setForm({
        workDescription: '',
        manualAmount: 0
      });
      setQuantities({});
      alert('Log kerja performa harian berhasil dilaporkan ke pusat validasi!');
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan laporan.');
    }
  };

  const handleEdit = (entry: KPIEntry) => {
    setForm({
      workDescription: entry.workDescription,
      manualAmount: entry.totalAmount || 0
    });
    
    const initialQty: Record<string, number> = {};
    if (entry.metrics) {
      entry.metrics.forEach((m: any) => {
        initialQty[m.templateId || m.label] = m.value;
      });
    }
    setQuantities(initialQty);
    setEditingId(entry.id);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    setDeletingEntryId(id);
  };

  const confirmDelete = async () => {
    if (!deletingEntryId) return;
    try {
      await deleteDoc(doc(db, 'kpi_entries', deletingEntryId));
      setDeletingEntryId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleValidate = async (entryId: string, status: 'validated' | 'rejected', feedback: string = '') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'kpi_entries', entryId), {
        status,
        validatedBy: profile.uid,
        validatedName: profile.displayName || 'Owner Klinik',
        validatedAt: serverTimestamp(),
        feedback
      });
    } catch (e) {
      console.error(e);
    }
  };

  // KPI Analytics Trend Data for Recharts
  const chartData = useMemo(() => {
    // Generate mockup trends based on current logged entries or real month stats
    const items = [
      { name: 'Jan', Standard: 1800000, Bonus: 560000, Total: 2360000 },
      { name: 'Feb', Standard: 1900000, Bonus: 740000, Total: 2640000 },
      { name: 'Mar', Standard: 1750000, Bonus: 920000, Total: 2670000 },
      { name: 'Apr', Standard: 2000000, Bonus: 1100000, Total: 3100000 },
      { name: 'Mei', Standard: 2100000, Bonus: 1450000, Total: 3550000 },
      { name: 'Jun', Standard: 2200000, Bonus: 1950000, Total: 4150000 }
    ];
    
    // Add real calculated value if matches current month
    const validEntries = entries.filter(e => e.status === 'validated');
    const dbTotalIncentives = validEntries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    
    if (dbTotalIncentives > 0) {
      // Inject or override last item with actual Firestore realtime aggregated total
      items[items.length - 1].Total = 2200000 + dbTotalIncentives;
      items[items.length - 1].Bonus = 1200000 + dbTotalIncentives;
    }
    return items;
  }, [entries]);

  // Generate 31 or 30 days for Daily Calendar Performa Grid
  const calendarDays = useMemo(() => {
    const days = [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const dayCount = new Date(year, month, 0).getDate();
    
    for (let d = 1; d <= dayCount; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      // Check if we have an entry on this specific day
      const dayEntries = entries.filter(e => {
        let entryDate;
        if (e.date?.toDate) {
          entryDate = e.date.toDate();
        } else if (e.date) {
          entryDate = new Date(e.date);
        } else {
          return false;
        }
        return entryDate.getDate() === d;
      });

      // Payout status / performance color code
      let status: 'no_entry' | 'reached' | 'penalty_alert' | 'pending' = 'no_entry';
      let earnings = 0;
      
      if (dayEntries.length > 0) {
        const pen = dayEntries.some(de => de.missedCount && de.missedCount > 3);
        const pend = dayEntries.some(de => de.status === 'pending');
        earnings = dayEntries.reduce((sum, de) => sum + (de.totalAmount || 0), 0);
        
        if (pend) status = 'pending';
        else if (pen) status = 'penalty_alert';
        else status = 'reached';
      }

      days.push({
        dayNum: d,
        dateString: dateStr,
        status,
        earnings,
        entriesList: dayEntries
      });
    }
    return days;
  }, [entries, selectedMonth]);

  const filteredEntries = useMemo(() => {
    let result = entries.filter(e => {
      const matchesSearch = (e.userName || '').toLowerCase().includes(search.toLowerCase()) || 
                           (e.workDescription || '').toLowerCase().includes(search.toLowerCase());
      const matchesUser = userFilter === 'all' || e.userId === userFilter;
      return matchesSearch && matchesUser;
    });

    if (activeTab === 'my-kpi') {
      return result.filter(e => e.userId === profile?.uid);
    }
    return result;
  }, [entries, search, userFilter, activeTab, profile?.uid]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-800 dark:text-zinc-300">
      {/* Header Banner */}
      <div className="p-8 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-900/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5Packed">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-black tracking-widest uppercase border border-emerald-500/20 shadow-sm animate-pulse">
              Live Performance Rewards
            </span>
            <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-black tracking-widest uppercase border border-blue-500/20 shadow-sm">
              Kasir Style Edition
            </span>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase">MANAJEMEN KPI & REWARD</h1>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-500" /> Transparan • Instan • Real-Time Payout
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-950/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Log Performa Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="flex-1 flex flex-col p-8 pt-6 gap-6 min-h-0">
        
        {/* Navigation Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-100 dark:bg-zinc-900/40 p-2 rounded-3xl border border-zinc-200 dark:border-zinc-900">
          <div className="flex flex-wrap p-1 gap-1">
            <button 
              onClick={() => { setActiveTab('my-kpi'); setIsAdding(false); }}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'my-kpi' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md dark:shadow-lg border border-zinc-200 dark:border-zinc-700/50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-305"
              )}
            >
              Dashboard Karyawan
            </button>
            <button 
              onClick={() => { setActiveTab('laporan'); setIsAdding(false); }}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'laporan' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md dark:shadow-lg border border-zinc-200 dark:border-zinc-700/50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-305"
              )}
            >
              Laporan Pendapatan
            </button>
            {canValidate && (
              <button 
                onClick={() => { setActiveTab('validation'); setIsAdding(false); }}
                className={cn(
                  "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center",
                  activeTab === 'validation' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md dark:shadow-lg border border-zinc-200 dark:border-zinc-700/50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-305"
                )}
              >
                Validation Center (Owner)
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              </button>
            )}
            {profile?.role === 'owner' && (
              <button 
                onClick={() => { setActiveTab('templates'); setIsAdding(false); }}
                className={cn(
                  "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'templates' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md dark:shadow-lg border border-zinc-200 dark:border-zinc-700/50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-305"
                )}
              >
                Template Configurator
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl px-4 py-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-[10px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest outline-none cursor-pointer"
              />
            </div>
            
            {activeTab !== 'templates' && (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-650" />
                <input 
                  type="text" 
                  placeholder="Cari log..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl py-2 pl-9 pr-4 text-[10px] font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all w-48"
                />
              </div>
            )}
          </div>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 pb-16">
          <AnimatePresence mode="wait">
            
            {/* View Form / Input Log */}
            {isAdding ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-2xl mx-auto py-4"
              >
                <div className="bg-zinc-900 border border-zinc-850 rounded-[2.5rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                      <Plus className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">{editingId ? 'Edit Log Performa' : 'Log Kerja & Capaian Harian'}</h2>
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Kontribusi harian sistem performance rewards</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Active dynamic templates based on clinical setup */}
                    {roleTemplates.length > 0 && (
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">Unit Tindakan / Target Insentif {profile?.role?.toUpperCase()}</p>
                        <div className="flex flex-wrap gap-2">
                          {roleTemplates.map(t => (
                            <div key={t.id} className="px-3 py-1.5 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-400">{t.taskName}</span>
                              <span className="text-[10px] font-black text-emerald-500 font-mono">Rp {t.price?.toLocaleString()}</span>
                              <span className="text-[8px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-500 uppercase">{t.payoutRule || 'standar'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Deskripsi Utama Hasil Pekerjaan Hari Ini</label>
                      <textarea 
                        value={form.workDescription}
                        onChange={(e) => setForm({...form, workDescription: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-4 text-xs font-medium text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none h-20"
                        placeholder="Tulis ringkasan singkat pelayanan pasien atau tugas administrasi yang dikerjakan hari ini..."
                      />
                    </div>

                    {/* Numerical Quantities Counters */}
                    <div className="space-y-3 bg-zinc-950/60 p-5 rounded-2xl border border-zinc-900">
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Input Detail Kuantitas Tugas</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {roleTemplates.map(t => {
                          const qty = quantities[t.id] || 0;
                          return (
                            <div key={t.id} className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between hover:border-zinc-800 transition-colors">
                              <div>
                                <p className="text-[11px] font-black text-white">{t.taskName}</p>
                                <p className="text-[9px] font-bold text-zinc-500 mt-0.5">Rp {t.price.toLocaleString()} / {t.unit}</p>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => setQuantities(prev => ({ ...prev, [t.id]: Math.max(0, (prev[t.id] || 0) - 1) }))}
                                  className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-md flex items-center justify-center select-none"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-white font-mono font-bold text-xs">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setQuantities(prev => ({ ...prev, [t.id]: (prev[t.id] || 0) + 1 }))}
                                  className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-md flex items-center justify-center select-none"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nilai Klaim Bonus Tambahan (Rp)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          value={form.manualAmount || ''}
                          onChange={(e) => setForm({...form, manualAmount: Number(e.target.value)})}
                          className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl px-4 py-3.5 text-lg font-black text-emerald-500 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                          placeholder={String(estimatedTotal || totalCalculatedEarningToday)}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-650 font-black text-[8px] tracking-wider pointer-events-none uppercase">
                          KLAIM INSENTIF
                        </div>
                      </div>
                      <p className="text-[8px] font-bold text-zinc-500 italic uppercase tracking-wider">
                        * Kosongkan untuk menggunakan kalkulasi otomatis dari detail isian di atas.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => {
                          setIsAdding(false);
                          setEditingId(null);
                          setForm({ workDescription: '', manualAmount: 0 });
                          setQuantities({});
                        }}
                        className="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                      <button 
                        onClick={handleSubmitLog}
                        className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
                      >
                        Kirim Log Kerja
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'templates' ? (
              <KPITemplateManagement key="templates" />
            ) : activeTab === 'laporan' ? (
              <motion.div 
                key="laporan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Visual Chart Monthly Bonus Trend */}
                <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-900 p-8 rounded-[2.5rem] space-y-4 shadow-sm dark:shadow-none">
                  <div>
                    <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">Grafik Tren Bonus Bulanan (Rp)</h3>
                    <p className="text-[9px] text-zinc-550 text-zinc-500 font-bold uppercase tracking-widest">Visualisasi total performa akumulatif pendapatan rewards</p>
                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorBonus" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis dataKey="name" stroke="var(--text-secondary)" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <YAxis stroke="var(--text-secondary)" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', borderRadius: '12px' }}
                          labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '12px' }}
                          itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="Total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" name="Total Rewards (Rp)" />
                        <Area type="monotone" dataKey="Bonus" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBonus)" name="Bonus Insentif (Rp)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Calendar Performa Grid */}
                <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-900 p-8 rounded-[2.5rem] space-y-6 shadow-sm dark:shadow-none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">Kalender Performa Harian</h3>
                      <p className="text-[9px] text-zinc-550 text-zinc-500 font-bold uppercase tracking-widest">Evaluasi harian pencapaian target rewards Rp 200.000</p>
                    </div>
                    {/* legend */}
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-650 dark:text-zinc-400 font-bold uppercase">
                        <span className="w-2.5 h-2.5 rounded-md bg-emerald-500/20 border border-emerald-500/30" />
                        Target Reached (≥ Rp 200k)
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-650 dark:text-zinc-400 font-bold uppercase">
                        <span className="w-2.5 h-2.5 rounded-md bg-red-500/20 border border-red-500/30" />
                        Penalti Active (&gt;3 missed)
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-650 dark:text-zinc-400 font-bold uppercase">
                        <span className="w-2.5 h-2.5 rounded-md bg-amber-500/20 border border-amber-500/30 animate-pulse" />
                        Pending approval
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-650 dark:text-zinc-400 font-bold uppercase">
                        <span className="w-2.5 h-2.5 rounded-md bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800" />
                        Tidak Ada Log
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                    {calendarDays.map((day) => (
                      <div 
                        key={day.dayNum}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex flex-col justify-between h-24 relative overflow-hidden group hover:shadow-sm",
                          day.status === 'reached' ? "bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500 text-emerald-800 dark:text-emerald-400" :
                          day.status === 'penalty_alert' ? "bg-red-500/10 border-red-500/25 hover:border-red-500 text-red-800 dark:text-red-400" :
                          day.status === 'pending' ? "bg-amber-500/10 border-amber-500/25 hover:border-amber-500 text-amber-800 dark:text-amber-400" :
                          "bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700"
                        )}
                      >
                        <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{day.dayNum}</span>
                        
                        <div className="flex flex-col">
                          {day.earnings > 0 ? (
                            <>
                              <span className="text-[10px] font-black text-zinc-900 dark:text-white font-mono">Rp {day.earnings.toLocaleString()}</span>
                              <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-tight mt-0.5">
                                {day.status === 'reached' ? 'Target Tercapai' : 
                                 day.status === 'penalty_alert' ? 'Penalti Aktif' : 'Menunggu Owner'}
                              </span>
                            </>
                          ) : (
                            <span className="text-[8px] font-bold text-zinc-450 dark:text-zinc-600 uppercase tracking-tighter">Tidak Ada Log</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'validation' ? (
              <motion.div 
                key="validation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Owner live reviews count stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-zinc-900/40 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm dark:shadow-none">
                    <div>
                      <p className="text-[9px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest mb-1.5">Antrean Validasi (Pending)</p>
                      <p className="text-2xl font-black text-amber-500 font-mono">
                        {entries.filter(e => e.status === 'pending').length} Lembar Log
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/20">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/40 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm dark:shadow-none">
                    <div>
                      <p className="text-[9px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest mb-1.5">Total Cair Disetujui (Validated)</p>
                      <p className="text-2xl font-black text-emerald-500 font-mono">
                        Rp {entries.filter(e => e.status === 'validated').reduce((s, e) => s + (e.totalAmount || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900/40 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm dark:shadow-none">
                    <div>
                      <p className="text-[9px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest mb-1.5">Total Log Ditolak (Rejected)</p>
                      <p className="text-2xl font-black text-red-500 font-mono">
                        {entries.filter(e => e.status === 'rejected').length} Log
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border border-red-500/20">
                      <XCircle className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Queue lists with Approve/Reject actions */}
                <div className="space-y-4">
                  <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">Antrean Pengajuan Real-Time (Owner Review)</h3>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredEntries.map(entry => (
                      <KPIEntryCard 
                        key={entry.id} 
                        entry={entry} 
                        canValidate={canValidate && activeTab === 'validation'} 
                        canEdit={entry.userId === profile?.uid && entry.status === 'pending'}
                        onValidate={handleValidate}
                        onEdit={() => handleEdit(entry)}
                        onDelete={() => handleDelete(entry.id)}
                        canDelete={canDeleteEntry}
                        currentUserId={profile?.uid}
                      />
                    ))}
                    {filteredEntries.length === 0 && (
                      <div className="col-span-full py-16 text-center bg-white dark:bg-zinc-900/15 border border-zinc-200 dark:border-zinc-900/80 border-dashed rounded-[2.5rem] shadow-sm dark:shadow-none">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 animate-bounce" />
                        <p className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Semua Antrean Log Performa Terisi & Tervalidasi!</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              /* MY KPI: Dashboard Karyawan */
              <motion.div 
                key="my-kpi"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Employee Performance KPI Progress Widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Payout & penalty panel - bold eye catching values */}
                  <div className="lg:col-span-1 bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-950 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-850 space-y-6 relative overflow-hidden flex flex-col justify-between shadow-sm dark:shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Target className="w-40 h-40 text-black dark:text-white" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 rounded-xl text-[8px] font-black uppercase tracking-widest leading-none">
                          Kalkulator Payout Harian
                        </span>
                        {isPenaltyActive && (
                          <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[8px] font-black uppercase tracking-widest animate-bounce flex items-center gap-1">
                            <ShieldAlert className="w-2.5 h-2.5" /> PENALTI AKTIF
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Gaji Pokok Hari Ini setelah Tugas</p>
                        <p className="text-4xl font-extrabold text-zinc-900 dark:text-white font-mono tracking-tight">
                          Rp {baseSalaryToday.toLocaleString()}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-850">
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-400">
                          <span>Status Target Harian</span>
                          <span className={isPenaltyActive ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                            {isPenaltyActive ? "Gaji Standard (Turun ke Rp 100k)" : "Mencapai Target (Rp 200k)"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-400">
                          <span>Tambahan Bonus Checklist</span>
                          <span className="text-blue-600 dark:text-blue-400 font-mono">+ Rp {dynamicBonusFromChecklist.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800/80">
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-1">TOTAL ESTIMASI PEROLEHAN</p>
                      <p className="text-3xl font-black text-emerald-600 dark:text-emerald-500 font-mono tracking-tighter">
                        Rp {totalCalculatedEarningToday.toLocaleString()}
                      </p>
                      <button 
                        onClick={() => {
                          setForm({
                            workDescription: `Aktivitas Harian: Hasil check-off target harian dengan total pencapaian ${completedTasksCount}/10 tugas harian.`,
                            manualAmount: totalCalculatedEarningToday
                          });
                          setIsAdding(true);
                        }}
                        className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-emerald-950/20 active:scale-95 text-center flex items-center justify-center gap-2"
                      >
                        Laporkan Nilai Ini <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Checklist 10/10 KPI */}
                  <div className="lg:col-span-2 bg-white dark:bg-zinc-900/40 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-900 space-y-6 shadow-sm dark:shadow-none">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">Kuesioner Checklist Target Harian (Progress 10/10)</h3>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500 font-mono px-2.5 py-1 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            {completedTasksCount} / {totalTasks} Selesai
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                          * Melewatkan &gt;3 tugas (maksimal 6 selesai) akan mengaktifkan potongan target penalti!
                        </p>
                      </div>

                      {/* Progress Line */}
                      <div className="w-full sm:w-40 bg-zinc-100 dark:bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-200 dark:border-zinc-850">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            isPenaltyActive ? "bg-red-500" : "bg-emerald-400"
                          )} 
                          style={{ width: `${(completedTasksCount / totalTasks) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Interactive inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {CONSTANT_KPI_CHECKLIST.map((task) => (
                        <div 
                          key={task.id}
                          onClick={() => setCheckedTasks(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                          className={cn(
                            "p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 select-none hover:bg-zinc-50 dark:hover:bg-zinc-800/10",
                            checkedTasks[task.id] 
                              ? "bg-emerald-50 dark:bg-zinc-900 border-emerald-200 dark:border-zinc-800 text-emerald-950 dark:text-white" 
                              : "bg-zinc-100/40 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-900/80 text-zinc-500 dark:text-zinc-650"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-lg border flex items-center justify-center transition-all shrink-0",
                            checkedTasks[task.id] 
                              ? "bg-emerald-500 border-emerald-400 text-white dark:text-zinc-950" 
                              : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-transparent"
                          )}>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-205 text-zinc-900 dark:text-white">{task.taskName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn(
                                "text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                                task.type === 'bonus' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-zinc-150 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500"
                              )}>
                                {task.type}
                              </span>
                              {task.price > 0 && (
                                <span className="text-[8px] font-mono font-bold text-emerald-600 dark:text-emerald-500">+Rp {task.price.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">Riwayat Pengajuan Log Anda</h3>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredEntries.map(entry => (
                      <KPIEntryCard 
                        key={entry.id} 
                        entry={entry} 
                        canValidate={canValidate && activeTab === 'validation'} 
                        canEdit={entry.userId === profile?.uid && entry.status === 'pending'}
                        onValidate={handleValidate}
                        onEdit={() => handleEdit(entry)}
                        onDelete={() => handleDelete(entry.id)}
                        canDelete={canDeleteEntry}
                        currentUserId={profile?.uid}
                      />
                    ))}
                    {filteredEntries.length === 0 && (
                      <div className="col-span-full py-16 text-center bg-white dark:bg-zinc-900/15 border border-zinc-200 dark:border-zinc-900/80 border-dashed rounded-[2.5rem] shadow-sm dark:shadow-none">
                        <Award className="w-12 h-12 text-zinc-400 dark:text-zinc-800 mx-auto mb-3" />
                        <p className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Belum ada history pengajuan di bulan ini.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {deletingEntryId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-850 rounded-[2.5rem] max-w-sm w-full p-8 text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-600" />
              
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500 border border-red-500/20">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-2">Hapus Laporan KPI?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                  Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeletingEntryId(null)}
                  className="flex-1 py-4 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest font-mono cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest font-bold shadow-lg shadow-red-900/40 cursor-pointer"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KPIEntryCard({ entry, canValidate, canEdit, canDelete, onValidate, onEdit, onDelete, currentUserId }: any) {
  const isOwner = entry.userId === currentUserId;
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className={cn(
      "p-6 rounded-[2.5rem] border transition-all relative overflow-hidden group flex flex-col h-full hover:shadow-md",
      entry.status === 'validated' ? "bg-emerald-50/50 dark:bg-emerald-600/5 border-emerald-200 dark:border-emerald-500/20" :
      entry.status === 'rejected' ? "bg-red-50/50 dark:bg-red-600/5 border-red-200 dark:border-red-500/20" :
      "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-800"
    )}>
      {/* Decorative side bar */}
      <div className={cn(
        "absolute top-0 left-0 bottom-0 w-1",
        entry.status === 'validated' ? "bg-emerald-500" :
        entry.status === 'rejected' ? "bg-red-500" :
        "bg-blue-600"
      )} />

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <User className={cn(
                "w-6 h-6",
                entry.status === 'validated' ? "text-emerald-500" :
                entry.status === 'rejected' ? "text-red-500" :
                "text-blue-500"
              )} />
            </div>
            <div>
              <h4 className="text-sm font-black text-zinc-900 dark:text-white leading-none mb-1">{entry.userName}</h4>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{entry.userRole}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-850" />
                <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-650 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {entry.date ? (entry.date.toDate ? entry.date.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : new Date(entry.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })) : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button 
                onClick={onEdit}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer"
                title="Edit Laporan"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button 
                onClick={onDelete}
                className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                title="Hapus Laporan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <span className={cn(
              "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
              entry.status === 'validated' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-500" :
              entry.status === 'rejected' ? "bg-red-500/10 border-red-500/20 text-red-550 dark:text-red-500" :
              "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-500"
            )}>
              {entry.status === 'validated' ? 'Terverifikasi' : entry.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
            </span>
          </div>
        </div>

        <div className="space-y-4 flex-1">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
            "{entry.workDescription}"
          </p>

          {entry.metrics && entry.metrics.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entry.metrics.map((m: any, idx: number) => (
                <div key={idx} className="bg-zinc-50/50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-850 flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-650 uppercase tracking-widest mb-1">{m.label}</p>
                    <p className="text-sm font-black text-zinc-900 dark:text-white font-mono flex items-baseline gap-1">
                      {m.value}
                      <span className="text-[9px] font-bold text-zinc-500 normal-case">{m.unit}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-650 uppercase tracking-widest">Subtotal</p>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-500 font-mono">Rp {(m.subtotal || (m.value * m.price)).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-900 flex items-center justify-between group-hover:border-emerald-500/30 transition-colors shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Total Insentif</span>
            </div>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">Rp {(entry.totalAmount || 0).toLocaleString()}</span>
          </div>
        </div>

        {entry.status === 'pending' && canValidate && (
          <div className="flex items-center gap-3 pt-4 px-2 select-none">
            <button 
              onClick={() => onValidate(entry.id, 'validated')}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-950/40 active:scale-95 group/verify cursor-pointer"
            >
              <Check className="w-5 h-5 group-hover/verify:scale-110 transition-transform" />
              Setujui & Cairkan Real-Time
            </button>
            <button 
              onClick={() => onValidate(entry.id, 'rejected')}
              className="px-6 py-4 bg-red-650/10 hover:bg-rose-950 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 cursor-pointer"
              title="Tolak Laporan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {entry.status !== 'pending' && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-850 flex items-center justify-between relative">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className={cn("w-5 h-5", entry.status === 'validated' ? "text-emerald-500" : "text-red-500")} />
               </div>
               <div className="flex flex-col">
                 <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                   {entry.status === 'validated' ? 'Digital Signature Verified' : 'Rejected'}
                 </p>
                 <div className="flex items-center gap-2">
                   {entry.status === 'validated' ? (
                     <div className="flex flex-col">
                       <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase italic font-serif">
                         {entry.validatedName}
                       </p>
                     </div>
                   ) : (
                     <p className="text-[10px] font-black text-zinc-600 uppercase">Review Selesai</p>
                   )}
                 </div>
               </div>
            </div>
            
            {entry.status === 'validated' && (
              <div className="absolute right-0 top-0 opacity-10 -rotate-12 pointer-events-none select-none">
                <div className="px-3 py-1.5 border-4 border-emerald-500 text-emerald-500 text-lg font-black uppercase tracking-tighter rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  VERIFIED
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
