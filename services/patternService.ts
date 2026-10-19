
import { db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc,
  getDoc,
  limit,
  getCountFromServer,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { PaperPattern } from '../types';
import { getVisibilitySettings, toggleVisibility } from './chapterService';
import { syncService } from './syncService';

const COLLECTION = 'patterns';
const LOCAL_KEY = 'aplus_custom_patterns_v1';
const CACHE_KEY = 'aplus_all_patterns_cache';

// 🔹 Memory Cache
let cachedPatterns: PaperPattern[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 25 * 1000; // 25 seconds for fast sync across devices

let cachedPatternCount: number | null = null;
let lastPatternCountFetchTime = 0;

export const resetPatternCache = () => {
  cachedPatterns = null;
  lastFetchTime = 0;
  cachedPatternCount = null;
  lastPatternCountFetchTime = 0;
};

export const getCachedPatternCountSync = () => {
  if (cachedPatternCount !== null) return cachedPatternCount;
  const stored = localStorage.getItem('total_patterns_count');
  if (stored) return parseInt(stored, 10);
  return null;
};

export const getPatternCount = async (forceRefresh: boolean = false): Promise<number> => {
  const now = Date.now();
  if (!forceRefresh && cachedPatternCount !== null && (now - lastPatternCountFetchTime < CACHE_DURATION)) {
    return cachedPatternCount;
  }
  try {
    const coll = collection(db, COLLECTION);
    const countPromise = getCountFromServer(coll);
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
    const snapshot = await Promise.race([countPromise, timeoutPromise]) as any;
    const count = snapshot.data().count;
    cachedPatternCount = count;
    lastPatternCountFetchTime = now;
    localStorage.setItem('total_patterns_count', count.toString());
    return count;
  } catch (error) {
    try {
      const coll = collection(db, COLLECTION);
      const docsPromise = getDocs(coll);
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const snapshot = await Promise.race([docsPromise, timeoutPromise]) as any;
      const count = snapshot.docs.length;
      cachedPatternCount = count;
      localStorage.setItem('total_patterns_count', count.toString());
      return count;
    } catch (fallbackError) {
      return cachedPatternCount || parseInt(localStorage.getItem('total_patterns_count') || '0', 10);
    }
  }
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const getPatterns = async (forceRefresh: boolean = false): Promise<PaperPattern[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedPatterns && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedPatterns;
  }

  let hiddenPatternIds: string[] = [];
  try {
    const visibility = await getVisibilitySettings();
    hiddenPatternIds = visibility.hiddenPatternIds || [];
  } catch (e) {
    console.warn("Could not load pattern visibility settings", e);
  }

  const fetchMergedPatterns = async (): Promise<PaperPattern[]> => {
    const mergedPatterns: PaperPattern[] = [];
    let fetchSucceeded = false;
    try {
      const fetchPromise = getDocs(collection(db, COLLECTION));
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Firebase fetch timeout")), 3500)
      );
      
      const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]) as any;
      const fetched = querySnapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as PaperPattern));
      mergedPatterns.push(...fetched);
      fetchSucceeded = true;
    } catch (e: any) {
      console.warn("Firebase fetch patterns failed or timed out (using local backup):", e.message);
    }

    try {
      const stored = localStorage.getItem(LOCAL_KEY);
      if (stored) {
        const localPatterns: PaperPattern[] = JSON.parse(stored);
        localPatterns.forEach(p => {
          if (!mergedPatterns.find(cp => cp.id === p.id)) {
            mergedPatterns.push(p);
          }
        });
      }
    } catch (e) {
      console.error("Local fetch patterns error", e);
    }

    const finalPatterns = mergedPatterns.filter(p => !hiddenPatternIds.includes(p.id));
    
    // Update local cache & memory
    if (fetchSucceeded || finalPatterns.length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(finalPatterns));
      } catch (e) {}
      cachedPatterns = finalPatterns;
      lastFetchTime = Date.now();
    }
    
    return finalPatterns;
  };

  // Try fetching fresh data first, with fallback to stored cache if fetch fails
  try {
    return await fetchMergedPatterns();
  } catch (_) {
    try {
      const storedCache = localStorage.getItem(CACHE_KEY);
      if (storedCache) {
        const parsed = JSON.parse(storedCache);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return cachedPatterns || [];
  }
};

export const savePattern = async (pattern: PaperPattern): Promise<boolean> => {
  const id = pattern.id || generateId();
  
  // If we are re-saving a previously hidden pattern, make it visible again
  try {
    const visibility = await getVisibilitySettings();
    if (visibility.hiddenPatternIds?.includes(id)) {
      await toggleVisibility(id, 'pattern', false);
    }
  } catch (e) {}

  const newPattern = { ...pattern, id };
  const sanitizedPattern = JSON.parse(JSON.stringify(newPattern));

  let savedCloud = false;

  const saveOp = async () => {
     await setDoc(doc(db, COLLECTION, id), sanitizedPattern);
  };

  try {
    await saveOp();
    savedCloud = true;
  } catch (error: any) {
    console.error("Save failed", error);
  }

  // Clear memory and local cache so next fetch gets fresh data
  cachedPatterns = null;
  cachedPatternCount = null;
  lastPatternCountFetchTime = 0;
  try {
    localStorage.removeItem(CACHE_KEY);
    const prevCountStr = localStorage.getItem('total_patterns_count');
    if (prevCountStr !== null) {
      const prev = parseInt(prevCountStr, 10);
      if (!isNaN(prev)) localStorage.setItem('total_patterns_count', (prev + 1).toString());
    }
  } catch (e) {}

  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    const patterns: PaperPattern[] = stored ? JSON.parse(stored) : [];
    const index = patterns.findIndex(p => p.id === id);
    if (index >= 0) {
      patterns[index] = sanitizedPattern;
    } else {
      patterns.push(sanitizedPattern);
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(patterns));
    syncService.optimisticPatternAdded();
    return true; 
  } catch (e) {
    syncService.optimisticPatternAdded();
    return savedCloud;
  }
};

