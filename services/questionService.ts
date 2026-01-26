
import { db } from '../firebaseConfig';
// Fix: Consolidated modular imports from firebase/firestore
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { Question, Subtopic, Chapter } from '../types';
import { executeAsAdmin } from './authService';

const COLLECTION = 'uploaded_content';
const CONTENT_CACHE_KEY = 'aplus_content_cache_v2'; 

interface UploadedContent {
  chapterId: string;
  questions: Question[];
  subtopics: Subtopic[];
  subject: string;
  classLevel: string;
  updatedAt: number;
}

export const getAllClassUploadedContent = async (classLevel: string): Promise<UploadedContent[]> => {
  const cleanClass = classLevel.trim();
  
  const fetchOp = async () => {
    const q = query(
      collection(db, COLLECTION), 
      where("classLevel", "==", cleanClass)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UploadedContent);
  };

  try {
    let data: UploadedContent[] = [];
    try {
      data = await fetchOp();
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        data = await executeAsAdmin(fetchOp);
      } else { throw e; }
    }

    try {
       const stored = localStorage.getItem(CONTENT_CACHE_KEY);
       const cache = stored ? JSON.parse(stored) : {};
       data.forEach(item => { cache[item.chapterId] = item; });
       localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
    } catch(e) {}

    return data;
  } catch (e) {
    console.error("Bulk fetch failed", e);
    return [];
  }
};

export const saveUploadedChapterContent = async (
  chapterId: string, 
  subject: string,
  classLevel: string,
  newQuestions: Question[], 
  newSubtopics: Subtopic[]
): Promise<boolean> => {
  
  let existingQuestions: Question[] = [];
  let existingSubtopics: Subtopic[] = [];
  const docRef = doc(db, COLLECTION, chapterId);

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as UploadedContent;
      existingQuestions = data.questions || [];
      existingSubtopics = data.subtopics || [];
    }
  } catch (e) {
    console.warn("Could not fetch existing content for merge, starting fresh.", e);
  }

  const mergedQuestions = [...existingQuestions, ...newQuestions];
  const subtopicMap = new Map<string, Subtopic>();
  existingSubtopics.forEach(s => subtopicMap.set(s.name.toLowerCase().trim(), s));
  newSubtopics.forEach(s => subtopicMap.set(s.name.toLowerCase().trim(), s));
  const mergedSubtopics = Array.from(subtopicMap.values());

  const rawData: UploadedContent = {
    chapterId,
    subject: subject.trim(),
    classLevel: classLevel.trim(),
    questions: mergedQuestions,
    subtopics: mergedSubtopics,
    updatedAt: Date.now()
  };

  const data = JSON.parse(JSON.stringify(rawData));

  try {
    const stored = localStorage.getItem(CONTENT_CACHE_KEY);
    const cache = stored ? JSON.parse(stored) : {};
    cache[chapterId] = data;
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Local cache save failed (non-critical)", e);
  }

  const saveOp = async () => {
    await setDoc(docRef, data);
  };

  try {
    await saveOp();
    return true;
  } catch (error: any) {
    try {
      await executeAsAdmin(saveOp);
      return true;
    } catch (adminErr: any) {
      console.error("CRITICAL: Admin save uploaded content failed", adminErr.code, adminErr.message);
      return false; 
    }
  }
};

export const getQuestionsForChapters = async (
  subject: string, 
  allChapters: Chapter[], 
  selectedChapterIds: string[],
  bypassCache: boolean = false
): Promise<Question[]> => {
  let finalQuestions: Question[] = [];
  const processedChapterIds = new Set<string>();

  if (!bypassCache) {
    try {
      const stored = localStorage.getItem(CONTENT_CACHE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        selectedChapterIds.forEach(id => {
          if (cache[id] && cache[id].questions && Array.isArray(cache[id].questions)) {
            finalQuestions = [...finalQuestions, ...cache[id].questions];
            processedChapterIds.add(id);
          }
        });
      }
    } catch (e) { console.warn("Cache read error", e); }
  }
  
  const missingIds = selectedChapterIds.filter(id => !processedChapterIds.has(id));

  if (missingIds.length > 0) {
    const fetchOp = async () => {
      const promises = missingIds.map(id => getDoc(doc(db, COLLECTION, id)));
      const docs = await Promise.all(promises);
      return docs.map(d => d.exists() ? d.data() as UploadedContent : null);
    };

    try {
      let results = await fetchOp();
      results.forEach(data => {
        if (data && data.questions) {
          finalQuestions = [...finalQuestions, ...data.questions];
          try {
             const stored = localStorage.getItem(CONTENT_CACHE_KEY);
             const cache = stored ? JSON.parse(stored) : {};
             cache[data.chapterId] = data;
             localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
          } catch(e) {}
        }
      });
    } catch (e: any) {
       if (e.code === 'permission-denied' || e.code === 'failed-precondition') {
          try {
             const results = await executeAsAdmin(fetchOp);
             results.forEach(data => {
               if (data && data.questions) {
                 finalQuestions = [...finalQuestions, ...data.questions];
               }
             });
          } catch(err) {
            console.error("Admin fetch failed too", err);
          }
       }
    }
  }

  return finalQuestions;
};

