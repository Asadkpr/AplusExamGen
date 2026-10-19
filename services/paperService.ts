import { db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  updateDoc,
  limit,
  getCountFromServer,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { SavedPaper } from '../types';
import { executeAsAdmin } from './authService';
import { syncService } from './syncService';

const COLLECTION = 'papers';
const LOCAL_STORAGE_KEY = 'aplus_papers_v1';

// 🔹 Memory Cache
let cachedPapers: Record<string, SavedPaper[]> = {};
let lastFetchTime: Record<string, number> = {};
const CACHE_DURATION = 25 * 1000; // 25 seconds for fast cross-client sync

let cachedPaperCount: Record<string, number> = {};
let lastPaperCountFetchTime: Record<string, number> = {};

export const resetPaperCache = () => {
  cachedPapers = {};
  lastFetchTime = {};
  cachedPaperCount = {};
  lastPaperCountFetchTime = {};
};

// Helper: withTimeout to avoid hanging promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 3500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network timeout')), timeoutMs))
  ]);
};

// Helper: Deep clean objects for Firestore (removes undefined which Firestore rejects)
const cleanForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)).filter(item => item !== undefined);
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = cleanForFirestore(val);
    }
  }
  return result;
};

export const getCachedPaperCountSync = (userId?: string): number | null => {
  const key = userId || 'admin';
  if (cachedPaperCount[key] !== undefined) return cachedPaperCount[key];
  const stored = localStorage.getItem(`total_papers_count_${key}`);
  if (stored !== null) {
    const val = parseInt(stored, 10);
    if (!isNaN(val)) return val;
  }
  return null;
};

export const getPaperCount = async (userId?: string, forceRefresh: boolean = false): Promise<number> => {
  const key = userId || 'admin';
  const now = Date.now();

  if (!forceRefresh && cachedPaperCount[key] !== undefined && (now - (lastPaperCountFetchTime[key] || 0) < 60000)) {
    return cachedPaperCount[key];
  }

  try {
    let q = query(collection(db, COLLECTION));
    if (userId) {
       q = query(collection(db, COLLECTION), where("userId", "==", userId));
    }
    // Instant aggregation query: transfers 0 documents, only the count number
    const snapshot = await withTimeout(getCountFromServer(q), 8000);
    const count = snapshot.data().count;
    cachedPaperCount[key] = count;
    lastPaperCountFetchTime[key] = now;
    localStorage.setItem(`total_papers_count_${key}`, count.toString());
    return count;
  } catch (error: any) {
    console.warn(`Fast getCountFromServer failed for paper count (${key}), attempting getDocs fallback:`, error?.message || error);
    try {
      let q = query(collection(db, COLLECTION));
      if (userId) {
         q = query(collection(db, COLLECTION), where("userId", "==", userId));
      }
      const snapshot = await withTimeout(getDocs(q), 6000);
      const count = snapshot.docs.length;
      cachedPaperCount[key] = count;
      lastPaperCountFetchTime[key] = now;
      localStorage.setItem(`total_papers_count_${key}`, count.toString());
      return count;
    } catch (fallbackError) {
      console.warn("Fallback getDocs for paper count also failed, reading local cache:", fallbackError);
    }

    try {
      const stored = localStorage.getItem(`total_papers_count_${key}`);
      if (stored !== null) {
        const val = parseInt(stored, 10);
        if (!isNaN(val)) return val;
      }
      const localStored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localStored) {
        const localPapers: SavedPaper[] = JSON.parse(localStored);
        const count = userId ? localPapers.filter(p => p.userId === userId).length : localPapers.length;
        return count;
      }
    } catch (_) {}
    return cachedPaperCount[key] !== undefined ? cachedPaperCount[key] : 0;
  }
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const savePaper = async (paper: Omit<SavedPaper, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string; id: string }> => {
  const id = generateId();
  const newPaper: SavedPaper = {
    ...paper,
    id,
    createdAt: Date.now(),
  };

  const sanitizedPaper = cleanForFirestore(JSON.parse(JSON.stringify(newPaper)));

  // Clear memory cache
  cachedPapers = {};
  lastFetchTime = {};
  cachedPaperCount = {};
  lastPaperCountFetchTime = {};

  try {
    const adminStored = localStorage.getItem('total_papers_count_admin');
    if (adminStored !== null) {
      const prev = parseInt(adminStored, 10);
      if (!isNaN(prev)) localStorage.setItem('total_papers_count_admin', (prev + 1).toString());
    }
    if (paper.userId) {
      const userStored = localStorage.getItem(`total_papers_count_${paper.userId}`);
      if (userStored !== null) {
        const prev = parseInt(userStored, 10);
        if (!isNaN(prev)) localStorage.setItem(`total_papers_count_${paper.userId}`, (prev + 1).toString());
      }
    }
  } catch (_) {}

  // 1. Save to LocalStorage immediately (Guaranteed local preservation)
  let savedLocally = false;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const papers: SavedPaper[] = stored ? JSON.parse(stored) : [];
    const existingIndex = papers.findIndex((p: SavedPaper) => p.id === id);
    if (existingIndex >= 0) {
      papers[existingIndex] = sanitizedPaper;
    } else {
      papers.unshift(sanitizedPaper);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(papers));
    savedLocally = true;
    syncService.optimisticPaperAdded(paper.userId);
  } catch (localError) {
    console.warn("Local storage save failed", localError);
  }

  // 2. Save to Firebase (Primary Cloud Sync)
  const saveOp = async () => {
    // Add expiresAt for Firestore TTL (Time-To-Live) auto-deletion after 4 months
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 120);
    await setDoc(doc(db, COLLECTION, id), { ...sanitizedPaper, expiresAt: expirationDate });
  };

  try {
    await withTimeout(saveOp(), 6000);
    return { success: true, message: 'Paper saved successfully!', id };
  } catch (error: any) {
    console.warn("Direct Firebase save failed, attempting admin retry / fallback:", error?.code, error?.message);

    // If permission-denied, retry with elevated admin credentials
    const isPermissionError = error?.code === 'permission-denied' || 
      error?.message?.toLowerCase().includes('permission') || 
      error?.message?.toLowerCase().includes('insufficient');

    if (isPermissionError) {
      try {
        await withTimeout(executeAsAdmin(saveOp), 6000);
        return { success: true, message: 'Paper saved successfully!', id };
      } catch (adminErr: any) {
        console.warn("Admin fallback save failed:", adminErr?.code, adminErr?.message);
      }
    }

    // If local save succeeded, report success so user does not lose paper
    if (savedLocally) {
      return { 
        success: true, 
        message: 'Paper saved successfully to device storage!', 
        id 
      };
    }

    return { 
      success: false, 
      message: 'Failed to save paper. Please check internet connection or storage.', 
      id 
    };
  }
};

