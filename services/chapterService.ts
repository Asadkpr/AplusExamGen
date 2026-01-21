
import { db } from '../firebaseConfig';
// Fixed: Changed from firebase/firestore/lite to firebase/firestore to resolve missing export errors
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
import { Chapter, Subtopic } from '../types';
import { getChaptersForSubject as getDefaultChapters } from '../constants';
import { getUploadedSubtopicsMap } from './questionService';
import { executeAsAdmin } from './authService';

const COLLECTION = 'chapters';
const UPLOADED_COLLECTION = 'uploaded_content';
export const VISIBILITY_COLLECTION = 'visibility_settings';
export const VISIBILITY_DOC = 'global';

export interface VisibilityState {
  hiddenChapterIds: string[];
  hiddenSubtopicNames: string[];
  hiddenPatternIds?: string[]; // Track hidden system patterns
  renamedChapterMap?: Record<string, string>; // Maps ID -> New Name
}

export const getVisibilitySettings = async (): Promise<VisibilityState> => {
  try {
    const docRef = doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as VisibilityState;
      return {
        hiddenChapterIds: data.hiddenChapterIds || [],
        hiddenSubtopicNames: data.hiddenSubtopicNames || [],
        hiddenPatternIds: data.hiddenPatternIds || [],
        renamedChapterMap: data.renamedChapterMap || {}
      };
    }
  } catch (e) {}
  return { hiddenChapterIds: [], hiddenSubtopicNames: [], hiddenPatternIds: [], renamedChapterMap: {} };
};

export const toggleVisibility = async (idOrName: string, type: 'chapter' | 'subtopic' | 'pattern', hide: boolean): Promise<void> => {
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

    await setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
      ...current,
      hiddenChapterIds,
      hiddenSubtopicNames,
      hiddenPatternIds
    }, { merge: true });
  };

  try {
    await updateOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      await executeAsAdmin(updateOp);
    }
  }
};

export const getChapters = async (subject: string, classLevel: string, filterHidden: boolean = false): Promise<Chapter[]> => {
  const visibility = await getVisibilitySettings();
  const defaults =
  subject.toLowerCase() === 'physics'
    ? []
    : getDefaultChapters(subject, classLevel);

  const customChapters: Chapter[] = [];

  const fetchCustomOp = async () => {
    const q = query(collection(db, COLLECTION), where("subject", "==", subject), where("classLevel", "==", cleanClass));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        subtopics: [], 
        availableQuestionTypes: data.availableQuestionTypes || ['MCQ', 'SHORT', 'LONG']
      } as Chapter;
    });
  };

  const cleanClass = classLevel.trim();

  try {
    const fetched = await fetchCustomOp();
    customChapters.push(...fetched);
  } catch (e: any) {
    if (e.code === 'permission-denied') {
       try {
          const fetched = await executeAsAdmin(fetchCustomOp);
          customChapters.push(...fetched);
       } catch(err) {}
    }
  }

  // Merge defaults and customs
  let combinedChapters = [...defaults, ...customChapters];
  
  // Apply overrides from visibility settings (Renames)
  combinedChapters = combinedChapters.map(ch => {
    if (visibility.renamedChapterMap && visibility.renamedChapterMap[ch.id]) {
      return { ...ch, name: visibility.renamedChapterMap[ch.id] };
    }
    return ch;
  });

  const uploadedSubtopicsMap = await getUploadedSubtopicsMap(subject, classLevel);
  
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

  // 🔹 IMPROVED NUMERICAL SORTING
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

  return combinedChapters;
};

export const addChapter = async (subject: string, classLevel: string, name: string): Promise<boolean> => {
  const newChapterData = {
    subject,
    classLevel,
    name: name.trim(),
    availableQuestionTypes: ['MCQ', 'SHORT', 'LONG', 'NUMERICAL', 'ESSAY', 'TRANSLATION'],
    createdAt: Date.now()
  };

  const addOp = async () => {
    await addDoc(collection(db, COLLECTION), newChapterData);
  };

  try {
    await addOp();
    return true;
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try {
        await executeAsAdmin(addOp);
        return true;
      } catch (err) {}
    }
  }
  return false;
};

export const renameChapter = async (id: string, newName: string): Promise<boolean> => {
  const updateOp = async () => {
    const docRef = doc(db, COLLECTION, id);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, { name: newName.trim() });
        return true;
      }
    } catch (e) {}

    const visibility = await getVisibilitySettings();
    const renamedMap = { ...(visibility.renamedChapterMap || {}) };
    renamedMap[id] = newName.trim();

    await setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
      renamedChapterMap: renamedMap
    }, { merge: true });
    
    return true;
  };

  try {
    return await updateOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try {
        return await executeAsAdmin(updateOp);
      } catch (err) {}
    }
  }
  return false;
};

export const deleteChapter = async (id: string): Promise<void> => {
  const deleteOp = async () => {
    const docRef = doc(db, COLLECTION, id);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await deleteDoc(docRef);
      }
    } catch (e) {}

    const visibility = await getVisibilitySettings();
    const hiddenIds = [...visibility.hiddenChapterIds];
    if (!hiddenIds.includes(id)) {
      hiddenIds.push(id);
      await setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
        hiddenChapterIds: hiddenIds
      }, { merge: true });
    }
  };

  try {
    await deleteOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try { await executeAsAdmin(deleteOp); } catch (err) {}
    }
  }
};

/**
 * Permanently deletes a chapter from 'chapters' AND its content from 'uploaded_content'
 */
export const deleteChapterPermanently = async (id: string): Promise<boolean> => {
  const deleteOp = async () => {
    // 1. Delete from Chapters Metadata
    const chapterRef = doc(db, COLLECTION, id);
    await deleteDoc(chapterRef).catch(() => {});

    // 2. Delete from Uploaded Content (Questions/Topics)
    const contentRef = doc(db, UPLOADED_COLLECTION, id);
    await deleteDoc(contentRef).catch(() => {});

    // 3. Clean Visibility Settings
    const visibility = await getVisibilitySettings();
    const updatedHidden = visibility.hiddenChapterIds.filter(cid => cid !== id);
    await setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
      ...visibility,
      hiddenChapterIds: updatedHidden
    }, { merge: true });

    return true;
  };

  try {
    return await deleteOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try {
        return await executeAsAdmin(deleteOp);
      } catch (err) {
        console.error("Admin permanent delete failed", err);
      }
    }
    return false;
  }
};
