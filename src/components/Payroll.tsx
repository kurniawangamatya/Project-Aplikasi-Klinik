import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, collection, query, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, orderBy, getDocs, where } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, DollarSign, Calendar, Plus, Search, 
  ChevronRight, Download, Filter, MoreVertical,
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  CreditCard, Wallet, Banknote, Trash2, Edit3,
  FileText, Printer, ChevronDown, Check, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Employee {
  id: string;
  userId?: string;
  name: string;
  role: string;
  salary: number;
  hourlyRate: number;
  joinedAt: any;
  status: 'active' | 'inactive';
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  baseSalary: number;
  attendanceBonus: number;
  kpiBonus: number;
  commissionBonus?: number;
  month: string;
  year: number;
  status: 'pending' | 'paid';
  paidAt?: any;
  notes?: string;
}

interface PayrollProps {
  setTab: (t: string) => void;
}

export default function Payroll({ setTab }: PayrollProps) {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'history'>('overview');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
      setLoading(false);
    });

    const pq = query(collection(db, 'payroll'), orderBy('year', 'desc'), orderBy('month', 'desc'));
    const pUnsubscribe = onSnapshot(pq, (snapshot) => {
      setPayrollRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payroll');
    });

    return () => {
      unsubscribe();
      pUnsubscribe();
    };
  }, []);

  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [isCreatePayrollModalOpen, setIsCreatePayrollModalOpen] = useState(false);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const currentMonthName = months[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const [employeeForm, setEmployeeForm] = useState({ name: '', role: '', salary: 0, hourlyRate: 20000, userId: '' });
  const [payrollForm, setPayrollForm] = useState({ employeeId: '', month: currentMonthName, year: currentYear, notes: '' });
  const [payrollPreview, setPayrollPreview] = useState<{ baseSalary: number, attendanceBonus: number, kpiBonus: number, commissionBonus: number, overtimeBonus: number, overtimeHours: number, totalHours: number, total: number } | null>(null);
  const [bulkSlipPeriod, setBulkSlipPeriod] = useState({ month: currentMonthName, year: currentYear });
  const [isBulkSlipLoading, setIsBulkSlipLoading] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!payrollForm.employeeId || !isCreatePayrollModalOpen) {
        setPayrollPreview(null);
        return;
      }
      
      const employee = employees.find(e => e.id === payrollForm.employeeId);
      if (!employee) return;

      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const monthIdx = months.indexOf(payrollForm.month);
      const year = payrollForm.year;

      let totalHours = 0;
      let totalOvertimeHours = 0;
      let kpiBonus = 0;
      let commissionBonus = 0;

      if (employee.userId) {
        // Attendance
        const monthNum = (monthIdx + 1).toString().padStart(2, '0');
        const startDateString = `${year}-${monthNum}-01`;
        const endDateString = `${year}-${monthNum}-31`;

        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('userId', '==', employee.userId),
          where('date', '>=', startDateString),
          where('date', '<=', endDateString)
        );
        
        const attendanceSnap = await getDocs(attendanceQuery);
        attendanceSnap.docs.forEach(doc => {
          const d = doc.data() as any;
          totalHours += (d.hoursWorked || 0);
          if (d.overtimeStatus === 'approved' && d.overtimeHours) {
            totalOvertimeHours += d.overtimeHours;
          }
        });

        // Range for DB Date objects (KPI & Sales)
        const startOfMonth = new Date(year, monthIdx, 1);
        const endOfMonth = new Date(year, monthIdx + 1, 0, 23, 59, 59);

        // KPI Bonus (Validated only) - Filter date range client-side to avoid compound index requirements
        const kpiQuery = query(
          collection(db, 'kpi_entries'),
          where('userId', '==', employee.userId),
          where('status', '==', 'validated')
        );

        const kpiSnap = await getDocs(kpiQuery);
        kpiSnap.docs.forEach(doc => {
          const data = doc.data() as any;
          if (data.date) {
            const entryDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
            if (entryDate >= startOfMonth && entryDate <= endOfMonth) {
              kpiBonus += (data.totalAmount || 0);
            }
          }
        });

        // Commission Bonus (Calculated dynamically from Cashier Sales transactions)
        const salesQuery = query(
          collection(db, 'sales'),
          where('createdAt', '>=', startOfMonth),
          where('createdAt', '<=', endOfMonth)
        );

        const salesSnap = await getDocs(salesQuery);
        const userRole = employee.role?.toLowerCase() || '';

        salesSnap.docs.forEach(doc => {
          const sale = doc.data() as any;
          let isMatch = false;
          let commField = '';

          if (userRole === 'dokter' && sale.doctorId === employee.userId) {
            isMatch = true;
            commField = 'doctorCommission';
          } else if (userRole === 'perawat' && sale.nurseId === employee.userId) {
            isMatch = true;
            commField = 'nurseCommission';
          } else if (sale.createdBy === employee.userId) {
            isMatch = true;
            commField = userRole === 'dokter' ? 'doctorCommission' :
                        userRole === 'perawat' ? 'nurseCommission' :
                        userRole === 'keuangan' ? 'financeCommission' :
                        userRole === 'owner' ? 'ownerCommission' :
                        'adminCommission';
          }

          if (isMatch && sale.items) {
            sale.items.forEach((item: any) => {
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
              const commissionVal = item[commField] !== undefined && item[commField] !== null ? Number(item[commField]) : defaultComm;

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
              commissionBonus += itemCommission;
            });
          }
        });
      }

      const attendanceBonus = Math.round(totalHours * (employee.hourlyRate || 0));
      const overtimeBonus = Math.round(totalOvertimeHours * ((employee.hourlyRate || 20000) * 1.5));
      setPayrollPreview({
        baseSalary: employee.salary || 0,
        attendanceBonus,
        kpiBonus,
        commissionBonus,
        overtimeBonus,
        overtimeHours: totalOvertimeHours,
        totalHours,
        total: (employee.salary || 0) + attendanceBonus + kpiBonus + commissionBonus + overtimeBonus
      });
    };

    fetchPreview();
  }, [payrollForm.employeeId, payrollForm.month, payrollForm.year, isCreatePayrollModalOpen, employees]);

  const handleAddEmployee = async () => {
    if (!employeeForm.name || !employeeForm.role) return;
    try {
      if (editingEmployeeId) {
        await updateDoc(doc(db, 'employees', editingEmployeeId), {
          ...employeeForm,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'employees'), {
          ...employeeForm,
          status: 'active',
          joinedAt: serverTimestamp()
        });
      }
      setIsAddEmployeeModalOpen(false);
      setEditingEmployeeId(null);
      setEmployeeForm({ name: '', role: '', salary: 0, hourlyRate: 20000, userId: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name,
      role: employee.role,
      salary: employee.salary,
      hourlyRate: employee.hourlyRate || 20000,
      userId: employee.userId || ''
    });
    setIsAddEmployeeModalOpen(true);
  };

  const handleCreatePayroll = async () => {
    const employee = employees.find(e => e.id === payrollForm.employeeId);
    if (!employee) return;
    
    setLoading(true);
    try {
      let baseSalary = employee.salary;
      let attendanceBonus = 0;
      let kpiBonus = 0;
      let commissionBonus = 0;
      let overtimeBonus = 0;
      let totalHours = 0;
      let totalOvertimeHours = 0;
      
      const monthIdx = months.indexOf(payrollForm.month);
      const year = payrollForm.year;

      if (employee.userId) {
        const monthNum = (monthIdx + 1).toString().padStart(2, '0');
        const startDateStr = `${year}-${monthNum}-01`;
        const endDateStr = `${year}-${monthNum}-31`;

        // Attendance
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('userId', '==', employee.userId),
          where('date', '>=', startDateStr),
          where('date', '<=', endDateStr)
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        attendanceSnap.docs.forEach(doc => {
          const d = doc.data() as any;
          totalHours += (d.hoursWorked || 0);
          if (d.overtimeStatus === 'approved' && d.overtimeHours) {
            totalOvertimeHours += d.overtimeHours;
          }
        });
        attendanceBonus = Math.round(totalHours * (employee.hourlyRate || 0));
        overtimeBonus = Math.round(totalOvertimeHours * ((employee.hourlyRate || 20000) * 1.5));

        const startOfMonth = new Date(year, monthIdx, 1);
        const endOfMonth = new Date(year, monthIdx + 1, 0, 23, 59, 59);

        // KPI Bonus - Filter date range client-side to avoid compound index requirements
        const kpiQuery = query(
          collection(db, 'kpi_entries'),
          where('userId', '==', employee.userId),
          where('status', '==', 'validated')
        );
        const kpiSnap = await getDocs(kpiQuery);
        kpiSnap.docs.forEach(doc => {
          const data = doc.data() as any;
          if (data.date) {
            const entryDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
            if (entryDate >= startOfMonth && entryDate <= endOfMonth) {
              kpiBonus += (data.totalAmount || 0);
            }
          }
        });

        // Commission Bonus (Calculated dynamically from Cashier Sales transactions)
        const salesQuery = query(
          collection(db, 'sales'),
          where('createdAt', '>=', startOfMonth),
          where('createdAt', '<=', endOfMonth)
        );
        const salesSnap = await getDocs(salesQuery);
        const userRole = employee.role?.toLowerCase() || '';

        salesSnap.docs.forEach(doc => {
          const sale = doc.data() as any;
          let isMatch = false;
          let commField = '';

          if (userRole === 'dokter' && sale.doctorId === employee.userId) {
            isMatch = true;
            commField = 'doctorCommission';
          } else if (userRole === 'perawat' && sale.nurseId === employee.userId) {
            isMatch = true;
            commField = 'nurseCommission';
          } else if (sale.createdBy === employee.userId) {
            isMatch = true;
            commField = userRole === 'dokter' ? 'doctorCommission' :
                        userRole === 'perawat' ? 'nurseCommission' :
                        userRole === 'keuangan' ? 'financeCommission' :
                        userRole === 'owner' ? 'ownerCommission' :
                        'adminCommission';
          }

          if (isMatch && sale.items) {
            sale.items.forEach((item: any) => {
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
              const commissionVal = item[commField] !== undefined && item[commField] !== null ? Number(item[commField]) : defaultComm;

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
              commissionBonus += itemCommission;
            });
          }
        });
      }

      const totalAmount = baseSalary + attendanceBonus + kpiBonus + commissionBonus + overtimeBonus;

      await addDoc(collection(db, 'payroll'), {
        employeeId: employee.id,
        employeeName: employee.name,
        amount: totalAmount,
        baseSalary: baseSalary,
        attendanceBonus: attendanceBonus,
        kpiBonus: kpiBonus,
        commissionBonus: commissionBonus,
        overtimeBonus: overtimeBonus,
        overtimeHours: totalOvertimeHours,
        hoursWorked: totalHours,
        month: payrollForm.month,
        year: payrollForm.year,
        status: 'pending',
        notes: payrollForm.notes || `Gaji Pokok + Uang Duduk (${totalHours.toFixed(1)} Jam) + Lembur (${totalOvertimeHours.toFixed(1)} Jam) + Jasa Medis (Rp ${commissionBonus.toLocaleString()}) + KPI`,
        createdAt: serverTimestamp()
      });
      setIsCreatePayrollModalOpen(false);
      setPayrollForm({ employeeId: '', month: currentMonthName, year: currentYear, notes: '' });
      setPayrollPreview(null);
      setActiveTab('history');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      await updateDoc(doc(db, 'payroll', id), {
        status: 'paid',
        paidAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Hapus karyawan ini?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
    } catch (e) {
      console.error(e);
    }
  };

  const exportSlipAsPDF = async (elementId: string, filename: string) => {
    const input = document.getElementById(elementId);
    if (!input) return;
    
    // Create a 1x1 canvas to dynamically resolve / convert unsupported color functions like oklch to standard rgb/rgba
    const colorCanvas = typeof window !== 'undefined' ? window.document.createElement('canvas') : null;
    if (colorCanvas) {
      colorCanvas.width = 1;
      colorCanvas.height = 1;
    }
    const colorCtx = colorCanvas ? colorCanvas.getContext('2d', { willReadFrequently: true }) : null;

    const convertUnsupportedColors = (colorStr: string): string => {
      if (!colorStr || typeof colorStr !== 'string') return colorStr;
      const lower = colorStr.toLowerCase();
      if (lower.includes('oklch') || lower.includes('oklab') || lower.includes('lch') || lower.includes('lab')) {
        if (!colorCtx) return colorStr;
        try {
          colorCtx.clearRect(0, 0, 1, 1);
          colorCtx.fillStyle = colorStr;
          colorCtx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data;
          return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        } catch (e) {
          return colorStr;
        }
      }
      return colorStr;
    };

    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedWindow = clonedDoc.defaultView;
          if (clonedWindow) {
            const originalGetComputedStyle = clonedWindow.getComputedStyle;
            clonedWindow.getComputedStyle = function (element, pseudoElt) {
              const realStyle = originalGetComputedStyle.call(clonedWindow, element, pseudoElt);
              return new Proxy(realStyle, {
                get(target, prop) {
                  const val = Reflect.get(target, prop);
                  if (typeof prop === 'string') {
                    if (prop === 'getPropertyValue') {
                      return function(propertyName: string) {
                        const originalValue = target.getPropertyValue(propertyName);
                        return convertUnsupportedColors(originalValue);
                      };
                    }
                    if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab') || val.includes('lch') || val.includes('lab'))) {
                      return convertUnsupportedColors(val);
                    }
                  }
                  if (typeof val === 'function') {
                    return val.bind(target);
                  }
                  return val;
                }
              });
            };
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleBulkExportSlips = async () => {
    const recordsToExport = payrollRecords.filter(
      r => r.month === bulkSlipPeriod.month && r.year === bulkSlipPeriod.year
    );

    if (recordsToExport.length === 0) {
      alert(`Tidak ada data payroll untuk ${bulkSlipPeriod.month} ${bulkSlipPeriod.year}`);
      return;
    }

    setIsBulkSlipLoading(true);
    
    try {
      // We'll create a hidden container to render all slips for PDF capture
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      for (const record of recordsToExport) {
        // We'll use a simplified implementation for bulk: 
        // In a real app we'd render each, but for now we can just use the exportSlipAsPDF logic 
        // if we were to render them. 
        // Let's just alert the user which records are found and export the first one as proof of concept if needed, 
        // but the user expects "All Slips". 
        // A better way is to generate a consolidated PDF or zip. 
        // For simplicity, we'll download them one by one with a slight delay to avoid browser blocking.
        setSelectedSlip(record);
        // Wait for state update and modal render
        await new Promise(resolve => setTimeout(resolve, 500));
        await exportSlipAsPDF(`slip-${record.id}`, `Salary_Slip_${record.employeeName}_${record.month}_${record.year}`);
      }
      setSelectedSlip(null);
    } catch (error) {
      console.error('Bulk export failed:', error);
    } finally {
      setIsBulkSlipLoading(false);
    }
  };

  const totalPayroll = payrollRecords.reduce((acc, rec) => acc + rec.amount, 0);
  const pendingCount = payrollRecords.filter(r => r.status === 'pending').length;

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="p-8 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Payroll Management</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">Sistem Penggajian Internal Klinik</p>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center gap-3 px-6 py-3 bg-zinc-900 text-zinc-100 rounded-2xl text-xs font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all">
              <Download className="w-4 h-4" /> Export Report
            </button>
            <button 
              onClick={() => setIsCreatePayrollModalOpen(true)}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/20 hover:bg-blue-700 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Payroll
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-8 border-b border-zinc-900">
          <button 
            onClick={() => setActiveTab('overview')}
            className={cn(
              "pb-4 text-xs font-black uppercase tracking-widest transition-all relative",
              activeTab === 'overview' ? "text-blue-500" : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            Overview
            {activeTab === 'overview' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
          <button 
            onClick={() => setActiveTab('employees')}
            className={cn(
              "pb-4 text-xs font-black uppercase tracking-widest transition-all relative",
              activeTab === 'employees' ? "text-blue-500" : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            Employees
            {activeTab === 'employees' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "pb-4 text-xs font-black uppercase tracking-widest transition-all relative",
              activeTab === 'history' ? "text-blue-500" : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            Payment History
            {activeTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                icon={<Wallet className="w-5 h-5" />} 
                label="Total Payout" 
                value={`Rp ${totalPayroll.toLocaleString()}`} 
                trend="+12% from last month"
                color="blue"
              />
              <StatCard 
                icon={<Users className="w-5 h-5" />} 
                label="Active Staff" 
                value={employees.length.toString()} 
                trend="Full capacity"
                color="emerald"
              />
              <StatCard 
                icon={<Clock className="w-5 h-5" />} 
                label="Pending Tasks" 
                value={pendingCount.toString()} 
                trend="Required attention"
                color="amber"
              />
              <StatCard 
                icon={<TrendingUp className="w-5 h-5" />} 
                label="Avg Salary" 
                value="Rp 4.5M" 
                trend="Stable"
                color="purple"
              />
            </div>

            {/* Main Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Recent Disbursements</h3>
                  <button className="text-[10px] font-bold text-blue-500 hover:underline">View All</button>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-900 rounded-[2.5rem] overflow-hidden overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-900">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Employee</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Period</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Amount</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollRecords.filter(r => r.status === 'pending').slice(0, 5).map((record) => (
                        <tr key={record.id} className="border-b border-zinc-900/50 hover:bg-zinc-800/30 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-[10px] text-white">
                                {record.employeeName.charAt(0)}
                              </div>
                              <span className="text-xs font-bold text-zinc-200">{record.employeeName}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-xs text-zinc-500 font-medium">
                            {record.month} {record.year}
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-xs font-black text-white font-mono">
                              Rp {(record.amount || 0).toLocaleString()}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {record.attendanceBonus > 0 && (
                            <div className="text-[7px] text-blue-500 font-bold uppercase tracking-widest px-1.5 py-0.5 bg-blue-500/10 rounded-md">
                              Kehadiran
                            </div>
                          )}
                          {record.commissionBonus && record.commissionBonus > 0 && (
                            <div className="text-[7px] text-rose-400 font-bold uppercase tracking-widest px-1.5 py-0.5 bg-rose-500/10 rounded-md">
                              Jasa Medis
                            </div>
                          )}
                          {record.kpiBonus > 0 && (
                            <div className="text-[7px] text-emerald-500 font-bold uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/10 rounded-md">
                              Komisi KPI
                            </div>
                          )}
                        </div>
                      </td>
                          <td className="px-8 py-5">
                            <button 
                              onClick={() => markAsPaid(record.id)}
                              className="px-4 py-2 bg-emerald-600/10 text-emerald-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-lg"
                            >
                              Konfirmasi Bayar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {payrollRecords.filter(r => r.status === 'pending').length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center text-zinc-600 italic text-xs">
                            Tidak ada pembayaran gaji yang tertunda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-8">
                <div className="bg-blue-600 p-8 rounded-[3rem] shadow-2xl shadow-blue-900/20 relative overflow-hidden group">
                  <div className="relative z-10">
                    <Banknote className="w-10 h-10 text-blue-200 mb-6 group-hover:scale-110 transition-transform" />
                    <h4 className="text-white font-black text-xl mb-2 tracking-tighter">Quick Pay Available</h4>
                    <p className="text-blue-100 text-xs font-medium leading-relaxed mb-8 opacity-80">
                      There are 12 employees pending for May 2024 payroll. Bulk payment is supported via integrated clinic bank.
                    </p>
                    <button className="w-full py-4 bg-white text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-100 transition-all active:scale-95 shadow-xl shadow-black/10">
                      Process All Pending
                    </button>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                </div>

                <div className="bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6">Holiday Calendar</h4>
                  <div className="space-y-4">
                    <HolidayItem date="24 Mei" label="Hari Raya Waisak" />
                    <HolidayItem date="01 Juni" label="Hari Lahir Pancasila" />
                    <HolidayItem date="17 Juni" label="Idul Adha" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-8 mb-10">
              <div className="flex items-center gap-4 bg-zinc-900 p-2 rounded-2xl border border-zinc-800 w-full max-w-xl">
                <Search className="w-4 h-4 text-zinc-600 ml-4" />
                <input 
                  type="text" 
                  placeholder="Cari staf berdasarkan nama atau jabatan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent border-none text-xs text-white placeholder:text-zinc-600 focus:ring-0"
                />
              </div>
              <button 
                onClick={() => setIsAddEmployeeModalOpen(true)}
                className="flex items-center gap-3 px-8 py-3 bg-white text-zinc-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Tambah Staf Baru
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).map(employee => (
                <div key={employee.id} className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 hover:border-blue-500/50 transition-all group">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-zinc-800 flex items-center justify-center font-black text-xl text-zinc-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                      {employee.name.charAt(0)}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openEditModal(employee)}
                        className="p-2 text-zinc-600 hover:text-white transition-colors"
                        title="Edit Staf"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setTab('attendance')}
                        className="p-2 text-zinc-600 hover:text-blue-500 transition-colors"
                        title="Lihat Absensi"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteEmployee(employee.id)}
                        className="p-2 text-zinc-800 hover:text-red-500 transition-colors"
                        title="Hapus Staf"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-8">
                    <h4 className="text-lg font-black text-white tracking-tighter">{employee.name}</h4>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">{employee.role}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Gaji Pokok</span>
                      <span className="text-xs font-black text-zinc-200 font-mono">Rp {(employee.salary || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Uang Duduk/Jam</span>
                      <span className="text-xs font-black text-zinc-200 font-mono">Rp {(employee.hourlyRate || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-zinc-800/50 text-right">
                    <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest block mb-1">Status</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      employee.status === 'active' ? "text-emerald-500" : "text-red-500"
                    )}>{employee.status}</span>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setIsAddEmployeeModalOpen(true)}
                className="bg-zinc-950 border-2 border-dashed border-zinc-900 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 hover:bg-zinc-900/50 transition-all text-zinc-700 hover:text-zinc-500 group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center group-hover:border-zinc-700">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Tambah Staf Baru</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <select 
                  value={bulkSlipPeriod.month}
                  onChange={(e) => setBulkSlipPeriod({ ...bulkSlipPeriod, month: e.target.value })}
                  className="bg-zinc-900 border border-zinc-800 text-xs text-white p-2.5 rounded-xl outline-none"
                >
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select 
                  value={bulkSlipPeriod.year}
                  onChange={(e) => setBulkSlipPeriod({ ...bulkSlipPeriod, year: Number(e.target.value) })}
                  className="bg-zinc-900 border border-zinc-800 text-xs text-white p-2.5 rounded-xl outline-none"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleBulkExportSlips}
                disabled={isBulkSlipLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-zinc-100 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all shadow-sm disabled:opacity-50"
              >
                {isBulkSlipLoading ? (
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                {isBulkSlipLoading ? 'Generating...' : 'Export All Slips'}
              </button>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-900 rounded-[2.5rem] overflow-hidden overflow-x-auto custom-scrollbar">
             <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-900">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Transaction ID</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Recipient</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Period</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Amount</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Date Paid</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map((record) => (
                    <tr key={record.id} className="border-b border-zinc-900/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-8 py-5 text-[10px] font-mono font-bold text-zinc-500">#{record.id.slice(-8).toUpperCase()}</td>
                      <td className="px-8 py-5 text-xs font-bold text-zinc-200">{record.employeeName}</td>
                      <td className="px-8 py-5 text-xs text-zinc-500">{record.month} {record.year}</td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-black text-white font-mono">Rp {(record.amount || 0).toLocaleString()}</div>
                        {record.attendanceBonus > 0 && (
                          <div className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                            + Uang Duduk: Rp {(record.attendanceBonus || 0).toLocaleString()}
                          </div>
                        )}
                        {(record as any).overtimeBonus > 0 && (
                          <div className="text-[8px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">
                            + Uang Lembur: Rp {((record as any).overtimeBonus || 0).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-5 text-xs text-zinc-500">{record.paidAt?.toDate?.().toLocaleDateString() || '-'}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { setSelectedSlip(record); setIsSlipModalOpen(true); }}
                            className="p-2 text-zinc-500 hover:text-blue-500 transition-colors"
                            title="View Slip"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <div className="flex items-center gap-2 text-zinc-500">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Transfer</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddEmployeeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-black text-white mb-8 tracking-tighter">
                {editingEmployeeId ? 'Edit Data Staf' : 'Tambah Staf'}
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={employeeForm.name || ''}
                    onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    placeholder="Contoh: Dr. Kurniawan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Jabatan</label>
                  <input 
                    type="text" 
                    value={employeeForm.role || ''}
                    onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    placeholder="Contoh: Dokter Ortho"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Gaji Pokok (Rp)</label>
                    <input 
                      type="number" 
                      value={employeeForm.salary || ''}
                      onChange={e => setEmployeeForm({...employeeForm, salary: e.target.value === '' ? 0 : Number(e.target.value)})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Uang Duduk/Jam (Rp)</label>
                    <input 
                      type="number" 
                      value={employeeForm.hourlyRate || ''}
                      onChange={e => setEmployeeForm({...employeeForm, hourlyRate: e.target.value === '' ? 0 : Number(e.target.value)})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                      placeholder="20000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">User ID (Link to Auth UID)</label>
                  <input 
                    type="text" 
                    value={employeeForm.userId || ''}
                    onChange={e => setEmployeeForm({...employeeForm, userId: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none"
                    placeholder="Wajib untuk absensi otomatis"
                  />
                  <p className="text-[8px] text-zinc-600 px-1 italic">Dapatkan UID user dari tab 'Tim' atau database untuk menghubungkan absensi.</p>
                </div>
                <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => {
                        setIsAddEmployeeModalOpen(false);
                        setEditingEmployeeId(null);
                        setEmployeeForm({ name: '', role: '', salary: 0, hourlyRate: 20000, userId: '' });
                      }}
                      className="flex-1 py-4 bg-zinc-800 text-zinc-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleAddEmployee}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20"
                    >
                      {editingEmployeeId ? 'Update' : 'Simpan'}
                    </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isCreatePayrollModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-black text-white mb-8 tracking-tighter">Buat Payroll</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Pilih Staf</label>
                  <select 
                    value={payrollForm.employeeId}
                    onChange={e => setPayrollForm({...payrollForm, employeeId: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none appearance-none"
                  >
                    <option value="">-- Pilih Staf --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Bulan</label>
                    <select 
                      value={payrollForm.month}
                      onChange={e => setPayrollForm({...payrollForm, month: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs text-white focus:ring-2 focus:ring-blue-600 outline-none appearance-none"
                    >
                      {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Tahun</label>
                    <input 
                      type="number" 
                      value={payrollForm.year || ''}
                      onChange={e => setPayrollForm({...payrollForm, year: e.target.value === '' ? 0 : Number(e.target.value)})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-4 pt-2">
                  {payrollPreview && (
                    <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Gaji Pokok</span>
                        <span className="text-xs font-black text-zinc-300 font-mono">Rp {(payrollPreview.baseSalary || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest block">Uang Duduk (Kehadiran)</span>
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">
                            {(payrollPreview.totalHours || 0).toFixed(1)} Jam x Rp {(employees.find(e => e.id === payrollForm.employeeId)?.hourlyRate || 0).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs font-black text-emerald-500 font-mono">Rp {(payrollPreview.attendanceBonus || 0).toLocaleString()}</span>
                      </div>
                      {(payrollPreview.overtimeBonus || 0) > 0 && (
                        <div className="flex justify-between items-center">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest block">Uang Lembur (Jam Kerja Lebih)</span>
                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter col-span-2">
                              {(payrollPreview.overtimeHours || 0).toFixed(1)} Jam x Rp {(Math.round((employees.find(e => e.id === payrollForm.employeeId)?.hourlyRate || 20000) * 1.5)).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-xs font-black text-blue-500 font-mono">Rp {(payrollPreview.overtimeBonus || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(payrollPreview.commissionBonus || 0) > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Jasa Medis / Pelayanan</span>
                          <span className="text-xs font-black text-rose-500 font-mono">Rp {(payrollPreview.commissionBonus || 0).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Komisi Jasa (KPI)</span>
                         <span className="text-xs font-black text-emerald-500 font-mono">Rp {(payrollPreview.kpiBonus || 0).toLocaleString()}</span>
                      </div>
                      <div className="pt-3 border-t border-zinc-900 flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Total Gaji</span>
                        <span className="text-sm font-black text-blue-500 font-mono">Rp {(payrollPreview.total || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-1">Catatan</label>
                    <textarea 
                      value={payrollForm.notes || ''}
                      onChange={e => setPayrollForm({...payrollForm, notes: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                      rows={3}
                      placeholder="Tambahkan catatan khusus..."
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsCreatePayrollModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-800 text-zinc-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleCreatePayroll}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20"
                  >
                    Proses
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Salary Slip Modal */}
      <AnimatePresence>
        {isSlipModalOpen && selectedSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tighter">Salary Slip</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                    {selectedSlip.month} {selectedSlip.year} • #{selectedSlip.id.slice(-8).toUpperCase()}
                  </p>
                </div>
                <div className="flex gap-4 border border-zinc-800 p-2 rounded-2xl">
                  <button 
                    onClick={() => exportSlipAsPDF(`slip-${selectedSlip.id}`, `Salary_Slip_${selectedSlip.employeeName}_${selectedSlip.month}_${selectedSlip.year}`)}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg"
                  >
                    <Printer className="w-4 h-4" /> Download PDF
                  </button>
                  <button 
                    onClick={() => { setIsSlipModalOpen(false); setSelectedSlip(null); }}
                    className="p-3 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-10 bg-white" id={`slip-${selectedSlip.id}`}>
                <div className="max-w-xl mx-auto space-y-10 text-slate-800 py-6">
                  {/* Company Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">DENTAL CLINIC</h4>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Professional Dental Care</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">SLIP GAJI KARYAWAN</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedSlip.month} {selectedSlip.year}</div>
                    </div>
                  </div>

                  {/* Employee Info */}
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Karyawan</div>
                        <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedSlip.employeeName}</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Jabatan</div>
                        <div className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                          {employees.find(e => e.id === selectedSlip.employeeId)?.role || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 text-right">
                      <div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Pembayaran</div>
                        <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">DISETUJUI / DIBAYARKAN</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal Cetak</div>
                        <div className="text-[10px] font-bold text-slate-500">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      </div>
                    </div>
                  </div>

                  {/* Earnings Breakdown */}
                  <div className="space-y-6">
                    <div className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Rincian Penghasilan</div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Gaji Pokok</span>
                        <span className="font-mono font-black text-slate-900">Rp {selectedSlip.baseSalary.toLocaleString()}</span>
                      </div>
                      {selectedSlip.attendanceBonus > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Uang Duduk (Absensi)</span>
                          <span className="font-mono font-black text-slate-900">Rp {selectedSlip.attendanceBonus.toLocaleString()}</span>
                        </div>
                      )}
                      {(selectedSlip as any).overtimeBonus > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Uang Lembur ({(selectedSlip as any).overtimeHours || 0} Jam)</span>
                          <span className="font-mono font-black text-blue-600">Rp {(selectedSlip as any).overtimeBonus.toLocaleString()}</span>
                        </div>
                      )}
                      {(selectedSlip as any).commissionBonus > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Jasa Medis / Pelayanan</span>
                          <span className="font-mono font-black text-rose-600">Rp {(selectedSlip as any).commissionBonus.toLocaleString()}</span>
                        </div>
                      )}
                      {(selectedSlip as any).kpiBonus > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Komisi Jasa (KPI)</span>
                          <span className="font-mono font-black text-emerald-600">Rp {(selectedSlip as any).kpiBonus.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Tunjangan Lain-lain</span>
                        <span className="font-mono font-black text-slate-900">Rp 0</span>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Diterima (Net)</div>
                      <div className="text-3xl font-black text-slate-900 tracking-tighter">Rp {selectedSlip.amount.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Terbilang</div>
                      <div className="text-[10px] font-bold text-slate-600 italic">#{selectedSlip.amount.toLocaleString()} Rupiah#</div>
                    </div>
                  </div>

                  {/* Footer / Signature */}
                  <div className="pt-12 flex justify-end">
                    <div className="text-center w-48 border-t border-slate-900 pt-3">
                      <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Admin Keuangan</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, trend, color }: { icon: React.ReactNode, label: string, value: string, trend: string, color: 'blue' | 'emerald' | 'amber' | 'purple' }) {
  const colors = {
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    purple: "text-purple-500 bg-purple-500/10 border-purple-500/20"
  };

  return (
    <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 hover:border-zinc-700 transition-all">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-6", colors[color])}>
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">{label}</p>
        <h4 className="text-xl font-black text-white tracking-tighter">{value}</h4>
      </div>
      <p className="text-[9px] font-bold text-zinc-600 mt-4 uppercase tracking-widest">{trend}</p>
    </div>
  );
}

function HolidayItem({ date, label }: { date: string, label: string }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 hover:bg-zinc-800 transition-colors cursor-default">
      <div className="bg-zinc-800 px-2 py-1 rounded-lg text-[9px] font-black text-zinc-400 uppercase tracking-tighter">
        {date}
      </div>
      <span className="text-[11px] font-bold text-zinc-300">{label}</span>
    </div>
  );
}
