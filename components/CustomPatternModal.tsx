import React, { useState, useEffect } from 'react';
import { User, PaperPattern, PaperPatternSection, PaperPatternSectionPart, Chapter } from '../types';
import { 
  PREDEFINED_TYPES, 
  ENGLISH_SPECIFIC_TYPES, 
  ENGLISH_MCQ_SUBTYPES, 
  ENGLISH_SUBTYPE_INSTRUCTIONS, 
  SECTION_HEADINGS, 
  TYPE_TITLE_MAPPING,
  getAutoSectionHeading,
  isUrdu, 
  getAutoTitle, 
  getAutoUrduTitle, 
  generateId, 
  ChapterSelector,
  getSectionSortRank,
  sortSectionsByStandardSequence
} from './PaperPatterns';
import { Button } from './Button';
import { savePattern } from '../services/patternService';
import { 
  X, Plus, Trash2, Clock, Layers, BookOpen, 
  Eye, EyeOff, Hash, ListTree, Sparkles, AlertTriangle, 
  Sliders, ChevronRight, Check, BookmarkCheck, Edit
} from 'lucide-react';

interface CustomPatternModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPattern: (pattern: PaperPattern) => void;
  classLevel: string;
  subject: string;
  availableChapters: Chapter[];
  user?: User;
  initialPattern?: PaperPattern | null;
}

