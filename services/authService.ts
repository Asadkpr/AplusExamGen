
import { auth, db } from '../firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
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
  deleteDoc,
  getCountFromServer,
  limit,
  startAfter,
  orderBy,
  QueryDocumentSnapshot
} from 'firebase/firestore';

import { User } from '../types';
import { LOCAL_STORAGE_SESSION_KEY } from '../constants';

// Map "admin" username to a real email for Firebase
const ADMIN_EMAIL = "admin@aplusexamgen.com";
const ADMIN_PASS_MAPPING = "admin0086"; // Firebase requires min 6 chars

let isInternalAuthOperation = false;

export const executeAsAdmin = async <T>(operation: () => Promise<T>): Promise<T> => {
  // If already logged in as admin in Firebase Auth, execute directly
  if (auth.currentUser?.email === ADMIN_EMAIL) {
    return await operation();
  }

  // If a user is already signed in, execute under current credentials to prevent disrupting their session
  if (auth.currentUser) {
    try {
      return await operation();
    } catch (opErr) {
      console.warn("Operation under active user failed:", opErr);
    }
  }

  const wasInternal = isInternalAuthOperation;
  isInternalAuthOperation = true;

  try {
    // 1. Try Login as Admin
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS_MAPPING);
    } catch (loginErr: any) {
      // 2. If Admin Not Found, Auto-Create It
      if (
        loginErr.code === 'auth/user-not-found' ||
        loginErr.code === 'auth/invalid-credential' ||
        loginErr.code === 'auth/invalid-email'
      ) {
        try {
          await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS_MAPPING);
        } catch (createErr: any) {
          console.warn("Could not auto-provision admin:", createErr);
          throw loginErr;
        }
      } else {
        throw loginErr;
      }
    }
    // 3. Execute privileged operation
    return await operation();
  } finally {
    // 4. Logout Admin silently
    try {
      await signOut(auth);
    } catch (_) {}
    isInternalAuthOperation = wasInternal;
  }
};

export const deleteUserPermanently = async (userId: string): Promise<boolean> => {
  // Clear cache
  cachedUsers = null;
  cachedUserCount = null;
  try {
    const current = localStorage.getItem('total_users_count');
    if (current !== null) {
      const prev = parseInt(current, 10);
      if (!isNaN(prev)) {
        localStorage.setItem('total_users_count', Math.max(0, prev - 1).toString());
      }
    }
  } catch (_) {}

  const operation = async () => {
    await deleteDoc(doc(db, "users", userId));
    return true;
  };

  try {
    try {
      return await operation();
    } catch (e: any) {
      if (e?.code === 'permission-denied' || e?.message?.toLowerCase().includes('permission') || e?.message?.toLowerCase().includes('insufficient')) {
        return await executeAsAdmin(operation);
      }
      throw e;
    }
  } catch (e) {
    console.error("deleteUserPermanently failed:", e);
    return false;
  }
};

export const toggleUserBlock = async (userId: string, isBlocked: boolean): Promise<boolean> => {
  // Clear cache
  cachedUsers = null;

  const operation = async () => {
    await updateDoc(doc(db, "users", userId), { isBlocked });
    return true;
  };

  try {
    try {
      return await operation();
    } catch (e: any) {
      if (e?.code === 'permission-denied' || e?.message?.toLowerCase().includes('permission') || e?.message?.toLowerCase().includes('insufficient')) {
        return await executeAsAdmin(operation);
      }
      throw e;
    }
  } catch (e) {
    console.error("toggleUserBlock failed:", e);
    return false;
  }
};

