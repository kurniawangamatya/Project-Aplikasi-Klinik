import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { db, collection, query, onSnapshot, limit, orderBy, where, doc, handleFirestoreError, OperationType, setDoc, serverTimestamp } from '../lib/firebase';
import { Product, UserProfile, Board } from '../types';
import { useAuth } from '../hooks/useAuth';

// High-Fidelity Default Fallback Seed Data
const SEED_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Cabut Gigi Anak', shortName: 'CBT-A', price: 150000, stock: 999, category: 'Tindakan Gigi', color: '#10B981', type: 'service', sharingType: 'percentage', doctorCommission: 30, nurseCommission: 10, adminCommission: 5, ownerCommission: 10, financeCommission: 5 },
  { id: 'p2', name: 'Tambal Gigi Resin', shortName: 'TBL-R', price: 250000, stock: 999, category: 'Tindakan Gigi', color: '#3B82F6', type: 'service', sharingType: 'percentage', doctorCommission: 30, nurseCommission: 10, adminCommission: 5, ownerCommission: 10, financeCommission: 5 },
  { id: 'p3', name: 'Scalling Gigi (Pembersihan Karang)', shortName: 'SCL', price: 200000, stock: 999, category: 'Tindakan Gigi', color: '#8B5CF6', type: 'service', sharingType: 'percentage', doctorCommission: 30, nurseCommission: 10, adminCommission: 5, ownerCommission: 10, financeCommission: 5 },
  { id: 'p4', name: 'Odontoscopy / Rontgen Gigi', shortName: 'RTG', price: 300000, stock: 999, category: 'Penunjang', color: '#F59E0B', type: 'service', sharingType: 'percentage', doctorCommission: 30, nurseCommission: 10, adminCommission: 5, ownerCommission: 10, financeCommission: 5 },
  { id: 'p5', name: 'Paracetamol 500mg (1 Strip)', shortName: 'PCT', price: 15000, stock: 100, category: 'Obat-obatan', color: '#EF4444', type: 'product', sharingType: 'percentage', doctorCommission: 0, nurseCommission: 0, adminCommission: 0, ownerCommission: 0, financeCommission: 0 },
  { id: 'p6', name: 'Amoxicilin 500mg (1 Strip)', shortName: 'AMX', price: 25000, stock: 80, category: 'Obat-obatan', color: '#EF4444', type: 'product', sharingType: 'percentage', doctorCommission: 0, nurseCommission: 0, adminCommission: 0, ownerCommission: 0, financeCommission: 0 }
];

const SEED_CATEGORIES = [
  { id: 'cat1', name: 'Tindakan Gigi' },
  { id: 'cat2', name: 'Obat-obatan' },
  { id: 'cat3', name: 'Penunjang' },
];

const SEED_USERS: UserProfile[] = [
  { uid: 'admin-demo-id', email: 'admin@klinik.com', displayName: 'Administrator Klinik', role: 'admin' },
  { uid: 'owner-demo-id', email: 'owner@klinik.com', displayName: 'Owner Klinik', role: 'owner' },
  { uid: 'keuangan-demo-id', email: 'keuangan@klinik.com', displayName: 'Staff Keuangan', role: 'keuangan' },
  { uid: 'dokter-demo-id', email: 'dokter@klinik.com', displayName: 'Dokter Gigi', role: 'dokter', specialization: 'Spesialis Konservasi Gigi' },
  { uid: 'perawat-demo-id', email: 'perawat@klinik.com', displayName: 'Suster Indah', role: 'perawat' }
];