export const updatePaper = async (id: string, paperUpdate: Partial<SavedPaper>): Promise<{ success: boolean; message: string }> => {
  const sanitizedUpdate = cleanForFirestore(JSON.parse(JSON.stringify(paperUpdate)));

  // Clear cache
  cachedPapers = {};
  lastFetchTime = {};

  // 1. Update LocalStorage
  let localUpdated = false;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const papers = JSON.parse(stored);
      const index = papers.findIndex((p: SavedPaper) => p.id === id);
      if (index !== -1) {
        papers[index] = { ...papers[index], ...sanitizedUpdate };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(papers));
        localUpdated = true;
      }
    }
  } catch (localError) {
    console.warn("Local update failed", localError);
  }

  // 2. Update Firebase
  const updateOp = async () => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, sanitizedUpdate);
  };

  try {
    await withTimeout(updateOp(), 6000);
    return { success: true, message: 'Paper updated successfully!' };
  } catch (error: any) {
    console.warn("Direct Firebase update failed:", error?.code, error?.message);

    const isPermissionError = error?.code === 'permission-denied' || 
      error?.message?.toLowerCase().includes('permission') || 
      error?.message?.toLowerCase().includes('insufficient');

    if (isPermissionError) {
      try {
        await withTimeout(executeAsAdmin(updateOp), 6000);
        return { success: true, message: 'Paper updated successfully!' };
      } catch (adminErr: any) {
        console.warn("Admin fallback update failed:", adminErr?.code);
      }
    }

    if (localUpdated) {
      return { success: true, message: 'Paper updated in device storage!' };
    }

    return { success: false, message: 'Failed to update paper. Please check connection.' };
  }
};

