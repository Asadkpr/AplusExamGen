import React, { useState, useEffect, useRef } from 'react';
import { User, PaperPattern, PaperPatternSection, PaperPatternSectionPart } from '../types';
import { getPatterns, savePattern, deletePattern } from '../services/patternService';
import { getSubjects } from '../services/subjectService';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { CLASSES } from '../constants';
import { 
  ArrowLeft, Plus, Trash2, Edit, Save, X, Layout, RefreshCw,
  Layers, CheckSquare, Square, Check, Search, Info, Globe, AlertTriangle,
  BookOpen, ChevronDown, ChevronUp, Type as TypeIcon, ListTree, Clock, ListFilter,
  Split, Eye, EyeOff, Hash
} from 'lucide-react';

interface PaperPatternsProps {
  user: User;
  onBack: () => void;
  onUsePattern?: (pattern: PaperPattern) => void;
}

// Standardized list with user-friendly casing
const PREDEFINED_TYPES = [
  'MCQ', 'Short', 'Long', 'Numerical', 'Letter', 'Application', 'Story', 'Dialogue', 'Punctuation', 
  'Pair of words', 'Translate passage In urdu', 'Translate passage to English', 'Essay',
  'تشریح اشعار', 'سیاق و سباق کے حوالے سے تشریح', 'سبق کا خلاصہ', 'نظم کا مرکزی خیال',
  'مکالمہ', 'درخواست', 'تلخیص نگاری', 'الفاظ معنی', 'آیات کا ترجمہ', 'احادیث کی تشریح'
];

const ENGLISH_SPECIFIC_TYPES = [
  'MCQ', 'Short', 'Long', 'Translate', 'Summary', 'Idioms', 'Essay', 'Passage', 'Sentences', 'Alternate', 'Voice', 'Paraphrase', 'Letter', 'Story', 'Dialogue'
];

const ENGLISH_MCQ_SUBTYPES = ['Verb', 'Spelling', 'Meaning', 'Grammar'];

const ENGLISH_SUBTYPE_INSTRUCTIONS: Record<string, string> = {
  'Verb': 'Choose the correct form of verb and fill up the bubbles.',
  'Spelling': 'Choose the word with correct spellings and fill up the bubbles.',
  'Meaning': 'Choose the correct meanings of the underlined words and fill up the bubbles.',
  'Grammar': 'Choose the correct option according to grammar and fill up the bubbles.'
};

const SECTION_HEADINGS = ['None', 'SECTION – I', 'SECTION – II', 'OBJECTIVE PART', 'SUBJECTIVE PART'];

const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text || '');

const getSectionTagStyles = (type: string) => {
  const upper = type.toUpperCase();
  
  // 🔹 URDU & ISLAMIYAT TYPES (GOLD)
  if (isUrdu(type) || upper.includes('تشریح') || upper.includes('ترجمہ') || upper.includes('خلاصہ')) {
    return 'bg-gold-500/20 text-gold-500 border-gold-500/40 ring-gold-500/10';
  }
  
  // 🔹 OBJECTIVE / GRAMMAR (BLUE)
  if (upper === 'MCQ' || ['VERB', 'SPELLING', 'MEANING', 'GRAMMAR', 'SYNONYM'].some(t => upper.includes(t))) {
    return 'bg-blue-500/20 text-blue-600 border-blue-500/40 ring-blue-500/10';
  }
  
  // 🔹 CONCEPTUAL / SHORT (EMERALD)
  if (upper.includes('SHORT')) {
    return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40 ring-emerald-500/10';
  }
  
  // 🔹 THEORY / LONG (PURPLE)
  if (upper.includes('LONG') || upper.includes('THEORY')) {
    return 'bg-purple-500/20 text-purple-600 border-purple-500/40 ring-purple-500/10';
  }
  
  // 🔹 APPLIED / MATH (ORANGE)
  if (upper.includes('NUMERICAL') || upper.includes('PROBLEM') || upper.includes('CALC')) {
    return 'bg-orange-500/20 text-orange-600 border-orange-500/40 ring-orange-500/10';
  }
  
  // 🔹 CREATIVE WRITING (ROSE)
  if (['ESSAY', 'LETTER', 'STORY', 'DIALOGUE', 'APPLICATION'].some(t => upper.includes(t))) {
    return 'bg-rose-500/20 text-rose-600 border-rose-500/40 ring-rose-500/10';
  }
  
  // 🔹 COMPREHENSION / ANALYSIS (CYAN)
  if (['TRANSLATE', 'SUMMARY', 'PARAPHRASE', 'PASSAGE', 'VOICE', 'COMPREHENSION'].some(t => upper.includes(t))) {
    return 'bg-cyan-500/20 text-cyan-600 border-cyan-500/40 ring-cyan-500/10';
  }
  
  // 🔹 VOCABULARY / OTHER (AMBER)
  if (['IDIOMS', 'SENTENCES', 'ALTERNATE', 'PAIR', 'PUNCTUATION'].some(t => upper.includes(t))) {
    return 'bg-amber-500/20 text-amber-600 border-amber-500/40 ring-amber-500/10';
  }

  return 'bg-gray-500/10 text-theme-text-muted border-gray-500/30';
};

const getAutoTitle = (type: string, count: number, marks: number, index: number, isEnglish?: boolean): string | null => {
  const isUrduType = isUrdu(type);
  let baseTitle = '';
  const upperType = type.toUpperCase();

  if (isEnglish) {
    if (upperType === 'MCQ') {
      baseTitle = "Choose the correct option from the following.";
    } else if (upperType === 'SHORT') {
      baseTitle = `Write short answers to any ${count} questions.`;
    } else if (upperType === 'LONG') {
      baseTitle = `Answer the following long questions.`;
    } else {
      const suggestions = TYPE_TITLE_MAPPING[type] || [];
      baseTitle = suggestions[0] || type;
    }
  } else {
    if (upperType === 'MCQ') {
      baseTitle = isUrduType ? "تمام سوالات کے جوابات دیں" : "Attempt all. Circle the correct answer";
    } else if (upperType === 'SHORT') {
      baseTitle = isUrduType ? `کوئی سے ${count} مختصر سوالات کے جوابات دیں` : `Write short answers to any ${count} questions.`;
    } else if (upperType === 'LONG') {
      baseTitle = isUrduType ? `کوئی سے ${count} تفصیلی سوالات کے جوابات دیں` : `Attempt any ${count} questions.`;
    } else if (upperType === 'NUMERICAL') {
       baseTitle = isUrduType ? `دیے گئے سوالات حل کریں` : `Solve the following numerical problems.`;
    } else {
      const key = Object.keys(TYPE_TITLE_MAPPING).find(k => k.toUpperCase() === upperType);
      const suggestions = key ? TYPE_TITLE_MAPPING[key] : [];
      baseTitle = suggestions[0] || type;
    }
  }

  const cleanBase = baseTitle
    .replace(/^Q\d+\. /, '')
    .replace(/^سوال نمبر \d+\. /, '')
    .replace(/^سوال نمبر \. \d+/, '')
    .split(' (')[0]
    .trim();

  if (isUrduType) {
    return `سوال نمبر ${index + 1}. ${cleanBase}`;
  } else {
    return `Q${index + 1}. ${cleanBase}`;
  }
};

