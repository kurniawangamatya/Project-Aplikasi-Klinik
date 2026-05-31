import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDoc as originalGetDoc, 
  setDoc as originalSetDoc, 
  collection, 
  onSnapshot as originalOnSnapshot, 
  query as originalQuery, 
  where as originalWhere, 
  orderBy as originalOrderBy, 
  addDoc as originalAddDoc, 
  updateDoc as originalUpdateDoc, 
  deleteDoc as originalDeleteDoc,
  serverTimestamp as originalServerTimestamp,
  getDocFromServer,
  collectionGroup,
  getDocs as originalGetDocs,
  limit as originalLimit
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function checkAndLogQuotaError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error.message || String(error));
  const code = error.code || '';
  if (
    code === 'resource-exhausted' ||
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('exhausted') ||
    msg.toLowerCase().includes('permission') ||
    msg.toLowerCase().includes('denied') ||
    msg.toLowerCase().includes('unauthenticated') ||
    msg.toLowerCase().includes('limit')
  ) {
    if (typeof window !== 'undefined') {
      (window as any).__firebaseQuotaExceeded = true;
      localStorage.setItem('force_local_simulation', 'true');
      window.dispatchEvent(new CustomEvent('firebase-quota-exceeded'));
    }
    return true;
  }
  return false;
}

export async function testConnection() {
  try {
    // If we're forcing local simulation to save quota, bypass testing altogether
    if (localStorage.getItem('force_local_simulation') === 'true') return;
    await getDocFromServer(doc(db, 'settings', 'clinic'));
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? (error as any).code : '';
    // Only flag true quota exhausted issues, not unauthenticated/permission-denied errors
    if (code === 'resource-exhausted') {
      checkAndLogQuotaError(error);
    }
  }
}

testConnection();

// --- HIGH-FIDELITY OFFLINE EMULATOR ENGINE ---

export function isLocalSimulation(): boolean {
  if (typeof window !== 'undefined') {
    return (window as any).__firebaseQuotaExceeded === true || 
           localStorage.getItem('force_local_simulation') === 'true';
  }
  return false;
}

const SEED_DATA: { [collectionName: string]: any[] } = {
  products: [
    { id: 'p1', name: 'Cabut Gigi Anak', shortName: 'CBT-A', price: 150000, stock: 999, category: 'Tindakan Gigi', color: '#10B981', type: 'service' },
    { id: 'p2', name: 'Tambal Gigi Resin', shortName: 'TBL-R', price: 250000, stock: 999, category: 'Tindakan Gigi', color: '#3B82F6', type: 'service' },
    { id: 'p3', name: 'Scalling Gigi (Pembersihan Karang)', shortName: 'SCL', price: 200000, stock: 999, category: 'Tindakan Gigi', color: '#8B5CF6', type: 'service' },
    { id: 'p4', name: 'Odontoscopy / Rontgen Gigi', shortName: 'RTG', price: 300000, stock: 999, category: 'Penunjang', color: '#F59E0B', type: 'service' },
    { id: 'p5', name: 'Paracetamol 500mg (1 Strip)', shortName: 'PCT', price: 15000, stock: 100, category: 'Obat-obatan', color: '#EF4444', type: 'product' },
    { id: 'p6', name: 'Amoxicilin 500mg (1 Strip)', shortName: 'AMX', price: 25000, stock: 80, category: 'Obat-obatan', color: '#EF4444', type: 'product' }
  ],
  categories: [
    { id: 'cat1', name: 'Tindakan Gigi' },
    { id: 'cat2', name: 'Obat-obatan' },
    { id: 'cat3', name: 'Penunjang' }
  ],
  users: [
    { uid: 'admin-demo-id', email: 'admin@klinik.com', displayName: 'Administrator Klinik', role: 'admin' },
    { uid: 'owner-demo-id', email: 'owner@klinik.com', displayName: 'Owner Klinik', role: 'owner' },
    { uid: 'keuangan-demo-id', email: 'keuangan@klinik.com', displayName: 'Staff Keuangan', role: 'keuangan' },
    { uid: 'dokter-demo-id', email: 'dokter@klinik.com', displayName: 'Dokter Gigi', role: 'dokter', specialization: 'Spesialis Konservasi Gigi' },
    { uid: 'perawat-demo-id', email: 'perawat@klinik.com', displayName: 'Suster Indah', role: 'perawat' }
  ],
  employees: [
    { id: 'admin-demo-id', userId: 'admin-demo-id', name: 'Administrator Klinik', role: 'admin', salary: 4000000, hourlyRate: 15000, status: 'active' },
    { id: 'owner-demo-id', userId: 'owner-demo-id', name: 'Owner Klinik', role: 'owner', salary: 0, hourlyRate: 0, status: 'active' },
    { id: 'keuangan-demo-id', userId: 'keuangan-demo-id', name: 'Staff Keuangan', role: 'keuangan', salary: 3500000, hourlyRate: 12000, status: 'active' },
    { id: 'dokter-demo-id', userId: 'dokter-demo-id', name: 'Dokter Gigi', role: 'dokter', salary: 8000000, hourlyRate: 35000, status: 'active' },
    { id: 'perawat-demo-id', userId: 'perawat-demo-id', name: 'Suster Indah', role: 'perawat', salary: 3000000, hourlyRate: 15000, status: 'active' }
  ],
  boards: [
    { id: 'board-main', name: 'Papan Strategis Klinik', ownerId: 'owner-demo-id', createdAt: new Date().toISOString(), order: 0 }
  ]
};