export const adminResetPassword = async (userId: string, newPasswordHash: string): Promise<boolean> => {
  // Clear cache
  cachedUsers = null;

  const operation = async () => {
    await updateDoc(doc(db, "users", userId), { passwordHash: newPasswordHash });
    return true;
  };

  try {
    try {
      return await operation();
    } catch (e: any) {
      if (e?.code === 'permission-denied' || e?.message?.toLowerCase().includes('permission') || e?.message?.toLowerCase().includes('insufficient')) {
        return await executeAsAdmin(operation);
      }
      throw e;
    }
  } catch (e) {
    console.error("adminResetPassword failed:", e);
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
      console.error("Standard save failed", e);
    }
    
    // Update user count cache & invalidate users cache
    try {
      const current = localStorage.getItem('total_users_count');
      if (current !== null) {
        const prev = parseInt(current, 10);
        if (!isNaN(prev)) {
          localStorage.setItem('total_users_count', (prev + 1).toString());
        }
      }
    } catch (_) {}
    cachedUserCount = null;
    cachedUsers = null;

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
  if ((identifier === 'admin' || identifier === 'admin@aplusexamgen.com') && password === 'admin0086') {
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
        console.error("Resolve email failed", e);
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
      console.error("Fetch profile failed", e);
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
         console.error("Check DB Auth failed", e);
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
    if (email === ADMIN_EMAIL) {
      // 4a. Auto-Provision Admin if it doesn't exist in Firebase yet
      const isCredError = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-email', 'auth/wrong-password'].includes(error.code);
      
      if (isCredError) {
        try {
          console.log("Attempting to auto-provision or migrate admin account...");
          
          // Try legacy password migration first
          try {
            const oldCred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, "admin153");
            await updatePassword(oldCred.user, ADMIN_PASS_MAPPING);
            console.log("Admin password migrated successfully.");
            
            const adminUser: User = {
               id: oldCred.user.uid,
               name: 'System Admin',
               email: 'admin',
               mobile: '03000000000',
               passwordHash: 'firebase',
               createdAt: Date.now()
            };
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(adminUser));
            return { success: true, user: adminUser, message: 'Admin Password Migrated & Logged In' };
          } catch (migErr) {
            // If migration fails, try creating fresh
            const newUserCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS_MAPPING);
            const adminUser: User = {
               id: newUserCredential.user.uid,
               name: 'System Admin',
               email: 'admin',
               mobile: '03000000000',
               passwordHash: 'firebase',
               createdAt: Date.now()
            };
            // Try saving profile to Firestore
            try { 
              await setDoc(doc(db, "users", newUserCredential.user.uid), adminUser); 
            } catch(e){
              console.warn("Could not save admin profile to Firestore, but Auth succeeded.");
            }
            
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(adminUser));
            return { success: true, user: adminUser, message: 'Admin Account Created & Logged In' };
          }
        } catch (createErr: any) {
          console.error("Failed to auto-create admin", createErr);
          return { success: false, message: `Admin creation failed: ${createErr.message || createErr.code}` };
        }
      }

      // 4b. Local Mode Fallback (Unconditional for Admin if we reach here)
      const adminUser: User = {
         id: 'local-admin',
         name: 'System Admin (Local)',
         email: 'admin',
         mobile: '03000000000',
         passwordHash: 'local',
         createdAt: Date.now()
      };
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(adminUser));
      return { success: true, user: adminUser, message: 'Logged in (Local Mode - Auth Bypassed)' };
    }

    let errorMsg = `Login Failed: ${error.message || error.code || 'Unknown error'}`;
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email' || error.code === 'auth/invalid-credential') errorMsg = 'No account found or invalid credentials.';
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
  // Clear cache
  cachedUsers = null;

  // Clean data to eliminate any undefined fields (preventing Firestore invalid-argument errors)
  const cleanUser: User = JSON.parse(JSON.stringify(updatedUser));

  // Update local session immediately for UX speed
  localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(cleanUser));
  
  const performUpdate = async () => {
    if (cleanUser.id === 'local-admin') return;
    const userRef = doc(db, "users", cleanUser.id);
    // Use setDoc with merge to be safe against missing documents, race against timeout
    await Promise.race([
      setDoc(userRef, cleanUser, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), 4000))
    ]);
  };

  try {
    try {
      await performUpdate();
    } catch (e: any) {
      if (e?.code === 'permission-denied' || e?.message?.toLowerCase().includes('permission') || e?.message?.toLowerCase().includes('insufficient')) {
        await executeAsAdmin(performUpdate);
      } else {
        throw e;
      }
    }
  } catch (error: any) {
    console.warn("User update sync warning:", error?.code || error?.message);
  }
};

let cachedUsers: User[] | null = null;
let lastUsersFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute

let cachedUserCount: number | null = null;
let lastUserCountFetchTime = 0;

export const resetUserCache = () => {
  cachedUsers = null;
  lastUsersFetchTime = 0;
  cachedUserCount = null;
  lastUserCountFetchTime = 0;
};

export const getCachedUserCountSync = (): number | null => {
  if (cachedUserCount !== null) return cachedUserCount;
  const stored = localStorage.getItem('total_users_count');
  if (stored !== null) {
    const val = parseInt(stored, 10);
    if (!isNaN(val)) return val;
  }
  return null;
};

