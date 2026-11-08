
import { db } from '../firebaseConfig';
// Fix: Consolidated modular imports from firebase/firestore
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromCache,
  collection, 
  query, 
  where, 
  getDocs, 
  getDocsFromCache,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { Question, Subtopic, Chapter } from '../types';

const COLLECTION = 'uploaded_content';
const CONTENT_CACHE_KEY = 'aplus_content_cache_v2'; 

// 🔹 Memory Cache
let memoryContentCache: Record<string, UploadedContent> = {};
let lastFetchTime: Record<string, number> = {};
const CACHE_DURATION = 45 * 1000; // 45 seconds for rapid multi-admin synchronization

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
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
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
    const snapshot = await withTimeout(getDocs(q), 8000);
    return snapshot.docs.map(doc => doc.data() as UploadedContent);
  };

  try {
    let data: UploadedContent[] = [];
    try {
      data = await fetchOp();
    } catch (e: any) {
      try {
        const q = query(collection(db, COLLECTION), where("classLevel", "==", cleanClass));
        const cacheSnap = await getDocsFromCache(q);
        if (!cacheSnap.empty) {
          data = cacheSnap.docs.map(doc => doc.data() as UploadedContent);
        }
      } catch (_) {}
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
    const docSnap = await withTimeout(getDoc(docRef), 10000);
    if (docSnap.exists()) {
      const data = docSnap.data() as UploadedContent;
      existingQuestions = data.questions || [];
      existingSubtopics = data.subtopics || [];
    }
  } catch (e) {
    console.warn("Could not fetch existing content for merge, starting fresh.", e);
  }

  // Filter out completely blank rows and deduplicate exact duplicates to prevent Firestore 1MB limit overflow
  const rawMerged = [...existingQuestions, ...newQuestions];
  const seenKeys = new Set<string>();
  const mergedQuestions: Question[] = [];
  for (const q of rawMerged) {
    const tEng = (q.text || '').trim();
    const tUrdu = (q.textUrdu || '').trim();
    if (!tEng && !tUrdu) continue;
    const dedupeKey = `${(q.subtopic || '').trim()}|${(q.type || '').trim()}|${tEng}|${tUrdu}|${JSON.stringify(q.options || [])}|${JSON.stringify(q.optionsUrdu || [])}`;
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      mergedQuestions.push({
        ...q,
        chapterId
      });
    }
  }

  const subtopicMap = new Map<string, Subtopic>();
  existingSubtopics.forEach(s => {
    if (s && s.name && s.name.trim()) {
      subtopicMap.set(s.name.toLowerCase().trim(), { id: s.id || s.name.trim(), name: s.name.trim() });
    }
  });
  newSubtopics.forEach(s => {
    if (s && s.name && s.name.trim()) {
      subtopicMap.set(s.name.toLowerCase().trim(), { id: s.id || s.name.trim(), name: s.name.trim() });
    }
  });
  mergedQuestions.forEach(q => {
    const stName = (q.subtopic || '').trim();
    if (stName && !subtopicMap.has(stName.toLowerCase())) {
      subtopicMap.set(stName.toLowerCase(), { id: stName, name: stName });
    }
  });
  if (mergedQuestions.length > 0 && subtopicMap.size === 0) {
    subtopicMap.set('general', { id: 'General', name: 'General' });
  }
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
    // If localStorage quota is exceeded, keep only the newly uploaded chapter so it never fails silently
    try {
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify({ [chapterId]: data }));
    } catch (_) {}
  }

  const metaDocId = `${subject.trim()}_${classLevel.trim()}`.replace(/\s+/g, '_').toLowerCase();

  try {
    // Run both main document save (30s timeout) and fast subtopics_meta update (15s timeout)
    await Promise.all([
      withTimeout(setDoc(docRef, data), 30000),
      withTimeout(setDoc(doc(db, 'subtopics_meta', metaDocId), {
        updatedAt: Date.now(),
        map: { [chapterId]: mergedSubtopics }
      }, { merge: true }), 15000).catch(e => console.warn("Failed to update fast cache", e))
    ]);

    return true;
  } catch (error: any) {
    console.warn("Primary cloud save encountered an issue, retrying once:", error?.message || error);
    try {
      await withTimeout(setDoc(docRef, data), 30000);
      await withTimeout(setDoc(doc(db, 'subtopics_meta', metaDocId), {
        updatedAt: Date.now(),
        map: { [chapterId]: mergedSubtopics }
      }, { merge: true }), 15000).catch(() => {});
      return true;
    } catch (retryErr: any) {
      console.error("Cloud save failed after retry:", retryErr?.message || retryErr);
      throw new Error(retryErr?.message || "Failed to save questions to cloud database. Please check your internet connection and try again.");
    }
  }
};