export const deletePattern = async (id: string): Promise<void> => {
  // Clear memory and local cache immediately
  cachedPatterns = null;
  cachedPatternCount = null;
  lastPatternCountFetchTime = 0;
  try {
    localStorage.removeItem(CACHE_KEY);
    const prevCountStr = localStorage.getItem('total_patterns_count');
    if (prevCountStr !== null) {
      const prev = parseInt(prevCountStr, 10);
      if (!isNaN(prev)) localStorage.setItem('total_patterns_count', Math.max(0, prev - 1).toString());
    }
  } catch (e) {}

  const deleteOp = async () => {
    // 1. Check if it's a custom pattern in the DB
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      await deleteDoc(docRef);
    }
    
    // 2. Regardless of whether it's custom or default, hide it globally
    // This allows admins to "delete" hardcoded system patterns
    await toggleVisibility(id, 'pattern', true);
  };

  try {
    await deleteOp();
  } catch (e: any) {
     console.error("Delete failed", e);
  }

  // 3. Local Storage Sync
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const patterns = JSON.parse(stored);
      const filtered = patterns.filter((p: PaperPattern) => p.id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
      syncService.optimisticPatternDeleted();
    }
  } catch (e) {
    console.error("Local delete pattern error", e);
  }
};

/**
 * Real-time subscription for Patterns with instant local-first emission
 */
export const subscribeToPatterns = (
  callback: (patterns: PaperPattern[]) => void
): Unsubscribe => {
  let localPatterns: PaperPattern[] = [];
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) localPatterns = JSON.parse(stored);
  } catch (_) {}

  // 1. Immediately emit local patterns for 0ms render
  callback(localPatterns);

  // 2. Subscribe to Firestore live snapshots
  return onSnapshot(collection(db, COLLECTION), async (snapshot) => {
    const cloudPatterns = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PaperPattern));
    
    // Merge cloud and local patterns
    const map = new Map<string, PaperPattern>();
    localPatterns.forEach(p => { if (p && p.id) map.set(p.id, p); });
    cloudPatterns.forEach(p => { if (p && p.id) map.set(p.id, p); });

    let hiddenPatternIds: string[] = [];
    try {
      const visibility = await getVisibilitySettings();
      hiddenPatternIds = visibility.hiddenPatternIds || [];
    } catch (_) {}

    const merged = Array.from(map.values()).filter(p => !hiddenPatternIds.includes(p.id));
    cachedPatterns = merged;
    lastFetchTime = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    } catch (_) {}
    callback(merged);
  }, (err) => {
    console.warn("Patterns onSnapshot error:", err.message);
    callback(localPatterns);
  });
};

