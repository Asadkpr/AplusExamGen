import { db } from '../firebaseConfig';
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
import { SUBJECTS_BY_CLASS } from '../constants';

const COLLECTION = 'subjects';
const VISIBILITY_COLLECTION = 'visibility_settings';
const VISIBILITY_DOC = 'custom_subjects';
const LOCAL_KEY = 'aplus_custom_subjects_v1';
const HIDDEN_KEY = 'aplus_hidden_subjects_v1';

// 🔹 Memory Cache
let cachedSubjects: Record<string, string[]> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute cache for fast cross-device sync

export const resetSubjectCache = () => {
  cachedSubjects = null;
  lastFetchTime = 0;
};

interface CustomSubject {
  id?: string;
  classLevel: string;
  name: string;
  createdAt: number;
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 2500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network/Quota timeout')), timeoutMs))
  ]);
};

/**
 * Combined list of subjects from Default Constants, Firebase Cloud, and Local Storage.
 * Filters out subjects that have been marked as "hidden" (deleted system subjects).
 */
export const getSubjects = async (forceRefresh: boolean = false): Promise<Record<string, string[]>> => {
  const now = Date.now();
  if (!forceRefresh && cachedSubjects && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedSubjects;
  }

  // 1. Load hidden subjects (deleted system subjects)
  let hidden: string[] = [];
  try {
    const storedHidden = localStorage.getItem(HIDDEN_KEY);
    if (storedHidden) hidden = JSON.parse(storedHidden);
  } catch (e) {}

  const cloudCustomSubjects: CustomSubject[] = [];

  // 2. Fetch from visibility_settings/custom_subjects (guaranteed permissions across all clients)
  try {
    const vsRef = doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC);
    const vsSnap = await withTimeout(getDoc(vsRef), 2500);
    if (vsSnap.exists()) {
      const data = vsSnap.data();
      if (Array.isArray(data.subjects)) {
        data.subjects.forEach((s: any) => {
          if (s && s.classLevel && s.name) {
            cloudCustomSubjects.push({
              classLevel: s.classLevel,
              name: String(s.name).trim(),
              createdAt: s.createdAt || Date.now()
            });
          }
        });
      }
      if (Array.isArray(data.hiddenSubjects)) {
        data.hiddenSubjects.forEach((h: string) => {
          if (h && !hidden.includes(h)) hidden.push(h);
        });
        try {
          localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn("Could not fetch custom_subjects from visibility_settings (quota or offline, using fallback)", e);
  }

  // 3. Fetch from subjects collection
  try {
    const snapshot = await withTimeout(getDocs(collection(db, COLLECTION)), 2500);
    snapshot.docs.forEach(docSnap => {
      const s = docSnap.data() as Partial<CustomSubject>;
      if (s && s.classLevel && s.name) {
        const cleanName = String(s.name).trim();
        const exists = cloudCustomSubjects.some(
          c => c.classLevel === s.classLevel && c.name.toLowerCase() === cleanName.toLowerCase()
        );
        if (!exists) {
          cloudCustomSubjects.push({
            id: docSnap.id,
            classLevel: s.classLevel,
            name: cleanName,
            createdAt: s.createdAt || Date.now()
          });
        }
      }
    });
  } catch (e) {
    console.warn("Could not fetch from subjects collection (quota or offline, using fallback)", e);
  }

  // 4. Initialize result with defaults, filtering out hidden ones
  const result: Record<string, string[]> = {};
  Object.keys(SUBJECTS_BY_CLASS).forEach(cls => {
    result[cls] = (SUBJECTS_BY_CLASS[cls] || []).filter(subj => !hidden.includes(`${cls}:${subj}`));
  });

  const addToResult = (classLevel: string, name: string) => {
    if (classLevel && name) {
      const cleanName = name.trim();
      const hideKey = `${classLevel}:${cleanName}`;
      if (hidden.includes(hideKey)) return; // Skip if hidden

      if (!result[classLevel]) result[classLevel] = [];
      if (!result[classLevel].includes(cleanName)) result[classLevel].push(cleanName);
    }
  };

  cloudCustomSubjects.forEach(s => addToResult(s.classLevel, s.name));

  // 5. Fetch from Local Storage (for offline or local subjects)
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const localSubjects: CustomSubject[] = JSON.parse(stored);
      if (Array.isArray(localSubjects)) {
        localSubjects.forEach(s => {
          if (s && s.classLevel && s.name) {
            addToResult(s.classLevel, s.name);
          }
        });
      }
    }
  } catch (e) {}

  // Cache and sync local storage backup
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cloudCustomSubjects));
  } catch (e) {}

  cachedSubjects = result;
  lastFetchTime = Date.now();

  return result;
};