export const getSavedPapers = async (userId: string, isAdmin: boolean, forceRefresh: boolean = false): Promise<SavedPaper[]> => {
  const cacheKey = `${userId}-${isAdmin}`;
  const now = Date.now();
  
  if (!forceRefresh && cachedPapers[cacheKey] && (now - (lastFetchTime[cacheKey] || 0) < CACHE_DURATION)) {
    return cachedPapers[cacheKey];
  }

  // 1. Always load LocalStorage papers (Guaranteed instant availability)
  let localPapers: SavedPaper[] = [];
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed: SavedPaper[] = JSON.parse(stored);
      localPapers = isAdmin ? parsed : parsed.filter((p: SavedPaper) => p.userId === userId);
    }
  } catch (e) {
    console.warn("Local papers fetch failed", e);
  }

  // 2. Fetch from Firebase Cloud
  let cloudPapers: SavedPaper[] = [];
  const fetchOp = async () => {
    let q;
    if (isAdmin) {
      q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(1000)); 
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as SavedPaper);
    } else {
      try {
        q = query(collection(db, COLLECTION), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(1000));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as SavedPaper);
      } catch (indexErr: any) {
        console.warn("Composite index query failed, falling back to simple where query", indexErr?.message);
        q = query(collection(db, COLLECTION), where("userId", "==", userId), limit(1000));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as SavedPaper);
      }
    }
  };

  try {
    cloudPapers = await withTimeout(fetchOp(), 6000);
  } catch (error: any) {
    console.warn("Cloud fetch failed, trying admin if permission issue:", error?.code);
    if (error?.code === 'permission-denied') {
      try {
        cloudPapers = await withTimeout(executeAsAdmin(fetchOp), 6000);
      } catch (adminErr) {
        console.warn("Admin fallback cloud fetch failed", adminErr);
      }
    }
  }

  // 3. Merge Local & Cloud Papers (Deduplicate by ID, keeping most comprehensive data)
  const paperMap = new Map<string, SavedPaper>();
  localPapers.forEach(p => { if (p && p.id) paperMap.set(p.id, p); });
  cloudPapers.forEach(p => { if (p && p.id) paperMap.set(p.id, p); });

  const mergedPapers = Array.from(paperMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  // Update memory cache
  cachedPapers[cacheKey] = mergedPapers;
  lastFetchTime[cacheKey] = now;

  return mergedPapers;
};

export const deletePaper = async (id: string): Promise<void> => {
  // Clear cache
  cachedPapers = {};
  lastFetchTime = {};
  cachedPaperCount = {};
  lastPaperCountFetchTime = {};

  try {
    const adminStored = localStorage.getItem('total_papers_count_admin');
    if (adminStored !== null) {
      const prev = parseInt(adminStored, 10);
      if (!isNaN(prev)) localStorage.setItem('total_papers_count_admin', Math.max(0, prev - 1).toString());
    }
  } catch (_) {}

  // 1. Delete from LocalStorage immediately
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const papers = JSON.parse(stored);
      const updatedPapers = papers.filter((p: SavedPaper) => p.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPapers));
      syncService.optimisticPaperDeleted();
    }
  } catch (e) {
    console.warn("Local delete failed", e);
  }

  // 2. Delete from Cloud
  const deleteOp = async () => {
    await deleteDoc(doc(db, COLLECTION, id));
  };

  try {
    await withTimeout(deleteOp(), 4000);
  } catch (error: any) {
    console.warn("Cloud delete failed, trying admin:", error?.code);
    if (error?.code === 'permission-denied') {
      try {
        await withTimeout(executeAsAdmin(deleteOp), 5000);
      } catch (adminErr) {
        console.warn("Admin fallback cloud delete failed", adminErr);
      }
    }
  }
};

/**
 * Real-time subscription for Saved Papers with instant local-first merge
 */
export const subscribeToSavedPapers = (
  userId: string, 
  isAdmin: boolean, 
  callback: (papers: SavedPaper[]) => void
): Unsubscribe => {
  const getMergedPapers = (cloudPapers: SavedPaper[] = []): SavedPaper[] => {
    let localPapers: SavedPaper[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: SavedPaper[] = JSON.parse(stored);
        localPapers = isAdmin ? parsed : parsed.filter((p: SavedPaper) => p.userId === userId);
      }
    } catch (_) {}

    const paperMap = new Map<string, SavedPaper>();
    localPapers.forEach(p => { if (p && p.id) paperMap.set(p.id, p); });
    cloudPapers.forEach(p => { if (p && p.id) paperMap.set(p.id, p); });

    return Array.from(paperMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  // 1. Immediately emit local data so UI loads with 0ms delay
  callback(getMergedPapers([]));

  // 2. Subscribe to Firestore live snapshots
  let q;
  if (isAdmin) {
    q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(1000));
  } else {
    q = query(collection(db, COLLECTION), where("userId", "==", userId), limit(1000));
  }

  return onSnapshot(q, (snapshot) => {
    const cloudPapers = snapshot.docs.map(doc => doc.data() as SavedPaper);
    callback(getMergedPapers(cloudPapers));
  }, (err) => {
    console.warn("Saved papers onSnapshot error:", err.message);
    // Fallback: continue providing local papers
    callback(getMergedPapers([]));
  });
};

