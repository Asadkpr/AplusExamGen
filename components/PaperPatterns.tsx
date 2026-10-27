import React, { useState, useEffect, useRef } from 'react';
import { User, PaperPattern, PaperPatternSection, PaperPatternSectionPart, Chapter } from '../types';
import { getPatterns, savePattern, deletePattern, subscribeToPatterns } from '../services/patternService';
import { getSubjects } from '../services/subjectService';
import { getChapters } from '../services/chapterService';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { CLASSES, CARD_COLORS } from '../constants';
import { 
  ArrowLeft, Plus, Trash2, Edit, Save, X, Layout, RefreshCw,
  Layers, CheckSquare, Square, Check, Search, Info, Globe, AlertTriangle,
  BookOpen, ChevronDown, ChevronUp, Type as TypeIcon, ListTree, Clock, ListFilter,
  Split, Eye, EyeOff, Hash, GraduationCap
} from 'lucide-react';

interface PaperPatternsProps {
  user: User;
  onBack: () => void;
  onUsePattern?: (pattern: PaperPattern) => void;
}

// Standardized list with user-friendly casing
export const PREDEFINED_TYPES = [
  'MCQ', 'Short', 'Long', 'Numerical', 'Letter', 'Application', 'Story', 'Dialogue', 'Punctuation', 
  'Pair of words', 'Translate passage In urdu', 'Translate passage to English', 'Essay',
  'تشریح اشعار', 'سیاق و سباق کے حوالے سے تشریح', 'سبق کا خلاصہ', 'نظم کا مرکزی خیال',
  'مکالمہ', 'درخواست', 'تلخیص نگاری', 'الفاظ معنی', 'آیات کا ترجمہ', 'احادیث کی تشریح'
];

export const ENGLISH_SPECIFIC_TYPES = [
  'MCQ', 'Short', 'Long', 'Translate', 'Summary', 'Idioms', 'Essay', 'Passage', 'Sentences', 'Alternate', 'Voice', 'Paraphrase', 'Letter', 'Story', 'Dialogue'
];

export const ENGLISH_MCQ_SUBTYPES = ['Verb', 'Spelling', 'Meaning', 'Grammar'];

export const ENGLISH_SUBTYPE_INSTRUCTIONS: Record<string, string> = {
  'Verb': 'Choose the correct form of verb and fill up the bubbles.',
  'Spelling': 'Choose the word with correct spellings and fill up the bubbles.',
  'Meaning': 'Choose the correct meanings of the underlined words and fill up the bubbles.',
  'Grammar': 'Choose the correct option according to grammar and fill up the bubbles.'
};

export const SECTION_HEADINGS = ['None', 'SECTION – I', 'SECTION – II', 'SECTION – III', 'OBJECTIVE PART', 'SUBJECTIVE PART'];

export const getAutoSectionHeading = (type: string): string => {
  const upper = (type || '').toUpperCase().trim();
  if (upper === 'MCQ') return 'SECTION – I';
  if (upper === 'SHORT') return 'SECTION – II';
  if (upper === 'LONG') return 'SECTION – III';
  return 'None';
};

export const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text || '');

