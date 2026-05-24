import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, orderBy, where, getDocs, deleteDoc, doc, updateDoc, addDoc, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { SaleTransaction, UserProfile, CartItem } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, BarChart3, 
  Calendar, ArrowUpRight, ArrowDownRight, Activity, Award, User,
  Stethoscope, Briefcase, ChevronDown, Check, Printer, Download, Share2, ArrowUpDown,
  Trash2, Edit3, Search, Plus, Percent, AlertCircle, ShoppingBag, HardDrive, Package, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#0891b2', '#f97316', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

interface DoctorCardProps {
  key?: React.Key;
  doctor: UserProfile;
  allSales: SaleTransaction[];
  employees: any[];
  onViewMore: (id: string) => void;
}

function DoctorCard({ doctor, allSales, employees, onViewMore }: DoctorCardProps) {
  const stats = useMemo(() => {
    const doctorSales = allSales.filter(s => s.doctorId === doctor.uid);
    const employee = employees.find(e => e.userId === doctor.uid);

    let jasaMedis = 0;
    let omsetKotor = 0;
    
    doctorSales.forEach(sale => {
      sale.items.forEach(item => {
        let itemCommission = 0;
        const sharingType = item.sharingType || 'percentage';
        const commissionVal = item.doctorCommission || 0;

        if (sharingType === 'percentage') {
          itemCommission = (item.price * item.quantity * commissionVal) / 100;
        } else {
          const multiplier = (commissionVal > 0 && commissionVal < 1000) ? 1000 : 1;
          itemCommission = commissionVal * multiplier * item.quantity;
        }

        itemCommission = Math.round(itemCommission);
        jasaMedis += itemCommission;
        omsetKotor += (item.price * item.quantity);
      });
    });

    const ud = employee?.salary || 0;
    const totalUpah = jasaMedis + ud;
    const labaKlinik = omsetKotor - totalUpah;

    return { totalUpah, omsetKotor, jasaMedis, ud, labaKlinik };
  }, [allSales, doctor.uid, employees]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-cyan-900/5 transition-all duration-500"
    >
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-100 group-hover:border-cyan-500/20 transition-colors bg-slate-50 flex items-center justify-center text-slate-300">
                {doctor.photoURL ? (
                  <img src={doctor.photoURL} alt={doctor.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-8 h-8" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-cyan-600 rounded-lg flex items-center justify-center border-2 border-white text-white">
                <Check className="w-3 h-3" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1.5 truncate">{doctor.displayName}</h3>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-cyan-50 text-cyan-600 text-[8px] font-black uppercase tracking-widest rounded-md border border-cyan-100">
                  {doctor.specialization || 'Dokter Umum'}
                </span>
              </div>
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => onViewMore(doctor.uid)}
            className="p-3 bg-slate-50 hover:bg-cyan-600 text-slate-400 hover:text-white rounded-2xl transition-all shadow-sm border border-slate-100 group/btn shrink-0"
          >
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </motion.button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="p-5 bg-cyan-600 rounded-[2rem] text-white shadow-lg shadow-cyan-900/20 relative overflow-hidden group/earning">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-2xl group-hover/earning:scale-110 transition-transform duration-700" />
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase text-cyan-100 tracking-[0.2em] mb-2 drop-shadow-sm">Total Estimasi Pendapatan</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono">Rp {stats.totalUpah.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-cyan-100 opacity-60">/ Bulan</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-cyan-200">
                <div className="flex flex-col gap-0.5">
                  <span className="opacity-60">Gaji Pokok</span>
                  <span>Rp {stats.ud.toLocaleString()}</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="opacity-60">Komisi Jasa</span>
                  <span>Rp {stats.jasaMedis.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Omset Kotor</p>
              <p className="text-sm font-black text-slate-900 font-mono">Rp {stats.omsetKotor.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-cyan-50/30 rounded-2xl border border-cyan-100">
            <div>
              <p className="text-[8px] font-black uppercase text-cyan-600 tracking-widest mb-1">Margin Klinik</p>
              <p className="text-sm font-black text-cyan-700 font-mono">Rp {stats.labaKlinik.toLocaleString()}</p>
            </div>
            <Activity className="w-4 h-4 text-cyan-600" />
          </div>
        </div>

        <button 
          onClick={() => onViewMore(doctor.uid)}
          className="w-full py-4 bg-slate-900 hover:bg-cyan-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-slate-900/10 hover:shadow-cyan-900/20 transition-all active:scale-[0.98]"
        >
          Lihat Laporan Khusus
        </button>
      </div>
    </motion.div>
  );
}

export default function DoctorReport() {
  const { profile } = useAuth();
  const { products: allProducts, users, categories: procedureCategories, employees } = useData();
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'master'>('grid');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [allSales, setAllSales] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<any[]>([]);
  const [catSortConfig, setCatSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'totalWage', direction: 'desc' });
  const [treatmentSortConfig, setTreatmentSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'totalWage', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);
  const [editingProcedureId, setEditingProcedureId] = useState<string | null>(null);
  const [procedureForm, setProcedureForm] = useState({
    name: '',
    shortName: '',
    category: 'Jasa Medis',
    type: 'service',
    price: 0,
    sharingType: 'percentage',
    doctorCommission: 0,
    nurseCommission: 0,
    adminCommission: 0,
    ownerCommission: 0,
    financeCommission: 0,
    color: 'bg-blue-400'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<{ id: string, notes: string } | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ originalName: string, currentName: string } | null>(null);
  const [deletingCategoryName, setDeletingCategoryName] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Derived from DataContext
  const doctors = useMemo(() => users.filter(u => u.role === 'dokter'), [users]);

  const handleAddNewProcedure = () => {
    setProcedureForm({
      name: '',
      shortName: '',
      category: procedureCategories[0]?.name || 'Jasa Medis',
      type: 'service',
      price: 0,
      sharingType: 'percentage',
      doctorCommission: 0,
      nurseCommission: 0,
      adminCommission: 0,
      ownerCommission: 0,
      financeCommission: 0,
      color: 'bg-blue-400'
    });
    setEditingProcedureId(null);
    setFormError(null);
    setIsProcedureModalOpen(true);
  };

  const confirmDeleteProcedure = async () => {
    if (!deletingProductId) return;
    try {
      await deleteDoc(doc(db, 'products', deletingProductId));
      setDeletingProductId(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `products/${deletingProductId}`);
    }
  };

  const handleSaveProcedure = async () => {
    if (!procedureForm.name || !procedureForm.category || procedureForm.price < 0) {
      setFormError('Nama, kategori, dan harga wajib diisi');
      return;
    }

    try {
      if (editingProcedureId) {
        await updateDoc(doc(db, 'products', editingProcedureId), {
          ...procedureForm,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...procedureForm,
          createdAt: new Date(),
          stock: 0
        });
      }
      setIsProcedureModalOpen(false);
      setEditingProcedureId(null);
      setProcedureForm({
        name: '',
        shortName: '',
        category: procedureCategories[0]?.name || 'Jasa Medis',
        type: 'service',
        price: 0,
        sharingType: 'percentage',
        doctorCommission: 0,
        nurseCommission: 0,
        adminCommission: 0,
        ownerCommission: 0,
        financeCommission: 0,
        color: 'bg-blue-400'
      });
      setFormError(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'products');
    }
  };

  const handleEditProcedure = (item: any) => {
    setProcedureForm({
      name: item.name || '',
      shortName: item.shortName || '',
      category: item.category || procedureCategories[0]?.name || 'Jasa Medis',
      type: item.type || 'service',
      price: item.price || 0,
      sharingType: item.sharingType || 'percentage',
      doctorCommission: item.doctorCommission || 0,
      nurseCommission: item.nurseCommission || 0,
      adminCommission: item.adminCommission || 0,
      ownerCommission: item.ownerCommission || 0,
      financeCommission: item.financeCommission || 0,
      color: item.color || 'bg-blue-400'
    });
    setEditingProcedureId(item.id);
    setIsProcedureModalOpen(true);
  };

  const handleExportTreatmentsCSV = () => {
    if (!stats || !stats.treatments) return;
    
    const headers = ['Nama Tindakan', 'Kategori', 'Jumlah (Qty)', 'Total Jasa Medis (Rp)', 'Persentase (%)'];
    const rows = stats.treatments.map(t => [
      t.name,
      t.category,
      t.count,
      t.totalWage,
      stats.jasaMedis > 0 ? ((t.totalWage / stats.jasaMedis) * 100).toFixed(1) : '0'
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
      link.setAttribute('download', `tindakan_medis_${stats.doctorName.replace(/\s+/g, '_')}_${format(period, 'MMM_yyyy')}.csv`);
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
      // 1. Delete matching from master categories
      const masterCat = procedureCategories.find(cat => cat.name === deletingCategoryName);
      if (masterCat) {
        await deleteDoc(doc(db, 'categories', masterCat.id));
      }

      // 2. Move products to 'Jasa Medis'
      const productsToUpdate = allProducts.filter(p => p.category === deletingCategoryName);
      for (const p of productsToUpdate) {
        await updateDoc(doc(db, 'products', p.id), { category: 'Jasa Medis' });
      }

      // 3. Move sales items to 'Jasa Medis'
      const salesToUpdate = allSales.filter(s => s.items.some(item => (item.category || 'Lainnya') === deletingCategoryName));
      for (const s of salesToUpdate) {
        const updatedItems = s.items.map(item => {
          if ((item.category || 'Lainnya') === deletingCategoryName) {
            return { ...item, category: 'Jasa Medis' };
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

  // Fetch all sales for the period to calculate summaries for both grid and detail
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const start = startOfMonth(period);
    const end = endOfMonth(period);

    // Query by createdAt range only to avoid compound index errors
    const salesQ = query(
      collection(db, 'sales'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc'),
      limit(400)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      let filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleTransaction));
      
      // If not admin/owner/keuangan, filter only own doctor sales programmatically in memory
      if (!(profile.role === 'admin' || profile.role === 'owner' || profile.role === 'keuangan')) {
        filtered = filtered.filter(s => s.doctorId === profile.uid);
      }
      
      setAllSales(filtered);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      setLoading(false);
    });

    return () => unsubSales();
  }, [period, profile]);

  // Fetch attendance for the specific doctor ONLY when in detail view
  useEffect(() => {
    if (viewMode !== 'detail' || !selectedDoctorId) return;

    const start = startOfMonth(period);
    const end = endOfMonth(period);

    const attQ = query(
      collection(db, 'attendance'), 
      where('userId', '==', selectedDoctorId),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );
    getDocs(attQ).then(snap => {
      setAttendance(snap.docs.map(d => d.data()));
    }).catch(error => {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    });
  }, [selectedDoctorId, period, viewMode]);

  // Specific doctor sales for detail view
  const sales = useMemo(() => {
    return allSales.filter(s => s.doctorId === selectedDoctorId);
  }, [allSales, selectedDoctorId]);

  // Calculations for detail view
  const stats = useMemo(() => {
    if (!selectedDoctorId || viewMode !== 'detail') return null;

    const doctorUser = doctors.find(d => d.uid === selectedDoctorId);
    const employee = employees.find(e => e.userId === selectedDoctorId);

    let jasaMedis = 0;
    let omsetKotor = 0;
    let totalDiscount = 0;
    let omsetBersih = 0;
    
    // Group sales by day for charts
    const dailyData: { [key: string]: { date: Date, totalWage: number, revenue: number } } = {};
    const treatmentStats: { [key: string]: { id: string, name: string, category: string, totalWage: number, count: number, details: any } } = {};
    const categoryStats: { [key: string]: { name: string, totalWage: number } } = {};

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
        dailyData[dateKey] = { date: saleDate, totalWage: 0, revenue: 0 };
      }

      let saleCommission = 0;
      sale.items.forEach(item => {
        let itemCommission = 0;
        const sharingType = item.sharingType || 'percentage';
        const commissionVal = item.doctorCommission || 0;

        if (sharingType === 'percentage') {
          itemCommission = (item.price * item.quantity * commissionVal) / 100;
        } else {
          const multiplier = (commissionVal > 0 && commissionVal < 1000) ? 1000 : 1;
          itemCommission = commissionVal * multiplier * item.quantity;
        }

        itemCommission = Math.round(itemCommission);
        saleCommission += itemCommission;
        jasaMedis += itemCommission;
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

        // Group by treatment
        if (!treatmentStats[item.id]) {
          treatmentStats[item.id] = { id: item.id, name: item.name, category: finalCat, totalWage: 0, count: 0, details: item };
        }
        treatmentStats[item.id].totalWage += itemCommission;
        treatmentStats[item.id].count += item.quantity;

        // Group by category
        if (!categoryStats[finalCat]) {
          categoryStats[finalCat] = { name: finalCat, totalWage: 0 };
        }
        categoryStats[finalCat].totalWage += itemCommission;
      });

      dailyData[dateKey].totalWage += saleCommission;
      dailyData[dateKey].revenue += sale.total;
      totalDiscount += (sale.discount || 0);
    });

    omsetBersih = omsetKotor - totalDiscount;

    // Calculate UD (Uang Duduk)
    let totalHours = attendance.reduce((acc, curr) => acc + (curr.hoursWorked || 0), 0);
    const hourlyRate = employee?.hourlyRate || 20000;
    const baseSalary = employee?.salary || 0;
    const attendanceBonus = Math.round(totalHours * hourlyRate);

    // UD in the screenshot seems to be the monthly base salary or a combination. 
    // Let's call baseSalary "UD Dokter Per Bulan" as per the screenshot context if it's fixed.
    // Or if UD is the attendance bonus.
    const udPerBulan = baseSalary; 

    const totalUpah = jasaMedis + udPerBulan;

    return {
      totalUpah,
      omsetKotor,
      jasaMedis,
      udPerBulan,
      totalDiscount,
      omsetBersih,
      avgUpahPerHari: totalUpah / (attendance.length || 1),
      persentaseOmset: (omsetBersih / omsetKotor) * 100,
      dailyTrend: Object.values(dailyData).sort((a, b) => a.date.getTime() - b.date.getTime()).map(d => ({
        name: format(d.date, 'd MMM'),
        wage: d.totalWage,
        revenue: d.revenue
      })),
      treatments: Object.values(treatmentStats).sort((a, b) => b.totalWage - a.totalWage),
      categories: Object.values(categoryStats),
      doctorName: doctorUser?.displayName || 'Dokter'
    };
  }, [sales, selectedDoctorId, doctors, employees, attendance, allProducts, procedureCategories]);

  const sortedTreatments = useMemo(() => {
    if (!stats) return [];
    let items = [...stats.treatments];
    
    // Filter by searchTerm if in detail mode
    if (viewMode === 'detail' && searchTerm) {
      items = items.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    items.sort((a: any, b: any) => {
      const aVal = a[treatmentSortConfig.key];
      const bVal = b[treatmentSortConfig.key];
      if (aVal < bVal) return treatmentSortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return treatmentSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [stats?.treatments, treatmentSortConfig, searchTerm, viewMode]);

  const sortedCategories = useMemo(() => {
    if (!stats) return [];
    const items = [...stats.categories];
    items.sort((a: any, b: any) => {
      const aVal = a[catSortConfig.key];
      const bVal = b[catSortConfig.key];
      if (aVal < bVal) return catSortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return catSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [stats?.categories, catSortConfig]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter(doctor => 
      doctor.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doctor.specialization || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [doctors, searchTerm]);

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-cyan-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Menyusun Laporan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 sm:p-8 custom-scrollbar font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-50/50 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-cyan-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-cyan-900/20">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {viewMode === 'grid' ? 'Pusat Analitik Dokter' : 'Laporan Detail Per Dokter'}
                </h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                  {viewMode === 'grid' ? 'Ringkasan performa kolektif tim medis' : 'Ringkasan kinerja, pendapatan, dan kontribusi tindakan'}
                </p>
              </div>
            </div>
          </div>

            <div className="flex flex-wrap items-center gap-4 relative z-10 text-slate-600">
              <button 
                onClick={handleAddNewProcedure}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah Tindakan Baru
              </button>

            {viewMode !== 'grid' && (
              <button 
                onClick={() => setViewMode('grid')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-slate-200"
              >
                Kembali ke Ringkasan
              </button>
            )}

            {viewMode === 'grid' && (
              <button 
                onClick={() => setViewMode('master')}
                className="bg-white hover:bg-slate-50 text-slate-600 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-slate-200 flex items-center gap-2"
              >
                <HardDrive className="w-4 h-4" /> Katalog Master
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
                  className="bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-10 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 appearance-none cursor-pointer"
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
                  className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-cyan-600 rounded-2xl transition-all border border-slate-100 shadow-sm"
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
            {/* Search Bar */}
            <div className="max-w-md">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-600 transition-colors" />
                <input 
                  type="text"
                  placeholder="Cari nama dokter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200/60 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredDoctors.map(doctor => (
                <DoctorCard 
                  key={doctor.uid} 
                  doctor={doctor} 
                  allSales={allSales} 
                  employees={employees}
                  onViewMore={(id) => {
                    setSelectedDoctorId(id);
                    setViewMode('detail');
                  }}
                />
              ))}
              {filteredDoctors.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">
                    {searchTerm ? 'Dokter tidak ditemukan' : 'Belum ada dokter terdaftar'}
                  </h3>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'master' ? (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Katalog Master Tindakan & Produk</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola daftar layanan dan skema komisi</p>
                </div>
                <div className="max-w-xs w-full">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Cari tindakan..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-[10px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden border border-slate-100 rounded-3xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Nama / Tipe</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Kategori</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Harga</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Dr (%)</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Nr (%)</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allProducts
                        .filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group/row">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm",
                                  product.type === 'product' ? 'bg-orange-500' : 'bg-cyan-600'
                                )}>
                                  {product.type === 'product' ? <Package className="w-4 h-4" /> : <Stethoscope className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="text-xs font-black text-slate-900">{product.name}</div>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase">{product.type === 'product' ? 'Produk' : 'Layanan'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg border border-slate-200">
                                  {product.category}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-black text-slate-900 font-mono text-right">
                              Rp {product.price?.toLocaleString() || 0}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-blue-600 text-right">
                              {product.doctorCommission}{product.sharingType === 'fixed' ? 'rb' : '%'}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-emerald-600 text-right">
                              {product.nurseCommission}{product.sharingType === 'fixed' ? 'rb' : '%'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleEditProcedure(product)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if(window.confirm('Hapus tindakan ini?')) {
                                      await deleteDoc(doc(db, 'products', product.id));
                                    }
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
            </div>
          </div>
        ) : stats ? (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard 
                title="Total Upah Dokter" 
                value={stats.totalUpah} 
                icon={<DollarSign className="w-5 h-5 text-white" />}
                color="bg-cyan-600"
                secondary={`Rp ${stats.totalUpah.toLocaleString()}`}
              />
              <StatCard 
                title="Total Omset Dokter" 
                value={stats.omsetKotor} 
                icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                color="bg-emerald-50"
                textColor="text-emerald-700"
                secondary={`Rp ${stats.omsetKotor.toLocaleString()}`}
              />
              <StatCard 
                title="Jasa Medis Dokter" 
                value={stats.jasaMedis} 
                icon={<Award className="w-5 h-5 text-purple-600" />}
                color="bg-purple-50"
                textColor="text-purple-700"
                secondary={`Rp ${stats.jasaMedis.toLocaleString()}`}
              />
              <StatCard 
                title="UD Dokter Per Bulan" 
                value={stats.udPerBulan} 
                icon={<Briefcase className="w-5 h-5 text-orange-600" />}
                color="bg-orange-50"
                textColor="text-orange-700"
                secondary={`Rp ${stats.udPerBulan.toLocaleString()}`}
              />
              <StatCard 
                title="Rata-rata Upah/Hari" 
                value={stats.avgUpahPerHari} 
                icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
                color="bg-blue-50"
                textColor="text-blue-700"
                secondary={`Rp ${Math.round(stats.avgUpahPerHari).toLocaleString()}`}
              />
            </div>

            {/* Discount Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
               <SummaryMiniCard title="Biaya Sebelum Diskon" value={stats.omsetKotor} />
               <SummaryMiniCard title="Biaya Setelah Diskon" value={stats.omsetBersih} />
               <SummaryMiniCard title="Total Diskon" value={stats.totalDiscount} highlight />
               <SummaryMiniCard title="Selisih Sebelum - Sesudah" value={stats.totalDiscount} />
               <SummaryMiniCard title="Efisiensi Biaya" value={stats.omsetBersih / stats.omsetKotor * 100} isPercent />
            </div>

            {/* Middle Section: Trends & Composition */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend Chart */}
              <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-800 tracking-tight">Trend Upah Dokter Per Hari</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Bulan {months[period.getMonth()]}</p>
                  </div>
                  <Activity className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="h-48 md:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '10px' }}
                      />
                      <Line type="monotone" dataKey="wage" stroke="#0891b2" strokeWidth={3} dot={{ r: 4, fill: '#0891b2' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Composition Donut Chart */}
              <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
                <div className="text-center">
                  <h3 className="font-black text-slate-800 tracking-tight">Komposisi Upah Dokter</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Jasa Medis vs UD</p>
                </div>
                <div className="h-64 md:h-80 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Jasa Medis', value: stats.jasaMedis },
                          { name: 'UD Dokter', value: stats.udPerBulan }
                        ]}
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={10}
                        dataKey="value"
                      >
                        <Cell fill="#0891b2" />
                        <Cell fill="#f97316" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Upah</span>
                    <span className="text-lg font-black text-slate-900 font-mono">Rp {stats.totalUpah.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#0891b2]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jasa Medis ({(stats.jasaMedis / stats.totalUpah * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f97316]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UD ({(stats.udPerBulan / stats.totalUpah * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

               {/* Wage Bar Chart */}
               <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-800 tracking-tight">Upah Dokter Per Hari (Bar)</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sebaran Harian</p>
                  </div>
                  <BarChart3 className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="h-48 md:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '10px' }}
                      />
                      <Bar dataKey="wage" fill="#0891b2" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom Row Tables & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tables Container */}
              <div className="space-y-6">
                {/* Ringkasan Perhitungan */}
                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <h3 className="font-black text-slate-800 tracking-tight mb-6 flex items-center gap-2">
                    <span className="w-2 h-6 bg-cyan-600 rounded-full" />
                    Ringkasan Perhitungan Upah Dokter
                  </h3>
                  <div className="overflow-hidden border border-slate-100 rounded-3xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Komponen</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Jumlah (Rp)</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Persentase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        <tr>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">Jasa Medis Dokter</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">Rp {stats.jasaMedis.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs font-black text-slate-400 text-right">{(stats.jasaMedis / stats.totalUpah * 100).toFixed(1)}%</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">UD Dokter per Bulan</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">Rp {stats.udPerBulan.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs font-black text-slate-400 text-right">{(stats.udPerBulan / stats.totalUpah * 100).toFixed(1)}%</td>
                        </tr>
                        <tr className="bg-cyan-50/30">
                          <td className="px-6 py-5 text-xs font-black text-cyan-600 uppercase tracking-widest">Total Upah Dokter</td>
                          <td className="px-6 py-5 text-sm font-black text-cyan-700 font-mono text-right">Rp {stats.totalUpah.toLocaleString()}</td>
                          <td className="px-6 py-5 text-xs font-black text-cyan-500 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ringkasan Biaya Tindakan */}
                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <h3 className="font-black text-slate-800 tracking-tight mb-6 flex items-center gap-2">
                    <span className="w-2 h-6 bg-slate-900 rounded-full" />
                    Ringkasan Biaya Tindakan (Omset)
                  </h3>
                  <div className="overflow-hidden border border-slate-100 rounded-3xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Keterangan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Jumlah (Rp)</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Persentase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        <tr>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">Biaya Sebelum Diskon</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">Rp {stats.omsetKotor.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs font-black text-slate-400 text-right">100%</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700 text-emerald-600">Biaya Setelah Diskon</td>
                          <td className="px-6 py-4 text-xs font-mono text-emerald-600 text-right">Rp {stats.omsetBersih.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs font-black text-emerald-500 text-right">{(stats.omsetBersih / stats.omsetKotor * 100).toFixed(1)}%</td>
                        </tr>
                        <tr className="bg-red-50/30">
                          <td className="px-6 py-4 text-xs font-bold text-red-600">Total Diskon</td>
                          <td className="px-6 py-4 text-xs font-mono text-red-600 text-right">Rp {stats.totalDiscount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs font-black text-red-500 text-right">{(stats.totalDiscount / stats.omsetKotor * 100).toFixed(1)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Daftar Transaksi Penjualan */}
                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <span className="w-2 h-6 bg-emerald-600 rounded-full" />
                      Daftar Transaksi Penjualan
                    </h3>
                  </div>
                  <div className="overflow-hidden border border-slate-100 rounded-3xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">ID / Tanggal</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Detail Item</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Total</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {sales.length > 0 ? (
                            sales.map((sale) => (
                              <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group/row">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">#{sale.id?.slice(-8)}</div>
                                  <div className="text-xs font-bold text-slate-700">
                                    {format(sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt), 'dd MMM yyyy, HH:mm')}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {sale.items.map((item, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600 border border-slate-200">
                                        {item.name} x{item.quantity}
                                      </span>
                                    ))}
                                  </div>
                                  {sale.notes && sale.notes !== '-' && (
                                    <p className="text-[9px] font-bold text-slate-400 italic">"{sale.notes}"</p>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-xs font-black text-slate-900 font-mono text-right whitespace-nowrap">
                                  Rp {sale.total.toLocaleString()}
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
                              <td colSpan={4} className="px-6 py-12 text-center">
                                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Tidak ada transaksi dalam periode ini</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Detail Kontribusi Per Kategori */}
                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <h3 className="font-black text-slate-800 tracking-tight mb-6 flex items-center gap-2">
                    <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                    Detail Kontribusi Jasa Medis Per Kategori
                  </h3>
                  <div className="overflow-hidden border border-slate-100 rounded-3xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th 
                            className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest cursor-pointer hover:text-slate-900 transition-colors group"
                            onClick={() => setCatSortConfig({ key: 'name', direction: catSortConfig.key === 'name' && catSortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                          >
                            <div className="flex items-center gap-2">
                              Kategori
                              <ArrowUpDown className={cn("w-3 h-3 text-slate-300", catSortConfig.key === 'name' && "text-indigo-600")} />
                            </div>
                          </th>
                          <th 
                            className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right cursor-pointer hover:text-slate-900 transition-colors group"
                            onClick={() => setCatSortConfig({ key: 'totalWage', direction: catSortConfig.key === 'totalWage' && catSortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                          >
                            <div className="flex items-center justify-end gap-2">
                              Upah (Rp)
                              <ArrowUpDown className={cn("w-3 h-3 text-slate-300", catSortConfig.key === 'totalWage' && "text-indigo-600")} />
                            </div>
                          </th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Persentase</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedCategories.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors group/row">
                            <td className="px-6 py-4 text-xs font-bold text-slate-700">{c.name}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">Rp {c.totalWage.toLocaleString()}</td>
                            <td className="px-6 py-4 text-xs font-black text-slate-400 text-right font-mono">
                              {stats.jasaMedis > 0 ? ((c.totalWage / stats.jasaMedis) * 100).toFixed(1) : '0.0'}%
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
              </div>

               {/* Right Side: Contribution Charts */}
               <div className="space-y-8">
                  {/* Top 10 Treatments */}
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-200/60 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-black text-slate-800 tracking-tight">10 Tindakan Kontribusi Upah Tertinggi</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Peringkat Berdasarkan Jasa Medis</p>
                      </div>
                      <button 
                        onClick={handleExportTreatmentsCSV}
                        className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-cyan-600 rounded-2xl transition-all border border-slate-100 shadow-sm"
                        title="Export CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-5">
                      {stats.treatments.slice(0, 10).map((t, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">{idx + 1}</span>
                              <span className="text-slate-700 truncate max-w-[200px]">{t.name}</span>
                            </div>
                            <span className="text-cyan-600 font-mono">Rp {t.totalWage.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(t.totalWage / stats.treatments[0].totalWage) * 100}%` }}
                              className="h-full bg-cyan-600 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Distribution per Category */}
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-200/60 shadow-sm space-y-8">
                    <div>
                      <h3 className="font-black text-slate-800 tracking-tight">Upah Dokter per Jenis Tindakan (Kategori)</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Distribusi Proporsional</p>
                    </div>
                    <div className="flex items-center justify-center h-64 md:h-80 relative">
                       <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                           <Pie
                              data={stats.categories}
                              innerRadius={60}
                              outerRadius={85}
                              dataKey="totalWage"
                              paddingAngle={5}
                            >
                              {stats.categories.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                         </PieChart>
                       </ResponsiveContainer>
                       <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Top Kategori</span>
                          <span className="text-sm font-black text-slate-900">{stats.categories[0]?.name}</span>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {stats.categories.slice(0, 4).map((c, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                           <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                           <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-tight">{c.name}</p>
                              <p className="text-[10px] font-black text-slate-900 font-mono">Rp {c.totalWage.toLocaleString()} ({(c.totalWage / stats.jasaMedis * 100).toFixed(0)}%)</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>

            {/* Full Treatments Table */}
            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm mt-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="w-2 h-6 bg-cyan-600 rounded-full" />
                  Daftar Lengkap Tindakan Medis
                </h3>
                <div className="max-w-xs w-full">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Cari tindakan..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-transparent transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-hidden border border-slate-100 rounded-3xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest cursor-pointer hover:text-slate-900 transition-colors group"
                          onClick={() => setTreatmentSortConfig({ key: 'name', direction: treatmentSortConfig.key === 'name' && treatmentSortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                        >
                          <div className="flex items-center gap-2 text-[10px]">
                            Nama Tindakan
                            <ArrowUpDown className={cn("w-3 h-3 text-slate-300", treatmentSortConfig.key === 'name' && "text-cyan-600")} />
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest cursor-pointer hover:text-slate-900 transition-colors group whitespace-nowrap"
                          onClick={() => setTreatmentSortConfig({ key: 'category', direction: treatmentSortConfig.key === 'category' && treatmentSortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                        >
                          <div className="flex items-center gap-2">
                            Kategori
                            <ArrowUpDown className={cn("w-3 h-3 text-slate-300", treatmentSortConfig.key === 'category' && "text-cyan-600")} />
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right cursor-pointer hover:text-slate-900 transition-colors group whitespace-nowrap"
                          onClick={() => setTreatmentSortConfig({ key: 'count', direction: treatmentSortConfig.key === 'count' && treatmentSortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Qty
                            <ArrowUpDown className={cn("w-3 h-3 text-slate-300", treatmentSortConfig.key === 'count' && "text-cyan-600")} />
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right cursor-pointer hover:text-slate-900 transition-colors group whitespace-nowrap"
                          onClick={() => setTreatmentSortConfig({ key: 'totalWage', direction: treatmentSortConfig.key === 'totalWage' && treatmentSortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Total Komisi (Rp)
                            <ArrowUpDown className={cn("w-3 h-3 text-slate-300", treatmentSortConfig.key === 'totalWage' && "text-cyan-600")} />
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right cursor-pointer hover:text-slate-900 transition-colors group whitespace-nowrap"
                          onClick={() => setTreatmentSortConfig({ key: 'totalWage', direction: treatmentSortConfig.key === 'totalWage' && treatmentSortConfig.direction === 'desc' ? 'asc' : 'desc' })}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Persen
                            <ArrowUpDown className={cn("w-3 h-3 text-slate-300", treatmentSortConfig.key === 'totalWage' && "text-cyan-600")} />
                          </div>
                        </th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedTreatments.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group/row">
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">{t.name}</td>
                          <td className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-tight">{t.category}</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">{t.count}</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">Rp {t.totalWage.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs font-black text-slate-400 text-right">
                            {stats.jasaMedis > 0 ? ((t.totalWage / stats.jasaMedis) * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => handleEditProcedure(t.details)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all focus:ring-2 focus:ring-blue-500/20"
                                title="Edit Tindakan"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setDeletingProductId(t.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all focus:ring-2 focus:ring-red-500/20"
                                title="Hapus Tindakan"
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
            </div>
          </>
        ) : null}

        <AnimatePresence>
          {isProcedureModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-cyan-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-cyan-900/20">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingProcedureId ? 'Edit Tindakan Medis' : 'Tambah Tindakan Medis'}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Konfigurasi produk/layanan & komisi</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setIsProcedureModalOpen(false);
                      setEditingProcedureId(null);
                    }}
                    className="p-3 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  {formError && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 animate-pulse">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-xs font-bold">{formError}</span>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nama & Identifikasi</label>
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          type="text" 
                          placeholder="Nama Tindakan (Misal: Scaling Dental)"
                          value={procedureForm.name}
                          onChange={e => setProcedureForm({ ...procedureForm, name: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-600 outline-none transition-all"
                        />
                        <input 
                          type="text" 
                          placeholder="Singkatan (Misal: SC)"
                          value={procedureForm.shortName}
                          onChange={e => setProcedureForm({ ...procedureForm, shortName: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Kategori & Tipe</label>
                        <div className="flex flex-col gap-3">
                           <select 
                            value={procedureForm.category}
                            onChange={e => setProcedureForm({ ...procedureForm, category: e.target.value })}
                            className="bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 appearance-none cursor-pointer w-full"
                          >
                            {procedureCategories.length === 0 && (
                              <option value="Jasa Medis">Jasa Medis</option>
                            )}
                            {procedureCategories.map(cat => (
                              <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
                          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                            <button 
                              onClick={() => setProcedureForm({ ...procedureForm, type: 'service' })}
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2",
                                procedureForm.type === 'service' ? "bg-white text-slate-900 shadow-md" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              <Stethoscope className="w-4 h-4" /> LAYANAN
                            </button>
                            <button 
                              onClick={() => setProcedureForm({ ...procedureForm, type: 'product' })}
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2",
                                procedureForm.type === 'product' ? "bg-white text-slate-900 shadow-md" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              <Package className="w-4 h-4" /> PRODUK
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Harga & Skema Komisi</label>
                        <div className="flex flex-col gap-3">
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                            <input 
                              type="number" 
                              placeholder="Harga"
                              value={procedureForm.price || ''}
                              onChange={e => setProcedureForm({ ...procedureForm, price: Number(e.target.value) })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-5 text-sm font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-600 outline-none transition-all font-mono"
                            />
                          </div>
                          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                            <button 
                              onClick={() => setProcedureForm({ ...procedureForm, sharingType: 'percentage' })}
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all",
                                procedureForm.sharingType === 'percentage' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                              )}
                            >PERSENTASE (%)</button>
                            <button 
                              onClick={() => setProcedureForm({ ...procedureForm, sharingType: 'fixed' })}
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all",
                                procedureForm.sharingType === 'fixed' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                              )}
                            >NOMINAL (Rp)</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 p-8 rounded-[2.5rem] border border-blue-100/50 space-y-6">
                      <h5 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] flex items-center gap-2">
                        <Percent className="w-4 h-4" /> Alokasi Komisi ({procedureForm.sharingType === 'fixed' ? 'x1000' : '%'})
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        <CommissionInput 
                          label="Dokter" 
                          value={procedureForm.doctorCommission} 
                          onChange={v => setProcedureForm({ ...procedureForm, doctorCommission: v })}
                          suffix={procedureForm.sharingType === 'fixed' ? 'rb' : '%'}
                        />
                        <CommissionInput 
                          label="Perawat" 
                          value={procedureForm.nurseCommission} 
                          onChange={v => setProcedureForm({ ...procedureForm, nurseCommission: v })}
                          suffix={procedureForm.sharingType === 'fixed' ? 'rb' : '%'}
                        />
                        <CommissionInput 
                          label="Admin" 
                          value={procedureForm.adminCommission} 
                          onChange={v => setProcedureForm({ ...procedureForm, adminCommission: v })}
                          suffix={procedureForm.sharingType === 'fixed' ? 'rb' : '%'}
                        />
                        <CommissionInput 
                          label="Owner" 
                          value={procedureForm.ownerCommission} 
                          onChange={v => setProcedureForm({ ...procedureForm, ownerCommission: v })}
                          suffix={procedureForm.sharingType === 'fixed' ? 'rb' : '%'}
                        />
                        <CommissionInput 
                          label="Keuangan" 
                          value={procedureForm.financeCommission} 
                          onChange={v => setProcedureForm({ ...procedureForm, financeCommission: v })}
                          suffix={procedureForm.sharingType === 'fixed' ? 'rb' : '%'}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4 shrink-0">
                  <button 
                    onClick={() => setIsProcedureModalOpen(false)}
                    className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleSaveProcedure}
                    className="px-10 py-4 bg-slate-900 hover:bg-cyan-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-95"
                  >
                    Simpan Tindakan
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

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
                    className="px-6 py-2.5 bg-blue-605 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/10 transition-colors"
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
                      Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan dan akan mempengaruhi laporan upah serta komisi dokter.
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

          {deletingCategoryName && (
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
                      Apakah Anda yakin ingin menghapus kategori "{deletingCategoryName}"? Tindakan ini akan memindahkan semua produk dan item transaksi yang menggunakan kategori ini ke kategori "Jasa Medis".
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
          )}

          {deletingProductId && (
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
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Hapus Tindakan?</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Apakah Anda yakin ingin menghapus tindakan medis ini dari katalog tindakan? Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
                  <button 
                    onClick={() => setDeletingProductId(null)}
                    className="flex-1 py-2.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors text-center"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmDeleteProcedure}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/10 transition-colors text-center"
                  >
                    Hapus
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CommissionInput({ label, value, onChange, suffix }: { label: string, value: number, onChange: (v: number) => void, suffix: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">{label}</label>
      <div className="relative">
        <input 
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-slate-900 focus:ring-2 focus:ring-cyan-600 outline-none transition-all pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">{suffix}</span>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, secondary, textColor = "text-white" }: { title: string, value: number, icon: React.ReactNode, color: string, secondary?: string, textColor?: string }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative group overflow-hidden transition-all hover:scale-[1.02]">
      <div className="relative z-10 space-y-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">{title}</h4>
          <div className={`text-xl font-black font-mono tracking-tighter ${textColor === 'text-white' ? 'text-slate-900' : textColor}`}>
            Rp {Math.round(value).toLocaleString()}
          </div>
          {secondary && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{secondary}</p>}
        </div>
      </div>
    </div>
  );
}

function SummaryMiniCard({ title, value, highlight, isPercent }: { title: string, value: number, highlight?: boolean, isPercent?: boolean }) {
  return (
    <div className={cn(
      "p-5 rounded-2xl border transition-all",
      highlight ? "bg-red-50 border-red-100" : "bg-white border-slate-100"
    )}>
      <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{title}</h4>
      <div className={cn(
        "text-sm font-black font-mono",
        highlight ? "text-red-600" : "text-slate-800"
      )}>
        {isPercent ? `${value.toFixed(2)}%` : `Rp ${Math.round(value).toLocaleString()}`}
      </div>
    </div>
  );
}