const SEED_EMPLOYEES = [
  { id: 'admin-demo-id', userId: 'admin-demo-id', name: 'Administrator Klinik', role: 'admin', salary: 4000000, hourlyRate: 15000, status: 'active' },
  { id: 'owner-demo-id', userId: 'owner-demo-id', name: 'Owner Klinik', role: 'owner', salary: 0, hourlyRate: 0, status: 'active' },
  { id: 'keuangan-demo-id', userId: 'keuangan-demo-id', name: 'Staff Keuangan', role: 'keuangan', salary: 3500000, hourlyRate: 12000, status: 'active' },
  { id: 'dokter-demo-id', userId: 'dokter-demo-id', name: 'Dokter Gigi', role: 'dokter', salary: 8000000, hourlyRate: 35000, status: 'active' },
  { id: 'perawat-demo-id', userId: 'perawat-demo-id', name: 'Suster Indah', role: 'perawat', salary: 3000000, hourlyRate: 15000, status: 'active' }
];

const SEED_CLINIC_SETTINGS = {
  name: 'DentCare Specialist',
  address: 'Jl. Gigi Sehat No. 45, Jakarta',
  phone: '021-55551234',
  logoURL: ''
};

const SEED_BOARDS = [
  { id: 'board-main', name: 'Papan Strategis Klinik', ownerId: 'owner-demo-id', createdAt: new Date().toISOString(), order: 0 }
];

const SEED_ROLE_PERMISSIONS = {
  navigation: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings']
};

const DEFAULT_CUSTOMIZATION = {
  loginVibe: 'minimal_slate',
  loginSubtitle: 'Operasional Keuangan Digital | AI Studio Secure Edition',
  primaryBrandColor: '#3B82F6',
  hideQuickLogin: false,
  showDeveloperCredit: true
};

function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const saved = localStorage.getItem(`clinic_cache_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalItem(key: string, value: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`clinic_cache_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error("Local storage caching failed:", e);
  }
}

