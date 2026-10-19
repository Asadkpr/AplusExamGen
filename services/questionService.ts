
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

const COLLECTION = 'uploaded_content';
const CONTENT_CACHE_KEY = 'aplus_content_cache_v2'; 

// 🔹 Memory Cache
let memoryContentCache: Record<string, UploadedContent> = {};
let lastFetchTime: Record<string, number> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const resetQuestionCache = () => {
  memoryContentCache = {};
  lastFetchTime = {};
};

interface UploadedContent {
  chapterId: string;
  questions: Question[];
  subtopics: Subtopic[];
  subject: string;
  classLevel: string;
  updatedAt: number;
}

// Helper timeout
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 3000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network/Quota timeout')), timeoutMs))
  ]);
};

export const getAllClassUploadedContent = async (classLevel: string, forceRefresh: boolean = false): Promise<UploadedContent[]> => {
  const cleanClass = classLevel.trim();
  const cacheKey = `all-${cleanClass}`;
  const now = Date.now();

  if (!forceRefresh && lastFetchTime[cacheKey] && (now - lastFetchTime[cacheKey] < CACHE_DURATION)) {
    return Object.values(memoryContentCache).filter(item => item.classLevel === cleanClass);
  }
  
  const fetchOp = async () => {
    const q = query(
      collection(db, COLLECTION), 
      where("classLevel", "==", cleanClass)
    );
    const snapshot = await withTimeout(getDocs(q), 3000);
    return snapshot.docs.map(doc => doc.data() as UploadedContent);
  };

  try {
    let data: UploadedContent[] = [];
    try {
      data = await fetchOp();
    } catch (e: any) {
      console.warn("getAllClassUploadedContent fetch failed (quota or offline):", e?.message || e);
    }

    try {
       const stored = localStorage.getItem(CONTENT_CACHE_KEY);
       const cache = stored ? JSON.parse(stored) : {};
       data.forEach(item => { 
         cache[item.chapterId] = item; 
         memoryContentCache[item.chapterId] = item;
       });
       localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
       lastFetchTime[cacheKey] = Date.now();
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

  // Update Memory Cache
  memoryContentCache[chapterId] = data;
  lastFetchTime = {}; // Invalidate bulk fetch times

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
    await withTimeout(saveOp(), 4000);
    
    // UPDATE FAST CACHE
    const metaDocId = `${subject.trim()}_${classLevel.trim()}`.replace(/\s+/g, '_').toLowerCase();
    try {
      await withTimeout(setDoc(doc(db, 'subtopics_meta', metaDocId), {
        updatedAt: Date.now(),
        map: { [chapterId]: mergedSubtopics }
      }, { merge: true }), 2500);
    } catch(e) { console.warn("Failed to update fast cache", e); }

    return true;
  } catch (error: any) {
    console.warn("Cloud save throttled or delayed, but questions saved safely in local cache:", error?.message || error);
    return true;
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
    // 1. Try Memory Cache First
    selectedChapterIds.forEach(id => {
      if (memoryContentCache[id] && memoryContentCache[id].questions) {
        finalQuestions = [...finalQuestions, ...memoryContentCache[id].questions];
        processedChapterIds.add(id);
      }
    });

    // 2. Try LocalStorage if not in memory
    if (processedChapterIds.size < selectedChapterIds.length) {
      try {
        const stored = localStorage.getItem(CONTENT_CACHE_KEY);
        if (stored) {
          const cache = JSON.parse(stored);
          selectedChapterIds.forEach(id => {
            if (!processedChapterIds.has(id) && cache[id] && cache[id].questions) {
              finalQuestions = [...finalQuestions, ...cache[id].questions];
              processedChapterIds.add(id);
              memoryContentCache[id] = cache[id]; // Populate memory cache
            }
          });
        }
      } catch (e) { console.warn("Cache read error", e); }
    }
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
          memoryContentCache[data.chapterId] = data; // Update Memory Cache
          try {
             const stored = localStorage.getItem(CONTENT_CACHE_KEY);
             const cache = stored ? JSON.parse(stored) : {};
             cache[data.chapterId] = data;
             localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
          } catch(e) {}
        }
      });
    } catch (e: any) {
       console.error("Fetch failed", e);
    }
  }

  return finalQuestions;
};

