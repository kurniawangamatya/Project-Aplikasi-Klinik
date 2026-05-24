import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs, deleteDoc, orderBy, where, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Product, CartItem, SaleTransaction, UserProfile } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { 
  Search, Grid, LayoutGrid, Printer, Settings, Save, 
  History, ShoppingCart, Plus, Minus, Trash2, 
  User, Phone, Hash, Percent, FileText, Bike, X, Check,
  Calendar, ArrowLeft, MoreVertical, Edit3, Image as ImageIcon,
  ShoppingBag, PlusCircle, AlertCircle, Clock, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = [
  { name: 'Tosca', value: 'bg-[#5eead4]' },
  { name: 'Lime', value: 'bg-[#bef264]' },
  { name: 'Pink', value: 'bg-[#f472b6]' },
  { name: 'Purple', value: 'bg-[#d8b4fe]' },
  { name: 'Indigo', value: 'bg-[#818cf8]' },
  { name: 'Rose', value: 'bg-[#f9a8d4]' },
  { name: 'Sky', value: 'bg-[#7dd3fc]' },
  { name: 'Cyan', value: 'bg-[#67e8f9]' },
  { name: 'Yellow', value: 'bg-[#fde047]' },
  { name: 'Emerald', value: 'bg-[#10b981]' },
];

export default function Cashier() {
  const { user, profile } = useAuth();
  const { products, categories, users, doctors, nurses, employees, clinicSettings, todayAttendance, loading: dataLoading } = useData();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');

  // Patient Autocomplete Search & Synchronization
  const [allSalesForPatients, setAllSalesForPatients] = useState<SaleTransaction[]>([]);
  const [selectedPatientProfile, setSelectedPatientProfile] = useState<any | null>(null);
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);

  // Load sales to build real-time patient catalog index
  useEffect(() => {
    if (!user) return;
    
    // Query all sales to build patient autocomplete profiles
    const salesQ = query(
      collection(db, 'sales'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(salesQ, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleTransaction));
      setAllSalesForPatients(salesData);
    }, (error) => {
      console.error("Error fetching sales for patient search:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Process unique patients for lookup list (same format as PatientData)
  const patients = useMemo(() => {
    const patientMap: { [key: string]: any } = {};

    allSalesForPatients.forEach(sale => {
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
      
      const currentLastVisit = patientMap[key].lastVisit?.toDate ? patientMap[key].lastVisit.toDate() : new Date(patientMap[key].lastVisit);
      const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
      if (saleDate > currentLastVisit) {
        patientMap[key].lastVisit = sale.createdAt;
        if ((sale as any).address) {
          patientMap[key].address = (sale as any).address;
        }
      }
    });

    Object.values(patientMap).forEach(patient => {
      patient.transactions.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

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
  }, [allSalesForPatients]);

  // Autocomplete filter matching any field requested (Name, Phone, MR Number, NIK, Email)
  const suggestedPatients = useMemo(() => {
    if (!customerName || customerName.trim().length === 0) return [];
    
    const queryStr = customerName.toLowerCase().trim();
    return patients.filter(p => {
      const matchName = p.name?.toLowerCase().includes(queryStr);
      const matchPhone = p.phone?.toLowerCase().includes(queryStr);
      const matchMr = p.mrNumber?.toLowerCase().includes(queryStr);
      const matchNik = p.nik?.toLowerCase().includes(queryStr);
      const matchEmail = p.email?.toLowerCase().includes(queryStr);
      
      return matchName || matchPhone || matchMr || matchNik || matchEmail;
    }).slice(0, 10);
  }, [customerName, patients]);

  // Automatically find if entered name and phone match any patient's DB profile to enforce synchronization
  const activePatientInDB = useMemo(() => {
    if (!customerName) return null;
    const nameKey = customerName.toLowerCase().trim();
    const phoneKey = (customerPhone || '').toLowerCase().trim();
    
    let found = patients.find(p => p.name.toLowerCase().trim() === nameKey && p.phone.toLowerCase().trim() === phoneKey);
    if (!found) {
      found = patients.find(p => p.name.toLowerCase().trim() === nameKey);
    }
    return found || null;
  }, [customerName, customerPhone, patients]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'rp' | 'percent'>('rp');
  const [notes, setNotes] = useState('');
  const [isDelivery, setIsDelivery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeModal, setActiveModal] = useState<'history' | 'settings' | 'denah' | 'receipt' | 'pending' | 'categories' | null>(null);
  const [history, setHistory] = useState<SaleTransaction[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [lastTransaction, setLastTransaction] = useState<SaleTransaction | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [productForm, setProductForm] = useState<Partial<Product>>({ 
    name: '', 
    shortName: '', 
    price: 0, 
    stock: 0, 
    category: 'Alat Endo', 
    color: 'bg-blue-400',
    type: 'product',
    sharingType: 'percentage',
    nurseCommission: 0,
    adminCommission: 0,
    financeCommission: 0,
    ownerCommission: 0
  });

  // Clock for live wage calculation
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Employee Rate for LOGGED IN USER
  useEffect(() => {
    if (!user) return;

    // Rate from DataContext
    const loggedInEmployee = employees.find(e => e.userId === user.uid);
    if (loggedInEmployee) {
      setHourlyRate(loggedInEmployee.hourlyRate || 20000);
    }
  }, [user, employees]);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkEditForm, setBulkEditForm] = useState<{ category?: string; price?: number; stock?: number; color?: string }>({});
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedNurseId, setSelectedNurseId] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{id: string, name: string} | null>(null);
  const [categoryActionLoading, setCategoryActionLoading] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', price: '' });
  const [formError, setFormError] = useState<string | null>(null);

  // States for selected staff attendance and rates
  const [selectedDoctorAttendance, setSelectedDoctorAttendance] = useState<any>(null);
  const [selectedDoctorRate, setSelectedDoctorRate] = useState<number>(0);
  const [selectedNurseAttendance, setSelectedNurseAttendance] = useState<any>(null);
  const [selectedNurseRate, setSelectedNurseRate] = useState<number>(0);

  // Fetch selected doctor's info
  useEffect(() => {
    if (!selectedDoctorId) {
      setSelectedDoctorAttendance(null);
      setSelectedDoctorRate(0);
      return;
    }

    // Rate from DataContext
    const doctorEmployee = employees.find(e => e.userId === selectedDoctorId);
    setSelectedDoctorRate(doctorEmployee?.hourlyRate || 0);

    // Today's Attendance
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'attendance'), 
      where('userId', '==', selectedDoctorId),
      where('date', '==', today),
      limit(1)
    );
    const unsubAttendance = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setSelectedDoctorAttendance(snapshot.docs[0].data());
      else setSelectedDoctorAttendance(null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    });

    return () => {
      unsubAttendance();
    };
  }, [selectedDoctorId, employees]);

  // Fetch selected nurse's info
  useEffect(() => {
    if (!selectedNurseId) {
      setSelectedNurseAttendance(null);
      setSelectedNurseRate(0);
      return;
    }

    // Rate from DataContext
    const nurseEmployee = employees.find(e => e.userId === selectedNurseId);
    setSelectedNurseRate(nurseEmployee?.hourlyRate || 0);

    // Today's Attendance
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'attendance'), 
      where('userId', '==', selectedNurseId),
      where('date', '==', today),
      limit(1)
    );
    const unsubAttendance = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setSelectedNurseAttendance(snapshot.docs[0].data());
      else setSelectedNurseAttendance(null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    });

    return () => {
      unsubAttendance();
    };
  }, [selectedNurseId, employees]);

  // Removed redundant product/doctor/nurse/category listeners as they are in useData()

  const seedCategories = async () => {
    const defaultCats = [
      'Alat Endo', 'Alat Gimu', 'Alat Ortho', 'Alat Tambal', 
      'Apollon', 'Arteri', 'Articulating', 'Autocheck', 'B', 
      'Bahan Habis Pakai', 'Bahan Prostho', 'Bak'
    ];
    for (const cat of defaultCats) {
      await addDoc(collection(db, 'categories'), { name: cat, createdAt: serverTimestamp() });
    }
  };

  const seedProducts = async () => {
    const initialProducts: Omit<Product, 'id'>[] = [
      { name: 'FBC Tray', shortName: 'FBC', price: 150000, stock: 1, category: 'Alat Endo', color: 'bg-[#5eead4]' },
      { name: 'Suction Blue Tip', shortName: 'Suction', price: 45000, stock: 18, category: 'Alat Gimu', color: 'bg-[#bef264]' },
      { name: 'Face Shield', shortName: 'Face', price: 25000, stock: 9, category: 'Alat Ortho', color: 'bg-[#f472b6]' },
      { name: 'E-Flex Gold 25', shortName: 'E-Flex', price: 850000, stock: 2, category: 'Alat Tambal', color: 'bg-[#d8b4fe]' },
      { name: 'Torque Spring 16 x 2 Middle', shortName: 'Torque', price: 120000, stock: 10, category: 'Apollon', color: 'bg-[#818cf8]' },
      { name: 'Gips Biru', shortName: 'Gips', price: 75000, stock: 19, category: 'Arteri', color: 'bg-[#f9a8d4]' },
      { name: 'Elastis 3/8 6.5 Oz', shortName: 'Elastis', price: 35000, stock: 1, category: 'Articulating', color: 'bg-[#7dd3fc]' },
      { name: 'Elastis 3/16 6.5 Oz', shortName: 'Elastis', price: 35000, stock: 2, category: 'Autocheck', color: 'bg-[#7dd3fc]' },
      { name: 'Omnichorma Flow', shortName: 'Omnichorma', price: 1250000, stock: 2, category: 'Bahan Habis Pakai', color: 'bg-[#67e8f9]' },
      { name: 'Beautiful Injectable X SL flow A2', shortName: 'Beautiful', price: 950000, stock: 1, category: 'Bahan Prostho', color: 'bg-[#fde047]' },
    ];
    for (const p of initialProducts) {
      await addDoc(collection(db, 'products'), p);
    }
  };

  const forceResetKatalog = async () => {
    if (!confirm('Peringatan: Ini akan menghapus semua produk kustom dan menginisialisasi ulang katalog. Lanjutkan?')) return;
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'products'));
      const deletions = snapshot.docs.map(d => deleteDoc(doc(db, 'products', d.id)));
      await Promise.all(deletions);
      await seedProducts();
      alert('Katalog berhasil diinisialisasi ulang.');
    } catch (e) {
      console.error('Reset error:', e);
    } finally {
      setLoading(false);
      setActiveModal(null);
    }
  };

  // Fetch History
  useEffect(() => {
    if (activeModal === 'history') {
      const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleTransaction)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sales');
      });
      return () => unsubscribe();
    }
  }, [activeModal]);

  // Fetch Pending
  useEffect(() => {
    const q = query(collection(db, 'pending_orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pending_orders');
    });
    return () => unsubscribe();
  }, []);

  const saveToPending = async () => {
    if (cart.length === 0) return;
    try {
      await addDoc(collection(db, 'pending_orders'), {
        cart,
        customerName,
        customerPhone,
        tableNumber,
        notes,
        isDelivery,
        subtotal,
        discount,
        discountType,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || ''
      });
      resetOrder();
      alert('Pesanan disimpan ke Pesanan Terbuka');
    } catch (e) {
      console.error(e);
    }
  };

  const deletePendingOrder = async (id: string) => {
    if (!confirm('Hapus pesanan tertunda ini?')) return;
    try {
      await deleteDoc(doc(db, 'pending_orders', id));
    } catch (e) {
      alert('Gagal menghapus pesanan tertunda.');
      handleFirestoreError(e, OperationType.DELETE, `pending_orders/${id}`);
    }
  };

  const resumePending = (pending: any) => {
    setCart(pending.cart);
    setCustomerName(pending.customerName);
    setCustomerPhone(pending.customerPhone);
    setTableNumber(pending.tableNumber);
    setNotes(pending.notes);
    setIsDelivery(pending.isDelivery);
    setDiscount(pending.discount);
    setDiscountType(pending.discountType);
    setActiveModal(null);
    // Delete from pending after resume
    deletePendingOrder(pending.id);
  };

  const [isGrouped, setIsGrouped] = useState(false);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.shortName.toLowerCase().includes(search.toLowerCase());
      const matchCategory = activeCategory === 'Semua' || p.category === activeCategory;
      return matchSearch && matchCategory;
    });

    if (isGrouped) {
      result = [...result].sort((a, b) => a.category.localeCompare(b.category));
    }
    return result;
  }, [products, search, activeCategory, isGrouped]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const calculatedDiscount = useMemo(() => {
    if (discountType === 'rp') return discount;
    return (subtotal * discount) / 100;
  }, [subtotal, discount, discountType]);

  const total = subtotal - calculatedDiscount;

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const resetOrder = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setTableNumber('');
    setDiscount(0);
    setNotes('');
    setIsDelivery(false);
    setSelectedDoctorId('');
    setSelectedNurseId('');
    setSelectedPatientProfile(null);
    setShowPatientSuggestions(false);
  };

  const handleOrder = async () => {
    if (cart.length === 0) return;
    try {
      // Resolve matched/selected patient to synchronize patient profile fields with the sale transaction
      const patientData = selectedPatientProfile || activePatientInDB;

      const tx: Omit<SaleTransaction, 'id'> = {
        items: cart,
        subtotal,
        discount: calculatedDiscount,
        total,
        customerName,
        customerPhone: customerPhone || '-',
        tableNumber: tableNumber || '-',
        notes: notes || '-',
        isDelivery,
        doctorId: selectedDoctorId,
        doctorName: doctors.find(d => d.uid === selectedDoctorId)?.displayName || 'Belum Ditentukan',
        nurseId: selectedNurseId,
        nurseName: nurses.find(n => n.uid === selectedNurseId)?.displayName || 'Belum Ditentukan',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || '',

        // Synced patient demographic & clinical profile fields
        ...(patientData ? {
          mrNumber: patientData.mrNumber || '',
          nik: patientData.nik || '',
          dob: patientData.dob || '',
          age: patientData.age || '',
          occupation: patientData.occupation || '',
          email: patientData.email || '',
          branch: patientData.branch || '',
          poli: patientData.poli || '',
          vitalSigns: patientData.vitalSigns || {
            tension: '', temp: '', pulse: '', respiration: '', weight: '', height: ''
          },
          medicalData: patientData.medicalData || {
            dentalHistory: '', geneticDisease: '', allergies: '', bloodType: '', notes: ''
          },
          chiefComplaint: patientData.chiefComplaint || '',
          odontogram: patientData.odontogram || {}
        } : {})
      };
      const docRef = await addDoc(collection(db, 'sales'), tx);
      
      // Update stock
      for (const item of cart) {
        if (item.type === 'service') continue; // Skip stock deduction for services
        
        const productRef = doc(db, 'products', item.id);
        try {
          await updateDoc(productRef, {
            stock: Math.max(0, item.stock - item.quantity)
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `products/${item.id}`);
        }
      }
      
      setLastTransaction({ id: docRef.id, ...tx, createdAt: new Date() });
      resetOrder();
      setActiveModal('receipt');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'sales');
    }
  };

  const handleProductSubmit = async () => {
    setFormError(null);
    if (!productForm.name || !productForm.shortName) {
      setFormError('Nama Produk dan Nama Pendek wajib diisi');
      return;
    }
    
    try {
      // Remove id from productForm if it exists to avoid saving it back to document fields
      const { id, ...dataToSave } = productForm as any;
      
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct), dataToSave);
        alert('Produk berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'products'), dataToSave);
        alert('Produk berhasil ditambahkan');
      }
        setProductForm({ 
          name: '', 
          shortName: '', 
          price: 0, 
          stock: 0, 
          category: 'Alat Endo', 
          color: 'bg-blue-400',
          type: 'product',
          sharingType: 'percentage',
          nurseCommission: 0,
          adminCommission: 0,
          financeCommission: 0,
          ownerCommission: 0
        });
      setEditingProduct(null);
    } catch (e) {
      setFormError('Gagal menyimpan produk. Cek koneksi atau izin.');
      handleFirestoreError(e, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const [manageSearch, setManageSearch] = useState('');

  const filteredManageProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(manageSearch.toLowerCase()) || 
      p.shortName.toLowerCase().includes(manageSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(manageSearch.toLowerCase())
    );
  }, [products, manageSearch]);

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      setDeletingId(null);
    } catch (e) {
      alert('Gagal menghapus produk. Kamu mungkin tidak memiliki izin atau masalah koneksi.');
      handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkUpdate = async () => {
    if (selectedProducts.length === 0) return;
    const updates: any = {};
    if (bulkEditForm.category) updates.category = bulkEditForm.category;
    if (bulkEditForm.price !== undefined) updates.price = bulkEditForm.price;
    if (bulkEditForm.stock !== undefined) updates.stock = bulkEditForm.stock;
    if (bulkEditForm.color) updates.color = bulkEditForm.color;

    if (Object.keys(updates).length === 0) return;

    try {
      setLoading(true);
      for (const id of selectedProducts) {
        await updateDoc(doc(db, 'products', id), updates);
      }
      setSelectedProducts([]);
      setIsBulkModalOpen(false);
      setBulkEditForm({});
      alert(`Berhasil memperbarui ${selectedProducts.length} produk.`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'products/bulk');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async () => {
    if (!newCategoryName) return;
    try {
      setCategoryActionLoading(true);
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), { name: newCategoryName });
      } else {
        await addDoc(collection(db, 'categories'), { name: newCategoryName, createdAt: serverTimestamp() });
      }
      setNewCategoryName('');
      setEditingCategory(null);
    } catch (e) {
      handleFirestoreError(e, editingCategory ? OperationType.UPDATE : OperationType.CREATE, 'categories');
    } finally {
      setCategoryActionLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      setCategoryActionLoading(true);
      const categoryToDelete = categories.find(c => c.id === id);
      if (!categoryToDelete) return;

      const name = categoryToDelete.name;
      const productsInCategory = products.filter(p => p.category === name);
      
      // Update associated products if any
      if (productsInCategory.length > 0) {
        const updatePromises = productsInCategory.map(product => 
          updateDoc(doc(db, 'products', product.id), { category: 'Semua Tindakan' })
        );
        await Promise.all(updatePromises);
      }
      
      await deleteDoc(doc(db, 'categories', id));
      setDeletingCategoryId(null);
    } catch (e) {
      alert('Gagal menghapus kategori. Cek izin atau koneksi.');
      console.error('Delete category error:', e);
      handleFirestoreError(e, OperationType.DELETE, `categories/${id}`);
    } finally {
      setCategoryActionLoading(false);
    }
  };

  const handleAddManualItem = () => {
    if (!manualForm.name || manualForm.price === '') return;
    const priceNum = Number(manualForm.price.replace(/,/g, ''));
    if (isNaN(priceNum)) return;

    const newItem: CartItem = {
      id: `manual-${Date.now()}`,
      name: manualForm.name,
      shortName: manualForm.name.substring(0, 3).toUpperCase(),
      price: priceNum,
      stock: 0,
      quantity: 1,
      category: 'Manual',
      color: 'bg-slate-400'
    };
    setCart([...cart, newItem]);
    setManualForm({ name: '', price: '' });
    setIsManualModalOpen(false);
  };

  const printReceipt = () => {
    const receiptContent = document.getElementById('printable-receipt-content');
    if (!receiptContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Build unique styles for the print window
    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Pembayaran</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {
              margin: 0;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background-color: white !important;
              color: #000;
            }
            #print-container {
              width: 100%;
              max-width: 400px;
              margin: 0 auto;
              padding: 30px 20px;
              background-color: white !important;
            }
            @media print {
              body { background-color: white !important; }
              #print-container { width: 100%; border: none !important; box-shadow: none !important; margin: 0; }
              .no-print { display: none !important; }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body class="bg-white">
          <div id="print-container">
            ${receiptContent.innerHTML}
          </div>
          <script>
            function waitForImages() {
              const images = document.querySelectorAll('img');
              const promises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
              });
              return Promise.all(promises);
            }

            window.onload = async () => {
              try {
                await waitForImages();
                // Delay for Tailwind to finish rendering
                setTimeout(() => {
                  window.print();
                  window.onafterprint = () => window.close();
                  // Fallback for some browsers
                  setTimeout(() => {
                    if (!window.closed) {
                      // Optional: window.close(); 
                    }
                  }, 2000);
                }, 1000);
              } catch (e) {
                console.error('Print error:', e);
                window.print();
              }
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full bg-slate-50 overflow-hidden font-sans">
      {/* Left Panel: Product Grid */}
      <div className="flex-1 flex flex-col min-w-0 p-6 space-y-6">
        {/* Header Search & Actions */}
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari produk atau scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 pl-12 text-sm text-slate-600 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2 px-2 border-l border-slate-100">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}
            ><Grid className="w-5 h-5" /></button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}
            ><LayoutGrid className="w-5 h-5" /></button>
            <button 
              onClick={() => setActiveModal('history')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            ><History className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-2 px-2 border-l border-slate-100">
            <button 
              onClick={() => { 
                setEditingProduct(null); 
                setProductForm({ 
                  name: '', 
                  shortName: '', 
                  price: 0, 
                  stock: 0, 
                  category: 'Alat Endo', 
                  color: 'bg-blue-400',
                  type: 'product'
                }); 
                setActiveModal('settings'); 
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
            >
              <Settings className="w-4 h-4" /> Kelola Katalog
            </button>
            <button 
              onClick={() => setIsGrouped(!isGrouped)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all", isGrouped ? "bg-blue-600 text-white shadow-lg" : "bg-slate-100 hover:bg-slate-200 text-slate-600")}
            >
              <Plus className="w-4 h-4" /> Grouping
            </button>
            <button 
              onClick={() => setActiveModal('denah')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
            >
              <Plus className="w-4 h-4" /> Denah
            </button>
            <button 
              onClick={saveToPending}
              disabled={cart.length === 0}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30"
            >
              <Save className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { if (lastTransaction) setActiveModal('receipt'); else alert('Selesaikan pesanan terlebih dahulu untuk cetak.'); }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveModal('settings')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            ><Settings className="w-5 h-5" /></button>
          </div>
        </div>


        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setActiveCategory('Semua')}
            className={cn(
              "px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all whitespace-nowrap",
              activeCategory === 'Semua' 
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" 
                : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
            )}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.name)}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all whitespace-nowrap",
                activeCategory === cat.name 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" 
                  : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {cat.name}
            </button>
          ))}
          <button 
            onClick={() => setActiveModal('categories')}
            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Worksheet / Active Section Info */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Worksheet Aktif</span>
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-sm italic text-slate-400 shadow-sm w-80">
              <FileText className="w-4 h-4" />
              Worksheet...
            </div>
          </div>
            <button 
              onClick={() => { 
                setEditingProduct(null); 
                setProductForm({ 
                  name: '', 
                  shortName: '', 
                  price: 0, 
                  stock: 0, 
                  category: 'Alat Endo', 
                  color: 'bg-blue-400',
                  type: 'product'
                }); 
                setActiveModal('settings'); 
              }}
              className="p-3 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all"
            >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Product Grid / List */}
        <div className={cn(
          "flex-1 overflow-y-auto no-scrollbar pb-20",
          viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6" : "space-y-4"
        )}>
          <AnimatePresence mode="popLayout">
            {filteredProducts.map(p => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={p.id}
                onClick={() => addToCart(p)}
                className={cn(
                  "bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-xl transition-all group cursor-pointer",
                  viewMode === 'grid' ? "flex flex-col" : "flex items-center p-4 gap-6 hover:-translate-x-1"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center text-white font-black relative shrink-0",
                  viewMode === 'grid' ? "h-40 text-3xl w-full" : "w-20 h-20 text-xl rounded-2xl",
                  p.color
                )}>
                  {p.shortName}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <button className="absolute bottom-2 right-2 p-1 bg-white text-slate-900 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className={cn("flex-1", viewMode === 'grid' ? "p-4 space-y-3" : "flex items-center justify-between")}>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{p.name}</h4>
                    {viewMode === 'list' && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.category}</p>}
                  </div>
                  <div className={cn("flex gap-6", viewMode === 'list' ? "items-center" : "flex-col space-y-3")}>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none mb-1">Harga</span>
                      <span className="text-emerald-500 font-bold text-sm">Rp {p.price.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none mb-1">
                        {p.type === 'service' ? 'Tipe' : 'Stok'}
                      </span>
                      <span className="text-slate-500 font-medium text-xs font-mono">
                        {p.type === 'service' ? 'Jasa' : p.stock}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Panel: Side Order */}
      <div className="w-[420px] bg-white border-l border-slate-200 flex flex-col p-8 space-y-8 overflow-y-auto max-h-screen no-scrollbar shadow-2xl">
        <header className="flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Pesanan Saat Ini</h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              <Calendar className="w-3 h-3 text-slate-400" />
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <span className="mx-1 opacity-20">|</span>
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsManualModalOpen(true)}
              className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-blue-100 shadow-sm flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">Input Manual</span>
            </button>
          </div>
        </header>

        {/* Staff Attendance Summary */}
        {todayAttendance && todayAttendance.clockIn && (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 group-hover:scale-110 transition-transform">
              <Clock className="w-20 h-20" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Shift Progress</span>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Active Now</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estimated Earnings</p>
                  <h4 className="text-3xl font-black font-mono tracking-tighter">
                    {(() => {
                      const start = todayAttendance.clockIn.toDate ? todayAttendance.clockIn.toDate() : new Date(todayAttendance.clockIn);
                      const diffMs = currentTime.getTime() - start.getTime();
                      const hours = Math.max(0, diffMs / (1000 * 60 * 60));
                      return `Rp ${Math.round(hours * hourlyRate).toLocaleString()}`;
                    })()}
                  </h4>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duration</p>
                  <p className="text-xl font-black font-mono text-emerald-400">
                    {(() => {
                      const start = todayAttendance.clockIn.toDate ? todayAttendance.clockIn.toDate() : new Date(todayAttendance.clockIn);
                      const diffMs = currentTime.getTime() - start.getTime();
                      const h = Math.floor(diffMs / (1000 * 60 * 60));
                      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
                      return `${h}h ${m}m ${s}s`;
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 shrink-0">
          <button 
            onClick={() => setActiveModal('history')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-amber-50 text-amber-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-200/50"
          >
            <History className="w-4 h-4" /> Riwayat
          </button>
          <button 
            onClick={() => setActiveModal('pending')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-50 text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-200/50 shadow-sm"
          >
            <LayoutGrid className="w-4 h-4" /> Pesanan Terbuka ({pendingOrders.length})
          </button>
        </div>

        {/* Cart List */}
        <div className="flex-1 min-h-[120px] space-y-4">
          <AnimatePresence mode="popLayout">
            {cart.map(item => (
              <motion.div
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                key={item.id}
                className="group relative flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100"
              >
                <div className={cn("w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-xs", item.color)}>
                  {item.shortName}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                  <p className="text-[10px] font-black text-emerald-500 uppercase mt-0.5 tracking-tight">Rp {item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-slate-200/50">
                  <button 
                    onClick={() => updateQuantity(item.id, -1)}
                    className="p-1 px-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-black w-4 text-center text-slate-800">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, 1)}
                    className="p-1 px-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-all scale-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40">
              <ShoppingCart className="w-16 h-16 stroke-1" />
              <p className="text-[10px] font-black uppercase tracking-widest">Keranjang masih kosong</p>
            </div>
          )}
        </div>

        {/* Customer Info Form */}
        <div className="space-y-6 pt-6 border-t border-slate-100 shrink-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                Nama Pelanggan
                {(selectedPatientProfile || activePatientInDB) && (
                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 uppercase tracking-widest animate-pulse">
                    ✓ SINKRON S-RM
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => {
                  setCustomerName('');
                  setCustomerPhone('');
                  setTableNumber('');
                  setSelectedPatientProfile(null);
                  setShowPatientSuggestions(false);
                }}
                className="text-[10px] font-black text-emerald-500 cursor-pointer hover:underline bg-transparent border-0"
              >
                + Baru
              </button>
            </div>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                value={customerName || ''}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setShowPatientSuggestions(true);
                  setSelectedPatientProfile(null);
                }}
                onFocus={() => setShowPatientSuggestions(true)}
                placeholder="Ketik nama atau no HP..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />

              {/* Patient Suggestions Autocomplete Dropdown */}
              {showPatientSuggestions && suggestedPatients.length > 0 && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowPatientSuggestions(false)} 
                  />
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-h-64 overflow-y-auto z-50 py-2 divide-y divide-slate-50">
                    {suggestedPatients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setCustomerName(patient.name);
                          setCustomerPhone(patient.phone !== '0' ? patient.phone : '');
                          setSelectedPatientProfile(patient);
                          setShowPatientSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors select-none"
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-black shrink-0 border border-purple-100 uppercase">
                          {patient.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">{patient.name}</span>
                            {patient.mrNumber && (
                              <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100/60 uppercase tracking-widest">
                                RM: {patient.mrNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-550 font-medium mt-0.5 font-mono">
                            <span>{patient.phone !== '0' ? patient.phone : 'Tanpa No. HP'}</span>
                            {patient.email && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500 truncate max-w-[130px]">{patient.email}</span>
                              </>
                            )}
                            {patient.nik && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500">NIK: {patient.nik}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">No. HP</label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  value={customerPhone || ''}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxx..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">No. Meja</label>
              <div className="relative group">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  value={tableNumber || ''}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Contoh: 12"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                />
              </div>
            </div>
          </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Dokter Penanggung Jawab</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <select 
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Pilih Dokter...</option>
                  {doctors.map(d => (
                    <option key={d.uid} value={d.uid}>{d.displayName}</option>
                  ))}
                </select>
              </div>
              {selectedDoctorAttendance && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-bold text-blue-700">
                      {(() => {
                        const start = selectedDoctorAttendance.clockIn.toDate ? selectedDoctorAttendance.clockIn.toDate() : new Date(selectedDoctorAttendance.clockIn);
                        const diffMs = currentTime.getTime() - start.getTime();
                        const h = Math.floor(diffMs / (1000 * 60 * 60));
                        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        return `${h}j ${m}m`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-blue-100 rounded-md">
                      <span className="text-[10px] font-black text-blue-600">
                        {(() => {
                          const start = selectedDoctorAttendance.clockIn.toDate ? selectedDoctorAttendance.clockIn.toDate() : new Date(selectedDoctorAttendance.clockIn);
                          const diffMs = currentTime.getTime() - start.getTime();
                          const hours = Math.max(0, diffMs / (1000 * 60 * 60));
                          return `Rp ${(Math.round(hours * selectedDoctorRate)).toLocaleString()}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Perawat Pelaksana</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <select 
                  value={selectedNurseId}
                  onChange={(e) => setSelectedNurseId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Pilih Perawat...</option>
                  {nurses.map(n => (
                    <option key={n.uid} value={n.uid}>{n.displayName}</option>
                  ))}
                </select>
              </div>
              {selectedNurseAttendance && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-700">
                      {(() => {
                        const start = selectedNurseAttendance.clockIn.toDate ? selectedNurseAttendance.clockIn.toDate() : new Date(selectedNurseAttendance.clockIn);
                        const diffMs = currentTime.getTime() - start.getTime();
                        const h = Math.floor(diffMs / (1000 * 60 * 60));
                        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        return `${h}j ${m}m`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-emerald-100 rounded-md">
                      <span className="text-[10px] font-black text-emerald-600">
                        {(() => {
                          const start = selectedNurseAttendance.clockIn.toDate ? selectedNurseAttendance.clockIn.toDate() : new Date(selectedNurseAttendance.clockIn);
                          const diffMs = currentTime.getTime() - start.getTime();
                          const hours = Math.max(0, diffMs / (1000 * 60 * 60));
                          return `Rp ${(Math.round(hours * selectedNurseRate)).toLocaleString()}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Diskon</label>
            <div className="flex gap-2">
              <div className="flex-1 relative group">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="number" 
                  value={discount || ''}
                  onChange={(e) => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-12 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">Rp</span>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button 
                  onClick={() => setDiscountType('rp')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[10px] font-black transition-all",
                    discountType === 'rp' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >Rp</button>
                <button 
                  onClick={() => setDiscountType('percent')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[10px] font-black transition-all",
                    discountType === 'percent' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >%</button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Catatan Pesanan</label>
            <textarea 
              value={notes || ''}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan untuk pesanan ini..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all resize-none shadow-inner"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <Bike className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800">Mode Delivery</span>
            </div>
            <button 
              onClick={() => setIsDelivery(!isDelivery)}
              className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-300",
                isDelivery ? "bg-blue-600" : "bg-slate-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm",
                isDelivery ? "left-7" : "left-1"
              )} />
            </button>
          </div>
        </div>

        {/* Footer Summary */}
        <div className="pt-8 border-t border-slate-100 space-y-6 shrink-0">
          <div className="flex justify-between items-center text-sm font-bold text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono">Rp {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-end">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Total</h3>
            <div className="text-right">
              <span className="text-4xl font-mono font-black text-slate-900 tracking-tighter">Rp {total.toLocaleString()}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={resetOrder}
              className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-200/50"
            >
              Batal
            </button>
            <button 
              onClick={handleOrder}
              disabled={cart.length === 0}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              Order Sekarang
            </button>
          </div>
        </div>
      </div>
      {/* Modal Overlay */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                    <ArrowLeft className="w-6 h-6 text-slate-400" />
                  </button>
                  <h3 className="text-2xl font-black text-slate-900 capitalize tracking-tight">{activeModal}</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                {activeModal === 'history' && (
                  <div className="space-y-6">
                    {history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50">
                        <History className="w-20 h-20 stroke-1 mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">Belum ada riwayat transaksi</p>
                      </div>
                    ) : (
                      history.map(item => (
                        <div key={item.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-600">
                              <ShoppingBag className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 tracking-tight">{item.customerName || 'Pelanggan Umum'}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {item.createdAt?.toDate?.()?.toLocaleString() || new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8 text-right">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total</span>
                              <span className="text-lg font-black text-slate-900 font-mono tracking-tighter">Rp {item.total?.toLocaleString()}</span>
                            </div>
                            <button 
                              onClick={() => { setLastTransaction(item); setActiveModal('receipt'); }}
                              className="p-3 bg-white text-slate-400 hover:text-blue-600 rounded-xl shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                            >
                              <Printer className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeModal === 'pending' && (
                  <div className="space-y-6">
                    {pendingOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50">
                        <ShoppingCart className="w-20 h-20 stroke-1 mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">Tidak ada pesanan terbuka</p>
                      </div>
                    ) : (
                      pendingOrders.map(item => (
                        <div key={item.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-600">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 tracking-tight">{item.customerName || 'Draft Transaksi'}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {item.cart.length} Item | Rp {item.total?.toLocaleString() || item.subtotal?.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => resumePending(item)}
                              className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all"
                            >
                              Lanjutkan
                            </button>
                            <button 
                              onClick={() => deletePendingOrder(item.id)}
                              className="p-3 bg-white text-red-500 hover:bg-red-50 rounded-xl shadow-sm border border-slate-100 transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeModal === 'settings' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Tambah / Edit Produk</h4>
                          <div className="flex gap-2">
                            {editingProduct && (
                              <button 
                                onClick={() => { 
                                  setEditingProduct(null); 
                                  setProductForm({ 
                                    name: '', 
                                    shortName: '', 
                                    price: 0, 
                                    stock: 0, 
                                    category: 'Alat Endo', 
                                    color: 'bg-blue-400',
                                    type: 'product',
                                    sharingType: 'percentage',
                                    nurseCommission: 0,
                                    adminCommission: 0,
                                    financeCommission: 0,
                                    ownerCommission: 0,
                                    doctorCommission: 0
                                  }); 
                                  setFormError(null); 
                                }}
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-2"
                              >
                                <PlusCircle className="w-3 h-3" /> Tambah Baru
                              </button>
                            )}
                            <button 
                              onClick={forceResetKatalog}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all font-sans"
                            >
                              Reset Katalog
                            </button>
                          </div>
                        </div>
                        {formError && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-600 shadow-sm"
                          >
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="text-xs font-bold">{formError}</span>
                          </motion.div>
                        )}
                        <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Tipe Item</label>
                          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <button 
                              onClick={() => setProductForm({ ...productForm, type: 'product' })}
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all",
                                productForm.type === 'product' || !productForm.type ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                              )}
                            >BARANG</button>
                            <button 
                              onClick={() => setProductForm({ ...productForm, type: 'service' })}
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all",
                                productForm.type === 'service' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                              )}
                            >JASA / TINDAKAN</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nama Produk</label>
                            <input 
                              type="text" 
                              value={productForm.name || ''}
                              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                              placeholder="FBC Tray..."
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nama Pendek (Abbr)</label>
                            <input 
                              type="text" 
                              value={productForm.shortName || ''}
                              onChange={(e) => setProductForm({ ...productForm, shortName: e.target.value })}
                              placeholder="FBC"
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                            />
                          </div>
                        </div>

                        {productForm.type === 'service' && (
                          <div className="space-y-4 bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] flex items-center gap-2">
                                <Percent className="w-3 h-3" /> Profit Sharing
                              </h5>
                              <div className="flex bg-white/50 p-0.5 rounded-lg border border-blue-100 scale-90 origin-right">
                                <button 
                                  onClick={() => setProductForm({ ...productForm, sharingType: 'percentage' })}
                                  className={cn(
                                    "px-3 py-1 rounded-md text-[9px] font-black transition-all",
                                    productForm.sharingType === 'percentage' || !productForm.sharingType ? "bg-blue-600 text-white shadow-sm" : "text-blue-400 hover:text-blue-600"
                                  )}
                                >%</button>
                                <button 
                                  onClick={() => setProductForm({ ...productForm, sharingType: 'fixed' })}
                                  className={cn(
                                    "px-3 py-1 rounded-md text-[9px] font-black transition-all",
                                    productForm.sharingType === 'fixed' ? "bg-blue-600 text-white shadow-sm" : "text-blue-400 hover:text-blue-600"
                                  )}
                                >Rp</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Perawat</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    value={productForm.nurseCommission || ''}
                                    onChange={(e) => setProductForm({ ...productForm, nurseCommission: e.target.value === '' ? 0 : Number(e.target.value) })}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all pr-8"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">
                                    {productForm.sharingType === 'fixed' ? 'Rp' : '%'}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Admin</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    value={productForm.adminCommission || ''}
                                    onChange={(e) => setProductForm({ ...productForm, adminCommission: e.target.value === '' ? 0 : Number(e.target.value) })}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all pr-8"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">
                                    {productForm.sharingType === 'fixed' ? 'Rp' : '%'}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Keuangan</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    value={productForm.financeCommission || ''}
                                    onChange={(e) => setProductForm({ ...productForm, financeCommission: e.target.value === '' ? 0 : Number(e.target.value) })}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all pr-8"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">
                                    {productForm.sharingType === 'fixed' ? 'Rp' : '%'}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Owner</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    value={productForm.ownerCommission || ''}
                                    onChange={(e) => setProductForm({ ...productForm, ownerCommission: e.target.value === '' ? 0 : Number(e.target.value) })}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all pr-8"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">
                                    {productForm.sharingType === 'fixed' ? 'Rp' : '%'}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Dokter</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    value={productForm.doctorCommission || ''}
                                    onChange={(e) => setProductForm({ ...productForm, doctorCommission: e.target.value === '' ? 0 : Number(e.target.value) })}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all pr-8"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">
                                    {productForm.sharingType === 'fixed' ? 'Rp' : '%'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Harga (Rp)</label>
                    <input 
                      type="number" 
                      value={productForm.price || ''}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all font-mono"
                    />
                          </div>
                          {productForm.type !== 'service' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Stok Awal</label>
                                <input 
                                  type="number" 
                                  value={productForm.stock || ''}
                                  onChange={(e) => setProductForm({ ...productForm, stock: e.target.value === '' ? 0 : Number(e.target.value) })}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all font-mono"
                                />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center ml-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Kategori</label>
                            <button 
                              onClick={() => setActiveModal('categories')}
                              className="text-[9px] font-black uppercase text-blue-600 hover:underline"
                            >Kelola</button>
                          </div>
                          <select 
                            value={productForm.category || ''}
                            onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all appearance-none cursor-pointer"
                          >
                            {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Pilih Warna Kartu</label>
                          <div className="flex flex-wrap gap-3">
                            {COLORS.map(c => (
                              <button 
                                key={c.value}
                                onClick={() => setProductForm({ ...productForm, color: c.value })}
                                className={cn(
                                  "w-10 h-10 rounded-xl transition-all border-4",
                                  c.value,
                                  productForm.color === c.value ? "border-slate-900 scale-110 shadow-lg" : "border-transparent opacity-80 hover:opacity-100"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <button 
                          onClick={handleProductSubmit}
                          className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {editingProduct ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk Baru'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Daftar Produk ({filteredManageProducts.length} dari {products.length})</h4>
                          {selectedProducts.length > 0 && (
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{selectedProducts.length} Terpilih</span>
                              <button 
                                onClick={() => { setIsBulkModalOpen(true); setBulkEditForm({}); }}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10"
                              >
                                Bulk Edit
                              </button>
                              <button 
                                onClick={() => setSelectedProducts([])}
                                className="p-1 px-2 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <input 
                            type="text"
                            placeholder="Cari nama, kode, atau kategori..."
                            value={manageSearch}
                            onChange={(e) => setManageSearch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-10 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                          />
                          {manageSearch && (
                            <button 
                              onClick={() => setManageSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-all text-slate-400"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
                        {filteredManageProducts.length > 0 ? (
                          filteredManageProducts.map(p => (
                            <div 
                              key={p.id} 
                              onClick={() => toggleSelectProduct(p.id)}
                              className={cn(
                                "p-4 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer",
                                selectedProducts.includes(p.id) ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-[10px]", p.color)}>
                                    {p.shortName}
                                  </div>
                                  {selectedProducts.includes(p.id) && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg">
                                      <Check className="w-2.5 h-2.5" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-slate-800">{p.name}</h5>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                    Rp {p.price?.toLocaleString()} | {p.type === 'service' ? 'Jasa' : `Stok: ${p.stock}`} | {p.category}
                                  </p>
                                  {p.type === 'service' && (
                                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.1em] mt-1 flex gap-2">
                                      <span>P: {p.nurseCommission}{p.sharingType === 'fixed' ? 'rb' : '%'}</span>
                                      <span>A: {p.adminCommission}{p.sharingType === 'fixed' ? 'rb' : '%'}</span>
                                      <span>K: {p.financeCommission}{p.sharingType === 'fixed' ? 'rb' : '%'}</span>
                                      <span>O: {p.ownerCommission}{p.sharingType === 'fixed' ? 'rb' : '%'}</span>
                                      <span>D: {p.doctorCommission}{p.sharingType === 'fixed' ? 'rb' : '%'}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 transition-all">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingProduct(p.id); setProductForm(p); }}
                                  className="p-2.5 bg-white text-blue-600 rounded-xl shadow-sm border border-slate-200 hover:scale-110 active:scale-95 transition-all"
                                  title="Edit Produk"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                
                                {deletingId === p.id ? (
                                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200 shadow-sm animate-in fade-in slide-in-from-right-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }}
                                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                                    >
                                      Hapus
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setDeletingId(p.id); }}
                                    className="p-2.5 bg-white text-red-500 rounded-xl shadow-sm border border-slate-200 hover:scale-110 active:scale-95 transition-all"
                                    title="Hapus Produk"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2 opacity-60">
                            <Search className="w-10 h-10 stroke-1" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Produk tidak ditemukan</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeModal === 'categories' && (
                  <div className="max-w-2xl mx-auto space-y-10">
                    <div className="space-y-6">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Tambah / Edit Kategori</h4>
                      <div className="flex gap-4">
                        <input 
                          type="text" 
                          value={newCategoryName || ''}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={editingCategory ? "Ubah nama kategori..." : "Nama kategori baru..."}
                          className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                        />
                        <button 
                          onClick={handleCategorySubmit}
                          disabled={categoryActionLoading || !newCategoryName}
                          className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {categoryActionLoading ? (
                             <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          ) : (
                             editingCategory ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />
                          )}
                          {editingCategory ? 'Simpan' : 'Tambah'}
                        </button>
                        {editingCategory && (
                          <button 
                            onClick={() => { setEditingCategory(null); setNewCategoryName(''); }}
                            className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                          >
                            Batal
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Daftar Kategori ({categories.length})</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto no-scrollbar pr-2">
                        {categories.map(cat => (
                          <div 
                            key={cat.id} 
                            onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }}
                            className={cn(
                              "p-5 bg-slate-50 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer",
                              editingCategory?.id === cat.id ? "bg-blue-50 border-blue-200" : "border-slate-100 hover:border-slate-200"
                            )}
                          >
                            <span className={cn("text-sm font-bold", editingCategory?.id === cat.id ? "text-blue-600" : "text-slate-800")}>{cat.name}</span>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setNewCategoryName(cat.name); }}
                                className="p-2 bg-white text-blue-600 rounded-xl shadow-sm border border-slate-200 hover:scale-110 active:scale-95 transition-all"
                                title="Edit Kategori"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              
                              {deletingCategoryId === cat.id ? (
                                <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200 shadow-sm animate-in fade-in slide-in-from-right-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}
                                    disabled={categoryActionLoading}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                                  >
                                    Hapus
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setDeletingCategoryId(null); }}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setDeletingCategoryId(cat.id); }}
                                  disabled={categoryActionLoading}
                                  className={cn(
                                    "p-2 bg-white text-red-500 rounded-xl shadow-sm border border-slate-200 transition-all",
                                    categoryActionLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-110 active:scale-95"
                                  )}
                                  title="Hapus Kategori"
                                >
                                  {categoryActionLoading ? (
                                    <div className="w-4 h-4 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeModal === 'denah' && (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                    <div className="w-32 h-32 bg-slate-100 rounded-[40px] flex items-center justify-center text-slate-400">
                      <LayoutGrid className="w-16 h-16 stroke-1" />
                    </div>
                    <div className="space-y-2">
                    <h4 className="text-xl font-black text-slate-900 tracking-tight">Fitur Denah Klinik</h4>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto">Visualisasikan tata letak klinik dan pilih meja secara langsung di sini.</p>
                    </div>
                    <div className="w-full max-w-md h-64 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 flex items-center justify-center">
                      <span className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em]">Ruang Operasi | Ruang Tunggu | Apotek</span>
                    </div>
                  </div>
                )}

                {activeModal === 'receipt' && lastTransaction && (
                  <div className="max-w-md mx-auto space-y-8" id="printable-receipt">
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-blue-600 rounded-[32px] flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-900/20 mb-6">
                        <Check className="w-10 h-10" />
                      </div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight">Pembayaran Berhasil!</h4>
                      <p className="text-sm text-slate-400">Terima kasih telah memesan. Silahkan cetak struk di bawah ini.</p>
                    </div>

                    <div className="bg-white rounded-[40px] p-8 space-y-6 border border-slate-100 shadow-sm" id="printable-receipt-content">
                      <div className="flex flex-col items-center gap-3 border-b border-slate-200 pb-6 text-center">
                        {clinicSettings?.logoURL ? (
                          <img src={clinicSettings.logoURL} className="w-14 h-14 object-contain mb-1" alt="Logo" />
                        ) : (
                          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-1 shadow-sm">
                            <Building2 className="w-7 h-7" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <h5 className="font-black text-slate-900 tracking-[0.2em] uppercase text-xs">
                            {clinicSettings?.name || 'KLINIK GIGI SEHAT'}
                          </h5>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                            {clinicSettings?.address || 'Jl. Kebahagiaan No. 123, Jakarta'}
                          </p>
                          {clinicSettings?.phone && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              WA: {clinicSettings.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 py-2 border-b border-dashed border-slate-200">
                        {lastTransaction.customerName && (
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-400 uppercase tracking-widest">Pasien</span>
                            <span className="text-slate-900 uppercase">{lastTransaction.customerName}</span>
                          </div>
                        )}
                        {lastTransaction.doctorName !== 'Belum Ditentukan' && (
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-400 uppercase tracking-widest">Dokter</span>
                            <span className="text-slate-900 uppercase">{lastTransaction.doctorName}</span>
                          </div>
                        )}
                        {lastTransaction.nurseName !== 'Belum Ditentukan' && (
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-400 uppercase tracking-widest">Perawat</span>
                            <span className="text-slate-900 uppercase">{lastTransaction.nurseName}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {lastTransaction.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="font-bold text-slate-800">{item.quantity}x {item.name}</span>
                            <span className="font-mono text-slate-500">Rp {(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-dashed border-slate-200 space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-400">
                          <span>Subtotal</span>
                          <span className="font-mono">Rp {lastTransaction.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-emerald-500">
                          <span>Diskon</span>
                          <span className="font-mono">- Rp {lastTransaction.discount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="font-black text-slate-900 uppercase text-xs tracking-widest">Total Bayar</span>
                          <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter">Rp {lastTransaction.total.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="text-center pt-6 space-y-2">
                        <div className="py-2 border-y border-slate-100 mb-4">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Terima Kasih</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Semoga Lekas Sembuh</p>
                        </div>
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">{lastTransaction.id}</p>
                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{new Date(lastTransaction.createdAt).toLocaleString('id-ID')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 print:hidden">
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                      >
                        Tutup
                      </button>
                      <button 
                        onClick={printReceipt}
                        className="py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-sans"
                      >
                        <Printer className="w-4 h-4" /> Cetak Struk
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Edit Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Bulk Edit Produk</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{selectedProducts.length} Produk Terpilih</p>
                </div>
                <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Ubah Kategori</label>
                  <select 
                    value={bulkEditForm.category || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs focus:ring-2 focus:ring-blue-600 outline-none transition-all appearance-none"
                  >
                    <option value="">Jangan Ubah Kategori</option>
                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Ubah Harga (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="Contoh: 50000"
                    value={bulkEditForm.price || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, price: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs focus:ring-2 focus:ring-blue-600 outline-none transition-all font-mono"
                  />
                  <p className="text-[9px] text-slate-400 italic mt-1">Kosongkan jika tidak ingin mengubah harga</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Ubah Stok</label>
                  <input 
                    type="number" 
                    placeholder="Contoh: 100"
                    value={bulkEditForm.stock || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, stock: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs focus:ring-2 focus:ring-blue-600 outline-none transition-all font-mono"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Ubah Warna Kartu</label>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => setBulkEditForm({ ...bulkEditForm, color: undefined })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                        !bulkEditForm.color ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                      )}
                    >Reset</button>
                    {COLORS.map(c => (
                      <button 
                        key={c.value}
                        onClick={() => setBulkEditForm({ ...bulkEditForm, color: c.value })}
                        className={cn(
                          "w-8 h-8 rounded-lg transition-all border-2",
                          c.value,
                          bulkEditForm.color === c.value ? "border-slate-900 scale-110 shadow-lg" : "border-transparent opacity-80 hover:opacity-100"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleBulkUpdate}
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Memproses...' : 'Terapkan ke Semua'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Item Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Input Item Manual</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Tambahkan item tanpa katalog</p>
                </div>
                <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nama Item</label>
                  <input 
                    type="text" 
                    autoFocus
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    placeholder="Masukkan nama item (misal: Biaya Admin)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-4 px-6 text-base font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all shadow-md placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Harga (Rp)</label>
                  <input 
                    type="number" 
                    value={manualForm.price}
                    onChange={(e) => setManualForm({ ...manualForm, price: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-4 px-6 text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all font-mono shadow-md placeholder:text-slate-400"
                  />
                </div>

                <button 
                  onClick={handleAddManualItem}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                >
                  Tambahkan ke Keranjang
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