interface DataContextType {
  products: Product[];
  users: UserProfile[];
  doctors: UserProfile[];
  nurses: UserProfile[];
  categories: { id: string; name: string }[];
  employees: any[];
  clinicSettings: any | null;
  rolePermissions: any | null;
  todayAttendance: any | null;
  allTodayAttendance: any[];
  boards: Board[];
  loading: boolean;
  isQuotaExceeded: boolean;
  customizationSettings: any;
  updateCustomizationSettings: (settings: any) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => getLocalItem('products', SEED_PRODUCTS));
  const [users, setUsers] = useState<UserProfile[]>(() => getLocalItem('users', SEED_USERS));
  const [doctors, setDoctors] = useState<UserProfile[]>(() => {
    const rawUsers = getLocalItem('users', SEED_USERS);
    return rawUsers.filter(u => u.role?.toLowerCase() === 'dokter');
  });
  const [nurses, setNurses] = useState<UserProfile[]>(() => {
    const rawUsers = getLocalItem('users', SEED_USERS);
    return rawUsers.filter(u => u.role?.toLowerCase() === 'perawat');
  });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(() => getLocalItem('categories', SEED_CATEGORIES));
  const [employees, setEmployees] = useState<any[]>(() => getLocalItem('employees', SEED_EMPLOYEES));
  const [clinicSettings, setClinicSettings] = useState<any | null>(() => getLocalItem('clinicSettings', SEED_CLINIC_SETTINGS));
  const [rolePermissions, setRolePermissions] = useState<any | null>(() => getLocalItem('rolePermissions', SEED_ROLE_PERMISSIONS));
  const [todayAttendance, setTodayAttendance] = useState<any | null>(null);
  const [allTodayAttendance, setAllTodayAttendance] = useState<any[]>([]);
  const [boards, setBoards] = useState<Board[]>(() => getLocalItem('boards', SEED_BOARDS));
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [customizationSettings, setCustomizationSettings] = useState<any>(() => getLocalItem('customizationSettings', DEFAULT_CUSTOMIZATION));

  useEffect(() => {
    if (!user) {
      setDoctors([]);
      setNurses([]);
      return;
    }

    const resolvedDoctors: UserProfile[] = users.filter(u => u.role?.toLowerCase() === 'dokter');
    const resolvedNurses: UserProfile[] = users.filter(u => u.role?.toLowerCase() === 'perawat');

    // Merge from employees list as fallback (in case role is updated or user is created but not in users collection yet)
    employees.forEach(emp => {
      const roleLower = emp.role?.toLowerCase();
      if (roleLower === 'dokter') {
        const docId = emp.userId || emp.id;
        if (docId && !resolvedDoctors.some(d => d.uid === docId)) {
          resolvedDoctors.push({
            uid: docId,
            displayName: emp.name || emp.displayName || 'Dokter Tanpa Nama',
            email: emp.email || '',
            role: 'dokter',
            specialization: emp.specialization || ''
          });
        }
      } else if (roleLower === 'perawat') {
        const nurseId = emp.userId || emp.id;
        if (nurseId && !resolvedNurses.some(n => n.uid === nurseId)) {
          resolvedNurses.push({
            uid: nurseId,
            displayName: emp.name || emp.displayName || 'Perawat Tanpa Nama',
            email: emp.email || '',
            role: 'perawat',
            specialization: emp.specialization || ''
          });
        }
      }
    });

    setDoctors(resolvedDoctors);
    setNurses(resolvedNurses);
  }, [users, employees, user]);

  const [loadingStates, setLoadingStates] = useState({
    products: true,
    users: true,
    categories: true,
    employees: true,
    clinic: true,
    permissions: true,
    attendance: false, // conditional
    boards: true,
    customization: true
  });

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setUsers([]);
      setDoctors([]);
      setNurses([]);
      setCategories([]);
      setEmployees([]);
      setClinicSettings(null);
      setRolePermissions(null);
      setTodayAttendance(null);
      setAllTodayAttendance([]);
      setBoards([]);
      return;
    }

    // Set temporary default permissions for the current role while waiting for the snapshot
    if (profile?.role) {
      const defaults: Record<string, string[]> = {
        owner: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
        admin: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
        keuangan: ['overview', 'board', 'clinic-boards', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi'],
        dokter: ['overview', 'board', 'clinic-boards', 'doctor-report', 'attendance', 'patient-data', 'kpi'],
        perawat: ['overview', 'board', 'clinic-boards', 'nurse-report', 'attendance', 'patient-data', 'kpi'],
        apoteker: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi'],
        media: ['overview', 'board', 'clinic-boards', 'attendance', 'kpi'],
        PIC: ['overview', 'board', 'clinic-boards', 'team', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi', 'settings']
      };
      const defaultNav = defaults[profile.role] || ['board'];
      setRolePermissions({ navigation: defaultNav });
    }

    // Event listener for Firebase Database Quota Exceeded
    const handleQuotaExceededEvent = () => {
      setIsQuotaExceeded(true);
      setLoadingStates({
        products: false,
        users: false,
        categories: false,
        employees: false,
        clinic: false,
        permissions: false,
        attendance: false,
        boards: false,
        customization: false
      });
    };

    window.addEventListener('firebase-quota-exceeded', handleQuotaExceededEvent);
    if (typeof window !== 'undefined' && ((window as any).__firebaseQuotaExceeded || localStorage.getItem('force_local_simulation') === 'true')) {
      setIsQuotaExceeded(true);
      setLoadingStates({
        products: false,
        users: false,
        categories: false,
        employees: false,
        clinic: false,
        permissions: false,
        attendance: false,
        boards: false,
        customization: false
      });
    }

    // 1. Products Listener
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), limit(300)),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setProducts(data);
        setLocalItem('products', data);
        setLoadingStates(prev => ({ ...prev, products: false }));
      },
      (error) => {
        console.error("Products load error:", error);
        setLoadingStates(prev => ({ ...prev, products: false }));
      }
    );

    // 2. Users Listener
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), limit(500)), 
      (snap) => {
        const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        
        let offlineUsers: UserProfile[] = [];
        try {
          const saved = localStorage.getItem('clinic_local_registered_accounts');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              offlineUsers = parsed.map(a => ({
                uid: a.uid,
                email: a.email,
                displayName: a.displayName,
                role: a.role,
                specialization: a.specialization
              }));
            }
          }
        } catch (e) {}

        const mergedUsers = [...allUsers];
        offlineUsers.forEach(ou => {
          if (!mergedUsers.some(mu => mu.email === ou.email)) {
            mergedUsers.push(ou);
          }
        });

        setUsers(mergedUsers);
        setLocalItem('users', mergedUsers);
        setLoadingStates(prev => ({ ...prev, users: false }));
      },
      (error) => {
        console.error("Users load error:", error);
        setLoadingStates(prev => ({ ...prev, users: false }));
      }
    );

    // 3. Categories Listener
    const unsubCategories = onSnapshot(
      query(collection(db, 'categories'), orderBy('name', 'asc'), limit(100)), 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setCategories(data);
        setLocalItem('categories', data);
        setLoadingStates(prev => ({ ...prev, categories: false }));
      },
      (error) => {
        console.error("Categories load error:", error);
        setLoadingStates(prev => ({ ...prev, categories: false }));
      }
    );

    // 4. Employees Listener
    const unsubEmployees = onSnapshot(
      query(collection(db, 'employees'), limit(200)), 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let offlineEmps: any[] = [];
        try {
          const saved = localStorage.getItem('clinic_local_registered_accounts');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              offlineEmps = parsed.map(a => ({
                id: a.uid,
                userId: a.uid,
                name: a.displayName,
                role: a.role,
                salary: a.salary || 3000000,
                hourlyRate: a.hourlyRate || 15000,
                status: 'active',
                joinedAt: new Date().toISOString()
              }));
            }
          }
        } catch (e) {}

        const mergedEmps = [...data];
        offlineEmps.forEach(oe => {
          if (!mergedEmps.some(me => me.userId === oe.userId)) {
            mergedEmps.push(oe);
          }
        });

        setEmployees(mergedEmps);
        setLocalItem('employees', mergedEmps);
        setLoadingStates(prev => ({ ...prev, employees: false }));
      },
      (error) => {
        console.error("Employees load error:", error);
        setLoadingStates(prev => ({ ...prev, employees: false }));
      }
    );

    // 5. Clinic Settings Listener
    const unsubClinic = onSnapshot(
      doc(db, 'settings', 'clinic'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setClinicSettings(data);
          setLocalItem('clinicSettings', data);
        }
        setLoadingStates(prev => ({ ...prev, clinic: false }));
      },
      (error) => {
        console.error("Clinic settings load error:", error);
        setLoadingStates(prev => ({ ...prev, clinic: false }));
      }
    );

    // 5b. Customization Settings Listener
    const unsubCustomization = onSnapshot(
      doc(db, 'settings', 'customization'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCustomizationSettings(data);
          setLocalItem('customizationSettings', data);
        }
        setLoadingStates(prev => ({ ...prev, customization: false }));
      },
      (error) => {
        console.error("Customization load error:", error);
        setLoadingStates(prev => ({ ...prev, customization: false }));
      }
    );

    // 6. Role Permissions Listener
    let unsubPermissions = () => {};
    if (profile?.role) {
      const roleKey = profile.role === 'PIC' ? 'PIC' : profile.role.toLowerCase();
      unsubPermissions = onSnapshot(
        doc(db, 'role_permissions', roleKey),
        async (snap) => {
          const defaults: Record<string, string[]> = {
            owner: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
            admin: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
            keuangan: ['overview', 'board', 'clinic-boards', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi'],
            dokter: ['overview', 'board', 'clinic-boards', 'doctor-report', 'attendance', 'patient-data', 'kpi'],
            perawat: ['overview', 'board', 'clinic-boards', 'nurse-report', 'attendance', 'patient-data', 'kpi'],
            apoteker: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi'],
            media: ['overview', 'board', 'clinic-boards', 'attendance', 'kpi'],
            PIC: ['overview', 'board', 'clinic-boards', 'team', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi', 'settings']
          };
          const defaultNav = defaults[roleKey] || ['board'];

          if (snap.exists()) {
            const data = snap.data();
            setRolePermissions(data);
            setLocalItem('rolePermissions', data);
          } else {
            // Apply fallback defaults if database doc does not exist
            const fallbackData = { navigation: defaultNav };
            setRolePermissions(fallbackData);
            setLocalItem('rolePermissions', fallbackData);
            try {
              await setDoc(doc(db, 'role_permissions', roleKey), {
                navigation: defaultNav,
                updatedAt: serverTimestamp()
              });
            } catch (err) {
              console.warn("Could not initialize default role permissions:", err);
            }
          }
          setLoadingStates(prev => ({ ...prev, permissions: false }));
        },
        (error) => {
          console.error("Role permissions load error:", error);
          setLoadingStates(prev => ({ ...prev, permissions: false }));
        }
      );
    } else {
      setLoadingStates(prev => ({ ...prev, permissions: false }));
    }

    // 7. Today's Attendance for Current User
    const today = new Date().toISOString().split('T')[0];
    const unsubAttendance = onSnapshot(
      query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid),
        where('date', '==', today),
        limit(1)
      ),
      (snap) => {
        if (!snap.empty) {
          setTodayAttendance({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setTodayAttendance(null);
        }
        setLoadingStates(prev => ({ ...prev, attendance: false }));
      },
      (error) => {
        console.error("Attendance load error:", error);
        setLoadingStates(prev => ({ ...prev, attendance: false }));
      }
    );

    // 8. All Today's Attendance (for Admins/Overview)
    const canSeeAll = ['admin', 'owner', 'keuangan'].includes(profile?.role || '');
    const unsubAllAttendance = canSeeAll ? onSnapshot(
      query(collection(db, 'attendance'), where('date', '==', today), limit(200)),
      (snap) => {
        setAllTodayAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("All today's attendance load error:", error);
      }
    ) : () => {};

    // 9. Boards Listener
    const unsubBoards = onSnapshot(
      query(collection(db, 'boards'), orderBy('order', 'asc')),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Board));
        setBoards(data);
        setLocalItem('boards', data);
        setLoadingStates(prev => ({ ...prev, boards: false }));
      },
      (error) => {
        console.error("Boards load error:", error);
        setLoadingStates(prev => ({ ...prev, boards: false }));
      }
    );

    return () => {
      unsubProducts();
      unsubUsers();
      unsubCategories();
      unsubEmployees();
      unsubClinic();
      unsubCustomization();
      unsubPermissions();
      unsubAttendance();
      unsubAllAttendance();
      unsubBoards();
      window.removeEventListener('firebase-quota-exceeded', handleQuotaExceededEvent);
    };
  }, [user, profile?.role]);

  const updateCustomizationSettings = async (settings: any) => {
    try {
      setCustomizationSettings(settings);
      setLocalItem('customizationSettings', settings);
      await setDoc(doc(db, 'settings', 'customization'), settings, { merge: true });
    } catch (e) {
      console.warn("Offline fallback customization update:", e);
    }
  };

  const value = useMemo(() => ({
    products,
    users,
    doctors,
    nurses,
    categories,
    employees,
    clinicSettings,
    rolePermissions,
    todayAttendance,
    allTodayAttendance,
    boards,
    loading: Object.values(loadingStates).some(s => s),
    isQuotaExceeded,
    customizationSettings,
    updateCustomizationSettings
  }), [products, users, doctors, nurses, categories, employees, clinicSettings, rolePermissions, todayAttendance, allTodayAttendance, boards, loadingStates, isQuotaExceeded, customizationSettings]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
