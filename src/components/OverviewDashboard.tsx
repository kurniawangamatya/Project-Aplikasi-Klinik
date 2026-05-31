import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, orderBy, where, getDocs, handleFirestoreError, OperationType, limit, collectionGroup } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Board, SaleTransaction, Card } from '../types';
import { subMonths } from 'date-fns';
import { motion } from 'motion/react';
import { useData } from '../contexts/DataContext';
import { 
  LayoutDashboard, Users, Briefcase, Package, DollarSign, Clock, 
  BarChart3, Stethoscope, Activity, ArrowRight, TrendingUp, 
  TrendingDown, CheckCircle2, AlertCircle, Layers
} from 'lucide-react';

interface OverviewDashboardProps {
  setTab: (t: string) => void;
  boards: Board[];
  setCurrentBoardId: (id: string) => void;
}

export default function OverviewDashboard({ setTab, boards, setCurrentBoardId }: OverviewDashboardProps) {
  const { profile } = useAuth();
  const { allTodayAttendance, todayAttendance } = useData();
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [expenses, setExpenses] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const attendanceTodayCount = useMemo(() => {
    if (['admin', 'owner', 'keuangan'].includes(profile?.role || '')) {
      return allTodayAttendance.length;
    }
    return todayAttendance ? 1 : 0;
  }, [allTodayAttendance, todayAttendance, profile?.role]);

  useEffect(() => {
    if (!profile) return;

    // Sales Query - Role based - Limit to 1 month and 50 results for the overview
    const oneMonthAgo = subMonths(new Date(), 1);
    const salesQ = query(
      collection(db, 'sales'), 
      where('createdAt', '>=', oneMonthAgo),
      orderBy('createdAt', 'desc'),
      limit(150)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      let filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleTransaction));
      
      // Only clinic owner gets to see collective clinical financial overview.
      // Other roles are strictly restricted to their own associated records so they cannot see other's revenue/earnings.
      if (profile.role !== 'owner') {
        const filterField = profile.role === 'dokter' ? 'doctorId' : (profile.role === 'perawat' ? 'nurseId' : 'createdBy');
        filtered = filtered.filter(s => (s as any)[filterField] === profile.uid);
      }
      
      setSales(filtered.slice(0, 50));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'sales');
    });

    // Expenses using collectionGroup for much better performance
    const fetchExpenses = async () => {
      try {
        const q = query(
          collectionGroup(db, 'cards'),
          where('type', '==', 'expense'),
          where('updatedAt', '>=', oneMonthAgo),
          limit(200)
        );
        const cardsSnap = await getDocs(q);
        setExpenses(cardsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as any)));
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    if (profile.role !== 'owner') {
      setExpenses([]);
      setLoading(false);
    } else {
      fetchExpenses();
    }
    return () => {
      unsubSales();
    };
  }, [profile]); // Removed boards and canValidate from dependency array to avoid re-triggering queries unnecessarily

  const totalRevenue = useMemo(() => sales.reduce((acc, s) => acc + s.total, 0), [sales]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, e) => acc + (e.amount || 0), 0), [expenses]);
  const recentSales = useMemo(() => sales.slice(0, 5), [sales]);
  
  const patientsCount = useMemo(() => {
    const uniquePatients = new Set(sales.map(s => `${s.customerName}_${s.customerPhone}`));
    return uniquePatients.size;
  }, [sales]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-10 h-10 border-2 border-zinc-200 dark:border-zinc-800 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-6 md:p-10 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
        {/* Header */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tighter mb-2 italic">Dashboard Overview</h2>
          <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs">Ringkasan Sistem & Operasional Real-time</p>
        </div>

        {/* Core Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <SummaryCard 
            title="Total Pendapatan"
            value={`Rp ${totalRevenue.toLocaleString()}`}
            subtitle="Akumulasi Kasir"
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            onClick={() => setTab('analytics')}
            color="emerald"
          />
          <SummaryCard 
            title="Total Pengeluaran"
            value={`Rp ${totalExpenses.toLocaleString()}`}
            subtitle="Operasional & Medis"
            icon={<TrendingDown className="w-5 h-5 text-red-500" />}
            onClick={() => setTab('analytics')}
            color="red"
          />
          <SummaryCard 
            title="Total Pasien"
            value={patientsCount.toString()}
            subtitle="Pasien Terdaftar"
            icon={<Users className="w-5 h-5 text-blue-500" />}
            onClick={() => setTab('patient-data')}
            color="blue"
          />
          <SummaryCard 
            title="Kehadiran Hari Ini"
            value={attendanceTodayCount.toString()}
            subtitle="Staff Standby"
            icon={<Clock className="w-5 h-5 text-purple-500" />}
            onClick={() => setTab('attendance')}
            color="purple"
          />
        </div>

        {/* Navigation Hub & Direct Links */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          <div className="lg:col-span-8 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm">
                    <Layers className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">Clinic Boards</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Papan Strategis Aktif</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {boards.map(board => (
                  <button 
                    key={board.id}
                    onClick={() => {
                      setCurrentBoardId(board.id);
                      setTab('board');
                    }}
                    className="group bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 transition-all hover:border-blue-500/50 text-left relative overflow-hidden shadow-sm"
                  >
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Package className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-zinc-200 dark:text-zinc-800 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{board.name}</h4>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold uppercase mt-1">Sistem Pelacakan Keuangan</p>
                    </div>
                    <div className="absolute -bottom-6 -right-6 opacity-[0.02] dark:opacity-[0.05] group-hover:opacity-[0.05] transition-opacity">
                      <Package className="w-40 h-40" />
                    </div>
                  </button>
                ))}
                {boards.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 py-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] sm:rounded-[3rem]">
                    <AlertCircle className="w-10 h-10 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-400 dark:text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Belum ada papan tersedia</p>
                  </div>
                )}
              </div>
            </section>

            <section>
               <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm">
                  <Activity className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">Modul Operasional</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Akses Cepat System</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <ModuleLink icon={<Briefcase />} label="Kasir" onClick={() => setTab('finance')} />
                <ModuleLink icon={<DollarSign />} label="Payroll" onClick={() => setTab('payroll')} />
                <ModuleLink icon={<Activity />} label="Visibilitas" onClick={() => setTab('analytics')} />
                <ModuleLink icon={<Users />} label="Pusat Tim" onClick={() => setTab('team')} />
                <ModuleLink icon={<Stethoscope />} label="Dokter" onClick={() => setTab('doctor-report')} />
                <ModuleLink icon={<Package />} label="Inventaris" onClick={() => setTab('analytics')} />
                <ModuleLink icon={<Clock />} label="Absensi" onClick={() => setTab('attendance')} />
                <ModuleLink icon={<Package />} label="Pusat Data" onClick={() => setTab('patient-data')} />
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none space-y-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12 translate-x-1/4 -translate-y-1/4">
                <DollarSign className="w-64 h-64" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-6">Penjualan Terkini</h3>
                <div className="space-y-4">
                  {recentSales.map(sale => (
                    <div key={sale.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-colors">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-zinc-900 dark:text-white">{sale.customerName}</p>
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString() : new Date(sale.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-500">Rp {(sale.total || 0).toLocaleString()}</span>
                    </div>
                  ))}
                  <button 
                    onClick={() => setTab('finance')}
                    className="w-full mt-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-100 dark:border-zinc-800 rounded-xl transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Lihat Semua Transaksi
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setTab('analytics')}>
              <div className="relative z-10">
                <TrendingUp className="w-12 h-12 text-white/20 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-black text-white tracking-tighter leading-tight mb-2">Analisis Visual & Pertumbuhan</h3>
                <p className="text-blue-100/60 font-bold uppercase text-[9px] tracking-widest">Optimalkan Performa Clinic</p>
                <div className="mt-8 flex items-center gap-2 text-white">
                  <span className="text-xs font-black uppercase italic">Mulai Analisis</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, onClick, color }: { title: string, value: string, subtitle: string, icon: React.ReactNode, onClick: () => void, color: 'emerald' | 'red' | 'blue' | 'purple' }) {
  const colorMap = {
    emerald: 'hover:border-emerald-500/30',
    red: 'hover:border-red-500/30',
    blue: 'hover:border-blue-500/30',
    purple: 'hover:border-purple-500/30'
  };

  return (
    <button 
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] text-left transition-all group relative overflow-hidden shadow-sm shadow-zinc-200/50 dark:shadow-none ${colorMap[color]}`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800 group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-200 dark:text-zinc-800 group-hover:text-zinc-500 group-hover:translate-x-1 transition-all" />
        </div>
        <h4 className="text-[9px] sm:text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mb-1 truncate">{value}</p>
        <p className="text-[8px] sm:text-[9px] text-zinc-400 dark:text-zinc-600 font-bold uppercase">{subtitle}</p>
      </div>
    </button>
  );
}

function ModuleLink({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 sm:p-6 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-[1.5rem] sm:rounded-[2.5rem] gap-2 sm:gap-3 group transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:scale-105 shadow-sm shadow-zinc-200/50 dark:shadow-none"
    >
      <div className="text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500 transition-colors scale-110 sm:scale-125">
        {icon}
      </div>
      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{label}</span>
    </button>
  );
}
