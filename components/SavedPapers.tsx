import React, { useState, useEffect } from 'react';
import { SavedPaper, User } from '../types';
import { getSavedPapers, deletePaper, subscribeToSavedPapers } from '../services/paperService';
import { Button } from './Button';
import { ArrowLeft, Trash2, Eye, FileText, Calendar, Search, User as UserIcon, RefreshCw, Info, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface SavedPapersProps {
  onBack: () => void;
  user: User;
  onOpenPaper: (paper: SavedPaper) => void;
}

export const SavedPapers: React.FC<SavedPapersProps> = ({ onBack, user, onOpenPaper }) => {
  const [papers, setPapers] = useState<SavedPaper[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(60);
  
  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';

  const fetchPapers = async (force: boolean = true) => {
    setIsLoading(true);
    const data = await getSavedPapers(user.id, isAdmin, force);
    setPapers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);

    // 1. Parallel getSavedPapers for instant response on mobile or new device
    getSavedPapers(user.id, isAdmin, false).then((data) => {
      if (data && data.length > 0) {
        setPapers(data);
        setIsLoading(false);
      }
    }).catch(() => {});

    // 2. Real-time live Firestore subscription
    const unsubscribe = subscribeToSavedPapers(user.id, isAdmin, (livePapers, isFromCloud) => {
      setPapers(livePapers);
      if (livePapers.length > 0 || isFromCloud) {
        setIsLoading(false);
      }
    });

    // 3. Safety timeout: on empty accounts or slow 3G/4G, never hang
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [user.id, isAdmin]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this paper? This cannot be undone.")) {
      // Optimistic instant removal from UI
      setPapers(prev => prev.filter(p => p.id !== id));
      try {
        await deletePaper(id);
      } catch (err) {
        alert("Failed to delete paper. Please try again.");
      }
    }
  };

  const filteredPapers = papers.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.classLevel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setDisplayLimit(20);
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-gray-800 shadow-sm border-b border-gray-700 sticky top-0 z-10 print:hidden h-16 flex items-center justify-between px-6">
          <button onClick={onBack} className="text-theme-text-muted hover:text-gold-500 flex items-center transition-colors">
            <ArrowLeft size={20} className="mr-1" />
            <span className="font-medium">Dashboard</span>
          </button>
          <div className="text-center">
            <div className="text-xl font-bold text-theme-text-main tracking-wider uppercase">Saved Papers</div>
            <div className="text-[10px] text-gold-400 font-bold tracking-wide">
              {isAdmin ? "Admin View • All System Papers" : `Personal View • ${user.name}'s Papers`}
            </div>
          </div>
          <button 
            onClick={() => fetchPapers(true)} 
            disabled={isLoading}
            title="Refresh Papers"
            className="text-theme-text-muted hover:text-gold-500 p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin text-gold-500" : ""} />
            <span className="hidden sm:inline">Sync DB</span>
          </button>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-6xl mx-auto w-full print:hidden">
        {/* Account Scope Clarification Banner */}
        <div className="mb-6 p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-gray-800/80 border-gray-700">
          <div className="flex items-center gap-2.5">
            {isAdmin ? (
              <ShieldCheck size={18} className="text-gold-400 flex-shrink-0" />
            ) : (
              <UserIcon size={18} className="text-emerald-400 flex-shrink-0" />
            )}
            <div className="text-theme-text-muted">
              {isAdmin ? (
                <span><strong className="text-gold-400">Master Admin View:</strong> Showing all papers across all registered schools & teachers.</span>
              ) : (
                <span><strong className="text-emerald-400">Personal View ({user.name}):</strong> Showing your saved papers ({papers.length}). Master Admin accounts view all system papers.</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto text-[11px] text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Cloud DB Connected</span>
          </div>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <input 
              type="text" 
              placeholder="Search by name, subject or class..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-theme-text-main pl-10 pr-4 py-2.5 rounded-xl focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all placeholder:text-gray-500"
            />
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
          </div>
          <div className="text-xs text-theme-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
            <span>{filteredPapers.length} Papers Found</span>
            {filteredPapers.length > displayLimit && (
              <span className="text-[10px] text-gold-400 font-normal">(Displaying first {displayLimit})</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="font-bold uppercase tracking-wider text-gold-500 text-sm">Syncing with Cloud Database...</p>
              <p className="text-xs text-gray-400 mt-1">Connecting to live papers for {isAdmin ? "all schools" : user.name}</p>
            </div>
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl border border-dashed border-gray-700 p-20 text-center text-theme-text-muted">
            <FileText size={64} className="mx-auto mb-4 opacity-10" /> 
            <p className="text-lg font-bold">{searchTerm ? "No papers match your search criteria." : "No saved papers available yet."}</p>
            {!searchTerm && (
              <p className="text-sm mt-2 text-gray-400">Generate your first paper to see it listed here.</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.slice(0, displayLimit).map((paper) => (
              <div 
                key={paper.id} 
                onClick={() => onOpenPaper(paper)}
                className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden hover:border-gold-500 shadow-xl flex flex-col transition-all hover:-translate-y-1 group cursor-pointer"
              >
                <div className="p-6 flex-grow">
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-theme-text-main text-lg leading-tight group-hover:text-gold-500 transition-colors">{paper.title}</h3>
                     <span className="text-[9px] bg-gray-950 text-gold-500 border border-gold-500/20 px-1.5 py-0.5 rounded font-black uppercase">{paper.classLevel}</span>
                   </div>
                   <div className="text-xs text-theme-text-muted mt-4 flex items-center gap-2">
                     <Calendar size={14} className="text-gold-500/50" /> 
                     {new Date(paper.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                   </div>
                   {isAdmin && (
                     <div className="mt-3 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-500">
                          <UserIcon size={10} />
                        </div>
                        <span className="text-[10px] text-theme-text-sub font-bold uppercase truncate">{paper.createdBy || 'Unknown User'}</span>
                     </div>
                   )}
                </div>
                <div className="bg-gray-900/50 p-4 flex gap-3 border-t border-gray-700">
                  <Button variant="secondary" className="text-[10px] py-2 flex-grow font-black uppercase tracking-widest">
                    <Eye size={14} className="mr-2" /> Open Paper
                  </Button>
                  <button 
                    onClick={(e) => handleDelete(e, paper.id)} 
                    className="bg-red-900/10 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                    title="Delete Paper"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {filteredPapers.length > displayLimit && (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => setDisplayLimit(prev => prev + 60)}
                className="px-6 py-2.5 bg-gray-800 text-gold-500 font-bold rounded-xl hover:bg-gray-700 hover:text-gold-400 border border-gold-500/30 transition-colors uppercase tracking-widest text-xs shadow-lg shadow-black/20"
              >
                Load More (+60)
              </button>
              <button 
                onClick={() => setDisplayLimit(filteredPapers.length)}
                className="px-6 py-2.5 bg-gold-500 text-gray-950 font-black rounded-xl hover:bg-gold-400 transition-colors uppercase tracking-widest text-xs shadow-lg shadow-black/20"
              >
                Show All ({filteredPapers.length} Papers)
              </button>
            </div>
          )}
        </>
      )}
      </main>
    </div>
  );
};