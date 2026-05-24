import React, { useState, useEffect, useMemo } from 'react';
import KPITemplateManagement from './KPITemplateManagement';
import { db, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, handleFirestoreError, OperationType, where, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { subDays } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Plus, Filter, Search, Award, Target, TrendingUp, User, Calendar, Check, X, Eye, Edit3, BarChart3, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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
  history?: any[];
}

const DEFAULT_METRICS: Record<string, { label: string; unit: string }[]> = {
  admin: [
    { label: 'Input Data', unit: 'Pasien' },
    { label: 'Arsip Dokumen', unit: 'File' }
  ],
  dokter: [
    { label: 'Konsultasi', unit: 'Pasien' },
    { label: 'Tindakan Medis', unit: 'Prosedur' }
  ],
  perawat: [
    { label: 'Homecare/Visit', unit: 'Pasien' },
    { label: 'Pemberian Obat', unit: 'Dosis' }
  ],
  keuangan: [
    { label: 'Invoice Selesai', unit: 'Lembar' },
    { label: 'Verifikasi Bayar', unit: 'Transaksi' }
  ],
  apoteker: [
    { label: 'Resep Selesai', unit: 'Pasien' },
    { label: 'Update Stok', unit: 'Item' }
  ],
  media: [
    { label: 'Konten Publikasi', unit: 'Post' },
    { label: 'Respon DM/Komentar', unit: 'User' }
  ],
  PIC: [
    { label: 'Koordinasi Tim', unit: 'Sesi' },
    { label: 'Problem Solving', unit: 'Kasus' }
  ],
  owner: [
    { label: 'Review Strategi', unit: 'Keputusan' }
  ]
};

