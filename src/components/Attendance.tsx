import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, LogIn, LogOut, Calendar, 
  User, CheckCircle2, AlertCircle, Search, X,
  ChevronLeft, ChevronRight, Filter, BarChart3 as ChartIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, updateDoc, getDoc, doc, serverTimestamp, getDocs, limit 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subDays, format, isSameDay, startOfDay } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  clockIn: any;
  clockOut?: any;
  hoursWorked?: number;
  calculatedWage?: number;
  status: 'present' | 'late' | 'absent';
}

interface UserProfile {
  uid: string;
  displayName: string;
  role: string;
}

export default function Attendance() {
  const { profile: userProfile } = useAuth();
  const { employees, todayAttendance: todayRecord } = useData();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Overtime Form States
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [overtimeNotes, setOvertimeNotes] = useState('');
  const [submittingOvertime, setSubmittingOvertime] = useState(false);
  
  // Calculate hourly rate from DataContext
  const hourlyRate = useMemo(() => {
    if (!userProfile) return 20000;
    const emp = employees.find(e => e.userId === userProfile.uid);
    return emp?.hourlyRate || 20000;
  }, [employees, userProfile]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch History
  useEffect(() => {
    if (!auth.currentUser || !userProfile) return;
    
    // If admin or keuangan, see all. Otherwise see own.
    let q;
    if (userProfile.role === 'admin' || userProfile.role === 'keuangan' || userProfile.role === 'owner') {
      q = query(collection(db, 'attendance'), orderBy('clockIn', 'desc'), limit(100));
    } else {
      q = query(
        collection(db, 'attendance'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('clockIn', 'desc'),
        limit(100)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance_history');
    });

    return () => unsub();
  }, [userProfile]);

  const weeklyTrend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      
      const dayRecords = history.filter(r => r.date === dateStr);
      const totalHours = dayRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
      const totalWage = dayRecords.reduce((sum, r) => sum + (r.calculatedWage || 0), 0);
      
      days.push({
        name: format(d, 'eee', { locale: undefined }), // Short day name
        fullDate: format(d, 'dd MMM'),
        hours: Number(totalHours.toFixed(1)),
        wage: totalWage,
        count: dayRecords.length
      });
    }
    return days;
  }, [history]);

  const handleClockIn = async () => {
    if (!auth.currentUser) {
      alert("Error: Anda belum login atau sesi Anda habis. Silakan refresh.");
      return;
    }
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Simple logic for "late" (after 09:00 AM)
    const lateLimit = new Date();
    lateLimit.setHours(9, 0, 0, 0);
    const status = now > lateLimit ? 'late' : 'present';

    setLoading(true);
    try {
      let displayName = userProfile?.displayName;
      if (!displayName) {
        // Fallback lazy fetch
        const uDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (uDoc.exists()) {
          displayName = uDoc.data().displayName;
        }
      }
      if (!displayName) {
        displayName = auth.currentUser.email?.split('@')[0] || 'Unknown';
      }

      await addDoc(collection(db, 'attendance'), {
        userId: auth.currentUser.uid,
        userName: displayName,
        date: today,
        clockIn: serverTimestamp(),
        status: status
      });

      if (status === 'late') {
        const adminsOwnerQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['admin', 'owner'])
        );
        const adminsSnap = await getDocs(adminsOwnerQuery);
        const notificationPromises = adminsSnap.docs.map(adminDoc => {
          return addDoc(collection(db, 'notifications'), {
            userId: adminDoc.id,
            message: `Staf ${displayName} datang terlambat pada ${now.toLocaleTimeString('id-ID')}`,
            read: false,
            createdAt: serverTimestamp()
          });
        });
        await Promise.all(notificationPromises);
      }
      alert("Clock In berhasil!");
    } catch (e: any) {
      console.error('Clock in error:', e);
      alert(`Gagal Melakukan Clock In: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayRecord || !auth.currentUser) return;
    
    setLoading(true);
    try {
      const now = new Date();
      
      const clockInTime = todayRecord.clockIn.toDate ? todayRecord.clockIn.toDate() : new Date(todayRecord.clockIn);
      const diffMs = now.getTime() - clockInTime.getTime();
      const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
      const calculatedWage = Math.round(hoursWorked * hourlyRate);

      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        clockOut: serverTimestamp(),
        hoursWorked: hoursWorked,
        calculatedWage: calculatedWage
      });
      alert("Clock Out berhasil!");
    } catch (e: any) {
      console.error('Clock out error:', e);
      alert(`Gagal Melakukan Clock Out: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOvertime = async () => {
    if (!todayRecord) {
      alert("Anda harus Clock In terlebih dahulu hari ini!");
      return;
    }
    if (overtimeHours <= 0) {
      alert("Jumlah jam lembur harus lebih besar dari 0.");
      return;
    }
    if (!overtimeNotes.trim()) {
      alert("Harap tulis rincian singkat kegiatan lembur.");
      return;
    }

    setSubmittingOvertime(true);
    try {
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        overtimeHours: Number(overtimeHours),
        overtimeNotes: overtimeNotes.trim(),
        overtimeStatus: 'pending' // pending review by administrator
      });
      alert("Pengajuan lembur Anda berhasil dikirim! Menunggu persetujuan admin.");
      setIsOvertimeModalOpen(false);
      setOvertimeHours(0);
      setOvertimeNotes('');
    } catch (e: any) {
      console.error("Overtime submission failed:", e);
      alert(`Gagal mengajukan lembur: ${e.message || e}`);
    } finally {
      setSubmittingOvertime(false);
    }
  };

  const formatTime = (date: any) => {
    if (!date) return '--:--';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-10 space-y-8 pb-20 md:pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter">Absensi</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-1">Presensi Harian Seluruh Staf</p>
        </div>
        <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-[2rem] border border-zinc-800">
          <Clock className="w-6 h-6 text-blue-500" />
          <div className="text-right">
            <div className="text-xl font-black text-white font-mono">{currentTime.toLocaleTimeString('id-ID')}</div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Clock In/Out Section */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-600/10 transition-all duration-700"></div>
            
            <div className="relative z-10 space-y-8">
              {!todayRecord ? (
                <>
                  <div className="w-20 h-20 bg-blue-600/10 rounded-[2.5rem] flex items-center justify-center mb-6">
                    <LogIn className="w-10 h-10 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2">Selamat Datang!</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed italic">"Kerja keras adalah jembatan menuju mimpi."</p>
                  </div>
                  <button 
                    onClick={handleClockIn}
                    className="w-full py-5 bg-blue-600 text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-blue-900/40 active:scale-95 transition-all hover:bg-blue-700 flex items-center justify-center gap-4"
                  >
                    <LogIn className="w-5 h-5" /> Clock In Sekarang
                  </button>
                </>
              ) : todayRecord && !todayRecord.clockOut ? (
                <>
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2">Sudah Check-In</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-6">Anda mulai bekerja pada pukul <span className="text-emerald-500 font-black">{formatTime(todayRecord.clockIn)}</span>. Selamat bekerja!</p>
                    
                    {(() => {
                      if (!todayRecord.clockIn) return null;
                      const start = todayRecord.clockIn.toDate ? todayRecord.clockIn.toDate() : new Date(todayRecord.clockIn);
                      if (isNaN(start.getTime())) return null;
                      const diffMs = currentTime.getTime() - start.getTime();
                      const hours = Math.max(0, diffMs / (1000 * 60 * 60));
                      const liveWage = Math.round(hours * hourlyRate);
                      
                      return (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl mb-8">
                          <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest block mb-2">Run-time Earnings</span>
                          <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-white font-mono leading-none">Rp {liveWage.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase pb-1 tracking-tighter">({hours.toFixed(2)} Hrs)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <button 
                    onClick={handleClockOut}
                    className="w-full py-5 bg-zinc-800 text-zinc-400 rounded-3xl text-sm font-black uppercase tracking-widest active:scale-95 transition-all hover:bg-red-600 hover:text-white group flex items-center justify-center gap-4"
                  >
                    <LogOut className="w-5 h-5" /> Clock Out
                  </button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-amber-500/10 rounded-[2.5rem] flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2">Tugas Selesai</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">Anda sudah menyelesaikan absensi hari ini. Terima kasih untuk kerja kerasnya!</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                      <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Masuk</span>
                      <span className="text-xs font-black text-white font-mono">{formatTime(todayRecord.clockIn)}</span>
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                      <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Pulang</span>
                      <span className="text-xs font-black text-white font-mono">{formatTime(todayRecord.clockOut)}</span>
                    </div>
                    {todayRecord.calculatedWage && (
                      <div className="col-span-2 bg-emerald-600/10 p-4 rounded-2xl border border-emerald-500/20 mt-2">
                        <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest block mb-1">Estimasi Upah Hari Ini</span>
                        <span className="text-sm font-black text-emerald-500 font-mono">Rp {todayRecord.calculatedWage.toLocaleString()}</span>
                        <span className="text-[8px] text-zinc-500 ml-2 italic">({todayRecord.hoursWorked?.toFixed(1)} Jam)</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {todayRecord && (
                <div className="mt-8 pt-8 border-t border-zinc-800/80">
                  <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-3">Pengajuan Lembur (Overtime)</h4>
                  {todayRecord.overtimeHours ? (
                    <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-3xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-amber-500 font-mono">+{todayRecord.overtimeHours} Jam Kerja Lebih</span>
                        <span className={cn(
                          "px-2.5 py-1 rounded text-[8px] font-black tracking-widest",
                          todayRecord.overtimeStatus === 'approved' ? "bg-emerald-500/10 text-emerald-500" :
                          todayRecord.overtimeStatus === 'rejected' ? "bg-red-500/10 text-red-500" :
                          "bg-amber-500/10 text-amber-500"
                        )}>
                          {todayRecord.overtimeStatus === 'approved' ? 'DISETUJUI' :
                           todayRecord.overtimeStatus === 'rejected' ? 'DITOLAK' :
                           'PENDING'}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 italic">"{todayRecord.overtimeNotes || 'Tidak ada catatan'}"</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        Ajukan lembur jika Anda bekerja melebihi jam shift standar hari ini.
                      </p>
                      <button 
                        onClick={() => setIsOvertimeModalOpen(true)}
                        className="w-full py-4.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-3xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border border-amber-500/20"
                      >
                        <Clock className="w-4 h-4" /> Ajukan Lembur Hari Ini
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-600/5 border border-blue-900/30 rounded-[2.5rem] p-8">
            <h4 className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-4">Informasi Absensi</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">Absensi masuk dilakukan sebelum pukul <span className="text-zinc-200 font-bold">09:00 WIB</span>.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">Keterlambatan akan dicatat secara otomatis oleh sistem.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">Sistem terintegrasi dengan penghitungan payroll bulanan.</p>
              </li>
            </ul>
          </div>
        </div>

        {/* History Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white tracking-tight">Riwayat & Analisis</h3>
            <div className="flex gap-2">
              <button className="p-2.5 bg-zinc-900 text-zinc-500 rounded-xl hover:text-white transition-colors border border-zinc-800"><Filter className="w-4 h-4" /></button>
              <button className="p-2.5 bg-zinc-900 text-zinc-500 rounded-xl hover:text-white transition-colors border border-zinc-800"><Calendar className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Weekly Chart */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
             <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Tren Kerja 7 Hari Terakhir</h4>
                  <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-[0.2em]">Jam Kerja & Estimasi Upah</p>
                </div>
                <ChartIcon className="w-5 h-5 text-zinc-700" />
             </div>
             
             <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis 
                      dataKey="fullDate" 
                      axisLine={false} 
                      tickLine={false} 
                      stroke="#71717a" 
                      fontSize={10} 
                      fontFamily="monospace"
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      stroke="#71717a" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickFormatter={(v) => `${v}h`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 12 }}
                      contentStyle={{ 
                        backgroundColor: '#18181b', 
                        border: '1px solid #27272a', 
                        borderRadius: '16px',
                        fontSize: '10px',
                        fontFamily: 'monospace'
                      }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any, name: string) => {
                        if (name === 'hours') return [`${value} Jam`, 'Durasi'];
                        if (name === 'wage') return [`Rp ${value.toLocaleString()}`, 'Est. Upah'];
                        return [value, name];
                      }}
                    />
                    <Bar 
                      dataKey="hours" 
                      fill="#3b82f6" 
                      radius={[6, 6, 0, 0]} 
                      barSize={32}
                    >
                      {weeklyTrend.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.hours > 0 ? '#3b82f6' : '#27272a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Total Jam (Minggu Ini)</span>
                  <span className="text-sm font-black text-white font-mono">
                    {weeklyTrend.reduce((sum, d) => sum + d.hours, 0).toFixed(1)} Jam
                  </span>
                </div>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Total Upah (Minggu Ini)</span>
                  <span className="text-sm font-black text-emerald-500 font-mono">
                    Rp {weeklyTrend.reduce((sum, d) => sum + d.wage, 0).toLocaleString()}
                  </span>
                </div>
             </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-900 rounded-[2.5rem] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/80">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Staf</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Tanggal</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-center">Durasi</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-center">Upah</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {record.userName.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-zinc-100">{record.userName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs text-zinc-400 font-medium">{formatDate(record.date)}</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-xs font-black text-zinc-300 font-mono">{record.hoursWorked?.toFixed(1) || '0'} H</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-xs font-black text-emerald-500 font-mono">Rp {(record.calculatedWage || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex",
                        record.status === 'present' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {record.status === 'present' ? 'Tepat Waktu' : 'Terlambat'}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-zinc-600 italic text-xs">
                      Belum ada riwayat absensi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOvertimeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-lg overflow-hidden relative shadow-2xl"
            >
              <div className="px-8 py-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Ajukan Lembur (Overtime)</h3>
                  <p className="text-[10px] text-zinc-500">Kirim klaim tambahan jam kerja untuk divalidasi oleh HRD / Owner</p>
                </div>
                <button 
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Jumlah Jam Lembur</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="1" 
                      max="12" 
                      step="0.5"
                      value={overtimeHours || ''}
                      onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
                      placeholder="Contoh: 2 atau 3.5"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">JAM</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Rincian Kegiatan Lembur</label>
                  <textarea 
                    rows={4}
                    value={overtimeNotes}
                    onChange={(e) => setOvertimeNotes(e.target.value)}
                    placeholder="Tuliskan tugas/pekerjaan yang diselesaikan selama waktu lembur..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsOvertimeModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    type="button"
                    disabled={submittingOvertime}
                    onClick={handleSubmitOvertime}
                    className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {submittingOvertime ? 'Mengirim...' : 'Kirim Pengajuan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
