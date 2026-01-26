import React, { useState, useEffect } from 'react';
import { User, Chapter, Question, QuestionType, Subtopic } from '../types';
import { CLASSES } from '../constants';
import { getSubjects } from '../services/subjectService';
import { getChapters, getVisibilitySettings, toggleVisibility, VisibilityState, deleteChapterPermanently } from '../services/chapterService';
import { getQuestionsForChapters, updateChapterQuestion, deleteChapterQuestion, getAllClassUploadedContent, deleteSubtopicPermanently } from '../services/questionService';
import { Button } from './Button';
import { Input } from './Input'; 
import { 
  ArrowLeft, Search, Filter, Edit, Trash2, Save, X, 
  CheckCircle, AlertTriangle, Database, BookOpen, Layers,
  ChevronRight, RefreshCw, CheckSquare, Square, Check, Eye, EyeOff, LayoutList, Info
} from 'lucide-react';

interface ManageContentProps {
  user: User;
  onBack: () => void;
}

type Tab = 'QUESTIONS' | 'VISIBILITY';

const isUrduStyleSubject = (subject: string) => {
  const s = subject.toLowerCase();
  return s.includes('urdu') || s.includes('islam') || s.includes('pak study') || s.includes('pak studies') || s.includes('arab') || s.includes('per');
};

// Internal utility to render formatted text in management UI
const renderFormattedText = (text: string) => {
  if (!text) return null;
  const isUrdu = /[\u0600-\u06FF]/.test(text);
  const normalized = text
    .replace(/<\/?b>/gi, '@@')
    .replace(/\*\*([^*]+)\*\*/g, '@@$1@@')
    .replace(/\*([^*]+)\*/g, '@@$1@@')
    .replace(/:([^:]+):/g, '##$1##')
    .replace(/@@/g, '**')
    .replace(/##/g, '++');

  const parts = normalized.split(/(\*\*.*?\*\*|\+\+.*?\+\+)/g);
  return (
    <span className={isUrdu ? 'font-urdu text-right block text-lg' : ''} dir={isUrdu ? 'rtl' : 'ltr'}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-gold-500 font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('++') && part.endsWith('++')) {
          return <u key={i} className="underline decoration-gold-500/40">{part.slice(2, -2)}</u>;
        }
        return part;
      })}
    </span>
  );
};

