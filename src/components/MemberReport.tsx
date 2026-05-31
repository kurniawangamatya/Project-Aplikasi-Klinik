import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, orderBy, where, getDocs, deleteDoc, doc, updateDoc, addDoc, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { SaleTransaction, UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { 
  TrendingUp, DollarSign, BarChart3, 
  Calendar, ArrowUpRight, ArrowDownRight, Activity, Award, User,
  Stethoscope, Briefcase, ChevronDown, Check, Printer, Download, Share2, ArrowUpDown,
  Trash2, Edit3, Heart, X, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#0891b2', '#f97316', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

interface MemberReportProps {
  role: UserRole;
  title: string;
}

interface MemberCardProps {
  member: UserProfile;
  role: UserRole;
  allSales: SaleTransaction[];
  employees: any[];
  onViewMore: (id: string) => void;
  key?: string;
}

function MemberCard({ member, role, allSales, employees, onViewMore }: MemberCardProps) {
  const stats = useMemo(() => {
    const idField = role === 'dokter' ? 'doctorId' : role === 'perawat' ? 'nurseId' : 'createdBy';
    const commField = role === 'dokter' ? 'doctorCommission' : 
                      role === 'perawat' ? 'nurseCommission' : 
                      role === 'keuangan' ? 'financeCommission' :
                      role === 'owner' ? 'ownerCommission' :
                      'adminCommission';
    
    const memberSales = allSales.filter(s => s[idField] === member.uid);
    const employee = employees.find(e => e.userId === member.uid);

    let jasa = 0;
    let omsetKotor = 0;
    
    memberSales.forEach(sale => {
      sale.items.forEach(item => {
        let itemCommission = 0;
        const sharingType = item.sharingType || 'percentage';
        const isService = item.type === 'service';
        const defaultComm = isService ? (
          commField === 'doctorCommission' ? 30 : 
          commField === 'nurseCommission' ? 10 : 
          commField === 'financeCommission' ? 5 :
          commField === 'ownerCommission' ? 10 :
          commField === 'adminCommission' ? 5 : 0
        ) : 0;
        const commissionVal = (item as any)[commField] !== undefined && (item as any)[commField] !== null ? (item as any)[commField] : defaultComm;

        let resolvedSharingType = sharingType;
        if (commissionVal > 100) {
          resolvedSharingType = 'fixed';
        }

        if (resolvedSharingType === 'percentage') {
          itemCommission = (item.price * item.quantity * commissionVal) / 100;
        } else {
          const multiplier = (commissionVal > 0 && commissionVal < 1000) ? 1000 : 1;
          itemCommission = commissionVal * multiplier * item.quantity;
        }

        itemCommission = Math.round(itemCommission);
        jasa += itemCommission;
        omsetKotor += (item.price * item.quantity);
      });
    });

    const baseSalary = employee?.salary || 0;
    const totalWage = jasa + baseSalary;
    const labaKlinik = omsetKotor - totalWage;

    return { totalWage, omsetKotor, jasa, baseSalary, labaKlinik };
  }, [allSales, member.uid, employees, role]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className={cn(
        "bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500",
        role === 'perawat' ? "hover:shadow-blue-900/5" : "hover:shadow-violet-900/5"
      )}
    >
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={cn(
                "w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-100 transition-colors bg-slate-50 flex items-center justify-center text-slate-300",
                role === 'perawat' ? "group-hover:border-blue-500/20" : "group-hover:border-violet-500/20"
              )}>
                {member.photoURL ? (
                  <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-8 h-8" />
                )}
              </div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center border-2 border-white text-white",
                role === 'perawat' ? "bg-blue-600" : "bg-violet-600"
              )}>
                <Check className="w-3 h-3" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1.5 truncate">{member.displayName}</h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md border",
                  role === 'perawat' 
                    ? "bg-blue-50 text-blue-600 border-blue-100" 
                    : "bg-violet-50 text-violet-600 border-violet-100"
                )}>
                  {member.specialization || (role === 'perawat' ? 'Suster / Perawat' : 'Staf Administrasi')}
                </span>
              </div>
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => onViewMore(member.uid)}
            className={cn(
              "p-3 bg-slate-50 text-slate-400 hover:text-white rounded-2xl transition-all shadow-sm border border-slate-100 group/btn shrink-0",
              role === 'perawat' ? "hover:bg-blue-600" : "hover:bg-violet-600"
            )}
          >
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </motion.button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className={cn(
            "p-5 rounded-[2rem] text-white shadow-lg relative overflow-hidden group/earning",
            role === 'perawat' ? "bg-blue-600 shadow-blue-900/20" : "bg-violet-600 shadow-violet-900/20"
          )}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-2xl group-hover/earning:scale-110 transition-transform duration-700" />
            <div className="relative z-10">
              <p className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] mb-2 drop-shadow-sm",
                role === 'perawat' ? "text-blue-100" : "text-violet-100"
              )}>Total Estimasi Pendapatan</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono">Rp {(stats.totalWage || 0).toLocaleString()}</span>
                <span className={cn(
                  "text-[10px] font-bold opacity-60",
                  role === 'perawat' ? "text-blue-100" : "text-violet-100"
                )}>/ Bulan</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-white opacity-90">
                <div className="flex flex-col gap-0.5">
                  <span className="opacity-60">Gaji Pokok</span>
                  <span>Rp {(stats.baseSalary || 0).toLocaleString()}</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="opacity-60">Komisi Jasa</span>
                  <span>Rp {(stats.jasa || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Pendapatan (Omset)</p>
              <p className="text-sm font-black text-slate-900 font-mono">Rp {(stats.omsetKotor || 0).toLocaleString()}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          
          <div className={cn(
            "flex items-center justify-between p-4 rounded-2xl border",
            role === 'perawat' 
              ? "bg-blue-50/30 border-blue-100" 
              : "bg-violet-50/30 border-violet-100"
          )}>
            <div>
              <p className={cn(
                "text-[8px] font-black uppercase tracking-widest mb-1",
                role === 'perawat' ? "text-blue-600" : "text-violet-600"
              )}>Margin Klinik</p>
              <p className={cn(
                "text-sm font-black font-mono",
                role === 'perawat' ? "text-blue-700" : "text-violet-700"
              )}>Rp {(stats.labaKlinik || 0).toLocaleString()}</p>
            </div>
            <Activity className={cn(
              "w-4 h-4",
              role === 'perawat' ? "text-blue-600" : "text-violet-600"
            )} />
          </div>
        </div>

        <button 
          onClick={() => onViewMore(member.uid)}
          className={cn(
            "w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98]",
            role === 'perawat' ? "hover:bg-blue-600 hover:shadow-blue-900/20" : "hover:bg-violet-600 hover:shadow-violet-900/20"
          )}
        >
          Lihat Laporan Khusus
        </button>
      </div>
    </motion.div>
  );
}