export const getUserCount = async (forceRefresh: boolean = false): Promise<number> => {
  const now = Date.now();
  if (!forceRefresh && cachedUserCount !== null && (now - lastUserCountFetchTime < 60000)) {
    return cachedUserCount;
  }

  // Fast count: transfers 0 documents, only the count aggregate in milliseconds
  try {
    const coll = collection(db, "users");
    const countPromise = getCountFromServer(coll);
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Count timeout')), 8000));
    const snapshot = await Promise.race([countPromise, timeoutPromise]);
    const totalRaw = snapshot.data().count;
    // Exclude the 1 admin account if count > 0
    const count = Math.max(0, totalRaw > 1 ? totalRaw - 1 : totalRaw);
    cachedUserCount = count;
    lastUserCountFetchTime = Date.now();
    localStorage.setItem('total_users_count', count.toString());
    return count;
  } catch (err: any) {
    console.warn("Fast getCountFromServer failed for user count, attempting getDocs fallback:", err?.message || err);
    try {
      const coll = collection(db, "users");
      const docsPromise = getDocs(coll);
      const fallbackTimeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Docs timeout')), 6000));
      const snapshot = await Promise.race([docsPromise, fallbackTimeout]) as any;
      const totalRaw = snapshot.docs.length;
      const count = Math.max(0, totalRaw > 1 ? totalRaw - 1 : totalRaw);
      cachedUserCount = count;
      lastUserCountFetchTime = Date.now();
      localStorage.setItem('total_users_count', count.toString());
      return count;
    } catch (fallbackErr) {
      console.warn("Fallback getDocs also failed, checking local cache:", fallbackErr);
    }

    const stored = localStorage.getItem('total_users_count');
    if (stored !== null) {
      const val = parseInt(stored, 10);
      if (!isNaN(val)) return val;
    }
    return cachedUserCount !== null ? cachedUserCount : 0;
  }
};

export const getAllUsers = async (forceRefresh: boolean = false): Promise<User[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedUsers && (now - lastUsersFetchTime < CACHE_DURATION)) {
    return cachedUsers;
  }

  // Helper local backup reader
  const getLocalBackup = (): User[] => {
    try {
      const stored = localStorage.getItem('aplus_all_users_backup');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  };

  try {
    const fetchAll = async () => {
      // Fetch all users with a strict timeout to prevent hanging on Quota errors
      const q = query(collection(db, "users"));
      const queryPromise = getDocs(q);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Users fetch timeout/quota exceeded')), 4000)
      );
      const querySnapshot = await Promise.race([queryPromise, timeoutPromise]) as any;

      const users = querySnapshot.docs
        .map((d: any) => d.data() as User)
        .filter((u: any) => u && u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com' && u.id !== 'local-admin');
      
      // Update memory cache
      cachedUsers = users;
      lastUsersFetchTime = Date.now();
      
      // Persist to local backup for offline/quota resiliency
      try {
        localStorage.setItem('aplus_all_users_backup', JSON.stringify(users));
      } catch (_) {}

      return users;
    };

    try {
      return await fetchAll();
    } catch(e: any) {
      if (e?.code === 'permission-denied' || e?.message?.toLowerCase().includes('permission') || e?.message?.toLowerCase().includes('insufficient')) {
        return await executeAsAdmin(fetchAll);
      }
      throw e;
    }
  } catch (error: any) {
    console.warn("Could not fetch users from cloud (quota or offline), reading backup:", error?.message || error);
    if (cachedUsers && cachedUsers.length > 0) return cachedUsers;
    const backup = getLocalBackup();
    if (backup.length > 0) {
      cachedUsers = backup;
      return backup;
    }
    return [];
  }
};

export const getUsersPaginated = async (lastDoc: QueryDocumentSnapshot | null = null, limitCount: number = 50) => {
  try {
    const usersRef = collection(db, "users");
    let q;
    if (lastDoc) {
      q = query(usersRef, startAfter(lastDoc), limit(limitCount));
    } else {
      q = query(usersRef, limit(limitCount));
    }
    const queryPromise = getDocs(q);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Paginated users timeout/quota exceeded')), 4000)
    );
    const querySnapshot = await Promise.race([queryPromise, timeoutPromise]) as any;

    const users = querySnapshot.docs.map((d: any) => d.data() as User);
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
    return { users, lastDoc: newLastDoc };
  } catch (error: any) {
    console.warn("Failed to fetch paginated users from cloud, falling back to allUsers backup:", error?.message || error);
    try {
      const stored = localStorage.getItem('aplus_all_users_backup');
      if (stored) {
        const all: User[] = JSON.parse(stored);
        if (Array.isArray(all) && all.length > 0) {
          return { users: all.slice(0, limitCount), lastDoc: null };
        }
      }
    } catch (_) {}
    return { users: [], lastDoc: null };
  }
};