/**
 * Adds a new subject to Firebase Cloud (both visibility_settings and subjects collection) and Local Storage.
 */
export const addSubject = async (classLevel: string, newSubject: string): Promise<boolean> => {
  // Clear cache
  cachedSubjects = null;
  lastFetchTime = 0;

  const cleanName = newSubject.trim();
  if (!cleanName || !classLevel) return false;
  const hideKey = `${classLevel}:${cleanName}`;

  // 1. Unhide in localStorage if previously hidden
  try {
    const storedHidden = localStorage.getItem(HIDDEN_KEY);
    if (storedHidden) {
      let hidden: string[] = JSON.parse(storedHidden);
      if (hidden.includes(hideKey)) {
        hidden = hidden.filter(h => h !== hideKey);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
      }
    }
  } catch (e) {}

  const newEntry: CustomSubject = {
    classLevel,
    name: cleanName,
    createdAt: Date.now()
  };

  // 2. Save to visibility_settings/custom_subjects (guaranteed Firestore permissions for all users)
  try {
    const vsRef = doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC);
    const vsSnap = await withTimeout(getDoc(vsRef), 2500);
    let subjectsList: CustomSubject[] = [];
    let cloudHidden: string[] = [];
    if (vsSnap.exists()) {
      const data = vsSnap.data();
      subjectsList = Array.isArray(data.subjects) ? [...data.subjects] : [];
      cloudHidden = Array.isArray(data.hiddenSubjects) ? [...data.hiddenSubjects] : [];
    }

    // Unhide in cloud
    cloudHidden = cloudHidden.filter(h => h !== hideKey);

    // Add subject if not duplicate
    const exists = subjectsList.some(
      s => s.classLevel === classLevel && s.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (!exists) {
      subjectsList.push(newEntry);
    }

    await withTimeout(setDoc(vsRef, {
      subjects: subjectsList,
      hiddenSubjects: cloudHidden,
      updatedAt: Date.now()
    }, { merge: true }), 2500);
  } catch (e) {
    console.warn("Could not save subject to visibility_settings cloud directly (saved locally):", e);
  }

  // 3. Also save to subjects collection
  try {
    const q = query(collection(db, COLLECTION), where("classLevel", "==", classLevel), where("name", "==", cleanName));
    const querySnapshot = await withTimeout(getDocs(q), 2500);
    if (querySnapshot.empty) {
      await withTimeout(addDoc(collection(db, COLLECTION), newEntry), 2500);
    }
  } catch (e) {
    console.warn("Could not save to subjects collection directly", e);
  }

  // 4. Update Local Storage
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    const subjects: CustomSubject[] = stored ? JSON.parse(stored) : [];
    if (!subjects.some(s => s.classLevel === classLevel && s.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      subjects.push(newEntry);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(subjects));
    }
  } catch (e) {}

  return true;
};

/**
 * Renames an existing custom subject in both Firebase Cloud and Local Storage.
 */
