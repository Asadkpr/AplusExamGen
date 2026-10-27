import React, { useState, useEffect } from 'react';
import { User, PaperPattern, PaperPatternSection, PaperPatternSectionPart, Chapter } from '../types';
import { 
  PREDEFINED_TYPES, 
  ENGLISH_SPECIFIC_TYPES, 
  ENGLISH_MCQ_SUBTYPES, 
  ENGLISH_SUBTYPE_INSTRUCTIONS, 
  SECTION_HEADINGS, 
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
  Sliders, ChevronRight, Check, BookmarkCheck
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
  const [expandedSectionParts, setExpandedSectionParts] = useState<Record<string, boolean>>({});
  const [openChapterDropdownId, setOpenChapterDropdownId] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or reset sections when modal opens or initialPattern changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialPattern && initialPattern.sections && initialPattern.sections.length > 0) {
      setPatternName(initialPattern.name || `${subject} Custom Pattern`);
      setTimeAllowed(initialPattern.timeAllowed || '2:00 Hours');
      const clonedSections: PaperPatternSection[] = JSON.parse(JSON.stringify(initialPattern.sections));
      const sorted = sortSectionsByStandardSequence(clonedSections, isEnglishSubject);
      setSections(sorted);

      const expanded: Record<string, boolean> = {};
      sorted.forEach(s => {
        if (s.subParts && s.subParts.length > 0) {
          expanded[s.id] = true;
        }
      });
      setExpandedSectionParts(expanded);
    } else {
      // Default standard exam sections: Q1 MCQs, Q2 Short, Q3 Long
      const sec1Id = generateId();
      const sec2Id = generateId();
      const sec3Id = generateId();

      const defaultSections: PaperPatternSection[] = [
        {
          id: sec1Id,
          type: 'MCQ',
          heading: isEnglishSubject ? 'OBJECTIVE PART' : 'SECTION – I',
          title: '',
          titleUrdu: '',
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
          heading: isEnglishSubject ? 'SECTION – I' : 'SECTION – II',
          title: '',
          titleUrdu: '',
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
          heading: isEnglishSubject ? 'SECTION – II' : 'None',
          title: '',
          titleUrdu: '',
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
    // Default smart type selection: if no short questions exist, default to Short; if exists, alternate or Long
    const hasMCQ = sections.some(s => s.type.toUpperCase() === 'MCQ');
    const shortCount = sections.filter(s => s.type.toUpperCase() === 'SHORT').length;
    const type = !hasMCQ ? 'MCQ' : (shortCount < 3 ? 'Short' : 'Long');
    const defaultCount = type.toUpperCase() === 'MCQ' ? 10 : (type.toUpperCase() === 'SHORT' ? 8 : 3);
    const defaultAttempt = type.toUpperCase() === 'MCQ' ? 10 : (type.toUpperCase() === 'SHORT' ? 5 : 2);
    const defaultMarks = type.toUpperCase() === 'MCQ' ? 1 : (type.toUpperCase() === 'SHORT' ? 2 : 5);

    let defaultHeading = 'None';
    if (type.toUpperCase() === 'MCQ') {
      defaultHeading = isEnglishSubject ? 'OBJECTIVE PART' : 'SECTION – I';
    } else if (type.toUpperCase() === 'SHORT') {
      defaultHeading = isEnglishSubject ? 'SECTION – I' : 'SECTION – II';
    } else if (type.toUpperCase() === 'LONG') {
      defaultHeading = isEnglishSubject ? 'SECTION – II' : 'None';
    }

    const newSection: PaperPatternSection = {
      id: sectionId,
      type: type,
      heading: defaultHeading,
      title: '',
      titleUrdu: '',
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

        // Auto-detect summary type for English
        if (field === 'type' && isEnglishSubject && value === 'Summary') {
          nextSection.subParts = [
            { id: generateId(), label: 'Write the summary of the poem.', marks: 5, type: 'Summary', specificChapters: [], questionCount: 1, attemptCount: 1 },
            { id: generateId(), label: 'Paraphrase the following lines into simple English.', marks: 5, type: 'Paraphrase', specificChapters: [], questionCount: 1, attemptCount: 1, isAlternative: true }
          ];
          nextSection.questionCount = 1;
          nextSection.attemptCount = 1;
          nextSection.marksPerQuestion = 5;
          setExpandedSectionParts(p => ({ ...p, [id]: true }));
        }

        // Auto-detect letter type for English
        if (field === 'type' && isEnglishSubject && value === 'Letter') {
          nextSection.subParts = [
            { id: generateId(), label: 'Write a Letter to your friend...', marks: 8, type: 'Letter', specificChapters: [], questionCount: 1, attemptCount: 1 },
            { id: generateId(), label: 'Write a Story on...', marks: 8, type: 'Story', specificChapters: [], questionCount: 1, attemptCount: 1, isAlternative: true },
            { id: generateId(), label: 'Write a Dialogue between...', marks: 8, type: 'Dialogue', specificChapters: [], questionCount: 1, attemptCount: 1, isAlternative: true }
          ];
          nextSection.questionCount = 1;
          nextSection.attemptCount = 1;
          nextSection.marksPerQuestion = 8;
          setExpandedSectionParts(p => ({ ...p, [id]: true }));
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
      const parts = [...(s.subParts || [])];
      const nextLabelChar = String.fromCharCode(97 + parts.length);
      const isMCQ = s.type.toUpperCase() === 'MCQ';

      let partType = isMCQ && isEnglishSubject 
        ? ENGLISH_MCQ_SUBTYPES[parts.length % ENGLISH_MCQ_SUBTYPES.length] 
        : s.type;

      parts.push({
        id: generateId(),
        label: isEnglishSubject && isMCQ ? (ENGLISH_SUBTYPE_INSTRUCTIONS[partType] || 'Choose the correct option') : `(${nextLabelChar})`,
        marks: isMCQ ? 1 : 0,
        type: partType,
        specificChapters: [],
        questionCount: isMCQ ? 5 : 1,
        attemptCount: isMCQ ? 5 : 1,
        isAlternative: false
      });

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
      const isMCQ = s.type.toUpperCase() === 'MCQ';

      const parts = s.subParts?.map(p => {
        if (p.id !== partId) return p;

        let nextValue = value;
        if (field === 'specificChapters' && typeof value === 'string') {
          nextValue = value.split(',').map(n => n.trim()).filter(Boolean);
        }

        let updatedPart = { ...p, [field]: nextValue };

        if (field === 'type' && isEnglishSubject && isMCQ) {
          const instruction = ENGLISH_SUBTYPE_INSTRUCTIONS[value];
          if (instruction) updatedPart.label = instruction;
        }

        return updatedPart;
      });

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
    if (sections.length <= 1) {
      alert("At least 1 section is required in the pattern.");
      return;
    }

    setSections(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return sortSectionsByStandardSequence(filtered, isEnglishSubject);
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
    <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gray-800 border-2 border-gold-500/40 rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl relative my-auto max-h-[94vh] flex flex-col text-theme-text-main animate-scaleIn">
        
        {/* HEADER */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-700 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gold-500/10 border border-gold-500/30 rounded-xl text-gold-500">
                <Sliders size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-theme-text-main uppercase tracking-tight flex items-center gap-2">
                  Custom Paper Pattern Builder
                  <span className="text-[10px] bg-gold-500 text-black px-2 py-0.5 rounded-full font-bold">
                    {subject} • {classLevel}
                  </span>
                </h2>
                <p className="text-xs text-theme-text-muted mt-0.5">
                  Configure MCQs, Short Questions, Long Questions & Chapters in your desired layout.
                </p>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-theme-text-muted hover:text-white hover:bg-gray-700/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* TOP CONFIG BAR: Pattern Name, Time, Total Marks Summary */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 my-3 bg-gray-900/80 rounded-xl border border-gray-700/80 shrink-0 items-center">
          <div className="md:col-span-5">
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

          <div className="md:col-span-3">
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

          <div className="md:col-span-4 flex items-center justify-end gap-3 pl-2 border-t md:border-t-0 md:border-l border-gray-700">
            <div className="text-right">
              <span className="text-[9px] uppercase font-black tracking-widest text-theme-text-muted block">Total Questions</span>
              <span className="text-lg font-black text-white">{totalQuestionsCount}</span>
            </div>
            <div className="h-8 w-px bg-gray-700" />
            <div className="text-right">
              <span className="text-[9px] uppercase font-black tracking-widest text-gold-500 block">Total Marks</span>
              <span className="text-2xl font-black text-gold-500 leading-none">{totalCalculatedMarks}</span>
            </div>
          </div>
        </div>

        {/* SECTION CONFIGURATION TITLE & ADD BUTTON */}
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700/60 shrink-0">
          <h3 className="text-sm font-bold text-theme-text-main uppercase tracking-widest flex items-center gap-2">
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

        {/* TABLE COLUMN LABELS (Display Titles column removed) */}
        <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-theme-text-sub px-2 uppercase tracking-widest shrink-0">
          <div className="col-span-2 text-center">Heading</div>
          <div className="col-span-2 text-center">Type</div>
          <div className="col-span-1 text-center">Marks Vis.</div>
          <div className="col-span-1 text-center">Total Qs</div>
          <div className="col-span-1 text-center">Attempt</div>
          <div className="col-span-1 text-center">Marks/Q</div>
          <div className="col-span-3 text-center">Chapters</div>
          <div className="col-span-1 text-center">Actions</div>
        </div>

        {/* SECTIONS LIST */}
        <div className="overflow-y-auto space-y-3 pr-1 custom-scrollbar flex-grow my-1">
          {sections.map((s, idx) => {
            const isCustomType = !PREDEFINED_TYPES.includes(s.type) && !ENGLISH_SPECIFIC_TYPES.includes(s.type);
            const isExpanded = expandedSectionParts[s.id];
            const isMCQ = s.type.toUpperCase() === 'MCQ';

            const typesToRender = isEnglishSubject ? ENGLISH_SPECIFIC_TYPES : PREDEFINED_TYPES;

            return (
              <div key={s.id} className="space-y-2">
                <div className="bg-gray-900/60 border border-gray-700 p-2.5 rounded-xl grid grid-cols-12 gap-2 items-center hover:border-gold-500/50 transition-colors">
                  
                  {/* HEADING (2 cols) */}
                  <div className="col-span-2">
                    <select
                      value={s.heading || 'None'}
                      onChange={e => handleUpdateSection(s.id, 'heading', e.target.value)}
                      className="w-full bg-gray-800 text-theme-text-main text-[11px] p-2 rounded-lg border border-gray-700 outline-none focus:border-gold-500 cursor-pointer font-bold"
                    >
                      {SECTION_HEADINGS.map(h => (
                        <option key={h} value={h} className="bg-gray-800">{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* TYPE (2 cols) */}
                  <div className="col-span-2">
                    {isCustomType ? (
                      <div className="flex gap-1">
                        <input
                          value={s.type}
                          onChange={e => handleUpdateSection(s.id, 'type', e.target.value)}
                          className="w-full bg-gray-800 text-theme-text-main text-[11px] p-2 rounded-lg border border-gold-500/50 outline-none font-urdu"
                          placeholder="Type..."
                          autoFocus
                        />
                        <button 
                          onClick={() => handleUpdateSection(s.id, 'type', 'MCQ')} 
                          className="p-1.5 text-gold-500 hover:text-theme-text-main" 
                          title="Reset to list"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={s.type}
                        onChange={e => handleUpdateSection(s.id, 'type', e.target.value === 'OTHER' ? '' : e.target.value)}
                        className={`w-full bg-gray-800 text-theme-text-main text-[11px] p-2 rounded-lg border border-gray-700 outline-none focus:border-gold-500 cursor-pointer font-bold ${isUrdu(s.type) ? 'font-urdu' : ''}`}
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

                  {/* MARKS VISIBILITY (1 col) */}
                  <div className="col-span-1">
                    <div className="flex items-center justify-center gap-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
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

                  {/* TOTAL QS (1 col) */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      disabled={isMCQ && !!(s.subParts && s.subParts.length > 0)}
                      value={s.questionCount}
                      onChange={e => handleUpdateSection(s.id, 'questionCount', Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-full bg-gray-800 text-theme-text-main text-[11px] p-1.5 rounded-lg border border-gray-700 text-center outline-none focus:border-gold-500 font-bold ${isMCQ && s.subParts && s.subParts.length > 0 ? 'opacity-50' : ''}`}
                    />
                  </div>

                  {/* ATTEMPT (1 col) */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="1"
                      max={s.questionCount}
                      disabled={isMCQ && !!(s.subParts && s.subParts.length > 0)}
                      value={s.attemptCount}
                      onChange={e => handleUpdateSection(s.id, 'attemptCount', Math.min(s.questionCount, Math.max(1, parseInt(e.target.value) || 1)))}
                      className={`w-full bg-gray-800 text-gold-500 font-bold text-[11px] p-1.5 rounded-lg border border-gray-700 text-center outline-none focus:border-gold-500 ${isMCQ && s.subParts && s.subParts.length > 0 ? 'opacity-50' : ''}`}
                    />
                  </div>

                  {/* MARKS / Q (1 col) */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      disabled={!!(s.subParts && s.subParts.length > 0)}
                      value={s.marksPerQuestion}
                      onChange={e => handleUpdateSection(s.id, 'marksPerQuestion', Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-full bg-gray-800 text-theme-text-main text-[11px] p-1.5 rounded-lg border border-gray-700 text-center outline-none focus:border-gold-500 font-bold ${s.subParts && s.subParts.length > 0 ? 'opacity-50 cursor-not-allowed bg-gray-950' : ''}`}
                    />
                  </div>

                  {/* MANDATORY CHAPTERS (3 cols) */}
                  <div className="col-span-3">
                    <ChapterSelector
                      id={s.id}
                      selectedChapters={s.specificChapters || []}
                      availableChapters={availableChapters}
                      onChange={chapters => handleUpdateSection(s.id, 'specificChapters', chapters)}
                      isOpen={openChapterDropdownId === s.id}
                      onToggle={() => setOpenChapterDropdownId(openChapterDropdownId === s.id ? null : s.id)}
                    />
                  </div>

                  {/* ACTIONS (1 col) */}
                  <div className="col-span-1 flex justify-center items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleParts(s.id)}
                      className={`p-1.5 rounded transition-all ${isExpanded ? 'bg-gold-500 text-black' : 'text-gold-500 hover:bg-gold-500/10'}`}
                      title="Configure Sub-parts (a, b) or Alternatives (OR)"
                    >
                      <ListTree size={15} />
                    </button>
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

                {/* EXPANDED SUB-PARTS */}
                {isExpanded && (
                  <div className="ml-6 p-3 bg-gray-850/80 border border-gold-500/30 rounded-xl animate-fadeIn space-y-2">
                    <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase tracking-widest text-gold-500">
                      <div className="flex items-center gap-2">
                        <span>Manage Sub-parts for Part {idx + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddPart(s.id)}
                        className="bg-gold-500/10 text-gold-500 border border-gold-500/30 px-2.5 py-0.5 rounded hover:bg-gold-500 hover:text-black transition-all flex items-center gap-1 text-[10px]"
                      >
                        <Plus size={10} /> Add Part
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="grid grid-cols-12 gap-2 text-[8px] font-black uppercase text-theme-text-sub tracking-tighter px-1">
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
                        const partTypes = isEnglishSubject 
                          ? (isMCQ ? ENGLISH_MCQ_SUBTYPES : ENGLISH_SPECIFIC_TYPES) 
                          : PREDEFINED_TYPES;

                        return (
                          <div key={part.id} className="grid grid-cols-12 gap-2 items-center bg-gray-950/40 p-2 rounded-lg border border-gray-700/50">
                            <div className="col-span-2">
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

                            <div className="col-span-2">
                              <input
                                value={part.label}
                                onChange={e => handleUpdatePart(s.id, part.id, 'label', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-theme-text-main outline-none focus:border-gold-500"
                                placeholder="Instruction Text"
                              />
                            </div>

                            <div className="col-span-1">
                              <input
                                type="number"
                                value={part.marks}
                                onChange={e => handleUpdatePart(s.id, part.id, 'marks', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-gold-500 font-black text-center outline-none focus:border-gold-500"
                              />
                            </div>

                            <div className="col-span-1">
                              <input
                                type="number"
                                value={part.questionCount || 0}
                                onChange={e => handleUpdatePart(s.id, part.id, 'questionCount', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-theme-text-main font-bold text-center outline-none focus:border-gold-500"
                              />
                            </div>

                            <div className="col-span-1">
                              <input
                                type="number"
                                value={part.attemptCount || 0}
                                onChange={e => handleUpdatePart(s.id, part.id, 'attemptCount', parseInt(e.target.value) || 0)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-gold-500 font-bold text-center outline-none focus:border-gold-500"
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
                                  type="button"
                                  onClick={() => handleUpdatePart(s.id, part.id, 'isAlternative', !part.isAlternative)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${part.isAlternative ? 'bg-gold-500 text-black border-gold-500' : 'bg-gray-800 text-theme-text-sub border border-gray-700 hover:text-theme-text-main'}`}
                                >
                                  {part.isAlternative ? <Check size={10} /> : null}
                                  {part.isAlternative ? 'OR (Alternative)' : 'Sequential'}
                                </button>
                              )}
                            </div>

                            <div className="col-span-1 flex justify-center">
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

        {/* FOOTER ACTION BAR */}
        <div className="pt-3 mt-2 border-t border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
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
