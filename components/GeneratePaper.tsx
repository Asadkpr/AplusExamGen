import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input'; 
import { CLASSES } from '../constants';
import { getSubjects } from '../services/subjectService';
import { getChapters } from '../services/chapterService';
import { getPatterns } from '../services/patternService';
import { getQuestionsForChapters } from '../services/questionService';
import { Chapter, QuestionType, Question, PaperPatternSection, User, PaperPattern, Subtopic, SavedPaper } from '../types';
import { savePaper, updatePaper } from '../services/paperService';
import { PrintablePaper } from './PrintablePaper';
import { 
  ArrowLeft, CheckSquare, Square, ChevronRight, ChevronDown, CheckCircle, 
  Printer, RefreshCw, AlertCircle, Save, GraduationCap, 
  FileText, Check, Plus, Trash2, Download, Wand2, Fingerprint,
  Eraser, FileType, FileDown, Key, Database, Home, Type as TypeIcon, Layout,
  Shuffle, Repeat, MoreVertical, X, AlignJustify, Settings
} from 'lucide-react';


interface GeneratePaperProps {
  user: User;
  onBack: () => void;
  initialPattern?: PaperPattern; 
  initialPaper?: SavedPaper;
}

const STEPS_INFO = [
  { num: 1, label: "Class" },
  { num: 2, label: "Subject" },
  { num: 3, label: "Pattern" },
  { num: 4, label: "Chapters" },
  { num: 5, label: "Questions" },
  { num: 6, label: "Medium" },
  { num: 7, label: "Preview" },
];

const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text || '');

const isUrduStyleSubject = (subject: string) => {
  const s = subject.toLowerCase();
  return s.includes('urdu') || s.includes('islam') || s.includes('pak study') || s.includes('pak studies') || s.includes('arab') || s.includes('per');
};