export const getSectionTagStyles = (type: string) => {
  const upper = type.toUpperCase();
  
  // 🔹 URDU & ISLAMIYAT TYPES (GOLD)
  if (isUrdu(type) || upper.includes('تشریح') || upper.includes('ترجمہ') || upper.includes('خلاصہ')) {
    return 'bg-gold-500/20 text-gold-500 border-gold-500/40 ring-gold-500/10 [.light-theme_&]:bg-gold-100 [.light-theme_&]:text-gold-700 [.light-theme_&]:border-gold-200';
  }
  
  // 🔹 OBJECTIVE / GRAMMAR (BLUE)
  if (upper === 'MCQ' || ['VERB', 'SPELLING', 'MEANING', 'GRAMMAR', 'SYNONYM'].some(t => upper.includes(t))) {
    return 'bg-blue-500/20 text-blue-600 border-blue-500/40 ring-blue-500/10 [.light-theme_&]:bg-blue-100 [.light-theme_&]:text-blue-700 [.light-theme_&]:border-blue-200';
  }
  
  // 🔹 CONCEPTUAL / SHORT (EMERALD)
  if (upper.includes('SHORT')) {
    return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40 ring-emerald-500/10 [.light-theme_&]:bg-emerald-100 [.light-theme_&]:text-emerald-700 [.light-theme_&]:border-emerald-200';
  }
  
  // 🔹 THEORY / LONG (PURPLE)
  if (upper.includes('LONG') || upper.includes('THEORY')) {
    return 'bg-purple-500/20 text-purple-600 border-purple-500/40 ring-purple-500/10 [.light-theme_&]:bg-purple-100 [.light-theme_&]:text-purple-700 [.light-theme_&]:border-purple-200';
  }
  
  // 🔹 APPLIED / MATH (ORANGE)
  if (upper.includes('NUMERICAL') || upper.includes('PROBLEM') || upper.includes('CALC')) {
    return 'bg-orange-500/20 text-orange-600 border-orange-500/40 ring-orange-500/10 [.light-theme_&]:bg-orange-100 [.light-theme_&]:text-orange-700 [.light-theme_&]:border-orange-200';
  }
  
  // 🔹 CREATIVE WRITING (ROSE)
  if (['ESSAY', 'LETTER', 'STORY', 'DIALOGUE', 'APPLICATION'].some(t => upper.includes(t))) {
    return 'bg-rose-500/20 text-rose-600 border-rose-500/40 ring-rose-500/10 [.light-theme_&]:bg-rose-100 [.light-theme_&]:text-rose-700 [.light-theme_&]:border-rose-200';
  }
  
  // 🔹 COMPREHENSION / ANALYSIS (CYAN)
  if (['TRANSLATE', 'SUMMARY', 'PARAPHRASE', 'PASSAGE', 'VOICE', 'COMPREHENSION'].some(t => upper.includes(t))) {
    return 'bg-cyan-500/20 text-cyan-600 border-cyan-500/40 ring-cyan-500/10 [.light-theme_&]:bg-cyan-100 [.light-theme_&]:text-cyan-700 [.light-theme_&]:border-cyan-200';
  }
  
  // 🔹 VOCABULARY / OTHER (AMBER)
  if (['IDIOMS', 'SENTENCES', 'ALTERNATE', 'PAIR', 'PUNCTUATION'].some(t => upper.includes(t))) {
    return 'bg-amber-500/20 text-amber-600 border-amber-500/40 ring-amber-500/10 [.light-theme_&]:bg-amber-100 [.light-theme_&]:text-amber-700 [.light-theme_&]:border-amber-200';
  }

  return 'bg-gray-500/10 text-theme-text-muted border-gray-500/30';
};

