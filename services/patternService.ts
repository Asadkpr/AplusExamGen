
import { db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  getDocsFromCache,
  setDoc, 
  deleteDoc, 
  doc,
  getDoc,
  query,
  where,
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
const CACHE_TIME_KEY = 'aplus_all_patterns_cache_time';

// 🔹 Memory Cache
let cachedPatterns: PaperPattern[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache to prevent Firestore quota exhaustion

let cachedPatternCount: number | null = null;
let lastPatternCountFetchTime = 0;

export const resetPatternCache = () => {
  cachedPatterns = null;
  lastFetchTime = 0;
  cachedPatternCount = null;
  lastPatternCountFetchTime = 0;
  try {
    localStorage.removeItem(CACHE_TIME_KEY);
  } catch (_) {}
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
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
    const snapshot = await Promise.race([countPromise, timeoutPromise]) as any;
    const count = snapshot.data().count;
    cachedPatternCount = count;
    lastPatternCountFetchTime = now;
    localStorage.setItem('total_patterns_count', count.toString());
    return count;
  } catch (error) {
    // Return cached count or local storage without downloading 1600 documents
    return cachedPatternCount || parseInt(localStorage.getItem('total_patterns_count') || '0', 10);
  }
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

/**
 * Fast scoped pattern fetcher for GeneratePaper:
 * Queries only patterns matching the selected classLevel ( ~50-120 docs instead of 1,650 docs )
 * when full cache is cold on a new domain!
 */
export const getPatternsByClassAndSubject = async (
  classLevel: string,
  subject: string
): Promise<PaperPattern[]> => {
  const targetClass = (classLevel || '').trim().toLowerCase();
  const targetSubject = (subject || '').trim().toLowerCase();

  const matchesClassAndSubj = (p: PaperPattern) => {
    const pSubj = (p.subject || '').trim().toLowerCase();
    const pClass = (p.classLevel || '').trim().toLowerCase();
    const subjMatch = !pSubj || pSubj === targetSubject;
    const classMatch = !pClass || pClass === targetClass;
    return subjMatch && classMatch;
  };

  // 1. If full patterns are already in memory or localStorage cache, filter in 0ms
  if (cachedPatterns && cachedPatterns.length > 0) {
    return cachedPatterns.filter(matchesClassAndSubj);
  }
  try {
    const storedCache = localStorage.getItem(CACHE_KEY);
    if (storedCache) {
      const parsed: PaperPattern[] = JSON.parse(storedCache);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedPatterns = parsed;
        return parsed.filter(matchesClassAndSubj);
      }
    }
  } catch (_) {}

  // 2. Cold cache on a new domain: query scoped by classLevel for <1s response!
  let hiddenPatternIds: string[] = [];
  try {
    const visibility = await getVisibilitySettings();
    hiddenPatternIds = visibility.hiddenPatternIds || [];
  } catch (_) {}

  try {
    const q = query(collection(db, COLLECTION), where('classLevel', '==', classLevel.trim()));
    const fetchPromise = getDocs(q);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Scoped pattern fetch timeout')), 12000)
    );
    const snap = (await Promise.race([fetchPromise, timeoutPromise])) as any;
    const docs: PaperPattern[] = snap.docs.map((d: any) => ({ ...d.data(), id: d.id } as PaperPattern));
    const filtered = docs.filter(p => !hiddenPatternIds.includes(p.id) && matchesClassAndSubj(p));
    if (filtered.length > 0) {
      return filtered;
    }
  } catch (e) {
    console.warn('Scoped pattern query fallback:', e);
  }

  // 3. Fallback to full getPatterns
  const all = await getPatterns(false);
  return all.filter(matchesClassAndSubj);
};

export const getPatterns = async (forceRefresh: boolean = false): Promise<PaperPattern[]> => {
  const now = Date.now();
  if (!forceRefresh) {
    if (cachedPatterns && cachedPatterns.length > 0 && (now - lastFetchTime < CACHE_DURATION)) {
      return cachedPatterns;
    }
    try {
      const storedTime = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0', 10);
      const storedCache = localStorage.getItem(CACHE_KEY);
      if (storedCache && (now - storedTime < CACHE_DURATION)) {
        const parsed = JSON.parse(storedCache);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedPatterns = parsed;
          lastFetchTime = storedTime;
          return parsed;
        }
      }
    } catch (_) {}
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
        setTimeout(() => reject(new Error("Firebase fetch timeout")), 25000)
      );
      
      const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]) as any;
      const fetched = querySnapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as PaperPattern));
      mergedPatterns.push(...fetched);
      fetchSucceeded = true;
    } catch (e: any) {
      console.warn("Firebase fetch patterns failed or timed out (using local backup):", e.message);
    }

    if (!fetchSucceeded) {
      try {
        const cacheSnap = await getDocsFromCache(collection(db, COLLECTION));
        if (!cacheSnap.empty) {
          const cachedDocs = cacheSnap.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as PaperPattern));
          mergedPatterns.push(...cachedDocs);
        }
      } catch (_) {}

      try {
        const stored = localStorage.getItem(CACHE_KEY) || localStorage.getItem(LOCAL_KEY);
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
    }

    const finalPatterns = mergedPatterns.filter(p => !hiddenPatternIds.includes(p.id));
    
    // Update local cache & memory so all devices stay in sync with cloud truth
    if (fetchSucceeded || finalPatterns.length > 0) {
      const fetchTs = Date.now();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(finalPatterns));
        if (fetchSucceeded) {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(finalPatterns));
          localStorage.setItem(CACHE_TIME_KEY, fetchTs.toString());
        }
      } catch (e) {}
      cachedPatterns = finalPatterns;
      lastFetchTime = fetchTs;
      if (finalPatterns.length > 0) {
        syncService.setExactPatternCount(finalPatterns.length);
      }
    }
    
    return finalPatterns;
  };

  // Try fetching fresh data first, with fallback to stored cache if fetch fails
  try {
    return await fetchMergedPatterns();
  } catch (_) {
    try {
      const storedCache = localStorage.getItem(CACHE_KEY) || localStorage.getItem(LOCAL_KEY);
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
 * Subscription for Patterns with instant local-first emission and quota-safe cloud fetch
 */
export const subscribeToPatterns = (
  callback: (patterns: PaperPattern[]) => void
): Unsubscribe => {
  let isCancelled = false;

  // 1. Immediately emit cached or local patterns for 0ms render
  if (cachedPatterns && cachedPatterns.length > 0) {
    callback(cachedPatterns);
  } else {
    try {
      const storedCache = localStorage.getItem(CACHE_KEY) || localStorage.getItem(LOCAL_KEY);
      if (storedCache) {
        const parsed = JSON.parse(storedCache);
        if (Array.isArray(parsed) && parsed.length > 0) {
          callback(parsed);
        }
      }
    } catch (_) {}
  }

  // 2. Fetch patterns using quota-safe cached getPatterns
  getPatterns(false).then((patterns) => {
    if (!isCancelled) {
      callback(patterns);
    }
  }).catch(() => {});

  return () => {
    isCancelled = true;
  };
};

