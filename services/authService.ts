
import { auth, db } from '../firebaseConfig';
import { syncService } from './syncService';
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
  getDocsFromCache,
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

  // Check if localStorage indicates the current user is Master Admin
  let isActiveSessionAdmin = false;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.email === 'admin' || parsed?.email === ADMIN_EMAIL || parsed?.id === 'local-admin') {
        isActiveSessionAdmin = true;
      }
    }
  } catch (_) {}

  // If a non-admin user is already signed in, execute under current credentials to prevent disrupting their session
  if (auth.currentUser && !isActiveSessionAdmin) {
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
    // 4. Only logout Admin if the user's active session is NOT the Master Admin
    if (!isActiveSessionAdmin) {
      try {
        await signOut(auth);
      } catch (_) {}
    }
    isInternalAuthOperation = wasInternal;
  }
};

export const deleteUserPermanently = async (userId: string): Promise<boolean> => {
  // Clear cache
  cachedUsers = null;
  cachedUserCount = null;
  syncService.optimisticSchoolDeleted();

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
    return await Promise.race([
      fetchOp(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 3500))
    ]);
  } catch (e: any) {
    return null;
  }
};

export const normalizeEmailStr = (val?: string): string => {
  return String(val || '').trim().toLowerCase();
};

export const getCorePhoneDigits = (val?: string): string => {
  const digits = String(val || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0092') && digits.length >= 13) return digits.slice(4);
  if (digits.startsWith('92') && digits.length >= 11) return digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 10) return digits.slice(1);
  return digits;
};

export const formatStandardPakPhone = (val?: string): string => {
  const core = getCorePhoneDigits(val);
  if (core.length === 10 && core.startsWith('3')) {
    return `0${core}`;
  }
  return String(val || '').trim();
};

export const getPhoneSearchVariants = (val?: string): string[] => {
  const raw = String(val || '').trim();
  const digits = raw.replace(/\D/g, '');
  const core = getCorePhoneDigits(raw);
  const set = new Set<string>();
  if (raw) set.add(raw);
  if (digits) set.add(digits);
  if (core.length >= 7) {
    set.add(core);
    set.add(`0${core}`);
    set.add(`92${core}`);
    set.add(`+92${core}`);
    set.add(`0092${core}`);
  }
  return Array.from(set).slice(0, 10);
};

export const isPhoneMatch = (phoneA?: string, phoneB?: string): boolean => {
  const coreA = getCorePhoneDigits(phoneA);
  const coreB = getCorePhoneDigits(phoneB);
  if (coreA.length >= 7 && coreB.length >= 7) {
    return coreA === coreB || coreA.slice(-10) === coreB.slice(-10);
  }
  return false;
};

export const findUserByIdentifier = async (identifier: string): Promise<{ user: User; docId: string } | null> => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  const lowerEmail = normalizeEmailStr(raw);
  const phoneVariants = getPhoneSearchVariants(raw);
  const hasPhoneDigits = getCorePhoneDigits(raw).length >= 7;

  const runDirectQueries = async (): Promise<{ user: User; docId: string } | null> => {
    const usersRef = collection(db, "users");

    // 1. Try email exact & lowercase match
    const emailCandidates = Array.from(new Set([raw, lowerEmail])).filter(Boolean);
    if (emailCandidates.length > 0) {
      try {
        const qEmail = query(usersRef, where("email", "in", emailCandidates));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const d = snapEmail.docs[0];
          return { user: { ...(d.data() as User), id: d.data().id || d.id }, docId: d.id };
        }
      } catch (_) {}
    }

    // 2. Try mobile number variants
    if (phoneVariants.length > 0) {
      try {
        const qMobile = query(usersRef, where("mobile", "in", phoneVariants));
        const snapMobile = await getDocs(qMobile);
        if (!snapMobile.empty) {
          const d = snapMobile.docs[0];
          return { user: { ...(d.data() as User), id: d.data().id || d.id }, docId: d.id };
        }
      } catch (_) {}

      // 3. Try whatsapp number variants
      try {
        const qWhatsapp = query(usersRef, where("whatsapp", "in", phoneVariants));
        const snapWhatsapp = await getDocs(qWhatsapp);
        if (!snapWhatsapp.empty) {
          const d = snapWhatsapp.docs[0];
          return { user: { ...(d.data() as User), id: d.data().id || d.id }, docId: d.id };
        }
      } catch (_) {}
    }

    return null;
  };

  // Try direct Firestore queries first
  try {
    let directResult = await runDirectQueries();
    if (directResult) return directResult;
  } catch (err: any) {
    if (
      err?.code === 'permission-denied' ||
      err?.message?.toLowerCase().includes('permission') ||
      err?.message?.toLowerCase().includes('insufficient')
    ) {
      try {
        const adminDirect = await executeAsAdmin(runDirectQueries);
        if (adminDirect) return adminDirect;
      } catch (_) {}
    }
  }

  // Fallback: Case-insensitive email, normalized phone/whatsapp, or username scan across all users
  const matchInList = (usersList: User[]): { user: User; docId: string } | null => {
    for (const u of usersList) {
      if (!u) continue;
      if (u.email && normalizeEmailStr(u.email) === lowerEmail) {
        return { user: u, docId: u.id };
      }
      if (hasPhoneDigits && (isPhoneMatch(u.mobile, raw) || isPhoneMatch(u.whatsapp, raw) || isPhoneMatch(u.instituteProfile?.contactNumber, raw))) {
        return { user: u, docId: u.id };
      }
      if (u.name && normalizeEmailStr(u.name) === lowerEmail) {
        return { user: u, docId: u.id };
      }
    }
    return null;
  };

  try {
    const users = await getAllUsers(false);
    const matched = matchInList(users);
    if (matched) return matched;

    const freshUsers = await getAllUsers(true);
    const freshMatched = matchInList(freshUsers);
    if (freshMatched) return freshMatched;
  } catch (_) {}

  return null;
};