export const getQuestionsForChapters = async (
  subject: string, 
  allChapters: Chapter[], 
  selectedChapterIds: string[],
  bypassCache: boolean = false,
  classLevel?: string
): Promise<Question[]> => {
  let finalQuestions: Question[] = [];
  const processedChapterIds = new Set<string>();

  if (!bypassCache) {
    // 1. Try Memory Cache First
    selectedChapterIds.forEach(id => {
      if (memoryContentCache[id] && memoryContentCache[id].questions && memoryContentCache[id].questions.length > 0) {
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
            if (!processedChapterIds.has(id) && cache[id] && cache[id].questions && cache[id].questions.length > 0) {
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
    const fetchSingleChapter = async (id: string): Promise<UploadedContent | null> => {
      const ref = doc(db, COLLECTION, id);
      try {
        const snap = await withTimeout(getDoc(ref), 20000);
        if (snap.exists()) return snap.data() as UploadedContent;
      } catch (_) {
        try {
          const cacheSnap = await getDocFromCache(ref);
          if (cacheSnap.exists()) return cacheSnap.data() as UploadedContent;
        } catch (_) {}
      }
      if (memoryContentCache[id]) return memoryContentCache[id];
      try {
        const stored = localStorage.getItem(CONTENT_CACHE_KEY);
        if (stored) {
          const cache = JSON.parse(stored);
          if (cache[id]) return cache[id];
        }
      } catch (_) {}
      return null;
    };

    try {
      const results = await Promise.all(missingIds.map(id => fetchSingleChapter(id)));
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

  // Fallback: if all chapters were requested (e.g. ManageContent) and no questions came back by chapterId, query by subject + classLevel
  if (finalQuestions.length === 0 && subject && classLevel) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where("subject", "==", subject.trim()),
        where("classLevel", "==", classLevel.trim())
      );
      const snap = await withTimeout(getDocs(q), 15000);
      snap.forEach(d => {
        const data = d.data() as UploadedContent;
        if (data && Array.isArray(data.questions)) {
          finalQuestions = [...finalQuestions, ...data.questions];
          memoryContentCache[d.id] = data;
        }
      });
    } catch (_) {}
  }

  // Filter out any completely blank questions
  return finalQuestions.filter(q => (q.text && q.text.trim()) || (q.textUrdu && q.textUrdu.trim()));
};

export const getUploadedSubtopicsMap = async (
  subject: string,
  classLevel: string,
  forceRefresh: boolean = false,
  expectedChapterIds?: string[]
): Promise<Record<string, Subtopic[]>> => {
  let map: Record<string, Subtopic[]> = {};
  const cleanSubject = subject.trim();
  const cleanClass = classLevel.trim();
  const cacheKey = `subtopics-${cleanSubject}-${cleanClass}`;
  const now = Date.now();
  const metaDocId = `${cleanSubject}_${cleanClass}`.replace(/\s+/g, '_').toLowerCase();

  // Helper to overlay local/memory cache entries so freshly uploaded chapters are always present
  const mergeLocalAndMemory = (targetMap: Record<string, Subtopic[]>) => {
    try {
      const stored = localStorage.getItem(CONTENT_CACHE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        Object.values(cache).forEach((item: any) => {
          if (item && item.subject === cleanSubject && item.classLevel === cleanClass && Array.isArray(item.subtopics) && item.subtopics.length > 0) {
            targetMap[item.chapterId] = item.subtopics;
          }
        });
      }
    } catch (_) {}
    Object.values(memoryContentCache).forEach(item => {
      if (item && item.subject === cleanSubject && item.classLevel === cleanClass && Array.isArray(item.subtopics) && item.subtopics.length > 0) {
        targetMap[item.chapterId] = item.subtopics;
      }
    });
  };

  // 1. Try Memory Cache if fresh and not forceRefresh
  if (!forceRefresh && lastFetchTime[cacheKey] && (now - lastFetchTime[cacheKey] < CACHE_DURATION)) {
    mergeLocalAndMemory(map);
    const hasAllExpected = !expectedChapterIds || expectedChapterIds.length === 0 || expectedChapterIds.every(id => map[id] && map[id].length > 0);
    if (Object.keys(map).length > 0 && hasAllExpected) return map;
  }

  // 2. Try Fast Cloud Metadata Cache (Avoids fetching thousands of questions)
  try {
    const metaSnap = await withTimeout(getDoc(doc(db, 'subtopics_meta', metaDocId)), 8000);
    if (metaSnap.exists()) {
      const metaData = metaSnap.data();
      if (metaData && metaData.map && Object.keys(metaData.map).length > 0) {
        map = { ...(metaData.map as Record<string, Subtopic[]>) };
        mergeLocalAndMemory(map);
        const hasAllExpected = !expectedChapterIds || expectedChapterIds.length === 0 || expectedChapterIds.every(id => map[id] && map[id].length > 0);
        if (hasAllExpected) {
          lastFetchTime[cacheKey] = Date.now();
          return map;
        }
      }
    }
  } catch (e) {
    console.warn("Fast meta cache read failed (quota or offline)", e);
  }

  // 2.5 Merge Local Storage content cache
  mergeLocalAndMemory(map);

  // 3. Fallback / Self-Heal: Fetch content for this subject/class from uploaded_content
  const q = query(
    collection(db, COLLECTION), 
    where("subject", "==", cleanSubject), 
    where("classLevel", "==", cleanClass)
  );
  const fetchOp = async () => {
    const snapshot = await withTimeout(getDocs(q), 15000);
    return snapshot.docs.map(d => ({ ...d.data(), chapterId: d.id } as UploadedContent));
  };

  try {
    let data: UploadedContent[] = [];
    try {
      data = await fetchOp();
    } catch (err: any) {
      console.warn("fetchOp failed (quota or offline), trying IndexedDB cache:", err?.message || err);
      try {
        const cacheSnap = await getDocsFromCache(q);
        if (!cacheSnap.empty) {
          data = cacheSnap.docs.map(d => ({ ...d.data(), chapterId: d.id } as UploadedContent));
        }
      } catch (_) {}
    }

    data.forEach(item => {
      let subs = item.subtopics || [];
      if (subs.length === 0 && Array.isArray(item.questions) && item.questions.length > 0) {
        const subNames = Array.from(new Set(item.questions.map(qItem => (qItem.subtopic || 'General').trim()).filter(Boolean)));
        subs = subNames.map(n => ({ id: n, name: n }));
      }
      if (subs.length > 0) {
        map[item.chapterId] = subs;
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
    mergeLocalAndMemory(map);
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
