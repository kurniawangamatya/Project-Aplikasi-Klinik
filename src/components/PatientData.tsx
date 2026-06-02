import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, orderBy, where, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { SaleTransaction, Appointment } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { 
  User, Search, Calendar, ChevronDown, Check, Printer, Download, Share2, 
  ArrowUpDown, Trash2, Edit3, Heart, Activity, TrendingUp, DollarSign,
  Phone, MapPin, ClipboardList, Clock, ArrowUpRight, Users, Stethoscope,
  Plus, X, AlertCircle, BarChart3, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Patient {
  id: string; // generated from phone or name
  name: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  totalSpent: number;
  lastVisit: any;
  visitCount: number;
  transactions: SaleTransaction[];
  
  mrNumber?: string;
  nik?: string;
  dob?: string;
  age?: string;
  occupation?: string;
  email?: string;
  branch?: string;
  poli?: string;
  
  vitalSigns?: {
    tension?: string;
    temp?: string;
    pulse?: string;
    respiration?: string;
    weight?: string;
    height?: string;
  };
  
  medicalData?: {
    dentalHistory?: string;
    geneticDisease?: string;
    allergies?: string;
    bloodType?: string;
    notes?: string;
  };
  
  chiefComplaint?: string;
  odontogram?: Record<string, string>;
}

export default function PatientData() {
  const { profile } = useAuth();
  const { products, users, categories } = useData();
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'calendar'>('grid');
  const [allSales, setAllSales] = useState<SaleTransaction[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  
  // Staff derived from DataContext
  const doctors = useMemo(() => users.filter(u => u.role === 'dokter'), [users]);
  const nurses = useMemo(() => users.filter(u => u.role === 'perawat'), [users]);

  // Calendar State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [staffFilter, setStaffFilter] = useState({ doctorId: '', nurseId: '' });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(new Date());

  // New Patient Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Accordion state
  const [showVitalSignsForm, setShowVitalSignsForm] = useState(false);
  const [showMedicalDataForm, setShowMedicalDataForm] = useState(false);
  const [showOdontogramForm, setShowOdontogramForm] = useState(false);
  const [activeToothBrush, setActiveToothBrush] = useState<string>('Normal');

  // Odontogram Edit Mode States
  const [isEditingOdontogram, setIsEditingOdontogram] = useState(false);
  const [tempOdontogram, setTempOdontogram] = useState<Record<string, string>>({});
  const [activeEditToothBrush, setActiveEditToothBrush] = useState<string>('Normal');
  const [savingOdontogram, setSavingOdontogram] = useState(false);

  // Sync tempOdontogram when patient changes
  useEffect(() => {
    if (selectedPatient) {
      setTempOdontogram(selectedPatient.odontogram || {});
    } else {
      setTempOdontogram({});
    }
    setIsEditingOdontogram(false);
  }, [selectedPatientId]);

  const handleSaveOdontogram = async () => {
    if (!selectedPatient || !selectedPatient.transactions || selectedPatient.transactions.length === 0) return;
    
    setSavingOdontogram(true);
    try {
      const batchPromises = selectedPatient.transactions.map(sale => 
        updateDoc(doc(db, 'sales', sale.id), { odontogram: tempOdontogram })
      );
      await Promise.all(batchPromises);
      setIsEditingOdontogram(false);
    } catch (error) {
      console.error("Error updating odontogram:", error);
    } finally {
      setSavingOdontogram(false);
    }
  };

  const [patientForm, setPatientForm] = useState({
    name: '',
    phone: '',
    initialNotes: '',
    registrationFee: 0,
    street: '',
    city: '',
    province: '',
    postalCode: '',
    
    mrNumber: '',
    nik: '',
    dob: '',
    age: '',
    occupation: '',
    email: '',
    branch: '',
    poli: '',
    
    tension: '',
    temp: '',
    pulse: '',
    respiration: '',
    weight: '',
    height: '',
    
    dentalHistory: '',
    geneticDisease: '',
    allergies: '',
    bloodType: '',
    medicalNotes: '',
    
    chiefComplaint: '',
    odontogram: {} as Record<string, string>
  });

  const [visitForm, setVisitForm] = useState({
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: '',
    selectedItems: [] as any[],
    doctorId: '',
    nurseId: ''
  });

  const [appointmentForm, setAppointmentForm] = useState({
    patientName: '',
    patientPhone: '',
    doctorId: '',
    nurseId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    notes: ''
  });

  // Fetch all sales
  useEffect(() => {
    if (!profile) return;
    setLoading(true);

    // Sales Query - Limit to 6 months and 200 results to prevent quota exhaustion
    const sixMonthsAgo = subMonths(new Date(), 6);
    const salesQ = query(
      collection(db, 'sales'), 
      where('createdAt', '>=', sixMonthsAgo),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleTransaction));
      setAllSales(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      setLoading(false);
    });

    return () => unsubSales();
  }, [profile]);

  // Fetch appointments
  useEffect(() => {
    const appointmentsQ = query(collection(db, 'appointments'), orderBy('date', 'asc'));
    const unsubAppointments = onSnapshot(appointmentsQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
      } as Appointment));
      setAppointments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'appointments');
    });

    return () => unsubAppointments();
  }, []);

  // Process unique patients
  const patients = useMemo(() => {
    const patientMap: { [key: string]: Patient } = {};

    allSales.forEach(sale => {
      const name = sale.customerName || 'Anonim';
      const phone = sale.customerPhone || '0';
      const key = `${name.toLowerCase()}_${phone}`;

      if (!patientMap[key]) {
        patientMap[key] = {
          id: key,
          name: name,
          phone: phone,
          address: (sale as any).address,
          totalSpent: 0,
          lastVisit: sale.createdAt,
          visitCount: 0,
          transactions: []
        };
      }

      patientMap[key].totalSpent += sale.total;
      patientMap[key].visitCount += 1;
      patientMap[key].transactions.push(sale);
      
      // Update last visit and address if this sale is newer
      const currentLastVisit = patientMap[key].lastVisit?.toDate ? patientMap[key].lastVisit.toDate() : new Date(patientMap[key].lastVisit);
      const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
      if (saleDate > currentLastVisit) {
        patientMap[key].lastVisit = sale.createdAt;
        if ((sale as any).address) {
          patientMap[key].address = (sale as any).address;
        }
      }
    });

    // Sort transactions within each patient chronologically (descending)
    Object.values(patientMap).forEach(patient => {
      patient.transactions.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Scan through transactions (latest first) to populate demographic and clinical fields
      for (const sale of patient.transactions) {
        const s = sale as any;
        if (s.mrNumber && !patient.mrNumber) patient.mrNumber = s.mrNumber;
        if (s.nik && !patient.nik) patient.nik = s.nik;
        if (s.dob && !patient.dob) patient.dob = s.dob;
        if (s.age && !patient.age) patient.age = s.age;
        if (s.occupation && !patient.occupation) patient.occupation = s.occupation;
        if (s.email && !patient.email) patient.email = s.email;
        if (s.branch && !patient.branch) patient.branch = s.branch;
        if (s.poli && !patient.poli) patient.poli = s.poli;
        if (s.vitalSigns && !patient.vitalSigns) patient.vitalSigns = s.vitalSigns;
        if (s.medicalData && !patient.medicalData) patient.medicalData = s.medicalData;
        if (s.chiefComplaint && !patient.chiefComplaint) patient.chiefComplaint = s.chiefComplaint;
        if (s.odontogram && !patient.odontogram) patient.odontogram = s.odontogram;
      }
    });

    return Object.values(patientMap).sort((a, b) => {
      const dateA = a.lastVisit?.toDate ? a.lastVisit.toDate() : new Date(a.lastVisit);
      const dateB = b.lastVisit?.toDate ? b.lastVisit.toDate() : new Date(b.lastVisit);
      return dateB.getTime() - dateA.getTime();
    });
  }, [allSales]);

  // Process Visit Trend Data
  const visitTrendData = useMemo(() => {
    const visitsByDate: { [key: string]: number } = {};
    const last30Days = Array.from({ length: 14 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      return format(date, 'yyyy-MM-dd');
    });

    // Initialize all days with 0
    last30Days.forEach(date => {
      visitsByDate[date] = 0;
    });

    // Fill with actual data
    allSales.forEach(sale => {
      if (!sale.createdAt) return;
      const date = sale.createdAt.toDate ? format(sale.createdAt.toDate(), 'yyyy-MM-dd') : format(new Date(sale.createdAt), 'yyyy-MM-dd');
      if (visitsByDate[date] !== undefined) {
        visitsByDate[date]++;
      }
    });

    return last30Days.map(date => ({
      date: format(new Date(date), 'dd MMM'),
      visits: visitsByDate[date],
      fullDate: date
    }));
  }, [allSales]);

  // Process Monthly Trend Data (Last 12 Months)
  const monthlyTrendData = useMemo(() => {
    const monthlyStats: { [key: string]: { visits: number, revenue: number } } = {};
    const last12Months = Array.from({ length: 12 }).map((_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return format(date, 'yyyy-MM');
    });

    // Initialize all months with 0
    last12Months.forEach(month => {
      monthlyStats[month] = { visits: 0, revenue: 0 };
    });

    // Fill with actual data
    allSales.forEach(sale => {
      if (!sale.createdAt) return;
      const date = sale.createdAt.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
      const month = format(date, 'yyyy-MM');
      if (monthlyStats[month]) {
        monthlyStats[month].visits++;
        monthlyStats[month].revenue += sale.total;
      }
    });

    return last12Months.map(month => ({
      month: format(new Date(month + '-01'), 'MMM yy'),
      visits: monthlyStats[month].visits,
      revenue: monthlyStats[month].revenue,
      revenueInK: monthlyStats[month].revenue / 1000
    }));
  }, [allSales]);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = patientForm.name.trim() || 'Pasien Anonim';
    const finalPhone = patientForm.phone.trim() || '-';

    setSubmitting(true);
    try {
      // Create a "Registration" sale to initialize the patient in our derived data system
      const newVisit = {
        customerName: finalName,
        customerPhone: finalPhone,
        address: {
          street: patientForm.street || '',
          city: patientForm.city || '',
          province: patientForm.province || '',
          postalCode: patientForm.postalCode || ''
        },
        mrNumber: patientForm.mrNumber || '',
        nik: patientForm.nik || '',
        dob: patientForm.dob || '',
        age: patientForm.age || '',
        occupation: patientForm.occupation || '',
        email: patientForm.email || '',
        branch: patientForm.branch || '',
        poli: patientForm.poli || '',
        vitalSigns: {
          tension: patientForm.tension || '',
          temp: patientForm.temp || '',
          pulse: patientForm.pulse || '',
          respiration: patientForm.respiration || '',
          weight: patientForm.weight || '',
          height: patientForm.height || ''
        },
        medicalData: {
          dentalHistory: patientForm.dentalHistory || '',
          geneticDisease: patientForm.geneticDisease || '',
          allergies: patientForm.allergies || '',
          bloodType: patientForm.bloodType || '',
          notes: patientForm.medicalNotes || ''
        },
        chiefComplaint: patientForm.chiefComplaint || '',
        odontogram: patientForm.odontogram || {},
        items: [{
          id: 'reg_fee',
          name: 'Pendaftaran Pasien Baru',
          price: patientForm.registrationFee,
          quantity: 1,
          category: 'Administrasi',
          type: 'service'
        }],
        subtotal: patientForm.registrationFee,
        discount: 0,
        total: patientForm.registrationFee,
        notes: patientForm.initialNotes || patientForm.chiefComplaint || 'Pendaftaran pasien baru manual dari Dashboard Pasien.',
        createdAt: serverTimestamp(),
        createdBy: 'Admin', // In a real app, use the current user's ID/name
        isDelivery: false,
        tableNumber: '-'
      };

      await addDoc(collection(db, 'sales'), newVisit);
      
      setIsModalOpen(false);
      setPatientForm({ 
        name: '', 
        phone: '', 
        initialNotes: '', 
        registrationFee: 0,
        street: '',
        city: '',
        province: '',
        postalCode: '',
        mrNumber: '',
        nik: '',
        dob: '',
        age: '',
        occupation: '',
        email: '',
        branch: '',
        poli: '',
        tension: '',
        temp: '',
        pulse: '',
        respiration: '',
        weight: '',
        height: '',
        dentalHistory: '',
        geneticDisease: '',
        allergies: '',
        bloodType: '',
        medicalNotes: '',
        chiefComplaint: '',
        odontogram: {}
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || visitForm.selectedItems.length === 0) return;

    setSubmitting(true);
    try {
      const selectedDoctor = doctors.find(d => d.uid === visitForm.doctorId);
      const selectedNurse = nurses.find(n => n.uid === visitForm.nurseId);
      
      const subtotal = visitForm.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const newVisit = {
        customerName: selectedPatient.name,
        customerPhone: selectedPatient.phone,
        items: visitForm.selectedItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category || 'Medis',
          type: item.type || 'service',
          sharingType: item.sharingType,
          doctorCommission: item.doctorCommission,
          nurseCommission: item.nurseCommission,
          adminCommission: item.adminCommission,
          ownerCommission: item.ownerCommission,
          financeCommission: item.financeCommission
        })),
        subtotal: subtotal,
        discount: 0,
        total: subtotal,
        notes: visitForm.notes || '-',
        createdAt: new Date(visitForm.date),
        createdBy: 'Admin',
        doctorId: visitForm.doctorId,
        doctorName: selectedDoctor?.displayName || '',
        nurseId: visitForm.nurseId,
        nurseName: selectedNurse?.displayName || '',
        isDelivery: false,
        tableNumber: '-'
      };

      await addDoc(collection(db, 'sales'), newVisit);
      
      setIsVisitModalOpen(false);
      setVisitForm({
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        notes: '',
        selectedItems: [],
        doctorId: '',
        nurseId: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleItemInVisit = (product: any) => {
    const existing = visitForm.selectedItems.find(i => i.id === product.id);
    if (existing) {
      setVisitForm({
        ...visitForm,
        selectedItems: visitForm.selectedItems.filter(i => i.id !== product.id)
      });
    } else {
      setVisitForm({
        ...visitForm,
        selectedItems: [...visitForm.selectedItems, { ...product, quantity: 1 }]
      });
    }
  };

  const [visitProductSearch, setVisitProductSearch] = useState('');
  
  const filteredProductsForVisit = useMemo(() => {
    return products.filter(p => 
      (p.name || '').toLowerCase().includes(visitProductSearch.toLowerCase()) || 
      (p.category && p.category.toLowerCase().includes(visitProductSearch.toLowerCase()))
    );
  }, [products, visitProductSearch]);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentForm.patientName || !appointmentForm.patientPhone || !appointmentForm.doctorId) return;

    setSubmitting(true);
    try {
      const selectedDoctor = doctors.find(d => d.uid === appointmentForm.doctorId);
      
      const newAppointment = {
        patientName: appointmentForm.patientName,
        patientPhone: appointmentForm.patientPhone,
        doctorId: appointmentForm.doctorId,
        doctorName: selectedDoctor?.displayName || '',
        nurseId: appointmentForm.nurseId || '',
        nurseName: nurses.find(n => n.uid === appointmentForm.nurseId)?.displayName || '',
        date: new Date(appointmentForm.date),
        startTime: appointmentForm.startTime,
        endTime: appointmentForm.endTime,
        notes: appointmentForm.notes,
        status: 'scheduled',
        createdAt: serverTimestamp(),
        createdBy: 'Admin'
      };

      await addDoc(collection(db, 'appointments'), newAppointment);
      
      setIsAppointmentModalOpen(false);
      setAppointmentForm({
        patientName: '',
        patientPhone: '',
        doctorId: '',
        nurseId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '10:00',
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appointments');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPatients = useMemo(() => {
    return patients.filter(p => 
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.phone || '').includes(searchTerm)
    );
  }, [patients, searchTerm]);

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return patients.find(p => p.id === selectedPatientId);
  }, [patients, selectedPatientId]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentCalendarDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentCalendarDate]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const matchDoctor = staffFilter.doctorId ? app.doctorId === staffFilter.doctorId : true;
      const matchNurse = staffFilter.nurseId ? app.nurseId === staffFilter.nurseId : true;
      return matchDoctor && matchNurse;
    });
  }, [appointments, staffFilter]);

  if (loading && allSales.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Memuat Data Pasien...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 sm:p-8 custom-scrollbar font-sans h-full">
      <div className="max-w-7xl mx-auto space-y-8 pb-32 md:pb-10">
        {/* Header Section - Responsive */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Database Pasien</h1>
                <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Pengelolaan & Riwayat Medis Pasien Klinik
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 relative z-10 w-full lg:w-auto">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.1em] transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Pasien Baru
            </button>

            {viewMode === 'detail' && (
              <button 
                onClick={() => setViewMode('grid')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-200"
              >
                Kembali
              </button>
            )}

            <button 
              onClick={() => setViewMode(viewMode === 'calendar' ? 'grid' : 'calendar')}
              className={cn(
                "flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 active:scale-95 border",
                viewMode === 'calendar' 
                  ? "bg-slate-900 text-white border-slate-900" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Calendar className="w-4 h-4" /> 
              <span className="hidden xs:inline">{viewMode === 'calendar' ? 'Tutup' : 'Kalender'}</span>
            </button>
            
            <div className="relative w-full sm:w-auto sm:flex-1 lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Cari nama atau telepon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 sm:py-3.5 pl-12 pr-4 text-[10px] sm:text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="space-y-8 pb-10">
            {/* Stats Overview & Chart - Responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Summary Cards */}
              <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Pasien</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{patients.length}</p>
                </div>
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Kunjungan</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{allSales.length}</p>
                </div>
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/60 shadow-sm col-span-2 sm:col-span-1 lg:col-span-1 hidden sm:block">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                      <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest">Pasien Hari Ini</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {allSales.filter(s => {
                      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                      return format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    }).length}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-slate-800 tracking-tight flex items-center gap-2 text-sm">
                      <span className="w-2 h-6 bg-blue-600 rounded-full" />
                      Tren Kunjungan (14 Hari Terakhir)
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kunjungan</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={visitTrendData}>
                        <defs>
                          <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1E293B', 
                            border: 'none', 
                            borderRadius: '16px',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '12px'
                          }}
                          itemStyle={{ color: '#fff' }}
                          cursor={{ stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '4 4' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="visits" 
                          stroke="#2563eb" 
                          strokeWidth={4}
                          fillOpacity={1} 
                          fill="url(#colorVisits)" 
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-slate-800 tracking-tight flex items-center gap-2 text-sm">
                      <span className="w-2 h-6 bg-emerald-500 rounded-full" />
                      Pendapatan Bulanan (Setahun Terakhir)
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue (IDR)</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`Rp ${value.toLocaleString()}`, 'Total Revenue']}
                          contentStyle={{ 
                            backgroundColor: '#1E293B', 
                            border: 'none', 
                            borderRadius: '16px',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '12px'
                          }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar 
                          dataKey="revenue" 
                          radius={[6, 6, 0, 0]}
                          animationDuration={2000}
                        >
                          {monthlyTrendData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === monthlyTrendData.length - 1 ? '#10b981' : '#10b98144'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              {filteredPatients.map((patient) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={patient.id} 
                  onClick={() => {
                    setSelectedPatientId(patient.id);
                    setViewMode('detail');
                  }}
                  className="bg-white border border-slate-200/60 p-6 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between group hover:border-blue-300 hover:shadow-xl hover:shadow-blue-900/5 transition-all gap-6 cursor-pointer"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner shrink-0 scale-95 group-hover:scale-100 duration-500">
                      <User className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        {patient.name}
                        {patient.visitCount > 5 && <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-lg text-[8px] uppercase tracking-widest font-black">Loyal Patient</span>}
                      </h4>
                      <div className="flex flex-wrap items-center gap-4">
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
                          <Phone className="w-3.5 h-3.5" /> {patient.phone}
                        </p>
                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" /> {patient.visitCount} Kunjungan
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 self-end md:self-center">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Kontribusi</p>
                      <p className="text-lg font-black text-emerald-600 font-mono tracking-tighter">Rp {patient.totalSpent.toLocaleString()}</p>
                    </div>

                    <div className="h-12 w-px bg-slate-100 hidden md:block" />

                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Terakhir Berkunjung</p>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-slate-700">
                          {format(patient.lastVisit?.toDate ? patient.lastVisit.toDate() : new Date(patient.lastVisit), 'dd MMM yyyy')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {format(patient.lastVisit?.toDate ? patient.lastVisit.toDate() : new Date(patient.lastVisit), 'HH:mm')}
                        </span>
                      </div>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all rotate-45 group-hover:rotate-0">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                  </div>
                </motion.div>
              ))}

              {filteredPatients.length === 0 && (
                <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                  <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-inner">
                    <User className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-[0.2em]">
                    {searchTerm ? 'Pencarian tidak ditemukan' : 'Database Masih Kosong'}
                  </h3>
                  <p className="text-xs font-bold text-slate-300 mt-2">Gunakan tombol 'Pasien Baru' untuk memulai</p>
                </div>
              )}
            </div>
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Calendar Controls & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                 <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-blue-600" /> Filter Jadwal
                 </h3>
                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Dokter</label>
                     <select 
                       value={staffFilter.doctorId}
                       onChange={(e) => setStaffFilter({...staffFilter, doctorId: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                     >
                       <option value="">Semua Dokter</option>
                       {doctors.map(d => (
                         <option key={d.uid} value={d.uid}>{d.displayName}</option>
                       ))}
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Perawat</label>
                     <select 
                       value={staffFilter.nurseId}
                       onChange={(e) => setStaffFilter({...staffFilter, nurseId: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                     >
                       <option value="">Semua Perawat</option>
                       {nurses.map(n => (
                         <option key={n.uid} value={n.uid}>{n.displayName}</option>
                       ))}
                     </select>
                   </div>
                 </div>
                 <button 
                   onClick={() => setIsAppointmentModalOpen(true)}
                   className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/10 transition-all flex items-center justify-center gap-2"
                 >
                   <Plus className="w-4 h-4" /> Tambah Jadwal
                 </button>
              </div>

              <div className="bg-blue-600 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-900/20">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Total Jadwal Bulan Ini</p>
                 <p className="text-4xl font-black">{appointments.filter(a => isSameMonth(a.date, currentCalendarDate)).length}</p>
                 <div className="mt-6 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span>Mendatang</span>
                      <span>{appointments.filter(a => a.date >= new Date() && a.status === 'scheduled').length}</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: '60%' }} />
                    </div>
                 </div>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                   <button onClick={() => setCurrentCalendarDate(subMonths(currentCalendarDate, 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                     <ChevronLeft className="w-5 h-5 text-slate-400" />
                   </button>
                   <h2 className="text-xl font-black text-slate-900 tracking-tight min-w-[200px] text-center">
                     {format(currentCalendarDate, 'MMMM yyyy')}
                   </h2>
                   <button onClick={() => setCurrentCalendarDate(addMonths(currentCalendarDate, 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                     <ChevronRight className="w-5 h-5 text-slate-400" />
                   </button>
                </div>
                <div className="flex gap-2">
                  {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(d => (
                    <div key={d} className="w-10 text-[9px] font-black text-slate-400 uppercase text-center">{d.slice(0, 3)}</div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-3xl overflow-hidden border border-slate-100 shadow-inner">
                {calendarDays.map((day, idx) => {
                  const dayAppointments = filteredAppointments.filter(app => isSameDay(app.date, day));
                  const isOtherMonth = !isSameMonth(day, currentCalendarDate);
                  const isSelected = selectedCalendarDay && isSameDay(day, selectedCalendarDay);
                  
                  return (
                    <div 
                      key={idx}
                      onClick={() => setSelectedCalendarDay(day)}
                      className={cn(
                        "min-h-[100px] p-2 transition-all cursor-pointer relative group",
                        isOtherMonth ? "bg-slate-50/50" : "bg-white",
                        isSelected ? "bg-blue-50/50 ring-2 ring-blue-600 ring-inset z-10" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={cn(
                          "text-[10px] font-black",
                          isToday(day) ? "bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-lg" : isOtherMonth ? "text-slate-300" : "text-slate-900"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {dayAppointments.length > 0 && (
                          <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-lg">{dayAppointments.length}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 2).map((app, i) => (
                          <div key={i} className="text-[8px] font-bold bg-blue-100/50 text-blue-700 px-2 py-1 rounded-lg truncate border border-blue-200/50">
                            {app.startTime} - {app.patientName}
                          </div>
                        ))}
                        {dayAppointments.length > 2 && (
                          <div className="text-[8px] font-black text-slate-400 text-center uppercase tracking-widest mt-1">
                            +{dayAppointments.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Day Agenda */}
              {selectedCalendarDay && (
                <div className="mt-8 border-t border-slate-100 pt-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-slate-900 tracking-tight text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" /> 
                      Agenda: {format(selectedCalendarDay, 'dd MMMM yyyy')}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 capitalize">{filteredAppointments.filter(app => isSameDay(app.date, selectedCalendarDay)).length} Jadwal</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAppointments.filter(app => isSameDay(app.date, selectedCalendarDay)).length > 0 ? (
                      filteredAppointments.filter(app => isSameDay(app.date, selectedCalendarDay)).map(app => (
                        <div key={app.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 transition-all relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-16 h-16 bg-blue-600/5 -rotate-12 translate-x-4 -translate-y-4 rounded-full" />
                           <div className="flex justify-between items-start mb-2 relative z-10">
                              <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-lg font-mono">
                                {app.startTime} - {app.endTime}
                              </span>
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                app.status === 'scheduled' ? "bg-blue-500" : app.status === 'completed' ? "bg-emerald-500" : "bg-red-500"
                              )} />
                           </div>
                           <p className="text-xs font-black text-slate-900 mb-1 truncate">{app.patientName}</p>
                           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-3">
                             <Phone className="w-3 h-3" /> {app.patientPhone}
                           </div>
                           <div className="flex items-center gap-3 pt-3 border-t border-slate-200/50">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                                  <Stethoscope className="w-3 h-3" />
                                </div>
                                <span className="text-[9px] font-black text-slate-600 uppercase">{app.doctorName?.split(' ')[0]}</span>
                              </div>
                              {app.nurseId && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                                    <Activity className="w-3 h-3" />
                                  </div>
                                  <span className="text-[9px] font-black text-slate-600 uppercase">{app.nurseName?.split(' ')[0]}</span>
                                </div>
                              )}
                           </div>
                           {app.notes && (
                             <p className="mt-3 text-[9px] font-bold text-slate-400 italic line-clamp-1">"{app.notes}"</p>
                           )}
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                         <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tidak ada jadwal untuk hari ini</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : selectedPatient ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Patient Profile Header */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row gap-8 items-start">
              <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                <User className="w-10 h-10" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedPatient.name}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> {selectedPatient.phone}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Total Kunjungan</p>
                    <p className="text-sm font-black text-slate-900">{selectedPatient.visitCount} Kali</p>
                  </div>
                  <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-[8px] font-black uppercase text-emerald-600 tracking-widest mb-0.5">Total Kontribusi</p>
                    <p className="text-sm font-black text-emerald-700">Rp {selectedPatient.totalSpent.toLocaleString()}</p>
                  </div>
                  <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-[8px] font-black uppercase text-blue-600 tracking-widest mb-0.5">Kunjungan Terakhir</p>
                    <p className="text-sm font-black text-blue-700">
                      {format(selectedPatient.lastVisit?.toDate ? selectedPatient.lastVisit.toDate() : new Date(selectedPatient.lastVisit), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsVisitModalOpen(true)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-900/10 transition-all flex items-center gap-2 active:scale-95 ml-auto md:ml-4"
                  >
                    <Plus className="w-3.5 h-3.5" /> Catat Kunjungan Baru
                  </button>
                </div>
                {selectedPatient.address && (
                  <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <MapPin className="w-3.5 h-3.5" />
                    <p className="text-xs font-bold">
                      {selectedPatient.address.street}, {selectedPatient.address.city}, {selectedPatient.address.province} {selectedPatient.address.postalCode}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rekam Medis & Odontogram Pasien */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="w-2 h-6 bg-purple-600 rounded-full" />
                  Rekam Medis & Odontogram Pasien
                </h3>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  ID Pasien: {selectedPatient.id.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Identitas Pasien Detail */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" /> Profil & Demografis
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">No. Rekam Medis</p>
                      <p className="text-xs font-bold text-slate-900">{selectedPatient.mrNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">NIK (KTP)</p>
                      <p className="text-xs font-bold text-slate-900">{selectedPatient.nik || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Tanggal Lahir / Umur</p>
                      <p className="text-xs font-bold text-slate-900">{selectedPatient.dob || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Pekerjaan</p>
                      <p className="text-xs font-bold text-slate-900">{selectedPatient.occupation || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Email</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{selectedPatient.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Poli</p>
                      <p className="text-xs font-bold text-slate-900">{selectedPatient.poli || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Lokasi Registrasi / Cabang</p>
                      <p className="text-xs font-bold text-slate-900">{selectedPatient.branch || '-'}</p>
                    </div>
                  </div>

                  {selectedPatient.chiefComplaint && (
                    <div className="p-5 bg-red-50/20 border border-red-100 rounded-3xl">
                      <h5 className="text-[9px] font-black uppercase text-red-600 tracking-widest mb-1.5">Keluhan Utama</h5>
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">"{selectedPatient.chiefComplaint}"</p>
                    </div>
                  )}
                </div>

                {/* Kondisi Klinis / Vital Signs & Data Medik */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" /> Kondisi Klinis & Kesehatan
                  </h4>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Tensi</p>
                      <p className="text-xs font-black text-slate-800">{selectedPatient.vitalSigns?.tension || '-'}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Suhu</p>
                      <p className="text-xs font-black text-slate-800">{selectedPatient.vitalSigns?.temp ? `${selectedPatient.vitalSigns.temp} °C` : '-'}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Nadi</p>
                      <p className="text-xs font-black text-slate-800">{selectedPatient.vitalSigns?.pulse || '-'}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Napas</p>
                      <p className="text-xs font-black text-slate-800">{selectedPatient.vitalSigns?.respiration || '-'}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Berat</p>
                      <p className="text-xs font-black text-slate-800">{selectedPatient.vitalSigns?.weight || '-'}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Tinggi</p>
                      <p className="text-xs font-black text-slate-800">{selectedPatient.vitalSigns?.height || '-'}</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Golongan Darah</p>
                        <p className="text-sm font-black text-indigo-600">{selectedPatient.medicalData?.bloodType || 'Belum diisi'}</p>
                      </div>
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Riwayat Alergi</p>
                        <p className="text-xs font-bold text-red-500">{selectedPatient.medicalData?.allergies || '-'}</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Riwayat Dental & Keturunan</p>
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">
                        Dental: {selectedPatient.medicalData?.dentalHistory || '-'} <br />
                        Keturunan: {selectedPatient.medicalData?.geneticDisease || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient Tooth Chart (Odontogram) */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-purple-600" /> Odontogram Pasien (Kondisi Gigi Aktif)
                  </h4>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditingOdontogram ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTempOdontogram(selectedPatient.odontogram || {});
                          setIsEditingOdontogram(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200/60 transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Odontogram
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingOdontogram}
                          onClick={handleSaveOdontogram}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm border border-emerald-700 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {savingOdontogram ? 'Menyimpan...' : '💾 Simpan'}
                        </button>
                        <button
                          type="button"
                          disabled={savingOdontogram}
                          onClick={() => {
                            setTempOdontogram(selectedPatient.odontogram || {});
                            setIsEditingOdontogram(false);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          ✕ Batal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100/80 font-mono text-center space-y-6">
                  {isEditingOdontogram && (
                    <div className="flex flex-wrap gap-2 items-center justify-center bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm max-w-2xl mx-auto mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Terapkan Kuas:</span>
                      {[
                        { label: 'Normal', code: 'Normal' },
                        { label: 'Karies', code: 'Caries' },
                        { label: 'Ompong', code: 'Missing' },
                        { label: 'Tambalan', code: 'Restored' },
                        { label: 'Crown', code: 'Crown' },
                        { label: 'PSA', code: 'PSA' }
                      ].map(cond => (
                        <button
                          key={cond.code}
                          type="button"
                          onClick={() => setActiveEditToothBrush(cond.code)}
                          className={cn(
                            "px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-all flex items-center gap-1 cursor-pointer",
                            activeEditToothBrush === cond.code 
                              ? "ring-2 ring-purple-500 border-transparent font-black bg-purple-50 text-purple-700 scale-105" 
                              : "hover:bg-slate-50 text-slate-600 border-slate-200"
                          )}
                        >
                          <span className={cn("w-2 h-2 rounded-full", 
                            cond.code === 'Normal' ? 'bg-emerald-500' :
                            cond.code === 'Caries' ? 'bg-red-500' :
                            cond.code === 'Missing' ? 'bg-slate-400' :
                            cond.code === 'Restored' ? 'bg-blue-500' :
                            cond.code === 'Crown' ? 'bg-purple-500' : 'bg-amber-500'
                          )} />
                          {cond.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3 text-left">Rahang Atas (Upper Jaw)</p>
                    <div className="flex flex-wrap gap-2 justify-center py-1">
                      {['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'].map(t => {
                        const state = isEditingOdontogram ? (tempOdontogram[t] || 'Normal') : (selectedPatient.odontogram?.[t] || 'Normal');
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={!isEditingOdontogram || savingOdontogram}
                            onClick={() => {
                              if (!isEditingOdontogram) return;
                              setTempOdontogram(prev => ({
                                ...prev,
                                [t]: activeEditToothBrush
                              }));
                            }}
                            className={cn(
                              "h-12 w-12 border-2 rounded-xl flex flex-col justify-between items-center p-2 text-white shrink-0 select-none transition-all",
                              isEditingOdontogram 
                                ? "cursor-pointer hover:scale-105 border-dashed active:scale-95" 
                                : "cursor-default",
                              state === 'Normal' ? 'bg-emerald-500 border-emerald-600' :
                              state === 'Caries' ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/10' :
                              state === 'Missing' ? 'bg-slate-400 border-slate-500' :
                              state === 'Restored' ? 'bg-blue-500 border-blue-600' :
                              state === 'Crown' ? 'bg-purple-500 border-purple-600' : 'bg-amber-500 border-amber-600'
                            )}
                          >
                            <span className="text-[8px] font-black">{t}</span>
                            <span className="text-[9px] font-bold leading-none">
                              {state === 'Normal' ? 'N' :
                               state === 'Caries' ? 'C' :
                               state === 'Missing' ? 'M' :
                               state === 'Restored' ? 'T' :
                               state === 'Crown' ? 'Cr' : 'PSA'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3 text-left">Rahang Bawah (Lower Jaw)</p>
                    <div className="flex flex-wrap gap-2 justify-center py-1">
                      {['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'].map(t => {
                        const state = isEditingOdontogram ? (tempOdontogram[t] || 'Normal') : (selectedPatient.odontogram?.[t] || 'Normal');
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={!isEditingOdontogram || savingOdontogram}
                            onClick={() => {
                              if (!isEditingOdontogram) return;
                              setTempOdontogram(prev => ({
                                ...prev,
                                [t]: activeEditToothBrush
                              }));
                            }}
                            className={cn(
                              "h-12 w-12 border-2 rounded-xl flex flex-col justify-between items-center p-2 text-white shrink-0 select-none transition-all",
                              isEditingOdontogram 
                                ? "cursor-pointer hover:scale-105 border-dashed active:scale-95" 
                                : "cursor-default",
                              state === 'Normal' ? 'bg-emerald-500 border-emerald-600' :
                              state === 'Caries' ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/10' :
                              state === 'Missing' ? 'bg-slate-400 border-slate-500' :
                              state === 'Restored' ? 'bg-blue-500 border-blue-600' :
                              state === 'Crown' ? 'bg-purple-500 border-purple-600' : 'bg-amber-500 border-amber-600'
                            )}
                          >
                            <span className="text-[8px] font-black">{t}</span>
                            <span className="text-[9px] font-bold leading-none">
                              {state === 'Normal' ? 'N' :
                               state === 'Caries' ? 'C' :
                               state === 'Missing' ? 'M' :
                               state === 'Restored' ? 'T' :
                               state === 'Crown' ? 'Cr' : 'PSA'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 items-center justify-center pt-2 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-600" />
                      <span>{'(N) Normal'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-red-500 border border-red-600" />
                      <span>{'(C) Karies'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-slate-400 border border-slate-550" />
                      <span>{'(M) Ompong'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-blue-500 border border-blue-600" />
                      <span>{'(T) Tambalan'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-purple-500 border border-purple-600" />
                      <span>{'(Cr) Crown'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-600" />
                      <span>{'(PSA) PSA'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visit History */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
              <h3 className="font-black text-slate-800 tracking-tight mb-8 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-600 rounded-full" />
                Riwayat Kunjungan & Transaksi
              </h3>
              <div className="space-y-6">
                {selectedPatient.transactions.map((sale) => (
                  <div key={sale.id} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-blue-200 transition-colors group">
                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            {format(sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt), 'dd MMMM yyyy')}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Jam {format(sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt), 'HH:mm')} • #{sale.id?.slice(-8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pembayaran</p>
                        <p className="text-lg font-black text-blue-600 font-mono">Rp {sale.total.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <ClipboardList className="w-3.5 h-3.5" /> Item & Tindakan
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2">
                              {item.name} <span className="text-blue-500">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <Stethoscope className="w-3.5 h-3.5" /> Tenaga Medis
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                          <div className="p-3 bg-white rounded-xl border border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Dokter</p>
                            {sale.doctorName || '-'}
                          </div>
                          <div className="p-3 bg-white rounded-xl border border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Perawat</p>
                            {sale.nurseName || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {sale.notes && sale.notes !== '-' && (
                      <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Catatan Medis / Keterangan</p>
                        <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{sale.notes}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Appointment Modal */}
      <AnimatePresence>
        {isAppointmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Atur Jadwal Baru</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sertakan detail pasien & waktu</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAppointmentModalOpen(false)}
                    className="p-3 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddAppointment} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Pasien</label>
                        <input 
                          required
                          type="text"
                          value={appointmentForm.patientName}
                          onChange={(e) => setAppointmentForm({...appointmentForm, patientName: e.target.value})}
                          placeholder="John Doe"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">No. Telepon</label>
                        <input 
                          required
                          type="tel"
                          value={appointmentForm.patientPhone}
                          onChange={(e) => setAppointmentForm({...appointmentForm, patientPhone: e.target.value})}
                          placeholder="08..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Dokter</label>
                        <select 
                          required
                          value={appointmentForm.doctorId}
                          onChange={(e) => setAppointmentForm({...appointmentForm, doctorId: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        >
                          <option value="">Pilih Dokter</option>
                          {doctors.map(d => (
                            <option key={d.uid} value={d.uid}>{d.displayName}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Perawat (Opsional)</label>
                        <select 
                          value={appointmentForm.nurseId}
                          onChange={(e) => setAppointmentForm({...appointmentForm, nurseId: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        >
                          <option value="">Pilih Perawat</option>
                          {nurses.map(n => (
                            <option key={n.uid} value={n.uid}>{n.displayName}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1 space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tanggal</label>
                        <input 
                          required
                          type="date"
                          value={appointmentForm.date}
                          onChange={(e) => setAppointmentForm({...appointmentForm, date: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mulai</label>
                        <input 
                          required
                          type="time"
                          value={appointmentForm.startTime}
                          onChange={(e) => setAppointmentForm({...appointmentForm, startTime: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Selesai</label>
                        <input 
                          required
                          type="time"
                          value={appointmentForm.endTime}
                          onChange={(e) => setAppointmentForm({...appointmentForm, endTime: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Catatan Tambahan</label>
                      <textarea 
                        rows={2}
                        value={appointmentForm.notes}
                        onChange={(e) => setAppointmentForm({...appointmentForm, notes: e.target.value})}
                        placeholder="Keluhan awal atau instruksi khusus..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4">
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Konfirmasi Jadwal
                        </>
                      )}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsAppointmentModalOpen(false)}
                      className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                      Batalkan
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Patient Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Registrasi Pasien</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Input data pasien secara manual</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddPatient} className="space-y-6">
                  <div className="max-h-[62vh] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {/* SECTION 1: IDENTITAS PASIEN */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="w-1.5 h-4 bg-blue-600 rounded-full" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Identitas Pasien</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Lengkap Pasien</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="text"
                              value={patientForm.name}
                              onChange={(e) => setPatientForm({...patientForm, name: e.target.value})}
                              placeholder="Contoh: John Doe"
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nomor Telepon / WhatsApp</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="tel"
                              value={patientForm.phone}
                              onChange={(e) => setPatientForm({...patientForm, phone: e.target.value})}
                              placeholder="08123456789"
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nomor Rekam Medis (No RM)</label>
                          <input 
                            type="text"
                            value={patientForm.mrNumber}
                            onChange={(e) => setPatientForm({...patientForm, mrNumber: e.target.value})}
                            placeholder="Contoh: RM-10492"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">NIK (Nomor Induk Kependudukan)</label>
                          <input 
                            type="text"
                            value={patientForm.nik}
                            onChange={(e) => setPatientForm({...patientForm, nik: e.target.value})}
                            placeholder="Contoh: 31730..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tanggal Lahir / Umur</label>
                          <input 
                            type="text"
                            value={patientForm.dob}
                            onChange={(e) => setPatientForm({...patientForm, dob: e.target.value})}
                            placeholder="Contoh: 12 April 1995 / 31 Tahun"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Pekerjaan</label>
                          <input 
                            type="text"
                            value={patientForm.occupation}
                            onChange={(e) => setPatientForm({...patientForm, occupation: e.target.value})}
                            placeholder="Contoh: Karyawan Swasta"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Alamat Lengkap (Jalan / No. Rumah)</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text"
                            value={patientForm.street}
                            onChange={(e) => setPatientForm({...patientForm, street: e.target.value})}
                            placeholder="Contoh: Jl. Mangga Dua No. 12"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Kota</label>
                          <input 
                            type="text"
                            value={patientForm.city}
                            onChange={(e) => setPatientForm({...patientForm, city: e.target.value})}
                            placeholder="Kota"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Provinsi</label>
                          <input 
                            type="text"
                            value={patientForm.province}
                            onChange={(e) => setPatientForm({...patientForm, province: e.target.value})}
                            placeholder="Provinsi"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Kode Pos</label>
                          <input 
                            type="text"
                            value={patientForm.postalCode}
                            onChange={(e) => setPatientForm({...patientForm, postalCode: e.target.value})}
                            placeholder="Kode Pos"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Email</label>
                          <input 
                            type="email"
                            value={patientForm.email}
                            onChange={(e) => setPatientForm({...patientForm, email: e.target.value})}
                            placeholder="Contoh: joni@gmail.com"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Lokasi / Cabang</label>
                          <input 
                            type="text"
                            value={patientForm.branch}
                            onChange={(e) => setPatientForm({...patientForm, branch: e.target.value})}
                            placeholder="Cabang Klinik"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Poli</label>
                          <input 
                            type="text"
                            value={patientForm.poli}
                            onChange={(e) => setPatientForm({...patientForm, poli: e.target.value})}
                            placeholder="Contoh: Poli Gigi"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>
                      </div>
                    </div>

                    {/* EXPANDABLE SECTION: VITAL SIGN */}
                    <div className="border border-slate-100 bg-white rounded-3xl overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => setShowVitalSignsForm(!showVitalSignsForm)}
                        className="w-full px-5 py-4 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Activity className="w-5 h-5 text-emerald-500" />
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">Tanda-Tanda Vital (Vital Signs)</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Tensi, Suhu, Nadi, Napas, BB, TB</p>
                          </div>
                        </div>
                        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-300", showVitalSignsForm && "rotate-180")} />
                      </button>
                      
                      <AnimatePresence>
                        {showVitalSignsForm && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden border-t border-slate-100/60 p-5 space-y-4 bg-white"
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tekanan Darah (Tensi)</label>
                                <input 
                                  type="text"
                                  value={patientForm.tension}
                                  onChange={(e) => setPatientForm({...patientForm, tension: e.target.value})}
                                  placeholder="Contoh: 120/80 mmHg"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Suhu Tubuh (°C)</label>
                                <input 
                                  type="text"
                                  value={patientForm.temp}
                                  onChange={(e) => setPatientForm({...patientForm, temp: e.target.value})}
                                  placeholder="Contoh: 36.5"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nadi (Pulse)</label>
                                <input 
                                  type="text"
                                  value={patientForm.pulse}
                                  onChange={(e) => setPatientForm({...patientForm, pulse: e.target.value})}
                                  placeholder="Contoh: 80 x/menit"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Respirasi (Napas)</label>
                                <input 
                                  type="text"
                                  value={patientForm.respiration}
                                  onChange={(e) => setPatientForm({...patientForm, respiration: e.target.value})}
                                  placeholder="Contoh: 20 x/menit"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Berat Badan (BB)</label>
                                <input 
                                  type="text"
                                  value={patientForm.weight}
                                  onChange={(e) => setPatientForm({...patientForm, weight: e.target.value})}
                                  placeholder="Contoh: 65 kg"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tinggi Badan (TB)</label>
                                <input 
                                  type="text"
                                  value={patientForm.height}
                                  onChange={(e) => setPatientForm({...patientForm, height: e.target.value})}
                                  placeholder="Contoh: 170 cm"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* EXPANDABLE SECTION: DATA MEDIK */}
                    <div className="border border-slate-100 bg-white rounded-3xl overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => setShowMedicalDataForm(!showMedicalDataForm)}
                        className="w-full px-5 py-4 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <ClipboardList className="w-5 h-5 text-blue-500" />
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">Data Medik & Riwayat Kesehatan</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Riwayat Dental, Keturunan, Alergi, Golongan Darah, Catatan</p>
                          </div>
                        </div>
                        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-300", showMedicalDataForm && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {showMedicalDataForm && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden border-t border-slate-100/60 p-5 space-y-4 bg-white"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Riwayat Dental & Perawatan Gigi</label>
                                <input 
                                  type="text"
                                  value={patientForm.dentalHistory}
                                  onChange={(e) => setPatientForm({...patientForm, dentalHistory: e.target.value})}
                                  placeholder="Contoh: Pernah PSA / Cabut gigi"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Riwayat Penyakit Keturunan</label>
                                <input 
                                  type="text"
                                  value={patientForm.geneticDisease}
                                  onChange={(e) => setPatientForm({...patientForm, geneticDisease: e.target.value})}
                                  placeholder="Contoh: Diabetes, Hipertensi, Jantung"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Riwayat Alergi (Obat/Makanan)</label>
                                <input 
                                  type="text"
                                  value={patientForm.allergies}
                                  onChange={(e) => setPatientForm({...patientForm, allergies: e.target.value})}
                                  placeholder="Contoh: Alergi Amoxicillin, Latex"
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Golongan Darah</label>
                                <select 
                                  value={patientForm.bloodType}
                                  onChange={(e) => setPatientForm({...patientForm, bloodType: e.target.value})}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                                >
                                  <option value="">-- Pilih Golongan Darah (Opsional) --</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="AB">AB</option>
                                  <option value="O">O</option>
                                  <option value="A+">A+</option>
                                  <option value="B+">B+</option>
                                  <option value="O+">O+</option>
                                  <option value="Lainnya">Lainnya / Belum Cek</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Catatan Tambahan Medis</label>
                              <textarea 
                                rows={2}
                                value={patientForm.medicalNotes}
                                onChange={(e) => setPatientForm({...patientForm, medicalNotes: e.target.value})}
                                placeholder="Tulis catatan, pantangan, atau pengkondisian khusus bagi pasien ini..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner resize-none"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* SECTION: KELUHAN UTAMA */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="w-1.5 h-4 bg-blue-600 rounded-full" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Keluhan Utama</h4>
                      </div>
                      <textarea 
                        rows={2}
                        value={patientForm.chiefComplaint}
                        onChange={(e) => setPatientForm({...patientForm, chiefComplaint: e.target.value})}
                        placeholder="Contoh: Gigi geraham belakang bawah kiri ngilu untuk makan..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner resize-none"
                      />
                    </div>

                    {/* EXPANDABLE SECTION: ODONTOGRAM */}
                    <div className="border border-slate-100 bg-white rounded-3xl overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => setShowOdontogramForm(!showOdontogramForm)}
                        className="w-full px-5 py-4 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Stethoscope className="w-5 h-5 text-purple-500" />
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">Odontogram Interaktif</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Petakan kondisi klinis 32 gigi pasien secara visual</p>
                          </div>
                        </div>
                        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-300", showOdontogramForm && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {showOdontogramForm && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden border-t border-slate-100/60 p-5 space-y-4 bg-white"
                          >
                            <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mr-1">Terapkan Kuas:</span>
                              {[
                                { label: 'Normal', code: 'Normal' },
                                { label: 'Karies', code: 'Caries' },
                                { label: 'Ompong', code: 'Missing' },
                                { label: 'Tambalan', code: 'Restored' },
                                { label: 'Crown', code: 'Crown' },
                                { label: 'PSA', code: 'PSA' }
                              ].map(cond => (
                                <button
                                  key={cond.code}
                                  type="button"
                                  onClick={() => setActiveToothBrush(cond.code)}
                                  className={cn(
                                    "px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-all shadow-sm flex items-center gap-1",
                                    activeToothBrush === cond.code 
                                      ? "ring-2 ring-blue-500 border-transparent font-black scale-105" 
                                      : "hover:bg-white text-slate-600 border-slate-200"
                                  )}
                                >
                                  <span className={cn("w-2 h-2 rounded-full", 
                                    cond.code === 'Normal' ? 'bg-emerald-500' :
                                    cond.code === 'Caries' ? 'bg-red-500' :
                                    cond.code === 'Missing' ? 'bg-slate-400' :
                                    cond.code === 'Restored' ? 'bg-blue-500' :
                                    cond.code === 'Crown' ? 'bg-purple-500' : 'bg-amber-500'
                                  )} />
                                  {cond.label}
                                </button>
                              ))}
                            </div>

                            <div className="space-y-4 bg-slate-50/50 p-4 rounded-[2rem] border border-slate-100 font-mono text-center">
                              <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 text-left ml-1">Rahang Atas (Upper Jaw)</p>
                                <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 justify-center max-w-full overflow-x-auto py-1">
                                  {['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'].map(t => {
                                    const state = patientForm.odontogram[t] || 'Normal';
                                    return (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                          const prev = {...patientForm.odontogram};
                                          prev[t] = activeToothBrush;
                                          setPatientForm({...patientForm, odontogram: prev});
                                        }}
                                        className={cn(
                                          "aspect-square p-2 border rounded-xl flex flex-col justify-between items-center transition-all cursor-pointer h-12 w-12 shrink-0 select-none text-white",
                                          state === 'Normal' ? 'bg-emerald-500 border-emerald-600' :
                                          state === 'Caries' ? 'bg-red-500 border-red-600 animate-pulse' :
                                          state === 'Missing' ? 'bg-slate-400 border-slate-500' :
                                          state === 'Restored' ? 'bg-blue-500 border-blue-600' :
                                          state === 'Crown' ? 'bg-purple-500 border-purple-600' : 'bg-amber-500 border-amber-600'
                                        )}
                                      >
                                        <span className="text-[8px] font-black">{t}</span>
                                        <span className="text-[9px] font-bold leading-none">
                                          {state === 'Normal' ? 'N' :
                                           state === 'Caries' ? 'C' :
                                           state === 'Missing' ? 'M' :
                                           state === 'Restored' ? 'T' :
                                           state === 'Crown' ? 'Cr' : 'PSA'}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 text-left ml-1">Rahang Bawah (Lower Jaw)</p>
                                <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 justify-center max-w-full overflow-x-auto py-1">
                                  {['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'].map(t => {
                                    const state = patientForm.odontogram[t] || 'Normal';
                                    return (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                          const prev = {...patientForm.odontogram};
                                          prev[t] = activeToothBrush;
                                          setPatientForm({...patientForm, odontogram: prev});
                                        }}
                                        className={cn(
                                          "aspect-square p-2 border rounded-xl flex flex-col justify-between items-center transition-all cursor-pointer h-12 w-12 shrink-0 select-none text-white",
                                          state === 'Normal' ? 'bg-emerald-500 border-emerald-600' :
                                          state === 'Caries' ? 'bg-red-500 border-red-600 animate-pulse' :
                                          state === 'Missing' ? 'bg-slate-400 border-slate-500' :
                                          state === 'Restored' ? 'bg-blue-500 border-blue-600' :
                                          state === 'Crown' ? 'bg-purple-500 border-purple-600' : 'bg-amber-500 border-amber-600'
                                        )}
                                      >
                                        <span className="text-[8px] font-black">{t}</span>
                                        <span className="text-[9px] font-bold leading-none">
                                          {state === 'Normal' ? 'N' :
                                           state === 'Caries' ? 'C' :
                                           state === 'Missing' ? 'M' :
                                           state === 'Restored' ? 'T' :
                                           state === 'Crown' ? 'Cr' : 'PSA'}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-left mt-2">
                                Keterangan Simbol: N = Normal, C = Karies/Cup, M = Missing (Cabut), T = Tambalan, Cr = Crown, PSA = Perawatan Saluran Akar
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* SECTION: BIAYA PENDAFTARAN */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Biaya Pendaftaran (Rp)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="number"
                            value={patientForm.registrationFee}
                            onChange={(e) => setPatientForm({...patientForm, registrationFee: parseInt(e.target.value) || 0})}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                        <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                        <p className="text-[9px] font-bold text-blue-700 leading-tight">
                          Biaya admisi pendaftaran akan terlampir otomatis ke ringkasan invoice.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Catatan Admisi Tambahan</label>
                      <textarea 
                        rows={2}
                        value={patientForm.initialNotes}
                        onChange={(e) => setPatientForm({...patientForm, initialNotes: e.target.value})}
                        placeholder="Contoh: Pasien baru periksa rutin..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Simpan Data Pasien
                        </>
                      )}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                      Batalkan
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Visit Modal */}
      <AnimatePresence>
        {isVisitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Catat Kunjungan: {selectedPatient?.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rekam riwayat pemeriksaan & tindakan</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsVisitModalOpen(false)}
                  className="p-3 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <form onSubmit={handleAddVisit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Basic Info */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Waktu Kunjungan</label>
                        <input 
                          required
                          type="datetime-local"
                          value={visitForm.date}
                          onChange={(e) => setVisitForm({...visitForm, date: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Dokter Pemeriksa</label>
                          <select 
                            value={visitForm.doctorId}
                            onChange={(e) => setVisitForm({...visitForm, doctorId: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                          >
                            <option value="">Pilih Dokter</option>
                            {doctors.map(d => (
                              <option key={d.uid} value={d.uid}>{d.displayName}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Perawat / Asisten</label>
                          <select 
                            value={visitForm.nurseId}
                            onChange={(e) => setVisitForm({...visitForm, nurseId: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner"
                          >
                            <option value="">Pilih Perawat</option>
                            {nurses.map(n => (
                              <option key={n.uid} value={n.uid}>{n.displayName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Catatan Medis / Keluhan</label>
                        <textarea 
                          rows={6}
                          value={visitForm.notes}
                          onChange={(e) => setVisitForm({...visitForm, notes: e.target.value})}
                          placeholder="Hasil diagnosa, keluhan, atau instruksi medis..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner resize-none"
                        />
                      </div>
                    </div>

                    {/* Right Column: Item Selection */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Pilih Tindakan & Produk</label>
                          <div className="relative w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input 
                              type="text"
                              placeholder="Cari..."
                              value={visitProductSearch}
                              onChange={(e) => setVisitProductSearch(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-1.5 pl-8 pr-3 text-[10px] font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all font-mono"
                            />
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-4 max-h-[350px] overflow-y-auto space-y-2 shadow-inner custom-scrollbar font-mono">
                           {filteredProductsForVisit.map(p => (
                             <button
                               type="button"
                               key={p.id}
                               onClick={() => toggleItemInVisit(p)}
                               className={cn(
                                 "w-full p-4 rounded-2xl border transition-all flex items-center justify-between text-left group",
                                 visitForm.selectedItems.find(i => i.id === p.id) 
                                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900/20" 
                                  : "bg-white border-slate-100 text-slate-600 hover:border-blue-200"
                               )}
                             >
                               <div className="flex items-center gap-3">
                                 <div className={cn(
                                   "w-8 h-8 rounded-xl flex items-center justify-center text-[10px]",
                                   visitForm.selectedItems.find(i => i.id === p.id) ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
                                 )}>
                                   <Activity className="w-4 h-4" />
                                 </div>
                                 <div className="font-sans">
                                   <p className="text-xs font-black">{p.name}</p>
                                   <p className={cn(
                                     "text-[9px] font-bold uppercase",
                                     visitForm.selectedItems.find(i => i.id === p.id) ? "text-blue-100" : "text-slate-400"
                                   )}>{p.category || 'Medis'}</p>
                                 </div>
                               </div>
                               <p className="text-[10px] font-black">Rp {p.price?.toLocaleString()}</p>
                             </button>
                           ))}
                           {filteredProductsForVisit.length === 0 && (
                             <div className="py-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Item tidak ditemukan</div>
                           )}
                        </div>
                      </div>

                      {/* Selected Items Summary */}
                      <div className="bg-blue-50/50 rounded-[2rem] border border-blue-100/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ringkasan Biaya</p>
                           <p className="text-xs font-black text-blue-700">{visitForm.selectedItems.length} Item</p>
                        </div>
                        <div className="space-y-2 mb-4">
                           {visitForm.selectedItems.map(item => (
                             <div key={item.id} className="flex justify-between text-xs font-bold text-slate-600">
                               <span>{item.name}</span>
                               <span className="font-mono">Rp {item.price.toLocaleString()}</span>
                             </div>
                           ))}
                        </div>
                        <div className="pt-4 border-t border-blue-100 flex justify-between items-center">
                           <p className="text-xs font-black text-blue-900 uppercase">Estimasi Total</p>
                           <p className="text-lg font-black text-blue-600 font-mono">
                             Rp {visitForm.selectedItems.reduce((s, i) => s + i.price, 0).toLocaleString()}
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsVisitModalOpen(false)}
                      className="px-8 py-4 text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                    >
                      Batalkan
                    </button>
                    <button 
                      type="submit"
                      disabled={submitting || visitForm.selectedItems.length === 0}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-900/20 flex items-center gap-2 active:scale-95"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Finalisasi Kunjungan
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
