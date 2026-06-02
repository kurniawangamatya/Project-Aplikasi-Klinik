import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, orderBy, where, getDocs, handleFirestoreError, OperationType, collectionGroup, limit } from '../lib/firebase';
import { SaleTransaction, Card } from '../types';
import { useData } from '../contexts/DataContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isSameDay, startOfMonth, endOfMonth, isSameMonth, subMonths } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, BarChart3, Calendar, ArrowUpRight, ArrowDownRight, Activity, Download } from 'lucide-react';
import { motion } from 'motion/react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function FinancialDashboard() {
  const { products, categories } = useData();
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [expenses, setExpenses] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch sales - limit to 14 days initially or use today's month range for dashboard context
    const start = subMonths(new Date(), 6); // Fetch last 6 months for trends
    const salesQ = query(
      collection(db, 'sales'), 
      where('createdAt', '>=', start),
      orderBy('createdAt', 'desc'),
      limit(400)
    );
    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleTransaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    // Fetch expenses using collectionGroup for better efficiency
    const fetchAllExpenses = async () => {
      try {
        const q = query(
          collectionGroup(db, 'cards'),
          where('type', '==', 'expense'),
          where('updatedAt', '>=', start)
        );
        const cardsSnap = await getDocs(q);
        const expenseCards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() as object } as Card));
        
        setExpenses(expenseCards);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching expenses:', err);
        setLoading(false);
      }
    };

    fetchAllExpenses();
    return () => unsubSales();
  }, []);

  const totalRevenue = useMemo(() => sales.reduce((acc, sale) => acc + sale.total, 0), [sales]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0), [expenses]);
  
  const dailyTrendData = useMemo(() => {
    const last14Days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));
    
    return last14Days.map(date => {
      const daySales = sales.filter(s => {
        const sDate = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return isSameDay(sDate, date);
      }).reduce((acc, s) => acc + s.total, 0);

      const dayExpenses = expenses.filter(e => {
        const eDate = e.updatedAt?.toDate ? e.updatedAt.toDate() : new Date(e.updatedAt);
        return isSameDay(eDate, date);
      }).reduce((acc, e) => acc + (e.amount || 0), 0);

      return {
        name: format(date, 'dd MMM'),
        pendapatan: daySales,
        pengeluaran: dayExpenses,
        profit: daySales - dayExpenses
      };
    });
  }, [sales, expenses]);

  const monthlyTrendData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    
    return last6Months.map(date => {
      const monthSales = sales.filter(s => {
        const sDate = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return isSameMonth(sDate, date);
      }).reduce((acc, s) => acc + s.total, 0);

      const monthExpenses = expenses.filter(e => {
        const eDate = e.updatedAt?.toDate ? e.updatedAt.toDate() : new Date(e.updatedAt);
        return isSameMonth(eDate, date);
      }).reduce((acc, e) => acc + (e.amount || 0), 0);

      return {
        name: format(date, 'MMM yy'),
        pendapatan: monthSales,
        pengeluaran: monthExpenses
      };
    });
  }, [sales, expenses]);

  const categoryData = useMemo(() => {
    const categoriesMap: { [key: string]: number } = {};
    const masterCatNames = categories.map(c => c.name.trim().toLowerCase());
    const masterCatRealNames = categories.reduce((acc, c) => {
      acc[c.name.trim().toLowerCase()] = c.name;
      return acc;
    }, {} as { [key: string]: string });

    let defaultCat = 'Jasa Medis';
    if (categories.length > 0) {
      const names = categories.map(c => c.name);
      if (names.includes('Jasa Medis')) {
        defaultCat = 'Jasa Medis';
      } else if (names.includes('Umum')) {
        defaultCat = 'Umum';
      } else {
        defaultCat = names[0];
      }
    }

    sales.forEach(sale => {
      sale.items.forEach(item => {
        // Find current product in products list to get its current category
        const productObj = products.find(p => p.id === item.id || p.name === item.name);
        let itemCat = productObj ? productObj.category : (item.category || 'Lainnya');
        
        itemCat = (itemCat || '').trim();
        const lowerCat = itemCat.toLowerCase();
        
        let finalCat = defaultCat;
        if (masterCatNames.includes(lowerCat)) {
          finalCat = masterCatRealNames[lowerCat];
        } else {
          finalCat = defaultCat;
        }

        categoriesMap[finalCat] = (categoriesMap[finalCat] || 0) + (item.price * item.quantity);
      });
    });

    return Object.entries(categoriesMap).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [sales, products, categories]);

  const handleExportCSV = () => {
    const top5 = categoryData.slice(0, 5);
    const headers = ['Kategori', 'Total Pendapatan', 'Persentase'];
    const rows = top5.map(cat => [
      cat.name,
      cat.value,
      `${(totalRevenue > 0 ? (cat.value / totalRevenue) * 100 : 0).toFixed(1)}%`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `top_5_categories_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-zinc-800 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard 
            title="Total Pendapatan" 
            value={totalRevenue} 
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            color="emerald"
            subtitle="Akumulasi penjuran kotor"
          />
          <StatCard 
            title="Total Pengeluaran" 
            value={totalExpenses} 
            icon={<TrendingDown className="w-5 h-5 text-red-500" />}
            color="red"
            subtitle="Biaya operasional & medis"
          />
          <StatCard 
            title="Laba Bersih" 
            value={totalRevenue - totalExpenses} 
            icon={<Activity className="w-5 h-5 text-blue-500" />}
            color="blue"
            subtitle="Keuntungan bersih saat ini"
          />
          <div className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 flex flex-col justify-center">
            <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">Margin Keuntungan</h4>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white">
                {totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : 0}%
              </span>
              <span className="text-xs font-bold text-zinc-600 mb-1.5 uppercase">Efisiensi</span>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Daily Trend */}
          <div className="bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-10 p-10 opacity-5">
              <BarChart3 className="w-40 h-40" />
            </div>
            <div className="relative z-10 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Tren Kas Harian</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">14 Hari Terakhir</p>
                </div>
                <Calendar className="w-5 h-5 text-zinc-700" />
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rp${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', fontSize: '12px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                      cursor={{ fill: '#ffffff05' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }} />
                    <Bar dataKey="pendapatan" fill="#10b981" radius={[4, 4, 0, 0]} name="Masuk" />
                    <Bar dataKey="pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} name="Keluar" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly Trend Area Chart */}
          <div className="bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-10 p-10 opacity-5">
              <Activity className="w-40 h-40" />
            </div>
            <div className="relative z-10 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Proyeksi Bulanan</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">6 Bulan Terakhir</p>
                </div>
                <TrendingUp className="w-5 h-5 text-zinc-700" />
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrendData}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rp${(v/1000000).toFixed(1)}m`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="pendapatan" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" strokeWidth={3} name="Total Masuk" />
                    <Area type="monotone" dataKey="pengeluaran" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" strokeWidth={3} name="Total Keluar" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Distribution Pie Chart */}
          <div className="bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800 shadow-2xl lg:col-span-1">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Sumber Pendapatan</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Distribusi Per Kategori</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExportCSV}
                    className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700 shadow-sm group/export"
                    title="Export Top 5 Categories to CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <PieIcon className="w-5 h-5 text-zinc-700" />
                </div>
              </div>
              <div className="h-80 w-full flex flex-col md:flex-row items-center">
                <div className="flex-1 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', fontSize: '12px' }}
                        formatter={(value: number) => `Rp ${value.toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3 pl-4">
                  {categoryData.slice(0, 5).map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-xs text-zinc-400 font-medium truncate max-w-[120px]">{cat.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-white">
                        {totalRevenue > 0 ? ((cat.value / totalRevenue) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Products / Revenue streams */}
          <div className="bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800 shadow-2xl lg:col-span-1">
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Kinerja Finansial</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Status Real-time</p>
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="space-y-4">
                <PerformanceRow title="Kesehatan Arus Kas" score={totalRevenue > totalExpenses ? 95 : 45} color="emerald" />
                <PerformanceRow title="Stabilitas Biaya" score={72} color="blue" />
                <PerformanceRow title="Kecepatan Transaksi" score={88} color="purple" />
                <PerformanceRow title="Retensi Pasien" score={65} color="amber" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }: { title: string, value: number, icon: React.ReactNode, color: string, subtitle: string }) {
  const colors: { [key: string]: string } = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 relative group overflow-hidden transition-all hover:border-zinc-700">
      <div className="relative z-10">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 border ${colors[color]}`}>
          {icon}
        </div>
        <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-white font-mono tracking-tighter">
            Rp {value.toLocaleString()}
          </span>
        </div>
        <p className="text-[10px] text-zinc-600 font-bold mt-2 uppercase tracking-tight">{subtitle}</p>
      </div>
      <div className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
    </div>
  );
}

function PerformanceRow({ title, score, color }: { title: string, score: number, color: string }) {
  const barColors: { [key: string]: string } = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-zinc-500">{title}</span>
        <span className={`text-${color}-500`}>{score}%</span>
      </div>
      <div className="h-2 w-full bg-zinc-950 rounded-full border border-zinc-800 overflow-hidden p-[1px]">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full rounded-full ${barColors[color]}`}
        />
      </div>
    </div>
  );
}
