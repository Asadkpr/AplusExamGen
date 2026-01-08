
import { db } from '../firebaseConfig';
// Modular firestore imports from lite version
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore/lite';
import { PaperPattern } from '../types';
import { PAPER_PATTERNS as DEFAULT_PATTERNS } from '../constants';
import { executeAsAdmin } from './authService';

const COLLECTION = 'patterns';
const LOCAL_KEY = 'aplus_custom_patterns_v1';

// 🔹 Memory Cache for extreme speed on repeated access
let cachedPatterns: PaperPattern[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const getPatterns = async (forceRefresh: boolean = false): Promise<PaperPattern[]> => {
  // 1. Return from memory cache if valid and not forced
  const now = Date.now();
  if (!forceRefresh && cachedPatterns && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedPatterns;
  }

  const customPatterns: PaperPattern[] = [];
  
  const fetchOp = async () => {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PaperPattern));
  };

  // 2. Try Firebase
  try {
    const fetched = await fetchOp();
    customPatterns.push(...fetched);
  } catch (e: any) {
    console.warn("Firebase fetch patterns failed", e.code);
    if (e.code === 'permission-denied' || e.code === 'failed-precondition') {
       try {
         const fetched = await executeAsAdmin(fetchOp);
         customPatterns.push(...fetched);
       } catch (adminErr) {
         console.error("Admin fetch patterns failed", adminErr);
       }
    }
  }

  // 3. Try Local Storage
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const localPatterns: PaperPattern[] = JSON.parse(stored);
      localPatterns.forEach(p => {
        if (!customPatterns.find(cp => cp.id === p.id)) {
          customPatterns.push(p);
        }
      });
    }
  } catch (e) {
    console.error("Local fetch patterns error", e);
  }

  const allPatterns = [...DEFAULT_PATTERNS, ...customPatterns];
  
  // 4. Update memory cache
  cachedPatterns = allPatterns;
  lastFetchTime = now;

  return allPatterns;
};

export const savePattern = async (pattern: PaperPattern): Promise<boolean> => {
  const id = pattern.id || generateId();
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
    if (error.code === 'permission-denied') {
        try {
            await executeAsAdmin(saveOp);
            savedCloud = true;
        } catch(adminErr) {
            console.error("Admin save failed too", adminErr);
        }
    }
  }

  // Clear memory cache so next fetch gets fresh data
  cachedPatterns = null;

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
    return true; 
  } catch (e) {
    return savedCloud;
  }
};

export const deletePattern = async (id: string): Promise<void> => {
  const deleteOp = async () => {
    await deleteDoc(doc(db, COLLECTION, id));
  };

  try {
    await deleteOp();
  } catch (e: any) {
     if (e.code === 'permission-denied') {
        try {
            await executeAsAdmin(deleteOp);
        } catch(adminErr) {
            console.error("Admin delete failed", adminErr);
        }
    }
  }

  // Clear memory cache
  cachedPatterns = null;

  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const patterns = JSON.parse(stored);
      const filtered = patterns.filter((p: PaperPattern) => p.id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error("Local delete pattern error", e);
  }
};
