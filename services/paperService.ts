

import { db } from '../firebaseConfig';
// Fix: Consolidated modular imports from firebase/firestore
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  updateDoc 
} from 'firebase/firestore';
import { SavedPaper } from '../types';
import { executeAsAdmin } from './authService';

const COLLECTION = 'papers';
const LOCAL_STORAGE_KEY = 'aplus_papers_v1';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const savePaper = async (paper: Omit<SavedPaper, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string; id: string }> => {
  const id = generateId();
  const newPaper: SavedPaper = {
    ...paper,
    id,
    createdAt: Date.now(),
  };

  const sanitizedPaper = JSON.parse(JSON.stringify(newPaper));

  // Save to LocalStorage (Backup)
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const papers = stored ? JSON.parse(stored) : [];
    papers.push(sanitizedPaper);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(papers));
  } catch (localError) {
    console.warn("Local backup save failed", localError);
  }

  // Save to Firebase (Primary)
  const saveOp = async () => {
    await setDoc(doc(db, COLLECTION, id), sanitizedPaper);
  };

  try {
    await saveOp();
    return { success: true, message: 'Paper saved successfully to Database!', id };
  } catch (error: any) {
    console.error("FIREBASE SAVE ERROR:", error.code, error.message);
    
    // Fallback: Admin Save
    if (error.code === 'permission-denied' || error.code === 'unauthenticated' || error.code === 'failed-precondition') {
       try {
         await executeAsAdmin(saveOp);
         return { success: true, message: 'Paper saved successfully to Database!', id };
       } catch (adminErr) {
         console.error("Admin save paper failed", adminErr);
       }
    }

    return { success: false, message: 'Failed to save paper to Cloud. Please check internet connection.', id };
  }
};

export const updatePaper = async (id: string, paperUpdate: Partial<SavedPaper>): Promise<{ success: boolean; message: string }> => {
  const sanitizedUpdate = JSON.parse(JSON.stringify(paperUpdate));

  // 1. Update LocalStorage
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const papers = JSON.parse(stored);
      const index = papers.findIndex((p: SavedPaper) => p.id === id);
      if (index !== -1) {
        papers[index] = { ...papers[index], ...sanitizedUpdate };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(papers));
      }
    }
  } catch (localError) {
    console.warn("Local update failed", localError);
  }

  // 2. Update Firebase
  const updateOp = async () => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, sanitizedUpdate);
  };

  try {
    await updateOp();
    return { success: true, message: 'Paper updated successfully!' };
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
       try {
         await executeAsAdmin(updateOp);
         return { success: true, message: 'Paper updated successfully!' };
       } catch (adminErr) {
         console.error("Admin update paper failed", adminErr);
       }
    }
    return { success: false, message: 'Failed to update paper. Please check connection.' };
  }
};

export const getSavedPapers = async (userId: string, isAdmin: boolean): Promise<SavedPaper[]> => {
  let papers: SavedPaper[] = [];
  
  const fetchOp = async () => {
    let q;
    if (isAdmin) {
      q = query(collection(db, COLLECTION), orderBy("createdAt", "desc")); 
    } else {
      q = query(collection(db, COLLECTION), where("userId", "==", userId), orderBy("createdAt", "desc"));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as SavedPaper);
  };

  // 1. Try Firebase (Primary)
  try {
    const fetched = await fetchOp();
    papers.push(...fetched);
  } catch (error: any) {
    console.warn("Cloud fetch failed", error.code);
    if (error.code === 'permission-denied') {
       try {
         // Fix: Capture the result from executeAsAdmin into adminFetched to fix the 'fetched' is not defined error
         const adminFetched = await executeAsAdmin(fetchOp);
         papers.push(...adminFetched);
       } catch(err) {
         console.error("Admin fetch papers failed", err);
       }
    }
  }

  // 2. LocalStorage (Only if Firebase failed or returned empty - optional logic, here we merge)
  if (papers.length === 0) {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const localPapers: SavedPaper[] = JSON.parse(stored);
          let filteredLocalPapers: SavedPaper[] = [];
          if (isAdmin) {
             filteredLocalPapers = localPapers;
          } else {
             filteredLocalPapers = localPapers.filter(p => p.userId === userId);
          }
          papers = filteredLocalPapers;
        }
      } catch (e) {
        console.error("Local fetch failed", e);
      }
  }

  return papers.sort((a, b) => b.createdAt - a.createdAt);
};

export const deletePaper = async (id: string): Promise<void> => {
  const deleteOp = async () => {
    await deleteDoc(doc(db, COLLECTION, id));
  };

  // 1. Try Cloud Delete
  try {
    await deleteOp();
  } catch (error: any) {
    console.warn("Cloud delete failed", error.code);
    if (error.code === 'permission-denied') {
        try {
           await executeAsAdmin(deleteOp);
        } catch (err) {
           console.error("Admin delete paper failed", err);
        }
    }
  }

  // 2. Try Local Delete
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const papers = JSON.parse(stored);
      const updatedPapers = papers.filter((p: SavedPaper) => p.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPapers));
    }
  } catch (e) {
    console.error("Local delete failed", e);
  }
};
