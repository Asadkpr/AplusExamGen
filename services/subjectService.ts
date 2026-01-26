
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
  updateDoc 
} from 'firebase/firestore';
import { SUBJECTS_BY_CLASS } from '../constants';
import { executeAsAdmin } from './authService';

const COLLECTION = 'subjects';
const LOCAL_KEY = 'aplus_custom_subjects_v1';
const HIDDEN_KEY = 'aplus_hidden_subjects_v1';

interface CustomSubject {
  id?: string;
  classLevel: string;
  name: string;
  createdAt: number;
}

/**
 * Combined list of subjects from Default Constants, Firebase Cloud, and Local Storage.
 * Filters out subjects that have been marked as "hidden" (deleted system subjects).
 */
export const getSubjects = async (): Promise<Record<string, string[]>> => {
  // 1. Load hidden subjects (deleted system subjects)
  let hidden: string[] = [];
  try {
    const storedHidden = localStorage.getItem(HIDDEN_KEY);
    if (storedHidden) hidden = JSON.parse(storedHidden);
  } catch (e) {}

  const result: Record<string, string[]> = {};
  
  // 2. Initialize with defaults, filtering out hidden ones
  Object.keys(SUBJECTS_BY_CLASS).forEach(cls => {
    result[cls] = SUBJECTS_BY_CLASS[cls].filter(subj => !hidden.includes(`${cls}:${subj}`));
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

  // 3. Fetch from Firebase
  const fetchOp = async () => {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CustomSubject));
  };

  try {
    const subjects = await fetchOp();
    subjects.forEach(s => addToResult(s.classLevel, s.name));
  } catch (e: any) {
    if (e.code === 'permission-denied') {
       try {
         const subjects = await executeAsAdmin(fetchOp);
         subjects.forEach(s => addToResult(s.classLevel, s.name));
       } catch (err) {}
    }
  }

  // 4. Fetch from Local Storage
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const localSubjects: CustomSubject[] = JSON.parse(stored);
      localSubjects.forEach(s => addToResult(s.classLevel, s.name));
    }
  } catch (e) {}

  return result;
};

/**
 * Adds a new subject to both Firebase and Local Storage.
 */
export const addSubject = async (classLevel: string, newSubject: string): Promise<boolean> => {
  const cleanName = newSubject.trim();
  
  // Restore if it was previously hidden
  try {
    const storedHidden = localStorage.getItem(HIDDEN_KEY);
    if (storedHidden) {
      let hidden: string[] = JSON.parse(storedHidden);
      const hideKey = `${classLevel}:${cleanName}`;
      if (hidden.includes(hideKey)) {
        hidden = hidden.filter(h => h !== hideKey);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
        return true;
      }
    }
  } catch (e) {}

  const newEntry: CustomSubject = {
    classLevel,
    name: cleanName,
    createdAt: Date.now()
  };

  const addOp = async () => {
    const q = query(collection(db, COLLECTION), where("classLevel", "==", classLevel), where("name", "==", cleanName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) throw new Error("Duplicate");
    await addDoc(collection(db, COLLECTION), newEntry);
  };

  try {
    await addOp();
  } catch (e: any) {
    if (e.message === "Duplicate") return false;
    if (e.code === 'permission-denied') {
       try {
         await executeAsAdmin(addOp);
       } catch (err: any) {
          if (err.message === "Duplicate") return false;
       }
    }
  }

  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    const subjects: CustomSubject[] = stored ? JSON.parse(stored) : [];
    if (!subjects.some(s => s.classLevel === classLevel && s.name === cleanName)) {
      subjects.push(newEntry);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(subjects));
    }
  } catch (e) {}

  return true;
};

/**
 * Renames an existing custom subject in both Firebase and Local Storage.
 */
export const renameSubject = async (classLevel: string, oldName: string, newName: string): Promise<boolean> => {
  if (oldName === newName) return true;
  const cleanNewName = newName.trim();

  const updateOp = async () => {
    const q = query(collection(db, COLLECTION), where("classLevel", "==", classLevel), where("name", "==", oldName.trim()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // If system subject, we handle it as a delete + add
      await deleteSubject(classLevel, oldName);
      await addSubject(classLevel, cleanNewName);
      return true;
    }

    const docRef = doc(db, COLLECTION, querySnapshot.docs[0].id);
    await updateDoc(docRef, { name: cleanNewName });
    return true;
  };

  try {
    await updateOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try {
        await executeAsAdmin(updateOp);
      } catch (err) {
        return false;
      }
    } else {
      return false;
    }
  }

  // Sync Local Storage
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const subjects: CustomSubject[] = JSON.parse(stored);
      const index = subjects.findIndex(s => s.classLevel === classLevel && s.name === oldName.trim());
      if (index !== -1) {
        subjects[index].name = cleanNewName;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(subjects));
      }
    }
  } catch (e) {}

  return true; 
};

/**
 * Deletes a subject. If it's a system subject, it's added to a "hidden" list.
 */
export const deleteSubject = async (classLevel: string, subjectToDelete: string): Promise<void> => {
  const cleanName = subjectToDelete.trim();
  
  // 1. Handle hidden list for system subjects
  try {
    const storedHidden = localStorage.getItem(HIDDEN_KEY);
    const hidden: string[] = storedHidden ? JSON.parse(storedHidden) : [];
    const hideKey = `${classLevel}:${cleanName}`;
    if (!hidden.includes(hideKey)) {
      hidden.push(hideKey);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
    }
  } catch (e) {}

  // 2. Cloud Delete
  const deleteOp = async () => {
    const q = query(collection(db, COLLECTION), where("classLevel", "==", classLevel), where("name", "==", cleanName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, COLLECTION, d.id)));
      await Promise.all(deletePromises);
    }
  };

  try {
    await deleteOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
       try {
         await executeAsAdmin(deleteOp);
       } catch(err) {}
    }
  }

  // 3. Local Storage Delete
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored) {
      const subjects: CustomSubject[] = JSON.parse(stored);
      const filtered = subjects.filter(s => !(s.classLevel === classLevel && s.name === cleanName));
      localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}
};
