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
  BookOpen, ChevronDown, ChevronUp, Type as TypeIcon, ListTree, Clock
} from 'lucide-react';

interface PaperPatternsProps {
  user: User;
  onBack: () => void;
  onUsePattern?: (pattern: PaperPattern) => void;
}

const PREDEFINED_TYPES = [
  'MCQ', 'SHORT', 'LONG', 'NUMERICAL', 'Letter', 'Application', 'Story', 'Punctuation', 
  'Pair of words', 'Translate passage In urdu', 'Translate passage to English', 'Essay',
  'تشریح اشعار', 'سیاق و سباق کے حوالے سے تشریح', 'سبق کا خلاصہ', 'نظم کا مرکزی خیال',
  'مکالمہ', 'درخواست', 'تلخیص نگاری', 'الفاظ معنی', 'آیات کا ترجمہ', 'احادیث کی تشریح'
];

const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text || '');

const getSectionTagStyles = (type: string) => {
  const upper = type.toUpperCase();
  if (isUrdu(type)) return 'bg-gold-500/10 text-gold-400 border-gold-500/30 ring-gold-500/5';
  if (upper.includes('MCQ')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30 ring-blue-500/5';
  if (upper.includes('SHORT')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-emerald-500/5';
  if (upper.includes('LONG')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30 ring-purple-500/5';
  if (upper.includes('NUMERICAL')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30 ring-orange-500/5';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/30 ring-gray-500/5';
};

const getAutoTitle = (type: string, count: number, marks: number, index: number): string | null => {
  const isUrduType = isUrdu(type);
  const marksCalc = isUrduType 
    ? `(${count * marks} = ${marks} × ${count})`
    : `(${count} x ${marks} = ${count * marks} Marks)`;
  
  let baseTitle = '';
  if (type === 'MCQ') {
    baseTitle = isUrduType ? "تمام سوالات کے جوابات دیں" : "Attempt all. Circle the correct answer";
  } else if (type === 'SHORT') {
    baseTitle = isUrduType ? `کوئی سے ${count} مختصر سوالات کے جوابات دیں` : `Write short answers to any ${count} questions.`;
  } else if (type === 'LONG') {
    baseTitle = isUrduType ? `کوئی سے ${count} تفصیلی سوالات کے جوابات دیں` : `Attempt any ${count} questions.`;
  } else {
    const suggestions = TYPE_TITLE_MAPPING[type] || [];
    baseTitle = suggestions[0] || type;
  }

  const cleanBase = baseTitle
    .replace(/^Q\d+\. /, '')
    .replace(/^سوال نمبر \d+\. /, '')
    .replace(/^سوال نمبر \. \d+/, '')
    .split(' (')[0]
    .trim();

  if (isUrduType) {
    return `سوال نمبر ${index + 1}. ${cleanBase} ${marksCalc}`;
  } else {
    return `Q${index + 1}. ${cleanBase} ${marksCalc}`;
  }
};

const TYPE_TITLE_MAPPING: Record<string, string[]> = {
  'MCQ': ['Attempt all. Circle the correct answer', 'Circle the Correct Answer', 'Objective Part'],
  'SHORT': ['Write short answers to any (?) questions.', 'Section I: Short Answers', 'Answer any (?) questions.'],
  'LONG': ['Attempt any (?) questions.', 'Detailed Answers', 'Section II: Descriptive'],
  'NUMERICAL': ['Solve the Numericals', 'Mathematical Problems', 'Numericals'],
  'Letter': ['Write a Letter to...', 'Formal Letter', 'Informal Letter'],
  'Application': ['Write an Application for...', 'Official Application', 'School Application'],
  'Story': ['Write a Story on...', 'Moral Story', 'Story Writing'],
  'Punctuation': ['Punctuate the following lines', 'Sentence Punctuation', 'Correct Punctuation'],
  'Pair of words': ['Use Pairs of Words in sentences', 'Pairs of Words', 'Vocabulary Check'],
  'Translate passage In urdu': ['Translate into Urdu', 'Urdu Translation', 'Translation (Eng to Urdu)'],
  'Translate passage to English': ['Translate into English', 'English Translation', 'Translation (Urdu to Eng)'],
  'Essay': ['Write an Essay on...', 'Descriptive Essay', 'English Essay'],
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
    
    const modes: Record<string, boolean> = {};
    const expanded: Record<string, boolean> = {};
    pattern.sections.forEach((s, index) => {
      const autoTitle = getAutoTitle(s.type, s.attemptCount, s.marksPerQuestion, index);
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
    const autoTitle = getAutoTitle(type, 10, 1, index);
    const newSection: PaperPatternSection = {
      id: sectionId, 
      type: type, 
      title: autoTitle || `Q${index + 1}. Attempt all. (10 x 1 = 10 Marks)`, 
      questionCount: 10, 
      attemptCount: 10, 
      marksPerQuestion: 1
    };
    setSections([...sections, newSection]);
  };

  const handleUpdateSection = (id: string, field: keyof PaperPatternSection, value: any) => {
    setSections(prev => {
      return prev.map((s, idx) => {
        if (s.id !== id) return s;
        
        let nextSection = { ...s, [field]: value };

        if (field === 'type' || field === 'attemptCount' || field === 'marksPerQuestion') {
           if (!customTitleModes[id]) {
             const updatedType = field === 'type' ? value : s.type;
             const updatedCount = field === 'attemptCount' ? value : s.attemptCount;
             const updatedMarks = field === 'marksPerQuestion' ? value : s.marksPerQuestion;
             const autoTitle = getAutoTitle(updatedType, updatedCount, updatedMarks, idx);
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
      const nextLabel = String.fromCharCode(97 + parts.length); // a, b, c...
      // Default type to the parent section's type
      parts.push({ id: generateId(), label: `(${nextLabel})`, marks: 0, type: s.type });
      return { ...s, subParts: parts };
    }));
  };

  const handleUpdatePart = (sectionId: string, partId: string, field: keyof PaperPatternSectionPart, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const parts = s.subParts?.map(p => p.id === partId ? { ...p, [field]: value } : p);
      
      // If we update marks of sub-parts, we might want to sync the main marksPerQuestion
      const totalPartMarks = parts?.reduce((acc, p) => acc + (p.marks || 0), 0) || s.marksPerQuestion;
      
      return { ...s, subParts: parts, marksPerQuestion: totalPartMarks };
    }));
  };

  const handleRemovePart = (sectionId: string, partId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const parts = s.subParts?.filter(p => p.id !== partId).map((p, i) => ({
        ...p,
        label: `(${String.fromCharCode(97 + i)})`
      }));
      const totalPartMarks = parts?.reduce((acc, p) => acc + (p.marks || 0), 0) || s.marksPerQuestion;
      return { ...s, subParts: parts, marksPerQuestion: totalPartMarks };
    }));
  };

  const handleRemoveSection = (id: string) => {
    setSections(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return filtered.map((s, idx) => {
        if (customTitleModes[s.id]) return s;
        const autoTitle = getAutoTitle(s.type, s.attemptCount, s.marksPerQuestion, idx);
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
         <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Select Subject</h2>
         <button onClick={loadData} className="flex items-center gap-2 text-sm text-gold-500 hover:text-white transition-colors" disabled={isLoading}>
           <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh List
         </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {availableSubjects.map(subject => {
          const patternCount = patterns.filter(p => p.subject?.toLowerCase() === subject.toLowerCase() || (!p.subject && p.classLevel)).length;
          return (
            <div key={subject} onClick={() => handleSubjectClick(subject)} className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col items-center gap-4 cursor-pointer transition-all hover:border-gold-500 hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-white font-bold text-lg text-center leading-tight">{subject}</h3>
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
               <h2 className="text-2xl font-bold text-white flex items-center gap-2 uppercase tracking-tighter">
                 <span className="text-gold-500">{selectedSubject}</span> Patterns
               </h2>
               <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">{subjectPatterns.length} Available Layouts</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-grow md:w-64">
                <input 
                  type="text" 
                  placeholder="Search layouts..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-xl focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all text-sm"
                />
                <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              </div>
              {isAdmin && (
                <Button onClick={handleCreateNew} className="!w-auto py-2 px-4 text-xs">
                  <Plus size={16} className="mr-1" /> New Layout
                </Button>
              )}
            </div>
         </div>

         {subjectPatterns.length === 0 ? (
            <div className="text-center p-16 bg-gray-800 border border-dashed border-gray-700 rounded-2xl text-gray-500">
               <Layout size={48} className="mx-auto mb-4 opacity-20" />
               <p className="text-lg font-bold">No patterns found matching your search.</p>
            </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {subjectPatterns.map(pattern => (
                 <div key={pattern.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gold-500 flex flex-col h-full transition-all group">
                    <div className="flex justify-between items-start mb-3">
                       <h3 className="font-bold text-white text-lg leading-tight group-hover:text-gold-500 transition-colors">{pattern.name}</h3>
                       {pattern.classLevel && <span className="text-[9px] bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 font-bold uppercase">{pattern.classLevel}</span>}
                    </div>
                    
                    <div className="mb-6 flex-grow">
                       <div className="flex flex-wrap gap-2 mt-3">
                          {pattern.sections.map((s, i) => (
                             <div key={i} className="flex flex-col gap-1">
                               <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-tight shadow-inner transition-all hover:brightness-110 ring-1 ${getSectionTagStyles(s.type)} ${isUrdu(s.type) ? 'font-urdu py-0.5' : ''}`}>
                                 <span className="uppercase opacity-90">{s.type}</span>
                                 <span className="w-px h-2.5 bg-current opacity-20"></span>
                                 <span className="text-white brightness-125 font-black">{s.attemptCount}/{s.questionCount}</span>
                               </span>
                               {s.subParts && s.subParts.length > 0 && (
                                 <span className="text-[8px] text-gray-500 italic pl-2">Has {s.subParts.length} parts</span>
                               )}
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-700/50 pt-4 mt-auto">
                       <div className="flex flex-col">
                          <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Total Weight</span>
                          <span className="text-lg font-black text-gold-500 leading-none">{pattern.totalMarks} Marks</span>
                       </div>
                       <Button onClick={() => onUsePattern && onUsePattern({ ...pattern, subject: pattern.subject || selectedSubject })} className="!w-auto text-[10px] py-1.5 px-4 font-black">Use Layout</Button>
                    </div>

                    {isAdmin && (
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-700/30">
                        <button onClick={() => handleEditPattern(pattern)} className="p-1.5 text-blue-400 hover:bg-blue-900/20 rounded transition-colors"><Edit size={14} /></button>
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
                      <p className="text-sm font-bold text-white">{selectedSubject}</p>
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
                <label className="text-sm font-bold text-gold-100 uppercase tracking-widest block">
                  Apply to Additional Subjects
                </label>
                
                <div 
                  onClick={() => formData.classLevel && setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                  className={`w-full px-4 py-3 bg-gray-900 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${!formData.classLevel ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-gold-500'} ${isSubjectDropdownOpen ? 'border-gold-500 ring-2 ring-gold-500/20' : 'border-gray-700'}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {formData.selectedSubjects.length === 0 ? (
                      <span className="text-gray-500 text-sm italic">Pattern already applies to <strong>{editingPattern?.subject || selectedSubject}</strong></span>
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
                    <div className="p-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Subjects</span>
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
                            className="text-[10px] text-gold-500 hover:text-white font-black uppercase underline decoration-gold-500/30"
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
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-gold-500/10 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
                          >
                             {isChecked ? <CheckSquare size={18} className="text-gold-500" /> : <Square size={18} />}
                             <span className="text-xs font-bold">{sub}</span>
                          </div>
                        );
                      })}
                      {classSubjects.length === 0 && (
                        <div className="p-8 text-center text-gray-500 italic text-xs">No other subjects found for {formData.classLevel}</div>
                      )}
                    </div>
                  </div>
                )}
                
                {!formData.classLevel && (
                  <p className="text-[10px] text-gray-500 italic">Please select a Target Class first to enable this menu.</p>
                )}
              </div>
           </div>

           <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2"><Layers className="text-gold-500" size={20} /> Part Configuration</h3>
              <Button onClick={handleAddSection} variant="secondary" className="!w-auto text-[10px] py-1.5 px-4 font-black"><Plus size={14} className="mr-1"/> Add New Part</Button>
           </div>
           
           <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-gray-500 mb-3 px-2 uppercase tracking-widest">
              <div className="col-span-3 text-center">Section Type</div><div className="col-span-3">Display Title</div><div className="col-span-2 text-center">Total Qs</div><div className="col-span-2 text-center">Attempt Limit</div><div className="col-span-1 text-center">Marks/Q</div><div className="col-span-1 text-center">Action</div>
           </div>
           
           <div className="space-y-4 mb-8">
               {sections.map((s, idx) => {
                 const isCustomType = !PREDEFINED_TYPES.includes(s.type);
                 const isCustomTitleMode = customTitleModes[s.id] || isCustomType;
                 const rawSuggestions = TYPE_TITLE_MAPPING[s.type] || [];
                 const isExpanded = expandedSectionParts[s.id];

                 const suggestions = rawSuggestions.map(rs => {
                   const isUrduType = isUrdu(s.type);
                   const clean = rs.replace('(?)', s.attemptCount.toString()).split(' (')[0];
                   const marksCalc = isUrduType 
                      ? `(${s.attemptCount * s.marksPerQuestion} = ${s.marksPerQuestion} × ${s.attemptCount})`
                      : `(${s.attemptCount} x ${s.marksPerQuestion} = ${s.attemptCount * s.marksPerQuestion} Marks)`;
                   
                   if (isUrduType) {
                     let urduBody = clean;
                     if (s.type === 'SHORT') urduBody = `کوئی سے ${s.attemptCount} مختصر سوالات کے جوابات دیں`;
                     if (s.type === 'LONG') urduBody = `کوئی سے ${s.attemptCount} تفصیلی سوالات کے جوابات دیں`;
                     if (s.type === 'MCQ') urduBody = "تمام سوالات کے جوابات دیں";
                     return `سوال نمبر ${idx + 1}. ${urduBody} ${marksCalc}`;
                   }
                   return `Q${idx + 1}. ${clean} ${marksCalc}`;
                 });

                 return (
                   <div key={s.id} className="space-y-2">
                     <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-xl grid grid-cols-12 gap-2 items-center hover:border-gray-500 transition-colors">
                        <div className="col-span-3">
                          {isCustomType ? (
                            <div className="flex gap-1">
                              <input 
                                value={s.type} 
                                onChange={e => handleUpdateSection(s.id, 'type', e.target.value)} 
                                className="w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg border border-gold-500/50 outline-none font-urdu" 
                                placeholder="Enter Type..."
                                autoFocus 
                              />
                              <button onClick={() => handleUpdateSection(s.id, 'type', 'MCQ')} className="p-2 text-gray-500 hover:text-white" title="Reset to list"><X size={14} /></button>
                            </div>
                          ) : (
                            <select 
                              value={s.type} 
                              onChange={e => handleUpdateSection(s.id, 'type', e.target.value === 'OTHER' ? '' : e.target.value)} 
                              className={`w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg border border-gray-700 outline-none ${isUrdu(s.type) ? 'font-urdu' : ''}`}
                            >
                              {PREDEFINED_TYPES.map(t => (
                                <option key={t} value={t} className={isUrdu(t) ? 'font-urdu' : ''}>
                                  {t}
                                </option>
                              ))}
                              <option value="OTHER">Other...</option>
                            </select>
                          )}
                        </div>
                        
                        <div className="col-span-3">
                          {isCustomTitleMode ? (
                             <div className="flex gap-1">
                               <input 
                                 value={s.title} 
                                 onChange={e => handleUpdateSection(s.id, 'title', e.target.value)} 
                                 className={`w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg border ${isUrdu(s.title) ? 'font-urdu text-right' : ''} border-gray-600 outline-none`} 
                                 placeholder="e.g. Part I" 
                                 dir={isUrdu(s.title) ? "rtl" : "ltr"}
                               />
                               {!isCustomType && (
                                 <button 
                                   onClick={() => {
                                     setCustomTitleModes(prev => ({...prev, [s.id]: false}));
                                     const autoTitle = getAutoTitle(s.type, s.attemptCount, s.marksPerQuestion, idx);
                                     handleUpdateSection(s.id, 'title', autoTitle || suggestions[0] || `سوال نمبر ${idx+1}. Title`);
                                   }} 
                                   className="p-1 text-gray-500 hover:text-white"
                                 >
                                   <X size={12} />
                                 </button>
                               )}
                             </div>
                          ) : (
                            <select 
                              value={s.title} 
                              onChange={e => {
                                if (e.target.value === 'OTHER_TITLE') {
                                  setCustomTitleModes(prev => ({...prev, [s.id]: true}));
                                } else {
                                  handleUpdateSection(s.id, 'title', e.target.value);
                                }
                              }} 
                              className={`w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg border border-gray-700 outline-none ${isUrdu(s.title) ? 'font-urdu text-right' : ''}`}
                              dir={isUrdu(s.title) ? "rtl" : "ltr"}
                            >
                              {suggestions.map(title => (
                                <option key={title} value={title} className={isUrdu(title) ? 'font-urdu' : ''}>
                                  {title}
                                </option>
                              ))}
                              <option value="OTHER_TITLE">Other...</option>
                            </select>
                          )}
                        </div>

                        <div className="col-span-2"><input type="number" value={s.questionCount} onChange={e => handleUpdateSection(s.id, 'questionCount', parseInt(e.target.value) || 0)} className="w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg border border-gray-700 text-center outline-none" /></div>
                        <div className="col-span-2"><input type="number" value={s.attemptCount} onChange={e => handleUpdateSection(s.id, 'attemptCount', parseInt(e.target.value) || 0)} className="w-full bg-gray-800 text-gold-500 font-bold text-[10px] p-2 rounded-lg border border-gray-700 text-center outline-none" /></div>
                        <div className="col-span-1">
                          <input 
                            type="number" 
                            disabled={!!(s.subParts && s.subParts.length > 0)}
                            value={s.marksPerQuestion} 
                            onChange={e => handleUpdateSection(s.id, 'marksPerQuestion', parseInt(e.target.value) || 0)} 
                            className={`w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg border border-gray-700 text-center outline-none ${s.subParts && s.subParts.length > 0 ? 'opacity-50 cursor-not-allowed bg-gray-900' : ''}`} 
                          />
                        </div>
                        <div className="col-span-1 flex justify-center gap-1">
                           {(s.type === 'LONG' || s.type === 'NUMERICAL') && (
                             <button 
                               onClick={() => handleToggleParts(s.id)}
                               className={`p-1.5 rounded transition-all ${isExpanded ? 'bg-gold-500 text-black' : 'text-gold-500 hover:bg-gold-500/10'}`}
                               title="Configure Question Sub-parts (a, b, c)"
                             >
                               <ListTree size={16} />
                             </button>
                           )}
                           <button onClick={() => handleRemoveSection(s.id)} className="text-red-500 p-1.5 hover:bg-red-900/20 rounded transition-all"><Trash2 size={16} /></button>
                        </div>
                     </div>

                     {/* Sub-parts Configuration UI */}
                     {isExpanded && (
                       <div className="ml-8 p-4 bg-gray-800/50 border border-gold-500/30 rounded-xl animate-fadeIn space-y-3">
                          <div className="flex justify-between items-center mb-2 text-[10px] font-black uppercase tracking-widest text-gold-500">
                             <div className="flex items-center gap-2">
                               <Info size={12} /> Manage Sub-parts for Question {idx + 1}
                             </div>
                             <div className="grid grid-cols-12 gap-3 flex-grow ml-8 text-gray-500">
                                <div className="col-span-2">Label</div>
                                <div className="col-span-4">Type / Category</div>
                                <div className="col-span-3">Marks</div>
                             </div>
                             <button 
                               onClick={() => handleAddPart(s.id)}
                               className="bg-gold-500/10 text-gold-500 border border-gold-500/30 px-3 py-1 rounded hover:bg-gold-500 hover:text-black transition-all flex items-center gap-1"
                             >
                               <Plus size={10} /> Add Part
                             </button>
                          </div>

                          <div className="space-y-2">
                             {s.subParts?.map((part, pIdx) => (
                               <div key={part.id} className="grid grid-cols-12 gap-3 items-center">
                                  <div className="col-span-2">
                                     <input 
                                       value={part.label} 
                                       onChange={e => handleUpdatePart(s.id, part.id, 'label', e.target.value)}
                                       className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-white text-center outline-none focus:border-gold-500 font-bold"
                                       placeholder="(a)"
                                     />
                                  </div>
                                  <div className="col-span-4">
                                     <select 
                                       value={part.type || s.type} 
                                       onChange={e => handleUpdatePart(s.id, part.id, 'type', e.target.value)}
                                       className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-white outline-none focus:border-gold-500"
                                     >
                                        {PREDEFINED_TYPES.map(pt => (
                                          <option key={pt} value={pt}>{pt}</option>
                                        ))}
                                     </select>
                                  </div>
                                  <div className="col-span-3 flex items-center gap-2">
                                     <input 
                                       type="number"
                                       value={part.marks} 
                                       onChange={e => handleUpdatePart(s.id, part.id, 'marks', parseInt(e.target.value) || 0)}
                                       className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] text-gold-500 font-black text-center outline-none focus:border-gold-500"
                                     />
                                  </div>
                                  <div className="col-span-3 flex justify-end">
                                     <button 
                                       onClick={() => handleRemovePart(s.id, part.id)}
                                       className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-all"
                                     >
                                       <Trash2 size={12} />
                                     </button>
                                  </div>
                               </div>
                             ))}
                             {(!s.subParts || s.subParts.length === 0) && (
                               <p className="text-center text-[10px] text-gray-500 italic py-2">No sub-parts defined. Each question will be treated as a single unit.</p>
                             )}
                          </div>
                          
                          {s.subParts && s.subParts.length > 0 && (
                            <div className="pt-3 border-t border-gray-700 flex justify-between items-center text-[10px]">
                               <span className="text-gray-400">Sum of sub-part marks:</span>
                               <span className="bg-gold-500 text-black px-2 py-0.5 rounded font-black">{s.subParts.reduce((acc, p) => acc + p.marks, 0)} Marks Total</span>
                            </div>
                          )}
                       </div>
                     )}
                   </div>
                 );
               })}
           </div>

           <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-700 gap-6">
               <div className="flex gap-3 w-full sm:w-auto">
                  <Button variant="secondary" onClick={() => setView('LIST')} className="!w-auto px-6 border-gray-700">Cancel</Button>
                  <Button onClick={handleSavePattern} isLoading={isSaving} className="!w-auto px-10 font-black uppercase">Confirm Layout</Button>
               </div>
               <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-gray-700 pt-4 sm:pt-0 sm:pl-8 w-full sm:w-auto">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Cumulative Marks</p>
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
        <button onClick={() => view === 'SUBJECTS' ? onBack() : setView('SUBJECTS')} className="text-gray-400 hover:text-gold-500 flex items-center transition-colors">
          <ArrowLeft size={20} className="mr-1" /> Back
        </button>
        <div className="flex-grow text-center text-lg font-bold text-white tracking-widest uppercase">Exam Layouts</div>
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