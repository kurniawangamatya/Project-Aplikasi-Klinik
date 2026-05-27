import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut, doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc, onSnapshot, serverTimestamp, limit } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginError: string | null;
  setLoginError: (error: string | null) => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerOffline: (data: {
    displayName: string;
    email: string;
    password: string;
    role: UserRole;
    specialization?: string;
    salary?: number;
    hourlyRate?: number;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (userId: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [simulatedUser, setSimulatedUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('clinic_simulated_user');
      if (saved) {
        localStorage.setItem('force_local_simulation', 'true');
      }
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const setupProfileListener = (currentUser: any) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Use onSnapshot for real-time profile updates
      unsubProfile = onSnapshot(doc(db, 'users', currentUser.uid), async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          // Force admin role for the bootstrap user
          if (currentUser.email === 'kurniawangamatya37@gmail.com' && data.role !== 'admin') {
            await setDoc(doc(db, 'users', currentUser.uid), { role: 'admin' }, { merge: true });
            // The next snapshot will have the correct role
            return;
          }
          setProfile(data);
          try { localStorage.setItem('clinic_cache_profile', JSON.stringify(data)); } catch (e) {}
          setLoading(false);
        } else {
          // Check for pre-assigned profile (invitation)
          const q = query(collection(db, 'users'), where('email', '==', currentUser.email), limit(1));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            const pendingDoc = querySnap.docs[0];
            const pendingData = pendingDoc.data() as UserProfile;
            
            const newProfile: UserProfile = {
              ...pendingData,
              uid: currentUser.uid,
              displayName: currentUser.displayName || pendingData.displayName,
              photoURL: currentUser.photoURL || null
            };
            
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            if (pendingDoc.id !== currentUser.uid) {
              await deleteDoc(doc(db, 'users', pendingDoc.id));
            }

            // Synchronize employee record during pre-assigned login
            try {
              const empRef = doc(db, 'employees', pendingDoc.id);
              const empSnap = await getDoc(empRef);
              if (empSnap.exists()) {
                const empData = empSnap.data();
                await setDoc(doc(db, 'employees', currentUser.uid), {
                  ...empData,
                  userId: currentUser.uid,
                  id: currentUser.uid,
                  name: newProfile.displayName,
                  role: newProfile.role
                });
                if (pendingDoc.id !== currentUser.uid) {
                  await deleteDoc(empRef);
                }
              } else {
                const payrollSnap = await getDoc(doc(db, 'settings', 'payroll'));
                let defaultRate = 10000;
                if (payrollSnap.exists()) {
                  const rates = (payrollSnap.data() as any)?.roleRates || {};
                  defaultRate = rates[newProfile.role.toLowerCase()] || 10000;
                }
                await setDoc(doc(db, 'employees', currentUser.uid), {
                  userId: currentUser.uid,
                  id: currentUser.uid,
                  name: newProfile.displayName,
                  role: newProfile.role,
                  salary: 0,
                  hourlyRate: defaultRate,
                  status: 'active',
                  joinedAt: serverTimestamp()
                });
              }
            } catch (empSyncErr) {
              console.error("Employee sync during invitation check failed:", empSyncErr);
            }

            // Ensure role permissions exist
            try {
              const permRef = doc(db, 'role_permissions', newProfile.role);
              const permSnap = await getDoc(permRef);
              if (!permSnap.exists()) {
                await setDoc(permRef, {
                  navigation: ['overview', 'board', 'kpi'],
                  updatedAt: serverTimestamp()
                });
              }
            } catch (e) {
              console.error("Initialize role permissions failed", e);
            }
            // setProfile(newProfile); // onSnapshot will pick this up
          } else {
            // Truly new user
            const defaultRole: UserRole = currentUser.email === 'kurniawangamatya37@gmail.com' ? 'admin' : 'owner';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'User',
              role: defaultRole,
              photoURL: currentUser.photoURL || null
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            
            // Ensure role permissions exist
            try {
              const permRef = doc(db, 'role_permissions', defaultRole);
              const permSnap = await getDoc(permRef);
              if (!permSnap.exists()) {
                await setDoc(permRef, {
                  navigation: ['overview', 'board', 'kpi'],
                  updatedAt: serverTimestamp()
                });
              }
            } catch (e) {
              console.error("Initialize role permissions failed", e);
            }

            // Auto-sync to employees as well
            try {
              const payrollSnap = await getDoc(doc(db, 'settings', 'payroll'));
              let defaultRate = 0;
              if (payrollSnap.exists()) {
                const rates = (payrollSnap.data() as any)?.roleRates || {
                  'dokter': 25000,
                  'perawat': 15000,
                  'admin': 10000,
                  'keuangan': 10000,
                  'owner': 0,
                  'apoteker': 15000,
                  'media': 12000,
                  'PIC': 15000
                };
                defaultRate = rates[defaultRole.toLowerCase()] || 0;
              }
              
              await setDoc(doc(db, 'employees', currentUser.uid), {
                userId: currentUser.uid,
                name: newProfile.displayName,
                role: defaultRole,
                salary: 0,
                hourlyRate: defaultRate,
                status: 'active',
                joinedAt: serverTimestamp()
              });
            } catch (e) {
              console.error("Auto-sync employee failed", e);
            }
            // setProfile(newProfile); // onSnapshot will pick this up
          }
        }
      }, (error) => {
        console.error("Profile load onSnapshot error:", error);
        
        let cachedProfile: UserProfile | null = null;
        try {
          const saved = localStorage.getItem('clinic_cache_profile');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.uid === currentUser.uid) {
              cachedProfile = parsed as UserProfile;
            }
          }
        } catch (e) {}

        if (cachedProfile) {
          setProfile(cachedProfile);
        } else {
          const emailPrefix = currentUser.email ? currentUser.email.split('@')[0].toLowerCase() : 'admin';
          const fallbackRole: UserRole = ['admin', 'owner', 'keuangan', 'dokter', 'perawat', 'apoteker', 'media', 'PIC'].includes(emailPrefix) 
            ? (emailPrefix as UserRole) 
            : (currentUser.email === 'kurniawangamatya37@gmail.com' ? 'admin' : 'owner');
          
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || 'demo@klinik.com',
            displayName: currentUser.displayName || (emailPrefix.toUpperCase() + ' (Offline)') || 'Demo User',
            role: fallbackRole
          };
          setProfile(fallbackProfile);
        }
        setLoading(false);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        setupProfileListener(fbUser);
      } else if (simulatedUser) {
        setUser(simulatedUser);
        setupProfileListener(simulatedUser);
      } else {
        setUser(null);
        setupProfileListener(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, [simulatedUser]);

  const login = async () => {
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error && typeof error === 'object' && error.code) {
        setLoginError(error.code);
      } else if (error instanceof Error) {
        setLoginError(error.message);
      } else {
        setLoginError('Unknown auth error');
      }
    }
  };

  const loginWithEmailSimulated = async (email: string, password: any) => {
    const emailLower = email.trim().toLowerCase();
    let foundProfile: any = null;

    try {
      const q = query(collection(db, 'users'), where('email', '==', emailLower), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        foundProfile = snap.docs[0].data();
      }
    } catch (err) {
      console.warn("Firestore query failed for simulated auth, checking local storage cache:", err);
    }

    if (!foundProfile) {
      try {
        const cachedUsersRaw = localStorage.getItem('clinic_cache_users');
        if (cachedUsersRaw) {
          const cachedUsers = JSON.parse(cachedUsersRaw);
          if (Array.isArray(cachedUsers)) {
            foundProfile = cachedUsers.find((u: any) => u.email && u.email.toLowerCase() === emailLower);
          }
        }
      } catch (cacheErr) {
        console.error("Local storage users cache read error:", cacheErr);
      }
    }

    let uid = '';
    let displayName = '';
    let role: UserRole = 'perawat';

    if (foundProfile) {
      uid = foundProfile.uid || foundProfile.id;
      displayName = foundProfile.displayName;
      role = foundProfile.role;
    } else {
      uid = 'sim-' + Math.random().toString(36).substring(2, 11);
      const emailPrefix = emailLower.split('@')[0];
      displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      const possibleRoles = ['admin', 'owner', 'keuangan', 'dokter', 'perawat', 'apoteker', 'media', 'PIC'];
      role = possibleRoles.includes(emailPrefix) ? (emailPrefix as UserRole) : 'owner';

      if (emailLower === 'kurniawangamatya37@gmail.com') {
        role = 'admin';
      }

      const newProfile: UserProfile = {
        uid,
        email: emailLower,
        displayName,
        role
      };

      try {
        await setDoc(doc(db, 'users', uid), newProfile);
        const payrollSnap = await getDoc(doc(db, 'settings', 'payroll'));
        let defaultRate = 15000;
        if (payrollSnap.exists()) {
          const rates = (payrollSnap.data() as any)?.roleRates || {};
          defaultRate = rates[role.toLowerCase()] || 15000;
        }

        await setDoc(doc(db, 'employees', uid), {
          userId: uid,
          id: uid,
          name: displayName,
          role: role,
          salary: 3000000,
          hourlyRate: defaultRate,
          status: 'active',
          joinedAt: serverTimestamp()
        });

        const permRef = doc(db, 'role_permissions', role);
        const permSnap = await getDoc(permRef);
        if (!permSnap.exists()) {
          await setDoc(permRef, {
            navigation: ['overview', 'board', 'kpi'],
            updatedAt: serverTimestamp()
          });
        }
      } catch (dbErr) {
        console.warn("Failed to persist simulated sign-up to Firestore:", dbErr);
      }
    }

    const mockUser = {
      uid,
      email: emailLower,
      displayName,
      isAnonymous: false
    };

    try {
      localStorage.setItem('clinic_simulated_user', JSON.stringify(mockUser));
      localStorage.setItem('force_local_simulation', 'true');
    } catch (e) {}

    setSimulatedUser(mockUser);
    setUser(mockUser);
  };

  const registerOffline = async (data: {
    displayName: string;
    email: string;
    password: string;
    role: UserRole;
    specialization?: string;
    salary?: number;
    hourlyRate?: number;
  }) => {
    setLoginError(null);
    const emailLower = data.email.trim().toLowerCase();

    // Look up in existing offline accounts to prevent duplicate email
    let accounts: any[] = [];
    try {
      const saved = localStorage.getItem('clinic_local_registered_accounts');
      accounts = saved ? JSON.parse(saved) : [];
    } catch (e) {}

    if (accounts.some(a => a.email === emailLower)) {
      setLoginError('Email ini sudah terdaftar di sistem.');
      throw new Error('Email already registered');
    }

    const uid = 'usr-' + Math.random().toString(36).substring(2, 11);
    
    const newAccount = {
      uid,
      email: emailLower,
      password: data.password,
      displayName: data.displayName.trim(),
      role: data.role,
      specialization: data.specialization || ''
    };

    accounts.push(newAccount);
    localStorage.setItem('clinic_local_registered_accounts', JSON.stringify(accounts));

    // Build profiles & employees to inject directly into local caches
    const newProfile: UserProfile = {
      uid,
      email: emailLower,
      displayName: data.displayName.trim(),
      role: data.role,
      specialization: data.specialization || ''
    };

    // Cache Users
    try {
      const cachedUsersRaw = localStorage.getItem('clinic_cache_users');
      let cachedUsers = cachedUsersRaw ? JSON.parse(cachedUsersRaw) : [];
      if (!Array.isArray(cachedUsers)) cachedUsers = [];
      cachedUsers = cachedUsers.filter((u: any) => u.email !== emailLower);
      cachedUsers.push(newProfile);
      localStorage.setItem('clinic_cache_users', JSON.stringify(cachedUsers));
    } catch (e) {}

    // Cache Employees
    const newEmployee = {
      id: uid,
      userId: uid,
      name: data.displayName.trim(),
      role: data.role,
      salary: data.salary || 3000000,
      hourlyRate: data.hourlyRate || 15000,
      status: 'active',
      joinedAt: new Date().toISOString()
    };

    try {
      const cachedEmpRaw = localStorage.getItem('clinic_cache_employees');
      let cachedEmps = cachedEmpRaw ? JSON.parse(cachedEmpRaw) : [];
      if (!Array.isArray(cachedEmps)) cachedEmps = [];
      cachedEmps = cachedEmps.filter((e: any) => e.userId !== uid);
      cachedEmps.push(newEmployee);
      localStorage.setItem('clinic_cache_employees', JSON.stringify(cachedEmps));
    } catch (e) {}

    // Try persisting to Firestore if available (quiet fallback)
    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: emailLower,
        displayName: data.displayName.trim(),
        role: data.role,
        specialization: data.specialization || ''
      });

      await setDoc(doc(db, 'employees', uid), {
        userId: uid,
        id: uid,
        name: data.displayName.trim(),
        role: data.role,
        salary: data.salary || 3000000,
        hourlyRate: data.hourlyRate || 15000,
        status: 'active',
        joinedAt: serverTimestamp()
      });

      const permRef = doc(db, 'role_permissions', data.role);
      const permSnap = await getDoc(permRef);
      if (!permSnap.exists()) {
        await setDoc(permRef, {
          navigation: ['overview', 'board', 'kpi'],
          updatedAt: serverTimestamp()
        });
      }
    } catch (fsErr) {
      console.warn("Firestore quiet save skipped (using local storage perfectly):", fsErr);
    }

    // Auto sign-in of newly registered user
    const mockUser = {
      uid,
      email: emailLower,
      displayName: data.displayName.trim(),
      isAnonymous: false
    };

    localStorage.setItem('clinic_simulated_user', JSON.stringify(mockUser));
    setSimulatedUser(mockUser);
    setUser(mockUser);
    setProfile(newProfile);
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoginError(null);
    const emailLower = email.trim().toLowerCase();

    // 1. Look up in clinic_local_registered_accounts
    let accounts: any[] = [];
    try {
      const saved = localStorage.getItem('clinic_local_registered_accounts');
      accounts = saved ? JSON.parse(saved) : [];
    } catch (e) {}

    const account = accounts.find(a => a.email === emailLower);
    if (account) {
      if (account.password === password) {
        const mockUser = {
          uid: account.uid,
          email: emailLower,
          displayName: account.displayName,
          isAnonymous: false
        };
        localStorage.setItem('clinic_simulated_user', JSON.stringify(mockUser));
        setSimulatedUser(mockUser);
        setUser(mockUser);
        setProfile({
          uid: account.uid,
          email: emailLower,
          displayName: account.displayName,
          role: account.role,
          specialization: account.specialization
        });
        return;
       } else {
        setLoginError('Sandi salah. Coba periksa kembali kata sandi Anda.');
        return;
      }
    }

    // 2. Fallback for built-in demo/seed accounts
    const demoEmails = ['admin@klinik.com', 'owner@klinik.com', 'keuangan@klinik.com', 'dokter@klinik.com', 'perawat@klinik.com'];
    const bootstrapEmail = 'kurniawangamatya37@gmail.com';
    if (demoEmails.includes(emailLower) || emailLower === bootstrapEmail) {
      await loginWithEmailSimulated(emailLower, password);
      return;
    }

    // 3. Fallback: Check if they exist in generic clinic_cache_users and registering them on the fly
    try {
      const cachedUsersRaw = localStorage.getItem('clinic_cache_users');
      if (cachedUsersRaw) {
        const cachedUsers = JSON.parse(cachedUsersRaw);
        const found = cachedUsers.find((u: any) => u.email && u.email.toLowerCase() === emailLower);
        if (found) {
          const newAccount = {
            uid: found.uid || found.id,
            email: emailLower,
            password: password,
            displayName: found.displayName,
            role: found.role,
            specialization: found.specialization || ''
          };
          accounts.push(newAccount);
          localStorage.setItem('clinic_local_registered_accounts', JSON.stringify(accounts));

          const mockUser = {
            uid: found.uid || found.id,
            email: emailLower,
            displayName: found.displayName,
            isAnonymous: false
          };
          localStorage.setItem('clinic_simulated_user', JSON.stringify(mockUser));
          setSimulatedUser(mockUser);
          setUser(mockUser);
          setProfile(found);
          return;
        }
      }
    } catch (e) {}

    // 4. Regular firestore/auth attempt
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Firebase auth failed, fallback to simulated account auto creation:", error);
      if (error && error.code === 'auth/operation-not-allowed') {
        await loginWithEmailSimulated(email, password);
        return;
      }
      if (error && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (regError: any) {
          if (regError && regError.code === 'auth/operation-not-allowed') {
            await loginWithEmailSimulated(email, password);
            return;
          }
          await loginWithEmailSimulated(email, password);
        }
      } else {
        await loginWithEmailSimulated(email, password);
      }
    }
  };

  const logout = async () => {
    setLoginError(null);
    try {
      localStorage.removeItem('clinic_simulated_user');
      localStorage.removeItem('force_local_simulation');
      localStorage.removeItem('clinic_cache_profile');
      setSimulatedUser(null);
      setUser(null);
      setProfile(null);
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateRole = async (userId: string, role: UserRole) => {
    if (profile?.role !== 'admin' && profile?.role !== 'owner') return;
    try {
      await setDoc(doc(db, 'users', userId), { role }, { merge: true });
      
      try {
        const permRef = doc(db, 'role_permissions', role);
        const permSnap = await getDoc(permRef);
        if (!permSnap.exists()) {
          await setDoc(permRef, {
            navigation: ['overview', 'board', 'kpi'],
            updatedAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("Initialize role permissions failed", e);
      }
    } catch (error) {
      console.error("Update role failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginError, setLoginError, login, loginWithEmail, registerOffline, logout, updateRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