export default function MemberReport({ role, title }: MemberReportProps) {
  const { profile } = useAuth();
  const { users, employees, products: allProducts, categories: procedureCategories } = useData();
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Enforce role-based viewing boundaries
  useEffect(() => {
    if (profile) {
      if (profile.role === 'owner') {
        setViewMode('grid');
      } else {
        setSelectedMemberId(profile.uid);
        setViewMode('detail');
      }
    }
  }, [profile]);
  const [allSales, setAllSales] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<any[]>([]);
  const [catSortConfig, setCatSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'totalWage', direction: 'desc' });
  const [editingSale, setEditingSale] = useState<{ id: string, notes: string } | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ originalName: string, currentName: string } | null>(null);
  const [deletingCategoryName, setDeletingCategoryName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const idField = role === 'dokter' ? 'doctorId' : role === 'perawat' ? 'nurseId' : 'createdBy';
  const commField = role === 'dokter' ? 'doctorCommission' : 
                    role === 'perawat' ? 'nurseCommission' : 
                    role === 'keuangan' ? 'financeCommission' :
                    role === 'owner' ? 'ownerCommission' :
                    'adminCommission';

  // Derived from DataContext
  const members = useMemo(() => users.filter(u => u.role === role), [users, role]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => (m.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [members, searchTerm]);

  const handleExportTreatmentsCSV = () => {
    if (!stats || !stats.treatments) return;
    
    const headers = ['Nama Tindakan', 'Kategori', 'Jumlah (Qty)', 'Total Komisi (Rp)', 'Persentase (%)'];
    const rows = stats.treatments.map(t => [
      t.name,
      t.category,
      t.count,
      t.totalComm,
      stats.jasa > 0 ? ((t.totalComm / stats.jasa) * 100).toFixed(1) : '0'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `tindakan_${role}_${stats.memberName.replace(/\s+/g, '_')}_${format(period, 'MMM_yyyy')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDeleteSale = (saleId: string) => {
    setDeletingSaleId(saleId);
  };

  const handleUpdateNotes = (saleId: string, currentNotes: string) => {
    setEditingSale({ id: saleId, notes: currentNotes || '' });
  };

  const confirmDeleteSale = async () => {
    if (!deletingSaleId) return;
    try {
      await deleteDoc(doc(db, 'sales', deletingSaleId));
      setDeletingSaleId(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `sales/${deletingSaleId}`);
    }
  };

  const confirmUpdateNotes = async (newNotes: string) => {
    if (!editingSale) return;
    try {
      await updateDoc(doc(db, 'sales', editingSale.id), { notes: newNotes });
      setEditingSale(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `sales/${editingSale.id}`);
    }
  };

  const confirmUpdateCategory = async (newName: string) => {
    if (!editingCategory || !newName.trim()) return;
    const { originalName } = editingCategory;
    const trimmedNewName = newName.trim();
    try {
      // 1. Update/Add in categories collection
      const masterCat = procedureCategories.find(cat => cat.name === originalName);
      if (masterCat) {
        await updateDoc(doc(db, 'categories', masterCat.id), { name: trimmedNewName });
      } else {
        await addDoc(collection(db, 'categories'), { name: trimmedNewName });
      }

      // 2. Update products
      const productsToUpdate = allProducts.filter(p => p.category === originalName);
      for (const p of productsToUpdate) {
        await updateDoc(doc(db, 'products', p.id), { category: trimmedNewName });
      }

      // 3. Update sales
      const salesToUpdate = allSales.filter(s => s.items.some(item => (item.category || 'Lainnya') === originalName));
      for (const s of salesToUpdate) {
        const updatedItems = s.items.map(item => {
          if ((item.category || 'Lainnya') === originalName) {
            return { ...item, category: trimmedNewName };
          }
          return item;
        });
        await updateDoc(doc(db, 'sales', s.id), { items: updatedItems });
      }

      setEditingCategory(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `categories/${originalName}`);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategoryName) return;
    try {
      // Find a safe fallback category from the remaining master categories
      const remainingCats = procedureCategories.filter(cat => cat.name !== deletingCategoryName);
      const targetFallbackCatName = remainingCats.find(cat => cat.name === 'Umum' || cat.name === 'Jasa Medis')?.name 
        || remainingCats[0]?.name 
        || 'Umum';

      // 1. Delete matching from master categories
      const masterCat = procedureCategories.find(cat => cat.name === deletingCategoryName);
      if (masterCat) {
        await deleteDoc(doc(db, 'categories', masterCat.id));
      }

      // 2. Move products to target fallback category
      const productsToUpdate = allProducts.filter(p => p.category === deletingCategoryName);
      for (const p of productsToUpdate) {
        await updateDoc(doc(db, 'products', p.id), { category: targetFallbackCatName });
      }

      // 3. Move sales items to target fallback category
      const salesToUpdate = allSales.filter(s => s.items.some(item => (item.category || 'Lainnya') === deletingCategoryName));
      for (const s of salesToUpdate) {
        const updatedItems = s.items.map(item => {
          if ((item.category || 'Lainnya') === deletingCategoryName) {
            return { ...item, category: targetFallbackCatName };
          }
          return item;
        });
        await updateDoc(doc(db, 'sales', s.id), { items: updatedItems });
      }

      setDeletingCategoryName(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `categories/${deletingCategoryName}`);
    }
  };

  // Fetch all sales for the period
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const start = startOfMonth(period);
    const end = endOfMonth(period);

    // Query sales by createdAt range only to avoid compound index errors
    const salesQ = query(
      collection(db, 'sales'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc'),
      limit(400)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      let filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleTransaction));
      
      // Only owner can see everyone's metrics. Others can only see their own records.
      if (profile.role !== 'owner') {
        filtered = filtered.filter(s => (s as any)[idField] === profile.uid);
      }
      
      setAllSales(filtered);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      setLoading(false);
    });

    return () => unsubSales();
  }, [period, profile, idField]);

  // Fetch attendance for the specific member
  useEffect(() => {
    if (viewMode !== 'detail' || !selectedMemberId) return;
    const start = startOfMonth(period);
    const end = endOfMonth(period);

    const attQ = query(
      collection(db, 'attendance'), 
      where('userId', '==', selectedMemberId),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );
    getDocs(attQ).then(snap => {
      setAttendance(snap.docs.map(d => d.data()));
    });
  }, [selectedMemberId, period, viewMode]);

  const sales = useMemo(() => {
    if (profile?.role !== 'owner' && selectedMemberId !== profile?.uid) {
      return [];
    }
    return allSales.filter(s => (s as any)[idField] === selectedMemberId);
  }, [allSales, selectedMemberId, idField, profile]);

  const stats = useMemo(() => {
    if (!selectedMemberId || viewMode !== 'detail') return null;
    if (profile?.role !== 'owner' && selectedMemberId !== profile?.uid) return null;

    const memberUser = members.find(d => d.uid === selectedMemberId);
    const employee = employees.find(e => e.userId === selectedMemberId);

    let jasa = 0;
    let omsetKotor = 0;
    let totalDiscount = 0;
    
    const dailyData: { [key: string]: { date: Date, totalComm: number, revenue: number } } = {};
    const treatmentStats: { [key: string]: { name: string, category: string, totalComm: number, count: number } } = {};
    const categoryStats: { [key: string]: { name: string, totalComm: number } } = {};

    const masterCatNames = procedureCategories.map(c => c.name.trim().toLowerCase());
    const masterCatRealNames = procedureCategories.reduce((acc, c) => {
      acc[c.name.trim().toLowerCase()] = c.name;
      return acc;
    }, {} as { [key: string]: string });

    let defaultCat = 'Jasa Medis';
    if (procedureCategories.length > 0) {
      const names = procedureCategories.map(c => c.name);
      if (names.includes('Jasa Medis')) {
        defaultCat = 'Jasa Medis';
      } else if (names.includes('Umum')) {
        defaultCat = 'Umum';
      } else {
        defaultCat = names[0];
      }
    }

    sales.forEach(sale => {
      const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
      const dateKey = format(saleDate, 'yyyy-MM-dd');

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: saleDate, totalComm: 0, revenue: 0 };
      }

      let saleCommission = 0;
      sale.items.forEach(item => {
        let itemCommission = 0;
        const sharingType = item.sharingType || 'percentage';
        const isService = item.type === 'service';
        const defaultComm = isService ? (
          commField === 'doctorCommission' ? 30 : 
          commField === 'nurseCommission' ? 10 : 
          commField === 'financeCommission' ? 5 :
          commField === 'ownerCommission' ? 10 :
          commField === 'adminCommission' ? 5 : 0
        ) : 0;
        const commissionVal = (item as any)[commField] !== undefined && (item as any)[commField] !== null ? (item as any)[commField] : defaultComm;

        let resolvedSharingType = sharingType;
        if (commissionVal > 100) {
          resolvedSharingType = 'fixed';
        }

        if (resolvedSharingType === 'percentage') {
          itemCommission = (item.price * item.quantity * commissionVal) / 100;
        } else {
          const multiplier = (commissionVal > 0 && commissionVal < 1000) ? 1000 : 1;
          itemCommission = commissionVal * multiplier * item.quantity;
        }

        itemCommission = Math.round(itemCommission);
        saleCommission += itemCommission;
        jasa += itemCommission;
        omsetKotor += (item.price * item.quantity);

        const productObj = allProducts.find(p => p.id === item.id || p.name === item.name);
        let itemCat = productObj ? productObj.category : (item.category || 'Lainnya');
        itemCat = (itemCat || '').trim();
        const lowerCat = itemCat.toLowerCase();
        
        let finalCat = defaultCat;
        if (masterCatNames.includes(lowerCat)) {
          finalCat = masterCatRealNames[lowerCat];
        } else {
          finalCat = defaultCat;
        }

        if (!treatmentStats[item.id]) {
          treatmentStats[item.id] = { name: item.name, category: finalCat, totalComm: 0, count: 0 };
        }
        treatmentStats[item.id].totalComm += itemCommission;
        treatmentStats[item.id].count += item.quantity;

        if (!categoryStats[finalCat]) {
          categoryStats[finalCat] = { name: finalCat, totalComm: 0 };
        }
        categoryStats[finalCat].totalComm += itemCommission;
      });

      dailyData[dateKey].totalComm += saleCommission;
      dailyData[dateKey].revenue += sale.total;
      totalDiscount += (sale.discount || 0);
    });

    const omsetBersih = omsetKotor - totalDiscount;
    const baseSalary = employee?.salary || 0;
    const totalWage = jasa + baseSalary;

    return {
      totalWage,
      omsetKotor,
      jasa,
      baseSalary,
      totalDiscount,
      omsetBersih,
      dailyTrend: Object.values(dailyData).sort((a, b) => a.date.getTime() - b.date.getTime()).map(d => ({
        name: format(d.date, 'd MMM'),
        wage: d.totalComm,
        revenue: d.revenue
      })),
      treatments: Object.values(treatmentStats).sort((a, b) => b.totalComm - a.totalComm).slice(0, 10),
      categories: Object.values(categoryStats),
      memberName: memberUser?.displayName || 'Staf'
    };
  }, [sales, selectedMemberId, members, employees, role, commField, allProducts, procedureCategories]);

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Memuat Laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 sm:p-8 custom-scrollbar font-sans h-full">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section with dynamic styling based on role */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
          <div className={cn(
            "absolute top-0 right-0 w-64 h-64 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl",
            role === 'perawat' ? "bg-blue-50/50" : "bg-violet-50/50"
          )} />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-2">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg",
                role === 'perawat' ? "bg-blue-600 shadow-blue-900/20" : "bg-violet-600 shadow-violet-900/20"
              )}>
                {role === 'dokter' ? <Stethoscope className="w-6 h-6" /> : role === 'perawat' ? <Heart className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Ringkasan Kinerja untuk Kategori {role.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 relative z-10">
            {viewMode === 'detail' && profile?.role === 'owner' && (
              <button 
                onClick={() => setViewMode('grid')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-slate-200"
              >
                Kembali
              </button>
            )}
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Periode</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  value={period.getMonth()}
                  onChange={(e) => {
                    const newDate = new Date(period);
                    newDate.setMonth(Number(e.target.value));
                    setPeriod(newDate);
                  }}
                  className={cn(
                    "bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-10 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 appearance-none cursor-pointer",
                    role === 'perawat' ? "focus:ring-blue-600" : "focus:ring-violet-600"
                  )}
                >
                  {months.map((m, i) => <option key={m} value={i}>{m} {period.getFullYear()}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {viewMode === 'detail' && (
              <div className="flex gap-2 self-end pb-1">
                 <button 
                  onClick={handleExportTreatmentsCSV}
                  className={cn(
                    "p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl transition-all border border-slate-100 shadow-sm",
                    role === 'perawat' ? "hover:text-blue-600" : "hover:text-violet-600"
                  )}
                  title="Export Data Tindakan ke CSV"
                 >
                  <Download className="w-4 h-4" />
                 </button>
                 <button className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all border border-slate-100 shadow-sm"><Printer className="w-4 h-4" /></button>
                 <button className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all border border-slate-100 shadow-sm"><Share2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="space-y-8">
            {/* Search Bar matching DoctorReport style */}
            <div className="max-w-md">
              <div className="relative group">
                <Search className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors",
                  role === 'perawat' ? "group-focus-within:text-blue-600" : "group-focus-within:text-violet-600"
                )} />
                <input 
                  type="text"
                  placeholder={role === 'perawat' ? "Cari nama perawat..." : "Cari nama admin..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full bg-white border border-slate-200/60 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 transition-all shadow-sm",
                    role === 'perawat' ? "focus:ring-blue-600 focus:border-transparent" : "focus:ring-violet-600 focus:border-transparent"
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
              {filteredMembers.map(member => (
                <MemberCard 
                  key={member.uid} 
                  member={member}
                  role={role}
                  allSales={allSales} 
                  employees={employees}
                  onViewMore={(id) => {
                    setSelectedMemberId(id);
                    setViewMode('detail');
                  }}
                />
              ))}
              {filteredMembers.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">
                    {searchTerm ? 'Staf tidak ditemukan' : 'Belum ada staf terdaftar'}
                  </h3>
                </div>
              )}
            </div>
          </div>
        ) : stats ? (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Total Gaji & Komisi" 
                value={stats.totalWage} 
                icon={<DollarSign className="w-5 h-5 text-white" />}
                color={role === 'perawat' ? 'bg-blue-600' : 'bg-violet-600'}
              />
              <StatCard 
                title="Kontribusi Omset" 
                value={stats.omsetKotor} 
                icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                color="bg-emerald-50"
                textColor="text-emerald-700"
              />
              <StatCard 
                title="Total Komisi" 
                value={stats.jasa} 
                icon={<Award className={cn("w-5 h-5", role === 'perawat' ? "text-blue-600" : "text-violet-600")} />}
                color={role === 'perawat' ? "bg-blue-50" : "bg-violet-50"}
                textColor={role === 'perawat' ? "text-blue-700" : "text-violet-700"}
              />
              <StatCard 
                title="Gaji Pokok / UD" 
                value={stats.baseSalary} 
                icon={<Briefcase className="w-5 h-5 text-orange-600" />}
                color="bg-orange-50"
                textColor="text-orange-700"
              />
            </div>

            {/* Middle Section: Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
              <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-800 tracking-tight">Tren Komisi Harian</h3>
                  <Activity className={cn("w-5 h-5", role === 'perawat' ? "text-blue-600" : "text-violet-600")} />
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '10px' }} />
                      <Line type="monotone" dataKey="wage" stroke={role === 'perawat' ? "#2563eb" : "#8b5cf6"} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Composition Donut Chart */}
              <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
                <div className="text-center">
                  <h3 className="font-black text-slate-800 tracking-tight text-sm">Komposisi Upah</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Komisi vs Gaji Pokok</p>
                </div>
                <div className="h-48 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Komisi', value: stats.jasa },
                          { name: 'Gaji Pokok', value: stats.baseSalary }
                        ]}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={10}
                        dataKey="value"
                      >
                        <Cell fill={role === 'perawat' ? "#2563eb" : "#8b5cf6"} />
                        <Cell fill="#f97316" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                    <span className="text-xs font-black text-slate-900 font-mono">Rp {(stats.totalWage/1000).toFixed(0)}k</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                       <div className={cn("w-2 h-2 rounded-full", role === 'perawat' ? "bg-[#2563eb]" : "bg-[#8b5cf6]")} />
                       <span>Komisi ({(stats.jasa / Math.max(1, stats.totalWage) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-[#f97316]" />
                       <span>Gaji ({(stats.baseSalary / Math.max(1, stats.totalWage) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              </div>

               <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8 font-sans">
                  <h3 className="font-black text-slate-800 tracking-tight">Top 5 Tindakan (by Comm)</h3>
                  <div className="space-y-4">
                    {stats.treatments.slice(0, 5).map((t, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                          <span className="text-slate-700 truncate max-w-[150px]">{t.name}</span>
                          <span className={role === 'perawat' ? "text-blue-600" : "text-violet-600"}>Rp {(t.totalComm || 0).toLocaleString()}</span>
                        </div>
                        <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(t.totalComm / Math.max(1, stats.treatments[0]?.totalComm || 1)) * 100}%` }}
                            className={cn("h-full rounded-full", role === 'perawat' ? "bg-blue-600" : "bg-violet-600")}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Sales Transactions List */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="w-2 h-6 bg-emerald-600 rounded-full" />
                  Daftar Transaksi Penjualan
                </h3>
              </div>
              <div className="overflow-x-auto border border-slate-100 rounded-3xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ID / Tanggal</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Detail Item</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Total (Rp)</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sales.length > 0 ? (
                      sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group/row">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-[10px] font-black text-slate-300 mb-1 uppercase">#{sale.id?.slice(-8)}</div>
                            <div className="text-xs font-bold text-slate-700">
                              {format(sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt), 'dd MMM yyyy, HH:mm')}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {sale.items.map((item, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-600">
                                  {item.name} x{item.quantity}
                                </span>
                              ))}
                            </div>
                            {sale.notes && sale.notes !== '-' && (
                              <p className="text-[9px] font-bold text-slate-400 italic">"{sale.notes}"</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-slate-900 font-mono text-right whitespace-nowrap">
                            Rp {(sale.total || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => handleUpdateNotes(sale.id!, sale.notes)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all focus:ring-2 focus:ring-blue-500/20"
                                title="Edit Catatan"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteSale(sale.id!)}
                                className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all focus:ring-2 focus:ring-red-500/20"
                                title="Hapus Transaksi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Tidak ada transaksi
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Stats Table */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
              <h3 className="font-black text-slate-800 tracking-tight mb-8 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-600 rounded-full" />
                Kontribusi per Kategori Tindakan
              </h3>
              <div className="overflow-hidden border border-slate-100 rounded-3xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kategori</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Total Komisi (Rp)</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Persentase</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.categories.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group/row">
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">{c.name}</td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">Rp {(c.totalComm || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-xs font-black text-slate-400 text-right font-mono">
                          {stats.jasa > 0 ? (((c.totalComm || 0) / stats.jasa) * 100).toFixed(1) : '0'}%
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => setEditingCategory({ originalName: c.name, currentName: c.name })}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all focus:ring-2 focus:ring-blue-500/20"
                              title="Edit Kategori"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setDeletingCategoryName(c.name)}
                              className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all focus:ring-2 focus:ring-red-500/20"
                              title="Hapus Kategori"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        <AnimatePresence>
          {editingSale && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
              >
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-6 bg-blue-600 rounded-full" />
                      <h3 className="text-lg font-black text-slate-800 tracking-tight">
                        Edit Catatan Transaksi
                      </h3>
                    </div>
                    <button 
                      onClick={() => setEditingSale(null)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-medium">Ubah catatan untuk transaksi ini di bawah:</p>
                    <textarea 
                      value={editingSale.notes}
                      onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })}
                      placeholder="Masukkan catatan baru..."
                      className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setEditingSale(null)}
                    className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => confirmUpdateNotes(editingSale.notes)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/10 transition-colors"
                  >
                    Simpan Catatan
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {deletingSaleId && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden"
              >
                <div className="p-6 sm:p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Hapus Transaksi?</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan dan akan mempengaruhi laporan upah serta komisi anggota tim.
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
                  <button 
                    onClick={() => setDeletingSaleId(null)}
                    className="flex-1 py-2.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors text-center"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmDeleteSale}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/10 transition-colors text-center"
                  >
                    Hapus
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {editingCategory && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
              >
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-6 bg-blue-600 rounded-full" />
                      <h3 className="text-lg font-black text-slate-800 tracking-tight">
                        Edit Kategori
                      </h3>
                    </div>
                    <button 
                      onClick={() => setEditingCategory(null)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-medium font-sans">Ubah nama untuk kategori "{editingCategory.originalName}":</p>
                    <input 
                      type="text"
                      value={editingCategory.currentName}
                      onChange={(e) => setEditingCategory({ ...editingCategory, currentName: e.target.value })}
                      placeholder="Masukkan nama kategori baru..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setEditingCategory(null)}
                    className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => confirmUpdateCategory(editingCategory.currentName)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/10 transition-colors"
                  >
                    Simpan Kategori
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {deletingCategoryName && (() => {
            const remainingCats = procedureCategories.filter(cat => cat.name !== deletingCategoryName);
            const computedFallbackCatName = remainingCats.find(cat => cat.name === 'Umum' || cat.name === 'Jasa Medis')?.name 
              || remainingCats[0]?.name 
              || 'Umum';
            return (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 pointer-events-auto"
              >
                <motion.div 
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 15 }}
                  className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden"
                >
                  <div className="p-6 sm:p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Hapus Kategori?</h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Apakah Anda yakin ingin menghapus kategori "{deletingCategoryName}"? Tindakan ini akan memindahkan semua produk dan item transaksi yang menggunakan kategori ini ke kategori "{computedFallbackCatName}".
                      </p>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
                    <button 
                      onClick={() => setDeletingCategoryName(null)}
                      className="flex-1 py-2.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors text-center"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={confirmDeleteCategory}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/10 transition-colors text-center"
                    >
                      Hapus
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, textColor = "text-white" }: { title: string, value: number, icon: React.ReactNode, color: string, textColor?: string }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative group overflow-hidden transition-all hover:scale-[1.02]">
      <div className="relative z-10 space-y-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">{title}</h4>
          <div className={cn("text-xl font-black font-mono tracking-tighter", textColor === 'text-white' ? 'text-slate-900' : textColor)}>
            Rp {Math.round(value || 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