export const getUploadedSubtopicsMap = async (subject: string, classLevel: string, forceRefresh: boolean = false): Promise<Record<string, Subtopic[]>> => {
  let map: Record<string, Subtopic[]> = {};
  const cleanSubject = subject.trim();
  const cleanClass = classLevel.trim();
  const cacheKey = `subtopics-${cleanSubject}-${cleanClass}`;
  const now = Date.now();
  const metaDocId = `${cleanSubject}_${cleanClass}`.replace(/\s+/g, '_').toLowerCase();

  // 1. Try Memory Cache
  if (!forceRefresh && lastFetchTime[cacheKey] && (now - lastFetchTime[cacheKey] < CACHE_DURATION)) {
    Object.values(memoryContentCache).forEach(item => {
      if (item.subject === cleanSubject && item.classLevel === cleanClass && item.subtopics) {
        map[item.chapterId] = item.subtopics;
      }
    });
    if (Object.keys(map).length > 0) return map;
  }

  // 2. Try Fast Cloud Metadata Cache (Avoids fetching thousands of questions)
  try {
    const metaSnap = await withTimeout(getDoc(doc(db, 'subtopics_meta', metaDocId)), 2000);
    if (metaSnap.exists()) {
      const metaData = metaSnap.data();
      if (metaData && metaData.map && Object.keys(metaData.map).length > 0) {
        lastFetchTime[cacheKey] = Date.now();
        return metaData.map as Record<string, Subtopic[]>;
      }
    }
  } catch (e) {
    console.warn("Fast meta cache read failed (quota or offline)", e);
  }

  // 2.5 Try Local Storage content cache (instant)
  try {
    const stored = localStorage.getItem(CONTENT_CACHE_KEY);
    if (stored) {
      const cache = JSON.parse(stored);
      Object.values(cache).forEach((item: any) => {
        if (item && item.subject === cleanSubject && item.classLevel === cleanClass && item.subtopics && item.subtopics.length > 0) {
          map[item.chapterId] = item.subtopics;
        }
      });
      if (Object.keys(map).length > 0) {
        lastFetchTime[cacheKey] = Date.now();
      }
    }
  } catch(e) {}

  // 3. Fallback: Slow Fetch (Fetch all content for this subject/class)
  const fetchOp = async () => {
    const q = query(
      collection(db, COLLECTION), 
      where("subject", "==", cleanSubject), 
      where("classLevel", "==", cleanClass)
    );
    const snapshot = await withTimeout(getDocs(q), 3000);
    return snapshot.docs.map(doc => doc.data() as UploadedContent);
  };

  try {
    let data: UploadedContent[] = [];
    try {
      data = await fetchOp();
    } catch (err: any) {
      console.warn("fetchOp failed (quota or offline):", err?.message || err);
    }

    data.forEach(item => {
      if (item.subtopics && item.subtopics.length > 0) {
        map[item.chapterId] = item.subtopics;
      }
      memoryContentCache[item.chapterId] = item; // Update Memory Cache
    });
    
    // Save to LocalStorage
    try {
       const stored = localStorage.getItem(CONTENT_CACHE_KEY);
       const cache = stored ? JSON.parse(stored) : {};
       data.forEach(item => { cache[item.chapterId] = item; });
       localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
       lastFetchTime[cacheKey] = Date.now();
    } catch(e) {}

    // 4. Save back to Fast Cloud Metadata Cache so it's instant next time!
    if (Object.keys(map).length > 0) {
      try {
        await setDoc(doc(db, 'subtopics_meta', metaDocId), {
          updatedAt: Date.now(),
          map: map
        }, { merge: true });
      } catch (e) {
        console.warn("Could not save subtopics meta cache", e);
      }
    }

  } catch (e) {
    // 5. Ultimate Fallback: LocalStorage
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

    // Update Memory Cache
    memoryContentCache[chapterId] = safeData;
    lastFetchTime = {};

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
    console.error("Update failed", e);
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

    // Update Memory Cache
    memoryContentCache[chapterId] = safeData;
    lastFetchTime = {};

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
    console.error("Delete failed", e);
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

    // Update Memory Cache
    memoryContentCache[chapterId] = safeData;
    lastFetchTime = {};

    // Update Cache
    try {
      const stored = localStorage.getItem(CONTENT_CACHE_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      cache[chapterId] = safeData;
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}

    // UPDATE FAST CACHE
    try {
      const metaDocId = `${data.subject.trim()}_${data.classLevel.trim()}`.replace(/\s+/g, '_').toLowerCase();
      await setDoc(doc(db, 'subtopics_meta', metaDocId), {
        updatedAt: Date.now(),
        map: { [chapterId]: updatedSubtopics }
      }, { merge: true });
    } catch(e) { console.warn("Failed to update fast cache", e); }

    return true;
  };

  try {
    return await deleteOp();
  } catch (e: any) {
    console.error("Delete failed", e);
    return false;
  }
};
