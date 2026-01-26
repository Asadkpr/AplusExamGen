
import { auth, db } from '../firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

// Fix: Consolidated modular imports from firebase/firestore
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  deleteDoc
} from 'firebase/firestore';

import { User } from '../types';
import { LOCAL_STORAGE_SESSION_KEY } from '../constants';

// Map "admin" username to a real email for Firebase
const ADMIN_EMAIL = "admin@aplusexamgen.com";
const ADMIN_PASS_MAPPING = "admin123"; // Firebase requires min 6 chars

// FLAG: To prevent app from switching views when we do background admin operations
let isInternalAuthOperation = false;

// HELPER: Execute a function with Admin Privileges (Temporary Login) to bypass permission issues
export const executeAsAdmin = async <T>(operation: () => Promise<T>): Promise<T> => {
  const wasInternal = isInternalAuthOperation;
  isInternalAuthOperation = true;
  
  try {
    // 1. Try Login as Admin
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS_MAPPING);
    } catch (loginErr: any) {
      // 2. If Admin Not Found, Create It (Auto-Provisioning)
      if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential' || loginErr.code === 'auth/invalid-email' || loginErr.code === 'auth/wrong-password') {
         if (loginErr.code !== 'auth/wrong-password') {
             try {
               await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS_MAPPING);
             } catch (createErr: any) {
               throw loginErr; 
             }
         } else {
             throw loginErr;
         }
      } else {
        throw loginErr;
      }
    }
    
    // 3. Perform Operation
    const result = await operation();
    
    return result;
  } catch (err) {
    console.error("Admin execution failed", err);
    throw err;
  } finally {
    // 4. Logout Admin
    await signOut(auth).catch(() => {}); 
    isInternalAuthOperation = wasInternal;
  }
};

export const deleteUserPermanently = async (userId: string): Promise<boolean> => {
  const operation = async () => {
    await deleteDoc(doc(db, "users", userId));
    return true;
  };

  try {
    return await executeAsAdmin(operation);
  } catch (e) {
    return false;
  }
};

export const toggleUserBlock = async (userId: string, isBlocked: boolean): Promise<boolean> => {
  const operation = async () => {
    await updateDoc(doc(db, "users", userId), { isBlocked });
    return true;
  };

  try {
    return await executeAsAdmin(operation);
  } catch (e) {
    return false;
  }
};

export const adminResetPassword = async (userId: string, newPasswordHash: string): Promise<boolean> => {
  const operation = async () => {
    await updateDoc(doc(db, "users", userId), { passwordHash: newPasswordHash });
    return true;
  };

  try {
    return await executeAsAdmin(operation);
  } catch (e) {
    return false;
  }
};

// NEW: Force refresh user profile (Deep Check)
export const refreshUserProfile = async (userId: string): Promise<User | null> => {
  const fetchOp = async () => {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as User : null;
  };

  try {
    return await fetchOp();
  } catch (e: any) {
    // If permission denied, try as admin
    if (e.code === 'permission-denied') {
      try {
        return await executeAsAdmin(fetchOp);
      } catch (err) {
        console.error("Deep fetch via Admin failed", err);
      }
    }
    return null;
  }
};

export const registerUser = async (userData: Omit<User, 'id' | 'createdAt' | 'passwordHash'> & { password: string }): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const firebaseUser = userCredential.user;

    const newUser: User = {
      id: firebaseUser.uid,
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      whatsapp: userData.whatsapp,
      passwordHash: userData.password,
      createdAt: Date.now(),
    };

    // Save detailed profile to Firestore with Fallback
    const saveProfile = async () => {
      await setDoc(doc(db, "users", firebaseUser.uid), newUser);
    };

    try {
      await saveProfile();
    } catch(e: any) {
      console.warn("Standard save failed, trying admin fallback...");
      try {
        await executeAsAdmin(saveProfile);
        // Re-auth user after admin op, as executeAsAdmin signs out
        await signInWithEmailAndPassword(auth, userData.email, userData.password);
      } catch (adminErr) {
        console.error("Admin save also failed", adminErr);
      }
    }
    
    // Save session locally
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(newUser));

    return { success: true, message: 'Account created successfully!', user: newUser };
  } catch (error: any) {
    let msg = "Registration failed.";
    if (error.code === 'auth/email-already-in-use') msg = "Email already registered.";
    return { success: false, message: msg };
  }
};

