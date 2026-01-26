
import { db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { Announcement } from '../types';
import { executeAsAdmin } from './authService';

const COLLECTION = 'announcements';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const getAnnouncements = async (): Promise<Announcement[]> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Announcement);
  } catch (error) {
    console.error("Error fetching announcements", error);
    return [];
  }
};

export const saveAnnouncement = async (announcement: Omit<Announcement, 'id' | 'createdAt'>): Promise<boolean> => {
  const id = generateId();
  const data: Announcement = {
    ...announcement,
    id,
    createdAt: Date.now()
  };

  const saveOp = async () => {
    await setDoc(doc(db, COLLECTION, id), data);
    return true;
  };

  try {
    return await saveOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      return await executeAsAdmin(saveOp);
    }
    return false;
  }
};

export const updateAnnouncement = async (announcement: Announcement): Promise<boolean> => {
  const updateOp = async () => {
    await setDoc(doc(db, COLLECTION, announcement.id), announcement, { merge: true });
    return true;
  };

  try {
    return await updateOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      return await executeAsAdmin(updateOp);
    }
    return false;
  }
};

export const deleteAnnouncement = async (id: string): Promise<boolean> => {
  const deleteOp = async () => {
    await deleteDoc(doc(db, COLLECTION, id));
    return true;
  };

  try {
    return await deleteOp();
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      return await executeAsAdmin(deleteOp);
    }
    return false;
  }
};
