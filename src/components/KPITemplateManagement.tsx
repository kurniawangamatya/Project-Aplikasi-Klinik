import React, { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, deleteDoc } from '../lib/firebase';
import { Edit3, Trash2, RefreshCw, Filter, User, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { cn } from '../lib/utils';

const DEFAULT_TEMPLATES = [
  { role: 'admin', taskName: 'Input Data Pasien', price: 10000, unit: 'Pasien' },
  { role: 'admin', taskName: 'Arsip Dokumen Rekam Medis', price: 5000, unit: 'File' },
  { role: 'dokter', taskName: 'Konsultasi Rawat Jalan', price: 50000, unit: 'Pasien' },
  { role: 'dokter', taskName: 'Tindakan Medis Khusus', price: 150000, unit: 'Prosedur' },
  { role: 'perawat', taskName: 'Homecare / Visit Medis', price: 30000, unit: 'Pasien' },
  { role: 'perawat', taskName: 'Pemberian Obat & Injeksi', price: 5000, unit: 'Dosis' },
  { role: 'keuangan', taskName: 'Invoice Selesai', price: 15000, unit: 'Lembar' },
  { role: 'keuangan', taskName: 'Verifikasi Bayar Transaksi', price: 10000, unit: 'Transaksi' },
  { role: 'apoteker', taskName: 'Resep Obat Selesai', price: 8000, unit: 'Pasien' },
  { role: 'apoteker', taskName: 'Update Stok Gudang Farmasi', price: 5000, unit: 'Item' },
  { role: 'media', taskName: 'Konten Publikasi & Edukasi', price: 25000, unit: 'Post' },
  { role: 'media', taskName: 'Respon DM / Komentar Sosmed', price: 2000, unit: 'User' },
  { role: 'PIC', taskName: 'Koordinasi Operasional Tim', price: 45000, unit: 'Sesi' },
  { role: 'PIC', taskName: 'Problem Solving & Kompleksitas', price: 30000, unit: 'Kasus' },
  { role: 'owner', taskName: 'Review Strategi Manajemen', price: 200000, unit: 'Keputusan' }
];

const AVAILABLE_ROLES = ['admin', 'dokter', 'perawat', 'keuangan', 'apoteker', 'media', 'PIC', 'owner'];

export default function KPITemplateManagement() {
  const { profile } = useAuth();
  const { users } = useData();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('semua');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  
  const [form, setForm] = useState({
    targetType: 'role', // 'role' or 'user'
    role: 'dokter',
    userId: '',
    userDisplayName: '',
    userEmail: '',
    taskName: '',
    price: 0,
    unit: 'tindakan',
    payoutRule: 'standar' // 'standar' or 'bonus'
  });

  useEffect(() => {
    if (profile?.role) {
      setForm(prev => ({ 
        ...prev, 
        role: profile.role || 'dokter',
        targetType: 'role'
      }));
      setSelectedRoleFilter(profile.role || 'semua');
    }
  }, [profile]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'kpi_templates'), orderBy('role', 'asc')), (snap) => {
      setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    if (!form.taskName || form.price <= 0) return alert('Nama tugas dan harga harus diisi dengan benar');
    
    try {
      const dataToSave: any = {
        taskName: form.taskName,
        price: form.price,
        unit: form.unit,
        targetType: form.targetType,
        role: form.role,
        payoutRule: form.payoutRule || 'standar'
      };

      if (form.targetType === 'user') {
        if (!form.userId) return alert('Silakan pilih akun / user tujuan terlebih dahulu');
        dataToSave.userId = form.userId;
        dataToSave.userDisplayName = form.userDisplayName;
        dataToSave.userEmail = form.userEmail;
      } else {
        dataToSave.userId = '';
        dataToSave.userDisplayName = '';
        dataToSave.userEmail = '';
      }

      if (editingId) {
        await updateDoc(doc(db, 'kpi_templates', editingId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'kpi_templates'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      
      setEditingId(null);
      setForm({
        targetType: 'role',
        role: form.role,
        userId: '',
        userDisplayName: '',
        userEmail: '',
        taskName: '',
        price: 0,
        unit: 'tindakan',
        payoutRule: 'standar'
      });
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan template');
    }
  };

  const handleSyncDefaultTemplates = async () => {
    setIsSyncing(true);
    try {
      let addedCount = 0;
      
      // Ambil template dasar untuk disinkronkan.
      // Kita gabungkan template default bawaan sistem dengan template kustom yang sudah ada
      // agar seluruh peran selalu memiliki template dasar ditambah dengan kustomisasi yang dibuat user.
      const baseTemplatesToSync = [
        ...DEFAULT_TEMPLATES.map(t => ({
          taskName: t.taskName,
          price: t.price,
          unit: t.unit || 'tindakan'
        })),
        ...templates.map(t => ({
          taskName: t.taskName,
          price: t.price,
          unit: t.unit || 'tindakan'
        }))
      ];

      // Saring agar hanya mengambil tugas unik berdasarkan nama, harga, dan unit saja
      const uniqueTasks: { taskName: string; price: number; unit: string }[] = [];
      const seen = new Set<string>();
      for (const t of baseTemplatesToSync) {
        const key = `${t.taskName.toLowerCase()}||${t.price}||${t.unit.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTasks.push(t);
        }
      }

      // Sinkronkan setiap tugas unik ke semua AVAILABLE_ROLES
      for (const task of uniqueTasks) {
        for (const role of AVAILABLE_ROLES) {
          // Periksa apakah template untuk tugas ini dan peran ini sudah ada (tanpa userId)
          const alreadyExists = templates.some(
            t => !t.userId && 
                 t.role.toLowerCase() === role.toLowerCase() && 
                 t.taskName.toLowerCase() === task.taskName.toLowerCase()
          );

          if (!alreadyExists) {
            await addDoc(collection(db, 'kpi_templates'), {
              role: role,
              taskName: task.taskName,
              price: task.price,
              unit: task.unit,
              targetType: 'role',
              userId: '',
              userDisplayName: '',
              userEmail: '',
              createdAt: serverTimestamp()
            });
            addedCount++;
          }
        }
      }

      alert(`Sinkronisasi Selesai! Berhasil menyinkronkan ${addedCount} template baru ke semua Peran (Role).`);
    } catch (e) {
      console.error(e);
      alert('Gagal menyinkronkan template.');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    // 1. If specific user filter is active
    if (selectedUserFilter !== 'all') {
      return t.userId === selectedUserFilter;
    }
    // 2. If general role filter is active (and no user filter is active)
    if (selectedRoleFilter !== 'semua') {
      return !t.userId && t.role.toLowerCase() === selectedRoleFilter.toLowerCase();
    }
    return true; // "Semua"
  });

  const handleEditClick = (t: any) => {
    setEditingId(t.id);
    setForm({
      targetType: t.userId ? 'user' : 'role',
      role: t.role || 'dokter',
      userId: t.userId || '',
      userDisplayName: t.userDisplayName || '',
      userEmail: t.userEmail || '',
      taskName: t.taskName || '',
      price: t.price || 0,
      unit: t.unit || 'tindakan',
      payoutRule: t.payoutRule || 'standar'
    });
  };

  if (loading) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="bg-white dark:bg-zinc-950/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 relative overflow-hidden shadow-sm dark:shadow-none">
        <div className="absolute top-0 right-0 p-8 hidden md:block">
          <button
            onClick={handleSyncDefaultTemplates}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 dark:bg-emerald-500/15 hover:bg-emerald-550/20 dark:hover:bg-emerald-500/25 border border-emerald-350 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-400 disabled:opacity-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Menyinkronkan...' : 'Sinkron ke Semua Role'}
          </button>
        </div>

        <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-1">Manajemen Template KPI</h3>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6">Atur nominal insentif dan tindakan per kompetensi klinik atau masing-masing akun user</p>
        
        {/* Mobile sync utility */}
        <div className="md:hidden mb-6">
          <button
            onClick={handleSyncDefaultTemplates}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 disabled:opacity-50 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Menyinkronkan...' : 'Sinkron ke Semua Role'}
          </button>
        </div>

        {/* Target Type Picker */}
        <div className="mb-6 bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 max-w-md shadow-sm dark:shadow-none">
          <label className="text-[9px] font-black text-zinc-550 text-zinc-500 uppercase tracking-[0.2em] block mb-2">Tipe Sasaran KPI</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, targetType: 'role', userId: '', userDisplayName: '', userEmail: '' })}
              className={`flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                form.targetType === 'role' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 shadow-neutral-400/20' 
                  : 'bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
              }`}
            >
              Per Peran (Role)
            </button>
            <button
              type="button"
              onClick={() => {
                const firstUser = users[0];
                setForm({ 
                  ...form, 
                  targetType: 'user', 
                  userId: firstUser?.uid || '', 
                  userDisplayName: firstUser?.displayName || '',
                  userEmail: firstUser?.email || '',
                  role: firstUser?.role || 'dokter'
                });
              }}
              className={`flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                form.targetType === 'user' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 shadow-neutral-400/20' 
                  : 'bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
              }`}
            >
              Per Akun / User
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {form.targetType === 'role' ? (
            <div className="md:col-span-2 space-y-2 animate-fade-in">
              <label className="text-[10px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest ml-1">Peran / Role</label>
              <select 
                value={form.role}
                onChange={(e) => setForm({...form, role: e.target.value})}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl py-3.5 px-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
              >
                {AVAILABLE_ROLES.map(role => (
                  <option key={role} value={role}>{role.toUpperCase()}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="md:col-span-2 space-y-2 animate-fade-in">
              <label className="text-[10px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest ml-1">Pilih Akun</label>
              <select 
                value={form.userId}
                onChange={(e) => {
                  const selectedUser = users.find(u => u.uid === e.target.value);
                  setForm({
                    ...form,
                    userId: e.target.value,
                    userDisplayName: selectedUser?.displayName || '',
                    userEmail: selectedUser?.email || '',
                    role: selectedUser?.role || 'dokter'
                  });
                }}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl py-3.5 px-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
              >
                <option value="">-- Pilih Akun --</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName || u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest ml-1">Nama Tugas KPI</label>
            <input 
              type="text"
              value={form.taskName}
              onChange={(e) => setForm({...form, taskName: e.target.value})}
              placeholder="Contoh: Tambal Composite"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-sans"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest ml-1">Satuan Unit</label>
            <input 
              type="text"
              value={form.unit}
              onChange={(e) => setForm({...form, unit: e.target.value})}
              placeholder="Misal: Pasien"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-sans"
            />
          </div>
          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest ml-1">Insentif Per Unit (Rp)</label>
            <input 
              type="number"
              value={form.price || ''}
              onChange={(e) => setForm({...form, price: Number(e.target.value)})}
              placeholder="0"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-zinc-550 text-zinc-500 uppercase tracking-widest ml-1">Aturan Payout</label>
            <select
              value={form.payoutRule}
              onChange={(e) => setForm({...form, payoutRule: e.target.value})}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl py-3.5 px-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
            >
              <option value="standar">Standar</option>
              <option value="bonus">Bonus</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-4 mt-6">
          <button 
            onClick={handleSubmit}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all cursor-pointer"
          >
            {editingId ? 'Update Template' : 'Tambah Template'}
          </button>
          {editingId && (
            <button 
              onClick={() => { 
                setEditingId(null); 
                setForm({ 
                  targetType: 'role',
                  role: profile?.role || 'dokter', 
                  userId: '',
                  userDisplayName: '',
                  userEmail: '',
                  taskName: '', 
                  price: 0, 
                  unit: 'tindakan' 
                }); 
              }}
              className="px-8 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-650 dark:text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Batal
            </button>
          )}
        </div>
      </div>

      {/* Role / Account Filter Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Filter className="w-3 h-3 text-blue-500" /> Filter Template
          </span>
        </div>
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Roles Filters */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-805">
            <button
              onClick={() => { setSelectedRoleFilter('semua'); setSelectedUserFilter('all'); }}
              className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedRoleFilter === 'semua' && selectedUserFilter === 'all' 
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
              }`}
            >
              Semua ({templates.length})
            </button>
            {AVAILABLE_ROLES.map(role => {
              const count = templates.filter(t => !t.userId && t.role.toLowerCase() === role.toLowerCase()).length;
              return (
                <button
                  key={role}
                  onClick={() => { setSelectedRoleFilter(role); setSelectedUserFilter('all'); }}
                  className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    selectedRoleFilter === role && selectedUserFilter === 'all' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/15' 
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                  }`}
                >
                  {role} ({count})
                </button>
              );
            })}
          </div>

          {/* User Filter Dropdown */}
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950/40 px-4 py-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 self-start xl:self-auto">
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[9px] font-black uppercase text-zinc-500 whitespace-nowrap">Atau Filter Per Akun:</span>
            <select
              value={selectedUserFilter}
              onChange={(e) => {
                setSelectedUserFilter(e.target.value);
                if (e.target.value !== 'all') {
                  setSelectedRoleFilter('user-filter-active');
                } else {
                  setSelectedRoleFilter('semua');
                }
              }}
              className="bg-transparent text-[9px] font-black text-zinc-655 text-zinc-600 dark:text-zinc-400 hover:text-zinc-905 dark:hover:text-white uppercase tracking-widest border-none outline-none cursor-pointer py-1 max-w-[180px] truncate"
            >
              <option value="all" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">Semua Akun</option>
              {users.map(u => {
                const count = templates.filter(t => t.userId === u.uid).length;
                return (
                  <option key={u.uid} value={u.uid} className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">
                    {u.displayName || u.email} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden overflow-x-auto shadow-sm dark:shadow-none">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sasaran Template / Akun</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Tugas KPI</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Harga (Rp)</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-8 py-16 text-center text-zinc-500 text-xs">
                  Belum ada kustomisasi template KPI untuk filter yang dipilih.
                </td>
              </tr>
            ) : (
              filteredTemplates.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors group">
                  <td className="px-8 py-4">
                    {t.userId ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 shadow-sm">
                          <User className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" />
                          Akun: {t.userDisplayName || 'Karyawan'}
                        </span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest px-1">
                          {t.userEmail} ({t.role?.toUpperCase()})
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-400 rounded-lg group-hover:bg-blue-600/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all border border-zinc-200 dark:border-zinc-800 group-hover:border-blue-500/25">
                        Peran: {t.role}
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-4">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{t.taskName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-600 uppercase">Per {t.unit || 'tindakan'}</span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                        t.payoutRule === 'bonus' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500"
                      )}>
                        {t.payoutRule || 'standar'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-500 font-mono">Rp {(t.price || 0).toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEditClick(t)}
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl transition-all cursor-pointer"
                        title="Edit Template"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteId === t.id ? (
                        <div className="flex items-center gap-1.5 bg-red-600/10 border border-red-500/30 p-1 rounded-xl animate-fade-in">
                          <span className="text-[8px] font-black uppercase text-red-500 tracking-wider px-1">Yakin?</span>
                          <button 
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'kpi_templates', t.id));
                                setConfirmDeleteId(null);
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider"
                          >
                            Ya
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-[8px] font-black uppercase tracking-wider"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmDeleteId(t.id)}
                          className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 hover:text-red-500 rounded-xl transition-all cursor-pointer"
                          title="Hapus Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