export const getUploadedSubtopicsMap = async (subject: string, classLevel: string): Promise<Record<string, Subtopic[]>> => {
  const map: Record<string, Subtopic[]> = {};
  const cleanSubject = subject.trim();
  const cleanClass = classLevel.trim();

  const fetchOp = async () => {
    const q = query(
      collection(db, COLLECTION), 
      where("subject", "==", cleanSubject), 
      where("classLevel", "==", cleanClass)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UploadedContent);
  };

  try {
    let data: UploadedContent[] = [];
    try {
      data = await fetchOp();
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        data = await executeAsAdmin(fetchOp);
      } else { throw e; }
    }

    data.forEach(item => {
      if (item.subtopics && item.subtopics.length > 0) {
        map[item.chapterId] = item.subtopics;
      }
    });
    
    try {
       const stored = localStorage.getItem(CONTENT_CACHE_KEY);
       const cache = stored ? JSON.parse(stored) : {};
       data.forEach(item => { cache[item.chapterId] = item; });
       localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
    } catch(e) {}

  } catch (e) {
    try {
      const stored = localStorage.getItem(CONTENT_CACHE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        Object.values(cache).forEach((item: any) => {
           if (item.subject === cleanSubject && item.classLevel === cleanClass) {
             if (item.subtopics && item.subtopics.length > 0) {
               map[item.chapterId] = item.subtopics;
             }
           }
        });
      }
    } catch (err) {}
  }
  
  return map;
};

export const updateChapterQuestion = async (chapterId: string, updatedQuestion: Question): Promise<boolean> => {
  const updateOp = async () => {
    const docRef = doc(db, COLLECTION, chapterId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Chapter content not found");

    const data = docSnap.data() as UploadedContent;
    const updatedQuestions = data.questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q);
    const safeData = JSON.parse(JSON.stringify({
      ...data,
      questions: updatedQuestions,
      updatedAt: Date.now()
    }));

    await setDoc(docRef, safeData);
    try {
      const stored = localStorage.getItem(CONTENT_CACHE_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      cache[chapterId] = safeData;
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
    return true;
  };

  try {
    return await updateOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try {
        await executeAsAdmin(updateOp);
        return true;
      } catch (err) {}
    }
    return false;
  }
};

export const deleteChapterQuestion = async (chapterId: string, questionId: string): Promise<boolean> => {
  const deleteOp = async () => {
    const docRef = doc(db, COLLECTION, chapterId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Chapter content not found");

    const data = docSnap.data() as UploadedContent;
    const updatedQuestions = data.questions.filter(q => q.id !== questionId);
    const safeData = JSON.parse(JSON.stringify({
      ...data,
      questions: updatedQuestions,
      updatedAt: Date.now()
    }));

    await setDoc(docRef, safeData);
    try {
      const stored = localStorage.getItem(CONTENT_CACHE_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      cache[chapterId] = safeData;
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
    return true;
  };

  try {
    return await deleteOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try {
        await executeAsAdmin(deleteOp);
        return true;
      } catch (err) {}
    }
    return false;
  }
};

/**
 * Permanently deletes a subtopic and all its associated questions from a chapter.
 */
export const deleteSubtopicPermanently = async (chapterId: string, subtopicName: string): Promise<boolean> => {
  const deleteOp = async () => {
    const docRef = doc(db, COLLECTION, chapterId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return true;

    const data = docSnap.data() as UploadedContent;
    const cleanName = subtopicName.trim().toLowerCase();
    
    // Filter out the subtopic
    const updatedSubtopics = data.subtopics.filter(st => st.name.trim().toLowerCase() !== cleanName);
    
    // Filter out all questions that belong to this subtopic
    const updatedQuestions = data.questions.filter(q => (q.subtopic || "").trim().toLowerCase() !== cleanName);
    
    const safeData = JSON.parse(JSON.stringify({
      ...data,
      subtopics: updatedSubtopics,
      questions: updatedQuestions,
      updatedAt: Date.now()
    }));

    await setDoc(docRef, safeData);

    // Update Cache
    try {
      const stored = localStorage.getItem(CONTENT_CACHE_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      cache[chapterId] = safeData;
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}

    return true;
  };

  try {
    return await deleteOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      try {
        await executeAsAdmin(deleteOp);
      } catch (err) {}
    }
    return false;
  }
};
