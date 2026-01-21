
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { CLASSES } from '../constants';
import { getSubjects, addSubject, deleteSubject, renameSubject } from '../services/subjectService';
import { getChapters, addChapter, deleteChapter, renameChapter } from '../services/chapterService';
import { saveUploadedChapterContent } from '../services/questionService';
// Fix: Import GoogleGenAI from @google/genai as required by SDK guidelines
//import { GoogleGenAI } from "@google/genai";
import { 
  ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle, X, Info, 
  GraduationCap, FileText, ChevronRight, Plus, Trash2, Edit, RefreshCw, 
  Database, ListChecks, AlertTriangle, FileDown
} from 'lucide-react';
import { Chapter, User, Question, Subtopic, QuestionType } from '../types';

interface UploadPaperProps {
  user: User;
  onBack: () => void;
}

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const isUrduStyleSubject = (subject: string) => {
  const s = subject.toLowerCase();
  return s.includes('urdu') || s.includes('islam') || s.includes('pak study') || s.includes('pak studies') || s.includes('arab') || s.includes('per');
};

export const UploadPaper: React.FC<UploadPaperProps> = ({ user, onBack }) => {
  const [step, setStep] = useState(1);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [parsedSubtopics, setParsedSubtopics] = useState<Subtopic[]>([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);
  const [isConvertingMath, setIsConvertingMath] = useState(false);

  // Fix: Defined isAdmin which was previously missing and causing crashes
  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';
  const isUrduPaper = isUrduStyleSubject(selectedSubject);

  useEffect(() => {
    if (parsedQuestions.length > 0 && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [parsedQuestions, isConvertingMath]);

  useEffect(() => {
    if (selectedClass) loadSubjects();
  }, [selectedClass]);

  const loadSubjects = async () => {
    try {
      const allSubjectsMap = await getSubjects();
      setAvailableSubjects(allSubjectsMap[selectedClass] || []);
    } catch (e) {
      console.error("Failed to load subjects", e);
    }
  };

  useEffect(() => {
    if (selectedClass && selectedSubject) loadChapters();
  }, [selectedClass, selectedSubject]);

  const loadChapters = async () => {
    try {
      const chapters = await getChapters(selectedSubject, selectedClass);
      setAvailableChapters(chapters);
    } catch (e) {
      console.error("Failed to load chapters", e);
    }
  };

  const handleBack = () => {
    if (step === 1) onBack();
    else if (step === 2) { setSelectedClass(''); setStep(1); }
    else if (step === 3) { setSelectedSubject(''); setStep(2); }
    else if (step === 4) {
      setSelectedChapter(null);
      resetUploadState();
      setStep(3);
      loadChapters();
    }
  };

  const resetUploadState = () => {
    setFile(null);
    setParsedQuestions([]);
    setUploadSuccess(false);
    setIsConvertingMath(false);
  };

  const [newSubjectName, setNewSubjectName] = useState('');
  const [addSubjectModal, setAddSubjectModal] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [editingSubjectOriginalName, setEditingSubjectOriginalName] = useState('');
  const [editSubjectModal, setEditSubjectModal] = useState(false);
  const [addChapterModal, setAddChapterModal] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [editChapterModal, setEditChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);

  const handleSaveNewSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setIsActionLoading(true);
    try {
      const success = await addSubject(selectedClass, newSubjectName.trim());
      if (success) { 
        await loadSubjects(); 
        setAddSubjectModal(false); 
        setNewSubjectName(''); 
      }
    } finally { 
      setIsActionLoading(false); 
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewName = newSubjectName.trim();
    if (cleanNewName && editingSubjectOriginalName && cleanNewName !== editingSubjectOriginalName) {
      setIsActionLoading(true);
      try {
        const success = await renameSubject(selectedClass, editingSubjectOriginalName, cleanNewName);
        if (success) {
          await loadSubjects();
          setEditSubjectModal(false);
          setNewSubjectName('');
          setEditingSubjectOriginalName('');
        } else {
          alert("Could not rename subject. Please check permissions.");
        }
      } catch (err) {
        console.error("Subject update failed", err);
      } finally { 
        setIsActionLoading(false); 
    }
    } else {
      setEditSubjectModal(false);
    }
  };

  const handleDeleteSubject = async (subj: string) => {
    if (!window.confirm(`Are you sure you want to delete ${subj}? All associated data for this subject will be hidden.`)) return;
    setIsActionLoading(true);
    try {
      await deleteSubject(selectedClass, subj);
      await loadSubjects();
    } catch (e) {
      console.error("Deletion failed", e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveNewChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterName.trim()) return;
    setIsActionLoading(true);
    try {
      const success = await addChapter(selectedSubject, selectedClass, newChapterName.trim());
      if (success) {
        await loadChapters();
        setAddChapterModal(false);
        setNewChapterName('');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newChapterName.trim() && editingChapter) {
      setIsActionLoading(true);
      try {
        const success = await renameChapter(editingChapter.id, newChapterName.trim());
        if (success) {
          await loadChapters();
          setEditChapterModal(false);
          setNewChapterName('');
          setEditingChapter(null);
        }
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  const handleDeleteChapterAction = async (chId: string, chName: string) => {
    if (!window.confirm(`Are you sure you want to delete chapter: ${chName}?`)) return;
    setIsActionLoading(true);
    try {
      await deleteChapter(chId);
      await loadChapters();
    } catch (e) {
      console.error("Chapter deletion failed", e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Subtopic", "Type", "Question(Eng)", "Question(Urdu)", 
      "OptA(Eng)", "OptB(Eng)", "OptC(Eng)", "OptD(Eng)", 
      "OptA(Urdu)", "OptB(Urdu)", "OptC(Urdu)", "OptD(Urdu)", 
      "CorrectAnswer", "Marks"
    ];
    const rows = [
      ["Atomic Structure", "MCQ", "Who discovered the electron?", "الیکٹران کس نے دریافت کیا؟", "J.J. Thomson", "Rutherford", "Bohr", "Dalton", "جے جے ثامسن", "ردرفورڈ", "بوہر", "ڈالٹن", "A", "1"],
      ["Chemical Bonding", "SHORT", "Define Ionic Bond.", "آئیونک بانڈ کی تعریف کریں۔", "", "", "", "", "", "", "", "", "", "2"],
      ["Mathematics", "MCQ", "Solve: x^2 = 4", "حل کریں: x^2 = 4", "2", "-2", "Both", "None", "2", "-2", "دونوں", "کوئی نہیں", "C", "1"]
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "APLUS_Question_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i+1] === '"') { cell += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        result.push(cell.trim()); cell = '';
      } else { cell += char; }
    }
    result.push(cell.trim());
    return result;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setUploadSuccess(false);
      const text = await selectedFile.text();
      const rows = text.split(/\r?\n/);
      const questions: Question[] = [];
      const subtopicsSet = new Set<string>();
      let startIndex = 0;
      if (rows.length > 0) {
         const firstRow = rows[0].toLowerCase();
         if (firstRow.includes('subtopic') || firstRow.includes('type') || firstRow.includes('question')) startIndex = 1;
      }
      for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i].trim();
          if (!row) continue;
          const cleanCols = parseCSVLine(row);
          if (cleanCols.length < 3) continue;
          const subtopicName = cleanCols[0] ? cleanCols[0].trim() : 'General';
          let typeStr = cleanCols[1] ? cleanCols[1].toUpperCase().trim() : 'MCQ';
          const type = (['MCQ', 'SHORT', 'LONG', 'NUMERICAL', 'ESSAY', 'TRANSLATION'].includes(typeStr) ? typeStr : 'MCQ') as QuestionType;
          const textEng = cleanCols[2] ? cleanCols[2].trim() : ''; 
          const textUrdu = cleanCols.length > 3 ? cleanCols[3].trim() : '';
          const optionsEng = [cleanCols[4], cleanCols[5], cleanCols[6], cleanCols[7]].filter(o => o !== undefined && o !== '');
          let optionsUrdu: string[] | undefined = undefined;
          let correctAnswerIndex = 8;
          let marksIndex = 9;
          if (cleanCols.length >= 14) {
            optionsUrdu = [cleanCols[8], cleanCols[9], cleanCols[10], cleanCols[11]].filter(o => o !== undefined && o !== '');
            correctAnswerIndex = 12; marksIndex = 13;
          }
          const correctAnswer = cleanCols.length > correctAnswerIndex ? cleanCols[correctAnswerIndex].trim() : '';
          const marks = parseInt(cleanCols[marksIndex]) || (type === 'MCQ' ? 1 : 2);
          if (subtopicName) subtopicsSet.add(subtopicName);
          questions.push({ id: generateId(), chapterId: selectedChapter!.id, subtopic: subtopicName, type, text: textEng, textUrdu, options: type === 'MCQ' ? optionsEng : undefined, optionsUrdu: type === 'MCQ' ? optionsUrdu : undefined, correctAnswer, marks });
      }
      setParsedQuestions(questions);
      setParsedSubtopics(Array.from(subtopicsSet).map(name => ({ id: name, name: name })));
    }
  };

  const convertMathToLatex = async (questions: Question[]) => {
    // Safety check for API key
    if (!process.env.API_KEY) {
      console.warn("API Key missing. Uploading without auto-conversion.");
      return questions;
    }

    setIsConvertingMath(true);
    // Fix: Initialize GoogleGenAI properly using the named parameter as per SDK guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const batch = questions.map(q => ({
      id: q.id,
      text: q.text,
      textUrdu: q.textUrdu,
      options: q.options,
      optionsUrdu: q.optionsUrdu
    }));

    const prompt = `You are an expert Mathematics Professor and LaTeX specialist. 
    Your mission: Transform all complex LaTeX mathematical structures in the provided JSON array into a simplified, linear 'pure math' format that uses slashes for fractions.
    
    STRICT RULES:
    1. CONVERT all fractions: Change any instance of \\frac{a}{b} into (a/b) or a/b. 
       - Example: \\frac{3}{2} MUST become 3/2
       - Example: b = \\frac{5}{3} MUST become b = 5/3
    2. DELIMITERS: Wrap ALL identified mathematical expressions, variables (x, y, θ, etc.), and formulas in single dollar signs '$' for inline rendering (e.g., $x^2$, $3/4$).
    3. LANGUAGES: Process both 'text' (English) and 'textUrdu' (Urdu) fields. Do NOT translate natural language; only convert the math notation.
    4. OUTPUT: Return ONLY a valid JSON array of objects with the exact same structure and IDs.

    Input JSON: ${JSON.stringify(batch)}`;

    try {
      // Fix: Use ai.models.generateContent to query GenAI directly as per SDK guidelines
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
          responseMimeType: "application/json" 
        }
      });

      // Fix: Directly access the .text property instead of calling it as a method
      const jsonStr = response.text?.trim() || '[]';
      const convertedBatch = JSON.parse(jsonStr);
      
      return questions.map((q, i) => {
        const converted = convertedBatch.find((c: any) => c.id === q.id) || convertedBatch[i];
        return {
          ...q,
          text: converted?.text || q.text,
          textUrdu: converted?.textUrdu || q.textUrdu,
          options: converted?.options || q.options,
          optionsUrdu: converted?.optionsUrdu || q.optionsUrdu
        };
      });
    } catch (e) {
      console.error("Math conversion failed. Falling back to original data.", e);
      return questions;
    } finally {
      setIsConvertingMath(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedChapter || parsedQuestions.length === 0) return;
    
    setIsUploading(true);
    try {
        let finalQuestions = parsedQuestions;
        const isMath = selectedSubject.toLowerCase().includes('math') || selectedSubject.toLowerCase().includes('hisab');
        
        if (isMath) {
          finalQuestions = await convertMathToLatex(parsedQuestions);
        }

        const success = await saveUploadedChapterContent(selectedChapter.id, selectedSubject, selectedClass, finalQuestions, parsedSubtopics);
        if (success) { 
          setParsedCount(finalQuestions.length); 
          setUploadSuccess(true); 
          await loadChapters(); 
        }
    } catch (error: any) { 
      alert(error.message || "Error uploading data."); 
    } finally { 
      setIsUploading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans transition-colors duration-300 tex2jax_process">
      {/* Subject Modals */}
      {addSubjectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-800 border border-gold-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Add New Subject</h3>
            <form onSubmit={handleSaveNewSubject}>
              <Input label="Subject Name" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="e.g. Physics" autoFocus />
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => { setAddSubjectModal(false); setNewSubjectName(''); }} type="button">Cancel</Button>
                <Button type="submit" isLoading={isActionLoading}>Add Subject</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editSubjectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-800 border border-gold-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Edit Subject</h3>
            <form onSubmit={handleUpdateSubject}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Original: {editingSubjectOriginalName}</label>
                <Input label="New Subject Name" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="e.g. Physics" autoFocus />
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => { setEditSubjectModal(false); setNewSubjectName(''); setEditingSubjectOriginalName(''); }} type="button">Cancel</Button>
                <Button type="submit" isLoading={isActionLoading}>Update Name</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chapter Modals */}
      {addChapterModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-800 border border-gold-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Add New Chapter</h3>
            <form onSubmit={handleSaveNewChapter}>
              <Input label="Chapter Name" value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} placeholder="e.g. Chapter 1: Introduction" autoFocus />
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => { setAddChapterModal(false); setNewChapterName(''); }} type="button">Cancel</Button>
                <Button type="submit" isLoading={isActionLoading}>Add Chapter</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editChapterModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-800 border border-gold-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Edit Chapter Name</h3>
            <form onSubmit={handleUpdateChapter}>
              <Input label="New Chapter Name" value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} placeholder="e.g. Chapter 1: Updated Title" autoFocus />
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => { setEditChapterModal(false); setEditingChapter(null); setNewChapterName(''); }} type="button">Cancel</Button>
                <Button type="submit" isLoading={isActionLoading}>Update Name</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10 h-20 flex items-center px-6 shadow-lg">
        <button onClick={handleBack} className="text-gray-400 hover:text-gold-500 flex items-center transition-colors">
          <ArrowLeft size={20} className="mr-1" /><span className="font-medium hidden sm:inline">Back</span>
        </button>
        <div className="flex-grow flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Step {step} of 4</span>
          <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gold-500 transition-all duration-300" style={{width: `${(step/4)*100}%`}}></div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-6xl mx-auto w-full px-4 py-8">
          {step === 1 && (
            <div className="animate-fadeIn grid grid-cols-2 md:grid-cols-4 gap-6">
              {CLASSES.map(cls => (
                <div key={cls} onClick={() => { setSelectedClass(cls); setStep(2); }} className="bg-gray-800 border border-gray-700 hover:border-gold-500 rounded-xl p-6 flex flex-col items-center gap-4 cursor-pointer transition-all hover:-translate-y-1 group">
                  <div className="text-gold-500 group-hover:scale-110 transition-transform"><GraduationCap size={40} /></div>
                  <span className="font-bold text-white text-lg">{cls}</span>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadeIn space-y-6">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{selectedClass} Subjects</h2>
                 {isAdmin && (
                   <Button onClick={() => setAddSubjectModal(true)} className="!w-auto text-xs py-2 px-4">
                     <Plus size={16} className="mr-2" /> Add Subject
                   </Button>
                 )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {isActionLoading && availableSubjects.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center">
                     <RefreshCw className="animate-spin mb-2" />
                     <span>Loading Subjects...</span>
                  </div>
                ) : (
                  <>
                    {availableSubjects.map(subj => (
                      <div 
                        key={subj} 
                        className="bg-gray-800 border border-gray-700 hover:border-gold-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-1 min-h-[140px] relative group"
                        onClick={() => { setSelectedSubject(subj); setStep(3); }}
                      >
                        {isAdmin && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingSubjectOriginalName(subj); setNewSubjectName(subj); setEditSubjectModal(true); }}
                              className="p-1.5 bg-gray-900/80 text-blue-400 rounded hover:bg-blue-900/40 transition-colors"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteSubject(subj); }}
                              className="p-1.5 bg-red-900/80 text-red-400 rounded hover:bg-red-900/40 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        <span className="font-bold text-white text-lg text-center leading-tight">{subj}</span>
                      </div>
                    ))}
                    {isAdmin && (
                      <div 
                        onClick={() => setAddSubjectModal(true)}
                        className="bg-gray-900/50 border-2 border-dashed border-gray-700 hover:border-gold-500 hover:bg-gray-800 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[140px] group"
                      >
                        <Plus size={32} className="text-gray-500 group-hover:text-gold-500 mb-2" />
                        <span className="text-xs font-bold text-gray-500 group-hover:text-gold-500 uppercase">Add New</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fadeIn space-y-6">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{selectedSubject} Chapters</h2>
                 {isAdmin && (
                   <Button onClick={() => setAddChapterModal(true)} className="!w-auto text-xs py-2 px-4">
                     <Plus size={16} className="mr-2" /> Add Chapter
                   </Button>
                 )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isActionLoading && availableChapters.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center">
                     <RefreshCw className="animate-spin mb-2" />
                     <span>Loading Chapters...</span>
                  </div>
                ) : (
                  <>
                    {availableChapters.map(chapter => (
                      <div 
                        key={chapter.id} 
                        onClick={() => { setSelectedChapter(chapter); setStep(4); }} 
                        className={`p-5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all relative group ${chapter.subtopics.length > 0 ? 'bg-gold-500 text-black border-gold-500' : 'bg-gray-800 border-gray-700 hover:border-gold-500'}`}
                      >
                          <div>
                            <h3 className={`font-bold text-lg ${chapter.subtopics.length > 0 ? 'text-black' : 'text-white'} ${isUrduPaper ? 'font-urdu' : ''}`}>{chapter.name}</h3>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${chapter.subtopics.length > 0 ? 'bg-black text-gold-500' : 'text-gray-500 bg-gray-900'}`}>
                              {chapter.subtopics.length > 0 ? 'Content Uploaded' : 'Empty'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {isAdmin && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setEditingChapter(chapter); 
                                    setNewChapterName(chapter.name); 
                                    setEditChapterModal(true); 
                                  }} 
                                  className={`p-2 rounded transition-all ${chapter.subtopics.length > 0 ? 'bg-black/20 text-black hover:bg-black/40' : 'bg-gray-900/80 text-blue-400 hover:bg-blue-900/40'}`}
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleDeleteChapterAction(chapter.id, chapter.name); 
                                  }} 
                                  className={`p-2 rounded transition-all ${chapter.subtopics.length > 0 ? 'bg-black/20 text-black hover:bg-black/40' : 'bg-gray-900/80 text-red-400 hover:bg-red-900/40'}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                            <div className={chapter.subtopics.length > 0 ? 'text-black' : 'text-gold-500'}>
                              {chapter.subtopics.length > 0 ? <CheckCircle size={28} /> : <ChevronRight size={28} />}
                            </div>
                          </div>
                      </div>
                    ))}
                    {isAdmin && (
                      <div 
                        onClick={() => setAddChapterModal(true)}
                        className="p-5 bg-gray-900/50 border-2 border-dashed border-gray-700 hover:border-gold-500 hover:bg-gray-800 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group"
                      >
                        <Plus size={24} className="text-gray-500 group-hover:text-gold-500 mb-1" />
                        <span className="text-xs font-bold text-gray-500 group-hover:text-gold-500 uppercase">Add New Chapter</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fadeIn max-w-5xl mx-auto space-y-6">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="text-center mb-6">
                      <div className="bg-gold-500/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border border-gold-500/30">
                        <UploadCloud className="text-gold-500" size={24} />
                      </div>
                      <h2 className="text-xl font-bold text-white uppercase tracking-widest">Verify & Upload</h2>
                      <p className="text-gray-400 text-xs mt-1">{selectedSubject} / {selectedChapter?.name}</p>
                    </div>

                    {uploadSuccess ? (
                      <div className="bg-green-900/20 border border-green-500 rounded-xl p-10 text-center animate-scaleIn">
                        <CheckCircle className="text-green-500 mx-auto mb-4" size={56} />
                        <h3 className="text-2xl font-bold text-green-400">Upload Successful!</h3>
                        <p className="text-white mt-2 font-medium">{parsedCount} Questions saved to database.</p>
                        <div className="mt-8 flex gap-4 justify-center">
                          <Button onClick={resetUploadState} className="!w-auto px-8">Upload More</Button>
                          <Button onClick={() => setStep(3)} variant="secondary" className="!w-auto px-8">Back to Chapters</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {!file ? (
                          <div className="space-y-6">
                            <div className="flex justify-center">
                              <button 
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-2 text-gold-500 hover:text-gold-400 text-sm font-bold uppercase tracking-widest border border-gold-500/30 px-6 py-3 rounded-xl bg-gold-500/5 hover:bg-gold-500/10 transition-all shadow-lg group"
                              >
                                <FileDown size={20} className="group-hover:translate-y-1 transition-transform" />
                                Download CSV Template
                              </button>
                            </div>
                            
                            <div className="border-2 border-dashed border-gray-600 rounded-2xl p-12 text-center hover:border-gold-500 bg-gray-900/50 cursor-pointer transition-all group relative">
                              <label className="cursor-pointer flex flex-col items-center">
                                <FileSpreadsheet className="text-gray-600 group-hover:text-gold-500 mb-4 transition-colors" size={64} />
                                <span className="text-gold-500 font-extrabold text-xl uppercase tracking-tighter">Select CSV File</span>
                                <input type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6 animate-fadeIn">
                             <div className="flex items-center justify-between bg-gray-900/80 p-4 rounded-xl border border-gray-700">
                               <div className="flex items-center gap-3">
                                 <div className="bg-gold-500 p-2 rounded-lg text-black"><FileSpreadsheet size={20} /></div>
                                 <div className="text-left">
                                   <p className="text-white font-bold text-sm truncate max-w-[200px]">{file.name}</p>
                                   <p className="text-[10px] text-gray-500">Total Found: <span className="text-gold-500 font-bold">{parsedQuestions.length} Questions</span></p>
                                 </div>
                               </div>
                               <button onClick={() => { setFile(null); setParsedQuestions([]); }} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"><X size={20} /></button>
                             </div>

                             <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden flex flex-col shadow-inner">
                                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
                                  <Database size={16} className="text-gold-500" />
                                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Question Bank Preview</span>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-gray-800 p-2">
                                   {parsedQuestions.map((q, idx) => (
                                     <div key={idx} className="p-4 hover:bg-gray-800/30 transition-colors flex flex-col gap-2 tex2jax_process">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold bg-gray-800 text-gold-500 px-1.5 py-0.5 rounded border border-gray-700">Q.{idx+1}</span>
                                          <span className="text-[9px] font-bold bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded uppercase">{q.type}</span>
                                          <span className={`text-[9px] text-gray-500 ml-auto italic ${isUrduPaper ? 'font-urdu' : ''}`}>{q.subtopic}</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <p className="text-[12px] text-white leading-relaxed">{q.text}</p>
                                          {q.textUrdu && <p className="text-[12px] text-right text-gray-100 leading-relaxed font-urdu" dir="rtl">{q.textUrdu}</p>}
                                        </div>
                                        
                                        {/* 🔹 MCQ OPTIONS PREVIEW FOR UPLOAD */}
                                        {q.type === 'MCQ' && (
                                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-800 pt-3">
                                            {q.options && (
                                              <div className="space-y-1">
                                                {q.options.map((opt, oIdx) => (
                                                  <div key={oIdx} className={`text-[12px] text-gray-400 flex items-center gap-1.5 ${q.correctAnswer === String.fromCharCode(65 + oIdx) ? 'bg-gold-500/10 text-gold-500' : ''}`}>
                                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center border text-[10px] ${q.correctAnswer === String.fromCharCode(65+oIdx) ? 'bg-gold-500 border-gold-500 text-black font-black' : 'border-gray-700 text-gray-500'}`}>{String.fromCharCode(65+oIdx)}</span>
                                                    <span className="truncate">{opt}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {q.optionsUrdu && (
                                              <div className="space-y-0.5" dir="rtl">
                                                {q.optionsUrdu.map((opt, oIdx) => (
                                                  <div key={oIdx} className={`text-[12px] text-gray-100 opacity-80 font-urdu flex items-center gap-1.5 ${q.correctAnswer === String.fromCharCode(65 + oIdx) ? 'text-gold-500 opacity-100 font-bold' : ''}`}>
                                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center border text-[10px] ${q.correctAnswer === String.fromCharCode(65+oIdx) ? 'bg-gold-500 border-gold-500 text-black font-black' : 'border-gray-700 text-gray-500'}`}>{String.fromCharCode(65+oIdx)}</span>
                                                    <span>{opt}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                     </div>
                                   ))}
                                </div>
                             </div>

                             <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-700">
                               <Button onClick={handleConfirmUpload} isLoading={isUploading || isConvertingMath} disabled={parsedQuestions.length === 0} className="flex-grow py-4 text-lg shadow-xl">
                                 {isConvertingMath ? "Optimizing Math Notation..." : `Confirm & Save ${parsedQuestions.length} Questions`}
                                </Button>
                                <Button variant="secondary" onClick={() => { setFile(null); setParsedQuestions([]); }} className="!w-auto px-8">Cancel</Button>
                             </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
            </div>
          )}
      </main>
    </div>
  );
};
