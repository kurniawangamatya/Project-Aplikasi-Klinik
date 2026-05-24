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
  logout: () => Promise<void>;
  updateRole: (userId: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Use onSnapshot for real-time profile updates
        const unsubProfile = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            // Force admin role for the bootstrap user
            if (user.email === 'kurniawangamatya37@gmail.com' && data.role !== 'admin') {
              await setDoc(doc(db, 'users', user.uid), { role: 'admin' }, { merge: true });
              // The next snapshot will have the correct role
              return;
            }
            setProfile(data);
            try { localStorage.setItem('clinic_cache_profile', JSON.stringify(data)); } catch (e) {}
            setLoading(false);
          } else {
            // Check for pre-assigned profile (invitation)
            const q = query(collection(db, 'users'), where('email', '==', user.email), limit(1));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
              const pendingDoc = querySnap.docs[0];
              const pendingData = pendingDoc.data() as UserProfile;
              
              const newProfile: UserProfile = {
                ...pendingData,
                uid: user.uid,
                displayName: user.displayName || pendingData.displayName,
                photoURL: user.photoURL || undefined
              };
              
              await setDoc(doc(db, 'users', user.uid), newProfile);
              if (pendingDoc.id !== user.uid) {
                await deleteDoc(doc(db, 'users', pendingDoc.id));
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
              const defaultRole: UserRole = user.email === 'kurniawangamatya37@gmail.com' ? 'admin' : 'owner';
              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'User',
                role: defaultRole,
                photoURL: user.photoURL || undefined
              };
              await setDoc(doc(db, 'users', user.uid), newProfile);
              
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
                
                await setDoc(doc(db, 'employees', user.uid), {
                  userId: user.uid,
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
              if (parsed && parsed.uid === user.uid) {
                cachedProfile = parsed as UserProfile;
              }
            }
          } catch (e) {}

          if (cachedProfile) {
            setProfile(cachedProfile);
          } else {
            const emailPrefix = user.email ? user.email.split('@')[0].toLowerCase() : 'admin';
            const fallbackRole: UserRole = ['admin', 'owner', 'keuangan', 'dokter', 'perawat', 'apoteker', 'media', 'PIC'].includes(emailPrefix) 
              ? (emailPrefix as UserRole) 
              : (user.email === 'kurniawangamatya37@gmail.com' ? 'admin' : 'owner');
            
            const fallbackProfile: UserProfile = {
              uid: user.uid,
              email: user.email || 'demo@klinik.com',
              displayName: user.displayName || (emailPrefix.toUpperCase() + ' (Offline)') || 'Demo User',
              role: fallbackRole
            };
            setProfile(fallbackProfile);
          }
          setLoading(false);
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

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

  const loginWithEmail = async (email: string, password: string) => {
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Email login failed", error);
      // Auto-register fallback for smooth demo/testing experience!
      if (error && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
        try {
          // Attempt to create user with this email
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (regError: any) {
          console.error("Auto registration fallback failed", regError);
          setLoginError(regError.code || regError.message || 'Pendaftaran gagal');
        }
      } else if (error && typeof error === 'object' && error.code) {
        setLoginError(error.code);
      } else if (error instanceof Error) {
        setLoginError(error.message);
      } else {
        setLoginError('Unknown auth error');
      }
    }
  };

  const logout = async () => {
    setLoginError(null);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateRole = async (userId: string, role: UserRole) => {
    if (profile?.role !== 'admin' && profile?.role !== 'owner') return;
    try {
      await setDoc(doc(db, 'users', userId), { role }, { merge: true });
      
      // Ensure role permissions exist for the new role if it's the first time assigned
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
    <AuthContext.Provider value={{ user, profile, loading, loginError, setLoginError, login, loginWithEmail, logout, updateRole }}>
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
