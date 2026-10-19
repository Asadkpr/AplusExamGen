
import React, { useState, useEffect } from 'react';
import { ViewState, User, PaperPattern, SavedPaper } from './types';
import { subscribeToAuth, logoutUser, refreshUserProfile, resetUserCache } from './services/authService';
import { resetPaperCache } from './services/paperService';
import { resetPatternCache } from './services/patternService';
import { resetAnnouncementCache } from './services/announcementService';
import { resetChapterCache } from './services/chapterService';
import { resetSubjectCache } from './services/subjectService';
import { resetQuestionCache } from './services/questionService';
import { syncService } from './services/syncService';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';
import { Dashboard } from './components/Dashboard';
import { InstituteSetup } from './components/InstituteSetup';
import { GeneratePaper } from './components/GeneratePaper';
import { UploadPaper } from './components/UploadPaper';
import { SavedPapers } from './components/SavedPapers';
import { PaperPatterns } from './components/PaperPatterns';
import { HelpSupport } from './components/HelpSupport';
import { AboutUs } from './components/AboutUs';
import { ManageContent } from './components/ManageContent';
import { TeachersDirectory } from './components/TeachersDirectory';
import { NewsAnnouncements } from './components/NewsAnnouncements';
import { WhatsAppButton } from './components/WhatsAppButton';
import { ThemeProvider } from './context/ThemeContext';
import { LOCAL_STORAGE_SESSION_KEY } from './constants';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return null;
  });
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (stored) {
        const u = JSON.parse(stored);
        if (u) {
          if (u.instituteProfile || u.email === 'admin@aplusexamgen.com' || u.email === 'admin' || u.id === 'local-admin') {
            return 'DASHBOARD';
          }
          return 'INSTITUTE_SETUP';
        }
      }
    } catch (_) {}
    return 'LOGIN';
  });
  const [isInitializing, setIsInitializing] = useState(false);
  
  const [selectedPatternForGeneration, setSelectedPatternForGeneration] = useState<PaperPattern | undefined>(undefined);
  const [selectedPaperToOpen, setSelectedPaperToOpen] = useState<SavedPaper | undefined>(undefined);
  const [hasSeenDemoAlert, setHasSeenDemoAlert] = useState<boolean>(() => {
    return sessionStorage.getItem('aplus_demo_seen') === 'true';
  });

  const handleDismissDemoAlert = () => {
    setHasSeenDemoAlert(true);
    sessionStorage.setItem('aplus_demo_seen', 'true');
  };

  const deepFetchAttempted = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // Firebase Auth Listener
    const unsubscribe = subscribeToAuth(async (user) => {
      if (user) {
        // --- DEEP CHECK LOGIC (run once per user session to avoid quota drain) ---
        if (!user.instituteProfile && !deepFetchAttempted.current.has(user.id)) {
           deepFetchAttempted.current.add(user.id);
           try {
             const refreshedUser = await refreshUserProfile(user.id);
             if (refreshedUser && refreshedUser.instituteProfile) {
                user = refreshedUser; // Upgrade the user object
                localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
             }
           } catch(e) { 
             console.error("Deep fetch failed", e); 
           }
        }
        
        setCurrentUser(user);

        // Smart Redirect: If user has profile, go to Dashboard. Otherwise Setup.
        if (currentView === 'LOGIN' || currentView === 'SIGNUP' || currentView === 'INSTITUTE_SETUP') {
          if (user.instituteProfile || user.email === 'admin@aplusexamgen.com' || user.email === 'admin' || user.id === 'local-admin') {
            setCurrentView('DASHBOARD');
          } else {
            setCurrentView('INSTITUTE_SETUP');
          }
        }
      } else {
        // User is logged out
        setCurrentUser(null);
        if (currentView !== 'LOGIN' && currentView !== 'SIGNUP') {
          setCurrentView('LOGIN');
        }
      }
      setIsInitializing(false);
    });

    return () => {
      unsubscribe();
    }
  }, []);

  // Synchronize browser favicon with admin/institute profile logo or /logo.png
  useEffect(() => {
    const faviconUrl = currentUser?.instituteProfile?.logoUrl || '/logo.png';
    const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (link) {
      link.href = faviconUrl;
    }
  }, [currentUser?.instituteProfile?.logoUrl]);

  const invalidateAppCaches = (userId?: string, isAdmin?: boolean) => {
    resetUserCache();
    resetPaperCache();
    resetPatternCache();
    resetAnnouncementCache();
    resetChapterCache();
    resetSubjectCache();
    resetQuestionCache();
    syncService.clearCache();
    if (userId) {
      syncService.refreshServerCounts(userId, isAdmin);
    }
  };

  const handleLogout = async () => {
    invalidateAppCaches();
    await logoutUser();
    sessionStorage.removeItem('aplus_demo_seen');
    setHasSeenDemoAlert(false);
    setCurrentUser(null);
    setCurrentView('LOGIN');
  };

  const handleAuthSuccess = async (user: User) => {
    sessionStorage.removeItem('aplus_demo_seen');
    setHasSeenDemoAlert(false);
    const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';
    invalidateAppCaches(user.id, isAdmin);
    if (!user.instituteProfile) {
       try {
         const fresh = await refreshUserProfile(user.id);
         if (fresh && fresh.instituteProfile) {
            user = fresh;
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
         }
       } catch(e) { /* ignore */ }
    }

    setCurrentUser(user);
    if (user.instituteProfile || user.email === 'admin@aplusexamgen.com' || user.email === 'admin' || user.id === 'local-admin') {
      setCurrentView('DASHBOARD');
    } else {
      setCurrentView('INSTITUTE_SETUP');
    }
  };

  const handleProfileSetupSuccess = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedUser));
    setCurrentView('DASHBOARD');
  };

  const handleDashboardNavigate = (view: ViewState) => {
    if (view === 'PROFILE_SETTINGS') {
      setCurrentView('INSTITUTE_SETUP');
    } else {
      setSelectedPatternForGeneration(undefined);
      setSelectedPaperToOpen(undefined);
      setCurrentView(view);
    }
  };

  const handleUsePattern = (pattern: PaperPattern) => {
    setSelectedPatternForGeneration(pattern);
    setSelectedPaperToOpen(undefined);
    setCurrentView('GENERATE_PAPER');
  };

  const handleOpenPaper = (paper: SavedPaper) => {
    setSelectedPaperToOpen(paper);
    setSelectedPatternForGeneration(undefined);
    setCurrentView('GENERATE_PAPER');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gold-500">
        <div className="text-xl font-bold animate-pulse">Connecting to Server...</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div>
        {currentView === 'LOGIN' && (
          <Login 
            onNavigateSignUp={() => setCurrentView('SIGNUP')} 
            onSuccess={handleAuthSuccess}
          />
        )}
        {currentView === 'SIGNUP' && (
          <SignUp 
            onNavigateLogin={() => setCurrentView('LOGIN')}
            onSuccess={handleAuthSuccess}
          />
        )}
        {currentView === 'INSTITUTE_SETUP' && currentUser && (
          <InstituteSetup 
            user={currentUser}
            onSuccess={handleProfileSetupSuccess}
            onBack={() => setCurrentView('DASHBOARD')}
          />
        )}
        {currentView === 'DASHBOARD' && currentUser && (
          <Dashboard 
            user={currentUser} 
            onLogout={handleLogout}
            onNavigate={handleDashboardNavigate}
            showDemoAlert={!hasSeenDemoAlert}
            onCloseDemoAlert={handleDismissDemoAlert}
          />
        )}
        {currentView === 'GENERATE_PAPER' && currentUser && (
          <GeneratePaper 
            user={currentUser}
            onBack={() => setCurrentView(selectedPaperToOpen ? 'SAVED_PAPERS' : 'DASHBOARD')}
            initialPattern={selectedPatternForGeneration}
            initialPaper={selectedPaperToOpen}
          />
        )}
        {currentView === 'UPLOAD_PAPER' && currentUser && (
          <UploadPaper 
            user={currentUser}
            onBack={() => setCurrentView('DASHBOARD')}
          />
        )}
        {currentView === 'MANAGE_CONTENT' && currentUser && (
          <ManageContent 
            user={currentUser}
            onBack={() => setCurrentView('DASHBOARD')}
          />
        )}
        {currentView === 'SAVED_PAPERS' && currentUser && (
          <SavedPapers 
            onBack={() => setCurrentView('DASHBOARD')}
            user={currentUser}
            onOpenPaper={handleOpenPaper}
          />
        )}
        {currentView === 'PAPER_PATTERNS' && currentUser && (
          (currentUser.email === 'admin' || currentUser.email === 'admin@aplusexamgen.com' || currentUser.id === 'local-admin') ? (
            <PaperPatterns 
              user={currentUser}
              onBack={() => setCurrentView('DASHBOARD')}
              onUsePattern={handleUsePattern}
            />
          ) : (
            <Dashboard 
              user={currentUser} 
              onLogout={handleLogout}
              onNavigate={handleDashboardNavigate}
              showDemoAlert={!hasSeenDemoAlert}
              onCloseDemoAlert={handleDismissDemoAlert}
            />
          )
        )}
        {currentView === 'TEACHERS_DIRECTORY' && currentUser && (
          <TeachersDirectory 
            user={currentUser}
            onBack={() => setCurrentView('DASHBOARD')}
          />
        )}
        {currentView === 'NEWS_ANNOUNCEMENTS' && currentUser && (
          <NewsAnnouncements 
            user={currentUser}
            onBack={() => setCurrentView('DASHBOARD')}
          />
        )}
        {currentView === 'HELP_SUPPORT' && currentUser && (
          <HelpSupport 
            onBack={() => setCurrentView('DASHBOARD')}
          />
        )}
        {currentView === 'ABOUT_US' && currentUser && (
          <AboutUs 
            onBack={() => setCurrentView('DASHBOARD')}
          />
        )}

        {/* Global Floating WhatsApp Support Button */}
        <WhatsAppButton />
      </div>
    </ThemeProvider>
  );
};

export default App;
