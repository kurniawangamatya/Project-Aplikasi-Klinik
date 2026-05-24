import React, { useEffect, useState } from 'react';
import { db, collection, onSnapshot, doc, updateDoc, handleFirestoreError, OperationType, setDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { UserProfile, UserRole, AuditLog } from '../types';
import { Shield, Mail, User as UserIcon, CheckCircle, Plus, Send, X, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TeamHub() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('owner');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const canManageTeam = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'PIC';

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeView, setActiveView] = useState<'members' | 'audit'>('members');

  const logAction = async (action: string, targetUserId: string, targetUserName: string, details: string) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        adminId: profile.uid,
        adminName: profile.displayName,
        action,
        targetUserId,
        targetUserName,
        details,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Failed to create audit log:', e);
    }
  };

  useEffect(() => {
    if (!canManageTeam) return;
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(100)), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(50));
    const unsubLogs = onSnapshot(q, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, [profile, canManageTeam]);

  const updateRole = async (userId: string, role: UserRole) => {
    if (!canManageTeam) return;
    const targetUser = users.find(u => u.uid === userId);
    if (!targetUser) return;

    try {
      const oldRole = targetUser.role;
      await updateDoc(doc(db, 'users', userId), { role });
      await logAction('UPDATE_ROLE', userId, targetUser.displayName, `Role updated from ${oldRole} to ${role}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const deleteUser = async (userId: string) => {
    if (!canManageTeam || userId === profile?.uid) return;
    const targetUser = users.find(u => u.uid === userId);
    if (!targetUser) return;

    setDeletingUserId(userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
      await logAction('DELETE_USER', userId, targetUser.displayName, `User removed: ${targetUser.email}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${userId}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam || !inviteEmail) return;
    
    setIsInviting(true);
    setInviteError(null);

    try {
      // Check if user already exists
      const emailLower = inviteEmail.toLowerCase().trim();
      const existingUser = users.find(u => u.email.toLowerCase() === emailLower);
      
      if (existingUser) {
        setInviteError('Pengguna dengan email ini sudah ada di dalam tim.');
        setIsInviting(false);
        return;
      }

      // Create a "pending" user record
      // We use a specific ID prefix so we can identify these as pending invites if needed
      // Or just use addDoc to get a random ID
      const newUserId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newProfile: UserProfile = {
        uid: newUserId,
        email: emailLower,
        displayName: emailLower.split('@')[0],
        role: inviteRole,
        photoURL: undefined
      };

      await setDoc(doc(db, 'users', newUserId), newProfile);
      await logAction('INVITE_MEMBER', newUserId, newProfile.displayName, `Invited with role: ${inviteRole}`);
      
      setInviteEmail('');
      setShowInviteModal(false);
      setIsInviting(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'users');
      setInviteError('Gagal mengirim undangan. Silakan coba lagi.');
      setIsInviting(false);
    }
  };

  if (!canManageTeam) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 bg-zinc-950">
        <div className="text-center p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800">
          <Shield className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-black text-white mb-2">Akses Dibatasi</h3>
          <p className="text-sm font-medium text-zinc-500 max-w-xs">Manajemen tim hanya tersedia untuk Pemilik Clinic atau Administrator.</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-zinc-950">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">Pusat Tim</h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveView('members')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-all",
                  activeView === 'members' ? "text-blue-500" : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                Anggota
              </button>
              <div className="w-1 h-1 rounded-full bg-zinc-800" />
              <button 
                onClick={() => setActiveView('audit')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-all",
                  activeView === 'audit' ? "text-blue-500" : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                Jejak Audit
              </button>
            </div>
          </div>
          
          {activeView === 'members' && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
              >
                <Plus className="w-4 h-4" />
                Undang Anggota
              </button>

              <div className="relative group">
                <input 
                  type="text"
                  placeholder="Cari..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-48 bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold"
                />
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
              </div>
            </div>
          )}
        </header>

        <AnimatePresence>
          {showInviteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowInviteModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white">Undang Anggota Baru</h3>
                  <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>

                <form onSubmit={handleInvite} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Alamat Email</label>
                    <div className="relative group">
                      <input 
                        required
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="rekan@perusahaan.com"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium"
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Tugaskan Peran</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {(['admin', 'keuangan', 'owner', 'dokter', 'perawat', 'apoteker', 'media', 'PIC'] as UserRole[]).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInviteRole(r)}
                          className={cn(
                            "py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                            inviteRole === r 
                              ? "bg-blue-600/10 border-blue-600 text-blue-500" 
                              : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {inviteError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                      <p className="text-xs font-bold text-red-500 text-center">{inviteError}</p>
                    </div>
                  )}

                  <button 
                    disabled={isInviting || !inviteEmail}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20"
                  >
                    {isInviting ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Kirim Undangan
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeView === 'members' ? (
            <motion.div 
              key="members"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid gap-4"
            >
              {filteredUsers.length === 0 ? (
                <div className="p-12 text-center bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-zinc-800">
                  <p className="text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em]">Tidak ada anggota yang ditemukan sesuai pencarian Anda</p>
                </div>
              ) : (
                filteredUsers.map(u => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={u.uid} 
                    className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between group hover:border-zinc-700 transition-all gap-6 shadow-xl shadow-black/20"
                  >
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <img 
                          src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=3b82f6&color=fff`} 
                          className="w-14 h-14 rounded-2xl border border-zinc-800 shadow-inner group-hover:scale-105 transition-transform"
                          alt=""
                        />
                        {u.role === 'admin' && (
                          <div className="absolute -top-2 -right-2 bg-blue-600 p-1 rounded-lg border-2 border-zinc-900 shadow-lg" title="Admin">
                            <Shield className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white flex items-center gap-2">
                          {u.displayName}
                          {u.uid === profile?.uid && <span className="px-2 py-0.5 bg-zinc-800 rounded text-[8px] uppercase tracking-widest text-zinc-500">Anda</span>}
                        </h4>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight flex items-center gap-1.5">
                          <Mail className="w-3 h-3" />
                          {u.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-end sm:self-center">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Peran Aktif</span>
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1 rounded-lg border",
                          u.role === 'admin' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" : 
                          u.role === 'keuangan' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : 
                          u.role === 'dokter' ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-500" :
                          u.role === 'perawat' ? "bg-orange-500/10 border-orange-500/20 text-orange-500" :
                          u.role === 'apoteker' ? "bg-pink-500/10 border-pink-500/20 text-pink-500" :
                          u.role === 'media' ? "bg-sky-500/10 border-sky-500/20 text-sky-500" :
                          u.role === 'PIC' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                          "bg-purple-500/10 border-purple-500/20 text-purple-500"
                        )}>
                          <span className="text-[10px] font-black uppercase tracking-tight">{u.role}</span>
                        </div>
                        {u.role === 'dokter' && (
                          <div className="mt-2 group/spec relative">
                            <input 
                              type="text" 
                              placeholder="Spesialisasi..."
                              defaultValue={u.specialization || ''}
                              onBlur={async (e) => {
                                const newSpec = e.target.value;
                                if (newSpec !== (u.specialization || '')) {
                                  try {
                                    await updateDoc(doc(db, 'users', u.uid), { specialization: newSpec });
                                    await logAction('UPDATE_SPEC', u.uid, u.displayName, `Specialization updated: ${newSpec}`);
                                  } catch (e) {
                                    handleFirestoreError(e, OperationType.UPDATE, `users/${u.uid}`);
                                  }
                                }
                              }}
                              className="text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none placeholder:text-zinc-700 w-24 text-right transition-all"
                            />
                          </div>
                        )}
                      </div>

                      <div className="h-10 w-px bg-zinc-800 hidden sm:block" />

                      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 max-w-[200px] sm:max-w-none">
                        <RoleButton active={u.role === 'owner'} onClick={() => updateRole(u.uid, 'owner')} label="Owner" color="purple" />
                        <RoleButton active={u.role === 'keuangan'} onClick={() => updateRole(u.uid, 'keuangan')} label="Finance" color="emerald" />
                        <RoleButton active={u.role === 'dokter'} onClick={() => updateRole(u.uid, 'dokter')} label="Dokter" color="indigo" />
                        <RoleButton active={u.role === 'perawat'} onClick={() => updateRole(u.uid, 'perawat')} label="Perawat" color="orange" />
                        <RoleButton active={u.role === 'admin'} onClick={() => updateRole(u.uid, 'admin')} label="Admin" color="blue" />
                        <RoleButton active={u.role === 'apoteker'} onClick={() => updateRole(u.uid, 'apoteker')} label="Apoteker" color="pink" />
                        <RoleButton active={u.role === 'media'} onClick={() => updateRole(u.uid, 'media')} label="Media" color="sky" />
                        <RoleButton active={u.role === 'PIC'} onClick={() => updateRole(u.uid, 'PIC')} label="PIC" color="amber" />
                      </div>

                      <div className="h-10 w-px bg-zinc-800 hidden sm:block" />

                      {u.uid !== profile?.uid && (
                        <button 
                          onClick={() => deleteUser(u.uid)}
                          className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 shadow-lg shadow-red-900/10"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="audit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {auditLogs.length === 0 ? (
                <div className="p-12 text-center bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-zinc-800">
                  <p className="text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em]">Tidak ada log audit ditemukan</p>
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <h4 className="text-sm font-black text-white truncate">
                          {log.adminName} <span className="text-zinc-600 mx-1 font-bold">→</span> {log.action}
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-600 whitespace-nowrap">
                          {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Baru saja'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                        Interaksi dengan <span className="text-zinc-100 font-bold">{log.targetUserName}</span>: {log.details}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoleButton({ active, onClick, label, color }: { active: boolean, onClick: () => void, label: string, color: string }) {
  const colorMap: any = {
    blue: active ? 'bg-blue-600 text-white' : 'hover:bg-blue-500/10 text-zinc-500',
    emerald: active ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10 text-zinc-500',
    purple: active ? 'bg-purple-600 text-white' : 'hover:bg-purple-500/10 text-zinc-500',
    indigo: active ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-500/10 text-zinc-500',
    orange: active ? 'bg-orange-600 text-white' : 'hover:bg-orange-500/10 text-zinc-500',
    pink: active ? 'bg-pink-600 text-white' : 'hover:bg-pink-500/10 text-zinc-500',
    sky: active ? 'bg-sky-600 text-white' : 'hover:bg-sky-500/10 text-zinc-500',
    amber: active ? 'bg-amber-600 text-white' : 'hover:bg-amber-500/10 text-zinc-500'
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border border-transparent",
        colorMap[color],
        active && "shadow-lg"
      )}
    >
      {label}
    </button>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