export const renameSubject = async (classLevel: string, oldName: string, newName: string): Promise<boolean> => {
  // Clear cache
  cachedSubjects = null;
  lastFetchTime = 0;

  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();
  if (cleanOld === cleanNew || !cleanNew) return true;

  const oldHideKey = `${classLevel}:${cleanOld}`;
  const newEntry: CustomSubject = {
    classLevel,
    name: cleanNew,
    createdAt: Date.now()
  };

  // 1. Update in visibility_settings
  try {
    const vsRef = doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC);
    const vsSnap = await withTimeout(getDoc(vsRef), 2500);
    let subjectsList: CustomSubject[] = [];
    let cloudHidden: string[] = [];
    if (vsSnap.exists()) {
      const data = vsSnap.data();
      subjectsList = Array.isArray(data.subjects) ? [...data.subjects] : [];
      cloudHidden = Array.isArray(data.hiddenSubjects) ? [...data.hiddenSubjects] : [];
    }

    const idx = subjectsList.findIndex(
      s => s.classLevel === classLevel && s.name.trim().toLowerCase() === cleanOld.toLowerCase()
    );

    if (idx !== -1) {
      subjectsList[idx].name = cleanNew;
    } else {
      // Default system subject: hide old and add new
      if (!cloudHidden.includes(oldHideKey)) cloudHidden.push(oldHideKey);
      subjectsList.push(newEntry);
    }

    await withTimeout(setDoc(vsRef, {
      subjects: subjectsList,
      hiddenSubjects: cloudHidden,
      updatedAt: Date.now()
    }, { merge: true }), 2500);
  } catch (e) {
    console.warn("Failed to rename in visibility_settings cloud", e);
  }

  // 2. Update in subjects collection
  try {
    const q = query(collection(db, COLLECTION), where("classLevel", "==", classLevel), where("name", "==", cleanOld));
    const querySnapshot = await withTimeout(getDocs(q), 2500);
    if (!querySnapshot.empty) {
      const docRef = doc(db, COLLECTION, querySnapshot.docs[0].id);
      await withTimeout(updateDoc(docRef, { name: cleanNew }), 2500);
    }
  } catch (e) {
    console.warn("Update in subjects collection failed", e);
  }

  // 3. Sync Local Storage
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const subjects: CustomSubject[] = JSON.parse(stored);
      const index = subjects.findIndex(
        s => s.classLevel === classLevel && s.name.trim().toLowerCase() === cleanOld.toLowerCase()
      );
      if (index !== -1) {
        subjects[index].name = cleanNew;
      } else {
        subjects.push(newEntry);
      }
      localStorage.setItem(LOCAL_KEY, JSON.stringify(subjects));
    }
  } catch (e) {}

  return true;
};

/**
 * Deletes a subject. If it's a system subject, it's added to a "hidden" list.
 */
export const deleteSubject = async (classLevel: string, subjectToDelete: string): Promise<void> => {
  // Clear cache
  cachedSubjects = null;
  lastFetchTime = 0;

  const cleanName = subjectToDelete.trim();
  const hideKey = `${classLevel}:${cleanName}`;

  // 1. Update localStorage hidden list
  try {
    const storedHidden = localStorage.getItem(HIDDEN_KEY);
    const hidden: string[] = storedHidden ? JSON.parse(storedHidden) : [];
    if (!hidden.includes(hideKey)) {
      hidden.push(hideKey);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
    }
  } catch (e) {}

  // 2. Cloud Delete / Update in visibility_settings
  try {
    const vsRef = doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC);
    const vsSnap = await withTimeout(getDoc(vsRef), 2500);
    if (vsSnap.exists()) {
      const data = vsSnap.data();
      let subjectsList: CustomSubject[] = Array.isArray(data.subjects) ? [...data.subjects] : [];
      let cloudHidden: string[] = Array.isArray(data.hiddenSubjects) ? [...data.hiddenSubjects] : [];

      subjectsList = subjectsList.filter(
        s => !(s.classLevel === classLevel && s.name.trim().toLowerCase() === cleanName.toLowerCase())
      );
      if (!cloudHidden.includes(hideKey)) {
        cloudHidden.push(hideKey);
      }

      await withTimeout(setDoc(vsRef, {
        subjects: subjectsList,
        hiddenSubjects: cloudHidden,
        updatedAt: Date.now()
      }, { merge: true }), 2500);
    }
  } catch (e) {
    console.warn("Failed to delete subject from visibility_settings", e);
  }

  // 3. Delete from subjects collection
  try {
    const q = query(collection(db, COLLECTION), where("classLevel", "==", classLevel), where("name", "==", cleanName));
    const querySnapshot = await withTimeout(getDocs(q), 2500);
    if (!querySnapshot.empty) {
      const deletePromises = querySnapshot.docs.map(d => withTimeout(deleteDoc(doc(db, COLLECTION, d.id)), 2500));
      await Promise.all(deletePromises);
    }
  } catch (e) {
    console.warn("Delete from subjects collection failed", e);
  }

  // 4. Local Storage Delete
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const subjects: CustomSubject[] = JSON.parse(stored);
      const filtered = subjects.filter(
        s => !(s.classLevel === classLevel && s.name.trim().toLowerCase() === cleanName.toLowerCase())
      );
      localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}
};