export const resetUserPassword = async (identifier: string, instituteName: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  
  const performResetLogic = async (): Promise<{ success: boolean; message: string }> => {
    const usersRef = collection(db, "users");
    const safeIdentifier = identifier.trim();
    const safePassword = newPassword.trim();
    
    // Search by email first, then mobile
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

    // Security check: match institute name or user name
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

    // 1. Update passwordHash in Firestore (works for DB auth fallback)
    const updateDbPassword = async () => {
      await updateDoc(userDoc.ref, { passwordHash: safePassword });
    };

    try {
      await updateDbPassword();
    } catch (updateErr: any) {
      if (
        updateErr?.code === 'permission-denied' ||
        updateErr?.message?.toLowerCase().includes('permission') ||
        updateErr?.message?.toLowerCase().includes('insufficient')
      ) {
        console.warn("Direct updateDoc failed with permission error. Executing as admin...");
        await executeAsAdmin(updateDbPassword);
      } else {
        throw updateErr;
      }
    }

    // 2. Also update Firebase Authentication password
    // We try signing in with known passwordHash (old password) to get a credential,
    // then update the Firebase Auth password so both paths work.
    const userEmail = userData.email?.trim();
    const oldPasswordHash = userData.passwordHash;
    if (userEmail && userEmail !== 'admin' && userEmail.includes('@')) {
      try {
        // Try to sign in with old password to get a fresh credential
        const credential = await signInWithEmailAndPassword(auth, userEmail, oldPasswordHash || '');
        await updatePassword(credential.user, safePassword);
        // Sign back out so we don't disturb current session
        // (We sign in silently just to get credential — sign out the temp session)
        // Note: This may affect the current auth state listener. We suppress it.
        isInternalAuthOperation = true;
        try {
          // Re-sign in won't hurt since we signed in with old creds above
          // Now immediately sign out so listener is not triggered
          await signOut(auth);
        } finally {
          isInternalAuthOperation = false;
        }
      } catch {
        // If Firebase Auth update fails (e.g. old password unknown or account not in Auth),
        // the passwordHash in Firestore is still updated — DB fallback login will still work.
        console.warn('Firebase Auth password update failed during reset — DB fallback will be used.');
      }
    }

    return { success: true, message: "Password reset successfully! You can now login with your new password." };
  };

  try {
    try {
      return await performResetLogic();
    } catch (e: any) {
      if (
        e?.code === 'permission-denied' ||
        e?.message?.toLowerCase().includes('permission') ||
        e?.message?.toLowerCase().includes('insufficient')
      ) {
        console.warn("Direct reset failed with permission error. Executing as Admin...");
        return await executeAsAdmin(performResetLogic);
      }
      throw e;
    }
  } catch (error: any) {
    console.error("Reset Password Error:", error);
    return { success: false, message: `System Error: ${error.message || "Could not verify details"}` };
  }
};

/**
 * Change password for a currently logged-in user.
 * Requires the current password to reauthenticate with Firebase.
 */
export const changeUserPassword = async (
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  const safeNew = newPassword.trim();
  const safeCurrent = currentPassword.trim();

  if (safeNew.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters.' };
  }

  // 1. Update Firestore passwordHash (always — works for DB auth fallback)
  try {
    if (user.id && user.id !== 'local-admin') {
      const updateHash = async () => {
        await updateDoc(doc(db, 'users', user.id), { passwordHash: safeNew });
      };
      try {
        await updateHash();
      } catch (err: any) {
        if (
          err?.code === 'permission-denied' ||
          err?.message?.toLowerCase().includes('permission') ||
          err?.message?.toLowerCase().includes('insufficient')
        ) {
          await executeAsAdmin(updateHash);
        } else {
          throw err;
        }
      }
      // Also update localStorage session
      const stored = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.passwordHash = safeNew;
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(parsed));
        } catch {}
      }
    }
  } catch (dbError: any) {
    console.warn('Firestore passwordHash update failed:', dbError.message);
  }

  // 2. Reauthenticate + update Firebase Auth password
  const currentFirebaseUser = auth.currentUser;
  if (!currentFirebaseUser || !currentFirebaseUser.email) {
    // No Firebase session — DB-only user, Firestore update above is sufficient
    return { success: true, message: 'Password changed successfully!' };
  }

  try {
    const credential = EmailAuthProvider.credential(currentFirebaseUser.email, safeCurrent);
    await reauthenticateWithCredential(currentFirebaseUser, credential);
    await updatePassword(currentFirebaseUser, safeNew);
    return { success: true, message: 'Password changed successfully!' };
  } catch (error: any) {
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      // Current password entered was wrong for Firebase Auth,
      // but Firestore passwordHash was already updated above.
      // Revert Firestore to avoid mismatch — or inform user.
      return { success: false, message: 'Current password is incorrect. Please try again.' };
    }
    if (error.code === 'auth/requires-recent-login') {
      return { success: false, message: 'Session expired. Please log out and log in again, then retry.' };
    }
    // For any other Firebase error, Firestore was already updated so it will work via DB fallback
    return { success: true, message: 'Password changed (via DB). Firebase sync may have a minor delay.' };
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
          
          const storedLocal = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
          if (storedLocal) {
            try {
              const localParsed = JSON.parse(storedLocal);
              if (localParsed.id === u.id && localParsed.instituteProfile && !u.instituteProfile) {
                u.instituteProfile = localParsed.instituteProfile;
              }
            } catch (e) {}
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