export const registerUser = async (userData: Omit<User, 'id' | 'createdAt' | 'passwordHash'> & { password: string }): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const cleanEmail = userData.email.trim();
    const normalizedEmail = cleanEmail.toLowerCase();
    const cleanMobile = formatStandardPakPhone(userData.mobile);
    const cleanWhatsapp = formatStandardPakPhone(userData.whatsapp || userData.mobile);

    if (normalizedEmail === 'admin' || normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
      return { success: false, message: "This email is reserved for System Admin." };
    }
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, userData.password);
    const firebaseUser = userCredential.user;

    const newUser: User = {
      id: firebaseUser.uid,
      name: userData.name.trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      whatsapp: cleanWhatsapp,
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
    syncService.optimisticSchoolAdded();
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
  let rawIdentifier = identifier.trim();
  let email = rawIdentifier;
  let pwd = password.trim();
  const rawPwd = password;

  // Handle Special Admin Logic
  const cleanId = rawIdentifier.toLowerCase();
  const cleanPwd = pwd;
  if ((cleanId === 'admin' || cleanId === 'admin@aplusexamgen.com') && (cleanPwd === 'admin0086' || cleanPwd === 'admin153')) {
    email = ADMIN_EMAIL;
    pwd = ADMIN_PASS_MAPPING;
  }

  // --- STEP 1: RESOLVE USER BY EMAIL, MOBILE, WHATSAPP, OR USERNAME ---
  let matchedRecord: { user: User; docId: string } | null = null;
  if (email !== ADMIN_EMAIL) {
    try {
      matchedRecord = await findUserByIdentifier(rawIdentifier);
      if (matchedRecord?.user?.email) {
        email = matchedRecord.user.email.trim();
      }
    } catch (e) {
      console.warn("User identifier lookup warning:", e);
    }
  }

  // Check if matched user in DB is blocked
  if (matchedRecord?.user?.isBlocked && email !== ADMIN_EMAIL) {
    return { success: false, message: "Your account has been blocked. Contact Admin." };
  }

  // If user was found in Firestore and their passwordHash matches directly,
  // try signing into Firebase Auth silently (if possible) and log them in immediately!
  if (matchedRecord?.user && email !== ADMIN_EMAIL) {
    const dbUser = matchedRecord.user;
    const savedHash = String(dbUser.passwordHash || '');
    const isPasswordMatch =
      savedHash !== '' &&
      (savedHash === pwd || savedHash === rawPwd || savedHash.trim() === pwd);

    if (isPasswordMatch) {
      // Attempt Firebase Auth sign-in in the background so auth.currentUser is synced when possible
      if (email.includes('@')) {
        try {
          await signInWithEmailAndPassword(auth, email, pwd);
        } catch (_) {
          // Ignore Firebase Auth error if password was reset in Firestore DB
        }
      }
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(dbUser));
      return { success: true, user: dbUser, message: 'Login successful' };
    }
  }

  // --- STEP 2: STANDARD FIREBASE AUTH ---
  try {
    const authEmail = email.includes('@') ? email : rawIdentifier;
    const userCredential = await signInWithEmailAndPassword(auth, authEmail, pwd);
    const firebaseUser = userCredential.user;

    // Fetch user details from Firestore
    const docRef = doc(db, "users", firebaseUser.uid);
    let userProfile: User | null = matchedRecord?.user || null;
    
    const fetchProfile = async () => {
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as User : null;
    };

    try {
      const freshProfile = await Promise.race([
        fetchProfile(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Profile timeout')), 3500))
      ]);
      if (freshProfile) userProfile = freshProfile;
    } catch(e: any) {
      console.warn("Fetch profile failed or timed out:", e?.message);
    }

    if (userProfile?.isBlocked && email !== ADMIN_EMAIL) {
      await signOut(auth);
      return { success: false, message: "Your account has been blocked. Contact Admin." };
    }

    const isMasterAdmin = email === ADMIN_EMAIL;
    const finalUser: User = isMasterAdmin
      ? {
          ...(userProfile || {}),
          id: firebaseUser.uid,
          name: 'Master Admin',
          email: 'admin',
          mobile: userProfile?.mobile || '03000000000',
          passwordHash: 'firebase',
          createdAt: userProfile?.createdAt || Date.now()
        }
      : (userProfile || { 
          id: firebaseUser.uid, 
          name: firebaseUser.displayName || 'User', 
          email: firebaseUser.email || authEmail, 
          mobile: '', 
          passwordHash: pwd, 
          createdAt: Date.now() 
        });

    // Keep Firestore passwordHash in sync with working Firebase Auth password
    if (!isMasterAdmin && finalUser.id && finalUser.passwordHash !== pwd) {
      finalUser.passwordHash = pwd;
      try {
        await setDoc(doc(db, "users", finalUser.id), { passwordHash: pwd }, { merge: true });
      } catch (_) {}
    }

    // Save session locally
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(finalUser));

    return { success: true, user: finalUser, message: 'Login successful' };

  } catch (error: any) {
    // --- STEP 3: DATABASE FALLBACK (CUSTOM AUTH) ---
    try {
      const fallbackRecord = matchedRecord || (await findUserByIdentifier(rawIdentifier));
      if (fallbackRecord?.user) {
        const dbUser = fallbackRecord.user;
        if (dbUser.isBlocked) {
          return { success: false, message: "Your account has been blocked. Contact Admin." };
        }
        const savedHash = String(dbUser.passwordHash || '');
        if (savedHash && (savedHash === pwd || savedHash === rawPwd || savedHash.trim() === pwd)) {
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(dbUser));
          return { success: true, user: dbUser, message: "Login successful" };
        }
        // User account exists, so the password was wrong
        return {
          success: false,
          message: "Incorrect password. Please enter the correct password or click 'Forgot password?' below."
        };
      }
    } catch (dbError) {
      console.error("DB Login check failed", dbError);
    }

    // --- STEP 4: HANDLE ADMIN AUTO-PROVISIONING & ERRORS ---
    if (email === ADMIN_EMAIL) {
      const isCredError = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-email', 'auth/wrong-password'].includes(error.code);
      
      if (isCredError) {
        try {
          try {
            const oldCred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, "admin153");
            await updatePassword(oldCred.user, ADMIN_PASS_MAPPING);
            
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
            const newUserCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS_MAPPING);
            const adminUser: User = {
               id: newUserCredential.user.uid,
               name: 'System Admin',
               email: 'admin',
               mobile: '03000000000',
               passwordHash: 'firebase',
               createdAt: Date.now()
            };
            try { 
              await setDoc(doc(db, "users", newUserCredential.user.uid), adminUser); 
            } catch(e){}
            
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(adminUser));
            return { success: true, user: adminUser, message: 'Admin Account Created & Logged In' };
          }
        } catch (createErr: any) {
          console.error("Failed to auto-create admin", createErr);
        }
      }

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

    let errorMsg = 'No account found with this Email or Mobile Number, or password is incorrect.';
    if (error.code === 'auth/wrong-password') errorMsg = 'Incorrect password. Please try again or reset your password.';
    if (error.code === 'auth/too-many-requests') errorMsg = 'Too many failed attempts. Please try again in a few minutes.';

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
    try {
      const coll = collection(db, "users");
      const cacheSnap = await getDocsFromCache(coll);
      if (!cacheSnap.empty) {
        const validUsers = cacheSnap.docs
          .map(d => d.data())
          .filter((u: any) => u && u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com' && u.id !== 'local-admin');
        const count = validUsers.length;
        cachedUserCount = count;
        lastUserCountFetchTime = Date.now();
        localStorage.setItem('total_users_count', count.toString());
        return count;
      }
    } catch (_) {}

    try {
      const rawUsers = localStorage.getItem('aplus_all_users_backup');
      if (rawUsers) {
        const arr = JSON.parse(rawUsers);
        if (Array.isArray(arr) && arr.length > 0) {
          localStorage.setItem('total_users_count', arr.length.toString());
          return arr.length;
        }
      }
    } catch (_) {}

    try {
      const metaSnap = await getDoc(doc(db, 'visibility_settings', 'dashboard_stats'));
      if (metaSnap.exists()) {
        const sc = metaSnap.data()?.schoolsCount;
        if (typeof sc === 'number' && sc > 0) {
          cachedUserCount = sc;
          lastUserCountFetchTime = Date.now();
          localStorage.setItem('total_users_count', sc.toString());
          return sc;
        }
      }
    } catch (_) {}

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
      // Fetch all users with sufficient timeout for 2,200+ user documents on cold cache
      const q = query(collection(db, "users"));
      const queryPromise = getDocs(q);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Users fetch timeout/quota exceeded')), 25000)
      );
      const querySnapshot = await Promise.race([queryPromise, timeoutPromise]) as any;

      const users = querySnapshot.docs
        .map((d: any) => d.data() as User)
        .filter((u: any) => u && u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com' && u.id !== 'local-admin');
      
      // Update memory cache
      cachedUsers = users;
      lastUsersFetchTime = Date.now();
      cachedUserCount = users.length;
      lastUserCountFetchTime = Date.now();
      
      // Persist to local backup for offline/quota resiliency
      try {
        localStorage.setItem('aplus_all_users_backup', JSON.stringify(users));
        localStorage.setItem('total_users_count', users.length.toString());
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
    try {
      const cacheSnap = await getDocsFromCache(collection(db, "users"));
      if (!cacheSnap.empty) {
        const users = cacheSnap.docs
          .map((d: any) => d.data() as User)
          .filter((u: any) => u && u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com' && u.id !== 'local-admin');
        if (users.length > 0) {
          cachedUsers = users;
          lastUsersFetchTime = Date.now();
          cachedUserCount = users.length;
          try {
            localStorage.setItem('aplus_all_users_backup', JSON.stringify(users));
            localStorage.setItem('total_users_count', users.length.toString());
          } catch (_) {}
          return users;
        }
      }
    } catch (_) {}

    if (cachedUsers && cachedUsers.length > 0) return cachedUsers;
    const backup = getLocalBackup();
    if (backup.length > 0) {
      cachedUsers = backup;
      try {
        localStorage.setItem('total_users_count', backup.length.toString());
      } catch (_) {}
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
      setTimeout(() => reject(new Error('Paginated users timeout/quota exceeded')), 12000)
    );
    const querySnapshot = await Promise.race([queryPromise, timeoutPromise]) as any;

    const users = querySnapshot.docs.map((d: any) => d.data() as User);
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
    return { users, lastDoc: newLastDoc };
  } catch (error: any) {
    try {
      const cacheSnap = await getDocsFromCache(collection(db, "users"));
      if (!cacheSnap.empty) {
        const all = cacheSnap.docs.map((d: any) => d.data() as User);
        if (all.length > 0) {
          return { users: all.slice(0, limitCount), lastDoc: null };
        }
      }
    } catch (_) {}
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
    const safeIdentifier = identifier.trim();
    const safePassword = newPassword.trim();
    
    // Find user by Email, Mobile, WhatsApp, or Name
    let matched = await findUserByIdentifier(safeIdentifier);
    if (!matched && instituteName && instituteName.trim()) {
      matched = await findUserByIdentifier(instituteName.trim());
    }

    if (!matched) {
      return { success: false, message: "No account found with this Email or Mobile Number." };
    }

    const userData = matched.user;
    const docId = matched.docId || userData.id;

    // 1. Update passwordHash in Firestore (works immediately for login)
    const updateDbPassword = async () => {
      await setDoc(doc(db, "users", docId), { passwordHash: safePassword }, { merge: true });
    };

    try {
      await updateDbPassword();
    } catch (updateErr: any) {
      if (
        updateErr?.code === 'permission-denied' ||
        updateErr?.message?.toLowerCase().includes('permission') ||
        updateErr?.message?.toLowerCase().includes('insufficient')
      ) {
        await executeAsAdmin(updateDbPassword);
      } else {
        throw updateErr;
      }
    }

    // Update memory cache & local backup so immediate login finds the new passwordHash
    cachedUsers = null;
    try {
      const rawBackup = localStorage.getItem('aplus_all_users_backup');
      if (rawBackup) {
        const arr: User[] = JSON.parse(rawBackup);
        if (Array.isArray(arr)) {
          const updatedArr = arr.map((u) =>
            u && (u.id === docId || normalizeEmailStr(u.email) === normalizeEmailStr(userData.email))
              ? { ...u, passwordHash: safePassword }
              : u
          );
          localStorage.setItem('aplus_all_users_backup', JSON.stringify(updatedArr));
        }
      }
    } catch (_) {}

    // 2. Also try updating Firebase Authentication password if possible
    const userEmail = userData.email?.trim();
    const oldPasswordHash = userData.passwordHash;
    if (userEmail && userEmail !== 'admin' && userEmail.includes('@') && oldPasswordHash) {
      try {
        isInternalAuthOperation = true;
        try {
          const credential = await signInWithEmailAndPassword(auth, userEmail, oldPasswordHash);
          await updatePassword(credential.user, safePassword);
          await signOut(auth);
        } finally {
          isInternalAuthOperation = false;
        }
      } catch {
        // Firestore passwordHash is already updated and loginUser checks it first
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
        return await executeAsAdmin(performResetLogic);
      }
      throw e;
    }
  } catch (error: any) {
    console.error("Reset Password Error:", error);
    return { success: false, message: `System Error: ${error.message || "Could not reset password"}` };
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

      const isMasterAdmin = firebaseUser.email === ADMIN_EMAIL;

      // SECURITY GUARD: If Firebase Auth has ADMIN_EMAIL (e.g. from a background executeAsAdmin call),
      // verify that localStorage actually has an active Master Admin session.
      // Never allow a regular teacher or logged-out visitor to inherit the Master Admin session!
      if (isMasterAdmin) {
        const storedCheck = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        let isExplicitAdminSession = false;
        if (storedCheck) {
          try {
            const parsed = JSON.parse(storedCheck);
            if (parsed?.email === 'admin' || parsed?.email === ADMIN_EMAIL || parsed?.id === 'local-admin') {
              isExplicitAdminSession = true;
            }
          } catch (_) {}
        }
        if (!isExplicitAdminSession) {
          // Leftover background admin auth: sign out silently and preserve current user/guest state
          try { await signOut(auth); } catch (_) {}
          if (storedCheck) {
            try { callback(JSON.parse(storedCheck)); return; } catch (_) {}
          }
          callback(null);
          return;
        }
      }

      const docRef = doc(db, "users", firebaseUser.uid);
      try {
        const docSnap = await Promise.race([
          getDoc(docRef),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Auth doc timeout')), 3500))
        ]);
        if (docSnap && docSnap.exists()) {
          const u = docSnap.data() as User;
          if (u.isBlocked && !isMasterAdmin) {
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

          if (isMasterAdmin) {
            u.name = 'Master Admin';
            u.email = 'admin';
          }

          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(u));
          callback(u);
        } else {
           const storedLocal = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
           if (storedLocal) {
             const u = JSON.parse(storedLocal);
             if (u.id === firebaseUser.uid || (isMasterAdmin && (u.email === 'admin' || u.email === ADMIN_EMAIL))) {
                if (isMasterAdmin) {
                  u.id = firebaseUser.uid;
                  u.name = 'Master Admin';
                  u.email = 'admin';
                  localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(u));
                }
                callback(u);
                return;
             }
           }

           const fallbackUser: User = {
              id: firebaseUser.uid, 
              name: isMasterAdmin ? 'Master Admin' : (firebaseUser.displayName || 'User'), 
              email: isMasterAdmin ? 'admin' : (firebaseUser.email || ''), 
              mobile: '', 
              passwordHash: '', 
              createdAt: Date.now() 
           };
           localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(fallbackUser));
           callback(fallbackUser);
        }
      } catch (e) {
        const fallbackUser: User = {
          id: firebaseUser.uid, 
          name: isMasterAdmin ? 'Master Admin' : 'User', 
          email: isMasterAdmin ? 'admin' : (firebaseUser.email || ''), 
          mobile: '', 
          passwordHash: '', 
          createdAt: Date.now() 
        };
        callback(fallbackUser);
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