export const getAutoTitle = (type: string, count: number, marks: number, index: number, isEnglish?: boolean): string | null => {
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

export const getAutoUrduTitle = (type: string, count: number, marks: number, index: number): string | null => {
  const upperType = type.toUpperCase();
  let baseTitle = '';

  if (upperType === 'MCQ') {
    baseTitle = "درست جواب کے گرد دائرہ لگائیں۔";
  } else if (upperType === 'SHORT') {
    baseTitle = `کوئی سے ${count} مختصر سوالات کے جوابات دیں۔`;
  } else if (upperType === 'LONG') {
    baseTitle = `کوئی سے ${count} تفصیلی سوالات کے جوابات دیں۔`;
  } else if (upperType === 'NUMERICAL') {
    baseTitle = "دیے گئے حسابی سوالات حل کریں۔";
  } else {
    const key = Object.keys(TYPE_URDU_TITLE_MAPPING).find(k => k.toUpperCase() === upperType);
    const suggestions = key ? TYPE_URDU_TITLE_MAPPING[key] : [];
    baseTitle = suggestions[0] || (isUrdu(type) ? type : '');
  }

  if (!baseTitle) return '';

  const cleanBase = baseTitle
    .replace(/^سوال نمبر \d+\. /, '')
    .replace(/^سوال نمبر \. \d+/, '')
    .trim();

  return `سوال نمبر ${index + 1}۔ ${cleanBase}`;
};

export const getSectionSortRank = (type: string): number => {
  const upper = (type || '').toUpperCase().trim();
  if (!upper) return 99;
  
  // 1. MCQs / Objective always first
  if (['MCQ', 'MCQS', 'MULTIPLE CHOICE', 'OBJECTIVE', 'معروضی', 'کثیر'].some(k => upper.includes(k.toUpperCase()))) {
    return 1;
  }
  // 2. Short Questions / مختصر always second
  if (['SHORT', 'مختصر', 'سوالات کے مختصر جوابات'].some(k => upper.includes(k.toUpperCase()))) {
    return 2;
  }
  // 3. Long Questions / Detailed / تفصیلی / انشائیہ always third
  if (['LONG', 'THEORY', 'تفصیلی', 'انشائیہ'].some(k => upper.includes(k.toUpperCase()))) {
    return 3;
  }
  // 4. Numerical / Problem / حسابی
  if (['NUMERICAL', 'PROBLEM', 'حسابی', 'عددی'].some(k => upper.includes(k.toUpperCase()))) {
    return 4;
  }
  // 5. Language specific components (Translation, Summary, Comprehension, etc.)
  if (['TRANSLAT', 'ترجمہ', 'SUMMAR', 'خلاصہ', 'COMPREHENSION', 'تفہیم'].some(k => upper.includes(k.toUpperCase()))) {
    return 5;
  }
  if (['ESSAY', 'مضمون', 'LETTER', 'خط', 'APPLICATION', 'درخواست', 'STORY', 'کہانی', 'DIALOGUE', 'مکالمہ'].some(k => upper.includes(k.toUpperCase()))) {
    return 6;
  }
  if (['تشریح', 'PAIR', 'IDIOM', 'الفاظ'].some(k => upper.includes(k.toUpperCase()))) {
    return 7;
  }
  return 8;
};

export const sortSectionsByStandardSequence = (
  sections: PaperPatternSection[], 
  isEnglishSubject?: boolean
): PaperPatternSection[] => {
  const indexed = sections.map((s, originalIndex) => ({ s, originalIndex }));
  indexed.sort((a, b) => {
    const rankA = getSectionSortRank(a.s.type);
    const rankB = getSectionSortRank(b.s.type);
    if (rankA !== rankB) return rankA - rankB;
    return a.originalIndex - b.originalIndex;
  });

  return indexed.map((item, newIdx) => {
    const sec = item.s;
    let nextTitle = sec.title || '';
    let nextTitleUrdu = sec.titleUrdu || '';

    // Preserve user/admin custom title text, only updating Q# prefix or generating if empty
    if (nextTitle.trim()) {
      if (/^Q\d+\.\s*/i.test(nextTitle)) {
        nextTitle = nextTitle.replace(/^Q\d+\.\s*/i, `Q${newIdx + 1}. `);
      } else if (/^سوال نمبر\s*\d+[.۔]\s*/.test(nextTitle)) {
        nextTitle = nextTitle.replace(/^سوال نمبر\s*\d+[.۔]\s*/, `سوال نمبر ${newIdx + 1}. `);
      }
    } else {
      nextTitle = getAutoTitle(sec.type, sec.attemptCount, sec.marksPerQuestion, newIdx, isEnglishSubject) || '';
    }

    if (nextTitleUrdu.trim()) {
      if (/^سوال نمبر\s*\d+[.۔]\s*/.test(nextTitleUrdu)) {
        nextTitleUrdu = nextTitleUrdu.replace(/^سوال نمبر\s*\d+[.۔]\s*/, `سوال نمبر ${newIdx + 1}۔ `);
      }
    } else {
      nextTitleUrdu = getAutoUrduTitle(sec.type, sec.attemptCount, sec.marksPerQuestion, newIdx) || '';
    }

    return {
      ...sec,
      title: nextTitle,
      titleUrdu: nextTitleUrdu
    };
  });
};

export const TYPE_TITLE_MAPPING: Record<string, string[]> = {
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

export const TYPE_URDU_TITLE_MAPPING: Record<string, string[]> = {
  'MCQ': ['درست جواب کے گرد دائرہ لگائیں۔', 'کثیر الانتخابی سوالات'],
  'Short': ['کوئی سے مختصر سوالات کے جوابات دیں۔', 'مختصر سوالات'],
  'Long': ['تفصیلی سوالات کے جوابات دیں۔', 'انشائیہ حصہ'],
  'Numerical': ['حسابی سوالات حل کریں۔', 'عددی مسائل'],
  'Translate': ['اردو میں ترجمہ کریں۔', 'ترجمہ'],
  'Summary': ['نظم کا خلاصہ لکھیں۔', 'خلاصہ'],
  'Paraphrase': ['اشعار کی تشریح کریں۔', 'تشریح'],
  'Idioms': ['محاورات کو جملوں میں استعمال کریں۔', 'محاورات'],
  'Essay': ['مضمون لکھیں۔', 'مضمون نویسی'],
  'Passage': ['عبارت پڑھ کر سوالات کے جوابات دیں۔', 'تفہیم عبارت'],
  'Sentences': ['جملے بنائیں۔', 'جملہ سازی'],
  'Letter': ['خط لکھیں۔', 'خطوط نویسی'],
  'Application': ['درخواست لکھیں۔', 'درخواست نویسی'],
  'Story': ['کہانی لکھیں۔', 'کہانی نویسی'],
  'Dialogue': ['مکالمہ لکھیں۔', 'مکالمہ نگاری'],
  'تشریح اشعار': ['اشعار کی تشریح کریں'],
  'سیاق و سباق کے حوالے سے تشریح': ['سیاق و سباق کے ساتھ تشریح'],
  'سبق کا خلاصہ': ['سبق کا خلاصہ لکھیں'],
  'نظم کا مرکزی خیال': ['نظم کا مرکزی خیال لکھیں'],
  'مکالمہ': ['مکالمہ تحریر کریں'],
  'درخواست': ['درخواست برائے رخصت'],
  'تلخیص نگاری': ['عبارت کی تلخیص کریں'],
  'الفاظ معنی': ['الفاظ کے معنی لکھیں'],
  'آیات کا ترجمہ': ['آیات کا با محاورہ ترجمہ کریں'],
  'احادیث کی تشریح': ['حدیث کی تشریح کریں'],
};

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const ChapterSelector: React.FC<{
  selectedChapters: string[];
  availableChapters: Chapter[];
  onChange: (chapters: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  id: string;
}> = ({ selectedChapters, availableChapters, onChange, isOpen, onToggle, id }) => {
  const getChapterNumber = (name: string) => {
    const match = name.match(/\d+/);
    return match ? match[0] : name;
  };

  const toggleChapter = (chapterName: string) => {
    const chapterNumber = getChapterNumber(chapterName);
    const isSelected = selectedChapters.includes(chapterNumber);
    if (isSelected) {
      onChange(selectedChapters.filter(n => n !== chapterNumber));
    } else {
      onChange([...selectedChapters, chapterNumber]);
    }
  };

  const selectedDisplay = [...selectedChapters]
    .sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    })
    .join(', ');

  return (
    <div className="relative chapter-dropdown-container">
      <div 
        onClick={onToggle}
        className={`w-full bg-gray-800 text-theme-text-main text-[10px] p-2 rounded-lg border cursor-pointer flex justify-between items-center min-h-[32px] ${isOpen ? 'border-gold-500' : 'border-gray-700'}`}
      >
        <span className="truncate max-w-[100px]">
          {selectedDisplay || <span className="text-gray-500 italic">Select Chapters...</span>}
        </span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 z-[110] mt-1 bg-gray-800 border border-gold-500/50 rounded-lg shadow-2xl max-h-60 overflow-y-auto custom-scrollbar p-2 animate-scaleIn min-w-full md:min-w-[300px]">
          {availableChapters.length === 0 ? (
            <div className="text-[10px] text-gray-500 p-2 italic">No chapters found</div>
          ) : (
            availableChapters.map(ch => {
              const chapterNumber = getChapterNumber(ch.name);
              const isSelected = selectedChapters.includes(chapterNumber);
              return (
                <div 
                  key={ch.id} 
                  onClick={() => toggleChapter(ch.name)}
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-gray-750 transition-colors ${isSelected ? 'text-gold-500' : 'text-theme-text-muted'}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  </div>
                  <span className="text-[10px] font-bold leading-tight">{ch.name}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export const PaperPatterns: React.FC<PaperPatternsProps> = ({ user, onBack, onUsePattern }) => {
  const [view, setView] = useState<'CLASSES' | 'SUBJECTS' | 'LIST' | 'CREATE'>('CLASSES');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [patterns, setPatterns] = useState<PaperPattern[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, string[]>>({});
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
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
  const [visiblePatternCount, setVisiblePatternCount] = useState(20);
  const [openChapterDropdownId, setOpenChapterDropdownId] = useState<string | null>(null);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string, field: 'title' | 'titleUrdu') => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const value = e.currentTarget.value;
      const newValue = value.substring(0, start) + "\n" + value.substring(end);
      handleUpdateSection(id, field, newValue);
      
      const target = e.currentTarget;
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    }
  };

  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allPatterns = await getPatterns(true);
      setPatterns(allPatterns);
      const sMap = await getSubjects(true);
      setSubjectsMap(sMap);
    } catch (e) {
      console.error("Error loading patterns", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsub = subscribeToPatterns((livePatterns) => {
      setPatterns(livePatterns);
      setIsLoading(false);
    });
    getSubjects(true).then(sMap => setSubjectsMap(sMap)).catch(console.warn);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (view === 'CREATE' && formData.classLevel && (editingPattern?.subject || selectedSubject)) {
      const fetchChapters = async () => {
        const chapters = await getChapters(editingPattern?.subject || selectedSubject, formData.classLevel, false, true);
        setAvailableChapters(chapters);
      };
      fetchChapters();
    }
  }, [view, formData.classLevel, selectedSubject, editingPattern?.subject]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
      // Close chapter dropdowns if clicked outside
      if (!(event.target as HTMLElement).closest('.chapter-dropdown-container')) {
        setOpenChapterDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClassClick = (cls: string) => {
    setSelectedClass(cls);
    setView('SUBJECTS');
  };

  const handleSubjectClick = (subject: string) => {
    setSelectedSubject(subject);
    setSearchTerm('');
    setVisiblePatternCount(20);
    setView('LIST');
  };

  const handleCreateNew = () => {
    setFormData({ name: '', description: '', classLevel: selectedClass, selectedSubjects: [], timeAllowed: '2:00 Hours' });
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
      classLevel: pattern.classLevel || selectedClass,
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
    const autoUrduTitle = getAutoUrduTitle(type, 10, 1, index);
    const newSection: PaperPatternSection = {
      id: sectionId, 
      type: type, 
      title: autoTitle || `Q${index + 1}. Attempt all.`, 
      titleUrdu: autoUrduTitle || `سوال نمبر ${index + 1}۔ تمام سوالات کے جوابات دیں۔`,
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

             const autoUrduTitle = getAutoUrduTitle(updatedType, updatedCount, updatedMarks, idx);
             if (autoUrduTitle) {
               nextSection.titleUrdu = autoUrduTitle;
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
      setPatterns(prev => prev.filter(p => p.id !== id));
      await deletePattern(id);
    }
  };

  const renderClassGrid = () => (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-8">
         <h2 className="text-2xl font-bold text-theme-text-main uppercase tracking-widest">Select Class</h2>
         <button onClick={loadData} className="flex items-center gap-2 text-sm text-gold-500 hover:text-theme-text-main transition-colors" disabled={isLoading}>
           <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh List
         </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {CLASSES.map((cls, idx) => {
          const color = CARD_COLORS[idx % CARD_COLORS.length];
          return (
          <div key={cls} onClick={() => handleClassClick(cls)} className={`group relative cursor-pointer rounded-2xl border-2 bg-surface-800/80 backdrop-blur-sm p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 overflow-hidden w-full aspect-square md:aspect-[4/3] ${color.border} ${color.hoverBorder} hover:bg-surface-800 hover:-translate-y-1 ${color.shadow}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${color.from} ${color.to} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className={`relative z-10 text-theme-text-muted ${color.groupHoverIcon} transition-colors duration-300 transform group-hover:scale-110`}>
                <GraduationCap size={40} />
            </div>
            <h3 className="relative z-10 font-black text-theme-text-main text-lg tracking-tight group-hover:tracking-wide transition-all duration-300 text-center leading-tight">{cls}</h3>
          </div>
        )})}
      </div>
    </div>
  );

  const renderSubjectGrid = () => {
    const classSubjects = subjectsMap[selectedClass] || [];
    return (
      <div className="animate-fadeIn">
        <div className="flex justify-between items-center mb-8">
           <h2 className="text-2xl font-bold text-theme-text-main uppercase tracking-widest">
             Subjects for <span className="text-gold-500">{selectedClass}</span>
           </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {classSubjects.map((subject, idx) => {
            const patternCount = patterns.filter(p => (p.subject?.toLowerCase() === subject.toLowerCase() && p.classLevel === selectedClass) || (!p.subject && p.classLevel === selectedClass)).length;
            const color = CARD_COLORS[idx % CARD_COLORS.length];
            return (
              <div key={subject} onClick={() => handleSubjectClick(subject)} className={`group relative cursor-pointer rounded-2xl border-2 bg-surface-800/80 backdrop-blur-sm p-5 flex flex-col items-center justify-center gap-3 text-center transition-all duration-300 overflow-hidden w-full h-36 ${color.border} ${color.hoverBorder} hover:bg-surface-800 hover:-translate-y-1 ${color.shadow}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${color.from} ${color.to} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className={`relative z-10 text-theme-text-muted ${color.groupHoverIcon} transition-colors duration-300`}>
                    <Layers size={28} className="transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="relative z-10 font-bold text-theme-text-sub group-hover:text-theme-text-main text-base md:text-lg leading-tight transition-all duration-300 group-hover:tracking-wide">{subject}</h3>
                <div className={`relative z-10 mt-1 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest transition-colors bg-surface-900 text-theme-text-muted border ${color.border} group-hover:bg-white/10 ${color.groupHoverIcon} group-hover:${color.border.replace('border-', 'border-')}`}>{patternCount} Patterns</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPatternList = () => {
    const subjectPatterns = patterns.filter(p => 
      ((!p.subject) || p.subject.toLowerCase() === selectedSubject.toLowerCase()) &&
      p.classLevel === selectedClass &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div className="animate-fadeIn">
         <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
               <h2 className="text-2xl font-bold text-theme-text-main flex items-center gap-2 uppercase tracking-tighter">
                 <span className="text-gold-500">{selectedSubject}</span> Patterns ({selectedClass})
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
           <div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {subjectPatterns.slice(0, visiblePatternCount).map(pattern => (
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
               {visiblePatternCount < subjectPatterns.length && (
                  <div className="flex justify-center mt-8">
                     <Button onClick={() => setVisiblePatternCount(prev => prev + 20)} variant="outline" className="w-full md:w-64 font-bold tracking-widest text-[12px] uppercase h-12">
                        Load More
                     </Button>
                  </div>
               )}
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
                                   <textarea 
                                     value={s.title} 
                                     onChange={e => handleUpdateSection(s.id, 'title', e.target.value)} 
                                     onKeyDown={e => handleTitleKeyDown(e, s.id, 'title')}
                                     className="w-full bg-gray-800 text-theme-text-main text-[10px] p-1.5 rounded-md border border-gray-600 outline-none resize-none overflow-hidden min-h-[32px]" 
                                     placeholder="English Heading" 
                                     rows={1}
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
                             <textarea 
                                value={s.titleUrdu || ''} 
                                onChange={e => handleUpdateSection(s.id, 'titleUrdu', e.target.value)} 
                                onKeyDown={e => handleTitleKeyDown(e, s.id, 'titleUrdu')}
                                className="w-full bg-gray-800 text-gold-500 text-[10px] p-1.5 rounded-md border border-gray-700 outline-none font-urdu text-right resize-none overflow-hidden min-h-[32px]" 
                                placeholder="اردو عنوان" 
                                dir="rtl"
                                rows={1}
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
                           <ChapterSelector 
                             id={s.id}
                             selectedChapters={s.specificChapters || []}
                             availableChapters={availableChapters}
                             onChange={chapters => handleUpdateSection(s.id, 'specificChapters', chapters)}
                             isOpen={openChapterDropdownId === s.id}
                             onToggle={() => setOpenChapterDropdownId(openChapterDropdownId === s.id ? null : s.id)}
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
                                       <ChapterSelector 
                                         id={part.id}
                                         selectedChapters={part.specificChapters || []}
                                         availableChapters={availableChapters}
                                         onChange={chapters => handleUpdatePart(s.id, part.id, 'specificChapters', chapters)}
                                         isOpen={openChapterDropdownId === part.id}
                                         onToggle={() => setOpenChapterDropdownId(openChapterDropdownId === part.id ? null : part.id)}
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

  const handleGlobalBack = () => {
    if (view === 'CLASSES') onBack();
    else if (view === 'SUBJECTS') setView('CLASSES');
    else if (view === 'LIST') setView('SUBJECTS');
    else if (view === 'CREATE') setView('LIST');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10 h-16 flex items-center px-6">
        <button onClick={handleGlobalBack} className="text-theme-text-muted hover:text-gold-500 flex items-center transition-colors">
          <ArrowLeft size={20} className="mr-1" /> Back
        </button>
        <div className="flex-grow text-center text-lg font-bold text-theme-text-main tracking-widest uppercase">Exam Layouts</div>
        <div className="w-16"></div>
      </header>
      <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full">
        {view === 'CLASSES' && renderClassGrid()}
        {view === 'SUBJECTS' && renderSubjectGrid()}
        {view === 'LIST' && renderPatternList()}
        {view === 'CREATE' && renderCreateForm()}
      </main>
    </div>
  );
};
