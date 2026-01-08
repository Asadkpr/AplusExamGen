import React, { useState, useEffect } from 'react';
import { User, ViewState } from '../types';
import { getAllUsers } from '../services/authService';
import { APP_NAME, COPYRIGHT_TEXT } from '../constants';
import { useTheme } from '../context/ThemeContext';
import { FilePlus2, FolderOpen, UserCog, HelpCircle, LogOut, Menu, X, ChevronRight, UploadCloud, Users, School, Mail, Phone, Layout, Moon, Sun, Info, Wifi, WifiOff, AlertTriangle, Database } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: ViewState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const { isDarkMode, toggleTheme } = useTheme();
  
  // Consistent Admin check across components
  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';
  const isLocalMode = user.id === 'local-admin' || user.id.startsWith('local-');

  useEffect(() => {
    const fetchUsers = async () => {
      if (isAdmin) {
        const users = await getAllUsers();
        setRegisteredUsers(users.filter(u => u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com'));
      }
    };
    fetchUsers();
  }, [isAdmin]);

  const sidebarItems = [
    { id: 'GENERATE_PAPER', label: 'Generate Paper', icon: <FilePlus2 size={20} /> },
    { id: 'SAVED_PAPERS', label: 'Saved Papers', icon: <FolderOpen size={20} /> },
    { id: 'PAPER_PATTERNS', label: 'Paper Patterns', icon: <Layout size={20} /> },
    ...(isAdmin ? [
      { id: 'UPLOAD_PAPER', label: 'Upload Paper', icon: <UploadCloud size={20} /> },
      { id: 'MANAGE_CONTENT', label: 'Question Bank', icon: <Database size={20} /> }
    ] : []),
    { id: 'PROFILE_SETTINGS', label: 'Profile Setup', icon: <UserCog size={20} /> },
    { id: 'ABOUT_US', label: 'About Us', icon: <Info size={20} /> },
    { id: 'HELP_SUPPORT', label: 'Help & Support', icon: <HelpCircle size={20} /> },
  ];

  const gridItems = [
    { id: 'GENERATE_PAPER', label: 'Generate Paper', desc: 'Create new exam', icon: <FilePlus2 className="w-10 h-10 text-gold-500" /> },
    { id: 'SAVED_PAPERS', label: 'Saved Papers', desc: 'View past exams', icon: <FolderOpen className="w-10 h-10 text-gold-400" /> },
    { id: 'PAPER_PATTERNS', label: 'Paper Patterns', desc: 'Manage Layouts', icon: <Layout className="w-10 h-10 text-gold-400" /> },
    ...(isAdmin ? [{ 
      id: 'UPLOAD_PAPER', label: 'Upload Paper', desc: 'Import Questions', icon: <UploadCloud className="w-10 h-10 text-gold-400" /> 
    },
    { 
      id: 'MANAGE_CONTENT', label: 'Question Bank', desc: 'Edit Content', icon: <Database className="w-10 h-10 text-gold-400" /> 
    }] : []),
    { id: 'PROFILE_SETTINGS', label: 'Profile Setup', desc: 'Institute details', icon: <UserCog className="w-10 h-10 text-gold-400" /> },
    { id: 'HELP_SUPPORT', label: 'Help & Support', desc: 'FAQs & Contact', icon: <HelpCircle className="w-10 h-10 text-gold-400" /> },
  ];

  const handleNavClick = (view: string) => {
    onNavigate(view as ViewState);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex text-white font-sans selection:bg-gold-500 selection:text-black transition-colors duration-300">
      <div className="lg:hidden fixed top-0 w-full bg-gray-800 border-b border-gray-700 z-50 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3"><button onClick={() => setIsSidebarOpen(true)} className="text-gold-500"><Menu size={24} /></button><span className="font-bold text-lg text-gold-500 tracking-wider">APLUS EXAMGEN</span></div>
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-gray-800 border-r border-gray-700 z-50 transform transition-transform duration-300 lg:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900/50"><h1 className="text-xl font-extrabold text-gold-500 tracking-widest uppercase whitespace-nowrap">APLUS EXAMGEN</h1><button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400"><X size={24} /></button></div>
        <div className="p-5 border-b border-gray-700 bg-gray-800 transition-colors">
           <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-500 font-bold border border-gold-500/30">{user.name.charAt(0)}</div><div><p className="text-sm font-bold text-white truncate w-32">{isAdmin ? "Admin Access" : user.name}</p><p className="text-xs text-gold-500">{isAdmin ? "System Admin" : "Teacher"}</p></div></div>
           <div className={`mt-3 flex items-center justify-center gap-2 px-2 py-1.5 rounded text-[10px] font-bold uppercase border ${isLocalMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>{isLocalMode ? <WifiOff size={12} /> : <Wifi size={12} />}{isLocalMode ? "Offline Mode" : "Cloud Connected"}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
           {sidebarItems.map(item => (
             <button key={item.id} onClick={() => handleNavClick(item.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-gray-400 hover:bg-gray-750 hover:text-gold-500 transition-all group"><span className="group-hover:scale-110 transition-transform">{item.icon}</span>{item.label}<ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100" /></button>
           ))}
        </nav>
        <div className="p-4 border-t border-gray-700 bg-gray-900/30 space-y-3">
          <button onClick={toggleTheme} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-900/50 rounded-lg transition-colors border border-gray-700">{isDarkMode ? <Sun size={16} className="text-gold-400" /> : <Moon size={16} className="text-indigo-400" />}{isDarkMode ? "Light Mode" : "Dark Mode"}</button>
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"><LogOut size={16} />Log Out</button>
        </div>
      </aside>

      <main className="flex-grow pt-16 lg:pt-0 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {isLocalMode && (
            <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3"><AlertTriangle className="text-red-500 mt-1" size={24} /><div><h3 className="text-red-400 font-bold">You are using Offline Mode</h3><p className="text-gray-400 text-sm mt-1">Data is saving to browser cache. Log in with cloud credentials to sync.</p></div></div>
          )}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div><h1 className="text-2xl font-bold text-white">{isAdmin ? "Welcome, Master Admin" : `Welcome, ${user.name}`}</h1><p className="text-gray-400 text-sm mt-1">{isAdmin ? "Manage system and directory." : "Select an option to manage exams."}</p></div>
            {isAdmin && (
               <div className="bg-gold-500/10 border border-gold-500/30 px-4 py-2 rounded-lg flex items-center gap-3"><div className="bg-gold-500 p-2 rounded-full text-black"><Users size={16} /></div><div><p className="text-xs text-gold-500 uppercase font-bold">Teachers</p><p className="text-xl font-bold text-white leading-none">{registeredUsers.length}</p></div></div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {gridItems.map((item) => (
               <button key={item.id} onClick={() => onNavigate(item.id as ViewState)} className="group bg-gray-800 border border-gray-700 hover:border-gold-500/50 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all hover:shadow-lg hover:-translate-y-1"><div className="bg-gray-750 p-4 rounded-full mb-4 group-hover:bg-gold-500/10">{item.icon}</div><h2 className="text-base font-bold text-white mb-2">{item.label}</h2><p className="text-xs text-gray-500">{item.desc}</p></button>
            ))}
          </div>
          {isAdmin && (
            <div className="animate-fadeIn"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><School className="text-gold-500" />Teachers Directory</h3>
               <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
                  {registeredUsers.length === 0 ? <div className="p-8 text-center text-gray-500">No teachers registered yet.</div> : (
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm text-gray-400"><thead className="bg-gray-900/50 text-gold-500 uppercase text-xs font-bold border-b border-gray-700"><tr><th className="px-6 py-4">Name / Institute</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Location</th><th className="px-6 py-4">Joined</th></tr></thead><tbody className="divide-y divide-gray-700">
                          {registeredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-750"><td className="px-6 py-4"><div className="font-bold text-white">{u.name}</div><div className="text-xs text-gray-500">{u.instituteProfile?.instituteName || "No Institute"}</div></td><td className="px-6 py-4"><div className="flex items-center gap-2 text-xs mb-1"><Mail size={12} /> {u.email}</div><div className="flex items-center gap-2 text-xs"><Phone size={12} /> {u.mobile}</div></td><td className="px-6 py-4 text-xs">{u.instituteProfile?.city || "Unknown"}</td><td className="px-6 py-4 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td></tr>
                          ))}
                    </tbody></table></div>
                  )}
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};