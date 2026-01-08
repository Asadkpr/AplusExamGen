
import { db } from '../firebaseConfig';
// Standard modular firestore imports from lite version
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
} from 'firebase/firestore/lite';
import { Chapter, Subtopic } from '../types';
import { getChaptersForSubject as getDefaultChapters } from '../constants';
import { getUploadedSubtopicsMap } from './questionService';
import { executeAsAdmin } from './authService';

const COLLECTION = 'chapters';
const VISIBILITY_COLLECTION = 'visibility_settings';
const VISIBILITY_DOC = 'global';

export interface VisibilityState {
  hiddenChapterIds: string[];
  hiddenSubtopicNames: string[];
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
        renamedChapterMap: data.renamedChapterMap || {}
      };
    }
  } catch (e) {}
  return { hiddenChapterIds: [], hiddenSubtopicNames: [], renamedChapterMap: {} };
};

export const toggleVisibility = async (idOrName: string, type: 'chapter' | 'subtopic', hide: boolean): Promise<void> => {
  const updateOp = async () => {
    const current = await getVisibilitySettings();
    let hiddenChapterIds = [...current.hiddenChapterIds];
    let hiddenSubtopicNames = [...current.hiddenSubtopicNames];

    if (type === 'chapter') {
      if (hide) {
        if (!hiddenChapterIds.includes(idOrName)) hiddenChapterIds.push(idOrName);
      } else {
        hiddenChapterIds = hiddenChapterIds.filter(id => id !== idOrName);
      }
    } else {
      if (hide) {
        if (!hiddenSubtopicNames.includes(idOrName)) hiddenSubtopicNames.push(idOrName);
      } else {
        hiddenSubtopicNames = hiddenSubtopicNames.filter(name => name !== idOrName);
      }
    }

    await setDoc(doc(db, VISIBILITY_COLLECTION, VISIBILITY_DOC), {
      ...current,
      hiddenChapterIds,
      hiddenSubtopicNames
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
  const defaults = getDefaultChapters(subject, classLevel);
  const customChapters: Chapter[] = [];

  const fetchCustomOp = async () => {
    const q = query(collection(db, COLLECTION), where("subject", "==", subject), where("classLevel", "==", classLevel));
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
  } else {
    // Even if not filtering for generation, we usually want to hide deleted ones in the management view 
    // unless specifically requested to show them. For Upload Paper, we hide them.
    combinedChapters = combinedChapters.filter(ch => !visibility.hiddenChapterIds.includes(ch.id));
  }

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
    // 1. Try to update custom chapter in Firestore
    const docRef = doc(db, COLLECTION, id);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, { name: newName.trim() });
        return true;
      }
    } catch (e) {
      // If error is not permission related, it might just not exist
    }

    // 2. If not in customs, it's a default. Handle via rename map.
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
    // 1. Try deleting from customs
    const docRef = doc(db, COLLECTION, id);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await deleteDoc(docRef);
        return;
      }
    } catch (e) {}

    // 2. If not found or failed, it's likely a default. Add to hidden list.
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