export const CustomPatternModal: React.FC<CustomPatternModalProps> = ({
  isOpen,
  onClose,
  onApplyPattern,
  classLevel,
  subject,
  availableChapters,
  user,
  initialPattern
}) => {
  const isEnglishSubject = (subject || '').toLowerCase() === 'english';

  const [patternName, setPatternName] = useState(
    initialPattern?.name || `${subject || 'Class'} Custom Test Pattern`
  );
  const [timeAllowed, setTimeAllowed] = useState(
    initialPattern?.timeAllowed || '2:00 Hours'
  );
  const [sections, setSections] = useState<PaperPatternSection[]>([]);
  const [customTitleModes, setCustomTitleModes] = useState<Record<string, boolean>>({});
  const [expandedSectionParts, setExpandedSectionParts] = useState<Record<string, boolean>>({});
  const [openChapterDropdownId, setOpenChapterDropdownId] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // Initialize or reset sections when modal opens or initialPattern changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialPattern && initialPattern.sections && initialPattern.sections.length > 0) {
      setPatternName(initialPattern.name || `${subject} Custom Pattern`);
      setTimeAllowed(initialPattern.timeAllowed || '2:00 Hours');
      const clonedSections: PaperPatternSection[] = JSON.parse(JSON.stringify(initialPattern.sections));
      const sorted = sortSectionsByStandardSequence(clonedSections, isEnglishSubject).map((s, index) => {
        const isLongType = (s.type || '').toUpperCase() === 'LONG';
        const autoHeading = getAutoSectionHeading(s.type);
        return {
          ...s,
          heading: (!s.heading || s.heading === 'None') && autoHeading !== 'None' ? autoHeading : (s.heading || 'None'),
          title: s.title || getAutoTitle(s.type, s.attemptCount, s.marksPerQuestion, index, isEnglishSubject) || `Q${index + 1}. Attempt all.`,
          titleUrdu: s.titleUrdu || getAutoUrduTitle(s.type, s.attemptCount, s.marksPerQuestion, index) || '',
          subParts: isLongType ? (s.subParts || []) : []
        };
      });
      setSections(sorted);

      const modes: Record<string, boolean> = {};
      const expanded: Record<string, boolean> = {};
      sorted.forEach((s, index) => {
        const autoTitle = getAutoTitle(s.type, s.attemptCount, s.marksPerQuestion, index, isEnglishSubject);
        if (s.title && s.title !== autoTitle) {
          modes[s.id] = true;
        }
        if (s.type.toUpperCase() === 'LONG' && s.subParts && s.subParts.length > 0) {
          expanded[s.id] = true;
        }
      });
      setCustomTitleModes(modes);
      setExpandedSectionParts(expanded);
    } else {
      // Default standard exam sections: Q1 MCQs (SECTION – I), Q2 Short (SECTION – II), Q3 Long (SECTION – III)
      const sec1Id = generateId();
      const sec2Id = generateId();
      const sec3Id = generateId();

      const defaultSections: PaperPatternSection[] = [
        {
          id: sec1Id,
          type: 'MCQ',
          heading: 'SECTION – I',
          title: getAutoTitle('MCQ', 10, 1, 0, isEnglishSubject) || 'Q1. Attempt all. Circle the correct answer',
          titleUrdu: getAutoUrduTitle('MCQ', 10, 1, 0) || 'سوال نمبر 1۔ درست جواب کے گرد دائرہ لگائیں۔',
          titleFontSize: 10,
          hideSectionMarks: false,
          hideSubPartMarks: false,
          questionCount: 10,
          attemptCount: 10,
          marksPerQuestion: 1,
          specificChapters: []
        },
        {
          id: sec2Id,
          type: 'Short',
          heading: 'SECTION – II',
          title: getAutoTitle('Short', 5, 2, 1, isEnglishSubject) || 'Q2. Write short answers to any 5 questions.',
          titleUrdu: getAutoUrduTitle('Short', 5, 2, 1) || 'سوال نمبر 2۔ کوئی سے 5 مختصر سوالات کے جوابات دیں۔',
          titleFontSize: 10,
          hideSectionMarks: false,
          hideSubPartMarks: false,
          questionCount: 8,
          attemptCount: 5,
          marksPerQuestion: 2,
          specificChapters: []
        },
        {
          id: sec3Id,
          type: 'Long',
          heading: 'SECTION – III',
          title: getAutoTitle('Long', 2, 5, 2, isEnglishSubject) || 'Q3. Attempt any 2 questions.',
          titleUrdu: getAutoUrduTitle('Long', 2, 5, 2) || 'سوال نمبر 3۔ کوئی سے 2 تفصیلی سوالات کے جوابات دیں۔',
          titleFontSize: 10,
          hideSectionMarks: false,
          hideSubPartMarks: false,
          questionCount: 3,
          attemptCount: 2,
          marksPerQuestion: 5,
          specificChapters: []
        }
      ];

      setPatternName(`${subject || 'Class'} Custom Test Pattern`);
      setTimeAllowed('2:00 Hours');
      setSections(defaultSections);
      setCustomTitleModes({});
      setExpandedSectionParts({});
    }
  }, [isOpen, initialPattern, subject, isEnglishSubject]);

  // Close chapter dropdowns if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.chapter-dropdown-container')) {
        setOpenChapterDropdownId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAddSection = () => {
    const sectionId = generateId();
    // Default smart type selection: if no MCQ exists, default to MCQ; otherwise Short or Long
    const hasMCQ = sections.some(s => s.type.toUpperCase() === 'MCQ');
    const shortCount = sections.filter(s => s.type.toUpperCase() === 'SHORT').length;
    const type = !hasMCQ ? 'MCQ' : (shortCount < 3 ? 'Short' : 'Long');
    const defaultCount = type.toUpperCase() === 'MCQ' ? 10 : (type.toUpperCase() === 'SHORT' ? 8 : 3);
    const defaultAttempt = type.toUpperCase() === 'MCQ' ? 10 : (type.toUpperCase() === 'SHORT' ? 5 : 2);
    const defaultMarks = type.toUpperCase() === 'MCQ' ? 1 : (type.toUpperCase() === 'SHORT' ? 2 : 5);
    const index = sections.length;

    const defaultHeading = getAutoSectionHeading(type);
    const autoTitle = getAutoTitle(type, defaultAttempt, defaultMarks, index, isEnglishSubject);
    const autoUrduTitle = getAutoUrduTitle(type, defaultAttempt, defaultMarks, index);

    const newSection: PaperPatternSection = {
      id: sectionId,
      type: type,
      heading: defaultHeading,
      title: autoTitle || `Q${index + 1}. Attempt all.`,
      titleUrdu: autoUrduTitle || `سوال نمبر ${index + 1}۔ تمام سوالات کے جوابات دیں۔`,
      titleFontSize: 10,
      hideSectionMarks: false,
      hideSubPartMarks: false,
      questionCount: defaultCount,
      attemptCount: defaultAttempt,
      marksPerQuestion: defaultMarks,
      specificChapters: []
    };

    // Automatically sort all sections so MCQ comes first, then Short, then Long!
    setSections(prev => {
      const combined = [...prev, newSection];
      return sortSectionsByStandardSequence(combined, isEnglishSubject);
    });
  };

  const handleUpdateSection = (id: string, field: keyof PaperPatternSection, value: any) => {
    setSections(prev => {
      const updated = prev.map((s, idx) => {
        if (s.id !== id) return s;

        let nextValue = value;
        if (field === 'specificChapters' && typeof value === 'string') {
          nextValue = value.split(',').map(n => n.trim()).filter(Boolean);
        }

        let nextSection = { ...s, [field]: nextValue };

        // When section type changes, auto-assign SECTION – I / II / III and clear subParts if not Long
        if (field === 'type') {
          const autoHeading = getAutoSectionHeading(String(value));
          if (autoHeading !== 'None') {
            nextSection.heading = autoHeading;
          }
          if (String(value).toUpperCase() !== 'LONG') {
            nextSection.subParts = [];
            setExpandedSectionParts(p => ({ ...p, [id]: false }));
          }
        }

        // Auto-update display titles if not in manual/custom title mode
        if (field === 'type' || field === 'attemptCount' || field === 'marksPerQuestion' || field === 'heading') {
          if (!customTitleModes[id]) {
            const updatedType = field === 'type' ? String(value) : nextSection.type;
            const updatedCount = field === 'attemptCount' ? Number(value) : nextSection.attemptCount;
            const updatedMarks = field === 'marksPerQuestion' ? Number(value) : nextSection.marksPerQuestion;

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

      // If section type changed, immediately re-sort so it moves to proper position (MCQ -> Short -> Long)
      if (field === 'type') {
        return sortSectionsByStandardSequence(updated, isEnglishSubject);
      }

      return updated;
    });
  };

  const handleToggleParts = (id: string) => {
    setExpandedSectionParts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddPart = (sectionId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      // Only Long questions can have sub-parts
      if (s.type.toUpperCase() !== 'LONG') return s;

      const parts = [...(s.subParts || [])];
      const nextLabelChar = String.fromCharCode(97 + parts.length);

      parts.push({
        id: generateId(),
        label: `(${nextLabelChar})`,
        marks: 0,
        type: s.type,
        specificChapters: [],
        questionCount: 1,
        attemptCount: 1,
        isAlternative: false
      });

      return { ...s, subParts: parts };
    }));
  };

  const handleUpdatePart = (sectionId: string, partId: string, field: keyof PaperPatternSectionPart, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;

      const parts = s.subParts?.map(p => {
        if (p.id !== partId) return p;

        let nextValue = value;
        if (field === 'specificChapters' && typeof value === 'string') {
          nextValue = value.split(',').map(n => n.trim()).filter(Boolean);
        }

        return { ...p, [field]: nextValue };
      });

      const totalPartMarks = parts?.reduce((acc, p) => acc + (p.marks || 0), 0) || s.marksPerQuestion;
      return { ...s, subParts: parts, marksPerQuestion: totalPartMarks };
    }));
  };

  const handleRemovePart = (sectionId: string, partId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const parts = s.subParts?.filter(p => p.id !== partId);
      const totalPartMarks = parts?.reduce((acc, p) => acc + (p.marks || 0), 0) || s.marksPerQuestion;
      return { ...s, subParts: parts, marksPerQuestion: totalPartMarks };
    }));
  };

  const handleRemoveSection = (id: string) => {
    if (sections.length <= 1) {
      alert("At least 1 section is required in the pattern.");
      return;
    }

    setSections(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return sortSectionsByStandardSequence(filtered, isEnglishSubject);
    });
    setCustomTitleModes(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleApply = async () => {
    if (!patternName.trim()) {
      alert("Please enter a Pattern Title.");
      return;
    }
    if (sections.length === 0) {
      alert("Please add at least one section.");
      return;
    }

    setIsSaving(true);
    // Guarantee correct sequence before saving and applying: MCQ -> Short -> Long
    const sortedSections = sortSectionsByStandardSequence(sections, isEnglishSubject);
    const calculatedTotal = sortedSections.reduce(
      (acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 
      0
    );

    const patternId = initialPattern?.id || `custom-pattern-${Date.now()}`;
    const patternObj: PaperPattern = {
      id: patternId,
      name: patternName.trim(),
      description: 'Custom pattern configured by user',
      totalMarks: calculatedTotal,
      timeAllowed: timeAllowed,
      classLevel: classLevel,
      subject: subject,
      sections: sortedSections
    };

    try {
      if (saveToLibrary) {
        await savePattern(patternObj);
      }
      onApplyPattern(patternObj);
      onClose();
    } catch (e) {
      console.error("Error saving pattern", e);
      onApplyPattern(patternObj);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalCalculatedMarks = sections.reduce(
    (acc, s) => acc + (s.attemptCount * s.marksPerQuestion), 
    0
  );
  const totalQuestionsCount = sections.reduce(
    (acc, s) => acc + (s.questionCount || 0), 
    0
  );

  return (
    <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-1.5 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gray-800 border-2 border-gold-500/40 rounded-2xl max-w-6xl w-full p-2.5 sm:p-6 shadow-2xl relative my-auto h-[95dvh] max-h-[95dvh] lg:h-auto lg:max-h-[94vh] flex flex-col overflow-hidden text-theme-text-main animate-scaleIn">
        
        {/* HEADER */}
        <div className="flex items-center lg:items-start justify-between pb-2 lg:pb-4 border-b border-gray-700 shrink-0">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-1.5 sm:p-2 bg-gold-500/10 border border-gold-500/30 rounded-xl text-gold-500 shrink-0">
                <Sliders size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-xl font-black text-theme-text-main uppercase tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                  Custom Paper Pattern Builder
                  <span className="text-[10px] bg-gold-500 text-black px-2 py-0.5 rounded-full font-bold">
                    {subject} • {classLevel}
                  </span>
                </h2>
                <p className="hidden lg:block text-xs text-theme-text-muted mt-0.5">
                  Configure MCQs (Section I), Short Questions (Section II), Long Questions (Section III) & Titles.
                </p>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-theme-text-muted hover:text-white hover:bg-gray-700/60 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* SCROLLABLE BODY (Unified smooth scroll on Mobile; fixed top bars + scrollable sections on Desktop) */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:flex lg:flex-col overscroll-contain pr-0.5 lg:pr-0 custom-scrollbar">
          {/* TOP CONFIG BAR: Pattern Name, Time, Total Marks Summary */}
          <div className="grid grid-cols-2 md:grid-cols-12 gap-2.5 sm:gap-3 p-3 my-2.5 sm:my-3 bg-gray-900/80 rounded-xl border border-gray-700/80 lg:shrink-0 items-center">
            <div className="col-span-2 md:col-span-5">
              <label className="text-[10px] font-black uppercase text-theme-text-muted tracking-wider block mb-1">
                Pattern Title
              </label>
              <input
                type="text"
                value={patternName}
                onChange={e => setPatternName(e.target.value)}
                placeholder="e.g. Mid Term Exam Pattern"
                className="w-full bg-gray-800 text-theme-text-main text-xs font-bold px-3 py-2 rounded-lg border border-gray-700 outline-none focus:border-gold-500 transition-colors"
              />
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="text-[10px] font-black uppercase text-theme-text-muted tracking-wider block mb-1 flex items-center gap-1">
                <Clock size={12} className="text-gold-500" /> Time Allowed
              </label>
              <input
                type="text"
                value={timeAllowed}
                onChange={e => setTimeAllowed(e.target.value)}
                placeholder="e.g. 2:00 Hours"
                className="w-full bg-gray-800 text-theme-text-main text-xs px-3 py-2 rounded-lg border border-gray-700 outline-none focus:border-gold-500 transition-colors"
              />
            </div>

            <div className="col-span-1 md:col-span-4 flex items-center justify-end gap-2.5 sm:gap-3 pl-2 md:border-l border-gray-700">
              <div className="text-right">
                <span className="text-[8px] sm:text-[9px] uppercase font-black tracking-widest text-theme-text-muted block">Total Qs</span>
                <span className="text-base sm:text-lg font-black text-white">{totalQuestionsCount}</span>
              </div>
              <div className="h-7 sm:h-8 w-px bg-gray-700" />
              <div className="text-right">
                <span className="text-[8px] sm:text-[9px] uppercase font-black tracking-widest text-gold-500 block">Total Marks</span>
                <span className="text-xl sm:text-2xl font-black text-gold-500 leading-none">{totalCalculatedMarks}</span>
              </div>
            </div>
          </div>

          {/* SECTION CONFIGURATION TITLE & ADD BUTTON */}
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700/60 lg:shrink-0">
            <h3 className="text-xs sm:text-sm font-bold text-theme-text-main uppercase tracking-widest flex items-center gap-2">
              <Layers className="text-gold-500" size={16} /> Part Configuration
            </h3>
            <Button 
              onClick={handleAddSection} 
              variant="secondary" 
              className="!w-auto text-[11px] py-1 px-3 font-black"
            >
              <Plus size={14} className="mr-1" /> Add New Part
            </Button>
          </div>

          {/* TABLE COLUMN LABELS (Desktop/Laptop only - Mobile shows inline labels per card) */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-2 text-[10px] font-black text-theme-text-sub px-2 uppercase tracking-widest lg:shrink-0">
            <div className="col-span-1 text-center">Heading</div>
            <div className="col-span-1 text-center">Type</div>
            <div className="col-span-3">Display Titles (Eng & Urdu)</div>
            <div className="col-span-1 text-center">Marks Vis.</div>
            <div className="col-span-1 text-center">Total Qs</div>
            <div className="col-span-1 text-center">Attempt</div>
            <div className="col-span-1 text-center">Marks/Q</div>
            <div className="col-span-2 text-center">Chapters</div>
            <div className="col-span-1 text-center">Actions</div>
          </div>

          {/* SECTIONS LIST */}
          <div className="space-y-3 my-1 pb-2 lg:pb-0 lg:overflow-y-auto lg:pr-1 custom-scrollbar lg:flex-1 lg:min-h-0">
          {sections.map((s, idx) => {
            const isCustomType = !PREDEFINED_TYPES.includes(s.type) && !ENGLISH_SPECIFIC_TYPES.includes(s.type);
            const isCustomTitleMode = customTitleModes[s.id] || isCustomType;
            const rawSuggestions = TYPE_TITLE_MAPPING[s.type] || [];
            const isExpanded = expandedSectionParts[s.id];
            const isMCQ = s.type.toUpperCase() === 'MCQ';
            const isLong = s.type.toUpperCase() === 'LONG';

            const baseSuggestions = rawSuggestions.map(rs => {
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

            // Include explicit "any X out of Y" suggestion and current title so dropdown always matches
            const outOfSuggestion = s.type.toUpperCase() === 'SHORT'
              ? `Q${idx + 1}. Write short answers to any ${s.attemptCount} out of ${s.questionCount} questions.`
              : s.type.toUpperCase() === 'LONG'
                ? `Q${idx + 1}. Attempt any ${s.attemptCount} out of ${s.questionCount} long questions.`
                : null;

            const suggestions = Array.from(new Set([
              ...(s.title ? [s.title] : []),
              ...baseSuggestions,
              ...(outOfSuggestion ? [outOfSuggestion] : [])
            ]));

            const typesToRender = isEnglishSubject ? ENGLISH_SPECIFIC_TYPES : PREDEFINED_TYPES;

            return (
              <div key={s.id} className="space-y-2">
                <div className="bg-gray-900/60 border border-gray-700 p-3 lg:p-2.5 rounded-xl grid grid-cols-12 gap-2.5 lg:gap-2 items-center hover:border-gold-500/50 transition-colors">
                  
                  {/* HEADING (Mobile: 6 cols, Desktop: 1 col) */}
                  <div className="col-span-6 lg:col-span-1">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub mb-1">
                      Heading
                    </label>
                    <select
                      value={s.heading || 'None'}
                      onChange={e => handleUpdateSection(s.id, 'heading', e.target.value)}
                      className="w-full bg-gray-800 text-theme-text-main text-[11px] lg:text-[10px] p-2 lg:p-1.5 rounded-lg border border-gray-700 outline-none focus:border-gold-500 cursor-pointer font-bold"
                    >
                      {SECTION_HEADINGS.map(h => (
                        <option key={h} value={h} className="bg-gray-800">{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* TYPE (Mobile: 6 cols, Desktop: 1 col) */}
                  <div className="col-span-6 lg:col-span-1">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub mb-1">
                      Type
                    </label>
                    {isCustomType ? (
                      <div className="flex gap-1">
                        <input
                          value={s.type}
                          onChange={e => handleUpdateSection(s.id, 'type', e.target.value)}
                          className="w-full bg-gray-800 text-theme-text-main text-[11px] lg:text-[10px] p-2 lg:p-1.5 rounded-lg border border-gold-500/50 outline-none font-urdu"
                          placeholder="Type..."
                          autoFocus
                        />
                        <button 
                          type="button"
                          onClick={() => handleUpdateSection(s.id, 'type', 'MCQ')} 
                          className="p-1 text-gold-500 hover:text-theme-text-main" 
                          title="Reset to list"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={s.type}
                        onChange={e => handleUpdateSection(s.id, 'type', e.target.value === 'OTHER' ? '' : e.target.value)}
                        className={`w-full bg-gray-800 text-theme-text-main text-[11px] lg:text-[10px] p-2 lg:p-1.5 rounded-lg border border-gray-700 outline-none focus:border-gold-500 cursor-pointer font-bold ${isUrdu(s.type) ? 'font-urdu' : ''}`}
                      >
                        {typesToRender.map(t => (
                          <option key={t} value={t} className={`bg-gray-800 ${isUrdu(t) ? 'font-urdu' : ''}`}>
                            {t}
                          </option>
                        ))}
                        <option value="OTHER" className="bg-gray-800">Other...</option>
                      </select>
                    )}
                  </div>

                  {/* DISPLAY TITLES - ENG & URDU (Mobile: 12 cols, Desktop: 3 cols) */}
                  <div className="col-span-12 lg:col-span-3">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub mb-1">
                      Display Titles (Eng & Urdu)
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {/* English Title Input */}
                      <div className="flex gap-1 items-center">
                        {isCustomTitleMode ? (
                          <>
                            <textarea
                              value={s.title}
                              onChange={e => handleUpdateSection(s.id, 'title', e.target.value)}
                              onKeyDown={e => handleTitleKeyDown(e, s.id, 'title')}
                              className="w-full bg-gray-800 text-theme-text-main text-[11px] lg:text-[10px] p-1.5 rounded-md border border-gold-500/60 outline-none resize-none overflow-hidden min-h-[32px] lg:min-h-[30px]"
                              placeholder="English Title (e.g. Q2. Attempt any 5 out of 8 questions)"
                              rows={1}
                            />
                            {!isCustomType && (
                              <button
                                type="button"
                                onClick={() => setCustomTitleModes(prev => ({ ...prev, [s.id]: false }))}
                                className="p-1 text-gold-500 hover:text-white shrink-0"
                                title="Switch back to preset titles"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <select
                              value={s.title}
                              onChange={e => {
                                if (e.target.value === 'OTHER_TITLE') {
                                  setCustomTitleModes(prev => ({ ...prev, [s.id]: true }));
                                } else {
                                  handleUpdateSection(s.id, 'title', e.target.value);
                                }
                              }}
                              className="w-full bg-gray-800 text-theme-text-main text-[11px] lg:text-[10px] p-1.5 rounded-md border border-gray-700 outline-none focus:border-gold-500"
                            >
                              {suggestions.map(title => (
                                <option key={title} value={title} className="bg-gray-800">{title}</option>
                              ))}
                              <option value="OTHER_TITLE" className="bg-gray-800">Manual Entry...</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setCustomTitleModes(prev => ({ ...prev, [s.id]: true }))}
                              className="p-1 text-gold-500 hover:bg-gold-500/10 rounded shrink-0"
                              title="Write custom English title"
                            >
                              <Edit size={12} />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Urdu Title Input */}
                      <textarea
                        value={s.titleUrdu || ''}
                        onChange={e => handleUpdateSection(s.id, 'titleUrdu', e.target.value)}
                        onKeyDown={e => handleTitleKeyDown(e, s.id, 'titleUrdu')}
                        className="w-full bg-gray-800 text-gold-500 text-[11px] lg:text-[10px] p-1.5 rounded-md border border-gray-700 outline-none focus:border-gold-500 font-urdu text-right resize-none overflow-hidden min-h-[32px] lg:min-h-[30px]"
                        placeholder="اردو عنوان"
                        dir="rtl"
                        rows={1}
                      />
                    </div>
                  </div>

                  {/* MARKS VISIBILITY (Mobile: 3 cols, Desktop: 1 col) */}
                  <div className="col-span-3 lg:col-span-1">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub text-center mb-1 truncate">
                      Marks Vis.
                    </label>
                    <div className="flex items-center justify-center gap-1 bg-gray-800 p-1.5 lg:p-1 rounded-lg border border-gray-700">
                      <button
                        type="button"
                        onClick={() => handleUpdateSection(s.id, 'hideSectionMarks', !s.hideSectionMarks)}
                        className={`p-1 rounded transition-colors ${s.hideSectionMarks ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}
                        title={s.hideSectionMarks ? "Section Total Marks Hidden" : "Section Total Marks Visible"}
                      >
                        {s.hideSectionMarks ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSection(s.id, 'hideSubPartMarks', !s.hideSubPartMarks)}
                        className={`p-1 rounded transition-colors ${s.hideSubPartMarks ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}
                        title={s.hideSubPartMarks ? "Individual Question Marks Hidden" : "Individual Question Marks Visible"}
                      >
                        <Hash size={13} />
                      </button>
                    </div>
                  </div>

                  {/* TOTAL QS (Mobile: 3 cols, Desktop: 1 col) */}
                  <div className="col-span-3 lg:col-span-1">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub text-center mb-1 truncate">
                      Total Qs
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={s.questionCount}
                      onChange={e => handleUpdateSection(s.id, 'questionCount', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-gray-800 text-theme-text-main text-[11px] p-1.5 rounded-lg border border-gray-700 text-center outline-none focus:border-gold-500 font-bold"
                    />
                  </div>

                  {/* ATTEMPT (Mobile: 3 cols, Desktop: 1 col) */}
                  <div className="col-span-3 lg:col-span-1">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub text-center mb-1 truncate">
                      Attempt
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={s.questionCount}
                      value={s.attemptCount}
                      onChange={e => handleUpdateSection(s.id, 'attemptCount', Math.min(s.questionCount, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full bg-gray-800 text-gold-500 font-bold text-[11px] p-1.5 rounded-lg border border-gray-700 text-center outline-none focus:border-gold-500"
                    />
                  </div>

                  {/* MARKS / Q (Mobile: 3 cols, Desktop: 1 col) */}
                  <div className="col-span-3 lg:col-span-1">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub text-center mb-1 truncate">
                      Marks/Q
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      disabled={isLong && !!(s.subParts && s.subParts.length > 0)}
                      value={s.marksPerQuestion}
                      onChange={e => handleUpdateSection(s.id, 'marksPerQuestion', Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-full bg-gray-800 text-theme-text-main text-[11px] p-1.5 rounded-lg border border-gray-700 text-center outline-none focus:border-gold-500 font-bold ${isLong && s.subParts && s.subParts.length > 0 ? 'opacity-50 cursor-not-allowed bg-gray-950' : ''}`}
                    />
                  </div>

                  {/* MANDATORY CHAPTERS (Mobile: 8 cols, Desktop: 2 cols) */}
                  <div className="col-span-8 lg:col-span-2">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub mb-1">
                      Chapters
                    </label>
                    <ChapterSelector
                      id={s.id}
                      selectedChapters={s.specificChapters || []}
                      availableChapters={availableChapters}
                      onChange={chapters => handleUpdateSection(s.id, 'specificChapters', chapters)}
                      isOpen={openChapterDropdownId === s.id}
                      onToggle={() => setOpenChapterDropdownId(openChapterDropdownId === s.id ? null : s.id)}
                    />
                  </div>

                  {/* ACTIONS (Mobile: 4 cols, Desktop: 1 col) - Sub-parts ONLY available for Long Questions */}
                  <div className="col-span-4 lg:col-span-1">
                    <label className="block lg:hidden text-[9px] font-black uppercase tracking-wider text-theme-text-sub text-center mb-1">
                      Actions
                    </label>
                    <div className="flex justify-center items-center gap-1 bg-gray-800/60 lg:bg-transparent p-1 lg:p-0 rounded-lg border border-gray-700/60 lg:border-0">
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => handleToggleParts(s.id)}
                          className={`p-1.5 rounded transition-all ${isExpanded ? 'bg-gold-500 text-black' : 'text-gold-500 hover:bg-gold-500/10'}`}
                          title="Configure Long Question Sub-parts (a, b) or Alternatives (OR)"
                        >
                          <ListTree size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(s.id)}
                        className="text-red-400 p-1.5 hover:bg-red-500/10 rounded transition-all"
                        title="Remove Part"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPANDED SUB-PARTS (ONLY FOR LONG QUESTIONS) */}
                {isLong && isExpanded && (
                  <div className="ml-2 lg:ml-6 p-3 bg-gray-850/80 border border-gold-500/30 rounded-xl animate-fadeIn space-y-2">
                    <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-gold-500">
                      <div className="flex items-center gap-2">
                        <span>Manage Sub-parts (a, b) for Long Question {idx + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddPart(s.id)}
                        className="bg-gold-500/10 text-gold-500 border border-gold-500/30 px-2.5 py-0.5 rounded hover:bg-gold-500 hover:text-black transition-all flex items-center gap-1 text-[10px]"
                      >
                        <Plus size={10} /> Add Part
                      </button>
                    </div>

                    <div className="space-y-2 lg:space-y-1.5">
                      <div className="hidden lg:grid lg:grid-cols-12 gap-2 text-[8px] font-black uppercase text-theme-text-sub tracking-tighter px-1">
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
                        const partTypes = isEnglishSubject ? ENGLISH_SPECIFIC_TYPES : PREDEFINED_TYPES;

                        return (
                          <div key={part.id} className="grid grid-cols-12 gap-2 items-center bg-gray-950/40 p-2.5 lg:p-2 rounded-lg border border-gray-700/50">
                            <div className="col-span-6 lg:col-span-2">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub mb-0.5">Type</label>
                              <select
                                value={part.type || s.type}
                                onChange={e => handleUpdatePart(s.id, part.id, 'type', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-theme-text-main outline-none focus:border-gold-500 font-bold"
                              >
                                {partTypes.map(pt => (
                                  <option key={pt} value={pt} className="bg-gray-800">{pt}</option>
                                ))}
                              </select>
                            </div>

                            <div className="col-span-6 lg:col-span-2">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub mb-0.5">Instructions</label>
                              <input
                                value={part.label}
                                onChange={e => handleUpdatePart(s.id, part.id, 'label', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-theme-text-main outline-none focus:border-gold-500"
                                placeholder="Instruction Text"
                              />
                            </div>

                            <div className="col-span-4 lg:col-span-1">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub text-center mb-0.5">Marks</label>
                              <input
                                type="number"
                                value={part.marks}
                                onChange={e => handleUpdatePart(s.id, part.id, 'marks', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-gold-500 font-black text-center outline-none focus:border-gold-500"
                              />
                            </div>

                            <div className="col-span-4 lg:col-span-1">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub text-center mb-0.5">Total Qs</label>
                              <input
                                type="number"
                                value={part.questionCount || 0}
                                onChange={e => handleUpdatePart(s.id, part.id, 'questionCount', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-theme-text-main font-bold text-center outline-none focus:border-gold-500"
                              />
                            </div>

                            <div className="col-span-4 lg:col-span-1">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub text-center mb-0.5">Attempt</label>
                              <input
                                type="number"
                                value={part.attemptCount || 0}
                                onChange={e => handleUpdatePart(s.id, part.id, 'attemptCount', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-gold-500 font-bold text-center outline-none focus:border-gold-500"
                              />
                            </div>

                            <div className="col-span-6 lg:col-span-2">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub mb-0.5">Chapters</label>
                              <ChapterSelector
                                id={part.id}
                                selectedChapters={part.specificChapters || []}
                                availableChapters={availableChapters}
                                onChange={chapters => handleUpdatePart(s.id, part.id, 'specificChapters', chapters)}
                                isOpen={openChapterDropdownId === part.id}
                                onToggle={() => setOpenChapterDropdownId(openChapterDropdownId === part.id ? null : part.id)}
                              />
                            </div>

                            <div className="col-span-4 lg:col-span-2 flex flex-col lg:flex-row justify-center items-center">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub mb-0.5">Alternative?</label>
                              {pIdx > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePart(s.id, part.id, 'isAlternative', !part.isAlternative)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${part.isAlternative ? 'bg-gold-500 text-black border-gold-500' : 'bg-gray-800 text-theme-text-sub border border-gray-700 hover:text-theme-text-main'}`}
                                >
                                  {part.isAlternative ? <Check size={10} /> : null}
                                  {part.isAlternative ? 'OR (Alternative)' : 'Sequential'}
                                </button>
                              ) : (
                                <span className="lg:hidden text-[9px] text-gray-500 font-bold">—</span>
                              )}
                            </div>

                            <div className="col-span-2 lg:col-span-1 flex flex-col lg:flex-row justify-center items-center">
                              <label className="block lg:hidden text-[8px] font-black uppercase text-theme-text-sub mb-0.5">Action</label>
                              <button
                                type="button"
                                onClick={() => handleRemovePart(s.id, part.id)}
                                className="text-red-400 p-1 hover:bg-red-500/10 rounded transition-all"
                                title="Remove sub-part"
                              >
                                <Trash2 size={13} />
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
        </div>

        {/* FOOTER ACTION BAR */}
        <div className="pt-2.5 sm:pt-3 mt-1 sm:mt-2 border-t border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-theme-text-muted hover:text-theme-text-main">
            <input
              type="checkbox"
              checked={saveToLibrary}
              onChange={e => setSaveToLibrary(e.target.checked)}
              className="accent-gold-500 w-4 h-4 cursor-pointer rounded"
            />
            <BookmarkCheck size={16} className={saveToLibrary ? "text-gold-500" : "text-gray-500"} />
            <span>Save this pattern to library for future use</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="!w-auto px-4 text-xs h-9"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleApply}
              disabled={isSaving || sections.length === 0}
              className="!w-auto px-5 text-xs h-9 font-black"
            >
              <span>{isSaving ? "Saving..." : "Use Pattern & Generate Paper"}</span>
              <ChevronRight size={15} className="ml-1" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
