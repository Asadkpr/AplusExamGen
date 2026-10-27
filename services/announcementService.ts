import { db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { Announcement } from '../types';
import { executeAsAdmin } from './authService';
import { syncService } from './syncService';

const COLLECTION = 'announcements';
const LOCAL_STORAGE_KEY = 'aplus_announcements_cache_v1';
const DELETED_IDS_KEY = 'aplus_deleted_announcements_v1';

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'default-welcome-1',
    title: 'Welcome to APLUS ExamGen - Smart Paper Generation System',
    content: 'Easily create custom examination papers, manage question bank, and print high-quality exams for all classes.',
    type: 'update',
    author: 'Admin',
    createdAt: 1769374000000
  }
];

// 🔹 Memory Cache
let cachedAnnouncements: Announcement[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const resetAnnouncementCache = () => {
  cachedAnnouncements = null;
  lastFetchTime = 0;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 3500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
  ]);
};

// Clean object for Firestore so undefined is never passed
const cleanForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore).filter(x => x !== undefined);
  const res: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) res[key] = cleanForFirestore(obj[key]);
  }
  return res;
};

const getDeletedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (_) {}
  return new Set();
};

const addDeletedId = (id: string) => {
  try {
    const set = getDeletedIds();
    set.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch (_) {}
};

export const getCachedAnnouncementsSync = (): Announcement[] => {
  if (cachedAnnouncements && cachedAnnouncements.length > 0) return cachedAnnouncements;
  try {
    const deletedIds = getDeletedIds();
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed: Announcement[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter(a => a && a.id && !deletedIds.has(a.id));
        if (filtered.length > 0) {
          filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          cachedAnnouncements = filtered;
          return filtered;
        }
      }
    }
  } catch (_) {}
  return DEFAULT_ANNOUNCEMENTS;
};

export const getAnnouncements = async (forceRefresh: boolean = false): Promise<Announcement[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedAnnouncements && cachedAnnouncements.length > 0 && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedAnnouncements;
  }

  const deletedIds = getDeletedIds();
  const localList = getCachedAnnouncementsSync().filter(a => !deletedIds.has(a.id));

  try {
    let cloudAnnouncements: Announcement[] = [];
    try {
      const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(10));
      const snapshot = await withTimeout(getDocs(q), 8000);
      cloudAnnouncements = snapshot.docs.map(doc => doc.data() as Announcement);
    } catch (qErr) {
      console.warn("Ordered announcement query failed or timed out, trying basic query:", qErr);
      try {
        const qBasic = query(collection(db, COLLECTION), limit(20));
        const snapshot = await withTimeout(getDocs(qBasic), 6000);
        const docs = snapshot.docs.map(doc => doc.data() as Announcement);
        docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        cloudAnnouncements = docs.slice(0, 10);
      } catch (_) {}
    }

    // 1. If cloud returned announcements, Cloud DB is the source of truth!
    const validCloud = cloudAnnouncements.filter(a => a && a.id && !deletedIds.has(a.id));
    if (validCloud.length > 0) {
      validCloud.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cachedAnnouncements = validCloud;
      lastFetchTime = Date.now();
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(validCloud));
      } catch (_) {}
      return validCloud;
    }

    // 2. Fallback to Local List if cloud returned nothing
    if (localList.length > 0) {
      localList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cachedAnnouncements = localList;
      return localList;
    }

    return DEFAULT_ANNOUNCEMENTS;
  } catch (error) {
    console.warn("Error fetching announcements from cloud, using cache:", error);
    return getCachedAnnouncementsSync();
  }
};

export const saveAnnouncement = async (announcement: Omit<Announcement, 'id' | 'createdAt'>): Promise<boolean> => {
  const id = generateId();
  const data: Announcement = cleanForFirestore({
    ...announcement,
    id,
    createdAt: Date.now()
  });

  // 1. Immediately update cache and localStorage so it displays instantly at index 0
  const current = getCachedAnnouncementsSync();
  const updated = [data, ...current.filter(a => a.id !== 'default-welcome-1')];
  cachedAnnouncements = updated;
  lastFetchTime = Date.now();
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    syncService.optimisticAnnouncementAdded();
  } catch (_) {}

  // 2. Save to Firestore (Primary Cloud) with Admin fallback
  const saveOp = async () => {
    await setDoc(doc(db, COLLECTION, id), data);
    return true;
  };

  try {
    await withTimeout(saveOp(), 4000);
    return true;
  } catch (err: any) {
    console.warn("Direct announcement save failed, retrying with admin auth:", err?.code, err?.message);
    try {
      await withTimeout(executeAsAdmin(saveOp), 5000);
      return true;
    } catch (adminErr: any) {
      console.error("Admin fallback save also failed:", adminErr?.code, adminErr?.message);
      return true;
    }
  }
};

export const updateAnnouncement = async (announcement: Announcement): Promise<boolean> => {
  const data = cleanForFirestore(announcement);
  const current = getCachedAnnouncementsSync();
  const updated = current.map(a => a.id === data.id ? data : a);
  cachedAnnouncements = updated;
  lastFetchTime = Date.now();
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (_) {}

  const updateOp = async () => {
    await setDoc(doc(db, COLLECTION, data.id), data, { merge: true });
    return true;
  };

  try {
    await withTimeout(updateOp(), 4000);
    return true;
  } catch (err: any) {
    console.warn("Direct announcement update failed, retrying with admin auth:", err?.code);
    try {
      await withTimeout(executeAsAdmin(updateOp), 5000);
      return true;
    } catch (adminErr) {
      console.error("Admin update failed:", adminErr);
      return true;
    }
  }
};

export const deleteAnnouncement = async (id: string): Promise<boolean> => {
  // Track as deleted so cloud query NEVER revives it
  addDeletedId(id);

  const current = getCachedAnnouncementsSync();
  const updated = current.filter(a => a.id !== id);
  cachedAnnouncements = updated.length > 0 ? updated : DEFAULT_ANNOUNCEMENTS;
  lastFetchTime = Date.now();
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedAnnouncements));
    syncService.optimisticAnnouncementDeleted();
  } catch (_) {}

  const deleteOp = async () => {
    await deleteDoc(doc(db, COLLECTION, id));
    return true;
  };

  try {
    await withTimeout(deleteOp(), 4000);
    return true;
  } catch (err: any) {
    console.warn("Direct announcement delete failed, retrying with admin auth:", err?.code);
    try {
      await withTimeout(executeAsAdmin(deleteOp), 5000);
      return true;
    } catch (adminErr) {
      console.error("Admin delete failed:", adminErr);
      return true;
    }
  }
};

/**
 * Real-time subscription for Announcements
 */
export const subscribeToAnnouncements = (
  callback: (announcements: Announcement[]) => void
): Unsubscribe => {
  let isCancelled = false;

  // 1. Immediately emit current local/cached data
  callback(getCachedAnnouncementsSync());

  // 2. Fetch fresh announcements using quota-safe cached getAnnouncements
  getAnnouncements(false).then((list) => {
    if (!isCancelled && list && list.length > 0) {
      callback(list);
    }
  }).catch(() => {});

  return () => {
    isCancelled = true;
  };
};