const TYPE_TITLE_MAPPING: Record<string, string[]> = {
  'MCQ': ['Attempt all. Circle the correct answer', 'Choose the correct option', 'Circle the Correct Answer', 'Objective Part'],
  'Short': ['Write short answers to any (?) questions.', 'Section I: Short Answers', 'Answer any (?) questions.'],
  'Long': ['Detailed Answers', 'Attempt any (?) questions.', 'Section II: Descriptive'],
  'Numerical': ['Solve the numericals', 'Mathematical Problems', 'Solve problems'],
  'Translate': ['Translate into Urdu', 'Urdu Translation', 'Translation (Eng to Urdu)'],
  'Summary': ['Write a Summary of the poem.', 'Summary of the poem', 'Write the Summary'],
  'Paraphrase': ['Paraphrase the following lines.', 'Paraphrase', 'Lines Paraphrasing'],
  'Idioms': ['Use Idioms in sentences', 'Idiomatic Expressions', 'English Idioms'],
  'Essay': ['Write an Essay on...', 'Descriptive Essay', 'English Essay'],
  'Passage': ['Read the passage and answer...', 'Comprehension Passage', 'Unseen Passage'],
  'Sentences': ['Make sentences using...', 'Sentence Making', 'Vocabulary Use'],
  'Alternate': ['Alternate question for...', 'Supplementary Question', 'Alternative Choice'],
  'Voice': ['Change the Voice', 'Active and Passive Voice', 'Direct/Indirect Speech'],
  'Letter': ['Write a Letter to your friend...', 'Formal Letter', 'Informal Letter'],
  'Application': ['Write an Application for...', 'Official Application', 'School Application'],
  'Story': ['Write a Story on...', 'Moral Story', 'Story Writing'],
  'Dialogue': ['Write a Dialogue between...', 'Dialogue Writing', 'Dialogue between two people'],
  'Punctuation': ['Punctuate the following lines', 'Sentence Punctuation', 'Correct Punctuation'],
  'Pair of words': ['Use Pairs of Words in sentences', 'Pairs of Words', 'Vocabulary Check'],
  'Translate passage In urdu': ['Translate into Urdu', 'Urdu Translation', 'Translation (Eng to Urdu)'],
  'Translate passage to English': ['Translate into English', 'English Translation', 'Translation (Urdu to Eng)'],
  'تشریح اشعار': ['اشعار کی تشریح کریں', 'حصہ نظم: تشریح', 'اشعار کا خلاصہ'],
  'سیاق و سباق کے حوالے سے تشریح': ['سیاق و سباق کے ساتھ تشریح', 'عبارت کی تشریح', 'نثر پاروں کی تشریح'],
  'سبق کا خلاصہ': ['سبق کا خلاصہ لکھیں', 'خلاصہ نویسی', 'سبق کا خلاصہ'],
  'نظم کا مرکزی خیال': ['نظم کا مرکزی خیال لکھیں', 'مرکزی خیال', 'خلاصہ نظم'],
  'مکالمہ': ['مکالمہ تحریر کریں', 'مکالمہ نویسی', 'دو افراد کے درمیان مکالمہ'],
  'درخواست': ['درخواست برائے رخصت', 'درخواست نویسی', 'بخدمت جناب ہیڈ ماسٹر صاحب'],
  'تلخیص نگاری': ['عبارت کی تلخیص کریں', 'تلخیص نویسی', 'خلاصہ و تلخیص'],
  'الفاظ معنی': ['الفاظ کے معنی لکھیں', 'الفاظ و معنی', 'لغت'],
  'آیات کا ترجمہ': ['آیات کا با محاورہ ترجمہ کریں', 'ترجمہ آیات', 'قرآنی آیات کا ترجمہ'],
  'احادیث کی تشریح': ['حدیث کی تشریح کریں', 'حدیث مبارکہ کا مفہوم', 'تشریح حدیث'],
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const PaperPatterns: React.FC<PaperPatternsProps> = ({ user, onBack, onUsePattern }) => {
  const [view, setView] = useState<'SUBJECTS' | 'LIST' | 'CREATE'>('SUBJECTS');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [patterns, setPatterns] = useState<PaperPattern[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingPattern, setEditingPattern] = useState<PaperPattern | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    classLevel: '', 
    selectedSubjects: [] as string[],
    timeAllowed: '2:00 Hours'
  });
  const [sections, setSections] = useState<PaperPatternSection[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [customTitleModes, setCustomTitleModes] = useState<Record<string, boolean>>({});
  const [expandedSectionParts, setExpandedSectionParts] = useState<Record<string, boolean>>({});

  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allPatterns = await getPatterns();
      setPatterns(allPatterns);
      const sMap = await getSubjects();
      setSubjectsMap(sMap);
      
      let allSubjects = Array.from(new Set(Object.values(sMap).flat()));
      const patternSubjects = allPatterns.map(p => p.subject).filter(s => s) as string[];
      allSubjects = [...new Set([...allSubjects, ...patternSubjects])];
      setAvailableSubjects(Array.from(new Set(allSubjects)).sort());
    } catch (e) {
      console.error("Error loading patterns", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubjectClick = (subject: string) => {
    setSelectedSubject(subject);
    setSearchTerm('');
    setView('LIST');
  };

  const handleCreateNew = () => {
    let initialClass = '';
    for(const cls of CLASSES) {
      if(subjectsMap[cls]?.includes(selectedSubject)) {
        initialClass = cls;
        break;
      }
    }

    setFormData({ name: '', description: '', classLevel: initialClass, selectedSubjects: [], timeAllowed: '2:00 Hours' });
    setSections([]);
    setEditingPattern(null);
    setCustomTitleModes({});
    setExpandedSectionParts({});
    setIsSubjectDropdownOpen(false);
    setView('CREATE');
  };

  const handleEditPattern = (pattern: PaperPattern) => {
    setEditingPattern(pattern);
    setFormData({ 
      name: pattern.name, 
      description: '', 
      classLevel: pattern.classLevel || '',
      selectedSubjects: [],
      timeAllowed: pattern.timeAllowed || '2:00 Hours'
    });
    setSections(JSON.parse(JSON.stringify(pattern.sections)));
    
    const currentSubject = (pattern.subject || selectedSubject).toLowerCase();
    const isEnglishSubject = currentSubject === 'english';

    const modes: Record<string, boolean> = {};
    const expanded: Record<string, boolean> = {};
    pattern.sections.forEach((s, index) => {
      const autoTitle = getAutoTitle(s.type, s.attemptCount, s.marksPerQuestion, index, isEnglishSubject);
      if (s.title && s.title !== autoTitle) {
        modes[s.id] = true;
      }
      if (s.subParts && s.subParts.length > 0) {
        expanded[s.id] = true;
      }
    });
    setCustomTitleModes(modes);
    setExpandedSectionParts(expanded);

    setIsSubjectDropdownOpen(false);
    setView('CREATE');
  };

  const handleAddSection = () => {
    const sectionId = generateId();
    const type = 'MCQ';
    const index = sections.length;
    const currentSubject = (editingPattern?.subject || selectedSubject).toLowerCase();
    const isEnglishSubject = currentSubject === 'english';
    const autoTitle = getAutoTitle(type, 10, 1, index, isEnglishSubject);
    const newSection: PaperPatternSection = {
      id: sectionId, 
      type: type, 
      title: autoTitle || `Q${index + 1}. Attempt all.`, 
      titleUrdu: '',
      titleFontSize: 10,
      hideSectionMarks: false,
      hideSubPartMarks: false,
      questionCount: 10, 
      attemptCount: 10, 
      marksPerQuestion: 1,
      heading: 'None',
      specificChapters: []
    };
    setSections([...sections, newSection]);
  };

  const handleUpdateSection = (id: string, field: keyof PaperPatternSection, value: any) => {
    setSections(prev => {
      return prev.map((s, idx) => {
        if (s.id !== id) return s;
        
        let nextValue = value;
        // Parse comma separated chapter numbers
        if (field === 'specificChapters' && typeof value === 'string') {
          nextValue = value.split(',').map(n => n.trim()).filter(Boolean);
        }

        let nextSection = { ...s, [field]: nextValue };
        const currentSubject = (editingPattern?.subject || selectedSubject).toLowerCase();
        const isEnglishSubject = currentSubject === 'english';

        // 🔹 AUTO-DETECT SUMMARY TYPE FOR ENGLISH
        if (field === 'type' && isEnglishSubject && value === 'Summary') {
           nextSection.subParts = [
             { id: generateId(), label: 'Write the summary of the poem.', marks: 5, type: 'Summary', specificChapters: [], questionCount: 1, attemptCount: 1 },
             { id: generateId(), label: 'Paraphrase the following lines into simple English.', marks: 5, type: 'Paraphrase', specificChapters: [], questionCount: 1, attemptCount: 1, isAlternative: true }
           ];
           nextSection.questionCount = 1;
           nextSection.attemptCount = 1;
           nextSection.marksPerQuestion = 5;
           setExpandedSectionParts(prev => ({ ...prev, [id]: true }));
        }

        // 🔹 AUTO-DETECT LETTER TYPE FOR ENGLISH (Letter OR Story OR Dialogue)
        if (field === 'type' && isEnglishSubject && value === 'Letter') {
           nextSection.subParts = [
             { id: generateId(), label: 'Write a Letter to your friend...', marks: 8, type: 'Letter', specificChapters: [], questionCount: 1, attemptCount: 1 },
             { id: generateId(), label: 'Write a Story on...', marks: 8, type: 'Story', specificChapters: [], questionCount: 1, attemptCount: 1, isAlternative: true },
             { id: generateId(), label: 'Write a Dialogue between...', marks: 8, type: 'Dialogue', specificChapters: [], questionCount: 1, attemptCount: 1, isAlternative: true }
           ];
           nextSection.questionCount = 1;
           nextSection.attemptCount = 1;
           nextSection.marksPerQuestion = 8;
           setExpandedSectionParts(prev => ({ ...prev, [id]: true }));
        }

        // AUTO-UPDATE DISPLAY TITLE IF NOT IN CUSTOM MODE
        if (field === 'type' || field === 'attemptCount' || field === 'marksPerQuestion' || field === 'heading') {
           if (!customTitleModes[id]) {
             const updatedType = field === 'type' ? value : nextSection.type;
             const updatedCount = field === 'attemptCount' ? value : nextSection.attemptCount;
             const updatedMarks = field === 'marksPerQuestion' ? value : nextSection.marksPerQuestion;
             const autoTitle = getAutoTitle(updatedType, updatedCount, updatedMarks, idx, isEnglishSubject);
             if (autoTitle) {
               nextSection.title = autoTitle;
             }
           }
        }
        return nextSection;
      });
    });
  };

  const handleToggleParts = (id: string) => {
    setExpandedSectionParts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddPart = (sectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const parts = [...(s.subParts || [])];
      const nextLabelChar = String.fromCharCode(97 + parts.length); // a, b, c...
      const isEnglish = (editingPattern?.subject || selectedSubject).toLowerCase() === 'english';
      const isMCQ = s.type.toUpperCase() === 'MCQ';

      // 🔹 Cycle through subtypes if adding to an English MCQ section
      let partType = isMCQ && isEnglish ? ENGLISH_MCQ_SUBTYPES[parts.length % ENGLISH_MCQ_SUBTYPES.length] : s.type;
      
      parts.push({ 
        id: generateId(), 
        label: isEnglish && isMCQ ? (ENGLISH_SUBTYPE_INSTRUCTIONS[partType] || 'Choose the correct option') : `(${nextLabelChar})`, 
        marks: isMCQ ? 1 : 0, 
        type: partType, 
        specificChapters: [],
        questionCount: isMCQ ? 5 : 1,
        attemptCount: isMCQ ? 5 : 1,
        isAlternative: false
      });

      // Recalculate parent section counts for MCQ
      if (isMCQ) {
         const totalPartQuestions = parts.reduce((acc, p) => acc + (p.questionCount || 0), 0);
         const totalPartAttempts = parts.reduce((acc, p) => acc + (p.attemptCount || 0), 0);
         return { 
           ...s, 
           subParts: parts, 
           questionCount: totalPartQuestions,
           attemptCount: totalPartAttempts
         };
      }

      return { ...s, subParts: parts };
    }));
  };

  const handleUpdatePart = (sectionId: string, partId: string, field: keyof PaperPatternSectionPart, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      
      const isEnglish = (editingPattern?.subject || selectedSubject).toLowerCase() === 'english';
      const isMCQ = s.type.toUpperCase() === 'MCQ';

      const parts = s.subParts?.map(p => {
        if (p.id !== partId) return p;
        
        let nextValue = value;
        // Parse comma separated chapter numbers
        if (field === 'specificChapters' && typeof value === 'string') {
          nextValue = value.split(',').map(n => n.trim()).filter(Boolean);
        }

        let updatedPart = { ...p, [field]: nextValue };
        
        // Auto-update instructions (labels) for English MCQ subtypes
        if (field === 'type' && isEnglish && isMCQ) {
           const instruction = ENGLISH_SUBTYPE_INSTRUCTIONS[value];
           if (instruction) {
             updatedPart.label = instruction;
           }
        }
        
        return updatedPart;
      });
      
      // 🔹 Ensure main section counts are synced with sub-parts for MCQ
      if (isMCQ && parts) {
        const totalPartQuestions = parts.reduce((acc, p) => acc + (p.questionCount || 0), 0);
        const totalPartAttempts = parts.reduce((acc, p) => acc + (p.attemptCount || 0), 0);
        return { 
          ...s, 
          subParts: parts, 
           questionCount: totalPartQuestions,
           attemptCount: totalPartAttempts
         };
      }

      const totalPartMarks = parts?.reduce((acc, p) => acc + (p.marks || 0), 0) || s.marksPerQuestion;
      return { ...s, subParts: parts, marksPerQuestion: totalPartMarks };
    }));
  };

  const handleRemovePart = (sectionId: string, partId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const parts = s.subParts?.filter(p => p.id !== partId);
      
      // 🔹 Ensure main section counts are synced after removal for MCQ
      const isMCQ = s.type.toUpperCase() === 'MCQ';
      if (isMCQ && parts) {
        const totalPartQuestions = parts.reduce((acc, p) => acc + (p.questionCount || 0), 0);
        const totalPartAttempts = parts.reduce((acc, p) => acc + (p.attemptCount || 0), 0);
        return { 
          ...s, 
          subParts: parts, 
          questionCount: totalPartQuestions,
          attemptCount: totalPartAttempts
        };
      }

      const totalPartMarks = parts?.reduce((acc, p) => acc + (p.marks || 0), 0) || s.marksPerQuestion;
      return { ...s, subParts: parts, marksPerQuestion: totalPartMarks };
    }));
  };

  const handleRemoveSection = (id: string) => {
    setSections(prev => {
      const filtered = prev.filter(s => s.id !== id);
      const currentSubject = (editingPattern?.subject || selectedSubject).toLowerCase();
      const isEnglishSubject = currentSubject === 'english';
      return filtered.map((s, idx) => {
        if (customTitleModes[s.id]) return s;
        const autoTitle = getAutoTitle(s.type, s.attemptCount, s.marksPerQuestion, idx, isEnglishSubject);
        if (autoTitle) return { ...s, title: autoTitle };
        return s;
      });
    });
    setCustomTitleModes(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleToggleSubject = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subject)
        ? prev.selectedSubjects.filter(s => s !== subject)
        : [...prev.selectedSubjects, subject]
    }));
  };

  const handleSavePattern = async () => {
    if (!formData.name || !formData.classLevel || sections.length === 0) {
      alert("Missing required fields (Title, Class, and Sections)");
      return;
    }
    
    setIsSaving(true);
    const calculatedTotal = sections.reduce((acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 0);
    
    try {
      if (editingPattern) {
        const updatedPattern: PaperPattern = {
          ...editingPattern,
          name: formData.name,
          description: '',
          totalMarks: calculatedTotal,
          sections: sections,
          classLevel: formData.classLevel,
          timeAllowed: formData.timeAllowed,
        };
        await savePattern(updatedPattern);

        for (const sub of formData.selectedSubjects) {
          const newPattern: PaperPattern = {
            id: generateId(),
            name: formData.name,
            description: '',
            totalMarks: calculatedTotal,
            sections: sections,
            subject: sub,
            classLevel: formData.classLevel,
            timeAllowed: formData.timeAllowed,
          };
          await savePattern(newPattern);
        }
      } else {
        const targets = [selectedSubject, ...formData.selectedSubjects].filter(Boolean);
        for (const sub of targets) {
          const newPattern: PaperPattern = {
            id: generateId(),
            name: formData.name,
            description: '',
            totalMarks: calculatedTotal,
            sections: sections,
            subject: sub,
            classLevel: formData.classLevel,
            timeAllowed: formData.timeAllowed,
          };
          await savePattern(newPattern);
        }
      }
      
      await loadData();
      alert(editingPattern ? "Pattern(s) Updated Successfully!" : "Pattern(s) Created Successfully!");
      setView('LIST');
    } catch (e) {
      alert("Error saving pattern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePattern = async (id: string) => {
    if (confirm("Are you sure you want to delete this pattern? This will permanently remove it for ALL users.")) {
      await deletePattern(id);
      await loadData();
    }
  };

  const renderSubjectGrid = () => (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-8">
         <h2 className="text-2xl font-bold text-theme-text-main uppercase tracking-widest">Select Subject</h2>
         <button onClick={loadData} className="flex items-center gap-2 text-sm text-gold-500 hover:text-theme-text-main transition-colors" disabled={isLoading}>
           <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh List
         </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {availableSubjects.map(subject => {
          const patternCount = patterns.filter(p => p.subject?.toLowerCase() === subject.toLowerCase() || (!p.subject && p.classLevel)).length;
          return (
            <div key={subject} onClick={() => handleSubjectClick(subject)} className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col items-center gap-4 cursor-pointer transition-all hover:border-gold-500 hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-theme-text-main font-bold text-lg text-center leading-tight">{subject}</h3>
              <div className="text-[10px] px-2 py-0.5 rounded font-bold bg-gold-500/10 text-gold-500 border border-gold-500/20 uppercase">{patternCount} Patterns</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPatternList = () => {
    const subjectPatterns = patterns.filter(p => 
      ((!p.subject) || p.subject.toLowerCase() === selectedSubject.toLowerCase()) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       (p.classLevel && p.classLevel.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    return (
      <div className="animate-fadeIn">
         <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
               <h2 className="text-2xl font-bold text-theme-text-main flex items-center gap-2 uppercase tracking-tighter">
                 <span className="text-gold-500">{selectedSubject}</span> Patterns
               </h2>
               <p className="text-xs text-theme-text-muted mt-1 uppercase tracking-widest font-semibold">{subjectPatterns.length} Available Layouts</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-grow md:w-64">
                <input 
                  type="text" 
                  placeholder="Search layouts..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-theme-text-main pl-10 pr-4 py-2 rounded-xl focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all text-sm placeholder:text-gray-500"
                />
                <Search className="absolute left-3 top-2.5 text-gold-500" size={16} />
              </div>
              {isAdmin && (
                <Button onClick={handleCreateNew} className="!w-auto py-2 px-4 text-xs">
                  <Plus size={16} className="mr-1" /> New Layout
                </Button>
              )}
            </div>
         </div>

         {subjectPatterns.length === 0 ? (
            <div className="text-center p-16 bg-gray-800 border border-dashed border-gray-700 rounded-2xl text-theme-text-muted">
               <Layout size={48} className="mx-auto mb-4 opacity-20" />
               <p className="text-lg font-bold">No patterns found matching your search.</p>
            </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {subjectPatterns.map(pattern => (
                 <div key={pattern.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gold-500 flex flex-col h-full transition-all group">
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-theme-text-main text-lg leading-tight group-hover:text-gold-500 transition-colors">{pattern.name}</h3>
                       {pattern.classLevel && <span className="text-[9px] bg-gray-950 text-gold-500 border border-gold-500/20 px-1.5 py-0.5 rounded font-black uppercase">{pattern.classLevel}</span>}
                    </div>
                    
                    <div className="mb-6 flex-grow">
                       <div className="flex flex-wrap gap-2 mt-3">
                          {pattern.sections.map((s, i) => (
                             <div key={i} className="flex flex-col gap-1">
                               <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-tight shadow-inner transition-all hover:brightness-110 ring-1 ${getSectionTagStyles(s.type)} ${isUrdu(s.type) ? 'font-urdu py-0.5' : ''}`}>
                                 <span className="uppercase opacity-90">{s.type}</span>
                                 <span className="w-px h-2.5 bg-current opacity-20"></span>
                                 <span className="brightness-125 font-black">{s.attemptCount}/{s.questionCount}</span>
                               </span>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-700/50 pt-4 mt-auto">
                       <div className="flex flex-col">
                          <span className="text-[9px] text-theme-text-muted uppercase font-black tracking-widest">Total Weight</span>
                          <span className="text-lg font-black text-gold-500 leading-none">{pattern.totalMarks} Marks</span>
                       </div>
                       <Button onClick={() => onUsePattern && onUsePattern({ ...pattern, subject: pattern.subject || selectedSubject })} className="!w-auto text-[10px] py-1.5 px-4 font-black">Use Layout</Button>
                    </div>

                    {isAdmin && (
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-700/30">
                        <button onClick={() => handleEditPattern(pattern)} className="p-1.5 text-gold-500 hover:bg-gold-500/10 rounded transition-colors"><Edit size={14} /></button>
                        <button onClick={() => handleDeletePattern(pattern.id)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                 </div>
               ))}
           </div>
         )}
      </div>
    );
  };

  const renderCreateForm = () => {
    const classSubjects = (formData.classLevel ? (subjectsMap[formData.classLevel] || []) : [])
      .filter(s => s !== (editingPattern?.subject || selectedSubject));
    const currentSubject = (editingPattern?.subject || selectedSubject).toLowerCase();
    const isEnglishSubject = currentSubject === 'english';

    return (
      <div className="animate-fadeIn max-w-5xl mx-auto pb-20">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl">
           <div className="flex justify-between items-start mb-8">
              <h2 className="text-2xl font-black text-gold-500 flex items-center gap-3 uppercase tracking-tighter">
                {editingPattern ? <Edit size={28} /> : <Plus size={28} />}
                {editingPattern ? 'Update' : 'Configure'} Paper Layout
              </h2>
              {!editingPattern && (
                <div className="bg-gold-500/10 border border-gold-500/30 px-4 py-2 rounded-xl flex items-center gap-3">
                   <div className="bg-gold-500 p-1.5 rounded-lg text-black"><BookOpen size={16} /></div>
                   <div>
                      <p className="text-[9px] text-gold-500/70 font-black uppercase tracking-widest">Primary Subject</p>
                      <p className="text-sm font-bold text-theme-text-main">{selectedSubject}</p>
                   </div>
                </div>
              )}
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="col-span-1">
                <Input 
                  label="Pattern Title" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Mid-Term Assessment" 
                />
              </div>

              <div className="col-span-1">
                <Input 
                  label="Paper Time" 
                  value={formData.timeAllowed} 
                  onChange={e => setFormData({...formData, timeAllowed: e.target.value})} 
                  placeholder="e.g. 2:00 Hours" 
                  icon={<Clock size={18} className="text-gold-500" />}
                />
              </div>

              <Select 
                label="Target Class" 
                value={formData.classLevel} 
                options={CLASSES}
                placeholder="Choose Class..."
                onChange={e => setFormData({...formData, classLevel: e.target.value, selectedSubjects: []})} 
              />

              <div className="col-span-full space-y-2 relative" ref={dropdownRef}>
                <label className="text-sm font-bold text-theme-text-main uppercase tracking-widest block">
                  Apply to Additional Subjects
                </label>
                
                <div 
                  onClick={() => formData.classLevel && setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                  className={`w-full px-4 py-3 bg-gray-900 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${!formData.classLevel ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-gold-500'} ${isSubjectDropdownOpen ? 'border-gold-500 ring-2 ring-gold-500/20' : 'border-gray-700'}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {formData.selectedSubjects.length === 0 ? (
                      <span className="text-theme-text-sub text-sm italic">Pattern already applies to <strong>{editingPattern?.subject || selectedSubject}</strong></span>
                    ) : (
                      <div className="flex gap-1 overflow-hidden">
                        <span className="bg-gold-500 text-black px-2 py-0.5 rounded text-[10px] font-black uppercase whitespace-nowrap">
                          {formData.selectedSubjects.length} Subjects Selected
                        </span>
                      </div>
                    )}
                  </div>
                  {isSubjectDropdownOpen ? <ChevronUp size={18} className="text-gold-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                </div>

                {isSubjectDropdownOpen && formData.classLevel && (
                  <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-gray-800 border border-gold-500/50 rounded-xl shadow-2xl overflow-hidden animate-scaleIn">
                    <div className="p-3 border-b border-gray-700 bg-gray-950/50 flex justify-between items-center">
                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Available Subjects</span>
                       {classSubjects.length > 0 && (
                         <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData(prev => ({
                                ...prev, 
                                selectedSubjects: prev.selectedSubjects.length === classSubjects.length ? [] : [...classSubjects]
                              }));
                            }}
                            className="text-[10px] text-gold-500 hover:text-theme-text-main font-black uppercase underline decoration-gold-500/30"
                         >
                            {formData.selectedSubjects.length === classSubjects.length ? 'Unselect All' : 'Select All'}
                         </button>
                       )}
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                      {classSubjects.map(sub => {
                        const isChecked = formData.selectedSubjects.includes(sub);
                        return (
                          <div 
                            key={sub} 
                            onClick={(e) => { e.stopPropagation(); handleToggleSubject(sub); }}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-gold-500/10 text-theme-text-main' : 'hover:bg-gray-750 text-theme-text-muted'}`}
                          >
                             {isChecked ? <CheckSquare size={18} className="text-gold-500" /> : <Square size={18} />}
                             <span className="text-xs font-bold">{sub}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
           </div>

           <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-theme-text-main uppercase tracking-widest flex items-center gap-2"><Layers className="text-gold-500" size={20} /> Part Configuration</h3>
              <Button onClick={handleAddSection} variant="secondary" className="!w-auto text-[10px] py-1.5 px-4 font-black"><Plus size={14} className="mr-1"/> Add New Part</Button>
           </div>
           
           <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-theme-text-sub mb-3 px-2 uppercase tracking-widest">
              {isEnglishSubject && <div className="col-span-1 text-center">Heading</div>}
              <div className={isEnglishSubject ? "col-span-1 text-center" : "col-span-1 text-center"}>Type</div>
              <div className={isEnglishSubject ? "col-span-3" : "col-span-4"}>Display Titles (Eng & Urdu)</div>
              <div className="col-span-1 text-center">Marks Visibility</div>
              <div className="col-span-1 text-center">Total Qs</div>
              <div className="col-span-1 text-center">Attempt</div>
              <div className="col-span-1 text-center">Marks/Q</div>
              <div className="col-span-2 text-center">Chapters</div>
              <div className="col-span-1 text-center">Actions</div>
           </div>
           
           <div className="space-y-4 mb-8">
               {sections.map((s, idx) => {
                 const isCustomType = !PREDEFINED_TYPES.includes(s.type) && !ENGLISH_SPECIFIC_TYPES.includes(s.type);
                 const isCustomTitleMode = customTitleModes[s.id] || isCustomType;
                 const rawSuggestions = TYPE_TITLE_MAPPING[s.type] || [];
                 const isExpanded = expandedSectionParts[s.id];
                 const isEnglish = (editingPattern?.subject || selectedSubject).toLowerCase() === 'english';
                 const isMCQ = s.type.toUpperCase() === 'MCQ';

                 const suggestions = rawSuggestions.map(rs => {
                   const isUrduType = isUrdu(s.type);
                   const clean = rs.replace('(?)', s.attemptCount.toString()).split(' (')[0];
                   
                   if (isUrduType) {
                     let urduBody = clean;
                     if (s.type.toUpperCase() === 'SHORT') urduBody = `کوئی سے ${s.attemptCount} مختصر سوالات کے جوابات دیں`;
                     if (s.type.toUpperCase() === 'LONG') urduBody = `کوئی سے ${s.attemptCount} تفصیلی سوالات کے جوابات دیں`;
                     if (s.type.toUpperCase() === 'MCQ') urduBody = "تمام سوالات کے جوابات دیں";
                     return `سوال نمبر ${idx + 1}. ${urduBody}`;
                   }
                   return `Q${idx + 1}. ${clean}`;
                 });

                 const typesToRender = isEnglishSubject ? ENGLISH_SPECIFIC_TYPES : PREDEFINED_TYPES;

                 return (
                   <div key={s.id} className="space-y-2">
                     <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-xl grid grid-cols-12 gap-2 items-center hover:border-gold-500/50 transition-colors">
                        {isEnglishSubject && (
                          <div className="col-span-1">
                            <select 
                              value={s.heading || 'None'} 
                              onChange={e => handleUpdateSection(s.id, 'heading', e.target.value)} 
                              className="w-full bg-gray-800 text-theme-text-main text-[10px] p-2 rounded-lg border border-gray-700 outline-none"
                            >
                              {SECTION_HEADINGS.map(h => (
                                <option key={h} value={h} className="bg-gray-800">{h}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className={isEnglishSubject ? "col-span-1" : "col-span-1"}>
                          {isCustomType ? (
                            <div className="flex gap-1">
                              <input 
                                value={s.type} 
                                onChange={e => handleUpdateSection(s.id, 'type', e.target.value)} 
                                className="w-full bg-gray-800 text-theme-text-main text-[10px] p-2 rounded-lg border border-gold-500/50 outline-none font-urdu" 
                                placeholder="Type..."
                                autoFocus 
                              />
                              <button onClick={() => handleUpdateSection(s.id, 'type', 'MCQ')} className="p-2 text-gold-500 hover:text-theme-text-main" title="Reset to list"><X size={14} /></button>
                            </div>
                          ) : (
                            <select 
                              value={s.type} 
                              onChange={e => handleUpdateSection(s.id, 'type', e.target.value === 'OTHER' ? '' : e.target.value)} 
                              className={`w-full bg-gray-800 text-theme-text-main text-[10px] p-2 rounded-lg border border-gray-700 outline-none ${isUrdu(s.type) ? 'font-urdu' : ''}`}
                            >
                              {typesToRender.map(t => (
                                <option key={t} value={t} className={`bg-gray-800 ${isUrdu(t) ? 'font-urdu' : ''}`}>{t}</option>
                              ))}
                              <option value="OTHER" className="bg-gray-800">Other...</option>
                            </select>
                          )}
                        </div>
                        
                        {/* 🔹 DUAL LANGUAGE TITLES COLUMN */}
                        <div className={isEnglishSubject ? "col-span-3" : "col-span-4"}>
                          <div className="flex flex-col gap-1.5">
                             {/* English Title Input */}
                             <div className="flex gap-1">
                                {isCustomTitleMode ? (
                                   <input 
                                     value={s.title} 
                                     onChange={e => handleUpdateSection(s.id, 'title', e.target.value)} 
                                     className="w-full bg-gray-800 text-theme-text-main text-[10px] p-1.5 rounded-md border border-gray-600 outline-none" 
                                     placeholder="English Heading" 
                                   />
                                ) : (
                                   <select 
                                      value={s.title} 
                                      onChange={e => {
                                        if (e.target.value === 'OTHER_TITLE') setCustomTitleModes(prev => ({...prev, [s.id]: true}));
                                        else handleUpdateSection(s.id, 'title', e.target.value);
                                      }} 
                                      className="w-full bg-gray-800 text-theme-text-main text-[10px] p-1.5 rounded-md border border-gray-700 outline-none"
                                   >
                                      {suggestions.map(title => <option key={title} value={title} className="bg-gray-800">{title}</option>)}
                                      <option value="OTHER_TITLE" className="bg-gray-800">Manual Entry...</option>
                                   </select>
                                )}
                             </div>
                             {/* Urdu Title Input */}
                             <input 
                                value={s.titleUrdu || ''} 
                                onChange={e => handleUpdateSection(s.id, 'titleUrdu', e.target.value)} 
                                className="w-full bg-gray-800 text-gold-500 text-[10px] p-1.5 rounded-md border border-gray-700 outline-none font-urdu text-right" 
                                placeholder="اردو عنوان" 
                                dir="rtl"
                             />
                          </div>
                        </div>

                        {/* 🔹 MARKS VISIBILITY TOGGLE */}
                        <div className="col-span-1">
                          <div className="flex items-center justify-center gap-2 bg-gray-800 p-1.5 rounded-lg border border-gray-700">
                             <button 
                               onClick={() => handleUpdateSection(s.id, 'hideSectionMarks', !s.hideSectionMarks)}
                               className={`p-1 rounded transition-colors ${s.hideSectionMarks ? 'text-red-500 bg-red-500/10' : 'text-emerald-500 bg-emerald-500/10'}`}
                               title={s.hideSectionMarks ? "Section Marks Hidden" : "Section Marks Visible"}
                             >
                                {s.hideSectionMarks ? <EyeOff size={14} /> : <Eye size={14} />}
                             </button>
                             <button 
                               onClick={() => handleUpdateSection(s.id, 'hideSubPartMarks', !s.hideSubPartMarks)}
                               className={`p-1 rounded transition-colors ${s.hideSubPartMarks ? 'text-red-500 bg-red-500/10' : 'text-emerald-500 bg-emerald-500/10'}`}
                               title={s.hideSubPartMarks ? "Question Marks Hidden" : "Question Marks Visible"}
                             >
                                <Hash size={14} />
                             </button>
                          </div>
                        </div>

                        <div className="col-span-1">
                          <input 
                            type="number" 
                            disabled={isMCQ && !!(s.subParts && s.subParts.length > 0)}
                            value={s.questionCount} 
                            onChange={e => handleUpdateSection(s.id, 'questionCount', parseInt(e.target.value) || 0)} 
                            className={`w-full bg-gray-800 text-theme-text-main text-[10px] p-2 rounded-lg border border-gray-700 text-center outline-none ${isMCQ && s.subParts && s.subParts.length > 0 ? 'opacity-50' : ''}`} 
                          />
                        </div>
                        <div className="col-span-1">
                          <input 
                            type="number" 
                            disabled={isMCQ && !!(s.subParts && s.subParts.length > 0)}
                            value={s.attemptCount} 
                            onChange={e => handleUpdateSection(s.id, 'attemptCount', parseInt(e.target.value) || 0)} 
                            className={`w-full bg-gray-800 text-gold-500 font-bold text-[10px] p-2 rounded-lg border border-gray-700 text-center outline-none ${isMCQ && s.subParts && s.subParts.length > 0 ? 'opacity-50' : ''}`} 
                          />
                        </div>
                        <div className="col-span-1">
                          <input 
                            type="number" 
                            disabled={!!(s.subParts && s.subParts.length > 0)}
                            value={s.marksPerQuestion} 
                            onChange={e => handleUpdateSection(s.id, 'marksPerQuestion', parseInt(e.target.value) || 0)} 
                            className={`w-full bg-gray-800 text-theme-text-main text-[10px] p-2 rounded-lg border border-gray-700 text-center outline-none ${s.subParts && s.subParts.length > 0 ? 'opacity-50 cursor-not-allowed bg-gray-950' : ''}`} 
                          />
                        </div>

                        {/* 🔹 MANDATORY CHAPTERS INPUT */}
                        <div className="col-span-2">
                           <input 
                             type="text" 
                             value={s.specificChapters?.join(', ') || ''} 
                             onChange={e => handleUpdateSection(s.id, 'specificChapters', e.target.value)} 
                             className="w-full bg-gray-800 text-theme-text-main text-[10px] p-2 rounded-lg border border-gray-700 outline-none" 
                             placeholder="e.g. 1, 2, 3" 
                           />
                        </div>

                        <div className="col-span-1 flex justify-center gap-1">
                           {((isEnglish && (s.type === 'Short' || s.type === 'MCQ' || s.type === 'Summary' || s.type === 'Long' || s.type === 'Letter')) || (!isEnglish && (s.type.toUpperCase() === 'SHORT' || s.type.toUpperCase() === 'LONG' || s.type.toUpperCase() === 'NUMERICAL'))) && (
                             <button 
                               onClick={() => handleToggleParts(s.id)}
                               className={`p-1.5 rounded transition-all ${isExpanded ? 'bg-gold-500 text-black' : 'text-gold-500 hover:bg-gold-500/10'}`}
                               title="Configure Question Sub-parts (a, b, c) or Alternatives (OR)"
                             >
                               <ListTree size={16} />
                             </button>
                           )}
                           <button onClick={() => handleRemoveSection(s.id)} className="text-red-500 p-1.5 hover:bg-red-900/20 rounded transition-all"><Trash2 size={16} /></button>
                        </div>
                     </div>

                     {isExpanded && (
                       <div className="ml-8 p-4 bg-gray-800/50 border border-gold-500/30 rounded-xl animate-fadeIn space-y-3">
                          <div className="flex justify-between items-center mb-2 text-[10px] font-black uppercase tracking-widest text-gold-500">
                             <div className="flex items-center gap-2">
                               <Info size={12} /> Manage Sub-parts for Question {idx + 1}
                             </div>
                             <button 
                               onClick={() => handleAddPart(s.id)}
                               className="bg-gold-500/10 text-gold-500 border border-gold-500/30 px-3 py-1 rounded hover:bg-gold-500 hover:text-black transition-all flex items-center gap-1"
                             >
                               <Plus size={10} /> Add Part
                             </button>
                          </div>

                          <div className="space-y-2">
                             <div className="grid grid-cols-12 gap-2 mb-1 text-[8px] font-black uppercase text-theme-text-sub tracking-tighter">
                                <div className="col-span-2 text-center">Type</div>
                                <div className="col-span-2">Instructions</div>
                                <div className="col-span-1 text-center">Marks</div>
                                <div className="col-span-1 text-center">Total Qs</div>
                                <div className="col-span-1 text-center">Attempt</div>
                                <div className="col-span-2 text-center">Chapters</div>
                                <div className="col-span-2 text-center">Alternative?</div>
                                <div className="col-span-1 text-center">Action</div>
                             </div>
                             {s.subParts?.map((part, pIdx) => {
                               const partTypes = isEnglishSubject ? (isMCQ ? ENGLISH_MCQ_SUBTYPES : ENGLISH_SPECIFIC_TYPES) : PREDEFINED_TYPES;

                               return (
                                 <div key={part.id} className="grid grid-cols-12 gap-2 items-center bg-gray-950/30 p-2 rounded-lg border border-gray-700/50">
                                    <div className="col-span-2">
                                       <select 
                                         value={part.type || s.type} 
                                         onChange={e => handleUpdatePart(s.id, part.id, 'type', e.target.value)}
                                         className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-theme-text-main outline-none focus:border-gold-500 font-bold"
                                       >
                                          {partTypes.map(pt => (
                                            <option key={pt} value={pt} className="bg-gray-800">{pt}</option>
                                          ))}
                                       </select>
                                    </div>
                                    <div className="col-span-2">
                                       <input 
                                         value={part.label} 
                                         onChange={e => handleUpdatePart(s.id, part.id, 'label', e.target.value)}
                                         className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-theme-text-main outline-none focus:border-gold-500"
                                         placeholder="Instruction Text"
                                       />
                                    </div>
                                    
                                    <div className="col-span-1">
                                       <input 
                                         type="number"
                                         value={part.marks} 
                                         onChange={e => handleUpdatePart(s.id, part.id, 'marks', parseInt(e.target.value) || 0)}
                                         className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-gold-500 font-black text-center outline-none focus:border-gold-500"
                                       />
                                    </div>

                                    {/* 🔹 SUB-PART TOTAL QUESTIONS */}
                                    <div className="col-span-1">
                                       <input 
                                         type="number"
                                         value={part.questionCount || 0} 
                                         onChange={e => handleUpdatePart(s.id, part.id, 'questionCount', parseInt(e.target.value) || 0)}
                                         className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-theme-text-main font-bold text-center outline-none focus:border-gold-500"
                                       />
                                    </div>

                                    {/* 🔹 SUB-PART ATTEMPT COUNT */}
                                    <div className="col-span-1">
                                       <input 
                                         type="number"
                                         value={part.attemptCount || 0} 
                                         onChange={e => handleUpdatePart(s.id, part.id, 'attemptCount', parseInt(e.target.value) || 0)}
                                         className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-gold-500 font-bold text-center outline-none focus:border-gold-500"
                                       />
                                    </div>
                                    
                                    <div className="col-span-2">
                                       <input 
                                         type="text"
                                         value={part.specificChapters?.join(', ') || ''} 
                                         onChange={e => handleUpdatePart(s.id, part.id, 'specificChapters', e.target.value)}
                                         className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-theme-text-main outline-none focus:border-gold-500"
                                         placeholder="e.g. 1, 2"
                                       />
                                    </div>

                                    <div className="col-span-2 flex justify-center">
                                       {pIdx > 0 && (
                                         <button 
                                           onClick={() => handleUpdatePart(s.id, part.id, 'isAlternative', !part.isAlternative)}
                                           className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${part.isAlternative ? 'bg-gold-500 text-black border-gold-500' : 'bg-gray-800 text-theme-text-sub border border-gray-700 hover:text-theme-text-main'}`}
                                         >
                                            <Split size={10} /> {part.isAlternative ? 'OR Enabled' : 'Add OR'}
                                         </button>
                                       )}
                                    </div>

                                    <div className="col-span-1 flex justify-end">
                                       <button 
                                         onClick={() => handleRemovePart(s.id, part.id)}
                                         className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-all"
                                       >
                                         <Trash2 size={12} />
                                       </button>
                                    </div>
                                 </div>
                               );
                             })}
                          </div>
                       </div>
                     )}
                   </div>
                 );
               })}
           </div>

           <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-950/40 p-6 rounded-2xl border border-gray-700 gap-6">
               <div className="flex gap-3 w-full sm:w-auto">
                  <Button variant="secondary" onClick={() => setView('LIST')} className="!w-auto px-6 border-gray-700">Cancel</Button>
                  <Button onClick={handleSavePattern} isLoading={isSaving} className="!w-auto px-10 font-black uppercase">Confirm Layout</Button>
               </div>
               <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-gray-700 pt-4 sm:pt-0 sm:pl-8 w-full sm:w-auto">
                  <p className="text-[10px] text-theme-text-sub uppercase font-black tracking-widest mb-1">Cumulative Marks</p>
                  <p className="text-4xl font-black text-gold-500 leading-none">{sections.reduce((acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 0)}</p>
               </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10 h-16 flex items-center px-6">
        <button onClick={() => view === 'SUBJECTS' ? onBack() : setView('SUBJECTS')} className="text-theme-text-muted hover:text-gold-500 flex items-center transition-colors">
          <ArrowLeft size={20} className="mr-1" /> Back
        </button>
        <div className="flex-grow text-center text-lg font-bold text-theme-text-main tracking-widest uppercase">Exam Layouts</div>
        <div className="w-16"></div>
      </header>
      <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full">
        {view === 'SUBJECTS' && renderSubjectGrid()}
        {view === 'LIST' && renderPatternList()}
        {view === 'CREATE' && renderCreateForm()}
      </main>
    </div>
  );
};