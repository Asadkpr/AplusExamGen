import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { Input } from './Input'; 
import { CLASSES } from '../constants';
import { getSubjects } from '../services/subjectService';
import { getChapters } from '../services/chapterService';
import { getPatterns } from '../services/patternService';
import { getQuestionsForChapters } from '../services/questionService';
import { Chapter, QuestionType, Question, PaperPatternSection, User, PaperPattern, Subtopic, SavedPaper, PaperPatternSectionPart } from '../types';
import { savePaper, updatePaper } from '../services/paperService';
import { PrintablePaper } from './PrintablePaper';
import { 
  ArrowLeft, CheckSquare, Square, ChevronRight, ChevronDown, CheckCircle, 
  Printer, RefreshCw, AlertCircle, Save, GraduationCap, 
  FileText, Check, Plus, Trash2, Download, Wand2, Fingerprint,
  Eraser, FileType, FileDown, Key, Database, Home, Type as TypeIcon, Layout,
  Shuffle, Repeat, MoreVertical, X, AlignJustify, Settings, Lock, ListFilter,
  Tag, AlertTriangle, BookOpen, Search, MousePointer2
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

const isEnglishSubject = (subject: string) => {
  return subject.toLowerCase().includes('english');
};

// Internal utility to render formatted text in selection UI
const renderFormattedPreview = (text: string) => {
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
    <span className={isUrdu ? 'font-urdu text-right block' : ''} dir={isUrdu ? 'rtl' : 'ltr'}>
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

const getSectionTagStyles = (type: string) => {
  const upper = type.toUpperCase();
  
  // 🔹 URDU & ISLAMIYAT TYPES (GOLD)
  if (isUrdu(type) || upper.includes('تشریح') || upper.includes('ترجمہ') || upper.includes('خلاصہ')) {
    return 'bg-gold-500/20 text-gold-400 border-gold-500/40 ring-gold-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)]';
  }
  
  // 🔹 OBJECTIVE / GRAMMAR (BLUE)
  if (upper === 'MCQ' || ['VERB', 'SPELLING', 'MEANING', 'GRAMMAR', 'SYNONYM'].some(t => upper.includes(t))) {
    return 'bg-blue-500/20 text-blue-300 border-blue-500/40 ring-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]';
  }
  
  // 🔹 CONCEPTUAL / SHORT (EMERALD)
  if (upper.includes('SHORT')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
  }
  
  // 🔹 THEORY / LONG (PURPLE)
  if (upper.includes('LONG') || upper.includes('THEORY')) {
    return 'bg-purple-500/20 text-purple-300 border-purple-500/40 ring-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.1)]';
  }
  
  // 🔹 APPLIED / MATH (ORANGE)
  if (upper.includes('NUMERICAL') || upper.includes('PROBLEM') || upper.includes('CALC')) {
    return 'bg-orange-500/20 text-orange-300 border-orange-500/40 ring-orange-500/10 shadow-[0_0_10px_rgba(249,115,22,0.1)]';
  }
  
  // 🔹 CREATIVE WRITING (ROSE)
  if (['ESSAY', 'LETTER', 'STORY', 'DIALOGUE', 'APPLICATION'].some(t => upper.includes(t))) {
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.1)]';
  }
  
  // 🔹 COMPREHENSION / ANALYSIS (CYAN)
  if (['TRANSLATE', 'SUMMARY', 'PARAPHRASE', 'PASSAGE', 'VOICE', 'COMPREHENSION'].some(t => upper.includes(t))) {
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 ring-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.1)]';
  }
  
  // 🔹 VOCABULARY / OTHER (AMBER)
  if (['IDIOMS', 'SENTENCES', 'ALTERNATE', 'PAIR', 'PUNCTUATION'].some(t => upper.includes(t))) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)]';
  }

  return 'bg-gray-500/10 text-gray-400 border-gray-500/30 ring-gray-500/5';
};

