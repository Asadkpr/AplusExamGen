import { db } from '../firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  limit, 
  orderBy,
  getCountFromServer,
  getDocs,
  Unsubscribe 
} from 'firebase/firestore';

export interface DashboardStats {
  schoolsCount: number;
  papersCount: number;
  patternsCount: number;
  announcementsCount: number;
}

type StatsCallback = (stats: DashboardStats) => void;

class SyncService {
  private listeners: Set<StatsCallback> = new Set();
  private stats: DashboardStats = {
    schoolsCount: 0,
    papersCount: 0,
    patternsCount: 0,
    announcementsCount: 1,
  };

  private unsubs: Unsubscribe[] = [];
  private currentUserId?: string;
  private currentIsAdmin: boolean = false;
  private isSubscribed: boolean = false;
  private isRefreshing: boolean = false;

  constructor() {
    this.loadFromLocalStorage();
    // Cross-tab synchronization
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key?.startsWith('aplus_') || e.key?.startsWith('total_')) {
          this.loadFromLocalStorage();
          this.notify();
        }
      });
    }
  }

  private loadFromLocalStorage(userId?: string, isAdmin?: boolean) {
    const key = (isAdmin ?? this.currentIsAdmin) ? 'admin' : (userId || this.currentUserId || 'admin');
    
    const storedPapers = localStorage.getItem(`total_papers_count_${key}`);
    const storedUsers = localStorage.getItem('total_users_count');
    const storedPatterns = localStorage.getItem('total_patterns_count');
    const storedAnnounce = localStorage.getItem('aplus_announcements_cache_v1');

    if (storedPapers !== null) {
      const p = parseInt(storedPapers, 10);
      if (!isNaN(p)) this.stats.papersCount = p;
    }
    if (storedUsers !== null) {
      const u = parseInt(storedUsers, 10);
      if (!isNaN(u)) this.stats.schoolsCount = u;
    }
    if (storedPatterns !== null) {
      const pat = parseInt(storedPatterns, 10);
      if (!isNaN(pat)) this.stats.patternsCount = pat;
    }
    if (storedAnnounce) {
      try {
        const arr = JSON.parse(storedAnnounce);
        if (Array.isArray(arr) && arr.length > 0) {
          this.stats.announcementsCount = arr.length;
        }
      } catch (_) {}
    }
  }

  public getStatsSync(userId?: string, isAdmin?: boolean): DashboardStats {
    this.loadFromLocalStorage(userId, isAdmin);
    return { ...this.stats };
  }

  public subscribe(
    userId: string | undefined, 
    isAdmin: boolean, 
    callback: StatsCallback
  ): () => void {
    this.currentUserId = userId;
    this.currentIsAdmin = isAdmin;
    this.listeners.add(callback);

    // 1. Immediately emit current cached stats for instant 0ms first render
    callback(this.getStatsSync(userId, isAdmin));

    // 2. Fetch live exact total counts from database (without any artificial limits)
    this.refreshServerCounts(userId, isAdmin);

    // 3. Initialize Firestore real-time change detection
    if (!this.isSubscribed) {
      this.initFirestoreListeners(userId, isAdmin);
    }

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.unsubscribeFirestore();
      }
    };
  }

  private notify() {
    const current = { ...this.stats };
    this.listeners.forEach(cb => {
      try { cb(current); } catch (e) { console.warn('SyncService notify error:', e); }
    });
  }

  /**
   * Fetches the 100% true, exact total count directly from Firestore database
   * using server-side count aggregations (NO limits, counts ALL documents).
   */
  public async refreshServerCounts(userId?: string, isAdmin?: boolean) {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const effectiveAdmin = isAdmin ?? this.currentIsAdmin;
    const effectiveUserId = userId ?? this.currentUserId;
    const key = effectiveAdmin ? 'admin' : (effectiveUserId || 'admin');

    try {
      // 1. Exact count of Papers in DB
      let papersQuery = query(collection(db, 'papers'));
      if (!effectiveAdmin && effectiveUserId) {
        papersQuery = query(collection(db, 'papers'), where('userId', '==', effectiveUserId));
      }
      let exactPapers: number;
      try {
        const papersSnap = await getCountFromServer(papersQuery);
        exactPapers = papersSnap.data().count;
      } catch (_) {
        const snap = await getDocs(papersQuery);
        exactPapers = snap.docs.length;
      }
      this.stats.papersCount = exactPapers;
      localStorage.setItem(`total_papers_count_${key}`, exactPapers.toString());
    } catch (e: any) {
      console.warn('Exact paper count fetch warning:', e?.message || e);
    }

    // 2. Exact count of Schools/Users for Admin in DB
    if (effectiveAdmin) {
      try {
        const usersColl = collection(db, 'users');
        let totalRaw: number;
        try {
          const usersSnap = await getCountFromServer(usersColl);
          totalRaw = usersSnap.data().count;
        } catch (_) {
          const snap = await getDocs(usersColl);
          totalRaw = snap.docs.length;
        }
        // Exclude system admin from school count
        const exactSchools = Math.max(0, totalRaw > 1 ? totalRaw - 1 : totalRaw);
        this.stats.schoolsCount = exactSchools;
        localStorage.setItem('total_users_count', exactSchools.toString());
      } catch (e: any) {
        console.warn('Exact user count fetch warning:', e?.message || e);
      }
    }

    // 3. Exact count of Patterns in DB (for both admin and teachers)
    try {
      const patternsColl = collection(db, 'patterns');
      let exactPatterns: number;
      try {
        const patternsSnap = await getCountFromServer(patternsColl);
        exactPatterns = patternsSnap.data().count;
      } catch (_) {
        const snap = await getDocs(patternsColl);
        exactPatterns = snap.docs.length;
      }
      this.stats.patternsCount = exactPatterns;
      localStorage.setItem('total_patterns_count', exactPatterns.toString());
    } catch (e: any) {
      console.warn('Exact pattern count fetch warning:', e?.message || e);
    }

    this.isRefreshing = false;
    this.notify();
  }

  public clearCache() {
    this.stats = {
      schoolsCount: 0,
      papersCount: 0,
      patternsCount: 0,
      announcementsCount: 1,
    };
  }

  // --- Optimistic Instant Mutators ---
  public optimisticPaperAdded(userId?: string) {
    this.stats.papersCount += 1;
    const key = this.currentIsAdmin ? 'admin' : (userId || this.currentUserId || 'admin');
    localStorage.setItem(`total_papers_count_${key}`, this.stats.papersCount.toString());
    this.notify();
  }

  public optimisticPaperDeleted(userId?: string) {
    this.stats.papersCount = Math.max(0, this.stats.papersCount - 1);
    const key = this.currentIsAdmin ? 'admin' : (userId || this.currentUserId || 'admin');
    localStorage.setItem(`total_papers_count_${key}`, this.stats.papersCount.toString());
    this.notify();
  }

  public optimisticPatternAdded() {
    this.stats.patternsCount += 1;
    localStorage.setItem('total_patterns_count', this.stats.patternsCount.toString());
    this.notify();
  }

  public optimisticPatternDeleted() {
    this.stats.patternsCount = Math.max(0, this.stats.patternsCount - 1);
    localStorage.setItem('total_patterns_count', this.stats.patternsCount.toString());
    this.notify();
  }

  public optimisticAnnouncementAdded() {
    this.stats.announcementsCount += 1;
    this.notify();
  }

  public optimisticAnnouncementDeleted() {
    this.stats.announcementsCount = Math.max(1, this.stats.announcementsCount - 1);
    this.notify();
  }

  public optimisticUserCountUpdated(count: number) {
    this.stats.schoolsCount = count;
    localStorage.setItem('total_users_count', count.toString());
    this.notify();
  }

  private initFirestoreListeners(userId?: string, isAdmin?: boolean) {
    this.unsubscribeFirestore();
    this.isSubscribed = true;

    try {
      // 1. Papers real-time change detector (listens to latest additions/deletions)
      let papersWatchQuery;
      if (isAdmin) {
        papersWatchQuery = query(collection(db, 'papers'), orderBy('createdAt', 'desc'), limit(1));
      } else if (userId) {
        papersWatchQuery = query(collection(db, 'papers'), where('userId', '==', userId), limit(1));
      } else {
        papersWatchQuery = query(collection(db, 'papers'), limit(1));
      }

      let isInitialPapers = true;
      const unsubPapers = onSnapshot(papersWatchQuery, () => {
        if (!isInitialPapers) {
          // Re-fetch exact aggregate from database whenever data changes in the cloud
          this.refreshServerCounts(userId, isAdmin);
        }
        isInitialPapers = false;
      }, (err) => {
        console.warn('Papers change watch warning:', err.message);
      });
      this.unsubs.push(unsubPapers);

      // 2. Patterns real-time change detector (for both admin and teachers)
      const patternsWatchQuery = query(collection(db, 'patterns'), limit(1));
      let isInitialPatterns = true;
      const unsubPatterns = onSnapshot(patternsWatchQuery, () => {
        if (!isInitialPatterns) {
          this.refreshServerCounts(userId, isAdmin);
        }
        isInitialPatterns = false;
      }, (err) => {
        console.warn('Patterns change watch warning:', err.message);
      });
      this.unsubs.push(unsubPatterns);

      // 3. Users real-time change detector
      if (isAdmin) {
        const usersWatchQuery = query(collection(db, 'users'), limit(1));
        let isInitialUsers = true;
        const unsubUsers = onSnapshot(usersWatchQuery, () => {
          if (!isInitialUsers) {
            this.refreshServerCounts(userId, isAdmin);
          }
          isInitialUsers = false;
        }, (err) => {
          console.warn('Users change watch warning:', err.message);
        });
        this.unsubs.push(unsubUsers);
      }

      // 4. Announcements live list & count
      const annQ = query(collection(db, 'announcements'), limit(20));
      const unsubAnn = onSnapshot(annQ, (snapshot) => {
        if (!snapshot.empty) {
          this.stats.announcementsCount = snapshot.size;
          this.notify();
        }
      }, (err) => {
        console.warn('Announcements change watch warning:', err.message);
      });
      this.unsubs.push(unsubAnn);

    } catch (e) {
      console.warn('Could not initialize real-time Firestore change detectors:', e);
    }
  }

  private unsubscribeFirestore() {
    this.unsubs.forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
    this.unsubs = [];
    this.isSubscribed = false;
  }
}

export const syncService = new SyncService();
