export type UserRole = 'admin' | 'keuangan' | 'owner' | 'dokter' | 'perawat' | 'apoteker' | 'media' | 'PIC';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  specialization?: string;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  createdAt: any;
  order: number;
  labels?: { id: string; name: string; color: string }[];
}

export interface List {
  id: string;
  boardId: string;
  name: string;
  order: number;
  createdAt: any;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Card {
  id: string;
  listId: string;
  boardId: string;
  title: string;
  description: string;
  status: string;
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string;
  amount?: number;
  type?: 'income' | 'expense';
  order: number;
  createdAt: any;
  updatedAt: any;
  lastModifiedBy?: string;
  dueDate?: string;
  archived?: boolean;
  isTemplate?: boolean;
  attachments?: { name: string; url: string; isCover?: boolean }[];
  checklists?: ChecklistItem[];
  dueDateNotificationSent?: boolean;
  labels?: { id: string; name: string; color: string }[];
}

export interface Product {
  id: string;
  name: string;
  shortName: string;
  price: number;
  stock: number;
  category: string;
  color: string;
  type?: 'product' | 'service';
  sharingType?: 'percentage' | 'fixed';
  nurseCommission?: number;
  adminCommission?: number;
  financeCommission?: number;
  ownerCommission?: number;
  doctorCommission?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface SaleTransaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  notes: string;
  isDelivery: boolean;
  doctorId?: string;
  doctorName?: string;
  nurseId?: string;
  nurseName?: string;
  createdAt: any;
  createdBy: string;
}

export interface CardTemplate {
  id: string;
  boardId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  amount?: number;
}

export interface CardHistory {
  id: string;
  userId: string;
  userName: string;
  changeType: string;
  previousValue?: string;
  newValue?: string;
  createdAt: any;
}

export interface CardComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
}
export interface Notification {
  id: string;
  userId: string;
  message: string;
  cardId?: string;
  read: boolean;
  createdAt: any;
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  nurseId?: string;
  nurseName?: string;
  date: any; // Timestamp
  startTime: string;
  endTime: string;
  notes: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: any;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetUserId: string;
  targetUserName: string;
  details: string;
  createdAt: any;
}

export interface RolePermissions {
  id: string; // role name
  navigation: string[]; // list of enabled tab IDs
  features: string[]; // list of enabled feature flags
  updatedAt: any;
}

export interface ClinicConfig {
  name: string;
  address: string;
  phone: string;
  logoURL?: string;
  updatedAt: any;
}