const isChapterMandatory = (chapterName: string, mandatoryNumbers: string[]) => {
  if (!mandatoryNumbers || mandatoryNumbers.length === 0) return false;
  const match = chapterName.match(/\d+/);
  if (!match) return false;
  return mandatoryNumbers.includes(match[0]);
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
  const [fontSize, setFontSize] = useState(13);
  const [lineSpacing, setLineSpacing] = useState(2); // 0-10 scale
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  
  const [sectionSelections, setSectionSelections] = useState<Record<string, string[]>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('All');
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [isSmartSkipping, setIsSmartSkipping] = useState(false);

  const [mandatoryChapterIds, setMandatoryChapterIds] = useState<string[]>([]);

  const [swappingSlot, setSwappingSlot] = useState<{ 
    sectionId: string; 
    unitIndex: number; 
    partIndex: number;
    partType?: string;
    partChapters?: string[];
  } | null>(null);

  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';
  const isUrduPaper = isUrduStyleSubject(selectedSubject);
  const isEnglish = isEnglishSubject(selectedSubject);

  useEffect(() => {
    if (initialPaper) {
      const paper = initialPaper;
      setSelectedClass(paper.classLevel);
      setSelectedSubject(paper.subject);
      setSelectedChapters(paper.selectedChapterIds || []);
      setSelectedSubtopics(paper.selectedSubtopicIds || []);
      setEffectiveSections(paper.sections);
      setOriginalSections(paper.sections); 
      setSelectedMedium(paper.medium || 'English');
      setFontSize(Math.min(paper.fontSize || 13, 13));
      setLineSpacing(paper.lineSpacing ?? 2);
      setPaperTime(paper.timeAllowed || '2:00 Hours');
      setPaperCode(paper.paperCode || '');
      
      const selections: Record<string, string[]> = {};
      paper.questions.forEach(q => {
        if (q.targetSectionId) {
          if (!selections[q.targetSectionId]) selections[q.targetSectionId] = [];
          selections[q.targetSectionId].push(q.id);
        }
      });
      setSectionSelections(selections);
      setStep(7);
      
      const loadBgData = async () => {
         const chs = await getChapters(paper.subject, paper.classLevel, !isAdmin);
         setAvailableChapters(chs);
         const chapterIds: string[] = paper.selectedChapterIds ? [...paper.selectedChapterIds] : [];
         const pool = await getQuestionsForChapters(paper.subject, chs, chapterIds, false);
         setQuestionPool(pool);
         if (paper.sections.length > 0) setActiveTabId(paper.sections[0].id);
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
  }, [initialPaper, initialPattern, isAdmin]);

  useEffect(() => {
    if (availableChapters.length > 0 && originalSections.length > 0) {
      const allMandatoryNums: string[] = Array.from(new Set(
        originalSections.flatMap((s: PaperPatternSection) => [
          ...(s.specificChapters || []),
          ...(s.subParts?.flatMap((p: PaperPatternSectionPart) => p.specificChapters || []) || [])
        ])
      ));
      
      if (allMandatoryNums.length > 0) {
        const matchingIds = availableChapters
          .filter(ch => isChapterMandatory(ch.name, allMandatoryNums))
          .map(ch => ch.id);
        
        setMandatoryChapterIds(matchingIds);
        setSelectedChapters(prev => [...new Set([...prev, ...matchingIds])]);
        setSelectedSubtopics(prev => {
          const mandatorySubtopicIds = availableChapters
            .filter(ch => matchingIds.includes(ch.id))
            .flatMap(ch => ch.subtopics.map(s => s.id));
          return [...new Set([...prev, ...mandatorySubtopicIds])];
        });
      } else {
        setMandatoryChapterIds([]);
      }
    }
  }, [availableChapters, originalSections]);

  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [questionPool, activeTabId, step, sectionSelections, swappingSlot, selectedTopicFilter]);

  useEffect(() => {
    if (selectedClass) {
        const loadSubjects = async () => {
            const allSubjectsMap = await getSubjects();
            setAvailableSubjects(allSubjectsMap[selectedClass] || []);
        };
        loadSubjects();
    }
  }, [selectedClass]);

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
  }, [selectedSubject, selectedClass, isAdmin, isSmartSkipping]);

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
      setMandatoryChapterIds([]);
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
      setMandatoryChapterIds([]);
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

  const matchesType = (questionType: string, patternType: string) => {
    const qT = (questionType || "").toUpperCase();
    const pT = (patternType || "").toUpperCase();
    if (qT === pT) return true;
    if (isEnglish) {
       if (pT === 'MCQ' && ['VERB', 'SPELLING', 'MEANING', 'GRAMMAR'].includes(qT)) return true;
       // Ensure 'Dialogue' matches effectively even if casing varies
       if (pT === 'DIALOGUE' && qT === 'DIALOGUE') return true;
       if (pT.includes(qT) || qT.includes(pT)) return true;
    }
    return false;
  };

  const triggerAutoSelect = () => {
    const sectionsToUse = originalSections.length > 0 ? originalSections : effectiveSections;
    const newSelections: Record<string, string[]> = {};
    
    sectionsToUse.forEach(section => {
      const selectionForThisSection: string[] = [];
      const isMCQ = section.type.toUpperCase() === 'MCQ';
      const sectionPool = section.specificChapters && section.specificChapters.length > 0
        ? questionPool.filter(q => {
            const ch = availableChapters.find(c => c.id === q.chapterId);
            return ch && isChapterMandatory(ch.name, section.specificChapters!);
          })
        : questionPool;

      if (isMCQ && section.subParts && section.subParts.length > 0) {
        section.subParts.forEach(part => {
           let partPool = sectionPool;
           if (part.specificChapters && part.specificChapters.length > 0) {
             partPool = questionPool.filter(q => {
               const ch = availableChapters.find(c => c.id === q.chapterId);
               return ch && isChapterMandatory(ch.name, part.specificChapters!);
             });
           }
           const available = partPool.filter(q => matchesType(q.type, part.type || section.type) && !selectionForThisSection.includes(q.id));
           for(let k=0; k < (part.questionCount || 0); k++) {
              const random = available[Math.floor(Math.random() * available.length)];
              if (random) {
                selectionForThisSection.push(random.id);
                available.splice(available.indexOf(random), 1);
              }
           }
        });
      } else {
        for (let unitIdx = 0; unitIdx < section.questionCount; unitIdx++) {
          if (section.subParts && section.subParts.length > 0) {
            section.subParts.forEach(part => {
              const targetType = part.type || section.type;
              let partPool = sectionPool;
              if (part.specificChapters && part.specificChapters.length > 0) {
                 partPool = questionPool.filter(q => {
                   const ch = availableChapters.find(c => c.id === q.chapterId);
                   return ch && isChapterMandatory(ch.name, part.specificChapters!);
                 });
              }
              const available = partPool.filter(q => matchesType(q.type, targetType) && !selectionForThisSection.includes(q.id));
              const random = available[Math.floor(Math.random() * available.length)];
              if (random) selectionForThisSection.push(random.id);
            });
          } else {
            const available = sectionPool.filter(q => matchesType(q.type, section.type) && !selectionForThisSection.includes(q.id));
            const random = available[Math.floor(Math.random() * available.length)];
            if (random) selectionForThisSection.push(random.id);
          }
        }
      }
      newSelections[section.id] = selectionForThisSection;
    });
    setSectionSelections(newSelections);
  };

  const clearCurrentTab = () => {
    if (!activeTabId) return;
    setSectionSelections(prev => ({ ...prev, [activeTabId]: [] }));
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
          const isMCQ = section.type.toUpperCase() === 'MCQ';
          const sectionPool = section.specificChapters && section.specificChapters.length > 0
            ? pool.filter(q => {
                const ch = availableChapters.find(c => c.id === q.chapterId);
                return ch && isChapterMandatory(ch.name, section.specificChapters!);
              })
            : pool;

          if (isMCQ && section.subParts && section.subParts.length > 0) {
             section.subParts.forEach(part => {
               let partPool = sectionPool;
               if (part.specificChapters && part.specificChapters.length > 0) {
                 partPool = pool.filter(q => {
                   const ch = availableChapters.find(c => c.id === q.chapterId);
                   return ch && isChapterMandatory(ch.name, part.specificChapters!);
                 });
               }
               const available = partPool.filter(q => matchesType(q.type, part.type || section.type) && !selectionForThisSection.includes(q.id));
               for(let k=0; k < (part.questionCount || 0); k++) {
                  const random = available[Math.floor(Math.random() * available.length)];
                  if (random) {
                    selectionForThisSection.push(random.id);
                    available.splice(available.indexOf(random), 1);
                  }
               }
             });
          } else {
            for (let unitIdx = 0; unitIdx < section.questionCount; unitIdx++) {
              if (section.subParts && section.subParts.length > 0) {
                section.subParts.forEach(part => {
                  const targetType = part.type || section.type;
                  let partPool = pool;
                  if (part.specificChapters && part.specificChapters.length > 0) {
                     partPool = pool.filter(q => {
                       const ch = availableChapters.find(c => c.id === q.chapterId);
                       return ch && isChapterMandatory(ch.name, part.specificChapters!);
                     });
                  }
                  const available = partPool.filter(q => matchesType(q.type, targetType) && !selectionForThisSection.includes(q.id));
                  const random = available[Math.floor(Math.random() * available.length)];
                  if (random) selectionForThisSection.push(random.id);
                });
              } else {
                const available = sectionPool.filter(q => matchesType(q.type, section.type) && !selectionForThisSection.includes(q.id));
                const random = available[Math.floor(Math.random() * available.length)];
                if (random) selectionForThisSection.push(random.id);
              }
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
        const isMCQ = sec.type.toUpperCase() === 'MCQ';
        if (isMCQ && sec.subParts && sec.subParts.length > 0) {
           return sec; 
        }
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
    if (mandatoryChapterIds.includes(chapterId)) return;
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

  const toggleSubtopic = (subtopicId: string, parentChapterId: string) => {
    setSelectedSubtopics(prev => prev.includes(subtopicId) ? prev.filter(id => id !== subtopicId) : [...prev, subtopicId]);
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
            if (qPart) questionsHtml += `<p style="padding-left: 20px">(${String.fromCharCode(97 + pIdx)}) ${qPart.text}</p>`;
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
  const getClassIcon = (cls: string) => <GraduationCap size={32} />;
  const activeSection = originalSections.find(s => s.id === activeTabId);

  const swapQuestionPart = (newId: string) => {
    if (!swappingSlot || !activeTabId) return;
    const currentIds = [...(sectionSelections[activeTabId] || [])];
    const targetIdx = (swappingSlot.unitIndex * ((activeSection?.subParts?.length) || 1)) + swappingSlot.partIndex;
    currentIds[targetIdx] = newId;
    setSectionSelections(prev => ({ ...prev, [activeTabId]: currentIds }));
    setSwappingSlot(null);
  };

  const currentSectionTopics = useMemo(() => {
    if (!activeSection) return ['All'];
    const relevantPool = questionPool.filter(q => {
      const typeMatch = matchesType(q.type, activeSection.type);
      if (!typeMatch) return false;
      if (activeSection.specificChapters && activeSection.specificChapters.length > 0) {
        const ch = availableChapters.find(c => c.id === q.chapterId);
        if (!ch || !isChapterMandatory(ch.name, activeSection.specificChapters)) return false;
      }
      return true;
    });
    const topics = Array.from(new Set(relevantPool.map(q => q.subtopic || 'General')));
    return ['All', ...topics.sort()];
  }, [activeSection, questionPool, availableChapters]);

  const currentSwappingPool = useMemo(() => {
    if (!swappingSlot || !activeSection) return [];
    return questionPool.filter(q => {
       const typeMatch = matchesType(q.type, swappingSlot.partType || activeSection.type);
       if (!typeMatch) return false;
       if (swappingSlot.partChapters && swappingSlot.partChapters.length > 0) {
         const ch = availableChapters.find(c => c.id === q.chapterId);
         if (!ch || !isChapterMandatory(ch.name, swappingSlot.partChapters)) return false;
       } else if (activeSection.specificChapters && activeSection.specificChapters.length > 0) {
         const ch = availableChapters.find(c => c.id === q.chapterId);
         if (!ch || !isChapterMandatory(ch.name, activeSection.specificChapters)) return false;
       }
       return true;
    });
  }, [swappingSlot, activeSection, questionPool, availableChapters]);

  const isTopicActiveInSelection = (topic: string) => {
    if (!activeTabId) return false;
    const currentSelections = sectionSelections[activeTabId] || [];
    if (currentSelections.length === 0) return false;
    return currentSelections.some(qId => {
      const q = questionPool.find(item => item.id === qId);
      if (!q) return false;
      const qTopic = q.subtopic || 'General';
      return topic === 'All' ? true : qTopic === topic;
    });
  };

  // Helper to render MCQ Options in a single line if applicable
  const renderMCQOptionsSelection = (q: Question) => {
    const hasEng = q.options && q.options.length > 0;
    const hasUrdu = q.optionsUrdu && q.optionsUrdu.length > 0;
    const isDual = hasEng && hasUrdu;

    if (!hasEng && !hasUrdu) return null;

    const containerClass = isDual 
      ? "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-2 pt-2 border-t border-surface-700/30" 
      : "flex flex-wrap gap-x-6 gap-y-1 mt-2 pt-2 border-t border-surface-700/30";

    return (
      <div className={containerClass}>
        {hasEng && (
          <div className={isDual ? "space-y-1" : "flex flex-wrap gap-x-6 gap-y-1"}>
            {q.options!.map((opt, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-[10px] ${q.correctAnswer === String.fromCharCode(65 + i) ? 'text-gold-500 font-black' : 'text-theme-text-muted'}`}>
                <span className="opacity-50 font-bold">{String.fromCharCode(65 + i)}.</span>
                <span className="whitespace-nowrap">{renderFormattedPreview(opt)}</span>
              </div>
            ))}
          </div>
        )}
        {hasUrdu && (
          <div className={isDual ? "space-y-1 text-right font-urdu" : "flex flex-wrap flex-row-reverse gap-x-6 gap-y-1 font-urdu"} dir="rtl">
            {q.optionsUrdu!.map((opt, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-[12px] ${q.correctAnswer === String.fromCharCode(65 + i) ? 'text-gold-500 font-black' : 'text-theme-text-muted opacity-80'}`}>
                <span className="opacity-30 font-bold">({String.fromCharCode(97 + i)})</span>
                <span className="whitespace-nowrap">{renderFormattedPreview(opt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderQuestionSlot = (unitIdx: number, partIdx: number, partLabel: string, partType?: string, partChapters?: string[]) => {
    const sectionIds = sectionSelections[activeTabId!] || [];
    const partsPerQuestion = activeSection?.subParts?.length || 1;
    const globalIdx = (unitIdx * partsPerQuestion) + partIdx;
    const qId = sectionIds[globalIdx];
    const question = questionPool.find(q => q.id === qId);

    return (
      <div 
        key={`${unitIdx}-${partIdx}`}
        onClick={() => setSwappingSlot({ sectionId: activeTabId!, unitIndex: unitIdx, partIndex: partIdx, partType, partChapters })}
        className={`group p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${question ? 'bg-gold-500/5 border-gold-500/30 hover:border-gold-500' : 'bg-gray-900/40 border-dashed border-gray-700 hover:border-gold-500/50'}`}
      >
        <div className="flex items-start justify-between gap-4 w-full">
          <div className="flex items-start gap-3 overflow-hidden">
            <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 font-black text-[10px] mt-1 ${question ? 'bg-gold-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
              {partLabel}
            </div>
            <div className="flex-grow overflow-hidden">
              {question ? (
                <div>
                  <p className="text-[11px] text-theme-text-main line-clamp-2 leading-tight font-medium whitespace-pre-wrap">{renderFormattedPreview(question.text)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] bg-gold-500/10 text-gold-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-gold-500/20">{question.type}</span>
                    {question.subtopic && <span className="text-[8px] text-theme-text-sub font-bold italic truncate">/ {question.subtopic}</span>}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-theme-text-muted font-black uppercase tracking-widest italic group-hover:text-gold-500/70 transition-colors">Click to Select Question</span>
              )}
            </div>
          </div>
          <div className="shrink-0 transition-transform group-hover:translate-x-1">
            {question ? <CheckCircle size={18} className="text-gold-500" /> : <ChevronRight size={18} className="text-gray-700" />}
          </div>
        </div>
        {question && (question.type === 'MCQ' || (question as any).options) && renderMCQOptionsSelection(question)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col relative print:bg-white font-sans transition-colors duration-300 tex2jax_process">
      {/* 🔹 STEP BAR */}
      <header className="bg-surface-800 border-b border-surface-700 sticky top-0 z-[100] print:hidden min-h-[90px] flex flex-col justify-center px-4 sm:px-6 shadow-2xl">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 min-w-[60px] sm:min-w-[120px]">
                <button onClick={() => step > 1 ? setStep(step - 1) : onBack()} className="text-theme-text-muted hover:text-gold-500 p-2 transition-colors flex items-center gap-1 group">
                  <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Back</span>
                </button>
                <button onClick={onBack} title="Dashboard" className="hidden md:block text-theme-text-muted hover:text-gold-500 p-2 hover:bg-surface-700 rounded-lg transition-all"><Home size={18} /></button>
              </div>

              <div className="flex-grow flex items-center justify-center">
                {step === 7 ? (
                  <div className="flex flex-wrap items-center justify-center gap-3 w-full animate-fadeIn">
                    <h2 className="hidden xl:block text-xl font-black text-theme-text-main uppercase tracking-tighter mr-4">Paper Preview</h2>
                    <div className="flex items-center gap-2">
                       <div className="bg-surface-900/50 border border-surface-700 pl-3 pr-1 py-1 rounded-xl flex items-center gap-3 shadow-inner">
                          <span className="text-[9px] text-theme-text-muted font-black uppercase tracking-widest whitespace-nowrap">Font:</span>
                          <select value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="bg-surface-800 border border-surface-700 text-theme-text-main text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-gold-500/50 transition-all cursor-pointer min-w-[65px]">
                            {[8, 9, 10, 11, 12, 13].map(size => (<option key={size} value={size}>{size}px</option>))}
                          </select>
                       </div>
                       <div className="bg-surface-900/50 border border-surface-700 pl-3 pr-1 py-1 rounded-xl flex items-center gap-3 shadow-inner">
                          <span className="text-[9px] text-theme-text-muted font-black uppercase tracking-widest whitespace-nowrap">Spacing:</span>
                          <select value={lineSpacing} onChange={(e) => setLineSpacing(parseInt(e.target.value))} className="bg-surface-800 border border-surface-700 text-theme-text-main text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-gold-500/50 transition-all cursor-pointer min-w-[65px]">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (<option key={val} value={val}>{val}</option>))}
                          </select>
                       </div>
                    </div>
                    <Button onClick={() => setShowAnswerKey(!showAnswerKey)} variant={showAnswerKey ? 'primary' : 'secondary'} className="!w-auto text-[10px] py-1.5 px-3 flex items-center h-9 font-black"><Key size={14} className="mr-1.5 text-gold-500" /> {showAnswerKey ? 'Hide Key' : 'Show Key'}</Button>
                    <div className="relative group">
                      <Button variant="primary" className="!w-auto text-[10px] py-1.5 px-5 flex items-center h-9 font-black shadow-lg"><Settings size={14} className="mr-2" /> Paper Actions <ChevronDown size={12} className="ml-2 opacity-50" /></Button>
                      <div className="absolute right-0 top-full pt-2 w-48 hidden group-hover:block z-[110] animate-fadeIn">
                        <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-2xl overflow-hidden">
                          <button onClick={handleSaveOrUpdate} className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors border-b border-surface-700 font-black uppercase"><Save size={16} className="text-gold-500 group-hover:text-black" /> {initialPaper ? 'Update Paper' : 'Save Paper'}</button>
                          <button onClick={() => window.print()} className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors border-b border-surface-700 font-black uppercase"><FileDown size={16} className="text-gold-500 group-hover:text-black" /> PDF Download</button>
                          <button onClick={handlePrint} className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors font-black uppercase"><Printer size={16} className="text-gold-500 group-hover:text-black" /> Print Paper</button>
                          <button onClick={handleDownloadWord} className="w-full text-left px-4 py-2.5 text-[10px] text-theme-text-muted hover:bg-surface-700 flex items-center gap-3 transition-colors font-bold border-t border-surface-700/50 italic"><FileType size={14} /> Export to Word</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <nav className="flex items-center w-full max-w-2xl">
                    {STEPS_INFO.map((s, idx) => (
                      <React.Fragment key={s.num}>
                        <div className="flex flex-col items-center group relative">
                          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[9px] sm:text-xs transition-all duration-500 border-2 ${step === s.num ? 'bg-gold-500 text-black border-gold-500 scale-110 shadow-[0_0_15px_rgba(245,158,11,0.4)] z-10' : step > s.num ? 'bg-gold-500/20 text-gold-500 border-gold-500/60' : 'bg-surface-800 text-theme-text-muted border-surface-700'}`}>
                            {step > s.num ? <Check size={12} strokeWidth={4} /> : s.num}
                          </div>
                          <span className={`absolute -bottom-6 text-[7px] sm:text-[9px] font-black uppercase tracking-tighter sm:tracking-widest whitespace-nowrap transition-colors duration-300 ${step === s.num ? 'text-gold-500' : 'text-theme-text-muted'}`}>{s.label}</span>
                        </div>
                        {idx < STEPS_INFO.length - 1 && (
                          <div className="flex-1 h-[1.5px] bg-surface-700 mx-1 sm:mx-2 relative overflow-hidden">
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
                <div key={cls} onClick={() => handleClassSelect(cls)} className={`cursor-pointer rounded-xl border-2 p-5 flex flex-col items-center justify-center gap-3 transition-all hover:scale-105 w-full aspect-square md:aspect-[4/3] ${selectedClass === cls ? 'bg-surface-800 border-gold-500 shadow-xl' : 'bg-surface-800/50 border-surface-700 hover:border-gold-500'}`}>
                  <div className="text-gold-500">{getClassIcon(cls)}</div>
                  <span className="font-bold text-theme-text-main text-sm md:text-base whitespace-nowrap">{cls}</span>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadeIn grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4 justify-items-center">
              {availableSubjects.map(subj => (
                <div key={subj} onClick={() => handleSubjectSelect(subj)} className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center transition-all hover:scale-105 w-full h-28 sm:h-32 ${selectedSubject === subj ? 'bg-surface-800 border-gold-500 shadow-xl' : 'bg-surface-800/50 border-surface-700 hover:border-gold-500'}`}>
                  <span className="font-bold text-theme-text-main text-base md:text-lg leading-tight">{subj}</span>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="animate-fadeIn grid grid-cols-1 md:grid-cols-2 gap-6">
              {isLoadingPatterns ? (
                <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
                  <RefreshCw size={48} className="animate-spin text-gold-500 opacity-50" />
                  <p className="text-theme-text-muted font-bold uppercase tracking-widest text-xs">Loading Layouts...</p>
                </div>
              ) : (
                availablePatterns.map(pattern => (
                  <div key={pattern.id} onClick={() => handlePatternSelect(pattern)} className={`relative bg-surface-800 border-2 rounded-xl p-6 hover:border-gold-500 flex flex-col h-full transition-all group cursor-pointer ${selectedPatternId === pattern.id ? 'border-gold-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-surface-700'}`}>
                    {selectedPatternId === pattern.id && (<div className="absolute -top-2 -right-2 bg-gold-500 text-black rounded-full p-1 shadow-lg z-10 animate-scaleIn"><CheckCircle size={20} /></div>)}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-theme-text-main text-lg leading-tight group-hover:text-gold-500 transition-colors">{pattern.name}</h3>
                      {pattern.classLevel && <span className="text-[9px] bg-surface-900 text-theme-text-muted px-1.5 py-0.5 rounded border border-surface-700 font-bold uppercase">{pattern.classLevel}</span>}
                    </div>
                    <div className="mb-6 flex-grow">
                      <div className="flex flex-wrap gap-2 mt-3">
                        {pattern.sections.map((s, i) => (
                          <span key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-tight shadow-inner transition-all hover:brightness-110 ring-1 ${getSectionTagStyles(s.type)} ${isUrdu(s.type) ? 'font-urdu py-0.5' : ''}`}>
                            <span className="uppercase opacity-90">{s.type}</span>
                            <span className="w-px h-2.5 bg-current opacity-20"></span>
                            <span className="brightness-125 font-black">{s.attemptCount}/{s.questionCount}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-700/50 pt-4 mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-theme-text-muted uppercase font-black tracking-widest">Total Weight</span>
                        <span className="text-lg font-black text-gold-500 leading-none">{pattern.totalMarks} Marks</span>
                      </div>
                      <div className="bg-gold-500/10 p-2 rounded-lg text-gold-500 group-hover:bg-gold-500 group-hover:text-black transition-all">
                        <ChevronRight size={18} className={selectedPatternId === pattern.id ? 'translate-x-1' : ''} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {step === 4 && (
            <div className="animate-fadeIn space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-theme-text-main">Select Chapters</h2>
                <p className="text-theme-text-muted text-sm mt-1">Choose chapters for the paper content.</p>
              </div>
              {mandatoryChapterIds.length > 0 && (
                <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-3 flex items-center gap-3 max-w-2xl mx-auto mb-4 animate-fadeIn">
                   <Lock className="text-gold-500 shrink-0" size={18} />
                   <p className="text-[10px] text-gold-200 uppercase font-black tracking-widest leading-relaxed">Some chapters are <span className="text-gold-500">Locked</span> because they are mandatory for the selected board pattern.</p>
                </div>
              )}
              <div className="space-y-3">
                {availableChapters.map(chapter => {
                  const hasContent = chapter.subtopics.length > 0;
                  const isChecked = selectedChapters.includes(chapter.id);
                  const isMandatory = mandatoryChapterIds.includes(chapter.id);
                  return (
                    <div key={chapter.id} className="group">
                      <div onClick={() => hasContent && toggleChapter(chapter.id, chapter.subtopics)} className={`p-4 rounded-xl border transition-all flex items-center justify-between ${hasContent ? isChecked ? isMandatory ? 'border-gold-500/50 bg-surface-800/80 cursor-default opacity-90' : 'border-gold-500 bg-surface-800 shadow-[0_0_10px_rgba(245,158,11,0.1)] cursor-pointer' : 'border-surface-700 bg-surface-800/50 cursor-pointer hover:border-surface-500' : 'border-surface-900 bg-surface-900/30 opacity-50 cursor-not-allowed grayscale'}`}>
                        <div className="flex items-center gap-4">
                          {hasContent ? (isChecked ? (isMandatory ? <Lock size={20} className="text-gold-500" /> : <CheckSquare className="text-gold-500" />) : <Square className="text-theme-text-muted" />) : <AlertCircle size={20} className="text-theme-text-muted" />}
                          <div>
                            <span className={`font-bold block ${hasContent ? 'text-theme-text-main' : 'text-theme-text-muted'} ${isUrduPaper ? 'font-urdu text-lg' : ''}`}>{chapter.name}{isMandatory && <span className="ml-3 text-[8px] bg-gold-500 text-black px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Required</span>}</span>
                            {!hasContent && <span className="text-[10px] text-red-500/70 font-bold uppercase tracking-widest">No Content Found</span>}
                          </div>
                        </div>
                        {hasContent && (<span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isChecked ? 'bg-gold-500 text-black' : 'bg-surface-700 text-theme-text-muted'}`}>{chapter.subtopics.length} Topics</span>)}
                      </div>
                      {isChecked && chapter.subtopics.length > 0 && (
                        <div className="mt-2 ml-10 p-4 bg-surface-900/50 border-l-2 border-gold-500/30 rounded-r-xl grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
                          {chapter.subtopics.map(sub => (
                            <div key={sub.id} onClick={() => toggleSubtopic(sub.id, chapter.id)} className="flex items-center gap-2 cursor-pointer group/sub">
                              {selectedSubtopics.includes(sub.id) ? <CheckCircle size={16} className="text-gold-500" /> : <div className="w-4 h-4 rounded-full border border-surface-600 group-hover/sub:border-gold-500/50 transition-colors" />}
                              <span className={`text-xs ${selectedSubtopics.includes(sub.id) ? 'text-theme-text-main font-medium' : 'text-theme-text-muted'} ${isUrduPaper ? 'font-urdu text-base' : ''}`}>{sub.name}</span>
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
                <div className="text-center flex-shrink-0"><h2 className="text-2xl font-bold text-theme-text-main uppercase tracking-wider">Select Questions</h2></div>
                <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                    <div className="flex-shrink-0 z-40 bg-surface-900 border-b-2 border-gold-500/30 shadow-xl">
                        <div className="flex gap-2 p-2 overflow-x-auto custom-scrollbar border-b border-surface-700/50">
                            {originalSections.map(s => {
                               const isMCQ = s.type.toUpperCase() === 'MCQ';
                               const partsMultiplier = (!isMCQ && s.subParts && s.subParts.length > 0) ? s.subParts.length : 1;
                               return (
                                <button key={s.id} onClick={() => { setActiveTabId(s.id); setSelectedTopicFilter('All'); }} className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap flex items-center gap-2 border-2 ${activeTabId === s.id ? 'bg-gold-500 text-black border-gold-500 shadow-md scale-105' : 'bg-surface-800 text-theme-text-muted border-surface-700 hover:border-gold-500'}`}>
                                  {s.title}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${activeTabId === s.id ? 'bg-black/20 text-black' : 'bg-surface-900 text-gold-500'}`}>
                                    { isMCQ ? (sectionSelections[s.id] || []).length : Math.floor((sectionSelections[s.id] || []).length / partsMultiplier) }/{s.questionCount}
                                  </span>
                                </button>
                               )
                            })}
                        </div>
                        {activeSection && activeSection.type.toUpperCase() !== 'MCQ' && !(activeSection.subParts && activeSection.subParts.length > 0) && (
                          <div className="bg-surface-900 border-b border-surface-700 p-2 overflow-x-auto custom-scrollbar flex items-center gap-2 no-scrollbar">
                             <div className="flex items-center gap-2 px-3 text-gold-500/50 border-r border-surface-700 mr-1 shrink-0"><Tag size={14} /><span className="text-[10px] font-black uppercase tracking-tighter">Topics</span></div>
                             {currentSectionTopics.map(topic => {
                               const hasSelection = isTopicActiveInSelection(topic);
                               return (<button key={topic} onClick={() => setSelectedTopicFilter(topic)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all border flex items-center gap-1.5 ${selectedTopicFilter === topic ? 'bg-gold-500 text-black border-gold-500' : hasSelection ? 'bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30' : 'bg-surface-800 text-theme-text-muted border-surface-700 hover:border-gold-500'}`}>{hasSelection && <Check size={10} className="stroke-[4]" />}{topic}</button>);
                             })}
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 p-2 bg-surface-800/95 backdrop-blur-md">
                          <button onClick={triggerAutoSelect} className="bg-surface-900 border border-gold-500/50 hover:bg-gold-500 hover:text-black text-gold-500 p-2 rounded-lg flex flex-col items-center gap-1 transition-all group"><Wand2 size={18} className="group-hover:scale-110 transition-transform" /><span className="text-[9px] font-bold uppercase tracking-tighter">Auto</span></button>
                          <button onClick={() => {}} className="bg-surface-900 border border-surface-700 hover:border-gold-500 text-theme-text-main p-2 rounded-lg flex flex-col items-center gap-1 transition-all group"><Fingerprint size={18} className="group-hover:scale-110 transition-transform text-gold-500" /><span className="text-[9px] font-bold uppercase tracking-tighter">Manual</span></button>
                          <button onClick={clearCurrentTab} className="bg-surface-900 border border-surface-700 hover:border-red-500 text-red-400 p-2 rounded-lg flex flex-col items-center gap-1 transition-all group"><Eraser size={18} className="group-hover:scale-110 transition-transform" /><span className="text-[9px] font-bold uppercase tracking-tighter">Clear</span></button>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-surface-900/20 pb-32">
                        {isLoadingQuestions ? <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto text-gold-500" size={32} /></div> : (
                            activeSection && (activeSection.subParts && activeSection.subParts.length > 0) && activeSection.type.toUpperCase() !== 'MCQ' ? (
                                <div className="space-y-8">
                                    {Array.from({ length: activeSection.questionCount }).map((_, unitIdx) => (
                                      <div key={unitIdx} className="animate-fadeIn bg-surface-800/50 border border-surface-700 rounded-2xl p-5 shadow-inner">
                                        <div className="flex items-center gap-3 mb-4">
                                          <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center font-black text-black text-sm">
                                            {unitIdx + 1}
                                          </div>
                                          <h3 className="text-sm font-black text-theme-text-main uppercase tracking-widest">Question Block</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          {activeSection.subParts!.map((part, pIdx) => (
                                            renderQuestionSlot(unitIdx, pIdx, part.label, part.type, part.specificChapters)
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                            ) : activeSection && activeSection.type.toUpperCase() === 'MCQ' && (activeSection.subParts && activeSection.subParts.length > 0) ? (
                              <div className="space-y-6">
                                  {activeSection.subParts.map((part, pIdx) => {
                                      const selectionForSection = sectionSelections[activeTabId!] || [];
                                      let offset = 0;
                                      for(let j=0; j<pIdx; j++) offset += (activeSection.subParts![j].questionCount || 0);
                                      const partIds = selectionForSection.slice(offset, offset + (part.questionCount || 0));
                                      return (
                                        <div key={pIdx} className="space-y-3 animate-fadeIn border-l-2 border-gold-500/20 pl-4 mb-8">
                                          <div className="bg-surface-700/50 px-4 py-2 border-b border-gold-500/20 flex justify-between items-center rounded-xl">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black uppercase text-gold-500 tracking-widest">{part.type} / {part.label.substring(0, 15)}...</span>
                                            </div>
                                            <span className="text-[9px] bg-gold-500 text-black px-2 py-0.5 rounded-full font-bold">{partIds.length} / {part.questionCount} Selected</span>
                                          </div>
                                          <div className="italic text-theme-text-muted text-[11px] px-4 py-1">{part.label}</div>
                                          {questionPool.filter(q => matchesType(q.type, part.type || activeSection.type)).map(q => {
                                              const isSelected = partIds.includes(q.id);
                                              return (
                                                <div key={q.id} onClick={() => {
                                                    const currentIds = [...(sectionSelections[activeTabId!] || [])];
                                                    const exists = partIds.includes(q.id);
                                                    if (exists) {
                                                      const globalIdx = currentIds.indexOf(q.id);
                                                      if (globalIdx > -1) {
                                                        currentIds.splice(globalIdx, 1);
                                                        setSectionSelections(prev => ({ ...prev, [activeTabId!]: currentIds }));
                                                      }
                                                    } else {
                                                      if (partIds.length >= (part.questionCount || 0)) {
                                                        alert(`Slot Full! Limit: ${part.questionCount}`);
                                                        return;
                                                      }
                                                      currentIds.splice(offset + partIds.length, 0, q.id);
                                                      setSectionSelections(prev => ({ ...prev, [activeTabId!]: currentIds }));
                                                    }
                                                }} className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${isSelected ? 'border-gold-500 bg-gold-500/10' : 'border-surface-700 bg-surface-800/40 hover:border-surface-500'}`}>
                                                    <div className="flex items-start gap-3">
                                                      {isSelected ? <CheckSquare className="text-gold-500 shrink-0 mt-0.5" size={22} /> : <Square className="text-theme-text-muted shrink-0 mt-0.5" size={22} />}
                                                      <div className="flex-grow">
                                                          <p className="text-[12px] text-theme-text-main font-medium whitespace-pre-wrap">{renderFormattedPreview(q.text)}</p>
                                                          {q.textUrdu && <p className="text-[12px] text-right text-theme-text-muted font-urdu mt-2 whitespace-pre-wrap" dir="rtl">{renderFormattedPreview(q.textUrdu)}</p>}
                                                      </div>
                                                    </div>
                                                    {renderMCQOptionsSelection(q)}
                                                </div>
                                              );
                                          })}
                                        </div>
                                      )
                                   })}
                              </div>
                            ) : (
                                <div className="space-y-3">
                                  {questionPool.filter(q => {
                                      const typeMatch = activeSection && matchesType(q.type, activeSection.type);
                                      if (!typeMatch) return false;
                                      if (selectedTopicFilter !== 'All') {
                                        const topic = q.subtopic || 'General';
                                        if (topic !== selectedTopicFilter) return false;
                                      }
                                      return true;
                                    }).map(q => {
                                      const isSelected = activeTabId ? (sectionSelections[activeTabId] || []).includes(q.id) : false;
                                      const isMCQ = q.type === 'MCQ' || matchesType(q.type, 'MCQ');
                                      return (
                                        <div key={q.id} onClick={() => {
                                            if (!activeTabId) return;
                                            const currentIds = sectionSelections[activeTabId] || [];
                                            const exists = currentIds.includes(q.id);
                                            if (exists) setSectionSelections(prev => ({ ...prev, [activeTabId]: currentIds.filter(id => id !== q.id) }));
                                            else {
                                              if (activeSection && currentIds.length >= activeSection.questionCount) { alert("Selection Limit Reached"); return; }
                                              setSectionSelections(prev => ({ ...prev, [activeTabId]: [...currentIds, q.id] }));
                                            }
                                        }} className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${isSelected ? 'border-gold-500 bg-gold-500/10 shadow-sm' : 'border-surface-700 bg-surface-800/40 hover:border-surface-500'}`}>
                                            <div className="flex items-start gap-3">
                                              {isSelected ? <CheckSquare className="text-gold-500 shrink-0 mt-0.5" size={22} /> : <Square className="text-theme-text-muted shrink-0 mt-0.5" size={22} />}
                                              <div className="flex-grow">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  <div>
                                                    <p className="text-xs sm:text-sm text-theme-text-main leading-snug font-medium whitespace-pre-wrap">{renderFormattedPreview(q.text)}</p>
                                                    {q.subtopic && <p className={`text-[8px] text-theme-text-muted mt-1 uppercase tracking-widest font-black border-t border-surface-700/50 pt-1 inline-block ${isUrduPaper ? 'font-urdu' : ''}`}>Topic: {renderFormattedPreview(q.subtopic)}</p>}
                                                  </div>
                                                  {q.textUrdu && (<div className="border-t md:border-t-0 md:border-l border-surface-700/50 pt-2 md:pt-0 md:pl-4"><p className="text-lg text-right text-theme-text-main leading-relaxed font-urdu whitespace-pre-wrap" dir="rtl">{renderFormattedPreview(q.textUrdu)}</p></div>)}
                                                </div>
                                              </div>
                                            </div>
                                            {isMCQ && renderMCQOptionsSelection(q)}
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
                     <div className="bg-surface-800 border-2 border-gold-500/50 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
                        <div className="p-6 border-b border-surface-700">
                           <div className="flex justify-between items-start">
                             <div>
                                <h3 className="text-xl font-bold text-theme-text-main uppercase tracking-tighter">Choose Part Replacement</h3>
                                <p className="text-xs text-theme-text-muted mt-1">Replacing Unit {swappingSlot.unitIndex + 1}, Part {String.fromCharCode(97 + swappingSlot.partIndex)}</p>
                             </div>
                             <button onClick={() => setSwappingSlot(null)} className="p-2 text-theme-text-muted hover:text-white"><X size={24} /></button>
                           </div>
                        </div>
                        <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar bg-surface-900/30">
                           {currentSwappingPool.length === 0 ? (
                             <div className="p-20 text-center text-theme-text-muted flex flex-col items-center">
                               <AlertTriangle size={48} className="opacity-20 mb-4" />
                               <p className="font-black uppercase tracking-widest text-[10px]">No questions found matching this part's criteria.</p>
                             </div>
                           ) : (
                             currentSwappingPool.map(q => {
                                const isAlreadyInSection = (sectionSelections[swappingSlot.sectionId] || []).includes(q.id);
                                const isMCQ = q.type === 'MCQ' || matchesType(q.type, 'MCQ');
                                return (
                                  <div key={q.id} onClick={() => !isAlreadyInSection && swapQuestionPart(q.id)} className={`p-4 rounded-xl border transition-all ${isAlreadyInSection ? 'opacity-30 border-surface-700 cursor-not-allowed grayscale' : 'border-surface-700 bg-surface-800/60 cursor-pointer hover:border-gold-500 group shadow-md'}`}>
                                     <div className="flex items-start justify-between gap-4">
                                        <div className="flex-grow">
                                           <p className="text-[13px] text-theme-text-main leading-snug font-medium whitespace-pre-wrap">{renderFormattedPreview(q.text)}</p>
                                           {q.textUrdu && <p className="text-[12px] text-right text-theme-text-muted font-urdu mt-2 whitespace-pre-wrap" dir="rtl">{renderFormattedPreview(q.textUrdu)}</p>}
                                           <div className="mt-2 flex items-center gap-2">
                                              <span className="text-[8px] bg-surface-900 text-theme-text-muted px-1.5 py-0.5 rounded font-bold uppercase border border-surface-700">{q.type}</span>
                                              {q.subtopic && <span className="text-[8px] text-theme-text-muted font-bold">/ {q.subtopic}</span>}
                                           </div>
                                           {isMCQ && renderMCQOptionsSelection(q)}
                                        </div>
                                        <div className={`shrink-0 p-1 rounded-full border ${isAlreadyInSection ? 'border-surface-700 text-surface-700' : 'border-gold-500/20 text-gold-500 group-hover:bg-gold-500 group-hover:text-black transition-all'}`}>
                                           {isAlreadyInSection ? <Check size={14} /> : <MousePointer2 size={14} />}
                                        </div>
                                     </div>
                                  </div>
                                );
                             })
                           )}
                        </div>
                        <div className="p-4 border-t border-surface-700 bg-surface-900/30 flex justify-end"><Button variant="secondary" onClick={() => setSwappingSlot(null)} className="!w-auto px-6">Cancel Selection</Button></div>
                     </div>
                  </div>
                )}
            </div>
          )}

          {step === 6 && (
            <div className="animate-fadeIn flex flex-col items-center">
                <h2 className="text-2xl font-bold text-theme-text-main mb-8 uppercase tracking-widest">Select Medium</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl">
                    {['English', 'Urdu', 'Both'].map(m => (
                        <div key={m} onClick={() => { setSelectedMedium(m as any); handleNext(); }} className={`bg-surface-800 border-2 rounded-2xl p-8 text-center cursor-pointer transition-all hover:-translate-y-1 ${selectedMedium === m ? 'border-gold-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-surface-700 shadow-md'}`}>
                            <FileType className="mx-auto text-gold-500 mb-4" size={48} />
                            <span className="font-bold text-theme-text-main text-xl uppercase tracking-tighter">{m}</span>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {step === 7 && (
            <div className="animate-fadeIn space-y-4 h-full flex flex-col relative">
               <div className="bg-surface-800 p-4 sm:p-8 rounded-xl overflow-auto border border-surface-700 flex-grow print:p-0 print:bg-white print:border-none">
                  <div className="mx-auto shadow-2xl print:shadow-none w-full max-w-[210mm] transition-all relative group/paper" style={{ minHeight: '297mm', color: '#000000', backgroundColor: '#ffffff' }}>
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