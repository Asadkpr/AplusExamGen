import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { Input } from './Input'; 
import { CLASSES, SUBJECTS_BY_CLASS, CARD_COLORS } from '../constants';
import { getSubjects } from '../services/subjectService';
import { getChapters } from '../services/chapterService';
import { getPatterns, getPatternsByClassAndSubject } from '../services/patternService';
import { getQuestionsForChapters } from '../services/questionService';
import { BubbleSheetPosition, Chapter, QuestionType, Question, PaperPatternSection, User, PaperPattern, Subtopic, SavedPaper, PaperPatternSectionPart } from '../types';
import { savePaper, updatePaper } from '../services/paperService';
import { PrintablePaper } from './PrintablePaper';
import { CustomPatternModal } from './CustomPatternModal';
import { sortSectionsByStandardSequence } from './PaperPatterns';
import { useBackHandler, pushBackGuard } from '../services/backNavigationService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  ArrowLeft, CheckSquare, Square, ChevronRight, ChevronDown, CheckCircle, 
  Printer, RefreshCw, AlertCircle, Save, GraduationCap, 
  FileText, Check, Plus, Trash2, Download, Wand2, Fingerprint,
  Eraser, FileType, FileDown, Key, Database, Home, Type as TypeIcon, Layout, Layers,
  Shuffle, Repeat, MoreVertical, X, AlignJustify, Settings, Lock, ListFilter,
  Tag, AlertTriangle, BookOpen, Search, MousePointer2, Scissors, Sliders, Sparkles, Clock
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
  { num: 3, label: "Chapters" },
  { num: 4, label: "Pattern" },
  { num: 5, label: "Questions" },
  { num: 6, label: "Medium" },
  { num: 7, label: "Preview" },
];

const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text || '');

const isUrduStyleSubject = (subject: string) => {
  const s = (subject || '').toLowerCase();
  return s.includes('urdu') || s.includes('islam') || s.includes('pak study') || s.includes('pak studies') || s.includes('arab') || s.includes('per');
};

