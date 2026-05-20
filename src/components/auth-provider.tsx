import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AppUser, Doctor } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, appUser: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(() => {
    try {
      const cached = localStorage.getItem('cached_app_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let docUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (docUnsubscribe) {
          docUnsubscribe();
          docUnsubscribe = null;
        }

        setUser(firebaseUser);
        if (firebaseUser) {
          // Instantly prime with cache if matching current logged-in user to avoid blank space
          const cachedUser = localStorage.getItem('cached_app_user');
          if (cachedUser) {
            try {
              const parsed = JSON.parse(cachedUser);
              if (parsed && parsed.uid === firebaseUser.uid) {
                setAppUser(parsed);
                setLoading(false);
              }
            } catch {}
          }

          const setupProfileListener = (ref: any, defaultPayload?: any) => {
            docUnsubscribe = onSnapshot(ref, async (snap) => {
              if (snap.exists()) {
                const refreshedUser = { uid: firebaseUser.uid, ...snap.data() } as AppUser;
                setAppUser(refreshedUser);
                try {
                  localStorage.setItem('cached_app_user', JSON.stringify(refreshedUser));
                } catch {}
              } else if (defaultPayload) {
                await setDoc(ref, defaultPayload);
                const refreshedUser = { uid: firebaseUser.uid, ...defaultPayload } as AppUser;
                setAppUser(refreshedUser);
                try {
                  localStorage.setItem('cached_app_user', JSON.stringify(refreshedUser));
                } catch {}
              }
              setLoading(false);
            }, (err) => {
              console.warn("User profile model snapshot failed:", err);
              setLoading(false);
            });
          };

          try {
            if (firebaseUser.email === 'structuremakers.india@gmail.com') {
              // Forced Doctor setup for active testing
              const doctorRef = doc(db, 'doctors', firebaseUser.uid);
              const docData = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Dr. Structure Makers',
                email: firebaseUser.email,
                phone: '123-456-7890',
                role: 'doctor' as const,
                status: 'ACTIVE' as const,
                createdAt: new Date().toISOString()
              };
              setupProfileListener(doctorRef, docData);
            } else if (firebaseUser.email === 'robin.mitra124421.mr@gmail.com') {
              // Forced Patient setup for active testing
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Robin Patient',
                role: 'patient' as const,
                createdAt: new Date().toISOString()
              };
              setupProfileListener(userRef, userData);
            } else {
              // Fetch or create user document
              const doctorRef = doc(db, 'doctors', firebaseUser.uid);
              const doctorSnap = await getDoc(doctorRef);

              if (doctorSnap.exists()) {
                setupProfileListener(doctorRef);
              } else {
                const userRef = doc(db, 'users', firebaseUser.uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                  const fetchedUser = { uid: firebaseUser.uid, ...userSnap.data() } as AppUser;
                  if (firebaseUser.email === 'robin.mitra124421@gmail.com' && fetchedUser.role !== 'admin') {
                    fetchedUser.role = 'admin';
                    await setDoc(userRef, { role: 'admin' }, { merge: true });
                  }
                  setupProfileListener(userRef);
                } else {
                  // Do not auto-create if it's a doctor signup flow
                  const isDoctorSignup = localStorage.getItem('isDoctorSignup');
                  if (isDoctorSignup === 'true') {
                     setAppUser(null); 
                     setLoading(false);
                     return;
                  }

                  const fetchedUser = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    name: firebaseUser.displayName || '',
                    role: firebaseUser.email === 'robin.mitra124421@gmail.com' ? 'admin' : 'patient',
                  };
                  setupProfileListener(userRef, fetchedUser);
                }
              }
            }
          } catch (firestoreErr) {
            console.warn("Firestore auth query offline/sandboxed:", firestoreErr);
            // Fallback user if we don't have it loaded yet
            if (!appUser || appUser.uid !== firebaseUser.uid) {
              const isDoctorSignup = localStorage.getItem('isDoctorSignup');
              const fallback: AppUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || '',
                role: isDoctorSignup === 'true' ? 'doctor' : 'patient',
                status: 'PENDING',
              };
              setAppUser(fallback);
            }
            setLoading(false);
          }
        } else {
          setAppUser(null);
          try {
            localStorage.removeItem('cached_app_user');
          } catch {}
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth state loading error:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (docUnsubscribe) {
        docUnsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
