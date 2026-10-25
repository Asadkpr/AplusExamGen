
import React, { useState, useEffect } from 'react';
import { User, ViewState } from '../types';
import { getAllUsers, getUserCount, getCachedUserCountSync } from '../services/authService';
import { getAnnouncements, getCachedAnnouncementsSync } from '../services/announcementService';
import { getPaperCount, getCachedPaperCountSync } from '../services/paperService';
import { getPatternCount, getCachedPatternCountSync } from '../services/patternService';
import { APP_NAME, COPYRIGHT_TEXT } from '../constants';
import { useTheme } from '../context/ThemeContext';
import { FilePlus2, FolderOpen, UserCog, HelpCircle, LogOut, Menu, X, ChevronRight, UploadCloud, Users, School, Mail, Phone, Layout, Moon, Sun, Info, Wifi, WifiOff, AlertTriangle, Database, Megaphone, ExternalLink, Sparkles } from 'lucide-react';

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
  const isLocalMode = user.id === 'local-admin' || user.id.startsWith('local-');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleCloseDemoAlert = () => {
    if (onCloseDemoAlert) {
      onCloseDemoAlert();
    }
  };

  // Initialize with cached sync count so page displays INSTANTLY without delay or '...'
  const [userCount, setUserCount] = useState<number | null>(() => getCachedUserCountSync());
  const [paperCount, setPaperCount] = useState<number | null>(() => getCachedPaperCountSync(isAdmin ? undefined : user.id));
  const [patternCount, setPatternCount] = useState<number | null>(() => getCachedPatternCountSync());
  const [newsList, setNewsList] = useState(() => getCachedAnnouncementsSync());
  const [latestAnnouncement, setLatestAnnouncement] = useState<string | null>(() => {
    const cached = getCachedAnnouncementsSync();
    return cached.length > 0 ? cached[0].title : null;
  });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    // 1. Fetch Announcements using cache first
    getAnnouncements(false).then(news => {
      if (news && news.length > 0) {
        setNewsList(news);
        setLatestAnnouncement(news[0].title);
      }
    }).catch(e => console.warn('Announcement fetch error:', e));

    // 2. Fetch Paper Count (Instant server aggregation: 1 read only, always 100% live on refresh)
    getPaperCount(isAdmin ? undefined : user.id, true).then(pc => {
      setPaperCount(pc);
    }).catch(e => console.warn('Paper count error:', e));

    // 3. Fetch Pattern Count (Instant server aggregation: 1 read only, always 100% live on refresh)
    getPatternCount(true).then(patc => {
      setPatternCount(patc);
    }).catch(e => console.warn('Pattern count error:', e));

    // 4. Fetch User Count for Admin (Instant server aggregation: 1 read only, always 100% live on refresh)
    if (isAdmin) {
      getUserCount(true).then(uc => {
        setUserCount(uc);
      }).catch(e => console.warn('User count error:', e));
    }
  }, [isAdmin, user.id]);

  const sidebarItems = [
    { id: 'GENERATE_PAPER', label: 'Generate Paper', icon: <FilePlus2 size={20} /> },
    { id: 'SAVED_PAPERS', label: 'Saved Papers', icon: <FolderOpen size={20} /> },
    { id: 'NEWS_ANNOUNCEMENTS', label: 'News & Announcements', icon: <Megaphone size={20} /> },
    ...(isAdmin ? [
      { id: 'PAPER_PATTERNS', label: 'Paper Patterns', icon: <Layout size={20} /> },
      { id: 'UPLOAD_PAPER', label: 'Upload Paper', icon: <UploadCloud size={20} /> },
      { id: 'MANAGE_CONTENT', label: 'Question Bank', icon: <Database size={20} /> },
      { id: 'TEACHERS_DIRECTORY', label: 'Registered School', icon: <Users size={20} /> }
    ] : []),
    { id: 'PROFILE_SETTINGS', label: 'Profile Setup', icon: <UserCog size={20} /> },
    { id: 'ABOUT_US', label: 'About Us', icon: <Info size={20} /> },
    { id: 'HELP_SUPPORT', label: 'Help & Support', icon: <HelpCircle size={20} /> },
  ];

  const gridItems = [
    { id: 'GENERATE_PAPER', label: 'Generate Paper', desc: 'Create new exam', icon: <FilePlus2 className="w-10 h-10 text-gold-500" /> },
    { id: 'SAVED_PAPERS', label: 'Saved Papers', desc: 'View past exams', icon: <FolderOpen className="w-10 h-10 text-gold-400" /> },
    { id: 'NEWS_ANNOUNCEMENTS', label: 'News & Updates', desc: 'Latest bulletins', icon: <Megaphone className="w-10 h-10 text-gold-400" /> },
    ...(isAdmin ? [
      { id: 'PAPER_PATTERNS', label: 'Paper Patterns', desc: 'Manage Layouts', icon: <Layout className="w-10 h-10 text-gold-400" /> },
      { id: 'UPLOAD_PAPER', label: 'Upload Paper', desc: 'Import Questions', icon: <UploadCloud className="w-10 h-10 text-gold-400" /> },
      { id: 'MANAGE_CONTENT', label: 'Question Bank', desc: 'Edit Content', icon: <Database className="w-10 h-10 text-gold-400" /> },
      { id: 'TEACHERS_DIRECTORY', label: 'Registered School', desc: 'View registered users', icon: <Users className="w-10 h-10 text-gold-400" /> }
    ] : []),
    { id: 'PROFILE_SETTINGS', label: 'Profile Setup', desc: 'Institute details', icon: <UserCog className="w-10 h-10 text-gold-400" /> },
    { id: 'HELP_SUPPORT', label: 'Help & Support', desc: 'FAQs & Contact', icon: <HelpCircle className="w-10 h-10 text-gold-400" /> },
  ];

  const handleNavClick = (view: string) => {
    onNavigate(view as ViewState);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex text-theme-text-main font-sans selection:bg-gold-500 selection:text-black transition-colors duration-300">
      <div className="lg:hidden fixed top-0 w-full bg-gray-800 border-b border-gray-700 z-50 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setIsSidebarOpen(true)} 
            className="text-gold-500 p-1 -ml-1 rounded-lg active:bg-gray-700 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-lg text-gold-500 tracking-wider">APLUS EXAMGEN</span>
        </div>

        {/* Mobile Top Bar Logout Button - Instantly visible & accessible on mobile */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLogout();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-white bg-red-600 hover:bg-red-500 active:bg-red-700 active:scale-95 transition-all shadow-md shadow-red-950/40 border border-red-500/80 cursor-pointer"
          title="Log Out"
        >
          <LogOut size={14} className="text-white" />
          <span>Log Out</span>
        </button>
      </div>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <aside 
        className={`fixed lg:sticky top-0 left-0 h-[100dvh] max-h-[100dvh] w-64 bg-gray-800 border-r border-gray-700 z-50 transform transition-transform duration-300 lg:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 shrink-0">
          <h1 className="text-lg font-extrabold text-gold-500 tracking-widest uppercase whitespace-nowrap">APLUS EXAMGEN</h1>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarOpen(false);
                onLogout();
              }}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1 text-[11px] font-black text-white bg-red-600 hover:bg-red-500 rounded-lg active:scale-95 transition-all shadow border border-red-500"
              title="Log Out"
            >
              <LogOut size={12} />
              <span>Log Out</span>
            </button>
            <button 
              type="button"
              onClick={() => setIsSidebarOpen(false)} 
              className="lg:hidden text-theme-text-muted hover:text-white p-1"
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>
        </div>
        <div className="p-4 border-b border-gray-700 bg-gray-800 transition-colors shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-500 font-bold border border-gold-500/30 shrink-0">{user.name.charAt(0)}</div>
             <div className="overflow-hidden">
               <p className="text-sm font-bold text-theme-text-main truncate w-32">{isAdmin ? "Admin Access" : user.name}</p>
               <p className="text-xs text-gold-500">{isAdmin ? "System Admin" : "Teacher"}</p>
             </div>
           </div>
           <div className={`mt-3 flex items-center justify-center gap-2 px-2 py-1 rounded text-[10px] font-bold uppercase border bg-green-500/10 border-green-500/30 text-green-400`}><Wifi size={12} />Cloud Connected</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
           {sidebarItems.map(item => (
             <button 
               key={item.id} 
               type="button"
               onClick={() => handleNavClick(item.id)} 
               className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-theme-text-muted hover:bg-gray-750 hover:text-gold-500 transition-all group"
             >
               <span className="group-hover:scale-110 transition-transform">{item.icon}</span>
               {item.label}
               <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100" />
             </button>
           ))}
        </nav>
        <div className="p-4 border-t border-gray-700 bg-gray-900/60 space-y-2.5 pb-6 shrink-0">
          <button 
            type="button"
            onClick={toggleTheme} 
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-theme-text-muted hover:text-theme-text-main bg-gray-800 rounded-xl transition-colors border border-gray-700 active:scale-98"
          >
            {isDarkMode ? <Sun size={15} className="text-gold-400" /> : <Moon size={15} className="text-indigo-400" />}
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSidebarOpen(false);
              onLogout();
            }} 
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-black text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-950/50 border border-red-500 cursor-pointer active:scale-98"
          >
            <LogOut size={18} className="text-white" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-grow pt-16 lg:pt-0 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {/* Banner removed */}
          {fetchError && (
            <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-500 mt-1" size={24} />
              <div>
                <h3 className="text-red-400 font-bold">Data Fetch Error</h3>
                <p className="text-theme-text-muted text-sm mt-1">{fetchError}</p>
              </div>
            </div>
          )}
          
          {latestAnnouncement && (
            <div 
              onClick={() => onNavigate('NEWS_ANNOUNCEMENTS')}
              className="mb-8 bg-gold-500/10 border border-gold-500/30 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-gold-500/20 transition-all animate-fadeIn"
            >
              <div className="bg-gold-500 p-2 rounded-full text-black animate-bounce shrink-0"><Megaphone size={16} /></div>
              <div className="flex-grow min-w-0">
                <span className="text-[10px] font-black uppercase text-gold-500 tracking-widest">Latest Update</span>
                <p className="text-theme-text-main text-xs sm:text-sm font-bold truncate">{latestAnnouncement}</p>
              </div>
              <ChevronRight size={20} className="text-gold-500" />
            </div>
          )}

          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-2xl p-5 md:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between relative overflow-hidden mb-8 border border-gray-800 shadow-xl gap-6">
            <div className="flex items-center gap-4 z-10 w-full lg:w-auto">
              {user.instituteProfile?.logoUrl && !isAdmin ? (
                <img src={user.instituteProfile.logoUrl} alt="Institute Logo" className="w-16 h-16 rounded-full object-contain bg-white p-1 border-2 border-gold-500 shadow-xl shrink-0" />
              ) : (
                <div className="bg-white/10 p-4 rounded-full border border-white/5 shadow-inner shrink-0">
                  <UserCog size={32} className="text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Welcome, {isAdmin ? "Master Admin" : user.name}</h1>
                <p className="text-gray-400 text-xs md:text-sm mt-1 max-w-md">{isAdmin ? "Manage system, users and directory." : "Create and manage your examination papers."}</p>
                {!isAdmin && user.instituteProfile && (
                  <div className="flex items-center gap-2 mt-2 text-gray-300 text-[10px] md:text-xs font-medium bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10">
                     <School size={12} className="text-gold-500" />
                     <span>{user.instituteProfile.instituteName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats inside Banner (Right Side) */}
            <div className="grid grid-cols-2 gap-3 z-10 w-full lg:w-[55%] xl:w-[50%]">
              {isAdmin && (
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-2.5 md:py-3 flex items-center gap-3 shadow-lg hover:border-gold-500/50 transition-colors group">
                  <div className="bg-gold-500/10 p-2 md:p-2.5 rounded-full text-gold-500 shrink-0 group-hover:scale-110 transition-transform"><Users size={16} /></div>
                  <div>
                    <h3 className="text-base md:text-lg font-black text-white leading-none mb-0.5">{userCount !== null ? userCount : '...'}</h3>
                    <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Schools</p>
                  </div>
                </div>
              )}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-2.5 md:py-3 flex items-center gap-3 shadow-lg hover:border-gold-500/50 transition-colors group">
                <div className="bg-blue-500/10 p-2 md:p-2.5 rounded-full text-blue-400 shrink-0 group-hover:scale-110 transition-transform"><FolderOpen size={16} /></div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white leading-none mb-0.5">{paperCount !== null ? paperCount : '...'}</h3>
                  <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Papers</p>
                </div>
              </div>
              {isAdmin && (
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-2.5 md:py-3 flex items-center gap-3 shadow-lg hover:border-gold-500/50 transition-colors group">
                  <div className="bg-emerald-500/10 p-2 md:p-2.5 rounded-full text-emerald-400 shrink-0 group-hover:scale-110 transition-transform"><Layout size={16} /></div>
                  <div>
                    <h3 className="text-base md:text-lg font-black text-white leading-none mb-0.5">{patternCount !== null ? patternCount : '...'}</h3>
                    <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Patterns</p>
                  </div>
                </div>
              )}
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-2.5 md:py-3 flex items-center gap-3 shadow-lg hover:border-gold-500/50 transition-colors group">
                <div className="bg-purple-500/10 p-2 md:p-2.5 rounded-full text-purple-400 shrink-0 group-hover:scale-110 transition-transform"><Megaphone size={16} /></div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white leading-none mb-0.5">{newsList.length > 0 ? newsList.length : (latestAnnouncement ? '1' : '1')}</h3>
                  <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Updates</p>
                </div>
              </div>
            </div>

            {/* Background Graphic */}
            <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] pointer-events-none transform rotate-12 scale-150">
               <FilePlus2 size={300} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
             <div className="flex justify-between items-end mb-4">
               <h2 className="text-xl font-bold text-theme-text-main">Quick Actions</h2>
               <span className="text-xs text-theme-text-muted flex items-center gap-1 cursor-pointer hover:text-gold-500 transition-colors">Access your most used features <ChevronRight size={14}/></span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div onClick={() => onNavigate('GENERATE_PAPER')} className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gold-500/30 hover:border-gold-500 rounded-2xl p-6 flex items-start gap-4 cursor-pointer group shadow-xl relative overflow-hidden transition-all hover:-translate-y-1">
                   <div className="bg-gold-500 p-4 rounded-full text-black shadow-[0_0_15px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform z-10 shrink-0"><FilePlus2 size={28} /></div>
                   <div className="z-10 flex-grow">
                     <h3 className="text-lg font-bold text-theme-text-main mb-1">Generate Paper</h3>
                     <p className="text-gray-400 text-sm leading-snug">Create a new examination paper with ease.</p>
                   </div>
                   <div className="absolute bottom-4 right-4 bg-gray-700 text-theme-text-main rounded-full p-2 group-hover:bg-gold-500 group-hover:text-black transition-colors z-10"><ChevronRight size={20} /></div>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-full blur-2xl pointer-events-none"></div>
                </div>

                <div onClick={() => onNavigate('SAVED_PAPERS')} className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-blue-500/30 hover:border-blue-500 rounded-2xl p-6 flex items-start gap-4 cursor-pointer group shadow-xl relative overflow-hidden transition-all hover:-translate-y-1">
                   <div className="bg-blue-600 p-4 rounded-full text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] group-hover:scale-110 transition-transform z-10 shrink-0"><FolderOpen size={28} /></div>
                   <div className="z-10 flex-grow">
                     <h3 className="text-lg font-bold text-white mb-1">Saved Papers</h3>
                     <p className="text-gray-400 text-sm leading-snug">View and manage your saved papers.</p>
                   </div>
                   <div className="absolute bottom-4 right-4 bg-gray-700 text-white rounded-full p-2 group-hover:bg-blue-500 transition-colors z-10"><ChevronRight size={20} /></div>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                </div>
             </div>
          </div>

          {/* More Features */}
          <div className="mb-8">
             <div className="flex justify-between items-end mb-4">
               <h2 className="text-xl font-bold text-theme-text-main">More Features</h2>
               <span className="text-xs text-theme-text-muted flex items-center gap-1 cursor-pointer hover:text-gold-500 transition-colors">Everything you need in one place <ChevronRight size={14}/></span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div onClick={() => onNavigate('NEWS_ANNOUNCEMENTS')} className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all">
                   <div className="bg-purple-600 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0"><Megaphone size={20} /></div>
                   <div className="flex-grow">
                     <h3 className="text-sm md:text-base font-bold text-theme-text-main">News & Updates</h3>
                     <p className="text-gray-400 text-xs mt-0.5">View latest bulletins and announcements.</p>
                   </div>
                   <div className="bg-gray-700 text-white rounded-full p-1.5 group-hover:bg-gray-600 transition-colors"><ChevronRight size={16} /></div>
                </div>

                <div onClick={() => onNavigate('PROFILE_SETTINGS')} className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all">
                   <div className="bg-green-600 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0"><UserCog size={20} /></div>
                   <div className="flex-grow">
                     <h3 className="text-sm md:text-base font-bold text-theme-text-main">Profile Setup</h3>
                     <p className="text-gray-400 text-xs mt-0.5">Complete your institute profile and details.</p>
                   </div>
                   <div className="bg-gray-700 text-white rounded-full p-1.5 group-hover:bg-gray-600 transition-colors"><ChevronRight size={16} /></div>
                </div>
                
                <div onClick={() => onNavigate('HELP_SUPPORT')} className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all">
                   <div className="bg-red-500 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0"><HelpCircle size={20} /></div>
                   <div className="flex-grow">
                     <h3 className="text-sm md:text-base font-bold text-theme-text-main">Help & Support</h3>
                     <p className="text-gray-400 text-xs mt-0.5">FAQs and contact information.</p>
                   </div>
                   <div className="bg-gray-700 text-white rounded-full p-1.5 group-hover:bg-gray-600 transition-colors"><ChevronRight size={16} /></div>
                </div>

                <div 
                  onClick={onLogout} 
                  className="bg-gray-800 border border-red-500/40 hover:border-red-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all hover:bg-red-500/5 active:scale-[0.99]"
                >
                   <div className="bg-red-600 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0 shadow-md shadow-red-900/40">
                     <LogOut size={20} />
                   </div>
                   <div className="flex-grow">
                     <h3 className="text-sm md:text-base font-bold text-red-400 group-hover:text-red-300">Log Out</h3>
                     <p className="text-gray-400 text-xs mt-0.5">Sign out of your session on this device.</p>
                   </div>
                   <div className="bg-gray-700 text-red-400 rounded-full p-1.5 group-hover:bg-red-600 group-hover:text-white transition-colors">
                     <ChevronRight size={16} />
                   </div>
                </div>



                {isAdmin && (
                  <>
                    <div onClick={() => onNavigate('PAPER_PATTERNS')} className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all">
                       <div className="bg-teal-500 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0"><Layout size={20} /></div>
                       <div className="flex-grow">
                         <h3 className="text-sm md:text-base font-bold text-theme-text-main">Paper Patterns</h3>
                         <p className="text-gray-400 text-xs mt-0.5">Manage your paper layouts and templates.</p>
                       </div>
                       <div className="bg-gray-700 text-white rounded-full p-1.5 group-hover:bg-gray-600 transition-colors"><ChevronRight size={16} /></div>
                    </div>
                    <div onClick={() => onNavigate('TEACHERS_DIRECTORY')} className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all">
                       <div className="bg-indigo-500 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0"><Users size={20} /></div>
                       <div className="flex-grow">
                         <h3 className="text-sm md:text-base font-bold text-theme-text-main">Registered Schools</h3>
                         <p className="text-gray-400 text-xs mt-0.5">Manage and view registered users.</p>
                       </div>
                       <div className="bg-gray-700 text-white rounded-full p-1.5 group-hover:bg-gray-600 transition-colors"><ChevronRight size={16} /></div>
                    </div>
                    <div onClick={() => onNavigate('MANAGE_CONTENT')} className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all">
                       <div className="bg-orange-500 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0"><Database size={20} /></div>
                       <div className="flex-grow">
                         <h3 className="text-sm md:text-base font-bold text-theme-text-main">Question Bank</h3>
                         <p className="text-gray-400 text-xs mt-0.5">Edit and manage the database.</p>
                       </div>
                       <div className="bg-gray-700 text-white rounded-full p-1.5 group-hover:bg-gray-600 transition-colors"><ChevronRight size={16} /></div>
                    </div>
                    <div onClick={() => onNavigate('UPLOAD_PAPER')} className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl p-5 flex items-center gap-4 cursor-pointer group transition-all">
                       <div className="bg-pink-500 p-3 rounded-full text-white group-hover:scale-110 transition-transform shrink-0"><UploadCloud size={20} /></div>
                       <div className="flex-grow">
                         <h3 className="text-sm md:text-base font-bold text-theme-text-main">Upload Paper</h3>
                         <p className="text-gray-400 text-xs mt-0.5">Import new questions to database.</p>
                       </div>
                       <div className="bg-gray-700 text-white rounded-full p-1.5 group-hover:bg-gray-600 transition-colors"><ChevronRight size={16} /></div>
                    </div>
                  </>
                )}
             </div>
          </div>
        </div>
      </main>

      {/* 🚀 School Management System Live Demo Announcement Modal */}
      {showDemoAlert && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/40 animate-fadeIn"
          onClick={handleCloseDemoAlert}
        >
          <div 
            className="relative w-full max-w-[380px] max-h-[92vh] overflow-y-auto bg-gray-900 border-2 border-gold-500/70 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.25)] p-4 sm:p-5 text-center animate-scaleUp custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background decorative glows */}
            <div className="absolute -top-12 -left-12 w-28 h-28 bg-gold-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Top Close (Cross) Button */}
            <button
              onClick={handleCloseDemoAlert}
              className="absolute top-2.5 right-2.5 p-1.5 text-gray-300 hover:text-white bg-gray-800/90 hover:bg-gray-700 border border-gray-600 rounded-full transition-colors z-20 shadow-md"
              title="Close"
              aria-label="Close"
            >
              <X size={15} />
            </button>

            {/* Announcement Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gold-500/15 border border-gold-500/40 text-gold-400 text-[10px] font-black uppercase tracking-wider mb-2">
              <Sparkles size={11} className="text-gold-400 animate-pulse" />
              <span>New Feature Ready</span>
            </div>

            {/* Icon Header */}
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center text-black shadow-md">
              <School size={20} className="text-gray-950" />
            </div>

            {/* Title */}
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight mb-1.5">
              School Management System
            </h2>

            {/* Short English announcement message */}
            <p className="text-gray-300 text-[11px] sm:text-xs leading-relaxed mb-2.5">
              Manage student admissions, fee vouchers, attendance, exams, and staff records in one unified platform.
            </p>

            {/* Demo Credentials Info Box */}
            <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-2 mb-3 text-left">
              <p className="text-[10px] sm:text-[11px] text-gold-200 leading-snug">
                <span className="font-bold text-gold-400 uppercase tracking-wide">Demo Login:</span> Username and password are provided at the bottom of the login page.
              </p>
            </div>

            {/* Feature Highlights Pills - Compact 2-column */}
            <div className="grid grid-cols-2 gap-1.5 mb-3.5 text-left text-[9px] sm:text-[10px] font-semibold text-gray-200">
              <div className="bg-gray-800/90 border border-gray-700/60 rounded-md px-2 py-1 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                <span className="truncate">Admissions & Fees</span>
              </div>
              <div className="bg-gray-800/90 border border-gray-700/60 rounded-md px-2 py-1 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">Attendance & Exams</span>
              </div>
              <div className="bg-gray-800/90 border border-gray-700/60 rounded-md px-2 py-1 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="truncate">Report Cards</span>
              </div>
              <div className="bg-gray-800/90 border border-gray-700/60 rounded-md px-2 py-1 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                <span className="truncate">Staff & Accounts</span>
              </div>
            </div>

            {/* Demo CTA Button */}
            <div className="space-y-1.5">
              <a
                href="https://schoolmanagement-s.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCloseDemoAlert}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-gray-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
              >
                <span>Explore Live Demo</span>
                <ExternalLink size={13} strokeWidth={2.5} />
              </a>

              <button
                type="button"
                onClick={handleCloseDemoAlert}
                className="text-[10px] sm:text-[11px] text-gray-400 hover:text-gray-200 transition-colors uppercase tracking-wider font-bold py-0.5"
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