const isEnglishSubject = (subject: string) => {
  return (subject || '').toLowerCase().includes('english');
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
    <span className={`${isUrdu ? 'font-urdu text-right block' : ''} whitespace-pre-wrap`} dir={isUrdu ? 'rtl' : 'ltr'}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-gold-500 font-bold [.light-theme_&]:text-gold-700">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('++') && part.endsWith('++')) {
          return <u key={i} className="underline decoration-gold-500/40 [.light-theme_&]:decoration-gold-500/60">{part.slice(2, -2)}</u>;
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
    return 'bg-gold-500/20 text-gold-400 border-gold-500/40 ring-gold-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)] [.light-theme_&]:bg-gold-100 [.light-theme_&]:text-gold-700 [.light-theme_&]:border-gold-200';
  }
  
  // 🔹 OBJECTIVE / GRAMMAR (BLUE)
  if (upper === 'MCQ' || ['VERB', 'SPELLING', 'MEANING', 'GRAMMAR', 'SYNONYM'].some(t => upper.includes(t))) {
    return 'bg-blue-500/20 text-blue-300 border-blue-500/40 ring-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)] [.light-theme_&]:bg-blue-100 [.light-theme_&]:text-blue-700 [.light-theme_&]:border-blue-200';
  }
  
  // 🔹 CONCEPTUAL / SHORT (EMERALD)
  if (upper.includes('SHORT')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.1)] [.light-theme_&]:bg-emerald-100 [.light-theme_&]:text-emerald-700 [.light-theme_&]:border-emerald-200';
  }
  
  // 🔹 THEORY / LONG (PURPLE)
  if (upper.includes('LONG') || upper.includes('THEORY')) {
    return 'bg-purple-500/20 text-purple-300 border-purple-500/40 ring-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.1)] [.light-theme_&]:bg-purple-100 [.light-theme_&]:text-purple-700 [.light-theme_&]:border-purple-200';
  }
  
  // 🔹 APPLIED / MATH (ORANGE)
  if (upper.includes('NUMERICAL') || upper.includes('PROBLEM') || upper.includes('CALC')) {
    return 'bg-orange-500/20 text-orange-300 border-orange-500/40 ring-orange-500/10 shadow-[0_0_10px_rgba(249,115,22,0.1)] [.light-theme_&]:bg-orange-100 [.light-theme_&]:text-orange-700 [.light-theme_&]:border-orange-200';
  }
  
  // 🔹 CREATIVE WRITING (ROSE)
  if (['ESSAY', 'LETTER', 'STORY', 'DIALOGUE', 'APPLICATION'].some(t => upper.includes(t))) {
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.1)] [.light-theme_&]:bg-rose-100 [.light-theme_&]:text-rose-700 [.light-theme_&]:border-rose-200';
  }
  
  // 🔹 COMPREHENSION / ANALYSIS (CYAN)
  if (['TRANSLATE', 'SUMMARY', 'PARAPHRASE', 'PASSAGE', 'VOICE', 'COMPREHENSION'].some(t => upper.includes(t))) {
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 ring-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.1)] [.light-theme_&]:bg-cyan-100 [.light-theme_&]:text-cyan-700 [.light-theme_&]:border-cyan-200';
  }
  
  // 🔹 VOCABULARY / OTHER (AMBER)
  if (['IDIOMS', 'SENTENCES', 'ALTERNATE', 'PAIR', 'PUNCTUATION'].some(t => upper.includes(t))) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)] [.light-theme_&]:bg-amber-100 [.light-theme_&]:text-amber-700 [.light-theme_&]:border-amber-200';
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
  const [isSavingPaper, setIsSavingPaper] = useState(false);
  
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
  const [lineSpacing, setLineSpacing] = useState(0); // -10 to 10 scale, 0 is compact default
  const [headerStyle, setHeaderStyle] = useState<'default' | 'sba' | 'layout3' | 'layout4' | 'layout5' | 'layout6' | 'layout7' | 'layout8'>('default');
  const [pageBreakAfterMCQ, setPageBreakAfterMCQ] = useState(false);
  const [bubbleSheetPosition, setBubbleSheetPosition] = useState<BubbleSheetPosition>('above_mcq');
  
  // 🔹 Custom Pattern Modal State
  const [showCustomPatternModal, setShowCustomPatternModal] = useState(false);
  
  // 🔹 Improved State for instant subject loading
  const [subjectsMap, setSubjectsMap] = useState<Record<string, string[]>>(SUBJECTS_BY_CLASS || {});
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  
  const [sectionSelections, setSectionSelections] = useState<Record<string, string[]>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('All');
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [isSmartSkipping, setIsSmartSkipping] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [mandatoryChapterIds, setMandatoryChapterIds] = useState<string[]>([]);
  const [saveStatusMessage, setSaveStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savedPaperId, setSavedPaperId] = useState<string | null>(initialPaper?.id || null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = React.useRef<HTMLDivElement>(null);
  const previewOuterRef = React.useRef<HTMLDivElement>(null);
  const previewScalerRef = React.useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  useEffect(() => {
    if (step !== 7) return;
    const A4_WIDTH_PX = 794;

    const updateScale = () => {
      const outer = previewOuterRef.current;
      const scaler = previewScalerRef.current;
      if (!outer || !scaler) return;

      const availableWidth = outer.clientWidth;
      if (availableWidth > 0 && availableWidth < A4_WIDTH_PX) {
        const nextScale = availableWidth / A4_WIDTH_PX;
        setPreviewScale(nextScale);
        setScaledHeight(Math.ceil(scaler.scrollHeight * nextScale));
      } else {
        setPreviewScale(1);
        setScaledHeight(null);
      }
    };

    const t1 = setTimeout(updateScale, 30);
    const t2 = setTimeout(updateScale, 250);
    window.addEventListener('resize', updateScale);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateScale);
      if (previewOuterRef.current) observer.observe(previewOuterRef.current);
      if (previewScalerRef.current) observer.observe(previewScalerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateScale);
      if (observer) observer.disconnect();
    };
  }, [step, fontSize, lineSpacing, selectedMedium, showAnswerKey, headerStyle, pageBreakAfterMCQ, bubbleSheetPosition, sectionSelections]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [swappingSlot, setSwappingSlot] = useState<{ 
    sectionId: string; 
    unitIndex: number; 
    partIndex: number;
    partType?: string;
    partChapters?: string[];
  } | null>(null);

  useEffect(() => {
    pushBackGuard();
  }, [step, showCustomPatternModal, swappingSlot]);

  useBackHandler(() => {
    if (showCustomPatternModal) {
      setShowCustomPatternModal(false);
      return true;
    }
    if (swappingSlot) {
      setSwappingSlot(null);
      return true;
    }
    if (isActionsMenuOpen) {
      setIsActionsMenuOpen(false);
      return true;
    }
    if (step > 1) {
      setStep(prev => prev - 1);
      return true;
    }
    onBack();
    return true;
  });

  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';
  const isUrduPaper = isUrduStyleSubject(selectedSubject);
  const isEnglish = isEnglishSubject(selectedSubject);

  // 🔹 Pre-fetch all subjects on mount for instant loading (quota-safe cached fetch)
  useEffect(() => {
    const preFetchSubjects = async () => {
      try {
        const allSubjects = await getSubjects(false);
        setSubjectsMap(allSubjects);
      } finally {
        setIsInitialLoad(false);
      }
    };
    preFetchSubjects();
  }, []);

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
      setFontSize(Math.max(8, Math.min(paper.fontSize || 13, 20)));
      setLineSpacing(paper.lineSpacing !== undefined && paper.lineSpacing !== 2 ? paper.lineSpacing : 0);
      setPaperTime(paper.timeAllowed || '2:00 Hours');
      setPaperCode(paper.paperCode || '');
      setPageBreakAfterMCQ(Boolean(paper.pageBreakAfterMCQ));
      if (paper.headerStyle) setHeaderStyle(paper.headerStyle);
      if (paper.bubbleSheetPosition) setBubbleSheetPosition(paper.bubbleSheetPosition);
      
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
      setStep(3);
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
    if (selectedSubject && selectedClass) {
      const loadAsyncData = async () => {
        setIsLoadingChapters(true);
        setIsLoadingPatterns(true);
        
        try {
          const chapters = await getChapters(selectedSubject, selectedClass, !isAdmin);
          setAvailableChapters(chapters);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingChapters(false);
        }

        try {
          const filtered = await getPatternsByClassAndSubject(selectedClass, selectedSubject);
          setAvailablePatterns(filtered);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingPatterns(false);
        }

        if (isSmartSkipping) {
          setStep(3);
          setIsSmartSkipping(false);
        }
      };
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
    getSubjects(true).then(allSubjects => setSubjectsMap(allSubjects)).catch(() => {});
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

  const normalizeTypeKey = (t: string) => {
    const upper = (t || '').toUpperCase().trim();
    if (!upper) return '';
    if (['MCQ', 'MCQS', 'MULTIPLE CHOICE', 'OBJECTIVE', 'معروضی', 'کثیر'].some(k => upper.includes(k.toUpperCase()))) return 'MCQ';
    if (['SHORT', 'مختصر'].some(k => upper.includes(k.toUpperCase()))) return 'SHORT';
    if (['LONG', 'THEORY', 'تفصیلی', 'انشائیہ'].some(k => upper.includes(k.toUpperCase()))) return 'LONG';
    if (['NUMERICAL', 'PROBLEM', 'حسابی', 'عددی'].some(k => upper.includes(k.toUpperCase()))) return 'NUMERICAL';
    if (['TRANSLAT', 'ترجمہ'].some(k => upper.includes(k.toUpperCase()))) return 'TRANSLATION';
    if (['SUMMAR', 'خلاصہ', 'مرکزی خیال'].some(k => upper.includes(k.toUpperCase()))) return 'SUMMARY';
    if (['ESSAY', 'مضمون'].some(k => upper.includes(k.toUpperCase()))) return 'ESSAY';
    if (['LETTER', 'خط'].some(k => upper.includes(k.toUpperCase()))) return 'LETTER';
    if (['APPLICATION', 'درخواست'].some(k => upper.includes(k.toUpperCase()))) return 'APPLICATION';
    if (['STORY', 'کہانی'].some(k => upper.includes(k.toUpperCase()))) return 'STORY';
    if (['DIALOGUE', 'مکالمہ'].some(k => upper.includes(k.toUpperCase()))) return 'DIALOGUE';
    if (['تشریح'].some(k => upper.includes(k.toUpperCase()))) return 'تشریح';
    if (['IDIOM', 'محاورات'].some(k => upper.includes(k.toUpperCase()))) return 'IDIOMS';
    if (['PAIR', 'الفاظ معنی'].some(k => upper.includes(k.toUpperCase()))) return 'PAIR';
    return upper;
  };

  const matchesType = (questionType: string, patternType: string) => {
    const qT = (questionType || "").toUpperCase().trim();
    const pT = (patternType || "").toUpperCase().trim();
    if (qT === pT) return true;

    const normQ = normalizeTypeKey(qT);
    const normP = normalizeTypeKey(pT);
    if (normQ && normP && normQ === normP) return true;

    if (isEnglish) {
       if (normP === 'MCQ' && ['VERB', 'SPELLING', 'MEANING', 'GRAMMAR'].includes(qT)) return true;
       if (normP === 'DIALOGUE' && qT === 'DIALOGUE') return true;
       if (pT.includes(qT) || qT.includes(pT)) return true;
    }
    return false;
  };

  const triggerAutoSelect = () => {
    const sectionsToUse = originalSections.length > 0 ? originalSections : effectiveSections;
    const newSelections: Record<string, string[]> = {};
    const usedQuestionIds = new Set<string>();
    
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
           const available = partPool.filter(q => 
             matchesType(q.type, part.type || section.type) && 
             !selectionForThisSection.includes(q.id) &&
             !usedQuestionIds.has(q.id)
           );
           const fallbackPool = available.length >= (part.questionCount || 0)
             ? available
             : partPool.filter(q => matchesType(q.type, part.type || section.type) && !selectionForThisSection.includes(q.id));

           for(let k=0; k < (part.questionCount || 0); k++) {
              const random = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
              if (random) {
                selectionForThisSection.push(random.id);
                usedQuestionIds.add(random.id);
                fallbackPool.splice(fallbackPool.indexOf(random), 1);
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
              const available = partPool.filter(q => 
                matchesType(q.type, targetType) && 
                !selectionForThisSection.includes(q.id) &&
                !usedQuestionIds.has(q.id)
              );
              const pickPool = available.length > 0 ? available : partPool.filter(q => matchesType(q.type, targetType) && !selectionForThisSection.includes(q.id));
              const random = pickPool[Math.floor(Math.random() * pickPool.length)];
              if (random) {
                selectionForThisSection.push(random.id);
                usedQuestionIds.add(random.id);
              }
            });
          } else {
            const available = sectionPool.filter(q => 
              matchesType(q.type, section.type) && 
              !selectionForThisSection.includes(q.id) &&
              !usedQuestionIds.has(q.id)
            );
            const pickPool = available.length > 0 ? available : sectionPool.filter(q => matchesType(q.type, section.type) && !selectionForThisSection.includes(q.id));
            const random = pickPool[Math.floor(Math.random() * pickPool.length)];
            if (random) {
              selectionForThisSection.push(random.id);
              usedQuestionIds.add(random.id);
            }
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

  const initializeQuestionSelection = async (forceBypassCache: boolean = false, overrideSections?: PaperPatternSection[]) => {
    setIsLoadingQuestions(true);
    let pool = await getQuestionsForChapters(selectedSubject, availableChapters, selectedChapters, forceBypassCache);
    if (selectedSubtopics.length > 0) {
      pool = pool.filter(q => q.subtopic && selectedSubtopics.includes(q.subtopic));
    }
    setQuestionPool(pool);
    
    const sectionsToUse = overrideSections || (originalSections.length > 0 ? originalSections : effectiveSections);
    if (sectionsToUse.length > 0) {
      setActiveTabId(sectionsToUse[0].id);
      
      const newSelections: Record<string, string[]> = {};
      const usedQuestionIds = new Set<string>();

      if (autoSelectQuestions) {
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
               const available = partPool.filter(q => 
                 matchesType(q.type, part.type || section.type) && 
                 !selectionForThisSection.includes(q.id) &&
                 !usedQuestionIds.has(q.id)
               );
               const fallbackPool = available.length >= (part.questionCount || 0)
                 ? available
                 : partPool.filter(q => matchesType(q.type, part.type || section.type) && !selectionForThisSection.includes(q.id));

               for(let k=0; k < (part.questionCount || 0); k++) {
                  const random = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
                  if (random) {
                    selectionForThisSection.push(random.id);
                    usedQuestionIds.add(random.id);
                    fallbackPool.splice(fallbackPool.indexOf(random), 1);
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
                  const available = partPool.filter(q => 
                    matchesType(q.type, targetType) && 
                    !selectionForThisSection.includes(q.id) &&
                    !usedQuestionIds.has(q.id)
                  );
                  const pickPool = available.length > 0 ? available : partPool.filter(q => matchesType(q.type, targetType) && !selectionForThisSection.includes(q.id));
                  const random = pickPool[Math.floor(Math.random() * pickPool.length)];
                  if (random) {
                    selectionForThisSection.push(random.id);
                    usedQuestionIds.add(random.id);
                  }
                });
              } else {
                const available = sectionPool.filter(q => 
                  matchesType(q.type, section.type) && 
                  !selectionForThisSection.includes(q.id) &&
                  !usedQuestionIds.has(q.id)
                );
                const pickPool = available.length > 0 ? available : sectionPool.filter(q => matchesType(q.type, section.type) && !selectionForThisSection.includes(q.id));
                const random = pickPool[Math.floor(Math.random() * pickPool.length)];
                if (random) {
                  selectionForThisSection.push(random.id);
                  usedQuestionIds.add(random.id);
                }
              }
            }
          }
          newSelections[section.id] = selectionForThisSection;
        });
        setSectionSelections(newSelections);
      } else {
        sectionsToUse.forEach(s => newSelections[s.id] = []);
      }
    }
    setIsLoadingQuestions(false);
  };

  const totalSelectedCount = (Object.values(sectionSelections) as string[][]).reduce((acc, curr) => acc + curr.length, 0);

  const handleNext = async () => {
    if (step === 1 && selectedClass) setStep(2);
    else if (step === 2 && selectedSubject) setStep(3);
    else if (step === 3 && selectedChapters.length > 0) setStep(4);
    else if (step === 4 && selectedPatternId) { 
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
      const sortedUpdated = sortSectionsByStandardSequence(updatedSections, isEnglish);
      setEffectiveSections(sortedUpdated);
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

  const handlePatternSelect = async (p: PaperPattern) => {
    const sortedSections = sortSectionsByStandardSequence(p.sections, isEnglish);
    setSelectedPatternId(p.id);
    setOriginalSections(sortedSections);
    setEffectiveSections(sortedSections);
    setPaperTime(p.timeAllowed || '2:00 Hours');
    setSectionSelections({});
    await initializeQuestionSelection(false, sortedSections);
    setTimeout(() => setStep(5), 150);
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

  const selectAllChapters = () => {
    const selectableChapters = availableChapters.filter(ch => ch.subtopics.length > 0);
    const allIds = selectableChapters.map(ch => ch.id);
    setSelectedChapters(allIds);
    const allSubtopicIds = selectableChapters.flatMap(ch => ch.subtopics.map(s => s.id));
    setSelectedSubtopics(allSubtopicIds);
  };

  const deselectAllChapters = () => {
    setSelectedChapters(mandatoryChapterIds);
    const mandatorySubtopicIds = availableChapters
      .filter(ch => mandatoryChapterIds.includes(ch.id))
      .flatMap(ch => ch.subtopics.map(s => s.id));
    setSelectedSubtopics(mandatorySubtopicIds);
  };

  const selectAllSubtopics = (chapterId: string) => {
    const chapter = availableChapters.find(ch => ch.id === chapterId);
    if (!chapter) return;
    const subtopicIds = chapter.subtopics.map(s => s.id);
    setSelectedSubtopics(prev => [...new Set([...prev, ...subtopicIds])]);
  };

  const deselectAllSubtopics = (chapterId: string) => {
    const chapter = availableChapters.find(ch => ch.id === chapterId);
    if (!chapter) return;
    const subtopicIds = chapter.subtopics.map(s => s.id);
    setSelectedSubtopics(prev => prev.filter(id => !subtopicIds.includes(id)));
  };

  const toggleSubtopic = (subtopicId: string, parentChapterId: string) => {
    setSelectedSubtopics(prev => prev.includes(subtopicId) ? prev.filter(id => id !== subtopicId) : [...prev, subtopicId]);
  };

  const executeSave = async (showNotification: boolean = true, customSuccessMsg?: string): Promise<boolean> => {
    if (isSavingPaper) return false;
    setIsSavingPaper(true);
    try {
      const questions = getSelectedQuestions();
      const totalMarks = effectiveSections.reduce((acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 0);
      const paperData = {
        title: `${selectedClass} - ${selectedSubject}`,
        classLevel: selectedClass,
        subject: selectedSubject,
        totalMarks: totalMarks,
        sections: effectiveSections,
        questions: questions,
        instituteProfile: user.instituteProfile || undefined,
        userId: user.id || 'admin',
        createdBy: user.name || 'User',
        selectedChapterIds: selectedChapters || [],
        selectedSubtopicIds: selectedSubtopics || [],
        formattedChapters: getChaptersDisplay() || '',
        medium: selectedMedium || 'English',
        fontSize: fontSize || 13,
        lineSpacing: lineSpacing ?? 0,
        timeAllowed: paperTime || '2:00 Hours',
        paperCode: paperCode || '',
        pageBreakAfterMCQ: Boolean(pageBreakAfterMCQ),
        headerStyle: headerStyle || 'default',
        bubbleSheetPosition: bubbleSheetPosition || 'above_mcq'
      };

      const targetId = savedPaperId || initialPaper?.id;
      let isSuccess = false;
      let msg = '';

      if (targetId) {
        const result = await updatePaper(targetId, paperData);
        isSuccess = result.success;
        msg = result.success ? (customSuccessMsg || "Paper updated successfully! پیپر کامیابی سے اپڈیٹ ہو گیا ہے۔") : (result.message || "Failed to update paper");
      } else {
        const result = await savePaper(paperData);
        isSuccess = result.success;
        if (result.id) {
          setSavedPaperId(result.id);
        }
        msg = result.success ? (customSuccessMsg || "Paper saved successfully! پیپر کامیابی سے محفوظ ہو گیا ہے۔") : (result.message || "Failed to save paper");
      }

      if (showNotification) {
        setSaveStatusMessage({
          type: isSuccess ? 'success' : 'error',
          text: msg
        });
        setTimeout(() => {
          setSaveStatusMessage(null);
        }, 4500);
      }
      return isSuccess;
    } catch (e: any) {
      console.error("Save paper error:", e);
      if (showNotification) {
        setSaveStatusMessage({
          type: 'error',
          text: "Error saving paper: " + (e?.message || "Unknown error")
        });
        setTimeout(() => setSaveStatusMessage(null), 5000);
      }
      return false;
    } finally {
      setIsSavingPaper(false);
    }
  };

  const handlePrint = () => {
    setIsActionsMenuOpen(false);
    const originalTitle = document.title;
    const cleanFileName = `${selectedClass}_${selectedSubject}_Exam_Paper`.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
    document.title = cleanFileName;
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 2000);
    }, 150);
  };

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsActionsMenuOpen(false);
    const cleanFileName = `${selectedClass}_${selectedSubject}_Exam_Paper`.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
    const sourceElement = document.getElementById('printable-section');

    if (!sourceElement) {
      handlePrint();
      return;
    }

    setIsDownloadingPdf(true);
    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;
    let tempWrapper: HTMLDivElement | null = null;

    try {
      // Wait for web fonts (including Urdu Nastaleeq) to finish loading
      if ((document as any).fonts && (document as any).fonts.ready) {
        try {
          await Promise.race([
            (document as any).fonts.ready,
            new Promise(resolve => setTimeout(resolve, 1500))
          ]);
        } catch {
          // ignore font wait errors
        }
      }

      // Create an isolated A4-width render container at (0, 0) behind #root
      const a4DomWidth = 794; // 210mm at 96 DPI
      tempWrapper = document.createElement('div');
      tempWrapper.id = 'pdf-render-sandbox';
      tempWrapper.style.cssText = [
        'position: absolute',
        'top: 0px',
        'left: 0px',
        `width: ${a4DomWidth}px`,
        'background-color: #ffffff',
        'color: #000000',
        'z-index: -10',
        'opacity: 1',
        'visibility: visible',
        'display: block',
        'pointer-events: none',
        'overflow: visible',
        'margin: 0',
        'padding: 0',
        'box-sizing: border-box'
      ].join(';');

      const clonedPaper = sourceElement.cloneNode(true) as HTMLElement;
      clonedPaper.id = 'printable-section-pdf-clone';
      clonedPaper.classList.add('pdf-exporting');
      clonedPaper.style.width = `${a4DomWidth}px`;
      clonedPaper.style.maxWidth = `${a4DomWidth}px`;
      clonedPaper.style.backgroundColor = '#ffffff';
      clonedPaper.style.color = '#000000';
      clonedPaper.style.margin = '0';
      clonedPaper.style.padding = '10px 12px';
      clonedPaper.style.boxSizing = 'border-box';

      // Remove screen-only page boundary banners and print:hidden elements from clone
      clonedPaper.querySelectorAll('.page-boundary-marker, .print\\:hidden, .print-hidden').forEach(el => {
        el.remove();
      });

      // Ensure images inside the cloned paper are ready or safely handled
      const imgs = Array.from(clonedPaper.querySelectorAll('img'));
      imgs.forEach(img => {
        if (img.src && !img.src.startsWith('data:')) {
          img.crossOrigin = 'anonymous';
        }
      });

      tempWrapper.appendChild(clonedPaper);
      document.body.appendChild(tempWrapper);

      // Wait briefly for layout & images in the clone
      await Promise.all(
        imgs.map(
          img =>
            new Promise<void>(resolve => {
              if (img.complete && img.naturalWidth > 0) {
                resolve();
                return;
              }
              const timer = setTimeout(resolve, 1200);
              img.onload = () => {
                clearTimeout(timer);
                resolve();
              };
              img.onerror = () => {
                clearTimeout(timer);
                img.style.display = 'none';
                resolve();
              };
            })
        )
      );

      // Temporarily reset scroll so html2canvas bounding coordinates start at (0, 0)
      window.scrollTo(0, 0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const paperRect = clonedPaper.getBoundingClientRect();
      const domWidth = a4DomWidth;
      const domHeight = Math.max(clonedPaper.scrollHeight, clonedPaper.offsetHeight, Math.ceil(paperRect.height));

      const marginMm = 5;
      const contentWidthMm = 210 - marginMm * 2; // 200mm
      const contentHeightMm = 297 - marginMm * 2; // 287mm
      const maxPageHeightDomPx = domWidth * (contentHeightMm / contentWidthMm);

      // Measure manual page breaks (.page-break-before) and atomic question blocks
      const manualBreakYs: number[] = [];
      clonedPaper.querySelectorAll('.page-break-before').forEach(el => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const relTop = Math.round(r.top - paperRect.top);
        if (relTop > 20 && relTop < domHeight - 10) {
          manualBreakYs.push(relTop);
        }
      });
      manualBreakYs.sort((a, b) => a - b);

      const atomicBlocks: { top: number; bottom: number }[] = [];
      clonedPaper.querySelectorAll('[data-block-id], .break-inside-avoid').forEach(el => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const top = Math.round(r.top - paperRect.top);
        const bottom = Math.round(r.bottom - paperRect.top);
        if (bottom > top && bottom - top < maxPageHeightDomPx * 0.85) {
          atomicBlocks.push({ top, bottom });
        }
      });

      const canvas = await html2canvas(clonedPaper, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: domWidth,
        height: domHeight,
        windowWidth: 1024,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: clonedDoc => {
          const rootEl = clonedDoc.getElementById('root');
          if (rootEl) rootEl.style.display = 'none';
          clonedDoc.body.style.backgroundColor = '#ffffff';
          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
          const fixStyle = clonedDoc.createElement('style');
          fixStyle.textContent = `
            img[width="1"][height="1"],
            body > div > img {
              display: inline !important;
              vertical-align: baseline !important;
            }
            mjx-assistive-mml {
              display: none !important;
            }
          `;
          clonedDoc.head.appendChild(fixStyle);
          const sandbox = clonedDoc.getElementById('pdf-render-sandbox');
          if (sandbox) {
            sandbox.style.zIndex = '99999';
            sandbox.style.opacity = '1';
            sandbox.style.visibility = 'visible';
            sandbox.style.display = 'block';
            sandbox.style.top = '0px';
            sandbox.style.left = '0px';
          }
        }
      });

      // Restore scroll position immediately after canvas capture
      window.scrollTo(savedScrollX, savedScrollY);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const scaleFactor = canvas.width / domWidth;
      const slices: { startY: number; endY: number }[] = [];
      let currentY = 0;

      while (currentY < domHeight - 5) {
        let targetEndY = Math.min(domHeight, currentY + maxPageHeightDomPx);

        // 1. Respect manual page break (.page-break-before)
        const manualBreak = manualBreakYs.find(y => y > currentY + 20 && y <= targetEndY);
        if (manualBreak !== undefined) {
          targetEndY = manualBreak;
        } else if (targetEndY < domHeight) {
          // 2. Avoid slicing through a question block across pages
          const straddling = atomicBlocks.filter(
            b => b.top > currentY + 40 && b.top < targetEndY - 4 && b.bottom > targetEndY + 2
          );
          if (straddling.length > 0) {
            const earliestTop = Math.min(...straddling.map(b => b.top));
            if (earliestTop > currentY + 60) {
              targetEndY = earliestTop - 2;
            }
          }
        }

        if (targetEndY <= currentY) {
          targetEndY = Math.min(domHeight, currentY + maxPageHeightDomPx);
        }

        slices.push({ startY: currentY, endY: targetEndY });
        currentY = targetEndY;
      }

      if (slices.length === 0) {
        slices.push({ startY: 0, endY: domHeight });
      }

      slices.forEach((slice, idx) => {
        const srcY = Math.max(0, Math.round(slice.startY * scaleFactor));
        const srcH = Math.max(1, Math.min(canvas.height - srcY, Math.round((slice.endY - slice.startY) * scaleFactor)));

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;

        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        }

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.96);
        const sliceHeightMm = ((slice.endY - slice.startY) / domWidth) * contentWidthMm;

        if (idx > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWidthMm, Math.min(contentHeightMm, sliceHeightMm));
      });

      pdf.save(`${cleanFileName}.pdf`);

      setSaveStatusMessage({
        type: 'success',
        text: "PDF downloaded successfully! (پی ڈی ایف کامیابی سے ڈاؤن لوڈ ہو گئی ہے)"
      });
      setTimeout(() => setSaveStatusMessage(null), 4000);
    } catch (err) {
      console.error("PDF download error:", err);
      window.scrollTo(savedScrollX, savedScrollY);
      handlePrint();
    } finally {
      if (tempWrapper && tempWrapper.parentNode) {
        tempWrapper.parentNode.removeChild(tempWrapper);
      }
      setIsDownloadingPdf(false);
    }
  };

  const handleSaveOrUpdate = () => executeSave(true);
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
                    <span className="text-[8px] bg-gold-500/10 text-gold-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-gold-500/20 [.light-theme_&]:bg-gold-100 [.light-theme_&]:text-gold-700 [.light-theme_&]:border-gold-200">{question.type}</span>
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

  // 🔹 Derive subjects instantly from map
  const classSubjects = subjectsMap[selectedClass] || [];

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col relative print:bg-white font-sans transition-colors duration-300 tex2jax_process">
      <header className="bg-surface-800 border-b border-surface-700 sticky top-0 z-[100] print:hidden min-h-[60px] sm:min-h-[90px] py-1.5 sm:py-0 flex flex-col justify-center px-2 sm:px-6 shadow-2xl">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-1.5 sm:gap-4">
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button onClick={() => step > 1 ? setStep(step - 1) : onBack()} className="text-theme-text-muted hover:text-gold-500 p-1 sm:p-2 transition-colors flex items-center gap-0.5 sm:gap-1 group">
                  <ArrowLeft size={16} className="sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest hidden sm:inline">Back</span>
                </button>
                <button onClick={onBack} title="Dashboard" className="hidden md:block text-theme-text-muted hover:text-gold-500 p-2 hover:bg-surface-700 rounded-lg transition-all"><Home size={18} /></button>
              </div>

              <div className="flex-grow flex items-center justify-center">
                {step === 7 ? (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 w-full animate-fadeIn">
                    <h2 className="hidden xl:block text-xl font-black text-theme-text-main uppercase tracking-tighter mr-4">Paper Preview</h2>
                    <div className="flex items-center gap-1 sm:gap-2">
                       {/* Font Size Stepper (-) / (+) */}
                       <div className="bg-surface-900/50 border border-surface-700 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 shadow-inner">
                          <span className="text-[8px] sm:text-[9px] text-theme-text-muted font-black uppercase tracking-widest whitespace-nowrap">Font:</span>
                          <div className="flex items-center bg-surface-800 border border-surface-700 rounded-md sm:rounded-lg overflow-hidden">
                             <button
                               type="button"
                               onClick={() => setFontSize(prev => Math.max(8, prev - 1))}
                               disabled={fontSize <= 8}
                               className="w-5 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-black text-theme-text-main hover:bg-gold-500 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed select-none"
                               title="Decrease Font Size (-)"
                             >
                               -
                             </button>
                             <span className="px-1 sm:px-2 text-[9px] sm:text-[11px] font-black text-theme-text-main min-w-[24px] sm:min-w-[34px] text-center select-none">
                               {fontSize}px
                             </span>
                             <button
                               type="button"
                               onClick={() => setFontSize(prev => Math.min(20, prev + 1))}
                               disabled={fontSize >= 20}
                               className="w-5 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-black text-theme-text-main hover:bg-gold-500 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed select-none"
                               title="Increase Font Size (+)"
                             >
                               +
                             </button>
                          </div>
                       </div>

                       {/* Line Spacing Stepper (-) / (+) */}
                       <div className="bg-surface-900/50 border border-surface-700 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 shadow-inner">
                          <span className="text-[8px] sm:text-[9px] text-theme-text-muted font-black uppercase tracking-widest whitespace-nowrap">Space:</span>
                          <div className="flex items-center bg-surface-800 border border-surface-700 rounded-md sm:rounded-lg overflow-hidden">
                             <button
                               type="button"
                               onClick={() => setLineSpacing(prev => Math.max(-10, prev - 1))}
                               disabled={lineSpacing <= -10}
                               className="w-5 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-black text-theme-text-main hover:bg-gold-500 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed select-none"
                               title="Decrease Line Spacing (-)"
                             >
                               -
                             </button>
                             <span className="px-1 sm:px-2 text-[9px] sm:text-[11px] font-black text-theme-text-main min-w-[18px] sm:min-w-[28px] text-center select-none">
                               {lineSpacing}
                             </span>
                             <button
                               type="button"
                               onClick={() => setLineSpacing(prev => Math.min(10, prev + 1))}
                               disabled={lineSpacing >= 10}
                               className="w-5 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-black text-theme-text-main hover:bg-gold-500 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed select-none"
                               title="Increase Line Spacing (+)"
                             >
                               +
                             </button>
                          </div>
                       </div>

                       {/* Header Style */}
                       <div className="bg-surface-900/50 border border-surface-700 pl-3 pr-1 py-1 rounded-xl flex items-center gap-2 shadow-inner hidden md:flex">
                          <span className="text-[9px] text-theme-text-muted font-black uppercase tracking-widest whitespace-nowrap">Header:</span>
                          <select value={headerStyle} onChange={(e) => setHeaderStyle(e.target.value as any)} className="bg-surface-800 border border-surface-700 text-theme-text-main text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-gold-500/50 transition-all cursor-pointer">
                            <option value="default">Default</option>
                            <option value="sba">SBA</option>
                            <option value="layout3">Layout 3</option>
                            <option value="layout4">Layout 4</option>
                            <option value="layout5">Layout 5</option>
                            <option value="layout6">Layout 6</option>
                            <option value="layout7">Layout 7</option>
                            <option value="layout8">Layout 8</option>
                          </select>
                       </div>

                       {/* Bubble Sheet Placement */}
                       <div className="bg-surface-900/50 border border-surface-700 pl-1.5 sm:pl-3 pr-1 py-0.5 sm:py-1 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-2 shadow-inner">
                          <span className="text-[8px] sm:text-[9px] text-theme-text-muted font-black uppercase tracking-widest whitespace-nowrap">Bubble:</span>
                          <select
                            value={bubbleSheetPosition}
                            onChange={(e) => setBubbleSheetPosition(e.target.value as BubbleSheetPosition)}
                            className="bg-surface-800 border border-surface-700 text-theme-text-main text-[9px] sm:text-[11px] font-bold rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 outline-none focus:ring-1 focus:ring-gold-500/50 transition-all cursor-pointer"
                            title="Select MCQ Bubble Sheet Position"
                          >
                            <option value="above_mcq">Above MCQs</option>
                            <option value="below_mcq">Below MCQs</option>
                            <option value="paper_end">End of Paper</option>
                            <option value="none">Off / Hide</option>
                          </select>
                       </div>
                    </div>
                    {/* Direct Save Button */}
                    <Button 
                      onClick={() => executeSave(true)} 
                      disabled={isSavingPaper}
                      variant="primary" 
                      className="!w-auto !h-7 sm:!h-9 !py-0.5 sm:!py-1.5 !px-2.5 sm:!px-4 !text-[8px] sm:!text-[11px] flex items-center font-black shadow-lg whitespace-nowrap bg-gold-500 hover:bg-gold-400 text-black border-none"
                      title="Save this exam paper to database"
                    >
                      <Save size={13} className={`mr-1 sm:mr-1.5 sm:w-3.5 sm:h-3.5 ${isSavingPaper ? 'animate-spin' : ''}`} /> 
                      <span>{isSavingPaper ? 'Saving...' : (savedPaperId || initialPaper ? 'Update Paper' : 'Save Paper')}</span>
                    </Button>

                    {/* Direct Print Button */}
                    <Button 
                      onClick={handlePrint} 
                      disabled={isSavingPaper || isDownloadingPdf}
                      variant="secondary" 
                      className="!w-auto !h-7 sm:!h-9 !py-0.5 sm:!py-1.5 !px-2 sm:!px-3 !text-[8px] sm:!text-[10px] flex items-center font-bold whitespace-nowrap bg-surface-700 hover:bg-surface-600 text-theme-text-main border-surface-600"
                      title="Open print dialog"
                    >
                      <Printer size={12} className="mr-1 text-gold-400 sm:w-3.5 sm:h-3.5" /> 
                      <span className="hidden xs:inline">Print</span>
                    </Button>

                    {/* Direct PDF Download Button */}
                    <Button 
                      onClick={handleDownloadPdf} 
                      disabled={isDownloadingPdf || isSavingPaper}
                      variant="secondary" 
                      className="!w-auto !h-7 sm:!h-9 !py-0.5 sm:!py-1.5 !px-2 sm:!px-3 !text-[8px] sm:!text-[10px] flex items-center font-bold whitespace-nowrap bg-surface-700 hover:bg-surface-600 text-theme-text-main border-surface-600"
                      title="Download paper as PDF"
                    >
                      <FileDown size={12} className={`mr-1 text-gold-400 sm:w-3.5 sm:h-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} /> 
                      <span>{isDownloadingPdf ? 'Downloading...' : 'Download PDF'}</span>
                    </Button>

                    {/* More Actions Toggle Dropdown */}
                    <div className="relative" ref={actionsMenuRef}>
                      <Button 
                        onClick={() => setIsActionsMenuOpen(prev => !prev)}
                        variant="secondary" 
                        className="!w-auto !h-7 sm:!h-9 !py-0.5 sm:!py-1.5 !px-2 sm:!px-3 !text-[8px] sm:!text-[10px] flex items-center font-black shadow-lg whitespace-nowrap bg-surface-800 hover:bg-surface-700 border-surface-600"
                        title="More paper options"
                      >
                        <Settings size={11} className="mr-1 sm:mr-1.5 text-gold-500 sm:w-3.5 sm:h-3.5" /> 
                        <span className="hidden md:inline">Options</span> 
                        <ChevronDown size={9} className={`ml-0.5 sm:ml-1 opacity-70 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
                      </Button>
                      {isActionsMenuOpen && (
                        <div className="absolute right-0 top-full pt-2 w-52 z-[150] animate-fadeIn">
                          <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-surface-700">
                            <button 
                              onClick={() => { setIsActionsMenuOpen(false); executeSave(true); }} 
                              disabled={isSavingPaper} 
                              className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors font-black uppercase disabled:opacity-50"
                            >
                              <Save size={15} className="text-gold-500" /> 
                              {isSavingPaper ? 'Saving...' : (savedPaperId || initialPaper ? 'Update Paper' : 'Save Paper')}
                            </button>
                            <button 
                              onClick={handleDownloadPdf} 
                              className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors font-black uppercase"
                            >
                              <FileDown size={15} className="text-gold-500" /> 
                              Download PDF
                            </button>
                            <button 
                              onClick={handlePrint} 
                              className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center gap-3 transition-colors font-black uppercase"
                            >
                              <Printer size={15} className="text-gold-500" /> 
                              Print Paper
                            </button>
                            <div className="px-4 py-2.5 flex items-center justify-between gap-2 md:hidden">
                              <span className="text-[10px] text-theme-text-muted font-black uppercase flex items-center gap-2">
                                <Layout size={14} className="text-gold-500" />
                                Header
                              </span>
                              <select
                                value={headerStyle}
                                onChange={(e) => setHeaderStyle(e.target.value as any)}
                                className="bg-surface-900 border border-surface-700 text-theme-text-main text-[10px] font-bold rounded-lg px-2 py-1 outline-none"
                              >
                                <option value="default">Default</option>
                                <option value="sba">SBA</option>
                                <option value="layout3">Layout 3</option>
                                <option value="layout4">Layout 4</option>
                                <option value="layout5">Layout 5</option>
                                <option value="layout6">Layout 6</option>
                                <option value="layout7">Layout 7</option>
                                <option value="layout8">Layout 8</option>
                              </select>
                            </div>
                            <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-theme-text-muted font-black uppercase flex items-center gap-2">
                                <CheckCircle size={14} className="text-gold-500" />
                                Bubble Sheet
                              </span>
                              <select
                                value={bubbleSheetPosition}
                                onChange={(e) => setBubbleSheetPosition(e.target.value as BubbleSheetPosition)}
                                className="bg-surface-900 border border-surface-700 text-theme-text-main text-[10px] font-bold rounded-lg px-2 py-1 outline-none"
                              >
                                <option value="above_mcq">Above MCQs</option>
                                <option value="below_mcq">Below MCQs</option>
                                <option value="paper_end">End of Paper</option>
                                <option value="none">Off / Hide</option>
                              </select>
                            </div>
                            <button 
                              onClick={() => { setPageBreakAfterMCQ(!pageBreakAfterMCQ); setIsActionsMenuOpen(false); }} 
                              className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center justify-between transition-colors font-black uppercase"
                            >
                              <span className="flex items-center gap-3">
                                <Scissors size={15} className="text-gold-500" /> 
                                Page Break
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${pageBreakAfterMCQ ? 'bg-gold-500 text-black' : 'bg-surface-700 text-theme-text-muted'}`}>
                                {pageBreakAfterMCQ ? 'ON' : 'OFF'}
                              </span>
                            </button>
                            <button 
                              onClick={() => { setShowAnswerKey(!showAnswerKey); setIsActionsMenuOpen(false); }} 
                              className="w-full text-left px-4 py-3 text-[11px] text-theme-text-muted hover:bg-gold-500 hover:text-black flex items-center justify-between transition-colors font-black uppercase"
                            >
                              <span className="flex items-center gap-3">
                                <Key size={15} className="text-gold-500" /> 
                                Answer Key
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${showAnswerKey ? 'bg-gold-500 text-black' : 'bg-surface-700 text-theme-text-muted'}`}>
                                {showAnswerKey ? 'VISIBLE' : 'HIDDEN'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
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
                   <Button onClick={handleNext} disabled={(step === 3 && selectedChapters.length === 0) || (step === 4 && !selectedPatternId) || (step === 5 && totalSelectedCount === 0)} className="!w-auto py-1.5 px-3 sm:px-5 flex items-center text-[10px] sm:text-xs h-8 sm:h-9">
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
            <div className="animate-fadeIn grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-5xl mx-auto justify-items-center">
              {CLASSES.map((cls, idx) => {
                const color = CARD_COLORS[idx % CARD_COLORS.length];
                return (
                <div key={cls} onClick={() => handleClassSelect(cls)} className={`group relative cursor-pointer rounded-2xl border-2 p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 w-full aspect-square md:aspect-[4/3] overflow-hidden bg-surface-800/80 backdrop-blur-sm ${selectedClass === cls ? `border-transparent shadow-xl scale-105` : `${color.border} ${color.hoverBorder} hover:bg-surface-800 hover:-translate-y-1 ${color.shadow}`}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${color.from} ${color.to} transition-opacity duration-500 ${selectedClass === cls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                  <div className={`relative z-10 transition-all duration-300 ${selectedClass === cls ? `scale-110 ${color.icon}` : `text-theme-text-muted ${color.groupHoverIcon} group-hover:scale-110`}`}>{getClassIcon(cls)}</div>
                  <span className={`relative z-10 font-black text-sm md:text-lg whitespace-nowrap transition-all duration-300 ${selectedClass === cls ? 'text-theme-text-main tracking-wide' : 'text-theme-text-sub group-hover:text-theme-text-main group-hover:tracking-wide'}`}>{cls}</span>
                </div>
              )})}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadeIn flex flex-col">
              {isInitialLoad && classSubjects.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <RefreshCw size={48} className="animate-spin text-gold-500 opacity-50" />
                  <p className="text-theme-text-muted font-bold uppercase tracking-widest text-xs">Instantly Loading Subjects...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 justify-items-center max-w-6xl mx-auto">
                  {classSubjects.map((subj, idx) => {
                    const color = CARD_COLORS[idx % CARD_COLORS.length];
                    return (
                    <div key={subj} onClick={() => handleSubjectSelect(subj)} className={`group relative cursor-pointer rounded-2xl border-2 p-5 flex flex-col items-center justify-center text-center transition-all duration-300 w-full h-32 sm:h-36 overflow-hidden bg-surface-800/80 backdrop-blur-sm ${selectedSubject === subj ? `border-transparent shadow-xl scale-105` : `${color.border} ${color.hoverBorder} hover:bg-surface-800 hover:-translate-y-1 ${color.shadow}`}`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${color.from} ${color.to} transition-opacity duration-500 ${selectedSubject === subj ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                      <div className={`relative z-10 transition-colors duration-300 mb-2 ${selectedSubject === subj ? color.icon : `text-theme-text-muted ${color.groupHoverIcon}`}`}>
                         <Layers size={28} className={`transition-transform duration-300 ${selectedSubject === subj ? 'scale-110' : 'group-hover:scale-110'}`} />
                      </div>
                      <span className={`relative z-10 font-bold text-base md:text-lg leading-tight transition-all duration-300 ${selectedSubject === subj ? 'text-theme-text-main tracking-wide' : 'text-theme-text-sub group-hover:text-theme-text-main group-hover:tracking-wide'}`}>{subj}</span>
                    </div>
                  )})}
                  {classSubjects.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-50">
                      <AlertTriangle size={48} className="mx-auto mb-4" />
                      <p className="font-bold uppercase tracking-widest text-xs">No subjects found for {selectedClass}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="animate-fadeIn space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-theme-text-main">Select Chapters</h2>
                <p className="text-theme-text-muted text-sm mt-1">Choose chapters for the paper content.</p>
              </div>

              {isLoadingChapters ? (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <RefreshCw size={48} className="animate-spin text-gold-500 opacity-50" />
                  <p className="text-theme-text-muted font-bold uppercase tracking-widest text-xs">Loading Chapters...</p>
                </div>
              ) : availableChapters.length === 0 ? (
                <div className="bg-surface-800 border-2 border-dashed border-surface-700 rounded-2xl p-12 text-center animate-fadeIn max-w-2xl mx-auto">
                   <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                      <AlertTriangle size={32} className="text-red-500" />
                   </div>
                   <h3 className="text-xl font-bold text-theme-text-main uppercase tracking-tighter mb-2">No Chapters Available</h3>
                   <p className="text-theme-text-muted text-sm leading-relaxed mb-8">
                     Currently, there are no chapters found for <span className="text-gold-500 font-bold">{selectedSubject}</span> in <span className="text-gold-500 font-bold">{selectedClass}</span>.
                   </p>
                   <Button onClick={() => setStep(2)} variant="secondary" className="!w-auto px-8">
                      <ArrowLeft size={16} className="mr-2" /> Change Subject
                   </Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-4 mb-2">
                    <button 
                      onClick={selectAllChapters} 
                      className="text-[10px] font-black uppercase tracking-widest text-gold-500 hover:text-gold-400 transition-colors flex items-center gap-1.5 bg-gold-500/5 px-3 py-1.5 rounded-lg border border-gold-500/20"
                    >
                      <CheckSquare size={14} /> Select All Chapters
                    </button>
                    <button 
                      onClick={deselectAllChapters} 
                      className="text-[10px] font-black uppercase tracking-widest text-theme-text-muted hover:text-red-400 transition-colors flex items-center gap-1.5 bg-surface-800 px-3 py-1.5 rounded-lg border border-surface-700"
                    >
                      <Square size={14} /> Deselect All
                    </button>
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
                              <div className="col-span-full flex items-center gap-4 mb-2 pb-2 border-b border-surface-700/50">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); selectAllSubtopics(chapter.id); }} 
                                  className="text-[9px] font-bold uppercase text-gold-500/80 hover:text-gold-500 transition-colors flex items-center gap-1"
                                >
                                  <CheckCircle size={10} /> Select All Topics
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); deselectAllSubtopics(chapter.id); }} 
                                  className="text-[9px] font-bold uppercase text-theme-text-muted hover:text-red-400 transition-colors flex items-center gap-1"
                                >
                                  <X size={10} /> Deselect All
                                </button>
                              </div>
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
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="animate-fadeIn space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-theme-text-main">Select Paper Pattern</h2>
                <p className="text-theme-text-muted text-sm mt-1">Choose a predefined pattern or create your own custom pattern.</p>
              </div>

              {isLoadingPatterns ? (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <RefreshCw size={48} className="animate-spin text-gold-500 opacity-50" />
                  <p className="text-theme-text-muted font-bold uppercase tracking-widest text-xs">Loading Layouts...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. CUSTOM PATTERN CARD (ALWAYS FIRST) */}
                  <div 
                    onClick={() => setShowCustomPatternModal(true)} 
                    className={`relative bg-surface-800 border-2 rounded-xl p-6 hover:border-gold-500 flex flex-col h-full transition-all group cursor-pointer ${
                      selectedPatternId.startsWith('custom-') 
                        ? 'border-gold-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                        : 'border-dashed border-gold-500/60 hover:border-gold-500'
                    }`}
                  >
                    {selectedPatternId.startsWith('custom-') && (
                      <div className="absolute -top-2 -right-2 bg-gold-500 text-black rounded-full p-1 shadow-lg z-10 animate-scaleIn">
                        <CheckCircle size={20} />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-500 group-hover:bg-gold-500 group-hover:text-black transition-all">
                          <Sliders size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-theme-text-main text-lg leading-tight group-hover:text-gold-500 transition-colors">
                              Custom Paper Pattern
                            </h3>
                            <span className="text-[9px] bg-gold-500 text-black px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                              Custom
                            </span>
                          </div>
                          <span className="text-[11px] text-theme-text-muted font-bold block mt-0.5">
                            Create custom layout (MCQs, Short & Long)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mb-6 flex-grow">
                      <p className="text-xs text-theme-text-muted leading-relaxed mb-3">
                        Configure MCQs, Short questions, and Long questions as needed.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-tight bg-blue-500/20 text-blue-300 border-blue-500/40">
                          MCQs
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-tight bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                          Short Questions
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-tight bg-purple-500/20 text-purple-300 border-purple-500/40">
                          Long Questions
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-700/50 pt-4 mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-theme-text-muted uppercase font-black tracking-widest">Type</span>
                        <span className="text-sm font-black text-gold-500">
                          {selectedPatternId.startsWith('custom-') ? 'Custom Configured' : 'One-Time Pattern'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-gold-500/10 px-3 py-1.5 rounded-lg text-gold-500 group-hover:bg-gold-500 group-hover:text-black font-black text-xs transition-all">
                        <span>{selectedPatternId.startsWith('custom-') ? 'Edit Pattern' : 'Create Pattern'}</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>

                  {/* 2. PREDEFINED PATTERNS */}
                  {availablePatterns.map(pattern => (
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
                  ))}

                  {availablePatterns.length === 0 && (
                    <div className="bg-surface-800/60 border border-surface-700 rounded-xl p-6 flex flex-col justify-center items-center text-center">
                      <Sparkles size={32} className="text-gold-500/40 mb-2" />
                      <p className="text-xs text-theme-text-muted font-bold">
                        No predefined patterns found for {selectedSubject}.
                      </p>
                      <p className="text-[11px] text-theme-text-muted/70 mt-1">
                        Click the Custom Pattern card to generate your paper!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. CUSTOM PATTERN BUILDER MODAL */}
              {showCustomPatternModal && (
                <CustomPatternModal
                  isOpen={showCustomPatternModal}
                  onClose={() => setShowCustomPatternModal(false)}
                  onApplyPattern={handlePatternSelect}
                  classLevel={selectedClass}
                  subject={selectedSubject}
                  availableChapters={availableChapters}
                  user={user}
                  initialPattern={selectedPatternId ? availablePatterns.find(p => p.id === selectedPatternId) : null}
                />
              )}
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
                                <button key={s.id} onClick={() => { setActiveTabId(s.id); setSelectedTopicFilter('All'); }} className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-pre-wrap flex items-center gap-2 border-2 ${activeTabId === s.id ? 'bg-gold-500 text-black border-gold-500 shadow-md scale-105' : 'bg-surface-800 text-theme-text-muted border-surface-700 hover:border-gold-500'}`}>
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
                                  {(() => {
                                    const filteredQuestions = questionPool.filter(q => {
                                      const typeMatch = activeSection && matchesType(q.type, activeSection.type);
                                      if (!typeMatch) return false;
                                      if (activeSection?.specificChapters && activeSection.specificChapters.length > 0) {
                                        const ch = availableChapters.find(c => c.id === q.chapterId);
                                        if (ch && !isChapterMandatory(ch.name, activeSection.specificChapters)) return false;
                                      }
                                      if (selectedTopicFilter !== 'All') {
                                        const topic = q.subtopic || 'General';
                                        if (topic !== selectedTopicFilter) return false;
                                      }
                                      return true;
                                    });

                                    if (filteredQuestions.length === 0) {
                                      return (
                                        <div className="p-12 text-center text-theme-text-muted flex flex-col items-center">
                                          <AlertTriangle size={36} className="text-gold-500/40 mb-3" />
                                          <p className="font-bold text-sm text-theme-text-main">
                                            No questions found matching "{activeSection?.title || activeSection?.type}".
                                          </p>
                                          <p className="text-xs text-theme-text-muted mt-1">
                                            Make sure chapters and questions are uploaded for this subject ({selectedSubject}).
                                          </p>
                                        </div>
                                      );
                                    }

                                    return filteredQuestions.map(q => {
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
                                    });
                                  })()}
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
            <div className="animate-fadeIn space-y-4 h-full flex flex-col relative pb-8">
               <div className="bg-surface-800 p-1.5 sm:p-8 rounded-xl border border-surface-700 flex-grow print:p-0 print:bg-white print:border-none">
                  <div
                    ref={previewOuterRef}
                    className="a4-preview-outer w-full mx-auto relative overflow-hidden print:overflow-visible"
                    style={{
                      maxWidth: '794px',
                      height: scaledHeight ? `${scaledHeight}px` : 'auto'
                    }}
                  >
                    <div
                      ref={previewScalerRef}
                      className="a4-preview-scaler mx-auto shadow-2xl print:shadow-none transition-transform relative group/paper"
                      style={{
                        width: '794px',
                        minHeight: '1123px',
                        color: '#000000',
                        backgroundColor: '#ffffff',
                        transform: previewScale < 1 ? `scale(${previewScale})` : 'none',
                        transformOrigin: 'top left'
                      }}
                    >
                       <PrintablePaper 
                         instituteProfile={user.instituteProfile} classLevel={selectedClass} subject={selectedSubject} 
                         totalMarks={effectiveSections.reduce((acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 0)} 
                         sections={effectiveSections} questions={getSelectedQuestions()} layoutMode={1} medium={selectedMedium} showAnswerKey={showAnswerKey}
                         baseFontSize={fontSize} lineSpacing={lineSpacing} timeAllowed={paperTime} paperCode={paperCode}
                         chaptersDisplay={getChaptersDisplay()} headerStyle={headerStyle}
                         pageBreakAfterMCQ={pageBreakAfterMCQ}
                         bubbleSheetPosition={bubbleSheetPosition}
                       />
                    </div>
                  </div>
               </div>
            </div>
          )}
      </main>

      {/* Save / Action Toast Notification */}
      {saveStatusMessage && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[250] animate-fadeIn max-w-lg w-full px-4 print:hidden">
          <div className={`p-4 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] border flex items-center gap-3 backdrop-blur-xl transition-all ${
            saveStatusMessage.type === 'success' 
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.35)]' 
              : 'bg-red-950/95 border-red-500 text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.35)]'
          }`}>
            {saveStatusMessage.type === 'success' ? (
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
                <Check size={20} strokeWidth={3} />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/40">
                <AlertCircle size={20} strokeWidth={2.5} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm leading-snug">{saveStatusMessage.text}</p>
            </div>
            <button 
              onClick={() => setSaveStatusMessage(null)}
              className="text-theme-text-muted hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