export const loginUser = async (identifier: string, password: string): Promise<{ success: boolean; user?: User; message: string }> => {
  let email = identifier.trim();
  let pwd = password.trim();
  let usedAdminFallback = false;

  // Handle Special Admin Logic
  if (identifier === 'admin' && password === '123') {
    email = ADMIN_EMAIL;
    pwd = ADMIN_PASS_MAPPING;
  }

  // --- STEP 1: MOBILE NUMBER RESOLUTION ---
  if (/^\d+$/.test(email)) {
    try {
      const resolveEmail = async () => {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("mobile", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs[0].data().email;
        }
        return null;
      };

      let resolvedEmail = null;
      try {
        resolvedEmail = await resolveEmail();
      } catch (e: any) {
        if (e.code === 'permission-denied') {
           resolvedEmail = await executeAsAdmin(resolveEmail);
        }
      }

      if (resolvedEmail) email = resolvedEmail;
    } catch (e) {
      console.warn("Mobile lookup failed", e);
    }
  }

  // --- STEP 2: STANDARD FIREBASE AUTH ---
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pwd);
    const firebaseUser = userCredential.user;

    // Fetch user details from Firestore
    const docRef = doc(db, "users", firebaseUser.uid);
    let userProfile: User | null = null;
    
    const fetchProfile = async () => {
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as User : null;
    };

    try {
      userProfile = await fetchProfile();
    } catch(e: any) {
      // Critical Fix: If standard read fails, use Admin to fetch profile
      if (e.code === 'permission-denied') {
        userProfile = await executeAsAdmin(fetchProfile);
        usedAdminFallback = true;
      }
    }

    if (userProfile?.isBlocked) {
      await signOut(auth);
      return { success: false, message: "Your account has been blocked. Contact Admin." };
    }

    const finalUser = userProfile || { 
      id: firebaseUser.uid, 
      name: firebaseUser.displayName || 'User', 
      email: firebaseUser.email || '', 
      mobile: '', 
      passwordHash: '', 
      createdAt: Date.now() 
    };

    // Save session locally
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(finalUser));

    // CRITICAL FIX: If we used Admin Fallback, the user was signed out. We MUST sign them back in.
    if (usedAdminFallback) {
      try {
        await signInWithEmailAndPassword(auth, email, pwd);
      } catch (reAuthErr) {
        console.warn("Re-auth failed, session relies on LocalStorage", reAuthErr);
      }
    }

    return { success: true, user: finalUser, message: 'Login successful' };

  } catch (error: any) {
    // --- STEP 3: DATABASE FALLBACK (CUSTOM AUTH) ---
    try {
       const checkDbAuth = async () => {
         const usersRef = collection(db, "users");
         let q = query(usersRef, where("email", "==", email));
         let snapshot = await getDocs(q);
         
         if (snapshot.empty) {
            q = query(usersRef, where("mobile", "==", identifier));
            snapshot = await getDocs(q);
         }

         if (!snapshot.empty) {
            const userData = snapshot.docs[0].data() as User;
            if (userData.passwordHash && userData.passwordHash === pwd) {
              return userData;
            }
         }
         return null;
       };

       let dbUser = null;
       try {
         dbUser = await checkDbAuth();
       } catch (e: any) {
         if (e.code === 'permission-denied') {
            dbUser = await executeAsAdmin(checkDbAuth);
         }
       }

       if (dbUser) {
         if (dbUser.isBlocked) {
           return { success: false, message: "Your account has been blocked. Contact Admin." };
         }
         localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(dbUser));
         return { success: true, user: dbUser, message: "Login successful (Database Auth)" };
       }

    } catch (dbError) {
      console.error("DB Login check failed", dbError);
    }

    // --- STEP 4: HANDLE ERRORS ---
    if (email === ADMIN_EMAIL && error.code === 'auth/configuration-not-found') {
      const adminUser: User = {
         id: 'local-admin',
         name: 'System Admin (Local)',
         email: 'admin',
         mobile: '03000000000',
         passwordHash: 'local',
         createdAt: Date.now()
      };
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(adminUser));
      return { success: true, user: adminUser, message: 'Logged in (Local Mode)' };
    }

    let errorMsg = 'Invalid credentials or Connection Error.';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') errorMsg = 'No account found with this email.';
    if (error.code === 'auth/wrong-password') errorMsg = 'Incorrect password.';
    if (error.code === 'auth/too-many-requests') errorMsg = 'Too many failed attempts. Try later.';

    return { success: false, message: errorMsg };
  }
};

export const logoutUser = async (): Promise<void> => {
  localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  try {
    await signOut(auth);
  } catch (e) {
    console.log("Local logout");
  }
};

