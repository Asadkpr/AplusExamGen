import React, { useState, useEffect } from 'react';
import { User, ViewState } from '../types';
import { getAllUsers, getCachedUserCountSync, resetUserCache } from '../services/authService';
import { getCachedAnnouncementsSync, subscribeToAnnouncements, resetAnnouncementCache } from '../services/announcementService';
import { getCachedPaperCountSync, getCachedTodayPaperCountSync, resetPaperCache, getSavedPapers } from '../services/paperService';
import { getCachedPatternCountSync, resetPatternCache, getPatterns } from '../services/patternService';
import { resetChapterCache } from '../services/chapterService';
import { resetSubjectCache } from '../services/subjectService';
import { resetQuestionCache } from '../services/questionService';
import { syncService, DashboardStats, getStartOfTodayMs } from '../services/syncService';
import {
  FilePlus2,
  FolderOpen,
  UserCog,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  Users,
  School,
  Layout,
  Info,
  AlertTriangle,
  Database,
  Megaphone,
  ExternalLink,
  Sparkles,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: ViewState) => void;
  showDemoAlert?: boolean;
  onCloseDemoAlert?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onLogout,
  onNavigate,
  showDemoAlert = false,
  onCloseDemoAlert
}) => {
  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleCloseDemoAlert = () => {
    if (onCloseDemoAlert) {
      onCloseDemoAlert();
    }
  };

  // Initialize with cached sync count so page displays INSTANTLY without delay
  const [userCount, setUserCount] = useState<number | null>(() => getCachedUserCountSync());
  const [paperCount, setPaperCount] = useState<number | null>(() => getCachedPaperCountSync(isAdmin ? undefined : user.id));
  const [todayPaperCount, setTodayPaperCount] = useState<number>(() => getCachedTodayPaperCountSync());
  const [, setPatternCount] = useState<number | null>(() => getCachedPatternCountSync());
  const [newsList, setNewsList] = useState(() => getCachedAnnouncementsSync());
  const [latestAnnouncement, setLatestAnnouncement] = useState<string | null>(() => {
    const cached = getCachedAnnouncementsSync();
    return cached.length > 0 ? cached[0].title : null;
  });
  const [fetchError] = useState<string | null>(null);
  const [isSyncingCounts, setIsSyncingCounts] = useState(false);

  const hydrateFallbackCounts = async (force: boolean = false) => {
    if (!isAdmin) {
      try {
        const papers = await getSavedPapers(user.id, isAdmin, force);
        if (papers.length > 0) {
          setPaperCount(papers.length);
          const startOfToday = getStartOfTodayMs();
          const todayLen = papers.filter(p => (p.createdAt || 0) >= startOfToday).length;
          syncService.setExactPaperCount(papers.length, user.id, isAdmin, todayLen);
        }
      } catch (_) {}
    }

    if (isAdmin) {
      try {
        const users = await getAllUsers(force);
        if (users.length > 0) {
          setUserCount(users.length);
          syncService.optimisticUserCountUpdated(users.length);
        }
      } catch (_) {}

      try {
        const patterns = await getPatterns(force);
        if (patterns.length > 0) {
          setPatternCount(patterns.length);
          syncService.setExactPatternCount(patterns.length);
        }
      } catch (_) {}
    }
  };

  const handleManualSyncCounts = async () => {
    setIsSyncingCounts(true);
    try {
      resetUserCache();
      resetPaperCache();
      resetPatternCache();
      resetAnnouncementCache();
      resetChapterCache();
      resetSubjectCache();
      resetQuestionCache();
      await syncService.refreshServerCounts(user.id, isAdmin, true);
      await hydrateFallbackCounts(true);
    } catch (_) {}
    setIsSyncingCounts(false);
  };

  useEffect(() => {
    const unsubStats = syncService.subscribe(user.id, isAdmin, (stats: DashboardStats) => {
      setPaperCount(stats.papersCount);
      setTodayPaperCount(stats.todayPapersCount ?? 0);
      setPatternCount(stats.patternsCount);
      if (isAdmin) {
        setUserCount(stats.schoolsCount);
      }
    });

    const unsubNews = subscribeToAnnouncements((news) => {
      if (news && news.length > 0) {
        setNewsList(news);
        setLatestAnnouncement(news[0].title);
      }
    });

    return () => {
      unsubStats();
      unsubNews();
    };
  }, [isAdmin, user.id]);

  const sidebarItems = [
    { id: 'GENERATE_PAPER', label: 'Generate Paper', icon: <FilePlus2 size={19} strokeWidth={1.9} /> },
    { id: 'SAVED_PAPERS', label: 'Saved Papers', icon: <FolderOpen size={19} strokeWidth={1.9} /> },
    { id: 'NEWS_ANNOUNCEMENTS', label: 'News & Announcements', icon: <Megaphone size={19} strokeWidth={1.9} /> },
    ...(isAdmin ? [
      { id: 'PAPER_PATTERNS', label: 'Paper Patterns', icon: <Layout size={19} strokeWidth={1.9} /> },
      { id: 'UPLOAD_PAPER', label: 'Upload Paper', icon: <UploadCloud size={19} strokeWidth={1.9} /> },
      { id: 'MANAGE_CONTENT', label: 'Question Bank', icon: <Database size={19} strokeWidth={1.9} /> },
      { id: 'TEACHERS_DIRECTORY', label: 'Registered School', icon: <Users size={19} strokeWidth={1.9} /> }
    ] : []),
    { id: 'PROFILE_SETTINGS', label: 'Profile Setup', icon: <UserCog size={19} strokeWidth={1.9} /> },
    { id: 'ABOUT_US', label: 'About Us', icon: <Info size={19} strokeWidth={1.9} /> },
    { id: 'HELP_SUPPORT', label: 'Help & Support', icon: <HelpCircle size={19} strokeWidth={1.9} /> },
  ];

  const handleNavClick = (view: string) => {
    onNavigate(view as ViewState);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex text-[#0F172A] font-sans selection:bg-[#C29B61] selection:text-white">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full bg-white border-b border-[#E5E7EB] z-50 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="text-[#0F172A] hover:text-[#B58B4C] p-1 rounded-lg transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-white border border-[#E2D9C8] p-0.5 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
            <img src="/logo.png" alt="APLUS Logo" className="w-full h-full object-contain rounded-md" />
          </div>
          <span className="font-extrabold text-base text-[#0F172A] tracking-tight">APLUS EXAMGEN</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsSidebarOpen(false);
            onLogout();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
          title="Log Out"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-[1px]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (Matching Reference Image: Crisp White, Warm Cream Active State, Clean Alignment) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-[100dvh] lg:h-screen w-64 bg-white border-r border-[#E5E7EB] z-50 transform transition-transform duration-300 lg:translate-x-0 flex flex-col select-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Subtle circular collapse badge on right edge like reference image */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden absolute -right-3.5 top-6 w-7 h-7 rounded-full bg-white border border-[#E5E7EB] shadow-md flex items-center justify-center text-[#475569] hover:text-[#0F172A]"
          aria-label="Close Sidebar"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Brand & User Profile Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#F1F5F9]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white border border-[#E2D9C8] p-0.5 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                <img src="/logo.png" alt="APLUS Logo" className="w-full h-full object-contain rounded-md" />
              </div>
              <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight whitespace-nowrap">
                APLUS EXAMGEN
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-[#64748B] hover:text-[#0F172A]"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#FBF9F5] border border-[#EFECE6]">
            {isAdmin ? (
              <img
                src="/logo.png"
                alt="Admin Logo"
                className="w-9 h-9 rounded-full object-contain bg-white p-0.5 border border-[#E2D9C8] shrink-0"
              />
            ) : user.instituteProfile?.logoUrl ? (
              <img
                src={user.instituteProfile.logoUrl}
                alt="Institute Logo"
                className="w-9 h-9 rounded-full object-contain bg-white p-0.5 border border-[#E2D9C8] shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#C29B61]/15 flex items-center justify-center text-[#9E763B] font-bold text-sm border border-[#C29B61]/30 shrink-0">
                {(user.name || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-bold text-[#0F172A] truncate">
                {isAdmin ? 'Admin Access' : user.name}
              </p>
              <p className="text-[11px] font-medium text-[#B58B4C] truncate">
                {isAdmin ? 'System Admin' : (user.instituteProfile?.instituteName || 'Teacher Account')}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Active Dashboard Item (Matches Reference Image Active Pill) */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 text-[13.5px] font-semibold rounded-xl bg-[#FBF6EE] text-[#B58B4C] transition-all cursor-default"
          >
            <span className="text-[#B58B4C] shrink-0">
              <LayoutGrid size={19} strokeWidth={2} />
            </span>
            <span className="truncate">Dashboard</span>
          </button>

          {sidebarItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 text-[13.5px] font-medium rounded-xl text-[#1E293B] hover:bg-[#FBF6EE] hover:text-[#B58B4C] transition-all group cursor-pointer"
            >
              <span className="text-[#334155] group-hover:text-[#B58B4C] transition-colors shrink-0">
                {item.icon}
              </span>
              <span className="truncate text-left flex-1">{item.label}</span>
              <ChevronRight
                size={14}
                className="ml-auto opacity-0 group-hover:opacity-100 text-[#B58B4C] transition-opacity shrink-0"
              />
            </button>
          ))}
        </nav>

        {/* Bottom Logout Button Only (Theme toggle removed as requested) */}
        <div className="p-4 border-t border-[#E5E7EB] bg-white shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsSidebarOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 text-[13.5px] font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut size={19} strokeWidth={1.9} className="shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow pt-16 lg:pt-0 p-4 sm:p-7 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {fetchError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-600 mt-0.5" size={20} />
              <div>
                <h3 className="text-red-700 font-bold text-sm">Data Fetch Error</h3>
                <p className="text-red-600 text-xs mt-0.5">{fetchError}</p>
              </div>
            </div>
          )}

          {/* Top Bar (Matches Reference Image Header Bar: "Dashboard" on Left, Action Buttons on Right) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                Welcome, <span className="font-semibold text-[#1E293B]">{isAdmin ? 'Master Admin' : user.name}</span>
                {!isAdmin && user.instituteProfile?.instituteName ? ` · ${user.instituteProfile.instituteName}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('GENERATE_PAPER')}
                className="px-4 py-2 rounded-lg bg-[#C29B61] hover:bg-[#B0894F] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <FilePlus2 size={16} />
                <span>Generate Paper</span>
              </button>
              <button
                type="button"
                onClick={handleManualSyncCounts}
                disabled={isSyncingCounts}
                className="px-4 py-2 rounded-lg bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw size={15} className={isSyncingCounts ? 'animate-spin text-[#C29B61]' : 'text-[#475569]'} />
                <span>{isSyncingCounts ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Latest Update Strip */}
          {latestAnnouncement && (
            <div
              onClick={() => onNavigate('NEWS_ANNOUNCEMENTS')}
              className="mb-6 bg-white border border-[#E5E7EB] rounded-2xl p-2 shadow-[0_2px_10px_rgba(15,23,42,0.03)] cursor-pointer hover:border-[#C29B61]/60 transition-all"
            >
              <div className="bg-[#FBF9F5] rounded-xl px-4 py-3 flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Megaphone size={17} />
                </div>
                <div className="flex-grow min-w-0">
                  <span className="text-[10px] font-bold uppercase text-[#B58B4C] tracking-wider block">
                    Latest Update
                  </span>
                  <p className="text-[#0F172A] text-xs sm:text-sm font-bold truncate">
                    {latestAnnouncement}
                  </p>
                </div>
                <ChevronRight size={18} className="text-[#64748B] shrink-0" />
              </div>
            </div>
          )}

          {/* Top Stat Counter Cards (Exact Style from Reference Image: White Frame + Warm Cream Inner Card + Rounded Icon Box) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-2'} gap-4 mb-7`}>
            {isAdmin && (
              <div
                onClick={() => onNavigate('TEACHERS_DIRECTORY')}
                className="bg-white rounded-2xl p-2 border border-[#ECEAE4] shadow-[0_2px_10px_rgba(15,23,42,0.04)] hover:border-[#C29B61]/60 transition-all cursor-pointer group"
              >
                <div className="bg-[#FBF9F5] rounded-xl px-4 py-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#4B5563] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Users size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#64748B] font-medium truncate">Schools</p>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight mt-0.5 tabular-nums">
                      {(userCount !== null ? userCount : 0).toLocaleString()}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div
              onClick={!isAdmin ? () => onNavigate('SAVED_PAPERS') : undefined}
              className={`bg-white rounded-2xl p-2 border border-[#ECEAE4] shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all group ${
                !isAdmin ? 'hover:border-[#C29B61]/60 cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="bg-[#FBF9F5] rounded-xl px-4 py-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <FolderOpen size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#64748B] font-medium truncate">
                    {isAdmin ? 'All Papers' : 'My Papers'}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight mt-0.5 tabular-nums">
                    {(paperCount !== null ? paperCount : 0).toLocaleString()}
                  </h3>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="bg-white rounded-2xl p-2 border border-[#ECEAE4] shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all group cursor-default">
                <div className="bg-[#FBF9F5] rounded-xl px-4 py-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#4B5563] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <FilePlus2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#64748B] font-medium truncate">
                      Today Generated Papers
                    </p>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight mt-0.5 tabular-nums">
                      {todayPaperCount.toLocaleString()}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div
              onClick={() => onNavigate('NEWS_ANNOUNCEMENTS')}
              className="bg-white rounded-2xl p-2 border border-[#ECEAE4] shadow-[0_2px_10px_rgba(15,23,42,0.04)] hover:border-[#C29B61]/60 transition-all cursor-pointer group"
            >
              <div className="bg-[#FBF9F5] rounded-xl px-4 py-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Megaphone size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#64748B] font-medium truncate">Updates</p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight mt-0.5 tabular-nums">
                    {newsList.length > 0 ? newsList.length : (latestAnnouncement ? 1 : 1)}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Main Dashboard Panels (Matching Reference Image White Containers + Warm Cream Summary Cards) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            {/* Left Panel: Quick Actions */}
            <div className="lg:col-span-5 bg-white border border-[#ECEAE4] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Quick Actions</h2>
                <span className="text-xs text-[#64748B] font-medium">Primary Workspace</span>
              </div>

              <div className="space-y-4 flex-1 flex flex-col justify-center">
                <div
                  onClick={() => onNavigate('GENERATE_PAPER')}
                  className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-2xl p-5 flex items-center gap-4 cursor-pointer group transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <FilePlus2 size={26} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-xs text-[#64748B] font-medium">Exam Creation</p>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] mt-0.5">
                      Generate Paper
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5 truncate">
                      Create a new examination paper with ease
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#475569] group-hover:bg-[#C29B61] group-hover:text-white group-hover:border-[#C29B61] transition-colors shrink-0">
                    <ChevronRight size={17} />
                  </div>
                </div>

                <div
                  onClick={() => onNavigate('SAVED_PAPERS')}
                  className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-2xl p-5 flex items-center gap-4 cursor-pointer group transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-[#4B5563] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <FolderOpen size={25} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-xs text-[#64748B] font-medium">Personal Archive</p>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#B58B4C] mt-0.5">
                      Saved Papers
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5 truncate">
                      View and manage your saved papers
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#475569] group-hover:bg-[#4B5563] group-hover:text-white group-hover:border-[#4B5563] transition-colors shrink-0">
                    <ChevronRight size={17} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: More Features */}
            <div className="lg:col-span-7 bg-white border border-[#ECEAE4] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">More Features</h2>
                <span className="text-xs text-[#64748B] font-medium">Tools & Management</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div
                  onClick={() => onNavigate('NEWS_ANNOUNCEMENTS')}
                  className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer group transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Megaphone size={18} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-bold text-[#0F172A] truncate">News & Updates</h3>
                    <p className="text-[#64748B] text-xs mt-0.5 truncate">Latest bulletins & alerts</p>
                  </div>
                  <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#0F172A] shrink-0" />
                </div>

                <div
                  onClick={() => onNavigate('PROFILE_SETTINGS')}
                  className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer group transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#4B5563] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <UserCog size={18} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-bold text-[#0F172A] truncate">Profile Setup</h3>
                    <p className="text-[#64748B] text-xs mt-0.5 truncate">Institute logo & details</p>
                  </div>
                  <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#0F172A] shrink-0" />
                </div>

                <div
                  onClick={() => onNavigate('HELP_SUPPORT')}
                  className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer group transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#4B5563] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <HelpCircle size={18} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-bold text-[#0F172A] truncate">Help & Support</h3>
                    <p className="text-[#64748B] text-xs mt-0.5 truncate">FAQs and contact support</p>
                  </div>
                  <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#0F172A] shrink-0" />
                </div>

                {isAdmin && (
                  <>
                    <div
                      onClick={() => onNavigate('PAPER_PATTERNS')}
                      className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer group transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                        <Layout size={18} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-bold text-[#0F172A] truncate">Paper Patterns</h3>
                        <p className="text-[#64748B] text-xs mt-0.5 truncate">Manage layouts & templates</p>
                      </div>
                      <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#0F172A] shrink-0" />
                    </div>

                    <div
                      onClick={() => onNavigate('TEACHERS_DIRECTORY')}
                      className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer group transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                        <Users size={18} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-bold text-[#0F172A] truncate">Registered Schools</h3>
                        <p className="text-[#64748B] text-xs mt-0.5 truncate">Manage registered users</p>
                      </div>
                      <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#0F172A] shrink-0" />
                    </div>

                    <div
                      onClick={() => onNavigate('MANAGE_CONTENT')}
                      className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer group transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#4B5563] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                        <Database size={18} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-bold text-[#0F172A] truncate">Question Bank</h3>
                        <p className="text-[#64748B] text-xs mt-0.5 truncate">Edit & manage questions</p>
                      </div>
                      <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#0F172A] shrink-0" />
                    </div>

                    <div
                      onClick={() => onNavigate('UPLOAD_PAPER')}
                      className="bg-[#FBF9F5] hover:bg-[#F5EFE4] border border-[#EFECE6] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer group transition-all sm:col-span-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#C29B61] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                        <UploadCloud size={18} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-bold text-[#0F172A] truncate">Upload Paper</h3>
                        <p className="text-[#64748B] text-xs mt-0.5 truncate">Import new questions via Excel / CSV</p>
                      </div>
                      <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#0F172A] shrink-0" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <footer className="mt-auto pt-6 pb-3 text-center text-xs text-[#64748B] border-t border-[#E5E7EB]">
            <p className="text-[11px] font-semibold tracking-wide">
              Powered by <span className="text-[#B58B4C] font-bold">primeTech.AI</span>
            </p>
          </footer>
        </div>
      </main>

      {/* School Management System Live Demo Announcement Modal */}
      {showDemoAlert && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/40 animate-fadeIn"
          onClick={handleCloseDemoAlert}
        >
          <div
            className="relative w-full max-w-[380px] max-h-[92vh] overflow-y-auto bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl p-5 text-center custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseDemoAlert}
              className="absolute top-3 right-3 p-1.5 text-[#64748B] hover:text-[#0F172A] bg-[#F4F6F9] hover:bg-[#E5E7EB] rounded-full transition-colors z-20"
              title="Close"
              aria-label="Close"
            >
              <X size={15} />
            </button>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FBF6EE] border border-[#E6D5B8] text-[#B58B4C] text-[10px] font-bold uppercase tracking-wider mb-2">
              <Sparkles size={11} className="text-[#C29B61]" />
              <span>New Feature Ready</span>
            </div>

            <div className="w-11 h-11 mx-auto mb-2.5 rounded-xl bg-[#C29B61] flex items-center justify-center text-white shadow-sm">
              <School size={21} />
            </div>

            <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] tracking-tight mb-1.5">
              School Management System
            </h2>

            <p className="text-[#64748B] text-xs leading-relaxed mb-3">
              Manage student admissions, fee vouchers, attendance, exams, and staff records in one unified platform.
            </p>

            <div className="bg-[#FBF9F5] border border-[#EFECE6] rounded-xl p-2.5 mb-3 text-left">
              <p className="text-[11px] text-[#334155] leading-snug">
                <span className="font-bold text-[#B58B4C] uppercase tracking-wide">Demo Login:</span> Username and password are provided at the bottom of the login page.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-4 text-left text-[10px] font-semibold text-[#1E293B]">
              <div className="bg-[#FBF9F5] border border-[#EFECE6] rounded-lg px-2.5 py-1.5 truncate">
                Admissions & Fees
              </div>
              <div className="bg-[#FBF9F5] border border-[#EFECE6] rounded-lg px-2.5 py-1.5 truncate">
                Attendance & Exams
              </div>
              <div className="bg-[#FBF9F5] border border-[#EFECE6] rounded-lg px-2.5 py-1.5 truncate">
                Report Cards
              </div>
              <div className="bg-[#FBF9F5] border border-[#EFECE6] rounded-lg px-2.5 py-1.5 truncate">
                Staff & Accounts
              </div>
            </div>

            <div className="space-y-2">
              <a
                href="https://schoolmanagement-s.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCloseDemoAlert}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C29B61] hover:bg-[#B0894F] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all"
              >
                <span>Explore Live Demo</span>
                <ExternalLink size={13} strokeWidth={2.5} />
              </a>

              <button
                type="button"
                onClick={handleCloseDemoAlert}
                className="text-[11px] text-[#64748B] hover:text-[#0F172A] transition-colors uppercase tracking-wider font-bold py-0.5"
              >
                Maybe Later / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