const getSectionTagStyles = (type: string) => {
  const upper = type.toUpperCase();
  if (isUrdu(type)) return 'bg-gold-500/10 text-gold-400 border-gold-500/30 ring-gold-500/5';
  if (upper.includes('MCQ')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30 ring-blue-500/5';
  if (upper.includes('SHORT')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-emerald-500/5';
  if (upper.includes('LONG')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30 ring-purple-500/5';
  if (upper.includes('NUMERICAL')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30 ring-orange-500/5';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/30 ring-gray-500/5';
};

export const GeneratePaper: React.FC<GeneratePaperProps> = ({ user, onBack, initialPattern, initialPaper }) => {
  const [step, setStep] = useState(1);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  
  const [availablePatterns, setAvailablePatterns] = useState<PaperPattern[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string>('');
  const [originalSections, setOriginalSections] = useState<PaperPatternSection[]>([]);
  const [effectiveSections, setEffectiveSections] = useState<PaperPatternSection[]>([]);
  const [paperTime, setPaperTime] = useState<string>('2:00 Hours');
  const [paperCode, setPaperCode] = useState<string>('');
  
  const [autoSelectQuestions, setAutoSelectQuestions] = useState(true);
  const [selectedMedium, setSelectedMedium] = useState<'English' | 'Urdu' | 'Both'>('English');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  // Default font size set to 13
  const [fontSize, setFontSize] = useState(13);
  const [lineSpacing, setLineSpacing] = useState(2); // 0-10 scale, default to 2
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  
  // Isolated selection state: Record<SectionID, QuestionID[]>
  const [sectionSelections, setSectionSelections] = useState<Record<string, string[]>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [isSmartSkipping, setIsSmartSkipping] = useState(false);

  // State for swapping a specific part
  const [swappingSlot, setSwappingSlot] = useState<{ 
    sectionId: string; 
    questionIndex: number; 
    partIndex: number;
    partType?: string;
  } | null>(null);

  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';
  const isUrduPaper = isUrduStyleSubject(selectedSubject);

  // --- INITIALIZATION LOGIC ---
  useEffect(() => {
    if (initialPaper) {
      setSelectedClass(initialPaper.classLevel);
      setSelectedSubject(initialPaper.subject);
      setSelectedChapters(initialPaper.selectedChapterIds || []);
      setSelectedSubtopics(initialPaper.selectedSubtopicIds || []);
      setEffectiveSections(initialPaper.sections);
      setOriginalSections(initialPaper.sections); // Use stored sections as base
      setSelectedMedium(initialPaper.medium || 'English');
      // Use stored font size or default to 13 (clamped at 13)
      setFontSize(Math.min(initialPaper.fontSize || 13, 13));
      setLineSpacing(initialPaper.lineSpacing ?? 2);
      setPaperTime(initialPaper.timeAllowed || '2:00 Hours');
      setPaperCode(initialPaper.paperCode || '');
      
      // Map questions to sectionSelections
      const selections: Record<string, string[]> = {};
      initialPaper.questions.forEach(q => {
        if (q.targetSectionId) {
          if (!selections[q.targetSectionId]) selections[q.targetSectionId] = [];
          selections[q.targetSectionId].push(q.id);
        }
      });
      setSectionSelections(selections);
      setStep(7);
      
      // Trigger a background load of chapters and question pool in case user goes back
      const loadBgData = async () => {
         const chs = await getChapters(initialPaper.subject, initialPaper.classLevel, !isAdmin);
         setAvailableChapters(chs);
         const pool = await getQuestionsForChapters(initialPaper.subject, chs, initialPaper.selectedChapterIds || [], false);
         setQuestionPool(pool);
         if (initialPaper.sections.length > 0) setActiveTabId(initialPaper.sections[0].id);
      };
      loadBgData();
    } else if (initialPattern) {
      setSelectedClass(initialPattern.classLevel || '');
      setSelectedSubject(initialPattern.subject || '');
      setOriginalSections(initialPattern.sections);
      setEffectiveSections(initialPattern.sections);
      setSelectedPatternId(initialPattern.id);
      setPaperTime(initialPattern.timeAllowed || '2:00 Hours');
      setIsSmartSkipping(true);
      setStep(4);
    } else {
      setStep(1);
    }
  }, [initialPaper, initialPattern]);

  // MathJax Trigger Effect
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [questionPool, activeTabId, step, sectionSelections, swappingSlot]);

  useEffect(() => {
    if (selectedClass) loadSubjects();
  }, [selectedClass]);

  const loadSubjects = async () => {
    if (!selectedClass) return;
    const allSubjectsMap = await getSubjects();
    setAvailableSubjects(allSubjectsMap[selectedClass] || []);
  };

  useEffect(() => {
    if (selectedSubject && selectedClass) {
      const loadAsyncData = async () => {
        setIsLoadingPatterns(true);
        const [chapters, allPatterns] = await Promise.all([
          getChapters(selectedSubject, selectedClass, !isAdmin),
          getPatterns()
        ]);
        
        setAvailableChapters(chapters);
        const filtered = allPatterns.filter(p => !p.subject || p.subject.toLowerCase() === selectedSubject.toLowerCase());
        setAvailablePatterns(filtered);
        setIsLoadingPatterns(false);

        if (isSmartSkipping) {
          setStep(4);
          setIsSmartSkipping(false);
        }
      }
      loadAsyncData();
    }
  }, [selectedSubject, selectedClass, isAdmin]);

  const handleClassSelect = (cls: string) => {
    if (cls !== selectedClass) {
      setSelectedClass(cls);
      setSelectedSubject('');
      setSelectedChapters([]);
      setSelectedSubtopics([]);
      setSelectedPatternId('');
      setSectionSelections({});
      setQuestionPool([]);
      setAvailableChapters([]);
      setAvailablePatterns([]);
    }
    setStep(2);
  };

  const handleSubjectSelect = (subj: string) => {
    if (subj !== selectedSubject) {
      setSelectedSubject(subj);
      setSelectedChapters([]);
      setSelectedSubtopics([]);
      setSelectedPatternId('');
      setSectionSelections({});
      setQuestionPool([]);
      setAvailableChapters([]);
      setAvailablePatterns([]);
    }
    setStep(3);
  };

  const getSelectedQuestions = (): Question[] => {
    const finalQuestions: Question[] = [];
    (Object.entries(sectionSelections) as [string, string[]][]).forEach(([sectionId, qIds]) => {
      qIds.forEach(id => {
        const found = questionPool.find(q => q.id === id);
        if (found) {
          finalQuestions.push({ ...found, targetSectionId: sectionId });
        }
      });
    });
    return finalQuestions;
  };

  const getChaptersDisplay = () => {
    return availableChapters
      .filter(ch => selectedChapters.includes(ch.id))
      .map(ch => {
        const match = ch.name.match(/\d+/);
        return match ? match[0] : ch.name;
      })
      .sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      })
      .join(', ');
  };

  const triggerAutoSelect = () => {
    const sectionsToUse = originalSections.length > 0 ? originalSections : effectiveSections;
    const newSelections: Record<string, string[]> = {};
    
    sectionsToUse.forEach(section => {
      const selectionForThisSection: string[] = [];
      
      for (let qIdx = 0; qIdx < section.questionCount; qIdx++) {
        if (section.subParts && section.subParts.length > 0) {
          section.subParts.forEach(part => {
            const targetType = part.type || section.type;
            const available = questionPool.filter(q => q.type === targetType && !selectionForThisSection.includes(q.id));
            const random = available[Math.floor(Math.random() * available.length)];
            if (random) selectionForThisSection.push(random.id);
          });
        } else {
          const available = questionPool.filter(q => q.type === section.type && !selectionForThisSection.includes(q.id));
          const random = available[Math.floor(Math.random() * available.length)];
          if (random) selectionForThisSection.push(random.id);
        }
      }
      
      newSelections[section.id] = selectionForThisSection;
    });
    
    setSectionSelections(newSelections);
  };

  const clearCurrentTab = () => {
    if (!activeTabId) return;
    setSectionSelections(prev => ({
      ...prev,
      [activeTabId]: []
    }));
  };

  const initializeQuestionSelection = async (forceBypassCache: boolean = false) => {
    setIsLoadingQuestions(true);
    let pool = await getQuestionsForChapters(selectedSubject, availableChapters, selectedChapters, forceBypassCache);
    if (selectedSubtopics.length > 0) {
      pool = pool.filter(q => q.subtopic && selectedSubtopics.includes(q.subtopic));
    }
    setQuestionPool(pool);
    
    const sectionsToUse = originalSections.length > 0 ? originalSections : effectiveSections;
    if (sectionsToUse.length > 0) {
      setActiveTabId(sectionsToUse[0].id);
      
      if (autoSelectQuestions && Object.keys(sectionSelections).length === 0) {
        const newSelections: Record<string, string[]> = {};
        sectionsToUse.forEach(section => {
          const selectionForThisSection: string[] = [];
          
          for (let qIdx = 0; qIdx < section.questionCount; qIdx++) {
            if (section.subParts && section.subParts.length > 0) {
              section.subParts.forEach(part => {
                const targetType = part.type || section.type;
                const available = pool.filter(q => q.type === targetType && !selectionForThisSection.includes(q.id));
                const random = available[Math.floor(Math.random() * available.length)];
                if (random) selectionForThisSection.push(random.id);
              });
            } else {
              const available = pool.filter(q => q.type === section.type && !selectionForThisSection.includes(q.id));
              const random = available[Math.floor(Math.random() * available.length)];
              if (random) selectionForThisSection.push(random.id);
            }
          }
          newSelections[section.id] = selectionForThisSection;
        });
        setSectionSelections(newSelections);
      } else if (Object.keys(sectionSelections).length === 0) {
        const initialSelections: Record<string, string[]> = {};
        sectionsToUse.forEach(s => initialSelections[s.id] = []);
        setSectionSelections(initialSelections);
      }
    }
    setIsLoadingQuestions(false);
  };

  const totalSelectedCount = (Object.values(sectionSelections) as string[][]).reduce((acc, curr) => acc + curr.length, 0);

  const handleNext = async () => {
    if (step === 1 && selectedClass) setStep(2);
    else if (step === 2 && selectedSubject) setStep(3);
    else if (step === 3 && selectedPatternId) setStep(4);
    else if (step === 4 && selectedChapters.length > 0) { 
        await initializeQuestionSelection(false); 
        setStep(5); 
    }
    else if (step === 5 && totalSelectedCount > 0) {
      const baseSections = originalSections.length > 0 ? originalSections : effectiveSections;
      const updatedSections = baseSections.map(sec => {
        const partsPerQuestion = (sec.subParts && sec.subParts.length > 0) ? sec.subParts.length : 1;
        const totalIds = (sectionSelections[sec.id] || []).length;
        const completeQuestions = Math.floor(totalIds / partsPerQuestion);
        
        return completeQuestions > 0 ? { 
          ...sec, 
          questionCount: completeQuestions, 
          attemptCount: Math.min(completeQuestions, sec.attemptCount) 
        } : null;
      }).filter((s): s is PaperPatternSection => s !== null);
      
      setEffectiveSections(updatedSections);
      setStep(6);
    }
    else if (step === 6) {
      // 🔹 GENERATE PAPER CODE IF NOT EXISTS
      if (!paperCode) {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setPaperCode(code);
      }
      setStep(7);
    }
  };

  const handlePatternSelect = (p: PaperPattern) => {
    setSelectedPatternId(p.id);
    setOriginalSections(p.sections);
    setEffectiveSections(p.sections);
    setPaperTime(p.timeAllowed || '2:00 Hours');
    setTimeout(() => setStep(4), 150);
  };

  const toggleChapter = (chapterId: string, chapterSubtopics: Subtopic[]) => {
    const isSelected = selectedChapters.includes(chapterId);
    if (isSelected) {
      setSelectedChapters(prev => prev.filter(id => id !== chapterId));
      const subtopicIds = chapterSubtopics.map(s => s.id);
      setSelectedSubtopics(prev => prev.filter(id => !subtopicIds.includes(id)));
    } else {
      setSelectedChapters(prev => [...prev, chapterId]);
      const subtopicIds = chapterSubtopics.map(s => s.id);
      setSelectedSubtopics(prev => [...new Set([...prev, ...subtopicIds])]);
    }
  };

  const toggleSubtopic = (subtopicId: string) => {
    setSelectedSubtopics(prev => 
      prev.includes(subtopicId) 
        ? prev.filter(id => id !== subtopicId) 
        : [...prev, subtopicId]
    );
  };

  const handleSaveOrUpdate = async () => {
    const paperData = {
      title: `${selectedClass} - ${selectedSubject}`,
      classLevel: selectedClass,
      subject: selectedSubject,
      totalMarks: effectiveSections.reduce((acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 0),
      sections: effectiveSections,
      questions: getSelectedQuestions(),
      instituteProfile: user.instituteProfile,
      userId: user.id,
      createdBy: user.name,
      selectedChapterIds: selectedChapters,
      selectedSubtopicIds: selectedSubtopics,
      formattedChapters: getChaptersDisplay(),
      medium: selectedMedium,
      fontSize: fontSize,
      lineSpacing: lineSpacing,
      timeAllowed: paperTime,
      paperCode: paperCode
    };

    if (initialPaper?.id) {
       const result = await updatePaper(initialPaper.id, paperData);
       if (result.success) alert("Updated Successfully!");
       else alert(result.message);
    } else {
       const result = await savePaper(paperData);
       if (result.success) alert("Saved Successfully!");
       else alert(result.message);
    }
  };

  const handleDownloadWord = () => {
    const finalQuestions = getSelectedQuestions();
    const institute = user.instituteProfile;
    let questionsHtml = '';
    effectiveSections.forEach(section => {
      const sectionQuestions = finalQuestions.filter(q => q.targetSectionId === section.id);
      if (!sectionQuestions.length) return;
      questionsHtml += `<h3>${section.title}</h3>`;
      
      const partsPerQuestion = (section.subParts && section.subParts.length > 0) ? section.subParts.length : 1;
      
      for (let i = 0; i < sectionQuestions.length; i += partsPerQuestion) {
        const qMain = sectionQuestions[i];
        questionsHtml += `<p><b>${(i / partsPerQuestion) + 1}.</b> ${qMain.text}</p>`;
        
        if (section.subParts && section.subParts.length > 0) {
          for (let pIdx = 0; pIdx < section.subParts.length; pIdx++) {
            const qPart = sectionQuestions[i + pIdx];
            if (qPart) {
              questionsHtml += `<p style="padding-left: 20px">(${String.fromCharCode(97 + pIdx)}) ${qPart.text}</p>`;
            }
          }
        } else if (qMain.type === 'MCQ' && qMain.options) {
          questionsHtml += `<p>${qMain.options.map((o, oi) => `(${String.fromCharCode(97 + oi)}) ${o}`).join(' &nbsp; ')}</p>`;
        }
      }
      questionsHtml += `<br/>`;
    });
    const html = `<html><head><meta charset="utf-8" /></head><body><h1 style="text-align:center">${institute?.instituteName || 'Institute'}</h1><h2 style="text-align:center">${selectedClass} - ${selectedSubject}</h2><hr />${questionsHtml}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSubject}_Paper.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => { setTimeout(() => { window.print(); }, 100); };

  const getClassIcon = (cls: string) => { return <GraduationCap size={32} />; };

  const activeSection = originalSections.find(s => s.id === activeTabId);

  const swapQuestionPart = (newId: string) => {
    if (!swappingSlot || !activeTabId) return;
    
    const currentIds = [...(sectionSelections[activeTabId] || [])];
    const targetIdx = (swappingSlot.questionIndex * ((activeSection?.subParts?.length) || 1)) + swappingSlot.partIndex;
    
    currentIds[targetIdx] = newId;
    setSectionSelections(prev => ({ ...prev, [activeTabId]: currentIds }));
    setSwappingSlot(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col relative print:bg-white font-sans transition-colors duration-300 tex2jax_process">
      {/* 🔹 STEP BAR */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-[100] print:hidden min-h-[90px] flex flex-col justify-center px-4 sm:px-6 shadow-2xl">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 min-w-[60px] sm:min-w-[120px]">
                <button 
                  onClick={() => step > 1 ? setStep(step - 1) : onBack()} 
                  className="text-gray-400 hover:text-gold-500 p-2 transition-colors flex items-center gap-1 group"
                >
                  <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Back</span>
                </button>
                <button onClick={onBack} title="Dashboard" className="hidden md:block text-gray-400 hover:text-gold-500 p-2 hover:bg-gray-700 rounded-lg transition-all">
                  <Home size={18} />
                </button>
              </div>

              <div className="flex-grow flex items-center justify-center">
                {step === 7 ? (
                  <div className="flex flex-wrap items-center justify-center gap-3 w-full animate-fadeIn">
                    <h2 className="hidden xl:block text-xl font-black text-white uppercase tracking-tighter mr-4">
                      Paper Preview
                    </h2>
                    
                    <div className="flex items-center gap-2">
                       <div className="bg-gray-900/50 border border-gray-700 pl-3 pr-1 py-1 rounded-xl flex items-center gap-3 shadow-inner">
                          <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest whitespace-nowrap">Font:</span>
                          <select 
                            value={fontSize} 
                            onChange={(e) => setFontSize(parseInt(e.target.value))} 
                            className="bg-gray-800 border border-gray-700 text-white text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-gold-500/50 transition-all cursor-pointer min-w-[65px]"
                          >
                            {[8, 9, 10, 11, 12, 13].map(size => (<option key={size} value={size}>{size}px</option>))}
                          </select>
                       </div>

                       <div className="bg-gray-900/50 border border-gray-700 pl-3 pr-1 py-1 rounded-xl flex items-center gap-3 shadow-inner">
                          <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest whitespace-nowrap">Spacing:</span>
                          <select 
                            value={lineSpacing} 
                            onChange={(e) => setLineSpacing(parseInt(e.target.value))} 
                            className="bg-gray-800 border border-gray-700 text-white text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-gold-500/50 transition-all cursor-pointer min-w-[65px]"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (<option key={val} value={val}>{val}</option>))}
                          </select>
                       </div>
                    </div>

                    <Button onClick={() => setShowAnswerKey(!showAnswerKey)} variant={showAnswerKey ? 'primary' : 'secondary'} className="!w-auto text-[10px] py-1.5 px-3 flex items-center h-9 font-black"><Key size={14} className="mr-1.5 text-gold-500" /> {showAnswerKey ? 'Hide Key' : 'Show Key'}</Button>
                    
                    {/* 🔹 PAPER ACTIONS DROPDOWN (Consolidated & UX Improved) */}
                    <div className="relative group">
                      <Button variant="primary" className="!w-auto text-[10px] py-1.5 px-5 flex items-center h-9 font-black shadow-lg">
                        <Settings size={14} className="mr-2" /> Paper Actions <ChevronDown size={12} className="ml-2 opacity-50" />
                      </Button>
                      {/* Fixed UX by using pt-3 to bridge the gap between button and menu */}
                      <div className="absolute right-0 top-full pt-2 w-48 hidden group-hover:block z-[110] animate-fadeIn">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                          <button 
                            onClick={handleSaveOrUpdate} 
                            className="w-full text-left px-4 py-3 text-[11px] text-gray-300 hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors border-b border-gray-700 font-black uppercase"
                          >
                            <Save size={16} className="text-gold-500 group-hover:text-black" /> {initialPaper ? 'Update Paper' : 'Save Paper'}
                          </button>
                          <button 
                            onClick={() => window.print()} 
                            className="w-full text-left px-4 py-3 text-[11px] text-gray-300 hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors border-b border-gray-700 font-black uppercase"
                          >
                            <FileDown size={16} className="text-gold-500 group-hover:text-black" /> PDF Download
                          </button>
                          <button 
                            onClick={handlePrint} 
                            className="w-full text-left px-4 py-3 text-[11px] text-gray-300 hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors font-black uppercase"
                          >
                            <Printer size={16} className="text-gold-500 group-hover:text-black" /> Print Paper
                          </button>
                          <button 
                            onClick={handleDownloadWord} 
                            className="w-full text-left px-4 py-2.5 text-[10px] text-gray-400 hover:bg-gray-700 flex items-center gap-3 transition-colors font-bold border-t border-gray-700/50 italic"
                          >
                            <FileType size={14} /> Export to Word
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <nav className="flex items-center w-full max-w-2xl">
                    {STEPS_INFO.map((s, idx) => (
                      <React.Fragment key={s.num}>
                        <div className="flex flex-col items-center group relative">
                          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[9px] sm:text-xs transition-all duration-500 border-2 ${step === s.num ? 'bg-gold-500 text-black border-gold-500 scale-110 shadow-[0_0_15px_rgba(245,158,11,0.4)] z-10' : step > s.num ? 'bg-gold-500/20 text-gold-500 border-gold-500/60' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                            {step > s.num ? <Check size={12} strokeWidth={4} /> : s.num}
                          </div>
                          <span className={`absolute -bottom-6 text-[7px] sm:text-[9px] font-black uppercase tracking-tighter sm:tracking-widest whitespace-nowrap transition-colors duration-300 ${step === s.num ? 'text-gold-500' : 'text-gray-500'}`}>{s.label}</span>
                        </div>
                        {idx < STEPS_INFO.length - 1 && (
                          <div className="flex-1 h-[1.5px] bg-gray-700 mx-1 sm:mx-2 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gold-500 transition-all duration-700 ease-in-out" style={{ transform: `translateX(${step > s.num ? '0%' : '-100%'})` }} />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                )}
              </div>

              <div className="min-w-[40px] sm:min-w-[120px] flex justify-end">
                 { (step >= 3 && step <= 5) && (
                   <Button onClick={handleNext} disabled={(step === 3 && !selectedPatternId) || (step === 4 && selectedChapters.length === 0) || (step === 5 && totalSelectedCount === 0)} className="!w-auto py-1.5 px-3 sm:px-5 flex items-center text-[10px] sm:text-xs h-8 sm:h-9">
                     <span className="hidden sm:inline mr-1">Next</span> <ChevronRight size={14} />
                   </Button>
                 )}
                 { step === 6 && (
                    <Button onClick={handleNext} className="!w-auto py-1.5 px-3 sm:px-5 flex items-center text-[10px] sm:text-xs h-8 sm:h-9">
                      Preview <ChevronRight size={14} className="ml-1" />
                    </Button>
                 )}
              </div>
          </div>
      </header>

      <main className={`flex-grow ${step <= 2 ? 'max-w-6xl' : 'max-w-4xl'} mx-auto w-full px-4 py-8 sm:py-12 print:p-0`}>
          {step === 1 && (
            <div className="animate-fadeIn grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto justify-items-center">
              {CLASSES.map(cls => (
                <div key={cls} onClick={() => handleClassSelect(cls)} className={`cursor-pointer rounded-xl border-2 p-5 flex flex-col items-center justify-center gap-3 transition-all hover:scale-105 w-full aspect-square md:aspect-[4/3] ${selectedClass === cls ? 'bg-gray-800 border-gold-500 shadow-xl' : 'bg-gray-800/50 border-gray-700 hover:border-gold-500'}`}>
                  <div className="text-gold-500">{getClassIcon(cls)}</div>
                  <span className="font-bold text-white text-sm md:text-base whitespace-nowrap">{cls}</span>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadeIn grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4 justify-items-center">
              {availableSubjects.map(subj => (
                <div key={subj} onClick={() => handleSubjectSelect(subj)} className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center transition-all hover:scale-105 w-full h-28 sm:h-32 ${selectedSubject === subj ? 'bg-gray-800 border-gold-500 shadow-xl' : 'bg-gray-800/50 border-gray-700 hover:border-gold-500'}`}>
                  <span className="font-bold text-white text-base md:text-lg leading-tight">{subj}</span>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="animate-fadeIn grid grid-cols-1 md:grid-cols-2 gap-6">
              {isLoadingPatterns ? (
                <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
                  <RefreshCw size={48} className="animate-spin text-gold-500 opacity-50" />
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Layouts...</p>
                </div>
              ) : (
                <>
                  {availablePatterns.map(pattern => (
                    <div key={pattern.id} onClick={() => handlePatternSelect(pattern)} className={`relative bg-gray-800 border-2 rounded-xl p-6 hover:border-gold-500 flex flex-col h-full transition-all group cursor-pointer ${selectedPatternId === pattern.id ? 'border-gold-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-gray-700'}`}>
                      {selectedPatternId === pattern.id && (
                        <div className="absolute -top-2 -right-2 bg-gold-500 text-black rounded-full p-1 shadow-lg z-10 animate-scaleIn">
                          <CheckCircle size={20} />
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-white text-lg leading-tight group-hover:text-gold-500 transition-colors">{pattern.name}</h3>
                        {pattern.classLevel && <span className="text-[9px] bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 font-bold uppercase">{pattern.classLevel}</span>}
                      </div>
                      <div className="mb-6 flex-grow">
                        <div className="flex flex-wrap gap-2 mt-3">
                          {pattern.sections.map((s, i) => (
                            <span key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-tight shadow-inner transition-all hover:brightness-110 ring-1 ${getSectionTagStyles(s.type)} ${isUrdu(s.type) ? 'font-urdu py-0.5' : ''}`}>
                              <span className="uppercase opacity-90">{s.type}</span>
                              <span className="w-px h-2.5 bg-current opacity-20"></span>
                              <span className="text-white brightness-125 font-black">{s.attemptCount}/{s.questionCount}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-700/50 pt-4 mt-auto">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Total Weight</span>
                          <span className="text-lg font-black text-gold-500 leading-none">{pattern.totalMarks} Marks</span>
                        </div>
                        <div className="bg-gold-500/10 p-2 rounded-lg text-gold-500 group-hover:bg-gold-500 group-hover:text-black transition-all">
                          <ChevronRight size={18} className={selectedPatternId === pattern.id ? 'translate-x-1' : ''} />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="animate-fadeIn space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Select Chapters</h2>
                <p className="text-gray-400 text-sm mt-1">Choose chapters for the paper content.</p>
              </div>
              <div className="space-y-3">
                {availableChapters.map(chapter => {
                  const hasContent = chapter.subtopics.length > 0;
                  const isChecked = selectedChapters.includes(chapter.id);
                  return (
                    <div key={chapter.id} className="group">
                      <div onClick={() => hasContent && toggleChapter(chapter.id, chapter.subtopics)} className={`p-4 rounded-xl border transition-all flex items-center justify-between ${hasContent ? isChecked ? 'border-gold-500 bg-gray-800 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'border-gray-700 bg-gray-800/50 cursor-pointer hover:border-gray-500' : 'border-gray-800 bg-gray-900/30 opacity-50 cursor-not-allowed grayscale'}`}>
                        <div className="flex items-center gap-4">
                          {hasContent ? (isChecked ? <CheckSquare className="text-gold-500" /> : <Square className="text-gray-600" />) : (<AlertCircle size={20} className="text-gray-700" />)}
                          <div>
                            <span className={`font-bold block ${hasContent ? 'text-white' : 'text-gray-600'} ${isUrduPaper ? 'font-urdu text-lg' : ''}`}>{chapter.name}</span>
                            {!hasContent && <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-widest">No Content Found</span>}
                          </div>
                        </div>
                        {hasContent && (<span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isChecked ? 'bg-gold-500 text-black' : 'bg-gray-700 text-gray-400'}`}>{chapter.subtopics.length} Topics</span>)}
                      </div>
                      {isChecked && chapter.subtopics.length > 0 && (
                        <div className="mt-2 ml-10 p-4 bg-gray-900/50 border-l-2 border-gold-500/30 rounded-r-xl grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
                          {chapter.subtopics.map(sub => (
                            <div key={sub.id} onClick={() => toggleSubtopic(sub.id)} className="flex items-center gap-2 cursor-pointer group/sub">
                              {selectedSubtopics.includes(sub.id) ? <CheckCircle size={16} className="text-gold-500" /> : <div className="w-4 h-4 rounded-full border border-gray-600 group-hover/sub:border-gold-500/50 transition-colors" />}
                              <span className={`text-xs ${selectedSubtopics.includes(sub.id) ? 'text-white font-medium' : 'text-gray-500'} ${isUrduPaper ? 'font-urdu text-base' : ''}`}>{sub.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-fadeIn flex flex-col h-full space-y-4">
                <div className="text-center flex-shrink-0">
                  <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Select Questions</h2>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                    <div className="flex-shrink-0 z-40 bg-gray-900 border-b-2 border-gold-500/30 shadow-xl">
                        <div className="flex gap-2 p-2 overflow-x-auto custom-scrollbar border-b border-gray-700/50">
                            {originalSections.map(s => (
                                <button key={s.id} onClick={() => setActiveTabId(s.id)} className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap flex items-center gap-2 border-2 ${activeTabId === s.id ? 'bg-gold-500 text-black border-gold-500 shadow-md scale-105' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gold-500'}`}>
                                  {s.title}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${activeTabId === s.id ? 'bg-black/20 text-black' : 'bg-gray-900 text-gold-500'}`}>
                                    {Math.floor((sectionSelections[s.id] || []).length / ((s.subParts && s.subParts.length > 0) ? s.subParts.length : 1))}/{s.questionCount}
                                  </span>
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 bg-gray-800/95 backdrop-blur-md">
                          <button onClick={triggerAutoSelect} className="bg-gray-900 border border-gold-500/50 hover:bg-gold-500 hover:text-black text-gold-500 p-2 rounded-lg flex flex-col items-center gap-1 transition-all group">
                            <Wand2 size={18} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase tracking-tighter">Auto</span>
                          </button>
                          <button onClick={() => {}} className="bg-gray-900 border border-gray-700 hover:border-gold-500 text-white p-2 rounded-lg flex flex-col items-center gap-1 transition-all group">
                            <Fingerprint size={18} className="group-hover:scale-110 transition-transform text-gold-500" />
                            <span className="text-[9px] font-bold uppercase tracking-tighter">Manual</span>
                          </button>
                          <button onClick={clearCurrentTab} className="bg-gray-900 border border-gray-700 hover:border-red-500 text-red-400 p-2 rounded-lg flex flex-col items-center gap-1 transition-all group">
                            <Eraser size={18} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase tracking-tighter">Clear</span>
                          </button>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-900/20 pb-32">
                        {isLoadingQuestions ? <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto text-gold-500" size={32} /></div> : (
                            activeSection && (activeSection.subParts && activeSection.subParts.length > 0) ? (
                                <div className="space-y-6">
                                  {Array.from({ length: activeSection.questionCount }).map((_, qIdx) => {
                                    const parts = activeSection.subParts!;
                                    const selectionForSection = sectionSelections[activeTabId!] || [];
                                    const unitIds = selectionForSection.slice(qIdx * parts.length, (qIdx + 1) * parts.length);
                                    return (
                                      <div key={qIdx} className="bg-gray-800 border-2 border-gold-500/20 rounded-2xl overflow-hidden shadow-lg animate-fadeIn">
                                        <div className="bg-gray-700/50 px-4 py-2 border-b border-gold-500/20 flex justify-between items-center">
                                           <span className="text-[10px] font-black uppercase text-gold-500 tracking-widest">Question {qIdx + 1} Unit</span>
                                           <span className="text-[9px] bg-gold-500 text-black px-2 py-0.5 rounded-full font-bold">{parts.length} Parts Grouped</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                          {parts.map((part, pIdx) => {
                                            const qId = unitIds[pIdx];
                                            const qData = questionPool.find(qp => qp.id === qId);
                                            return (
                                              <div key={pIdx} className="flex gap-4 items-start bg-gray-900/40 p-3 rounded-xl border border-gray-700/50 hover:border-gold-500/30 transition-all">
                                                <div className="bg-gold-500/10 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-gold-500 shrink-0 border border-gold-500/20">{part.label.replace(/[()]/g, '')}</div>
                                                <div className="flex-grow">
                                                   {qData ? (
                                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                       <div className="space-y-1">
                                                         <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-gold-500/10 text-gold-500 font-black border border-gold-500/20 uppercase tracking-tighter">{part.type || activeSection.type}</span>
                                                            {qData.subtopic && <p className={`text-[8px] text-gray-500 uppercase font-bold ${isUrduPaper ? 'font-urdu' : ''}`}>Topic: {qData.subtopic}</p>}
                                                         </div>
                                                         <p className="text-sm text-white leading-snug">{qData.text}</p>
                                                         
                                                         {/* 🔹 MCQ OPTIONS PREVIEW IN PARTS */}
                                                         {qData.type === 'MCQ' && qData.options && (
                                                           <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
                                                              {qData.options.map((opt, oi) => (
                                                                <div key={oi} className={`px-1.5 py-0.5 rounded border ${qData.correctAnswer === String.fromCharCode(65 + oi) ? 'bg-gold-500/10 text-gold-500 border-gold-500/20' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                                                  <span className="font-black mr-1 opacity-50">{String.fromCharCode(65 + oi)}:</span> {opt}
                                                                </div>
                                                              ))}
                                                           </div>
                                                         )}
                                                       </div>
                                                       {qData.textUrdu && (
                                                         <div className="border-t md:border-t-0 md:border-l border-gray-700/50 pt-2 md:pt-0 md:pl-4">
                                                           <p className="text-lg text-right text-gray-100 leading-relaxed font-urdu" dir="rtl">{qData.textUrdu}</p>
                                                           {qData.type === 'MCQ' && qData.optionsUrdu && (
                                                             <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-right" dir="rtl">
                                                                {qData.optionsUrdu.map((opt, oi) => (
                                                                  <div key={oi} className={`text-xs px-1 rounded font-urdu ${qData.correctAnswer === String.fromCharCode(65 + oi) ? 'text-gold-500 bg-gold-500/5' : 'text-gray-100 opacity-60'}`}>
                                                                    ({String.fromCharCode(97 + oi)}) {opt}
                                                                  </div>
                                                                ))}
                                                             </div>
                                                           )}
                                                         </div>
                                                       )}
                                                     </div>
                                                   ) : (
                                                     <div className="flex flex-col gap-1">
                                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 font-black w-fit uppercase">Target: {part.type || activeSection.type}</span>
                                                        <p className="text-xs text-gray-500 italic">No question selected for this slot</p>
                                                     </div>
                                                   )}
                                                </div>
                                                <button onClick={() => setSwappingSlot({ sectionId: activeTabId!, questionIndex: qIdx, partIndex: pIdx, partType: part.type || activeSection.type })} className="p-2 text-gold-500 hover:bg-gold-500 hover:text-black rounded-lg transition-all" title="Swap Part"><Shuffle size={16} /></button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                  {questionPool.filter(q => activeSection && q.type === activeSection.type).map(q => {
                                      const isSelected = activeTabId ? (sectionSelections[activeTabId] || []).includes(q.id) : false;
                                      return (
                                        <div key={q.id} onClick={() => {
                                            if (!activeTabId) return;
                                            const currentIds = sectionSelections[activeTabId] || [];
                                            const exists = currentIds.includes(q.id);
                                            if (exists) { 
                                              setSectionSelections(prev => ({ ...prev, [activeTabId]: currentIds.filter(id => id !== q.id) }));
                                            } 
                                            else {
                                              if (activeSection && currentIds.length >= activeSection.questionCount) { return; }
                                              setSectionSelections(prev => ({ ...prev, [activeTabId]: [...currentIds, q.id] }));
                                            }
                                        }} className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${isSelected ? 'border-gold-500 bg-gold-500/10 shadow-sm' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'}`}>
                                            {isSelected ? <CheckSquare className="text-gold-500 shrink-0 mt-0.5" size={22} /> : <Square className="text-gray-700 shrink-0 mt-0.5" size={22} />}
                                            <div className="flex-grow">
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                  <p className="text-xs sm:text-sm text-white leading-snug font-medium">{q.text}</p>
                                                  {q.subtopic && <p className={`text-[8px] text-gray-500 mt-1 uppercase tracking-widest font-black border-t border-gray-700/50 pt-1 inline-block ${isUrduPaper ? 'font-urdu' : ''}`}>Topic: {q.subtopic}</p>}
                                                  
                                                  {/* 🔹 MCQ OPTIONS PREVIEW IN MANUAL LIST */}
                                                  {q.type === 'MCQ' && q.options && (
                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                       {q.options.map((opt, oi) => (
                                                         // Fix: Use 'q' instead of 'qData' which is not in scope here
                                                         <div key={oi} className={`text-[9px] px-2 py-0.5 rounded border ${q.correctAnswer === String.fromCharCode(65 + oi) ? 'bg-gold-500/10 text-gold-500 border-gold-500/30 font-bold' : 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                                                            {String.fromCharCode(65 + oi)}. {opt}
                                                         </div>
                                                       ))}
                                                    </div>
                                                  )}
                                                </div>
                                                {q.textUrdu && (
                                                  <div className="border-t md:border-t-0 md:border-l border-gray-700/50 pt-2 md:pt-0 md:pl-4">
                                                    <p className="text-lg text-right text-gray-100 leading-relaxed font-urdu" dir="rtl">{q.textUrdu}</p>
                                                    {q.type === 'MCQ' && q.optionsUrdu && (
                                                      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-right" dir="rtl">
                                                         {q.optionsUrdu.map((opt, oi) => (
                                                           <div key={oi} className={`text-xs px-1 rounded font-urdu ${q.correctAnswer === String.fromCharCode(65 + oi) ? 'text-gold-500 bg-gold-500/10' : 'text-gray-100 opacity-60'}`}>
                                                             ({String.fromCharCode(97 + oi)}) {opt}
                                                           </div>
                                                         ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                        </div>
                                      );
                                  })}
                                </div>
                            )
                        )}
                    </div>
                </div>

                {swappingSlot && (
                  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
                     <div className="bg-gray-800 border-2 border-gold-500/50 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-scaleIn">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                           <div>
                              <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Swap Question Part</h3>
                              <p className="text-xs text-gray-400 mt-1">Select a replacement for Part {swappingSlot.partIndex + 1} of Unit {swappingSlot.questionIndex + 1}</p>
                              {swappingSlot.partType && (
                                <span className="inline-block mt-2 px-2 py-0.5 bg-gold-500/10 text-gold-500 border border-gold-500/20 text-[9px] font-black uppercase rounded">Filtering for: {swappingSlot.partType}</span>
                              )}
                           </div>
                           <button onClick={() => setSwappingSlot(null)} className="p-2 text-gray-500 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-4 space-y-2 custom-scrollbar">
                           {questionPool.filter(q => q.type === (swappingSlot.partType || activeSection?.type)).map(q => {
                                const isAlreadyInUnit = (sectionSelections[swappingSlot.sectionId] || []).includes(q.id);
                                return (
                                  <div key={q.id} onClick={() => !isAlreadyInUnit && swapQuestionPart(q.id)} className={`p-4 rounded-xl border transition-all ${isAlreadyInUnit ? 'opacity-30 border-gray-700 cursor-not-allowed grayscale' : 'border-gray-700 bg-gray-900/40 cursor-pointer hover:border-gold-500 hover:bg-gray-800/50'}`}>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-start justify-between gap-4">
                                           <div>
                                              <p className="text-sm text-white leading-snug">{q.text}</p>
                                              {/* 🔹 MCQ OPTIONS PREVIEW IN SWAP MODAL */}
                                              {q.type === 'MCQ' && q.options && (
                                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                                   {q.options.map((opt, oi) => (
                                                     <div key={oi} className="text-[8px] text-gray-500">
                                                        <span className="font-black mr-1">{String.fromCharCode(65 + oi)}:</span> {opt}
                                                     </div>
                                                   ))}
                                                </div>
                                              )}
                                           </div>
                                           {isAlreadyInUnit ? <CheckCircle size={18} className="text-gold-500 shrink-0" /> : <ChevronRight size={18} className="text-gray-600 shrink-0" />}
                                        </div>
                                        {q.textUrdu && (
                                          <div className="border-t md:border-t-0 md:border-l border-gray-700/50 pt-2 md:pt-0 md:pl-4">
                                            <p className="text-lg text-right text-gray-100 leading-relaxed font-urdu" dir="rtl">{q.textUrdu}</p>
                                            {q.type === 'MCQ' && q.optionsUrdu && (
                                              <div className="mt-1 flex flex-wrap justify-end gap-x-2 gap-y-0.5 text-right opacity-50" dir="rtl">
                                                 {q.optionsUrdu.map((opt, oi) => (
                                                   <div key={oi} className="text-[10px] font-urdu">
                                                     ({String.fromCharCode(97 + oi)}) {opt}
                                                   </div>
                                                 ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                     </div>
                                     <div className="mt-2 flex items-center gap-3"><span className={`text-[9px] bg-gray-900 text-gray-400 px-2 py-0.5 rounded font-black border border-gray-700 ${isUrduPaper ? 'font-urdu' : ''}`}>Topic: {q.subtopic || 'General'}</span>{isAlreadyInUnit && <span className="text-[8px] text-gold-500/70 font-black uppercase italic">Already in this paper</span>}</div>
                                  </div>
                                );
                             })}
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-900/30 flex justify-end"><Button variant="secondary" onClick={() => setSwappingSlot(null)} className="!w-auto px-6">Cancel</Button></div>
                     </div>
                  </div>
                )}
            </div>
          )}

          {step === 6 && (
            <div className="animate-fadeIn flex flex-col items-center">
                <h2 className="text-2xl font-bold text-white mb-8 uppercase tracking-widest">Select Medium</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl">
                    {['English', 'Urdu', 'Both'].map(m => (
                        <div key={m} onClick={() => { setSelectedMedium(m as any); handleNext(); }} className={`bg-gray-800 border-2 rounded-2xl p-8 text-center cursor-pointer transition-all hover:-translate-y-1 ${selectedMedium === m ? 'border-gold-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-gray-700 shadow-md'}`}>
                            <FileType className="mx-auto text-gold-500 mb-4" size={48} />
                            <span className="font-bold text-white text-xl uppercase tracking-tighter">{m}</span>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {step === 7 && (
            <div className="animate-fadeIn space-y-4 h-full flex flex-col relative">
               <div className="bg-gray-800 p-4 sm:p-8 rounded-xl overflow-auto border border-gray-700 flex-grow print:p-0 print:bg-white print:border-none">
                  <div className="mx-auto shadow-2xl print:shadow-none bg-white w-full max-w-[210mm] transition-all relative group/paper" style={{ minHeight: '297mm', color: 'black' }}>
                     <PrintablePaper 
                       instituteProfile={user.instituteProfile} classLevel={selectedClass} subject={selectedSubject} 
                       totalMarks={effectiveSections.reduce((acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 0)} 
                       sections={effectiveSections} questions={getSelectedQuestions()} layoutMode={1} medium={selectedMedium} showAnswerKey={showAnswerKey}
                       baseFontSize={fontSize} lineSpacing={lineSpacing} timeAllowed={paperTime} paperCode={paperCode}
                       chaptersDisplay={getChaptersDisplay()}
                     />
                  </div>
               </div>
            </div>
          )}
      </main>
    </div>
  );
};