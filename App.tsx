import React, { useState, useEffect } from 'react';
import { ViewState, User, PaperPattern } from './types';
import { subscribeToAuth, logoutUser, refreshUserProfile } from './services/authService';
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
import { ThemeProvider } from './context/ThemeContext';
import { LOCAL_STORAGE_SESSION_KEY } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [selectedPatternForGeneration, setSelectedPatternForGeneration] = useState<PaperPattern | undefined>(undefined);

  useEffect(() => {
    // Firebase Auth Listener
    const unsubscribe = subscribeToAuth(async (user) => {
      if (user) {
        // --- DEEP CHECK LOGIC ---
        // If user is logged in but instituteProfile is missing, it might be a sync error.
        // Try to fetch one last time using Admin privileges before showing Setup screen.
        if (!user.instituteProfile) {
           console.log("Profile missing, attempting deep fetch...");
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
        // Only switch view if we are in an Auth flow (Login/Signup/Setup) or freshly loaded
        if (currentView === 'LOGIN' || currentView === 'SIGNUP' || currentView === 'INSTITUTE_SETUP') {
          if (user.instituteProfile) {
            setCurrentView('DASHBOARD');
          } else {
            setCurrentView('INSTITUTE_SETUP');
          }
        }
      } else {
        // User is logged out (user is null)
        setCurrentUser(null);
        
        // Only force redirect to LOGIN if we are currently on a protected route.
        // If we are on SIGNUP, we should allow it to stay there.
        if (currentView !== 'LOGIN' && currentView !== 'SIGNUP') {
          setCurrentView('LOGIN');
        }
      }
      setIsInitializing(false);
    });

    // Safety timeout: If Firebase takes too long or fails (e.g. config error), stop loading
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 2000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    }
  }, []); // CRITICAL FIX: Empty dependency array prevents infinite loops/lag

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCurrentView('LOGIN');
  };

  const handleAuthSuccess = async (user: User) => {
    // Manually set state for Local Fallback scenarios
    
    // Safety Check: If profile is missing, try one last fetch before deciding view
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
    if (user.instituteProfile) {
      setCurrentView('DASHBOARD');
    } else {
      setCurrentView('INSTITUTE_SETUP');
    }
  };

  const handleProfileSetupSuccess = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setCurrentView('DASHBOARD');
  };

  const handleDashboardNavigate = (view: ViewState) => {
    if (view === 'PROFILE_SETTINGS') {
      setCurrentView('INSTITUTE_SETUP');
    } else {
      setSelectedPatternForGeneration(undefined);
      setCurrentView(view);
    }
  };

  const handleUsePattern = (pattern: PaperPattern) => {
    setSelectedPatternForGeneration(pattern);
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
          />
        )}
        {currentView === 'DASHBOARD' && currentUser && (
          <Dashboard 
            user={currentUser} 
            onLogout={handleLogout}
            onNavigate={handleDashboardNavigate}
          />
        )}
        {currentView === 'GENERATE_PAPER' && currentUser && (
          <GeneratePaper 
            user={currentUser}
            onBack={() => setCurrentView('DASHBOARD')}
            initialPattern={selectedPatternForGeneration}
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
          />
        )}
        {currentView === 'PAPER_PATTERNS' && currentUser && (
          <PaperPatterns 
            user={currentUser}
            onBack={() => setCurrentView('DASHBOARD')}
            onUsePattern={handleUsePattern}
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
      </div>
    </ThemeProvider>
  );
};

export default App;