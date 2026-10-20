
import { db } from '../firebaseConfig';
// Fix: Consolidated modular imports from firebase/firestore
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { Chapter, Subtopic, QuestionType } from '../types';
import { getChaptersForSubject as getDefaultChapters } from '../constants';
import { getUploadedSubtopicsMap } from './questionService';

const COLLECTION = 'chapters';
const UPLOADED_COLLECTION = 'uploaded_content';
export const VISIBILITY_COLLECTION = 'visibility_settings';
export const VISIBILITY_DOC = 'global';
export const CUSTOM_CHAPTERS_DOC = 'custom_chapters';
export const LOCAL_CHAPTERS_KEY = 'aplus_custom_chapters_v1';

export interface CustomChapterRecord {
  id: string;
  subject: string;
  classLevel: string;
  name: string;
  availableQuestionTypes?: QuestionType[];
  createdAt: number;
}

// 🔹 Memory Cache
let cachedVisibility: VisibilityState | null = null;
let lastVisibilityFetchTime = 0;
let cachedChapters: Record<string, Chapter[]> = {};
let lastChaptersFetchTime: Record<string, number> = {};
const CACHE_DURATION = 45 * 1000; // 45 seconds for rapid multi-admin synchronization

export const resetChapterCache = () => {
  cachedVisibility = null;
  lastVisibilityFetchTime = 0;
  cachedChapters = {};
  lastChaptersFetchTime = {};
};

export interface VisibilityState {
  hiddenChapterIds: string[];
  hiddenSubtopicNames: string[];
  hiddenPatternIds?: string[]; // Track hidden system patterns
  renamedChapterMap?: Record<string, string>; // Maps ID -> New Name
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 6000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network/Quota timeout')), timeoutMs))
  ]);
};

export const getVisibilitySettings = async (forceRefresh: boolean = false): Promise<VisibilityState> => {
  const now = Date.now();
  if (!forceRefresh && cachedVisibility && (now - lastVisibilityFetchTime < CACHE_DURATION)) {
    return cachedVisibility;
  }

  try {
    const docRef = doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC);
    const docSnap = await withTimeout(getDoc(docRef), 6000);
    if (docSnap.exists()) {
      const data = docSnap.data() as VisibilityState;
      const result = {
        hiddenChapterIds: data.hiddenChapterIds || [],
        hiddenSubtopicNames: data.hiddenSubtopicNames || [],
        hiddenPatternIds: data.hiddenPatternIds || [],
        renamedChapterMap: data.renamedChapterMap || {}
      };
      
      // Update cache
      cachedVisibility = result;
      lastVisibilityFetchTime = Date.now();
      
      return result;
    }
  } catch (e) {}
  return { hiddenChapterIds: [], hiddenSubtopicNames: [], hiddenPatternIds: [], renamedChapterMap: {} };
};

export const toggleVisibility = async (idOrName: string, type: 'chapter' | 'subtopic' | 'pattern', hide: boolean): Promise<void> => {
  // Clear cache
  cachedVisibility = null;
  cachedChapters = {};

  const updateOp = async () => {
    const current = await getVisibilitySettings();
    let hiddenChapterIds = [...current.hiddenChapterIds];
    let hiddenSubtopicNames = [...current.hiddenSubtopicNames];
    let hiddenPatternIds = [...(current.hiddenPatternIds || [])];

    if (type === 'chapter') {
      if (hide) {
        if (!hiddenChapterIds.includes(idOrName)) hiddenChapterIds.push(idOrName);
      } else {
        hiddenChapterIds = hiddenChapterIds.filter(id => id !== idOrName);
      }
    } else if (type === 'subtopic') {
      if (hide) {
        if (!hiddenSubtopicNames.includes(idOrName)) hiddenSubtopicNames.push(idOrName);
      } else {
        hiddenSubtopicNames = hiddenSubtopicNames.filter(name => name !== idOrName);
      }
    } else if (type === 'pattern') {
      if (hide) {
        if (!hiddenPatternIds.includes(idOrName)) hiddenPatternIds.push(idOrName);
      } else {
        hiddenPatternIds = hiddenPatternIds.filter(id => id !== idOrName);
      }
    }

    await withTimeout(setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
      ...current,
      hiddenChapterIds,
      hiddenSubtopicNames,
      hiddenPatternIds
    }, { merge: true }), 2500);
  };

  try {
    await updateOp();
  } catch (e: any) {
    console.error("Update failed", e);
  }
};