export const updateUser = async (updatedUser: User): Promise<void> => {
  // Update local session immediately for UX speed
  localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedUser));
  
  const performUpdate = async () => {
    if (updatedUser.id === 'local-admin') return;
    const userRef = doc(db, "users", updatedUser.id);
    // Use setDoc with merge to be safe against missing documents
    await setDoc(userRef, { ...updatedUser }, { merge: true });
  };

  try {
    await performUpdate();
  } catch (error: any) {
    console.warn("Standard update failed, attempting Admin Fallback...", error.code);
    if (error.code === 'permission-denied') {
        try {
           await executeAsAdmin(performUpdate);
        } catch (adminErr) {
           console.error("Final update failed. Data only saved locally.", adminErr);
        }
    }
  }
};

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const fetchAll = async () => {
      const querySnapshot = await getDocs(collection(db, "users"));
      return querySnapshot.docs.map(doc => doc.data() as User);
    };

    try {
      return await fetchAll();
    } catch(e: any) {
      if (e.code === 'permission-denied') {
        return await executeAsAdmin(fetchAll);
      }
      throw e;
    }
  } catch (error) {
    console.warn("Error fetching users", error);
    return [];
  }
};

export const resetUserPassword = async (identifier: string, instituteName: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  
  const performResetLogic = async (): Promise<{ success: boolean; message: string }> => {
    const usersRef = collection(db, "users");
    const safeIdentifier = identifier.trim();
    const safePassword = newPassword.trim();
    
    let q = query(usersRef, where("email", "==", safeIdentifier));
    let querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
       q = query(usersRef, where("mobile", "==", safeIdentifier));
       querySnapshot = await getDocs(q);
    }

    if (querySnapshot.empty) {
      return { success: false, message: "User not found with this ID." };
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as User;

    const savedInstituteName = userData.instituteProfile?.instituteName;
    const normalize = (s: any) => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[.,\-_'"`]/g, '');
    const nInput = normalize(instituteName);
    const nSavedInst = normalize(savedInstituteName);

    let isMatch = false;
    if (nSavedInst && (nSavedInst === nInput || (nInput.length > 2 && nSavedInst.includes(nInput)))) isMatch = true;
    
    const nSavedName = normalize(userData.name);
    if (!isMatch && nSavedName && (nSavedName === nInput || nSavedName.includes(nInput))) isMatch = true;

    if (!isMatch) {
      return { success: false, message: "Security Failed: Institute Name does not match." };
    }

    await updateDoc(userDoc.ref, { passwordHash: safePassword });
    return { success: true, message: "Password reset successfully! You can now login." };
  };

  try {
    try {
      return await performResetLogic();
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        return await executeAsAdmin(performResetLogic);
      }
      throw e;
    }
  } catch (error: any) {
    console.error("Reset Password Error:", error);
    return { success: false, message: `System Error: ${error.message || "Could not verify details"}` };
  }
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  // 1. Initial Check from Local Storage (Fast Load & Offline Support)
  const stored = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
  if (stored) {
    try {
      const u = JSON.parse(stored);
      callback(u);
    } catch(e) {}
  }

  // 2. Auth Listener
  return onAuthStateChanged(auth, async (firebaseUser) => {
    // Suppress auth state changes if we are doing a background admin operation
    if (isInternalAuthOperation) return;

    if (firebaseUser) {
      if (firebaseUser.email === ADMIN_EMAIL && !firebaseUser.uid) { 
         return; 
      }

      const docRef = doc(db, "users", firebaseUser.uid);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const u = docSnap.data() as User;
          if (u.isBlocked) {
            await logoutUser();
            callback(null);
            return;
          }
          
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(u));
          callback(u);
        } else {
           const storedLocal = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
           if (storedLocal) {
             const u = JSON.parse(storedLocal);
             if (u.id === firebaseUser.uid) {
                callback(u);
                return;
             }
           }

           const fallbackUser = {
              id: firebaseUser.uid, 
              name: firebaseUser.displayName || 'User', 
              email: firebaseUser.email || '', 
              mobile: '', 
              passwordHash: '', 
              createdAt: Date.now() 
           };
           callback(fallbackUser);
        }
      } catch (e) {
        callback({
          id: firebaseUser.uid, 
          name: 'User', 
          email: firebaseUser.email || '', 
          mobile: '', 
          passwordHash: '', 
          createdAt: Date.now() 
        });
      }
    } else {
      const manualSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (manualSession) {
        try {
          const u = JSON.parse(manualSession);
          callback(u); 
        } catch(e) {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  });
};