export const ManageContent: React.FC<ManageContentProps> = ({ user, onBack }) => {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>('QUESTIONS');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({ hiddenChapterIds: [], hiddenSubtopicNames: [] });
  
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editForm, setEditForm] = useState<Partial<Question>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';
  const isUrduPaper = isUrduStyleSubject(selectedSubject);

  // Trigger MathJax rendering when questions or tabs change
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [filteredQuestions, activeTab, editingQuestion]);

  useEffect(() => {
    if (selectedClass) {
      loadSubjectsAndCounts();
    }
  }, [selectedClass]);

  const loadSubjectsAndCounts = async () => {
    setIsLoading(true);
    try {
      const allSubjectsMap = await getSubjects();
      const subjects = allSubjectsMap[selectedClass] || [];
      setAvailableSubjects(subjects);
      
      const classContent = await getAllClassUploadedContent(selectedClass);
      
      const counts: Record<string, number> = {};
      subjects.forEach(subj => {
          const chaptersForSubj = classContent.filter(item => item.subject.toLowerCase().trim() === subj.toLowerCase().trim());
          counts[subj] = chaptersForSubj.length;
      });
      
      setSubjectCounts(counts);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubjectSelect = (subj: string) => {
    setSelectedSubject(subj);
    loadAllQuestions(subj);
    loadChaptersAndVisibility(subj);
    setStep(3);
  };

  const loadChaptersAndVisibility = async (subject: string) => {
    const chs = await getChapters(subject, selectedClass, false);
    const vis = await getVisibilitySettings();
    setChapters(chs);
    setVisibility(vis);
  };

  const loadAllQuestions = async (subject: string) => {
    setIsLoading(true);
    setSearchTerm('');
    setSelectedQuestionIds([]);
    try {
        const chaptersList = await getChapters(subject, selectedClass, false);
        const chapterIds = chaptersList.map(c => c.id);
        const questions = await getQuestionsForChapters(subject, chaptersList, chapterIds, true);
        setAllQuestions(questions);
        setFilteredQuestions(questions);
    } catch (e) {
        alert("Failed to load questions.");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.trim() === '') {
        setFilteredQuestions(allQuestions);
    } else {
        const term = searchTerm.toLowerCase();
        setFilteredQuestions(allQuestions.filter(q => 
            q.text.toLowerCase().includes(term) || 
            (q.subtopic && q.subtopic.toLowerCase().includes(term)) ||
            (q.textUrdu && q.textUrdu.includes(term))
        ));
    }
    setSelectedQuestionIds([]);
  }, [searchTerm, allQuestions]);

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === filteredQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(filteredQuestions.map(q => q.id));
    }
  };

  const toggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleEditClick = (q: Question) => {
    setEditingQuestion(q);
    setEditForm({ ...q });
  };

  const handleDeleteClick = async (q: Question) => {
    if (!window.confirm("Delete this question permanently?")) return;
    setIsLoading(true);
    const success = await deleteChapterQuestion(q.chapterId, q.id);
    setIsLoading(false);
    if (success) {
        setAllQuestions(prev => prev.filter(item => item.id !== q.id));
        setSelectedQuestionIds(prev => prev.filter(item => item !== q.id));
    } else {
        alert("Failed to delete.");
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedQuestionIds.length} selected questions permanently?`)) return;
    
    setIsLoading(true);
    let successCount = 0;
    
    for (const id of selectedQuestionIds) {
      const q = allQuestions.find(item => item.id === id);
      if (q) {
        const success = await deleteChapterQuestion(q.chapterId, q.id);
        if (success) successCount++;
      }
    }
    
    setIsLoading(false);
    if (successCount > 0) {
      setAllQuestions(prev => prev.filter(q => !selectedQuestionIds.includes(q.id)));
      setSelectedQuestionIds([]);
      alert(`Successfully deleted ${successCount} questions.`);
    } else {
      alert("Bulk delete failed.");
    }
  };

  const handleToggleVisibility = async (idOrName: string, type: 'chapter' | 'subtopic', currentHidden: boolean) => {
    await toggleVisibility(idOrName, type, !currentHidden);
    const vis = await getVisibilitySettings();
    setVisibility(vis);
  };

  const handleDeleteChapterPerm = async (ch: Chapter) => {
    if (!window.confirm(`WARNING: PERMANENT ACTION\nAre you sure you want to delete chapter "${ch.name}"? This will wipe ALL questions and topics in this chapter from the database.`)) return;
    
    setIsLoading(true);
    const success = await deleteChapterPermanently(ch.id);
    if (success) {
      alert("Chapter and its content deleted permanently.");
      loadChaptersAndVisibility(selectedSubject);
      loadAllQuestions(selectedSubject);
    } else {
      alert("Delete failed.");
    }
    setIsLoading(false);
  };

  const handleDeleteSubtopicPerm = async (chapterId: string, subtopicName: string) => {
    if (!window.confirm(`WARNING: PERMANENT ACTION\nAre you sure you want to delete the topic "${subtopicName}"? This will delete all questions associated with this topic in this chapter.`)) return;
    
    setIsLoading(true);
    const success = await deleteSubtopicPermanently(chapterId, subtopicName);
    if (success) {
      alert("Topic and its questions deleted permanently.");
      loadChaptersAndVisibility(selectedSubject);
      loadAllQuestions(selectedSubject);
    } else {
      alert("Delete failed.");
    }
    setIsLoading(false);
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion || !editForm.text) return;
    setIsSaving(true);
    
    const updatedQuestion: Question = {
        ...editingQuestion,
        text: editForm.text || '',
        textUrdu: editForm.textUrdu,
        type: (editForm.type as QuestionType) || 'MCQ',
        marks: editForm.marks || 1,
        subtopic: editForm.subtopic,
        options: editForm.options,
        optionsUrdu: editForm.optionsUrdu,
        correctAnswer: editForm.correctAnswer,
        id: editingQuestion.id,
        chapterId: editingQuestion.chapterId
    };

    const success = await updateChapterQuestion(editingQuestion.chapterId, updatedQuestion);
    setIsSaving(false);

    if (success) {
        setAllQuestions(prev => prev.map(q => q.id === editingQuestion.id ? updatedQuestion : q));
        setEditingQuestion(null);
    } else {
        alert("Failed to save.");
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
        case 'MCQ': return 'bg-blue-900/50 text-blue-300 border-blue-500/30';
        case 'SHORT': return 'bg-green-900/50 text-green-300 border-green-500/30';
        case 'LONG': return 'bg-purple-900/50 text-purple-300 border-purple-500/30';
        default: return 'bg-gray-800 text-gray-400 border-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans tex2jax_process">
        <header className="bg-gray-800 shadow-sm border-b border-gray-700 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <button 
                  onClick={() => {
                      if (step === 1) onBack();
                      else if (step === 2) { setSelectedClass(''); setStep(1); }
                      else if (step === 3) { setSelectedSubject(''); setStep(2); setActiveTab('QUESTIONS'); }
                  }} 
                  className="text-gray-400 hover:text-gold-500 flex items-center transition-colors"
                >
                    <ArrowLeft size={20} className="mr-1" /><span className="font-medium">{step === 1 ? 'Dashboard' : 'Back'}</span>
                </button>
                <div className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                    <Database className="text-gold-500" /> QUESTION BANK
                </div>
                <div className="w-20"></div>
            </div>
        </header>

        <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full pb-24">
            {step === 1 && (
                <div className="animate-fadeIn">
                    <h2 className="text-2xl font-bold text-theme-text-main text-center mb-8">Select Class</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {CLASSES.map(cls => (
                            <div key={cls} onClick={() => { setSelectedClass(cls); setStep(2); }} className="bg-gray-800 border border-gray-700 hover:border-gold-500 rounded-xl p-6 flex flex-col items-center gap-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
                                <div className="text-gold-500"><BookOpen size={40} /></div>
                                <span className="font-bold text-theme-text-main text-lg">{cls}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="animate-fadeIn">
                    <h2 className="text-2xl font-bold text-theme-text-main text-center mb-2">Select Subject</h2>
                    <p className="text-center text-gold-500 mb-8 font-semibold">{selectedClass}</p>
                    {isLoading ? (
                        <div className="text-center py-12"><RefreshCw className="animate-spin mx-auto text-gold-500" size={32} /></div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {availableSubjects.map(subj => {
                                const count = subjectCounts[subj] || 0;
                                return (
                                    <div key={subj} onClick={() => handleSubjectSelect(subj)} className={`bg-gray-800 border rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all hover:-translate-y-1 ${count > 0 ? 'border-gold-500/50 hover:border-gold-500 shadow-md' : 'border-gray-700 hover:border-gray-500 opacity-80'}`}>
                                        <div className={count > 0 ? "text-gold-500" : "text-gray-500"}><Layers size={32} /></div>
                                        <span className="font-bold text-theme-text-main text-center">{subj}</span>
                                        <span className={`text-xs px-2 py-1 rounded font-bold ${count > 0 ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-gray-900 text-gray-500 border border-gray-700'}`}>{count > 0 ? `${count} Chapters` : 'Empty'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {step === 3 && (
                <div className="animate-fadeIn h-full flex flex-col">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-theme-text-main flex items-center gap-2">
                                <span className="text-gold-500">{selectedSubject}</span>
                                <span className="text-gray-500 text-lg">/</span>
                                <span className="text-gray-500">{selectedClass}</span>
                            </h2>
                            <p className="text-sm text-theme-text-muted mt-1">{filteredQuestions.length} Questions found</p>
                        </div>
                        {activeTab === 'QUESTIONS' && (
                          <div className="relative w-full md:w-96">
                              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-theme-text-main pl-10 pr-4 py-2 rounded-lg focus:border-gold-500 focus:outline-none" />
                              <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                          </div>
                        )}
                    </div>

                    {isAdmin && (
                      <div className="flex bg-gray-800 p-1 rounded-xl mb-6 w-full max-w-md mx-auto border border-gray-700 shadow-inner">
                        <button 
                          onClick={() => setActiveTab('QUESTIONS')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'QUESTIONS' ? 'bg-gold-500 text-black shadow-lg scale-105' : 'text-theme-text-muted hover:text-theme-text-main'}`}
                        >
                          <Database size={14} /> Questions
                        </button>
                        <button 
                          onClick={() => setActiveTab('VISIBILITY')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'VISIBILITY' ? 'bg-gold-500 text-black shadow-lg scale-105' : 'text-theme-text-muted hover:text-theme-text-main'}`}
                        >
                          <Eye size={14} /> Visibility & Deletion
                        </button>
                      </div>
                    )}

                    {isLoading ? (
                        <div className="flex-grow flex items-center justify-center p-12"><RefreshCw className="animate-spin text-gold-500" size={40} /></div>
                    ) : (
                      <div className="space-y-4">
                        {activeTab === 'QUESTIONS' ? (
                          <>
                            {filteredQuestions.length > 0 && (
                              <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg sticky top-16 z-30 backdrop-blur-md">
                                <button 
                                  onClick={toggleSelectAll}
                                  className="flex items-center gap-2 text-sm text-theme-text-muted hover:text-gold-500 transition-colors"
                                >
                                  {selectedQuestionIds.length === filteredQuestions.length && filteredQuestions.length > 0 
                                    ? <CheckSquare className="text-gold-500" size={20} /> 
                                    : <Square className="text-gray-600" size={20} />
                                  }
                                  <span className="font-bold uppercase tracking-widest text-[10px]">Select All {filteredQuestions.length}</span>
                                </button>
                                {selectedQuestionIds.length > 0 && (
                                  <div className="ml-auto flex items-center gap-3">
                                    <span className="text-[10px] text-gold-500 font-black uppercase tracking-widest">{selectedQuestionIds.length} Selected</span>
                                    <button 
                                      onClick={handleBulkDelete}
                                      className="flex items-center gap-1.5 px-3 py-1 bg-red-900/30 text-red-400 border border-red-500/30 rounded text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all uppercase"
                                    >
                                      <Trash2 size={12} /> Delete Selected
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                {filteredQuestions.map(q => {
                                  const isSelected = selectedQuestionIds.includes(q.id);
                                  return (
                                    <div 
                                      key={q.id} 
                                      className={`bg-gray-800 border transition-all rounded-lg p-4 flex gap-4 ${isSelected ? 'border-gold-500 bg-gold-500/10' : 'border-gray-700'}`}
                                    >
                                        <div className="flex items-start pt-1">
                                          <button 
                                            onClick={() => toggleSelectQuestion(q.id)}
                                            className="text-gray-400 hover:text-gold-500 transition-colors"
                                          >
                                            {isSelected ? <CheckSquare className="text-gold-500" size={22} /> : <Square className="text-gray-700" size={22} />}
                                          </button>
                                        </div>
                                        <div className="flex-grow cursor-pointer" onClick={() => toggleSelectQuestion(q.id)}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getTypeColor(q.type)}`}>{q.type}</span>
                                                  {q.subtopic && <span className={`text-[10px] text-theme-text-muted bg-gray-900 px-2 py-0.5 rounded border border-gray-700 ${isUrduPaper ? 'font-urdu' : ''}`}>{q.subtopic}</span>}
                                                </div>
                                                <span className="text-[10px] font-black text-theme-text-sub">Marks: {q.marks}</span>
                                            </div>
                                            
                                            <p className="text-theme-text-main font-medium text-[12px] leading-relaxed whitespace-pre-wrap">{renderFormattedText(q.text)}</p>
                                            {q.textUrdu && <p className="text-[12px] text-right text-theme-text-muted mt-3 font-urdu leading-loose whitespace-pre-wrap" dir="rtl">{renderFormattedText(q.textUrdu)}</p>}

                                            {q.type === 'MCQ' && (
                                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                 {q.options && (
                                                   <div className="space-y-1.5">
                                                      {q.options.map((opt, oIdx) => (
                                                        <div key={oIdx} className={`px-2 py-1 rounded text-[12px] flex items-center gap-2 ${q.correctAnswer === String.fromCharCode(65 + oIdx) ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20' : 'bg-gray-900 text-theme-text-muted border-gray-700/50'}`}>
                                                           <span className="font-black opacity-50">{String.fromCharCode(65 + oIdx)}.</span> {renderFormattedText(opt)}
                                                        </div>
                                                      ))}
                                                   </div>
                                                 )}
                                                 {q.optionsUrdu && (
                                                   <div className="space-y-1">
                                                      {q.optionsUrdu.map((opt, oIdx) => (
                                                        <div key={oIdx} className={`px-2 py-0.5 rounded text-[12px] text-right font-urdu flex items-center justify-end gap-2 ${q.correctAnswer === String.fromCharCode(65 + oIdx) ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20' : 'bg-gray-900 text-theme-text-muted opacity-60 border border-gray-700/50'}`} dir="rtl">
                                                           <span className="font-black opacity-30 text-xs">({String.fromCharCode(97 + oIdx)})</span> {renderFormattedText(opt)}
                                                        </div>
                                                      ))}
                                                   </div>
                                                 )}
                                              </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2 border-l border-gray-700 pl-4 justify-center">
                                            <button onClick={(e) => { e.stopPropagation(); handleEditClick(q); }} className="p-2 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-500 hover:text-white transition-all shadow-sm"><Edit size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(q); }} className="p-2 bg-red-900/20 text-red-400 rounded hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                  );
                                })}
                            </div>

                            {filteredQuestions.length === 0 && !isLoading && (
                              <div className="text-center py-24 opacity-20">
                                <Database size={64} className="mx-auto mb-4" />
                                <p className="text-xl font-bold uppercase tracking-widest">No Questions Found</p>
                              </div>
                            )}
                          </>
                        ) : (
                          /* VISIBILITY & PERMANENT DELETION TAB */
                          <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
                             <div className="bg-red-900/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-4 text-sm mb-6 shadow-lg">
                                <AlertTriangle className="text-red-500 shrink-0" size={28} />
                                <div className="space-y-1">
                                  <p className="text-theme-text-main font-bold uppercase tracking-tighter">Admin Control: Visibility & Deletion</p>
                                  <p className="text-theme-text-muted text-xs">
                                    <strong>Visibility:</strong> Eye icons toggle item presence on the generation screen.<br/>
                                    <strong>Permanent Delete:</strong> Trash icons WIPE items and their associated questions from the database forever.
                                  </p>
                                </div>
                             </div>

                             <div className="space-y-4">
                               {chapters.map(ch => {
                                 const isHidden = visibility.hiddenChapterIds.includes(ch.id);
                                 return (
                                   <div key={ch.id} className={`bg-gray-800 border rounded-2xl overflow-hidden transition-all shadow-xl ${isHidden ? 'border-red-500/50 opacity-90' : 'border-gray-700 hover:border-gold-500/50'}`}>
                                      <div className={`p-5 flex items-center justify-between transition-colors ${isHidden ? 'bg-red-900/20' : 'bg-gray-750/50'}`}>
                                        <div className="flex items-center gap-4">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border transition-colors ${isHidden ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-gold-500/10 border-gold-500 text-gold-500'}`}>
                                            {ch.name.match(/\d+/) || 'CH'}
                                          </div>
                                          <div>
                                            <h3 className={`font-bold transition-colors ${isHidden ? 'text-red-400' : 'text-theme-text-main'} ${isUrduPaper ? 'font-urdu text-lg' : ''}`}>{ch.name}</h3>
                                            <span className="text-[10px] text-theme-text-sub uppercase font-black tracking-widest">{ch.subtopics.length} Topics total</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button 
                                            onClick={() => handleToggleVisibility(ch.id, 'chapter', isHidden)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all border ${isHidden ? 'bg-red-500 text-white border-red-400' : 'bg-gray-900 text-theme-text-muted hover:text-theme-text-main border-gray-700'}`}
                                            title={isHidden ? "Click to show chapter" : "Click to hide chapter"}
                                          >
                                            {isHidden ? <><EyeOff size={14} /> Hidden</> : <><Eye size={14} /> Visible</>}
                                          </button>
                                          
                                          {/* PERMANENT DELETE CHAPTER */}
                                          <button 
                                            onClick={() => handleDeleteChapterPerm(ch)}
                                            className="p-2 bg-red-900/30 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/30"
                                            title="Permanently Delete Chapter & Content"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <div className="p-4 grid grid-cols-1 gap-2 bg-gray-900/30">
                                        {ch.subtopics.map(st => {
                                          const stHidden = visibility.hiddenSubtopicNames.includes(st.name);
                                          return (
                                            <div key={st.id} className="flex items-center justify-between group/st py-2 px-4 rounded-xl hover:bg-gray-800/50 transition-all border border-transparent hover:border-gray-700">
                                              <span className={`text-[12px] font-medium transition-colors ${stHidden || isHidden ? 'text-gray-500' : 'text-theme-text-main'} ${isUrduPaper ? 'font-urdu text-base' : ''}`}>
                                                {st.name} {stHidden && <span className="text-[8px] text-red-500 font-black uppercase ml-2">(Hidden)</span>}
                                              </span>
                                              <div className="flex items-center gap-2 opacity-0 group-hover/st:opacity-100 transition-opacity">
                                                <button 
                                                  onClick={() => handleToggleVisibility(st.name, 'subtopic', stHidden)}
                                                  disabled={isHidden}
                                                  className={`p-1.5 rounded transition-all ${stHidden ? 'text-red-500 bg-red-900/20' : 'text-gray-400 hover:text-gold-500 hover:bg-gold-500/10'}`}
                                                  title={isHidden ? "Chapter must be visible" : stHidden ? "Click to Show" : "Click to Hide"}
                                                >
                                                  {stHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                                
                                                {/* PERMANENT DELETE TOPIC */}
                                                <button 
                                                  onClick={() => handleDeleteSubtopicPerm(ch.id, st.name)}
                                                  className="p-1.5 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                                                  title="Permanently Delete Topic & its Questions"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {ch.subtopics.length === 0 && (
                                          <p className="text-center text-[10px] text-gray-700 uppercase py-4 font-black tracking-widest">No individual topics found in database</p>
                                        )}
                                      </div>
                                   </div>
                                 );
                               })}
                             </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
            )}

            {editingQuestion && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-gray-800 rounded-xl shadow-2xl border border-gold-500 max-w-4xl w-full p-6 animate-scaleIn max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                            <h3 className="text-xl font-bold text-theme-text-main">Edit Question</h3>
                            <button onClick={() => setEditingQuestion(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-gold-500 font-bold">Type</label>
                                    <select value={editForm.type} onChange={(e) => setEditForm({...editForm, type: e.target.value as QuestionType})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-theme-text-main text-sm focus:border-gold-500 outline-none">
                                        {['MCQ', 'SHORT', 'LONG', 'NUMERICAL', 'ESSAY', 'TRANSLATION'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <Input label="Subtopic" value={editForm.subtopic || ''} onChange={e => setEditForm({...editForm, subtopic: e.target.value})} className={isUrduStyleSubject(selectedSubject) ? 'font-urdu' : ''} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-gold-500 font-bold">English Text</label>
                                    <textarea rows={3} value={editForm.text} onChange={e => setEditForm({...editForm, text: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-theme-text-main text-[12px] focus:border-gold-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gold-500 font-bold">Urdu Text (Nastaliq)</label>
                                    <textarea rows={3} dir="rtl" value={editForm.textUrdu || ''} onChange={e => setEditForm({...editForm, textUrdu: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-theme-text-main text-[12px] focus:border-gold-500 outline-none font-urdu" />
                                </div>
                            </div>

                            {editForm.type === 'MCQ' && (
                                <div className="bg-gray-900/50 p-4 rounded border border-gray-700">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs text-gold-500 font-bold block mb-2 underline">Options (English)</label>
                                            <div className="space-y-2">
                                                {[0,1,2,3].map(i => (
                                                    <input key={i} value={editForm.options?.[i] || ''} onChange={e => {
                                                        const newOpts = [...(editForm.options || ['', '', '', ''])];
                                                        newOpts[i] = e.target.value;
                                                        setEditForm({...editForm, options: newOpts});
                                                    }} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-[12px] text-theme-text-main" placeholder={`Option ${String.fromCharCode(65+i)}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gold-500 font-bold block mb-2 underline">Options (Urdu)</label>
                                            <div className="space-y-2">
                                                {[0,1,2,3].map(i => (
                                                    <input key={i} dir="rtl" value={editForm.optionsUrdu?.[i] || ''} onChange={e => {
                                                        const newOpts = [...(editForm.optionsUrdu || ['', '', '', ''])];
                                                        newOpts[i] = e.target.value;
                                                        setEditForm({...editForm, optionsUrdu: newOpts});
                                                    }} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-[12px] text-theme-text-main font-urdu" placeholder={`آپشن ${String.fromCharCode(65+i)}`} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4"><Input label="Correct Answer (A/B/C/D)" value={editForm.correctAnswer || ''} onChange={e => setEditForm({...editForm, correctAnswer: e.target.value.toUpperCase()})} /></div>
                                </div>
                            )}

                            <Input label="Marks" type="number" value={editForm.marks} onChange={e => setEditForm({...editForm, marks: parseInt(e.target.value) || 1})} />
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                            <Button variant="secondary" onClick={() => setEditingQuestion(null)} className="!w-auto">Cancel</Button>
                            <Button onClick={handleSaveEdit} isLoading={isSaving} className="!w-auto"><Save size={18} className="mr-2" /> Save Changes</Button>
                        </div>
                    </div>
                </div>
            )}
        </main>

        {selectedQuestionIds.length > 0 && step === 3 && activeTab === 'QUESTIONS' && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fadeIn bg-gray-800 border-2 border-gold-500 px-6 py-4 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center gap-8 backdrop-blur-md">
            <div className="flex items-center gap-3 border-r border-gray-700 pr-8">
              <div className="bg-gold-500 text-black w-8 h-8 rounded-full flex items-center justify-center font-black shadow-lg">
                {selectedQuestionIds.length}
              </div>
              <span className="text-theme-text-main font-bold uppercase tracking-widest text-xs">Items Selected</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 font-bold uppercase tracking-widest text-[10px] transition-colors"
              >
                <Trash2 size={16} /> Delete Permanently
              </button>
              <button 
                onClick={() => setSelectedQuestionIds([])}
                className="flex items-center gap-2 text-theme-text-muted font-bold uppercase tracking-widest text-[10px] transition-colors"
              >
                <X size={16} /> Clear Selection
              </button>
            </div>
          </div>
        )}
    </div>
  );
};