import React, { useState, useEffect } from 'react';
import { SavedPaper, User } from '../types';
import { getSavedPapers, deletePaper } from '../services/paperService';
import { PrintablePaper } from './PrintablePaper';
import { Button } from './Button';
import { ArrowLeft, Trash2, Eye, Printer, FileText, Calendar, X, Download, User as UserIcon, ChevronDown, FileType, FileDown, Key, Search, AlertCircle } from 'lucide-react';

interface SavedPapersProps {
  onBack: () => void;
  user: User;
}

export const SavedPapers: React.FC<SavedPapersProps> = ({ onBack, user }) => {
  const [papers, setPapers] = useState<SavedPaper[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<SavedPaper | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';

  const fetchPapers = async () => {
    setIsLoading(true);
    const data = await getSavedPapers(user.id, isAdmin);
    setPapers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPapers();
  }, [user.id, isAdmin]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this paper? This cannot be undone.")) {
      try {
        await deletePaper(id);
        setPapers(prev => prev.filter(p => p.id !== id));
        if (selectedPaper?.id === id) {
          setSelectedPaper(null);
        }
      } catch (err) {
        alert("Failed to delete paper. Please try again.");
      }
    }
  };

  const handleDownloadWord = () => {
    if (!selectedPaper) return;
    const questionsHtml = selectedPaper.questions.map((q, i) => `<p><b>${i+1}.</b> ${q.text}</p>`).join('');
    const content = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <h1 style="text-align:center">${selectedPaper.instituteProfile?.instituteName || "Institute"}</h1>
        <h2 style="text-align:center">${selectedPaper.title}</h2>
        <hr/>
        ${questionsHtml}
      </body>
    </html>`;
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `${selectedPaper.title.replace(/\s+/g, '_')}.doc`; 
    a.click(); 
    window.URL.revokeObjectURL(url);
  };

  const filteredPapers = papers.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.classLevel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-gray-800 shadow-sm border-b border-gray-700 sticky top-0 z-10 print:hidden h-16 flex items-center px-6">
          <button onClick={onBack} className="text-gray-400 hover:text-gold-500 flex items-center transition-colors">
            <ArrowLeft size={20} className="mr-1" />
            <span className="font-medium">Dashboard</span>
          </button>
          <div className="flex-grow text-center text-xl font-bold text-white tracking-wider uppercase">Saved Papers</div>
          <div className="w-20"></div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-6xl mx-auto w-full print:hidden">
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <input 
              type="text" 
              placeholder="Search by name, subject or class..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
            />
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
          </div>
          <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">
            {filteredPapers.length} Papers Found
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold uppercase tracking-tighter text-gold-500">Loading Database...</p>
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl border border-dashed border-gray-700 p-20 text-center text-gray-500">
            <FileText size={64} className="mx-auto mb-4 opacity-10" /> 
            <p className="text-lg font-bold">{searchTerm ? "No papers match your search criteria." : "No saved papers available yet."}</p>
            {!searchTerm && <p className="text-sm mt-2">Generate your first paper to see it listed here.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.map((paper) => (
              <div 
                key={paper.id} 
                onClick={() => { setShowAnswerKey(false); setSelectedPaper(paper); }}
                className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden hover:border-gold-500 shadow-xl flex flex-col transition-all hover:-translate-y-1 group cursor-pointer"
              >
                <div className="p-6 flex-grow">
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-white text-lg leading-tight group-hover:text-gold-500 transition-colors">{paper.title}</h3>
                     <span className="text-[9px] bg-gray-900 text-gold-500/70 border border-gold-500/20 px-1.5 py-0.5 rounded font-black uppercase">{paper.classLevel}</span>
                   </div>
                   <div className="text-xs text-gray-500 mt-4 flex items-center gap-2">
                     <Calendar size={14} className="text-gold-500/50" /> 
                     {new Date(paper.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                   </div>
                   {isAdmin && (
                     <div className="mt-3 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-500">
                          <UserIcon size={10} />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase truncate">{paper.createdBy || 'Unknown User'}</span>
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
        )}
      </main>

      {selectedPaper && (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col print:bg-white print:block print:static print:contents">
          <div className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center print:hidden shadow-2xl">
             <div className="flex items-center gap-4">
               <button onClick={() => setSelectedPaper(null)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                 <ArrowLeft size={20} />
               </button>
               <div>
                 <h2 className="text-sm font-bold text-white truncate max-w-xs">{selectedPaper.title}</h2>
                 <p className="text-[10px] text-gold-500 font-black uppercase tracking-tighter">{selectedPaper.subject} • {selectedPaper.classLevel}</p>
               </div>
             </div>
             
             <div className="flex gap-2 items-center">
               <Button 
                 onClick={() => setShowAnswerKey(!showAnswerKey)} 
                 variant={showAnswerKey ? 'primary' : 'secondary'} 
                 className="!w-auto text-[10px] py-2 px-3 flex items-center h-9 font-black"
               >
                 <Key size={14} className="mr-1.5" /> {showAnswerKey ? 'Hide Key' : 'Show Key'}
               </Button>

               <div className="relative group">
                 <Button variant="secondary" className="!w-auto text-[10px] py-2 px-3 flex items-center h-9 font-black">
                   <Download size={14} className="mr-1.5" /> Export <ChevronDown size={12} className="ml-1" />
                 </Button>
                 <div className="absolute right-0 mt-2 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl hidden group-hover:block z-[60] overflow-hidden animate-fadeIn">
                   <button onClick={handleDownloadWord} className="w-full text-left px-4 py-3 text-[10px] text-gray-300 hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors border-b border-gray-700 font-bold uppercase">
                     <FileType size={14} /> Microsoft Word
                   </button>
                   <button onClick={() => window.print()} className="w-full text-left px-4 py-3 text-[10px] text-gray-300 hover:bg-gold-500 hover:text-black flex items-center gap-3 font-bold uppercase transition-colors">
                     <FileDown size={14} /> PDF Document
                   </button>
                 </div>
               </div>

               <Button onClick={() => window.print()} className="!w-auto text-[10px] py-2 px-4 h-9 font-black">
                 <Printer size={16} className="mr-2" /> Print Now
               </Button>
               
               <button 
                 onClick={(e) => handleDelete(e, selectedPaper.id)}
                 className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg ml-2 transition-colors border border-transparent hover:border-red-500/20"
                 title="Delete this paper"
               >
                 <Trash2 size={20} />
               </button>
             </div>
          </div>

          <div className="flex-grow overflow-auto p-4 sm:p-8 bg-gray-950 print:p-0 print:bg-white print:overflow-visible">
            <div className="mx-auto shadow-2xl print:shadow-none bg-white w-full max-w-[210mm] print:max-w-none print:w-full print:m-0" style={{ minHeight: '297mm', color: 'black' }}>
               <PrintablePaper 
                  instituteProfile={selectedPaper.instituteProfile} 
                  classLevel={selectedPaper.classLevel} 
                  subject={selectedPaper.subject} 
                  totalMarks={selectedPaper.totalMarks} 
                  sections={selectedPaper.sections} 
                  questions={selectedPaper.questions} 
                  layoutMode={1} 
                  showAnswerKey={showAnswerKey}
                />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};