function getPathFromRef(ref: any): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (ref.path) return ref.path;
  if (ref.__path) return ref.__path;
  if (ref._query && ref._query.path) {
    const segments = ref._query.path.segments || [];
    return segments.join('/');
  }
  if (ref.collection && ref.collection.path) return ref.collection.path;
  return '';
}

function getColAndDocIdFromPath(path: string): { colPath: string; docId: string } {
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) {
    return { colPath: path, docId: '' };
  }
  const docId = parts[parts.length - 1];
  const colPath = parts.slice(0, parts.length - 1).join('/');
  return { colPath, docId };
}

function makeSimulatedTimestamp(val: any) {
  const dateObj = val ? new Date(val) : new Date();
  return {
    toDate: () => dateObj,
    seconds: Math.floor(dateObj.getTime() / 1000),
    nanoseconds: 0,
    toString: () => dateObj.toISOString()
  };
}

function getSimulatedCollection(path: string): any[] {
  if (typeof window === 'undefined') return [];

  // Custom intercept to read/write/merge custom registered accounts on the fly
  if (path === 'users' || path === 'employees') {
    const normalized = path.replace(/\//g, "_");
    const storageKey = `clinic_simdb_${normalized}`;
    const existing = localStorage.getItem(storageKey);
    let list: any[] = [];
    try {
      if (existing) {
        list = JSON.parse(existing);
      } else {
        list = [...(path === 'users' ? SEED_DATA.users : SEED_DATA.employees)];
      }
    } catch {
      list = [...(path === 'users' ? SEED_DATA.users : SEED_DATA.employees)];
    }

    // Merge from clinic_local_registered_accounts
    try {
      const saved = localStorage.getItem('clinic_local_registered_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let dirty = false;
          parsed.forEach(a => {
            if (path === 'users') {
              const exists = list.some((u: any) => u.email === a.email || u.uid === a.uid);
              if (!exists) {
                list.push({
                  uid: a.uid,
                  id: a.uid,
                  email: a.email,
                  displayName: a.displayName,
                  role: a.role,
                  specialization: a.specialization || ''
                });
                dirty = true;
              }
            } else if (path === 'employees') {
              const exists = list.some((e: any) => e.userId === a.uid || e.id === a.uid);
              if (!exists) {
                list.push({
                  id: a.uid,
                  userId: a.uid,
                  name: a.displayName,
                  role: a.role,
                  salary: a.salary || a.salary === 0 ? a.salary : 3000000,
                  hourlyRate: a.hourlyRate || a.hourlyRate === 0 ? a.hourlyRate : 15000,
                  status: 'active',
                  joinedAt: new Date().toISOString()
                });
                dirty = true;
              }
            }
          });
          if (dirty) {
            localStorage.setItem(storageKey, JSON.stringify(list));
            window.dispatchEvent(new CustomEvent(`clinic-simdb-updated-${path}`));
          }
        }
      }
    } catch (e) {
      console.error("Local accounts merge failed:", e);
    }
    return list;
  }

  const normalized = path.replace(/\//g, "_");
  const storageKey = `clinic_simdb_${normalized}`;
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // fallback
    }
  }

  let seed: any[] = [];
  if (path === 'products') seed = SEED_DATA.products;
  else if (path === 'categories') seed = SEED_DATA.categories;
  else if (path === 'users') seed = SEED_DATA.users;
  else if (path === 'employees') seed = SEED_DATA.employees;
  else if (path === 'boards') seed = SEED_DATA.boards;
  else if (path.endsWith('lists')) seed = [
    { id: 'list-1', name: 'Antrean Operasional', order: 0, boardId: 'board-main' },
    { id: 'list-2', name: 'Sedang Berjalan', order: 1, boardId: 'board-main' },
    { id: 'list-3', name: 'Selesai & Direview', order: 2, boardId: 'board-main' }
  ];
  else if (path.endsWith('cards') || path === 'cards') seed = [
    { id: 'card-1', title: 'Audit Restock Bahan Tambal Gigi', listId: 'list-1', boardId: 'board-main', description: 'Periksa sisa stok composite resin warna A2 & A3.', labels: ['Logistik'], priority: 'medium', members: ['keuangan-demo-id'], createdAt: new Date().toISOString() },
    { id: 'card-2', title: 'Kalibrasi Mesin Dental Lintasan 1', listId: 'list-1', boardId: 'board-main', description: 'Jadwalkan vendor kalibrasi mesin suction.', labels: ['Pemeliharaan'], priority: 'high', members: ['admin-demo-id'], createdAt: new Date().toISOString() },
    { id: 'card-3', title: 'Promosi Paket Scaling Menyambut Lebaran', listId: 'list-2', boardId: 'board-main', description: 'Desain poster promo IG paket scaling.', labels: ['Marketing'], priority: 'low', members: ['owner-demo-id'], createdAt: new Date().toISOString() }
  ];
  else if (path.endsWith('templates')) seed = [
    { id: 'temp-1', title: 'Template Checklist Sterilisasi', description: 'Pastikan autoclave berjalan di suhu 121C.', labels: ['Operasional'], priority: 'medium' }
  ];
  else if (path === 'sales') seed = [
    {
      id: 'tx-1',
      invoiceNumber: 'INV-2026-001',
      createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      customerName: 'Ahmad Faisal',
      customerPhone: '081234567890',
      items: [
        { id: 'p1', name: 'Cabut Gigi Anak', price: 150000, quantity: 1, type: 'service', sharingType: 'percentage', doctorCommission: 30, nurseCommission: 10, adminCommission: 5 }
      ],
      subtotal: 150000,
      discount: 0,
      totalAmount: 150000,
      paymentMethod: 'Tunai',
      paymentStatus: 'paid',
      doctorId: 'dokter-demo-id',
      doctorName: 'Dokter Gigi',
      nurseId: 'perawat-demo-id',
      nurseName: 'Suster Indah',
      createdBy: 'admin-demo-id'
    }
  ];
  else if (path === 'attendance') seed = [
    {
      id: 'att-1',
      userId: 'dokter-demo-id',
      userName: 'Dokter Gigi',
      date: new Date().toISOString().split('T')[0],
      clockIn: new Date(new Date().setHours(8, 0, 0)).toISOString(),
      status: 'present'
    }
  ];
  else if (path === 'kpi_entries') seed = [
    {
      id: 'kpi-1',
      userId: 'dokter-demo-id',
      userName: 'Dokter Gigi',
      date: new Date(Date.now() - 3600000 * 12).toISOString(),
      totalAmount: 120,
      description: 'Responsif melayani pasien darurat gigi.',
      status: 'validated'
    }
  ];
  else if (path === 'settings') seed = [
    { id: 'clinic', name: 'DentCare Specialist', address: 'Jl. Gigi Sehat No. 45, Jakarta', phone: '021-55551234', logoURL: '' },
    { id: 'customization', loginVibe: 'minimal_slate', loginSubtitle: 'Operasional Keuangan Digital | AI Studio Secure Edition', primaryBrandColor: '#3B82F6', hideQuickLogin: false, showDeveloperCredit: true }
  ];
  else if (path === 'role_permissions') seed = [
    { id: 'admin', navigation: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'] },
    { id: 'owner', navigation: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'] },
    { id: 'keuangan', navigation: ['overview', 'board', 'clinic-boards', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi'] },
    { id: 'dokter', navigation: ['overview', 'board', 'clinic-boards', 'doctor-report', 'attendance', 'patient-data', 'kpi'] },
    { id: 'perawat', navigation: ['overview', 'board', 'nurse-report', 'attendance', 'patient-data', 'kpi'] }
  ];

  localStorage.setItem(storageKey, JSON.stringify(seed));
  return seed;
}

function saveSimulatedCollection(path: string, docs: any[]) {
  if (typeof window === 'undefined') return;
  const normalized = path.replace(/\//g, "_");
  const storageKey = `clinic_simdb_${normalized}`;
  localStorage.setItem(storageKey, JSON.stringify(docs));
  window.dispatchEvent(new CustomEvent(`clinic-simdb-updated-${path}`));
  const rootCol = path.split('/')[0];
  if (rootCol && rootCol !== path) {
    window.dispatchEvent(new CustomEvent(`clinic-simdb-updated-${rootCol}`));
  }
}

function sanitizeSimulatedData(data: any): any {
  if (!data) return data;
  const copy = { ...data };
  Object.keys(copy).forEach(key => {
    const val = copy[key];
    const isDateKey = key === 'createdAt' || key === 'updatedAt' || key === 'joinedAt' || key === 'clockIn' || key === 'clockOut';
    if (isDateKey) {
      if (!val || (typeof val === 'object' && Object.keys(val).length === 0) || val?.constructor?.name?.includes('FieldValue') || typeof val.toDate === 'function') {
        copy[key] = new Date().toISOString();
      } else if (val instanceof Date) {
        copy[key] = val.toISOString();
      }
    }
  });
  return copy;
}

function mockDocSnapshot(id: string, data: any) {
  return {
    id,
    exists: () => !!data,
    data: () => {
      if (!data) return undefined;
      const processed = { ...data };
      Object.keys(processed).forEach(key => {
        const val = processed[key];
        if (key === 'createdAt' || key === 'joinedAt' || key === 'clockIn' || key === 'clockOut') {
          if (val && typeof val === 'string' && !val.includes('toDate')) {
            processed[key] = makeSimulatedTimestamp(val);
          } else if (val && typeof val === 'object' && (val as any).toDate) {
            // Already compatible, do nothing
          } else if (val) {
            processed[key] = makeSimulatedTimestamp(val);
          }
        }
      });
      return processed;
    }
  };
}

function mockQuerySnapshot(docs: any[]) {
  const mappedDocs = docs.map(d => mockDocSnapshot(d.id || d.uid, d));
  return {
    empty: docs.length === 0,
    docs: mappedDocs,
    forEach: (callback: any) => {
      mappedDocs.forEach(d => callback(d));
    },
    size: docs.length
  };
}

function evaluateQuery(path: string, constraints: any[]): any[] {
  let list = getSimulatedCollection(path);
  if (!constraints || constraints.length === 0) return list;

  constraints.forEach(c => {
    if (c.type === 'where') {
      const { field, op, val } = c;
      list = list.filter(item => {
        const itemVal = item[field];
        if (field === 'createdAt' || field === 'date') {
          const itemDate = new Date(itemVal);
          const valDate = new Date(val);
          if (op === '==') return itemDate.getTime() === valDate.getTime();
          if (op === '>=') return itemDate >= valDate;
          if (op === '<=') return itemDate <= valDate;
          if (op === '>') return itemDate > valDate;
          if (op === '<') return itemDate < valDate;
        }

        if (op === '==') return itemVal === val;
        if (op === '!=') return itemVal !== val;
        if (op === '>=') return itemVal >= val;
        if (op === '<=') return itemVal <= val;
        if (op === '>') return itemVal > val;
        if (op === '<') return itemVal < val;
        if (op === 'array-contains') return Array.isArray(itemVal) && itemVal.includes(val);
        return true;
      });
    }
  });

  return list;
}

// --- STANDARD WORKFLOW PROXIES WITH INLINE FALLBACK INJECTION ---

export async function getDoc(reference: any) {
  const path = getPathFromRef(reference);
  if (isLocalSimulation()) {
    return await emulatedGetDoc(path);
  }
  try {
    return await originalGetDoc(reference);
  } catch (error) {
    if (checkAndLogQuotaError(error)) {
      return await emulatedGetDoc(path);
    }
    throw error;
  }
}

async function emulatedGetDoc(path: string) {
  const { colPath, docId } = getColAndDocIdFromPath(path);
  const col = getSimulatedCollection(colPath);
  const found = col.find(d => (d.id === docId || d.uid === docId));
  return mockDocSnapshot(docId, found || null);
}

export async function setDoc(reference: any, data: any, options?: any) {
  const path = getPathFromRef(reference);
  if (isLocalSimulation()) {
    await emulatedSetDoc(path, data, options);
    return;
  }
  try {
    return await originalSetDoc(reference, data, options);
  } catch (error) {
    if (checkAndLogQuotaError(error)) {
      await emulatedSetDoc(path, data, options);
      return;
    }
    throw error;
  }
}

async function emulatedSetDoc(path: string, data: any, options?: any) {
  const { colPath, docId } = getColAndDocIdFromPath(path);
  const col = getSimulatedCollection(colPath);
  const index = col.findIndex(d => (d.id === docId || d.uid === docId));
  
  const sanitized = sanitizeSimulatedData(data);
  const record = options?.merge && index !== -1
    ? { ...col[index], ...sanitized }
    : { id: docId, ...sanitized };

  if (index !== -1) {
    col[index] = record;
  } else {
    col.push(record);
  }
  saveSimulatedCollection(colPath, col);
}

export async function addDoc(reference: any, data: any) {
  const colPath = getPathFromRef(reference);
  if (isLocalSimulation()) {
    return await emulatedAddDoc(colPath, data);
  }
  try {
    return await originalAddDoc(reference, data);
  } catch (error) {
    if (checkAndLogQuotaError(error)) {
      return await emulatedAddDoc(colPath, data);
    }
    throw error;
  }
}

async function emulatedAddDoc(colPath: string, data: any) {
  const col = getSimulatedCollection(colPath);
  const newId = 'sim-' + Math.random().toString(36).substr(2, 9);
  const sanitized = sanitizeSimulatedData(data);
  const record = { id: newId, ...sanitized };
  col.push(record);
  saveSimulatedCollection(colPath, col);
  return { id: newId };
}

export async function updateDoc(reference: any, ...args: any[]) {
  const path = getPathFromRef(reference);
  if (isLocalSimulation()) {
    await emulatedUpdateDoc(path, args[0]);
    return;
  }
  try {
    return await (originalUpdateDoc as any)(reference, ...args);
  } catch (error) {
    if (checkAndLogQuotaError(error)) {
      await emulatedUpdateDoc(path, args[0]);
      return;
    }
    throw error;
  }
}

async function emulatedUpdateDoc(path: string, data: any) {
  const { colPath, docId } = getColAndDocIdFromPath(path);
  const col = getSimulatedCollection(colPath);
  const index = col.findIndex(d => (d.id === docId || d.uid === docId));
  if (index !== -1) {
    const sanitized = sanitizeSimulatedData(data);
    col[index] = { ...col[index], ...sanitized };
    saveSimulatedCollection(colPath, col);
  }
}

export async function deleteDoc(reference: any) {
  const path = getPathFromRef(reference);
  if (isLocalSimulation()) {
    await emulatedDeleteDoc(path);
    return;
  }
  try {
    return await originalDeleteDoc(reference);
  } catch (error) {
    if (checkAndLogQuotaError(error)) {
      await emulatedDeleteDoc(path);
      return;
    }
    throw error;
  }
}

async function emulatedDeleteDoc(path: string) {
  const { colPath, docId } = getColAndDocIdFromPath(path);
  let col = getSimulatedCollection(colPath);
  col = col.filter(d => (d.id !== docId && d.uid !== docId && d.userId !== docId));
  saveSimulatedCollection(colPath, col);

  // If deleting from users or employees, clean from registration storage and sync both
  if (colPath === 'users' || colPath === 'employees') {
    try {
      const saved = localStorage.getItem('clinic_local_registered_accounts');
      if (saved) {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const originalLen = parsed.length;
          parsed = parsed.filter(a => a.uid !== docId && a.id !== docId);
          if (parsed.length !== originalLen) {
            localStorage.setItem('clinic_local_registered_accounts', JSON.stringify(parsed));
          }
        }
      }
    } catch (e) {
      console.error("Failed to clean deleted user from registered accounts:", e);
    }

    // Also delete from the companion collection to keep user/employee synced
    try {
      const companionPath = colPath === 'users' ? 'employees' : 'users';
      const companionStorageKey = `clinic_simdb_${companionPath}`;
      const companionExisting = localStorage.getItem(companionStorageKey);
      if (companionExisting) {
        let companionCol = JSON.parse(companionExisting);
        if (Array.isArray(companionCol)) {
          const companionOriginalLen = companionCol.length;
          companionCol = companionCol.filter(d => d.id !== docId && d.uid !== docId && d.userId !== docId);
          if (companionCol.length !== companionOriginalLen) {
            localStorage.setItem(companionStorageKey, JSON.stringify(companionCol));
            window.dispatchEvent(new CustomEvent(`clinic-simdb-updated-${companionPath}`));
          }
        }
      }
    } catch (e) {
      console.error("Failed to sync companion record delete:", e);
    }
  }
}

export async function getDocs(q: any) {
  const path = getPathFromRef(q);
  const constraints = q.__constraints || [];
  if (isLocalSimulation()) {
    const list = evaluateQuery(path, constraints);
    return mockQuerySnapshot(list);
  }
  try {
    return await originalGetDocs(q);
  } catch (error) {
    if (checkAndLogQuotaError(error)) {
      const list = evaluateQuery(path, constraints);
      return mockQuerySnapshot(list);
    }
    throw error;
  }
}

export function onSnapshot(reference: any, ...args: any[]) {
  let onNext: any = null;
  let onError: any = null;

  if (typeof args[0] === 'function') {
    onNext = args[0];
    if (typeof args[1] === 'function') {
      onError = args[1];
    }
  } else if (args[0] && typeof args[0] === 'object') {
    onNext = args[0].next;
    onError = args[0].error;
  }

  const path = getPathFromRef(reference);
  const constraints = reference.__constraints || [];
  const rootCol = path.split('/')[0];

  if (isLocalSimulation()) {
    const runSim = () => {
      const isDocument = path.split('/').filter(Boolean).length % 2 === 0;
      if (isDocument) {
        const { colPath, docId } = getColAndDocIdFromPath(path);
        const col = getSimulatedCollection(colPath);
        const found = col.find(d => (d.id === docId || d.uid === docId));
        const snap = mockDocSnapshot(docId, found || null);
        if (onNext) {
          onNext(snap);
        }
      } else {
        const data = evaluateQuery(path, constraints);
        if (onNext) {
          onNext(mockQuerySnapshot(data));
        }
      }
    };
    
    setTimeout(runSim, 10);

    const eventName = `clinic-simdb-updated-${rootCol}`;
    window.addEventListener(eventName, runSim);

    return () => {
      window.removeEventListener(eventName, runSim);
    };
  }

  const safeOnError = (err: any) => {
    const isQuota = checkAndLogQuotaError(err);
    if (isQuota) {
      console.warn("Quota limit reached or insufficient permissions. Switching to local simulation.");
      const runSim = () => {
        const isDocument = path.split('/').filter(Boolean).length % 2 === 0;
        if (isDocument) {
          const { colPath, docId } = getColAndDocIdFromPath(path);
          const col = getSimulatedCollection(colPath);
          const found = col.find(d => (d.id === docId || d.uid === docId));
          const snap = mockDocSnapshot(docId, found || null);
          if (onNext) {
            onNext(snap);
          }
        } else {
          const data = evaluateQuery(path, constraints);
          if (onNext) {
            onNext(mockQuerySnapshot(data));
          }
        }
      };
      runSim();
      const eventName = `clinic-simdb-updated-${rootCol}`;
      window.addEventListener(eventName, runSim);
      return;
    }

    if (onError) {
      try {
        onError(err);
      } catch (e) {
         // silently catch
      }
    }
  };

  const safeOnNext = (snapshot: any) => {
    if (onNext) {
      try {
        onNext(snapshot);
      } catch (e) {
         console.error("Error in onSnapshot onNext:", e);
      }
    }
  };

  try {
    if (typeof args[0] === 'function') {
      return originalOnSnapshot(reference, safeOnNext, safeOnError);
    } else {
      return originalOnSnapshot(reference, {
        next: safeOnNext,
        error: safeOnError
      });
    }
  } catch (err) {
    checkAndLogQuotaError(err);
    // instant simulation fallback
    const runSim = () => {
      const isDocument = path.split('/').filter(Boolean).length % 2 === 0;
      if (isDocument) {
        const { colPath, docId } = getColAndDocIdFromPath(path);
        const col = getSimulatedCollection(colPath);
        const found = col.find(d => (d.id === docId || d.uid === docId));
        const snap = mockDocSnapshot(docId, found || null);
        if (onNext) {
          onNext(snap);
        }
      } else {
        const data = evaluateQuery(path, constraints);
        if (onNext) {
          onNext(mockQuerySnapshot(data));
        }
      }
    };
    setTimeout(runSim, 10);
    const eventName = `clinic-simdb-updated-${rootCol}`;
    window.addEventListener(eventName, runSim);
    return () => {
      window.removeEventListener(eventName, runSim);
    };
  }
}

export function where(field: string, op: string, value: any) {
  try {
    const original = originalWhere(field, op as any, value);
    (original as any).__simulated = { type: 'where', field, op, val: value };
    return original;
  } catch (e) {
    return { __simulated: { type: 'where', field, op, val: value } } as any;
  }
}

export function orderBy(field: string, direction?: 'asc' | 'desc') {
  try {
    const original = originalOrderBy(field, direction);
    (original as any).__simulated = { type: 'orderBy', field, direction: direction || 'asc' };
    return original;
  } catch (e) {
    return { __simulated: { type: 'orderBy', field, direction: direction || 'asc' } } as any;
  }
}

export function limit(val: number) {
  try {
    const original = originalLimit(val);
    (original as any).__simulated = { type: 'limit', val };
    return original;
  } catch (e) {
    return { __simulated: { type: 'limit', val } } as any;
  }
}

export function query(reference: any, ...constraints: any[]) {
  let original: any = null;
  const path = getPathFromRef(reference);
  try {
    original = originalQuery(reference, ...constraints);
  } catch (e) {
    // Ignore
  }
  const q = original || { path };
  q.__path = path;
  q.__constraints = constraints.map(c => c?.__simulated || c).filter(c => c && c.type);
  return q;
}

export function serverTimestamp() {
  try {
    return originalServerTimestamp();
  } catch (e) {
    return new Date();
  }
}

export { 
  doc, collection, signInWithPopup, signOut, collectionGroup
};