export default function KPICenter() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<KPIEntry[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-kpi' | 'validation' | 'templates'>('my-kpi');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [form, setForm] = useState({
    workDescription: '',
    manualAmount: 0
  });

  const canValidate = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'PIC';
  const canDeleteEntry = profile?.role === 'admin' || profile?.role === 'owner';

  // Fetch Templates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'kpi_templates'), (snap) => {
      setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!profile || !profile.uid) return;

    setLoading(true);

    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    let q;
    
    // If validator (Admin, Owner, PIC), show all entries for the selected month
    if (canValidate) {
      q = query(
        collection(db, 'kpi_entries'), 
        where('date', '>=', startOfMonth),
        where('date', '<=', endOfMonth),
        orderBy('date', 'desc'),
        limit(200)
      );
    } else {
      // If not validator, only show own KPIs
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
      console.error("KPI Center Query Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'kpi_entries');
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.uid, profile?.role, canValidate, selectedMonth]);

  const handleSubmit = async () => {
    if (!profile) return;
    if (!form.workDescription) return alert('Deskripsi kerja harus diisi');

    const totalAmount = form.manualAmount;

    try {
      if (editingId) {
        const entry = entries.find(e => e.id === editingId);
        if (!entry) return;

        await updateDoc(doc(db, 'kpi_entries', editingId), {
          workDescription: form.workDescription,
          totalAmount,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'kpi_entries'), {
          userId: profile.uid,
          userName: profile.displayName,
          userRole: profile.role,
          date: serverTimestamp(),
          workDescription: form.workDescription,
          totalAmount,
          status: 'pending'
        });
      }
      
      setIsAdding(false);
      setEditingId(null);
      setForm({
        workDescription: '',
        manualAmount: 0
      });
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan laporan');
    }
  };

  const handleEdit = (entry: KPIEntry) => {
    setForm({
      workDescription: entry.workDescription,
      manualAmount: entry.totalAmount || 0
    });
    setEditingId(entry.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus laporan ini?')) return;
    try {
      await deleteDoc(doc(db, 'kpi_entries', id));
    } catch (e) {
      console.error(e);
      alert('Gagal menghapus laporan');
    }
  };

  const handleValidate = async (entryId: string, status: 'validated' | 'rejected', feedback: string = '') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'kpi_entries', entryId), {
        status,
        validatedBy: profile.uid,
        validatedName: profile.displayName,
        validatedAt: serverTimestamp(),
        feedback
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEntries = useMemo(() => {
    let result = entries.filter(e => {
      const matchesSearch = (e.userName || '').toLowerCase().includes(search.toLowerCase()) || 
                           (e.workDescription || '').toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || e.userRole === roleFilter;
      return matchesSearch && matchesRole;
    });

    if (activeTab === 'my-kpi') {
      return result.filter(e => e.userId === profile?.uid);
    }
    
    if (activeTab === 'validation') {
      // In validation tab, admins see everyone else's work
      return result.filter(e => e.userId !== profile?.uid);
    }

    return result;
  }, [entries, search, roleFilter, activeTab, profile?.uid]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-20">
      <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1">Pusat KPI Staf</h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
            <Target className="w-3 h-3 text-blue-500" /> Kontribusi & Validasi Kinerja Harian
          </p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Log Kerja Hari Ini
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col p-8 pt-4 gap-6 min-h-0">
        {/* Tabs & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 shadow-inner">
            <button 
              onClick={() => { setActiveTab('my-kpi'); setIsAdding(false); }}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                activeTab === 'my-kpi' ? "bg-zinc-800 text-white shadow-xl ring-1 ring-white/10" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              KPI Saya
            </button>
            {canValidate && (
              <>
                <button 
                  onClick={() => { setActiveTab('validation'); setIsAdding(false); }}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                    activeTab === 'validation' ? "bg-zinc-800 text-white shadow-xl ring-1 ring-white/10" : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  Pusat Validasi
                </button>
                <button 
                  onClick={() => { setActiveTab('templates'); setIsAdding(false); }}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                    activeTab === 'templates' ? "bg-zinc-800 text-white shadow-xl ring-1 ring-white/10" : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  Manajemen Template
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-[10px] font-black text-zinc-300 uppercase tracking-widest outline-none cursor-pointer py-1.5"
              />
            </div>
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input 
                type="text" 
                placeholder="Cari laporan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-2.5 pl-12 pr-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>
            {canValidate && (
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-zinc-900 text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4 py-2.5 rounded-2xl border border-zinc-800 outline-none hover:text-white transition-all cursor-pointer"
              >
                <option value="all">Semua Peran</option>
                <option value="dokter">Dokter</option>
                <option value="perawat">Perawat</option>
                <option value="admin">Admin</option>
                <option value="keuangan">Keuangan</option>
                <option value="apoteker">Apoteker</option>
                <option value="media">Media</option>
                <option value="PIC">PIC</option>
              </select>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 pb-24">
          <AnimatePresence mode="wait">
            {isAdding ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto py-10"
              >
                <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 space-y-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
                  
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/40">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-tighter">{editingId ? 'Edit Laporan KPI' : 'Log Kerja Harian'}</h2>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{editingId ? 'Perbaiki kontribusi anda' : 'Update kontribusi anda hari ini'}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Template Reference */}
                    {templates.filter(t => t.role === profile?.role).length > 0 && (
                      <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3 ml-1">Panduan Insentif ({profile?.role})</p>
                        <div className="flex flex-wrap gap-2">
                          {templates.filter(t => t.role === profile?.role).map(t => (
                            <div key={t.id} className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-400">{t.taskName}</span>
                              <span className="text-[10px] font-black text-blue-500 font-mono">Rp {t.price.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Deskripsi Kerja / Pencapaian</label>
                      <textarea 
                        value={form.workDescription}
                        onChange={(e) => setForm({...form, workDescription: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all resize-none h-32"
                        placeholder="Apa saja yang anda selesaikan hari ini?"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Estimasi Insentif / Jasa (Rp)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          value={form.manualAmount}
                          onChange={(e) => setForm({...form, manualAmount: Number(e.target.value)})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-5 text-2xl font-black text-emerald-500 font-mono focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                          placeholder="0"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-xs uppercase tracking-widest pointer-events-none">
                          Rupiah
                        </div>
                      </div>
                      <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest ml-1 italic">
                        * Masukkan nominal insentif secara manual sesuai pencapaian hari ini
                      </p>
                    </div>

                    <div className="flex gap-4 pt-10">
                      <button 
                        onClick={() => {
                          setIsAdding(false);
                          setEditingId(null);
                          setForm({
                            workDescription: '',
                            manualAmount: 0
                          });
                        }}
                        className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Batal
                      </button>
                      <button 
                        onClick={handleSubmit}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
                      >
                        {editingId ? 'Update Laporan' : 'Simpan Laporan'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'templates' ? (
              <KPITemplateManagement key="templates" />
            ) : (
              <motion.div key="entries" className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Analisis Performa Bulanan</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Status dan Statistik {activeTab === 'validation' ? 'Tim' : 'Pribadi'}</p>
                  </div>
                </div>

                {/* Month Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 flex items-center justify-between group">
                    <div>
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Laporan {activeTab === 'validation' ? 'Tim' : ''}</p>
                      <p className="text-2xl font-black text-white">{filteredEntries.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
                      <Target className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Insentif {activeTab === 'validation' ? 'Tim' : ''}</p>
                      <p className="text-2xl font-black text-emerald-500 font-mono">
                        Rp {(filteredEntries.reduce((acc, e) => {
                          const val = Number(e.totalAmount);
                          return acc + (e.status === 'validated' && !isNaN(val) ? val : 0);
                        }, 0)).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-500">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Menunggu Validasi</p>
                      <p className="text-2xl font-black text-amber-500">
                        {filteredEntries.filter(e => e.status === 'pending').length}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-500">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>
                  <button 
                    onClick={() => alert('Fitur Export Laporan sedang disiapkan')}
                    className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 flex flex-col items-center justify-center gap-2 hover:bg-zinc-800 transition-all group"
                  >
                    <BarChart3 className="w-6 h-6 text-zinc-500 group-hover:text-blue-500" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-white">Ekspor Laporan</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredEntries.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center bg-zinc-900/20 rounded-[3rem] border border-zinc-800/50 border-dashed">
                      <Award className="w-16 h-16 text-zinc-800 mb-6" />
                      <p className="text-zinc-500 font-black uppercase tracking-[0.2em] text-[10px]">Belum ada laporan KPI di periode ini</p>
                    </div>
                  ) : (
                    filteredEntries.map(entry => (
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
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function KPIEntryCard({ entry, canValidate, canEdit, canDelete, onValidate, onEdit, onDelete, currentUserId }: any) {
  const isOwner = entry.userId === currentUserId;
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className={cn(
      "p-6 rounded-[2.5rem] border transition-all relative overflow-hidden group flex flex-col h-full",
      entry.status === 'validated' ? "bg-emerald-600/5 border-emerald-500/20" :
      entry.status === 'rejected' ? "bg-red-600/5 border-red-500/20" :
      "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
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
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <User className={cn(
                "w-6 h-6",
                entry.status === 'validated' ? "text-emerald-500" :
                entry.status === 'rejected' ? "text-red-500" :
                "text-blue-500"
              )} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white leading-none mb-1">{entry.userName}</h4>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{entry.userRole}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="text-[9px] font-bold text-zinc-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {entry.date?.toDate()?.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button 
                onClick={onEdit}
                className="p-1.5 text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                title="Edit Laporan"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button 
                onClick={onDelete}
                className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                title="Hapus Laporan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <span className={cn(
              "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
              entry.status === 'validated' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
              entry.status === 'rejected' ? "bg-red-500/10 border-red-500/20 text-red-500" :
              "bg-blue-500/10 border-blue-500/20 text-blue-500"
            )}>
              {entry.status === 'validated' ? 'Terverifikasi' : entry.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
            </span>
          </div>
        </div>

        <div className="space-y-4 flex-1">
          <p className="text-xs font-medium text-zinc-300 leading-relaxed italic">
            "{entry.workDescription}"
          </p>

          {entry.metrics && entry.metrics.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entry.metrics.map((m: any, idx: number) => (
                <div key={idx} className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">{m.label}</p>
                    <p className="text-sm font-black text-white font-mono flex items-baseline gap-1">
                      {m.value}
                      <span className="text-[9px] font-bold text-zinc-500 normal-case">{m.unit}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Subtotal</p>
                    <p className="text-xs font-black text-emerald-500 font-mono">Rp {(m.subtotal || (m.value * m.price)).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-4 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-between group-hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Total Insentif</span>
            </div>
            <span className="text-xl font-black text-emerald-500 font-mono">Rp {(entry.totalAmount || 0).toLocaleString()}</span>
          </div>
        </div>

        {entry.history && entry.history.length > 0 && (
          <div className="border-t border-zinc-800/50 pt-4 mt-2">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Clock className="w-3 h-3" /> 
              {showHistory ? 'Sembunyikan History' : `Lihat History (${entry.history.length})`}
            </button>
            
            <AnimatePresence>
              {showHistory && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-3 mt-4"
                >
                  {entry.history.map((h: any, i: number) => (
                    <div key={i} className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800/50 text-[10px]">
                      <p className="text-zinc-500 font-bold mb-2">Versi Sebelumnya</p>
                      <p className="text-zinc-400 italic mb-3">"{h.workDescription}"</p>
                      <div className="flex flex-wrap gap-3">
                        {h.metrics.map((m: any, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-zinc-900 rounded-lg text-zinc-500">
                            {m.label}: <span className="text-zinc-300">{m.value} {m.unit}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {entry.status === 'pending' && canValidate && (
          <div className="flex items-center gap-3 pt-4 px-2">
            <button 
              onClick={() => onValidate(entry.id, 'validated')}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/40 active:scale-95 group/verify"
            >
              <Check className="w-5 h-5 group-hover/verify:scale-110 transition-transform" />
              Tanda Tangani & Verifikasi
            </button>
            <button 
              onClick={() => onValidate(entry.id, 'rejected')}
              className="px-6 py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
              title="Tolak Laporan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {entry.status !== 'pending' && (
          <div className="pt-4 border-t border-zinc-800/50 flex items-center justify-between relative">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className={cn("w-5 h-5", entry.status === 'validated' ? "text-emerald-500" : "text-red-500")} />
               </div>
               <div className="flex flex-col">
                 <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                   {entry.status === 'validated' ? 'Digital Signature Verified' : 
                    entry.status === 'rejected' ? 'Entry Rejected' : 'Waiting Signature'}
                 </p>
                 <div className="flex items-center gap-2">
                   {entry.status === 'validated' ? (
                     <div className="flex flex-col">
                       <p className="text-[10px] font-black text-white uppercase italic font-serif">
                         {entry.validatedName}
                       </p>
                       <p className="text-[7px] font-mono text-emerald-500/70">
                         SECURE_ID: {entry.id.substring(0, 8).toUpperCase()}
                       </p>
                     </div>
                   ) : (
                     <p className="text-[10px] font-black text-zinc-700 uppercase">Pending Review</p>
                   )}
                   <span className="w-1 h-1 rounded-full bg-zinc-700" />
                   <span className="text-[8px] font-mono text-zinc-500 font-normal">
                     {entry.validatedAt?.toDate()?.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }) || '--/--/--'}
                   </span>
                 </div>
               </div>
            </div>
            
            {entry.status === 'validated' && (
              <div className="absolute right-0 top-0 opacity-10 -rotate-12 pointer-events-none select-none">
                <div className="px-4 py-2 border-4 border-emerald-500 text-emerald-500 text-xl font-black uppercase tracking-tighter rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  VERIFIED
                </div>
              </div>
            )}

            {entry.validatedAt && (
              <span className="text-[8px] font-mono text-zinc-700">
                {entry.validatedAt?.toDate()?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