export const getChapters = async (subject: string, classLevel: string, filterHidden: boolean = false, forceRefresh: boolean = false): Promise<Chapter[]> => {
  const cleanSubj = subject.trim();
  const cleanClass = classLevel.trim();
  const cacheKey = `${cleanSubj}-${cleanClass}-${filterHidden}`;
  const now = Date.now();
  
  if (!forceRefresh && cachedChapters[cacheKey] && (now - (lastChaptersFetchTime[cacheKey] || 0) < CACHE_DURATION)) {
    return cachedChapters[cacheKey];
  }

  const visibility = await getVisibilitySettings(forceRefresh);
  const defaults = getDefaultChapters(cleanSubj, cleanClass);

  const customMap = new Map<string, Chapter>();

  // 1. Load from visibility_settings/custom_chapters (central Firestore document accessible to all users)
  try {
    const vsRef = doc(db, VISIBILITY_COLLECTION, CUSTOM_CHAPTERS_DOC);
    const vsSnap = await withTimeout(getDoc(vsRef), 2500);
    if (vsSnap.exists()) {
      const data = vsSnap.data();
      if (Array.isArray(data.chapters)) {
        data.chapters.forEach((c: any) => {
          if (
            c && 
            String(c.subject || '').toLowerCase().trim() === cleanSubj.toLowerCase() && 
            String(c.classLevel || '').toLowerCase().trim() === cleanClass.toLowerCase()
          ) {
            customMap.set(c.id, {
              id: c.id,
              name: c.name,
              subtopics: [],
              availableQuestionTypes: c.availableQuestionTypes || ['MCQ', 'SHORT', 'LONG']
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn("Could not fetch from visibility_settings/custom_chapters:", e);
  }

  // 2. Load from LocalStorage (instant cache)
  try {
    const stored = localStorage.getItem(LOCAL_CHAPTERS_KEY);
    if (stored) {
      const list: CustomChapterRecord[] = JSON.parse(stored);
      list.forEach(c => {
        if (
          c && 
          c.subject.toLowerCase().trim() === cleanSubj.toLowerCase() && 
          c.classLevel.toLowerCase().trim() === cleanClass.toLowerCase()
        ) {
          if (!customMap.has(c.id)) {
            customMap.set(c.id, {
              id: c.id,
              name: c.name,
              subtopics: [],
              availableQuestionTypes: c.availableQuestionTypes || ['MCQ', 'SHORT', 'LONG']
            });
          }
        }
      });
    }
  } catch (e) {}

  // 3. Fetch from Firestore chapters collection with timeout
  try {
    const fetchCustomOp = async () => {
      const q = query(
        collection(db, COLLECTION), 
        where("subject", "==", cleanSubj), 
        where("classLevel", "==", cleanClass)
      );
      const querySnapshot = await withTimeout(getDocs(q), 2500);
      return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          subtopics: [], 
          availableQuestionTypes: data.availableQuestionTypes || ['MCQ', 'SHORT', 'LONG']
        } as Chapter;
      });
    };

    const cloudChapters = await fetchCustomOp();
    
    // Sync cloud chapters to customMap and localStorage
    try {
      const stored = localStorage.getItem(LOCAL_CHAPTERS_KEY);
      const localList: CustomChapterRecord[] = stored ? JSON.parse(stored) : [];
      let updatedLocal = false;

      cloudChapters.forEach(ch => {
        customMap.set(ch.id, ch);
        if (!localList.some(item => item.id === ch.id || item.name.toLowerCase().trim() === ch.name.toLowerCase().trim())) {
          localList.push({
            id: ch.id,
            subject: cleanSubj,
            classLevel: cleanClass,
            name: ch.name,
            availableQuestionTypes: ch.availableQuestionTypes,
            createdAt: Date.now()
          });
          updatedLocal = true;
        }
      });

      if (updatedLocal) {
        localStorage.setItem(LOCAL_CHAPTERS_KEY, JSON.stringify(localList));
      }
    } catch (e) {}
  } catch (e: any) {
    console.warn("Fetch custom chapters from cloud chapters collection (using central doc/local):", e?.message || e);
  }

  // Deduplicate against defaults (if default has exact same name)
  const customChapters: Chapter[] = [];
  customMap.forEach(ch => {
    const existsInDefaults = defaults.some(d => d.name.toLowerCase().trim() === ch.name.toLowerCase().trim());
    if (!existsInDefaults) {
      customChapters.push(ch);
    }
  });

  // Merge defaults and customs
  let combinedChapters = [...defaults, ...customChapters];
  
  // Apply overrides from visibility settings (Renames)
  combinedChapters = combinedChapters.map(ch => {
    if (visibility.renamedChapterMap && visibility.renamedChapterMap[ch.id]) {
      return { ...ch, name: visibility.renamedChapterMap[ch.id] };
    }
    return ch;
  });

  const uploadedSubtopicsMap = await getUploadedSubtopicsMap(cleanSubj, cleanClass, forceRefresh);
  
  combinedChapters = combinedChapters.map(chapter => {
    const subtopics = uploadedSubtopicsMap[chapter.id] || [];
    return {
      ...chapter,
      subtopics
    };
  });

  if (filterHidden) {
    combinedChapters = combinedChapters
      .filter(ch => !visibility.hiddenChapterIds.includes(ch.id))
      .map(ch => ({
        ...ch,
        subtopics: ch.subtopics.filter(st => !visibility.hiddenSubtopicNames.includes(st.name))
      }));
  }

  // 🔹 Numerical Sorting
  combinedChapters.sort((a, b) => {
    const extractNum = (str: string) => {
      const match = str.match(/\d+/);
      return match ? parseInt(match[0], 10) : Infinity;
    };
    
    const numA = extractNum(a.name);
    const numB = extractNum(b.name);
    
    if (numA !== numB) {
      return numA - numB;
    }
    
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Update cache
  cachedChapters[cacheKey] = combinedChapters;
  lastChaptersFetchTime[cacheKey] = Date.now();

  return combinedChapters;
};

export const addChapter = async (subject: string, classLevel: string, name: string): Promise<boolean> => {
  const cleanName = name.trim();
  const cleanSubj = subject.trim();
  const cleanClass = classLevel.trim();

  if (!cleanName || !cleanSubj || !cleanClass) return false;

  // Clear cache
  cachedChapters = {};
  lastChaptersFetchTime = {};

  const chapterId = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const newChapterRecord: CustomChapterRecord = {
    id: chapterId,
    subject: cleanSubj,
    classLevel: cleanClass,
    name: cleanName,
    availableQuestionTypes: ['MCQ', 'SHORT', 'LONG', 'NUMERICAL', 'ESSAY', 'TRANSLATION'] as QuestionType[],
    createdAt: Date.now()
  };

  // 1. Immediately save to LocalStorage (instant response, guaranteed survival offline/quota-exceeded)
  try {
    const stored = localStorage.getItem(LOCAL_CHAPTERS_KEY);
    const list: CustomChapterRecord[] = stored ? JSON.parse(stored) : [];
    const exists = list.some(
      c => c.subject.toLowerCase() === cleanSubj.toLowerCase() && 
           c.classLevel.toLowerCase() === cleanClass.toLowerCase() && 
           c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (!exists) {
      list.push(newChapterRecord);
      localStorage.setItem(LOCAL_CHAPTERS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn("Failed to save chapter to localStorage", e);
  }

  // 2. Also save to Firestore chapters collection with timeout safeguard
  try {
    const docRef = doc(db, COLLECTION, chapterId);
    await withTimeout(setDoc(docRef, newChapterRecord), 3500);
  } catch (e: any) {
    console.warn("Firestore chapter cloud write delayed or throttled (saved safely in local storage):", e?.message || e);
  }

  // 3. Save to visibility_settings/custom_chapters (central document for instant sync to all users)
  try {
    const vsRef = doc(db, VISIBILITY_COLLECTION, CUSTOM_CHAPTERS_DOC);
    const vsSnap = await withTimeout(getDoc(vsRef), 2500);
    let list: CustomChapterRecord[] = [];
    if (vsSnap.exists()) {
      const data = vsSnap.data();
      list = Array.isArray(data.chapters) ? [...data.chapters] : [];
    }
    const exists = list.some(
      c => c.subject.toLowerCase() === cleanSubj.toLowerCase() && 
           c.classLevel.toLowerCase() === cleanClass.toLowerCase() && 
           c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (!exists) {
      list.push(newChapterRecord);
      await withTimeout(setDoc(vsRef, { chapters: list, updatedAt: Date.now() }, { merge: true }), 2500);
    }
  } catch (e: any) {
    console.warn("Could not save to visibility_settings/custom_chapters:", e);
  }

  return true;
};

export const renameChapter = async (id: string, newName: string): Promise<boolean> => {
  // Clear cache
  cachedChapters = {};
  cachedVisibility = null;
  const cleanName = newName.trim();

  // 1. Update in LocalStorage
  try {
    const stored = localStorage.getItem(LOCAL_CHAPTERS_KEY);
    if (stored) {
      const list: CustomChapterRecord[] = JSON.parse(stored);
      const item = list.find(c => c.id === id);
      if (item) {
        item.name = cleanName;
        localStorage.setItem(LOCAL_CHAPTERS_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}

  const updateOp = async () => {
    // Update in visibility_settings/custom_chapters
    try {
      const vsRef = doc(db, VISIBILITY_COLLECTION, CUSTOM_CHAPTERS_DOC);
      const vsSnap = await withTimeout(getDoc(vsRef), 2000);
      if (vsSnap.exists()) {
        const data = vsSnap.data();
        let list: CustomChapterRecord[] = Array.isArray(data.chapters) ? [...data.chapters] : [];
        const item = list.find(c => c.id === id);
        if (item) {
          item.name = cleanName;
          await withTimeout(setDoc(vsRef, { chapters: list, updatedAt: Date.now() }, { merge: true }), 2000);
        }
      }
    } catch (e) {}

    const docRef = doc(db, COLLECTION, id);
    try {
      const docSnap = await withTimeout(getDoc(docRef), 2000);
      if (docSnap.exists()) {
        await withTimeout(updateDoc(docRef, { name: cleanName }), 2500);
        return true;
      }
    } catch (e) {}

    const visibility = await getVisibilitySettings();
    const renamedMap = { ...(visibility.renamedChapterMap || {}) };
    renamedMap[id] = cleanName;

    await withTimeout(setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
      renamedChapterMap: renamedMap
    }, { merge: true }), 2500);
    
    return true;
  };

  try {
    await updateOp();
    return true;
  } catch (e: any) {
    console.warn("Rename cloud op failed (saved locally)", e);
    return true;
  }
};

export const deleteChapter = async (id: string): Promise<void> => {
  // Clear cache
  cachedChapters = {};
  cachedVisibility = null;

  // 1. Remove from LocalStorage
  try {
    const stored = localStorage.getItem(LOCAL_CHAPTERS_KEY);
    if (stored) {
      const list: CustomChapterRecord[] = JSON.parse(stored);
      const filtered = list.filter(c => c.id !== id);
      localStorage.setItem(LOCAL_CHAPTERS_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}

  const deleteOp = async () => {
    // Remove from visibility_settings/custom_chapters
    try {
      const vsRef = doc(db, VISIBILITY_COLLECTION, CUSTOM_CHAPTERS_DOC);
      const vsSnap = await withTimeout(getDoc(vsRef), 2000);
      if (vsSnap.exists()) {
        const data = vsSnap.data();
        let list: CustomChapterRecord[] = Array.isArray(data.chapters) ? [...data.chapters] : [];
        const filtered = list.filter(c => c.id !== id);
        await withTimeout(setDoc(vsRef, { chapters: filtered, updatedAt: Date.now() }, { merge: true }), 2000);
      }
    } catch (e) {}

    const docRef = doc(db, COLLECTION, id);
    try {
      const docSnap = await withTimeout(getDoc(docRef), 2000);
      if (docSnap.exists()) {
        await withTimeout(deleteDoc(docRef), 2500);
      }
    } catch (e) {}

    const visibility = await getVisibilitySettings();
    const hiddenIds = [...visibility.hiddenChapterIds];
    if (!hiddenIds.includes(id)) {
      hiddenIds.push(id);
      await withTimeout(setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
        hiddenChapterIds: hiddenIds
      }, { merge: true }), 2500);
    }
  };

  try {
    await deleteOp();
  } catch (e: any) {
    console.warn("Delete cloud failed (removed locally)", e);
  }
};

/**
 * Permanently deletes a chapter from 'chapters' AND its content from 'uploaded_content'
 */
export const deleteChapterPermanently = async (id: string): Promise<boolean> => {
  // Clear cache
  cachedChapters = {};
  cachedVisibility = null;

  // 1. Remove from LocalStorage
  try {
    const stored = localStorage.getItem(LOCAL_CHAPTERS_KEY);
    if (stored) {
      const list: CustomChapterRecord[] = JSON.parse(stored);
      const filtered = list.filter(c => c.id !== id);
      localStorage.setItem(LOCAL_CHAPTERS_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}

  const deleteOp = async () => {
    // Remove from visibility_settings/custom_chapters
    try {
      const vsRef = doc(db, VISIBILITY_COLLECTION, CUSTOM_CHAPTERS_DOC);
      const vsSnap = await withTimeout(getDoc(vsRef), 2000);
      if (vsSnap.exists()) {
        const data = vsSnap.data();
        let list: CustomChapterRecord[] = Array.isArray(data.chapters) ? [...data.chapters] : [];
        const filtered = list.filter(c => c.id !== id);
        await withTimeout(setDoc(vsRef, { chapters: filtered, updatedAt: Date.now() }, { merge: true }), 2000);
      }
    } catch (e) {}

    // 1. Delete from Chapters Metadata
    const chapterRef = doc(db, COLLECTION, id);
    await withTimeout(deleteDoc(chapterRef), 2500).catch(() => {});

    // 2. Delete from Uploaded Content (Questions/Topics)
    const contentRef = doc(db, UPLOADED_COLLECTION, id);
    await withTimeout(deleteDoc(contentRef), 2500).catch(() => {});

    // 3. Clean Visibility Settings
    const visibility = await getVisibilitySettings();
    const updatedHidden = visibility.hiddenChapterIds.filter(cid => cid !== id);
    await withTimeout(setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
      ...visibility,
      hiddenChapterIds: updatedHidden
    }, { merge: true }), 2500);

    return true;
  };

  try {
    await deleteOp();
    return true;
  } catch (e: any) {
    console.warn("Delete permanently cloud failed (removed locally)", e);
    return true;
  }
};
