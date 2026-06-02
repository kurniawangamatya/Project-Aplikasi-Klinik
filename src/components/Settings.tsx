import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { cn, compressImage } from '../lib/utils';
import { db, collection, query, onSnapshot, updateDoc, setDoc, doc, addDoc, getDoc, serverTimestamp, deleteDoc, orderBy, handleFirestoreError, OperationType, limit } from '../lib/firebase';
import KPITemplateManagement from './KPITemplateManagement';
import { UserProfile, UserRole, Product } from '../types';
import { 
  User, Users, Shield, Package, Grid, Settings as SettingsIcon, 
  Trash2, Edit3, Plus, Save, X, Check, Search, 
  Image as ImageIcon, Camera, LayoutList, Fingerprint,
  Mail, Bell, Building2, LayoutDashboard, BarChart3, Stethoscope, 
  Activity, Briefcase, DollarSign, Clock, Phone, MapPin, CheckCircle2, RefreshCw, Target, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

export default function Settings() {
  const { user, profile, updateRole } = useAuth();
  const { users, products, employees, categories, clinicSettings, customizationSettings, isQuotaExceeded } = useData();
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'products' | 'categories' | 'permissions' | 'clinic' | 'payroll_config' | 'kpi_templates' | 'attendance_mgt' | 'customization'>('profile');
  
  const handleUpdateRoleWithSync = async (uid: string, role: UserRole) => {
    try {
      await updateRole(uid, role);
      
      const targetUser = users.find(u => u.uid === uid);
      if (targetUser) {
        const existingEmployee = employees.find(e => e.userId === uid);
        
        let defaultRate = 0;
        try {
          const payrollSnap = await getDoc(doc(db, 'settings', 'payroll'));
          if (payrollSnap.exists()) {
            const rates = (payrollSnap.data() as any)?.roleRates || {};
            defaultRate = rates[role.toLowerCase()] || 0;
          }
        } catch (e) {
          console.error("Error fetching rates", e);
        }

        if (!existingEmployee) {
          await addDoc(collection(db, 'employees'), {
            userId: uid,
            name: targetUser.displayName,
            role: role,
            salary: 0,
            hourlyRate: defaultRate,
            status: 'active',
            joinedAt: serverTimestamp()
          });
        } else {
          await updateDoc(doc(db, 'employees', existingEmployee.id), {
            role: role,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (e) {
      console.error(e);
      alert('Gagal update role');
    }
  };
  const [loading, setLoading] = useState(false);

  // Clinic State
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicLogoURL, setClinicLogoURL] = useState('');
  const [savingClinic, setSavingClinic] = useState(false);
  
  // Sync Clinic State from Context
  useEffect(() => {
    if (clinicSettings) {
      setClinicName(clinicSettings.name || '');
      setClinicAddress(clinicSettings.address || '');
      setClinicPhone(clinicSettings.phone || '');
      setClinicLogoURL(clinicSettings.logoURL || '');
    }
  }, [clinicSettings]);

  // Profile State
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [specialization, setSpecialization] = useState(profile?.specialization || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('Ukuran file terlalu besar. Maksimum 20MB.');
      return;
    }

    try {
      const compressedUrl = await compressImage(file, 800, 800, 0.7);
      setter(compressedUrl);
    } catch (err) {
      console.error(err);
      alert('Gagal memproses gambar.');
    }
  };

  // Search States
  const [teamSearch, setTeamSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
      setSpecialization(profile.specialization || '');
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        photoURL,
        specialization
      });
      alert('Profil berhasil diperbaharui');
    } catch (e) {
      console.error(e);
      alert('Gagal memperbaharui profil');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 font-sans">
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1">Pusat Kontrol</h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
            <Fingerprint className="w-3 h-3" /> Konfigurasi Sistem & Master Data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-px bg-zinc-800 mx-2" />
          <div className="text-right">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{profile?.displayName}</p>
            <p className="text-[9px] font-bold text-blue-500 uppercase">{profile?.role}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden">
            <img src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}&background=3b82f6&color=fff`} className="w-full h-full object-cover" alt="" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 px-4 sm:px-8 pb-24 md:pb-8 gap-6 md:gap-10 md:overflow-hidden overflow-visible custom-scrollbar">
        {/* Settings Navigation */}
        <div className="w-full md:w-72 flex md:flex-col gap-4 md:gap-8 shrink-0 overflow-x-auto md:overflow-y-auto pb-4 md:pb-0 scrollbar-hide custom-scrollbar">
          <div className="flex md:flex-col gap-1 md:gap-1 shrink-0">
            <p className="hidden md:block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 ml-4">Akun & Profil</p>
            <TabButton 
              active={activeTab === 'profile'} 
              onClick={() => setActiveTab('profile')} 
              icon={<User className="w-4 h-4" />} 
              label="Profil Pribadi" 
              description="Informasi publik & avatar"
            />
          </div>

          {isAdmin && (
            <>
              <div className="flex md:flex-col gap-1 md:gap-1 shrink-0">
                <p className="hidden md:block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 ml-4">Administrasi</p>
                <TabButton 
                  active={activeTab === 'team'} 
                  onClick={() => setActiveTab('team')} 
                  icon={<Shield className="w-4 h-4" />} 
                  label="Manajemen Tim" 
                  description="Akses, peran & keamanan"
                />
              </div>
              <div className="flex md:flex-col gap-1 md:gap-1 shrink-0">
                <p className="hidden md:block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 ml-4">Master Data</p>
                <TabButton 
                  active={activeTab === 'products'} 
                  onClick={() => setActiveTab('products')} 
                  icon={<Package className="w-4 h-4" />} 
                  label="Katalog & Harga" 
                  description="Produk, jasa & komisi"
                />
                <TabButton 
                  active={activeTab === 'categories'} 
                  onClick={() => setActiveTab('categories')} 
                  icon={<Grid className="w-4 h-4" />} 
                  label="Grup Kategori" 
                  description="Organisasi item katalog"
                />
                <TabButton 
                  active={activeTab === 'permissions'} 
                  onClick={() => setActiveTab('permissions')} 
                  icon={<Fingerprint className="w-4 h-4" />} 
                  label="Hak Akses" 
                  description="Atur visibilitas fitur per peran"
                />
                <TabButton 
                  active={activeTab === 'payroll_config'} 
                  onClick={() => setActiveTab('payroll_config')} 
                  icon={<DollarSign className="w-4 h-4" />} 
                  label="Tarif & Payroll" 
                  description="Atur rate per jam Dokter"
                />
                <TabButton 
                  active={activeTab === 'kpi_templates'} 
                  onClick={() => setActiveTab('kpi_templates')} 
                  icon={<Target className="w-4 h-4" />} 
                  label="Template KPI" 
                  description="Atur harga per tugas KPI"
                />
                <TabButton 
                  active={activeTab === 'clinic'} 
                  onClick={() => setActiveTab('clinic')} 
                  icon={<Building2 className="w-4 h-4" />} 
                  label="Profil Klinik" 
                  description="Identitas dan Nama Klinik"
                />
                <TabButton 
                  active={activeTab === 'attendance_mgt'} 
                  onClick={() => setActiveTab('attendance_mgt')} 
                  icon={<Clock className="w-4 h-4" />} 
                  label="Kelola Absensi & Lembur" 
                  description="Reset absensi & setujui lembur"
                />
                <TabButton 
                  active={activeTab === 'customization'} 
                  onClick={() => setActiveTab('customization')} 
                  icon={<LayoutList className="w-4 h-4" />} 
                  label="Kustomisasi Tampilan" 
                  description="Ubah login, background & warna"
                />
              </div>
            </>
          )}
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 bg-zinc-900/40 rounded-[2rem] md:rounded-[3rem] border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col min-h-[500px] md:min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-400 opacity-50" />
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar pb-32 md:pb-10">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-w-3xl"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                      <SettingsIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">Detail Profil</h2>
                      <p className="text-xs font-medium text-zinc-500">Kelola identitas visual Anda dalam sistem</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 flex flex-col items-center">
                      <div className="relative group perspective-1000">
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-48 h-48 rounded-[3rem] bg-zinc-800 border-4 border-zinc-900 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative transition-all duration-700 group-hover:rotate-y-12 cursor-pointer"
                        >
                          <img 
                            src={photoURL || `https://ui-avatars.com/api/?name=${displayName}&background=3b82f6&color=fff`} 
                            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                            alt="Profile"
                          />
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white w-10 h-10 mb-2" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Ubah Foto</span>
                          </div>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, setPhotoURL)}
                        />
                        <div className="absolute -bottom-4 -right-4 w-14 h-14 bg-white rounded-3xl border-[6px] border-zinc-950 flex items-center justify-center shadow-xl rotate-12 group-hover:rotate-0 transition-transform">
                          <Check className="text-blue-600 w-6 h-6" />
                        </div>
                      </div>
                      <p className="mt-8 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] text-center">Klik untuk upload foto profile</p>
                    </div>

                    <div className="lg:col-span-8 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Tampilan</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <input 
                              type="text" 
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="w-full bg-zinc-800/30 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 transition-all focus:bg-zinc-800/80"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">E-mail (Read Only)</label>
                          <div className="relative opacity-60">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <input 
                              type="text" 
                              value={user?.email || ''}
                              readOnly
                              className="w-full bg-zinc-950/30 border border-zinc-900 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-zinc-500 cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">URL Foto Profil kustom</label>
                        <div className="relative">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                          <input 
                            type="text" 
                            value={photoURL}
                            onChange={(e) => setPhotoURL(e.target.value)}
                            placeholder="https://images.unsplash.com/photo-..."
                            className="w-full bg-zinc-800/30 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 transition-all focus:bg-zinc-800/80"
                          />
                        </div>
                      </div>

                      {profile?.role === 'dokter' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Spesialisasi Klinis</label>
                           <div className="relative">
                            <LayoutList className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <input 
                              type="text" 
                              value={specialization}
                              onChange={(e) => setSpecialization(e.target.value)}
                              placeholder="Contoh: Dokter Gigi Spesialis Endo"
                              className="w-full bg-zinc-800/30 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 transition-all focus:bg-zinc-800/80"
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-6">
                        <button 
                          onClick={handleUpdateProfile}
                          disabled={savingProfile}
                          className="flex items-center gap-3 px-10 py-4 bg-white text-zinc-950 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all shadow-2xl shadow-white/5 active:scale-95 disabled:opacity-50"
                        >
                          {savingProfile ? (
                            <div className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                          ) : <Save className="w-4 h-4" />}
                          Simpan Perubahan Profil
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'team' && isAdmin && (
                <TeamManagement users={users} onUpdateRole={handleUpdateRoleWithSync} />
              )}

              {activeTab === 'products' && isAdmin && (
                <ProductManagement products={products} categories={categories} />
              )}

              {activeTab === 'categories' && isAdmin && (
                <CategoryManagement categories={categories} />
              )}

              {activeTab === 'permissions' && isAdmin && (
                <PermissionsManagement />
              )}

              {activeTab === 'payroll_config' && isAdmin && (
                <PayrollConfig employees={employees} users={users} />
              )}

              {activeTab === 'kpi_templates' && isAdmin && (
                <KPITemplateManagement />
              )}

              {activeTab === 'clinic' && isAdmin && (
                <ClinicManagement 
                  name={clinicName}
                  address={clinicAddress}
                  phone={clinicPhone}
                  logoURL={clinicLogoURL}
                  onSave={async (name, address, phone, logoURL) => {
                    setSavingClinic(true);
                    try {
                      await setDoc(doc(db, 'settings', 'clinic'), {
                        name, address, phone, logoURL, updatedAt: serverTimestamp()
                      }, { merge: true });
                      alert('Profil klinik berhasil disimpan');
                    } catch (e) {
                      console.error(e);
                      alert('Gagal menyimpan profil klinik');
                    } finally {
                      setSavingClinic(false);
                    }
                  }}
                  saving={savingClinic}
                />
              )}

              {activeTab === 'attendance_mgt' && isAdmin && (
                <AttendanceManagement />
              )}

              {activeTab === 'customization' && isAdmin && (
                <CustomizationManagement />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, label, description, icon, onClick }: { active: boolean, label: string, description: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex md:flex-row items-center gap-4 px-6 py-4 rounded-3xl transition-all border group text-left shrink-0 md:shrink ${
        active 
          ? 'bg-white text-zinc-950 shadow-[0_20px_40px_-8px_rgba(255,255,255,0.1)] border-white' 
          : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:text-white hover:bg-zinc-800 md:hover:translate-x-1'
      } ${active ? 'md:translate-x-1' : ''} md:w-full w-[240px]`}
    >
      <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-zinc-100 text-blue-600 shadow-inner' : 'bg-zinc-800 text-zinc-600 group-hover:text-zinc-400'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] leading-none mb-1.5">{label}</p>
        <p className={`text-[9px] font-bold uppercase tracking-tight truncate ${active ? 'text-zinc-400' : 'text-zinc-700'}`}>{description}</p>
      </div>
    </button>
  );
}


function TeamManagement({ users, onUpdateRole }: { users: UserProfile[], onUpdateRole: (uid: string, role: UserRole) => Promise<void> }) {
  const { employees } = useData();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  // Add Member Form State
  const [newMemberForm, setNewMemberForm] = useState({
    displayName: '',
    email: '',
    role: 'perawat' as UserRole,
    specialization: '',
    salary: 3000000,
    hourlyRate: 15000
  });

  // Edit Member Rates State
  const [empSalary, setEmpSalary] = useState(0);
  const [empHourlyRate, setEmpHourlyRate] = useState(0);

  // Sync edit values when editingUser changes
  useEffect(() => {
    if (editingUser) {
      const emp = employees.find(e => e.userId === editingUser.uid);
      setEmpSalary(emp ? emp.salary : 0);
      setEmpHourlyRate(emp ? emp.hourlyRate : 10000);
    }
  }, [editingUser, employees]);

  // Autofill rates when new user role is chosen
  useEffect(() => {
    const fetchDefaultRate = async () => {
      try {
        const payrollSnap = await getDoc(doc(db, 'settings', 'payroll'));
        if (payrollSnap.exists()) {
          const rates = (payrollSnap.data() as any)?.roleRates || {};
          const rate = rates[newMemberForm.role.toLowerCase()];
          if (rate !== undefined) {
            setNewMemberForm(prev => ({ ...prev, hourlyRate: rate }));
          }
        }
      } catch (err) {
        console.error("Fetch default rates failed:", err);
      }
    };
    fetchDefaultRate();
  }, [newMemberForm.role]);

  const handleUpdateUserMaster = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      // Update users collection
      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: editingUser.displayName,
        photoURL: editingUser.photoURL || '',
        specialization: editingUser.specialization || ''
      });

      // Synchronize changes to employees collection
      const emp = employees.find(e => e.userId === editingUser.uid);
      if (emp) {
        await updateDoc(doc(db, 'employees', emp.id), {
          name: editingUser.displayName,
          salary: Number(empSalary) || 0,
          hourlyRate: Number(empHourlyRate) || 0,
          updatedAt: serverTimestamp()
        });
      } else {
        // Safe lock: create employee entry if missing
        await setDoc(doc(db, 'employees', editingUser.uid), {
          userId: editingUser.uid,
          id: editingUser.uid,
          name: editingUser.displayName,
          role: editingUser.role,
          salary: Number(empSalary) || 0,
          hourlyRate: Number(empHourlyRate) || 12000,
          status: 'active',
          joinedAt: serverTimestamp()
        });
      }

      setEditingUser(null);
      alert('Data anggota tim dan gaji berhasil diperbarui');
    } catch (e) {
      console.error(e);
      alert('Gagal mengupdate profil anggota');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.displayName.trim() || !newMemberForm.email.trim()) {
      alert('Nama dan Email wajib diisi!');
      return;
    }
    setSaving(true);
    try {
      const tempId = 'staf-' + Math.random().toString(36).substring(2, 11);
      const emailLower = newMemberForm.email.trim().toLowerCase();

      // 1. Write to users collection
      await setDoc(doc(db, 'users', tempId), {
        uid: tempId,
        email: emailLower,
        displayName: newMemberForm.displayName.trim(),
        role: newMemberForm.role,
        specialization: newMemberForm.specialization.trim() || ''
      });

      // 2. Write to employees collection
      await setDoc(doc(db, 'employees', tempId), {
        userId: tempId,
        id: tempId,
        name: newMemberForm.displayName.trim(),
        role: newMemberForm.role,
        salary: Number(newMemberForm.salary) || 0,
        hourlyRate: Number(newMemberForm.hourlyRate) || 0,
        status: 'active',
        joinedAt: serverTimestamp()
      });

      // 3. Ensure role permissions exist
      try {
        const permRef = doc(db, 'role_permissions', newMemberForm.role);
        const permSnap = await getDoc(permRef);
        if (!permSnap.exists()) {
          await setDoc(permRef, {
            navigation: ['overview', 'board', 'kpi'],
            updatedAt: serverTimestamp()
          });
        }
      } catch (permErr) {
        console.error("Initialize permissions error:", permErr);
      }

      setAddingMember(false);
      alert(`Berhasil menambahkan staf baru!\nStaf sekarang dapat log in di pintu masuk menggunakan:\n- Email: ${emailLower}\n- Sandi apa saja (akan terdaftar otomatis)`);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan staf baru.');
    } finally {
      setSaving(false);
    }
  };
  
  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Daftar Anggota Tim</h3>
          <button
            onClick={() => {
              setNewMemberForm({
                displayName: '',
                email: '',
                role: 'perawat',
                specialization: '',
                salary: 3000000,
                hourlyRate: 15000
              });
              setAddingMember(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(139,92,246,0.25)] cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah Staf Baru</span>
          </button>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input 
            type="text" 
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredUsers.map(user => {
          const emp = employees.find(e => e.userId === user.uid);
          return (
            <div key={user.uid} className="p-4 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 flex items-center justify-between group hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-4">
                <div 
                  className="relative group/avatar cursor-pointer"
                  onClick={() => setEditingUser(user)}
                >
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=3b82f6&color=fff`} 
                    className="w-12 h-12 rounded-xl grayscale hover:grayscale-0 transition-all border border-zinc-800 group-hover/avatar:border-blue-500"
                    alt="Member"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 rounded-xl transition-opacity">
                    <Edit3 className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white leading-none mb-1 flex items-center gap-2">
                    {user.displayName}
                    {user.role === 'admin' && <Shield className="w-3 h-3 text-blue-500" />}
                  </h4>
                  <p className="text-[10px] font-mono text-zinc-600">{user.email}{user.specialization ? ` • ${user.specialization}` : ''}</p>
                  {emp && (
                    <p className="text-[9px] text-emerald-500/80 font-bold mt-1">
                      Gaji: Rp {(emp.salary || 0).toLocaleString()} • Lembur: Rp {(emp.hourlyRate || 0).toLocaleString()}/jam
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select 
                  value={user.role}
                  onChange={(e) => onUpdateRole(user.uid, e.target.value as UserRole)}
                  className="bg-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-widest px-3 py-2 rounded-xl border border-zinc-700 outline-none hover:text-white transition-all cursor-pointer"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="keuangan">Keuangan</option>
                  <option value="dokter">Dokter</option>
                  <option value="perawat">Perawat</option>
                  <option value="apoteker">Apoteker</option>
                  <option value="media">Media</option>
                  <option value="PIC">PIC</option>
                </select>

                {user.uid !== profile?.uid && (
                  <button 
                    onClick={async () => {
                      if (confirm(`Apakah Anda yakin ingin menghapus akun ${user.displayName}?`)) {
                        try {
                          await deleteDoc(doc(db, 'users', user.uid));
                        } catch (e) {
                          console.error("Gagal menghapus pengguna:", e);
                        }
                      }
                    }}
                    className="p-2.5 bg-red-950/20 text-red-500 hover:bg-red-950/40 rounded-xl border border-red-900/30 transition-all"
                    title="Hapus Pengguna"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {/* ADD STAFF MEMBER MODAL */}
        {addingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Pendaftaran Staf Baru</h3>
                </div>
                <button onClick={() => setAddingMember(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handleAddNewMemberSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Nama Tampilan / Nama Lengkap</label>
                  <input 
                    type="text" 
                    required
                    value={newMemberForm.displayName}
                    onChange={(e) => setNewMemberForm({...newMemberForm, displayName: e.target.value})}
                    placeholder="Contoh: Suster Diana"
                    className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Alamat Email Staf</label>
                  <input 
                    type="email" 
                    required
                    value={newMemberForm.email}
                    onChange={(e) => setNewMemberForm({...newMemberForm, email: e.target.value})}
                    placeholder="diana@klinik.com"
                    className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  />
                  <div className="mt-2.5 p-3.5 bg-violet-950/20 border border-violet-900/40 rounded-2xl text-left">
                    <p className="text-[10px] font-black text-violet-300 flex items-center gap-1.5 mb-1">
                      <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sistem Sandi Mandiri (Praktis & Hemat)</span>
                    </p>
                    <p className="text-[9.5px]/relaxed text-zinc-400">
                      Anda tidak perlu membuatkan kata sandi bagi mereka secara manual. Ketika staf yang Anda daftarkan masuk ke system menggunakan email ini untuk pertama kali, <strong>kata sandi apa saja (minimal 6 karakter)</strong> yang mereka ketikkan akan otomatis terdaftar dan dikunci sebagai sandi resmi mereka.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Peran Akses (Role)</label>
                    <select
                      value={newMemberForm.role}
                      onChange={(e) => setNewMemberForm({...newMemberForm, role: e.target.value as UserRole})}
                      className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all cursor-pointer"
                    >
                      <option value="perawat">Perawat</option>
                      <option value="dokter">Dokter</option>
                      <option value="keuangan">Keuangan</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                      <option value="apoteker">Apoteker</option>
                      <option value="media">Media</option>
                      <option value="PIC">PIC</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Spesialisasi (Dokter/Perawat)</label>
                    <input 
                      type="text" 
                      value={newMemberForm.specialization}
                      onChange={(e) => setNewMemberForm({...newMemberForm, specialization: e.target.value})}
                      placeholder="Contoh: Ahli Bedah Mulut"
                      className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800 pt-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Gaji Pokok bulanan (Rp)</label>
                    <input 
                      type="number" 
                      value={newMemberForm.salary}
                      onChange={(e) => setNewMemberForm({...newMemberForm, salary: Number(e.target.value)})}
                      className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Tarif Upah Lembur / Jam (Rp)</label>
                    <input 
                      type="number" 
                      value={newMemberForm.hourlyRate}
                      onChange={(e) => setNewMemberForm({...newMemberForm, hourlyRate: Number(e.target.value)})}
                      className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-950/40 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Menyimpan...' : 'Daftarkan Staf Baru'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* EDIT STAFF MEMBER MASTER MODAL */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter text-center">Master Anggota</h3>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col items-center">
                   <div 
                    className="relative group cursor-pointer"
                    onClick={() => {
                      const input = document.getElementById('team-member-photo-input') as HTMLInputElement;
                      input?.click();
                    }}
                  >
                    <img 
                      src={editingUser.photoURL || `https://ui-avatars.com/api/?name=${editingUser.displayName}&background=3b82f6&color=fff`} 
                      className="w-24 h-24 rounded-3xl object-cover border-2 border-zinc-800 group-hover:border-blue-500 transition-all"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <input 
                    type="file" 
                    id="team-member-photo-input"
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 20 * 1024 * 1024) {
                        alert('File terlalu besar. Maksimum 20MB.');
                        return;
                      }
                      try {
                        const compressedUrl = await compressImage(file, 800, 800, 0.7);
                        setEditingUser(prev => prev ? {...prev, photoURL: compressedUrl} : null);
                      } catch (err) {
                        console.error(err);
                        alert('Gagal memproses gambar.');
                      }
                    }}
                  />
                  <p className="mt-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Klik untuk ganti foto</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 text-center block">Identitas E-mail</label>
                  <p className="text-center font-mono text-xs text-zinc-400 bg-zinc-950 py-3 rounded-xl border border-zinc-900">{editingUser.email}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Tampilan</label>
                  <input 
                    type="text" 
                    value={editingUser.displayName}
                    onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Spesialisasi (Jika Dokter)</label>
                  <input 
                    type="text" 
                    value={editingUser.specialization || ''}
                    onChange={(e) => setEditingUser(prev => prev ? {...prev, specialization: e.target.value} : null)}
                    placeholder="Contoh: Dokter Umum"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">URL Foto Profil</label>
                  <input 
                    type="text" 
                    value={editingUser.photoURL || ''}
                    onChange={(e) => setEditingUser(prev => prev ? {...prev, photoURL: e.target.value} : null)}
                    placeholder="https://..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  />
                </div>

                {/* Edit Pay and rate variables on screen (Synchronization mandate) */}
                <div className="border-t border-zinc-800 pt-4 mt-2 grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Gaji Pokok (Rp)</label>
                    <input 
                      type="number" 
                      value={empSalary}
                      onChange={(e) => setEmpSalary(Number(e.target.value))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">Tarif Lembur (Rp)</label>
                    <input 
                      type="number" 
                      value={empHourlyRate}
                      onChange={(e) => setEmpHourlyRate(Number(e.target.value))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleUpdateUserMaster}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Perbarui Data Member'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProductManagement({ products, categories }: { products: Product[], categories: {id: string, name: string}[] }) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    shortName: '',
    price: 0,
    stock: 0,
    category: 'Umum',
    type: 'product',
    color: 'bg-blue-400'
  });

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!form.name || !form.price) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), form);
      } else {
        await addDoc(collection(db, 'products'), { ...form, createdAt: serverTimestamp() });
      }
      setForm({ name: '', shortName: '', price: 0, stock: 0, category: 'Umum', type: 'product', color: 'bg-blue-400' });
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Hapus produk ini?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (e) { console.error(e); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Form */}
        <div className="lg:col-span-1 space-y-6 bg-zinc-950/50 p-6 rounded-[2rem] border border-zinc-800">
          <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">{editingId ? 'Edit Item' : 'Tambah Item Baru'}</h4>
          <div className="space-y-4">
            <input 
              type="text" value={form.name} 
              onChange={(e) => setForm({...form, name: e.target.value})} 
              placeholder="Nama Item"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs font-bold text-white outline-none"
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text" value={form.shortName} 
                onChange={(e) => setForm({...form, shortName: e.target.value})} 
                placeholder="Kode/Abbr"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs font-bold text-white outline-none"
              />
              <select 
                value={form.category} 
                onChange={(e) => setForm({...form, category: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs font-bold text-white outline-none"
              >
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="number" value={form.price} 
                onChange={(e) => setForm({...form, price: Number(e.target.value)})} 
                placeholder="Harga"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs font-bold text-white outline-none font-mono"
              />
              <input 
                type="number" value={form.stock} 
                onChange={(e) => setForm({...form, stock: Number(e.target.value)})} 
                placeholder="Stok"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs font-bold text-white outline-none font-mono"
              />
            </div>
            <div className="flex bg-zinc-800 p-1 rounded-xl">
              <button 
                onClick={() => setForm({...form, type: 'product'})}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black ${form.type === 'product' ? 'bg-zinc-700 text-white' : 'text-zinc-600'}`}
              >PRODUCT</button>
              <button 
                onClick={() => setForm({...form, type: 'service'})}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black ${form.type === 'service' ? 'bg-zinc-700 text-white' : 'text-zinc-600'}`}
              >SERVICE</button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {COLORS.map(c => (
                <button 
                  key={c.value} 
                  onClick={() => setForm({...form, color: c.value})}
                  className={`w-6 h-6 rounded-md ${c.value} border-2 ${form.color === c.value ? 'border-white' : 'border-transparent'}`}
                />
              ))}
            </div>
            <button 
              onClick={handleSubmit}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20"
            >
              <Save className="w-4 h-4 inline mr-2" /> {editingId ? 'Simpan' : 'Tambah'}
            </button>
            {editingId && <button onClick={() => { setEditingId(null); setForm({}); }} className="w-full text-[10px] font-black text-zinc-600 uppercase py-2">Batal</button>}
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input 
              type="text" placeholder="Cari item..." 
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none"
            />
          </div>
          <div className="bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-widest">Detail Item</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-widest">Kategori</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-widest text-right">Harga</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-widest text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${p.color} flex items-center justify-center text-[10px] font-black text-white`}>{p.shortName}</div>
                        <div>
                          <p className="text-xs font-bold text-white">{p.name}</p>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${p.type === 'service' ? 'text-indigo-400' : 'text-emerald-400'}`}>{p.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-md">{p.category}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-xs font-black text-white font-mono">Rp {p.price.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-zinc-600">Stok: {p.stock}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingId(p.id); setForm(p); }} className="p-2 bg-zinc-800 text-zinc-500 hover:text-white rounded-lg transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteProduct(p.id)} className="p-2 bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CategoryManagement({ categories }: { categories: {id: string, name: string}[] }) {
  const { products } = useData();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name) return;
    try {
      if (editing) {
        await updateDoc(doc(db, 'categories', editing), { name });
      } else {
        await addDoc(collection(db, 'categories'), { name, createdAt: serverTimestamp() });
      }
      setName('');
      setEditing(null);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Hapus kategori "${catName}"? Produk di dalamnya akan dipindahkan ke kategori "Umum".`)) return;
    try {
       await deleteDoc(doc(db, 'categories', id));
       const productsToUpdate = products.filter(p => p.category === catName);
       for (const p of productsToUpdate) {
         await updateDoc(doc(db, 'products', p.id), { category: 'Umum' });
       }
    } catch (e) { console.error(e); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-8">
      <div className="p-8 bg-zinc-950/50 rounded-[2.5rem] border border-zinc-800">
        <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-6">Manajemen Kategori Katalog</h4>
        <div className="flex gap-4">
          <input 
            type="text" value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Tambah kategori baru..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl py-3.5 px-6 text-xs font-bold text-white outline-none transition-all focus:ring-2 focus:ring-blue-600"
          />
          <button 
            onClick={handleSubmit}
            className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95"
          >
            {editing ? 'Perbarui' : 'Tambah'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map(c => (
          <div key={c.id} className="p-4 bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-between group">
            <span className="text-xs font-bold text-zinc-300">{c.name}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditing(c.id); setName(c.name); }} className="p-1.5 text-zinc-500 hover:text-blue-500 transition-colors"><Edit3 className="w-3 h-3" /></button>
              <button onClick={() => handleDelete(c.id, c.name)} className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function PermissionsManagement() {
  const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
    owner: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
    admin: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi', 'settings'],
    keuangan: ['overview', 'board', 'clinic-boards', 'finance', 'payroll', 'attendance', 'patient-data', 'kpi'],
    dokter: ['overview', 'board', 'clinic-boards', 'doctor-report', 'attendance', 'patient-data', 'kpi'],
    perawat: ['overview', 'board', 'clinic-boards', 'nurse-report', 'attendance', 'patient-data', 'kpi'],
    apoteker: ['overview', 'board', 'clinic-boards', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi'],
    media: ['overview', 'board', 'clinic-boards', 'attendance', 'kpi'],
    PIC: ['overview', 'board', 'clinic-boards', 'team', 'clinic-task-validate', 'attendance', 'patient-data', 'kpi', 'settings']
  };

  const [permissions, setPermissions] = useState<Record<UserRole, string[]>>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const NAV_ITEMS = [
    { id: 'overview', label: 'Dashboard Klinik / Ringkasan', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'clinic-boards', label: 'Clinic Tools (Papan Kerja)', icon: <Package className="w-4 h-4" /> },
    { id: 'clinic-task-validate', label: 'Validasi Tugas (Selesaikan)', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analitik Visual', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'doctor-report', label: 'Laporan Dokter', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'nurse-report', label: 'Laporan Perawat', icon: <Activity className="w-4 h-4" /> },
    { id: 'admin-report', label: 'Laporan Admin', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'team', label: 'Pusat Tim', icon: <Shield className="w-4 h-4" /> },
    { id: 'finance', label: 'Kasir & Transaksi', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'payroll', label: 'Payroll & Komisi', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'attendance', label: 'Absensi Karyawan', icon: <Clock className="w-4 h-4" /> },
    { id: 'kpi', label: 'Pusat KPI / Performa', icon: <Target className="w-4 h-4" /> },
    { id: 'patient-data', label: 'Database Pasien', icon: <User className="w-4 h-4" /> },
    { id: 'settings', label: 'Pengaturan Sistem', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  const ROLES: UserRole[] = ['owner', 'admin', 'dokter', 'keuangan', 'perawat', 'apoteker', 'media', 'PIC'];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'role_permissions'), (snapshot) => {
      setPermissions(prev => {
        const perms = { ...prev };
        snapshot.docs.forEach(doc => {
          perms[doc.id as UserRole] = doc.data().navigation || [];
        });
        return perms;
      });
      setLoading(false);
    }, (e) => {
      console.error('Error fetching role matrices:', e);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const togglePermission = (role: UserRole, navId: string) => {
    const current = permissions[role] || [];
    const next = current.includes(navId) 
      ? current.filter(id => id !== navId)
      : [...current, navId];
    
    setPermissions({ ...permissions, [role]: next });
  };

  const handleSave = async (role: UserRole) => {
    setSaving(true);
    try {
      let nextNavigation = permissions[role] || [];
      // Synchronize 'board' permissions with 'clinic-boards' and 'overview' internally to ensure smooth operation
      if (nextNavigation.includes('clinic-boards') && !nextNavigation.includes('board')) {
        nextNavigation = [...nextNavigation, 'board'];
      }
      if (nextNavigation.includes('overview') && !nextNavigation.includes('board')) {
        nextNavigation = [...nextNavigation, 'board'];
      }
      await setDoc(doc(db, 'role_permissions', role), {
        navigation: nextNavigation,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert(`Hak akses untuk ${role} telah diperbarui`);
    } catch (e: any) {
      console.error(e);
      alert('Gagal menyimpan hak akses');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-20 text-zinc-500 font-black uppercase tracking-widest text-xs">Memuat Data Akses...</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <Fingerprint className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Matriks Hak Akses Navigasi</h2>
          <p className="text-xs font-medium text-zinc-500">Konfigurasi visibilitas menu untuk setiap peran pengguna</p>
        </div>
      </div>                      <div className="max-h-[600px] overflow-y-auto rounded-[2.5rem] border border-zinc-800 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-20">
                              <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest sticky left-0 bg-zinc-900 z-30 w-64">Nama Modul / Fitur</th>
                              {ROLES.map(role => (
                                <th key={role} className="px-6 py-6 text-center bg-zinc-900/90 backdrop-blur">
                                  <span className="text-[10px] font-black uppercase text-white tracking-widest bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">{role}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            {NAV_ITEMS.map((nav) => (
                              <tr key={nav.id} className="hover:bg-zinc-800/20 transition-colors group">
                                <td className="px-8 py-5 sticky left-0 bg-zinc-950/20 backdrop-blur z-10">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-blue-500 transition-colors border border-zinc-800">
                                      {nav.icon}
                                    </div>
                                    <span className="text-xs font-bold text-zinc-300">{nav.label}</span>
                                  </div>
                                </td>
                                {ROLES.map(role => (
                                  <td key={role} className="px-6 py-5 text-center">
                                    <button 
                                      onClick={() => togglePermission(role, nav.id)}
                                      className={`w-10 h-10 rounded-2xl border-2 transition-all mx-auto flex items-center justify-center ${
                                        (permissions[role] || []).includes(nav.id)
                                          ? 'bg-blue-600/20 border-blue-600 text-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                                          : 'bg-zinc-900 border-zinc-800 text-zinc-700 hover:border-zinc-700'
                                      }`}
                                    >
                                      {(permissions[role] || []).includes(nav.id) ? <Check className="w-5 h-5 stroke-[3]" /> : <X className="w-4 h-4 opacity-20" />}
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {/* Actions Row */}
                            <tr className="bg-zinc-900/50 sticky bottom-0 z-20">
                              <td className="px-8 py-10 sticky left-0 font-black text-[10px] text-zinc-500 uppercase tracking-[0.2em] bg-zinc-900 z-30">Simpan Konfigurasi</td>
                              {ROLES.map(role => (
                                <td key={role} className="px-6 py-10 text-center bg-zinc-900/90 backdrop-blur">
                                  <button 
                                    onClick={() => handleSave(role)}
                                    className="px-6 py-3 bg-white text-zinc-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-200 shadow-xl shadow-white/5 transition-all active:scale-95"
                                  >
                                    Set {role}
                                  </button>
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
      
      <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-blue-600/10 text-blue-500 rounded-lg shrink-0">
          <Fingerprint className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Catatan Keamanan</h4>
          <p className="text-[10px] font-medium text-zinc-500 leading-relaxed max-w-2xl">
            Perubahan hak akses akan berdampak langsung pada navigasi pengguna. Pengguna yang sedang login mungkin perlu memuat ulang halaman untuk melihat perubahan navigasi. Peran 'Owner' dan 'Admin' disarankan memiliki akses penuh ke Pengaturan untuk menghindari terkunci dari sistem.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ClinicManagement({ name, address, phone, logoURL, onSave, saving }: { 
  name: string, address: string, phone: string, logoURL: string,
  onSave: (n: string, a: string, p: string, l: string) => void,
  saving: boolean
}) {
  const [localName, setLocalName] = useState(name);
  const [localAddress, setLocalAddress] = useState(address);
  const [localPhone, setLocalPhone] = useState(phone);
  const [localLogo, setLocalLogo] = useState(logoURL);

  useEffect(() => {
    setLocalName(name);
    setLocalAddress(address);
    setLocalPhone(phone);
    setLocalLogo(logoURL);
  }, [name, address, phone, logoURL]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto py-10">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 space-y-10 shadow-2xl">
        <div className="flex items-center gap-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-[2rem] bg-zinc-800 border-2 border-dashed border-zinc-700 flex items-center justify-center text-blue-500 shadow-inner relative overflow-hidden group cursor-pointer"
          >
            {localLogo ? (
              <img src={localLogo} className="w-full h-full object-contain" alt="Logo" />
            ) : (
              <ImageIcon className="w-10 h-10 text-zinc-700 group-hover:text-blue-500 transition-colors" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 20 * 1024 * 1024) {
                  alert('Ukuran logo terlalu besar. Maksimum 20MB.');
                  return;
                }
                try {
                  const compressedUrl = await compressImage(file, 600, 600, 0.7);
                  setLocalLogo(compressedUrl);
                } catch (err) {
                  console.error(err);
                  alert('Gagal memproses logo.');
                }
              }}
            />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Identitas Klinik</h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Informasi Dasar Cabang & Branding</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Institusi / Klinik</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input 
                type="text" 
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                placeholder="Masukkan Nama Klinik..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Alamat Lengkap</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-5 w-4 h-4 text-zinc-600" />
              <textarea 
                value={localAddress}
                onChange={(e) => setLocalAddress(e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all resize-none"
                placeholder="Masukkan Alamat Klinik..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nomor Kontak / WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input 
                type="text" 
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                placeholder="0812..."
              />
            </div>
          </div>
        </div>

        <button 
          onClick={() => onSave(localName, localAddress, localPhone, localLogo)}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {saving ? 'Memproses...' : <><Save className="w-4 h-4" /> Simpan Data Klinik</>}
        </button>
      </div>

      <div className="mt-10 p-8 border-2 border-dashed border-zinc-800 rounded-[3rem] text-center">
        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Informasi ini akan muncul pada Kop Surat & Kwitansi Pasien</p>
      </div>
    </motion.div>
  );
}

function PayrollConfig({ employees, users }: { employees: any[], users: any[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [roleRates, setRoleRates] = useState<Record<string, number>>({
    'dokter': 25000,
    'perawat': 15000,
    'admin': 10000,
    'keuangan': 10000,
    'owner': 0,
    'apoteker': 15000,
    'media': 12000,
    'PIC': 15000
  });
  const [savingDefault, setSavingDefault] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'payroll'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.roleRates) {
          setRoleRates(data.roleRates);
        } else if (data.defaultDoctorRate) {
          // Migration from previous single rate
          setRoleRates(prev => ({ ...prev, 'dokter': data.defaultDoctorRate }));
        }
      }
    });
    return () => unsub();
  }, []);

  const handleSaveDefault = async () => {
    setSavingDefault(true);
    try {
      await setDoc(doc(db, 'settings', 'payroll'), {
        roleRates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert('Tarif default role berhasil disimpan');
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan tarif default');
    } finally {
      setSavingDefault(false);
    }
  };

  const handleSyncEmployees = async () => {
    setIsSyncing(true);
    try {
      for (const user of users) {
        const existingEmployee = employees.find(e => e.userId === user.uid);
        const defaultRate = roleRates[user.role?.toLowerCase()] || 0;
        
        if (!existingEmployee) {
          // Add new employee record
          await addDoc(collection(db, 'employees'), {
            userId: user.uid,
            name: user.displayName,
            role: user.role,
            salary: 0,
            hourlyRate: defaultRate,
            status: 'active',
            joinedAt: serverTimestamp()
          });
        } else if (existingEmployee.role !== user.role) {
          // Update role if changed
          await updateDoc(doc(db, 'employees', existingEmployee.id), {
            role: user.role,
            updatedAt: serverTimestamp()
          });
        }
      }
      alert('Sinkronisasi anggota tim ke Payroll berhasil');
    } catch (e) {
      console.error(e);
      alert('Gagal melakukan sinkronisasi');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateRate = async (id: string) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'employees', id), {
        hourlyRate: rate,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
      alert('Tarif per jam berhasil diperbarui');
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui tarif');
    } finally {
      setSaving(false);
    }
  };

  // Sort employees by role and name
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    return a.name.localeCompare(b.name);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-20">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Konfigurasi Tarif & Payroll</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Atur rate jasa per jam untuk setiap peran/staff</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={handleSyncEmployees}
            disabled={isSyncing}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 border border-zinc-700"
          >
            {isSyncing ? (
              <div className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Sync Anggota Tim
          </button>
          
          <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800 flex flex-wrap items-center gap-6">
            {Object.entries(roleRates).map(([role, r]) => (
              <div key={role} className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{role}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold text-zinc-500">Rp</span>
                  <input 
                    type="number" 
                    value={r}
                    onChange={(e) => setRoleRates(prev => ({ ...prev, [role]: Number(e.target.value) }))}
                    className="bg-transparent border-none p-0 text-xs font-black text-emerald-500 font-mono w-16 focus:ring-0"
                  />
                </div>
              </div>
            ))}
            <button 
              onClick={handleSaveDefault}
              disabled={savingDefault}
              className="p-2.5 bg-emerald-600/10 text-emerald-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border border-emerald-500/20"
              title="Simpan Default Rate"
            >
              {savingDefault ? <div className="w-4 h-4 border-2 border-zinc-300 border-t-emerald-500 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 shadow-2xl rounded-[2.5rem] border border-zinc-800 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Nama Staf</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Peran / Role</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Tarif Per Jam (Rp)</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sortedEmployees.map((staff) => (
              <tr key={staff.id} className="hover:bg-zinc-800/20 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-black text-zinc-400 group-hover:text-white transition-colors">
                      {staff.name?.charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-zinc-200">{staff.name}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                    staff.role === 'owner' ? "bg-amber-500/10 text-amber-500" :
                    staff.role === 'admin' ? "bg-blue-500/10 text-blue-500" :
                    staff.role === 'keuangan' ? "bg-purple-500/10 text-purple-500" :
                    staff.role === 'dokter' ? "bg-emerald-500/10 text-emerald-500" :
                    staff.role === 'apoteker' ? "bg-pink-500/10 text-pink-500" :
                    staff.role === 'media' ? "bg-sky-500/10 text-sky-500" :
                    staff.role === 'PIC' ? "bg-orange-500/10 text-orange-500" :
                    "bg-zinc-800 text-zinc-400"
                  )}>
                    {staff.role}
                  </span>
                </td>
                <td className="px-8 py-5">
                  {editingId === staff.id ? (
                    <input 
                      type="number" 
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-black text-emerald-500 font-mono outline-none focus:ring-2 focus:ring-emerald-500 w-32"
                      autoFocus
                    />
                  ) : (
                    <div className="flex flex-col">
                       <span className="text-sm font-black text-emerald-500 font-mono">
                        Rp {(staff.hourlyRate || 0).toLocaleString()}
                      </span>
                      {staff.updatedAt && (
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                          Update: {staff.updatedAt?.toDate ? staff.updatedAt.toDate().toLocaleDateString() : new Date(staff.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-8 py-5 text-right">
                  {editingId === staff.id ? (
                    <div className="flex justify-end gap-2">
                       <button 
                        onClick={() => handleUpdateRate(staff.id)}
                        disabled={saving}
                        className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditingId(staff.id);
                        setRate(staff.hourlyRate || 0);
                      }}
                      className="p-2 bg-zinc-800/50 text-zinc-500 rounded-lg hover:text-white hover:bg-zinc-800 transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sortedEmployees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center text-zinc-600 italic text-xs">
                  Tidak ada staf yang terdaftar. Klik Sync untuk mengimpor dari daftar pengguna.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-emerald-600/5 border border-emerald-500/10 rounded-[2rem] flex items-start gap-4">
          <div className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Sinkronisasi Kehadiran</h4>
            <p className="text-[10px] font-medium text-zinc-500 leading-relaxed">
              Tarif ini otomatis dikalikan dengan jam kerja di menu Absensi untuk komponen 'Uang Duduk' di Payroll.
            </p>
          </div>
        </div>
        <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-[2rem] flex items-start gap-4">
          <div className="p-3 bg-blue-600/10 text-blue-500 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Manajemen Otomatis</h4>
            <p className="text-[10px] font-medium text-zinc-500 leading-relaxed">
              Gunakan tombol 'Sync Anggota Tim' untuk memastikan semua user baru terdaftar di sistem payroll dengan rate default peran mereka.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AttendanceManagement() {
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    hoursWorked: 0,
    overtimeHours: 0,
    overtimeStatus: 'pending',
    overtimeNotes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'attendance'),
      orderBy('clockIn', 'desc'),
      limit(150)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Error fetching attendance records:', error);
    });
    return () => unsub();
  }, []);

  const handleResetAttendance = async (id: string, name: string, date: string) => {
    if (!confirm(`Apakah Anda yakin ingin me-reset (menghapus) absensi ${name} pada tanggal ${date}? Staff ini akan dapat melakukan clock-in ulang setelah data di-reset.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'attendance', id));
      alert(`Absensi untuk ${name} pada ${date} berhasil di-reset.`);
    } catch (e) {
      console.error('Error deleting attendance:', e);
      alert('Gagal me-reset absensi.');
    }
  };

  const handleOpenEdit = (record: any) => {
    setEditingRecord(record);
    setEditForm({
      hoursWorked: record.hoursWorked || 0,
      overtimeHours: record.overtimeHours || 0,
      overtimeStatus: record.overtimeStatus || 'pending',
      overtimeNotes: record.overtimeNotes || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setSubmitting(true);
    try {
      // Recalc wage using the employee's hourly rate or default rate
      let updatedWage = editingRecord.calculatedWage || 0;
      if (editForm.hoursWorked !== editingRecord.hoursWorked) {
        const prevHours = editingRecord.hoursWorked || 1;
        const prevWage = editingRecord.calculatedWage || 0;
        const estimatedHourlyRate = prevHours > 0 ? (prevWage / prevHours) : 20000;
        updatedWage = Math.round(editForm.hoursWorked * estimatedHourlyRate);
      }

      await updateDoc(doc(db, 'attendance', editingRecord.id), {
        hoursWorked: Number(editForm.hoursWorked),
        overtimeHours: Number(editForm.overtimeHours),
        overtimeStatus: editForm.overtimeStatus,
        overtimeNotes: editForm.overtimeNotes,
        calculatedWage: updatedWage,
        updatedAt: serverTimestamp()
      });
      alert('Berhasil memperbarui data absensi & lembur.');
      setEditingRecord(null);
    } catch (e) {
      console.error('Error editing attendance details:', e);
      alert('Gagal memperbarui data absensi.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesName = r.userName?.toLowerCase().includes(search.toLowerCase());
    const matchesDate = selectedDate ? r.date === selectedDate : true;
    return matchesName && matchesDate;
  });

  const formatTime = (date: any) => {
    if (!date) return '--:--';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 w-full"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight">Kelola Absensi & Lembur</h3>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Reset absensi salah & persetujuan lembur staf</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama staff..."
              className="w-full sm:w-60 pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold"
            />
          </div>
          <input 
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono font-bold"
          />
          {selectedDate && (
            <button 
              onClick={() => setSelectedDate('')}
              className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
            >
              Reset Tgl
            </button>
          )}
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-900/50">
                <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-wider">Nama Staf</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-wider">Jam Masuk / Keluar</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-wider text-center">Durasi Kerja</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-wider">Lembur (Jam & Ket)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-wider text-center">Status Lembur</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-500 tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-white block">{record.userName}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                      {record.status === 'present' ? 'Tepat Waktu' : 'Terlambat'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-zinc-400">
                    {typeof record.date === 'object' && record.date ? (record.date.toDate ? record.date.toDate().toLocaleDateString('id-ID') : String(record.date)) : record.date}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-300">
                    <span className="font-mono text-[11px] bg-zinc-900 px-2 py-1 rounded border border-zinc-800">{formatTime(record.clockIn)}</span>
                    <span className="mx-2 text-zinc-600">→</span>
                    <span className="font-mono text-[11px] bg-zinc-900 px-2 py-1 rounded border border-zinc-800">{formatTime(record.clockOut)}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs font-black text-blue-500">
                    {record.hoursWorked ? `${record.hoursWorked.toFixed(1)} H` : '-'}
                  </td>
                  <td className="px-6 py-4 max-w-[200px]">
                    {record.overtimeHours ? (
                      <div>
                        <span className="text-xs font-black text-amber-500 font-mono block">+{record.overtimeHours.toFixed(1)} Jam</span>
                        <span className="text-[10px] text-zinc-500 italic block truncate" title={record.overtimeNotes}>{record.overtimeNotes || 'Tak ada catatan'}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-600 italic">Tidak ada</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {record.overtimeHours ? (
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest inline-flex",
                        record.overtimeStatus === 'approved' ? "bg-emerald-500/10 text-emerald-500" :
                        record.overtimeStatus === 'rejected' ? "bg-red-500/10 text-red-500" :
                        "bg-amber-500/10 text-amber-500"
                      )}>
                        {record.overtimeStatus === 'approved' ? 'DISETUJUI' :
                         record.overtimeStatus === 'rejected' ? 'DITOLAK' :
                         'PENDING'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenEdit(record)}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold transition-all"
                        title="Verifikasi Lembur / Edit Absen"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleResetAttendance(record.id, record.userName, record.date)}
                        className="p-2 bg-red-950/30 hover:bg-red-900/40 text-red-500 rounded-lg text-xs font-bold transition-all border border-red-900/30"
                        title="Reset (Hapus) Absensi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-zinc-600 italic text-xs">
                    Tidak ada data absensi yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-3xl">
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">💡 Petunjuk Penggunaan</h4>
        <ul className="space-y-2 text-[10px] text-zinc-500 leading-relaxed list-disc list-inside">
          <li>Tombol tong sampah (<Trash2 className="w-3.5 h-3.5 inline mx-0.5" />) digunakan untuk melakukan <strong>Reset Absen</strong>. Data absen hari tersebut akan dihapus, sehingga staf bersangkutan bisa melakukan Clock In ulang.</li>
          <li>Tombol pensil (<Edit3 className="w-3.5 h-3.5 inline mx-0.5" />) digunakan untuk <strong>Menyetujui/Menolak Lembur</strong> serta membetulkan jumlah jam kerja jika ada kesalahan ketik/sistem.</li>
          <li>Semua jam lembur yang disetujui akan diakumulasikan secara otomatis dengan tarif 1.5x dari rate jam standar saat Anda membuat slip gaji di modul Payroll.</li>
        </ul>
      </div>

      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <div>
                <h4 className="text-md font-black text-white">{editingRecord.userName}</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  {typeof editingRecord.date === 'object' && editingRecord.date ? (editingRecord.date.toDate ? editingRecord.date.toDate().toLocaleDateString('id-ID') : String(editingRecord.date)) : editingRecord.date}
                </p>
              </div>
              <button onClick={() => setEditingRecord(null)} className="p-1 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest pl-1">Durasi Kerja Utama (Jam)</label>
                <input 
                  type="number"
                  step="0.1"
                  value={editForm.hoursWorked}
                  onChange={e => setEditForm({...editForm, hoursWorked: Number(e.target.value)})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none font-mono font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest pl-1">Durasi Kerja Lembur (Jam)</label>
                <input 
                  type="number"
                  step="0.1"
                  value={editForm.overtimeHours}
                  onChange={e => setEditForm({...editForm, overtimeHours: Number(e.target.value)})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none font-mono font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest pl-1">Persetujuan Lembur</label>
                <select 
                  value={editForm.overtimeStatus}
                  onChange={e => setEditForm({...editForm, overtimeStatus: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none font-bold"
                >
                  <option value="pending font-bold">PENDING (MENUNGGU)</option>
                  <option value="approved font-bold">DISETUJUI (APPROVED)</option>
                  <option value="rejected font-bold">DITOLAK (REJECTED)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest pl-1">Alasan / Catatan Lembur</label>
                <textarea 
                  value={editForm.overtimeNotes}
                  onChange={e => setEditForm({...editForm, overtimeNotes: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:ring-2 focus:ring-blue-600 outline-none resize-none font-bold"
                  rows={2}
                  placeholder="Deskripsi kegiatan lembur..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 font-bold">
              <button 
                onClick={() => setEditingRecord(null)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl active:scale-95 transition-all text-center"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 text-center"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function CustomizationManagement() {
  const { customizationSettings, updateCustomizationSettings, isQuotaExceeded } = useData();
  const [localVibe, setLocalVibe] = useState(customizationSettings?.loginVibe || 'minimal_slate');
  const [localSubtitle, setLocalSubtitle] = useState(customizationSettings?.loginSubtitle || 'Operasional Keuangan Digital | AI Studio Secure Edition');
  const [localColor, setLocalColor] = useState(customizationSettings?.primaryBrandColor || '#3B82F6');
  const [localHideQuickLogin, setLocalHideQuickLogin] = useState(customizationSettings?.hideQuickLogin || false);
  const [localShowCredit, setLocalShowCredit] = useState(customizationSettings?.showDeveloperCredit !== false);
  const [saving, setSaving] = useState(false);

  const [localSimActive, setLocalSimActive] = useState(() => {
    return localStorage.getItem('force_local_simulation') === 'true';
  });

  const [localDataDetails, setLocalDataDetails] = useState<{
    hasLocalData: boolean;
    productsCount: number;
    categoriesCount: number;
    salesCount: number;
    usersCount: number;
    employeesCount: number;
  }>({
    hasLocalData: false,
    productsCount: 0,
    categoriesCount: 0,
    salesCount: 0,
    usersCount: 0,
    employeesCount: 0,
  });

  const [migrating, setMigrating] = useState(false);
  const [migrationSucceeded, setMigrationSucceeded] = useState(false);
  const [migrationStats, setMigrationStats] = useState('');

  const checkLocalData = () => {
    try {
      const prodRaw = localStorage.getItem('clinic_simdb_products');
      const catRaw = localStorage.getItem('clinic_simdb_categories');
      const salesRaw = localStorage.getItem('clinic_simdb_sales');
      const usersRaw = localStorage.getItem('clinic_simdb_users');
      const empRaw = localStorage.getItem('clinic_simdb_employees');

      const products = prodRaw ? JSON.parse(prodRaw) : [];
      const categories = catRaw ? JSON.parse(catRaw) : [];
      const sales = salesRaw ? JSON.parse(salesRaw) : [];
      const users = usersRaw ? JSON.parse(usersRaw) : [];
      const employees = empRaw ? JSON.parse(empRaw) : [];

      const totalCount = products.length + categories.length + sales.length + users.length + employees.length;
      if (totalCount > 0) {
        setLocalDataDetails({
          hasLocalData: true,
          productsCount: products.length,
          categoriesCount: categories.length,
          salesCount: sales.length,
          usersCount: users.length,
          employeesCount: employees.length,
        });
      }
    } catch (e) {
      console.error("Gagal membaca database offline:", e);
    }
  };

  useEffect(() => {
    checkLocalData();
  }, []);

  const handleMigrateToCloud = async () => {
    if (!confirm('Apakah Anda yakin ingin memindahkan seluruh data dari database offline lokal Anda ke Cloud Server? Tindakan ini akan mengunggah ' + 
      `${localDataDetails.productsCount} Produk, ${localDataDetails.categoriesCount} Kategori, ${localDataDetails.salesCount} Transaksi Kasir, ` +
      `${localDataDetails.usersCount} Pengguna, dan ${localDataDetails.employeesCount} Karyawan ke server cloud Anda.`)) return;

    setMigrating(true);
    try {
      let count = 0;
      const collectionsToMigrate = [
        { key: 'clinic_simdb_categories', colName: 'categories' },
        { key: 'clinic_simdb_products', colName: 'products' },
        { key: 'clinic_simdb_users', colName: 'users' },
        { key: 'clinic_simdb_employees', colName: 'employees' },
        { key: 'clinic_simdb_sales', colName: 'sales' },
        { key: 'clinic_simdb_boards', colName: 'boards' },
        { key: 'clinic_simdb_role_permissions', colName: 'role_permissions' },
        { key: 'clinic_simdb_attendance', colName: 'attendance' },
      ];

      for (const item of collectionsToMigrate) {
        const raw = localStorage.getItem(item.key);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            for (const docData of arr) {
              const docId = docData.id || docData.uid;
              if (docId) {
                const { id, ...cleanData } = docData;
                await setDoc(doc(db, item.colName, docId), cleanData, { merge: true });
                count++;
              }
            }
          }
        }
      }

      setMigrationSucceeded(true);
      setMigrationStats(`Berhasil memigrasikan ${count} item offline ke Firestore Cloud.`);
      alert(`Sukses! Semua data offline (${count} item) telah berhasil disinkronisasikan ke Database Cloud Firestore.`);
      window.location.reload();
    } catch (e) {
      console.error("Gagal migrasi data offline ke cloud:", e);
      alert('Gagal melakukan sinkronisasi data: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMigrating(false);
    }
  };

  const toggleLocalSimulation = () => {
    const nextVal = !localSimActive;
    setLocalSimActive(nextVal);
    localStorage.setItem('force_local_simulation', nextVal ? 'true' : 'false');
    alert(nextVal 
      ? 'Mode Hubungkan Ke Database Lokal Offline diaktifkan! Aplikasi akan dimuat ulang.' 
      : 'Mode Hubungkan Ke Database Lokal Offline dinonaktifkan! Aplikasi akan dimuat ulang.'
    );
    window.location.reload();
  };

  useEffect(() => {
    if (customizationSettings) {
      setLocalVibe(customizationSettings.loginVibe || 'minimal_slate');
      setLocalSubtitle(customizationSettings.loginSubtitle || 'Operasional Keuangan Digital | AI Studio Secure Edition');
      setLocalColor(customizationSettings.primaryBrandColor || '#3B82F6');
      setLocalHideQuickLogin(customizationSettings.hideQuickLogin || false);
      setLocalShowCredit(customizationSettings.showDeveloperCredit !== false);
    }
  }, [customizationSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCustomizationSettings({
        loginVibe: localVibe,
        loginSubtitle: localSubtitle,
        primaryBrandColor: localColor,
        hideQuickLogin: localHideQuickLogin,
        showDeveloperCredit: localShowCredit
      });
      alert('Kustomisasi tampilan berhasil disimpan! Perubahan akan langsung diterapkan.');
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan kustomisasi tampilan');
    } finally {
      setSaving(false);
    }
  };

  const vibes = [
    { id: 'minimal_slate', name: 'Minimal Slate Dark', desc: 'Desain ultra-bersih dengan bayangan dalam dan estetika arsitektural minimalis.', previewClass: 'from-zinc-950 to-zinc-900 border-zinc-850' },
    { id: 'cosmic_space', name: 'Space Cosmic Glow', desc: 'Gaya kosmik mempesona berlatar indigo mendalam dibalut debu galaksi dan gradien nebula halus.', previewClass: 'from-zinc-950 via-slate-950 to-indigo-950 border-indigo-900/40' },
    { id: 'clinic_emerald', name: 'Mint Emerald Calmness', desc: 'Tema higienis menenangkan dipadu dengan gradien hijau dental untuk kenyamanan ekstra.', previewClass: 'from-teal-950/40 via-emerald-950/20 to-zinc-950 border-emerald-900/30' },
    { id: 'warm_sunset', name: 'Warm Golden Sunset', desc: 'Estetika hangat bercahaya keemasan memberikan sambutan ramah nan elegan untuk para staff.', previewClass: 'from-amber-950/35 via-zinc-950 to-zinc-950 border-amber-900/20 shadow-lg' },
    { id: 'high_contrast_glass', name: 'Corporate Glass Portal', desc: 'Desain profesional bertekstur kaca transparan, ideal untuk portal klinik modern papan atas.', previewClass: 'from-zinc-900 via-zinc-950 to-zinc-900 border-zinc-700/50' }
  ];

  const brandColors = [
    { value: '#3B82F6', name: 'Blue Sky' },
    { value: '#10B981', name: 'Emerald Sage' },
    { value: '#8B5CF6', name: 'Amethyst Purple' },
    { value: '#EC4899', name: 'Rose Pink' },
    { value: '#F59E0B', name: 'Golden Amber' },
    { value: '#06B6D4', name: 'Cyan Waters' },
    { value: '#EF4444', name: 'Radical Red' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto py-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 sm:p-10 space-y-8 shadow-2xl">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight mb-2">Desain Kustomisasi Tampilan</h3>
          <p className="text-xs text-zinc-500 font-medium leading-relaxed">Atur gaya visual halaman login, warna identitas digital, dan kontrol akun demo cepat secara terintegrasi.</p>
        </div>

        <div className="space-y-6">
          {/* VIBE OPTIONS */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">1. Tema Vibe Login Screen</label>
            <div className="grid grid-cols-1 gap-3">
              {vibes.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setLocalVibe(v.id)}
                  className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all hover:border-zinc-500 ${localVibe === v.id ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 bg-zinc-950/60'}`}
                >
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${localVibe === v.id ? 'bg-blue-500' : 'bg-zinc-700'}`} />
                      <span className="text-xs font-black text-zinc-200">{v.name}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 font-medium">{v.desc}</p>
                  </div>
                  <div className={`w-12 h-8 rounded-lg bg-gradient-to-br ${v.previewClass} border shrink-0`} />
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* PRIMARY BRAND COLOR */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">2. Warna Identitas Utama</label>
            <div className="flex flex-wrap gap-2">
              {brandColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setLocalColor(c.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${localColor === c.value ? 'bg-zinc-900 border-zinc-200 text-white font-extrabold scale-105' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  <div className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ backgroundColor: c.value }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* LOGIN SUBTITLE TEXT */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">3. Teks Subtitle / Pengumuman Login</label>
            <input
              type="text"
              value={localSubtitle}
              onChange={(e) => setLocalSubtitle(e.target.value)}
              placeholder="Operasional Keuangan Digital | AI Studio Secure Edition"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[9px] text-zinc-600 font-bold italic">*Teks ini akan ditampilkan di bawah Judul Klinik utama pada panel masuk.</p>
          </div>

          <div className="h-px bg-zinc-850" />

          {/* QUICK LOGIN HIDE OPTION */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">4. Pengaturan Sistem Keamanan & UI</label>
            <div className="space-y-3 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/60">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={localHideQuickLogin}
                  onChange={(e) => setLocalHideQuickLogin(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-800 text-blue-600 bg-zinc-950 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-zinc-350 group-hover:text-white transition-colors">Sembunyikan Masuk Cepat (Akun Demo)</span>
                  <p className="text-[10px] text-zinc-500 font-medium mt-0.5 leading-relaxed">Berfungsi untuk menonaktifkan dan menyembunyikan tombol demo (Admin, Owner, dll) dari halaman masuk, mewajibkan staff login menggunakan Akun Email resmi mereka.</p>
                </div>
              </label>

              <div className="h-px bg-zinc-850" />

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={localShowCredit}
                  onChange={(e) => setLocalShowCredit(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-800 text-blue-600 bg-zinc-950 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-zinc-350 group-hover:text-white transition-colors">Tampilkan Label Developer & Versi</span>
                  <p className="text-[10px] text-zinc-500 font-medium mt-0.5 leading-relaxed">Menampilkan label tag "Versi 2.2 / AI Studio Secure Edition" di bagian footer login screen.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* DATABASE STATUS & MANAGE OFFLINE SIMULATION */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">5. Status Database & Simulasi Offline</label>
            <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isQuotaExceeded || localSimActive ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">
                    {isQuotaExceeded || localSimActive ? 'Database: Mode Simulasi Offline Aktif' : 'Database: Mode Cloud Terhubung'}
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                    {isQuotaExceeded || localSimActive 
                      ? 'Proses simpan & mutasi diisolasi aman di database lokal browser tanpa kendala limitasi.'
                      : 'Koneksi Firestore normal, tersinkronisasi instan dengan server cloud Google Cloud.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-850 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-zinc-350">Hubungkan Mode Offline Manual</span>
                    <p className="text-[9.5px]/relaxed text-zinc-500 font-medium mt-0.5 max-w-[420px]">
                      Gunakan ini jika ingin mengisolasi database agar berjalan sepenuhnya offline di browser demi performa instan tanpa membebani kuota data Firebase.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleLocalSimulation}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${localSimActive ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSimActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {!localSimActive && localDataDetails.hasLocalData && (
                <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-blue-400 font-extrabold text-[11px] block uppercase tracking-wider">📦 MITIGASI DATA OFFLINE ➔ CLOUD FIRESTORE</span>
                    <p className="text-[10.5px]/relaxed text-zinc-300 font-medium">
                      Sistem mendeteksi data yang sebelumnya Anda buat saat berada di <strong>Mode Offline / Simulasi</strong> (<strong>{localDataDetails.productsCount}</strong> Produk, <strong>{localDataDetails.categoriesCount}</strong> Kategori, <strong>{localDataDetails.salesCount}</strong> Transaksi, dan <strong>{localDataDetails.employeesCount}</strong> Anggota Staf). 
                      <br className="mb-1" />
                      Ketika baru mengaktifkan mode Cloud, database online Google Cloud Anda masih kosong. Silakan pindahkan data offline lama Anda ke server Cloud agar tersinkronisasi sempurna dengan sistem online.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleMigrateToCloud}
                    disabled={migrating}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/10 transition-colors flex items-center justify-center gap-2 active:scale-95 duration-200 cursor-pointer"
                  >
                    {migrating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sedang Memindahkan Data Ke Server Cloud...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Migrasikan Data Offline ke Cloud Sekarang
                      </>
                    )}
                  </button>
                  <p className="text-[9px] text-zinc-500 text-center font-bold">
                    *Catatan: Tombol ini aman diklik kapan saja untuk menyelaraskan data offline lokal ke server online baru Anda.
                  </p>
                </div>
              )}

              {(isQuotaExceeded || localSimActive) && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px]/relaxed text-zinc-400">
                  <span className="text-amber-500 font-bold block mb-1">Pemberitahuan Sistem Mode Offline:</span>
                  Status limitasi harian free-tier Google Cloud Firestore tercapai atau mode manual aktif. Klinik telah dialihkan secara aman menggunakan database offline lokal otomatis di browser Anda. Semua pencatatan transaksi kasir, input KPI, odontogram, resep obat, & payroll tetap berjalan lancar!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-xl active:scale-95 transition-all text-center flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Simpan Konfigurasi
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
