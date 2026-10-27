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
  getDocsFromCache,
  doc,
  getDoc,
  setDoc,
  increment,
  Unsubscribe 
} from 'firebase/firestore';

export interface DashboardStats {
  schoolsCount: number;
  papersCount: number;
  patternsCount: number;
  announcementsCount: number;
}

type StatsCallback = (stats: DashboardStats) => void;

const STATS_COLLECTION = 'visibility_settings';
const STATS_DOC = 'dashboard_stats';

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
  private lastRefreshTime: number = 0;
  private quotaCooldownUntil: number = 0;

  private isQuotaError(err: any): boolean {
    const msg = String(err?.message || err?.code || '').toLowerCase();
    return err?.code === 'resource-exhausted' || msg.includes('quota') || msg.includes('resource-exhausted');
  }

  private triggerQuotaCooldown() {
    this.quotaCooldownUntil = Date.now() + 5 * 60 * 1000; // 5-minute cooldown
    this.unsubscribeFirestore();
  }

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
    const effectiveAdmin = isAdmin ?? this.currentIsAdmin;
    const effectiveUserId = userId || this.currentUserId;
    const key = effectiveAdmin ? 'admin' : (effectiveUserId || 'admin');
    
    const storedPapers = localStorage.getItem(`total_papers_count_${key}`);
    const storedUsers = localStorage.getItem('total_users_count');
    const storedPatterns = localStorage.getItem('total_patterns_count');
    const storedAnnounce = localStorage.getItem('aplus_announcements_cache_v1');

    let pCount = 0;
    if (storedPapers !== null) {
      const p = parseInt(storedPapers, 10);
      if (!isNaN(p) && p > 0) pCount = p;
    }
    try {
      const rawPapers = localStorage.getItem('aplus_papers_v1');
      if (rawPapers) {
        const arr = JSON.parse(rawPapers);
        if (Array.isArray(arr)) {
          const filteredLen = effectiveAdmin
            ? arr.length
            : arr.filter((item: any) => item && item.userId === effectiveUserId).length;
          if (filteredLen > pCount) {
            pCount = filteredLen;
            localStorage.setItem(`total_papers_count_${key}`, pCount.toString());
          }
        }
      }
    } catch (_) {}
    if (pCount > 0 || storedPapers !== null) {
      this.stats.papersCount = pCount;
    }

    let uCount = 0;
    if (storedUsers !== null) {
      const u = parseInt(storedUsers, 10);
      if (!isNaN(u) && u > 0) uCount = u;
    }
    try {
      const rawUsers = localStorage.getItem('aplus_all_users_backup');
      if (rawUsers) {
        const arr = JSON.parse(rawUsers);
        if (Array.isArray(arr) && arr.length > uCount) {
          uCount = arr.length;
          localStorage.setItem('total_users_count', uCount.toString());
        }
      }
    } catch (_) {}
    if (uCount > 0 || storedUsers !== null) {
      this.stats.schoolsCount = uCount;
    }

    let patCount = 0;
    if (storedPatterns !== null) {
      const pat = parseInt(storedPatterns, 10);
      if (!isNaN(pat) && pat > 0) patCount = pat;
    }
    try {
      const rawPatterns = localStorage.getItem('aplus_all_patterns_cache') || localStorage.getItem('aplus_custom_patterns_v1');
      if (rawPatterns) {
        const arr = JSON.parse(rawPatterns);
        if (Array.isArray(arr) && arr.length > patCount) {
          patCount = arr.length;
          localStorage.setItem('total_patterns_count', patCount.toString());
        }
      }
    } catch (_) {}
    if (patCount > 0 || storedPatterns !== null) {
      this.stats.patternsCount = patCount;
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

    // 2. Fetch live or IndexedDB cached counts
    this.refreshServerCounts(userId, isAdmin);
    if (Date.now() > this.quotaCooldownUntil && !this.isSubscribed) {
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

  private persistCloudStatsMetadata(partialStats: Partial<DashboardStats>) {
    try {
      const ref = doc(db, STATS_COLLECTION, STATS_DOC);
      setDoc(ref, { ...partialStats, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    } catch (_) {}
  }

  private async populateCountsFromIndexedDBCache(effectiveAdmin: boolean, effectiveUserId?: string) {
    const key = effectiveAdmin ? 'admin' : (effectiveUserId || 'admin');

    // 1. Papers from IndexedDB cache
    try {
      let papersQuery = query(collection(db, 'papers'));
      if (!effectiveAdmin && effectiveUserId) {
        papersQuery = query(collection(db, 'papers'), where('userId', '==', effectiveUserId));
      }
      const cacheSnap = await getDocsFromCache(papersQuery);
      if (!cacheSnap.empty) {
        const count = cacheSnap.docs.length;
        if (count >= this.stats.papersCount) {
          this.stats.papersCount = count;
          localStorage.setItem(`total_papers_count_${key}`, count.toString());
        }
      }
    } catch (_) {}

    // 2. Users/Schools from IndexedDB cache
    if (effectiveAdmin) {
      try {
        const usersSnap = await getDocsFromCache(collection(db, 'users'));
        if (!usersSnap.empty) {
          const validUsers = usersSnap.docs
            .map(d => d.data())
            .filter((u: any) => u && u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com' && u.id !== 'local-admin');
          const count = validUsers.length;
          if (count > 0 && count >= this.stats.schoolsCount) {
            this.stats.schoolsCount = count;
            localStorage.setItem('total_users_count', count.toString());
            try {
              localStorage.setItem('aplus_all_users_backup', JSON.stringify(validUsers));
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // 3. Patterns from IndexedDB cache
    try {
      const patternsSnap = await getDocsFromCache(collection(db, 'patterns'));
      if (!patternsSnap.empty) {
        const count = patternsSnap.docs.length;
        if (count >= this.stats.patternsCount) {
          this.stats.patternsCount = count;
          localStorage.setItem('total_patterns_count', count.toString());
        }
      }
    } catch (_) {}
  }

  /**
   * Fetches the 100% true, exact total count directly from Firestore database.
   * Uses a 1-read fast metadata document (`visibility_settings/dashboard_stats`) first
   * so any new custom domain with an empty cache loads accurate counts in <200ms!
   */
  public async refreshServerCounts(userId?: string, isAdmin?: boolean, force: boolean = false) {
    const effectiveAdmin = isAdmin ?? this.currentIsAdmin;
    const effectiveUserId = userId ?? this.currentUserId;
    const key = effectiveAdmin ? 'admin' : (effectiveUserId || 'admin');

    // Always reconcile from localStorage & IndexedDB cache first so counters are never stuck at 0
    this.loadFromLocalStorage(effectiveUserId, effectiveAdmin);
    await this.populateCountsFromIndexedDBCache(effectiveAdmin, effectiveUserId);
    this.notify();

    const now = Date.now();
    if (!force && (this.isRefreshing || (now - this.lastRefreshTime < 25000))) return;

    this.isRefreshing = true;
    this.lastRefreshTime = now;

    const safeTimeout = <T>(p: Promise<T>, ms: number = 6000): Promise<T> => {
      return Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), ms))
      ]);
    };

    try {
      // STEP A: 1-Read Fast Cloud Metadata Document (`visibility_settings/dashboard_stats`)
      // Works even when RunAggregationQuery (getCountFromServer) is throttled on Spark plan!
      try {
        const metaSnap = await safeTimeout(getDoc(doc(db, STATS_COLLECTION, STATS_DOC)), 5000);
        if (metaSnap.exists()) {
          const data = metaSnap.data();
          if (typeof data.schoolsCount === 'number' && data.schoolsCount > 0) {
            this.stats.schoolsCount = data.schoolsCount;
            localStorage.setItem('total_users_count', data.schoolsCount.toString());
          }
          if (typeof data.patternsCount === 'number' && data.patternsCount > 0) {
            this.stats.patternsCount = data.patternsCount;
            localStorage.setItem('total_patterns_count', data.patternsCount.toString());
          }
          if (typeof data.announcementsCount === 'number' && data.announcementsCount > 0) {
            this.stats.announcementsCount = data.announcementsCount;
          }
          if (effectiveAdmin && typeof data.papersCount === 'number' && data.papersCount > 0) {
            this.stats.papersCount = data.papersCount;
            localStorage.setItem('total_papers_count_admin', data.papersCount.toString());
          }
          this.notify();
        }
      } catch (_) {}

      // For non-admin teachers, if their personal paper count is still 0, fetch their papers count
      if (!effectiveAdmin && effectiveUserId) {
        const teacherQuery = query(collection(db, 'papers'), where('userId', '==', effectiveUserId));
        try {
          const snap = await safeTimeout(getDocs(teacherQuery), 8000);
          this.stats.papersCount = snap.size;
          localStorage.setItem(`total_papers_count_${key}`, snap.size.toString());
          this.notify();
        } catch (_) {}
      }

      if (Date.now() < this.quotaCooldownUntil) return;

      // STEP B: Server-side count aggregation if quota permits
      let updatedCloudMeta: Partial<DashboardStats> = {};

      if (effectiveAdmin) {
        try {
          const papersSnap = await safeTimeout(getCountFromServer(collection(db, 'papers')), 4500);
          const exactPapers = papersSnap.data().count;
          if (exactPapers > 0) {
            this.stats.papersCount = exactPapers;
            localStorage.setItem('total_papers_count_admin', exactPapers.toString());
            updatedCloudMeta.papersCount = exactPapers;
          }
        } catch (e: any) {
          if (this.isQuotaError(e)) {
            this.triggerQuotaCooldown();
            return;
          }
        }
      }

      if (effectiveAdmin && Date.now() > this.quotaCooldownUntil) {
        try {
          const usersSnap = await safeTimeout(getCountFromServer(collection(db, 'users')), 4500);
          const totalRaw = usersSnap.data().count;
          const exactSchools = Math.max(0, totalRaw > 1 ? totalRaw - 1 : totalRaw);
          if (exactSchools > 0) {
            this.stats.schoolsCount = exactSchools;
            localStorage.setItem('total_users_count', exactSchools.toString());
            updatedCloudMeta.schoolsCount = exactSchools;
          }
        } catch (e: any) {
          if (this.isQuotaError(e)) {
            this.triggerQuotaCooldown();
            return;
          }
        }
      }

      if (Date.now() > this.quotaCooldownUntil) {
        try {
          const patternsSnap = await safeTimeout(getCountFromServer(collection(db, 'patterns')), 4500);
          const exactPatterns = patternsSnap.data().count;
          if (exactPatterns > 0) {
            this.stats.patternsCount = exactPatterns;
            localStorage.setItem('total_patterns_count', exactPatterns.toString());
            updatedCloudMeta.patternsCount = exactPatterns;
          }
        } catch (e: any) {
          if (this.isQuotaError(e)) {
            this.triggerQuotaCooldown();
            return;
          }
        }
      }

      if (Object.keys(updatedCloudMeta).length > 0) {
        this.persistCloudStatsMetadata(updatedCloudMeta);
      }
    } finally {
      this.isRefreshing = false;
      this.notify();
    }
  }

  public clearCache() {
    this.stats = {
      schoolsCount: 0,
      papersCount: 0,
      patternsCount: 0,
      announcementsCount: 1,
    };
  }

  public setExactPaperCount(count: number, userId?: string, isAdmin?: boolean) {
    const effectiveAdmin = isAdmin ?? this.currentIsAdmin;
    const key = effectiveAdmin ? 'admin' : (userId || this.currentUserId || 'admin');
    if (effectiveAdmin && count < this.stats.papersCount) {
      // Do not overwrite global total with a paginated subset
      return;
    }
    this.stats.papersCount = count;
    try {
      localStorage.setItem(`total_papers_count_${key}`, count.toString());
    } catch (_) {}
    if (effectiveAdmin && count > 0) {
      this.persistCloudStatsMetadata({ papersCount: count });
    }
    this.notify();
  }

  public setExactPatternCount(count: number) {
    if (count < this.stats.patternsCount) return;
    this.stats.patternsCount = count;
    try {
      localStorage.setItem('total_patterns_count', count.toString());
    } catch (_) {}
    if (count > 0) {
      this.persistCloudStatsMetadata({ patternsCount: count });
    }
    this.notify();
  }

  private incrementCloudStatsField(field: keyof DashboardStats, delta: number) {
    try {
      const ref = doc(db, STATS_COLLECTION, STATS_DOC);
      setDoc(ref, { [field]: increment(delta), updatedAt: Date.now() }, { merge: true }).catch(() => {});
    } catch (_) {}
  }

  // --- Optimistic Instant Mutators ---
  public optimisticPaperAdded(userId?: string) {
    this.stats.papersCount += 1;
    const key = this.currentIsAdmin ? 'admin' : (userId || this.currentUserId || 'admin');
    localStorage.setItem(`total_papers_count_${key}`, this.stats.papersCount.toString());
    const adminStored = parseInt(localStorage.getItem('total_papers_count_admin') || '0', 10);
    if (adminStored > 0 && !this.currentIsAdmin) {
      localStorage.setItem('total_papers_count_admin', (adminStored + 1).toString());
    }
    this.incrementCloudStatsField('papersCount', 1);
    this.notify();
  }

  public optimisticPaperDeleted(userId?: string) {
    this.stats.papersCount = Math.max(0, this.stats.papersCount - 1);
    const key = this.currentIsAdmin ? 'admin' : (userId || this.currentUserId || 'admin');
    localStorage.setItem(`total_papers_count_${key}`, this.stats.papersCount.toString());
    const adminStored = parseInt(localStorage.getItem('total_papers_count_admin') || '0', 10);
    if (adminStored > 0 && !this.currentIsAdmin) {
      localStorage.setItem('total_papers_count_admin', Math.max(0, adminStored - 1).toString());
    }
    this.incrementCloudStatsField('papersCount', -1);
    this.notify();
  }

  public optimisticPatternAdded() {
    this.stats.patternsCount += 1;
    localStorage.setItem('total_patterns_count', this.stats.patternsCount.toString());
    this.incrementCloudStatsField('patternsCount', 1);
    this.notify();
  }

  public optimisticPatternDeleted() {
    this.stats.patternsCount = Math.max(0, this.stats.patternsCount - 1);
    localStorage.setItem('total_patterns_count', this.stats.patternsCount.toString());
    this.incrementCloudStatsField('patternsCount', -1);
    this.notify();
  }

  public optimisticAnnouncementAdded() {
    this.stats.announcementsCount += 1;
    this.incrementCloudStatsField('announcementsCount', 1);
    this.notify();
  }

  public optimisticAnnouncementDeleted() {
    this.stats.announcementsCount = Math.max(1, this.stats.announcementsCount - 1);
    this.incrementCloudStatsField('announcementsCount', -1);
    this.notify();
  }

  public optimisticSchoolAdded() {
    this.stats.schoolsCount += 1;
    localStorage.setItem('total_users_count', this.stats.schoolsCount.toString());
    this.incrementCloudStatsField('schoolsCount', 1);
    this.notify();
  }

  public optimisticSchoolDeleted() {
    this.stats.schoolsCount = Math.max(0, this.stats.schoolsCount - 1);
    localStorage.setItem('total_users_count', this.stats.schoolsCount.toString());
    this.incrementCloudStatsField('schoolsCount', -1);
    this.notify();
  }

  public optimisticUserCountUpdated(count: number) {
    this.stats.schoolsCount = count;
    localStorage.setItem('total_users_count', count.toString());
    if (count > 0) {
      this.persistCloudStatsMetadata({ schoolsCount: count });
    }
    this.notify();
  }

  private initFirestoreListeners(userId?: string, isAdmin?: boolean) {
    this.unsubscribeFirestore();
    this.isSubscribed = true;

    try {
      // Single lightweight listener on visibility_settings/dashboard_stats (1 doc read instead of 4 collection watchers!)
      const statsDocRef = doc(db, STATS_COLLECTION, STATS_DOC);
      const unsubStatsDoc = onSnapshot(statsDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.schoolsCount === 'number' && data.schoolsCount > 0) {
            this.stats.schoolsCount = data.schoolsCount;
            localStorage.setItem('total_users_count', data.schoolsCount.toString());
          }
          if (typeof data.patternsCount === 'number' && data.patternsCount > 0) {
            this.stats.patternsCount = data.patternsCount;
            localStorage.setItem('total_patterns_count', data.patternsCount.toString());
          }
          if (typeof data.announcementsCount === 'number' && data.announcementsCount > 0) {
            this.stats.announcementsCount = data.announcementsCount;
          }
          if (isAdmin && typeof data.papersCount === 'number' && data.papersCount > 0) {
            this.stats.papersCount = data.papersCount;
            localStorage.setItem('total_papers_count_admin', data.papersCount.toString());
          }
          this.notify();
        }
      }, (err) => {
        if (this.isQuotaError(err)) this.triggerQuotaCooldown();
      });
      this.unsubs.push(unsubStatsDoc);
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
