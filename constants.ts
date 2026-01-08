import { Chapter, QuestionType, PaperPattern, Question } from './types';

export const APP_NAME = "APLUS ExamGen";
export const APP_TAGLINE = "Smart Paper Generation for Smart Teachers";
export const COPYRIGHT_TEXT = "© 2026 APLUS ExamGen";

export const LOCAL_STORAGE_USERS_KEY = 'aplus_users_v1';
export const LOCAL_STORAGE_SESSION_KEY = 'aplus_current_session_v1';

export const INSTITUTE_TYPES = [
  "Government School",
  "Private School",
  "Academy / Tuition Center",
  "College / Higher Secondary"
];

export const PUNJAB_CITIES = [
  "Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", 
  "Sialkot", "Sargodha", "Bahawalpur", "Gujrat", "Sheikhupura", 
  "Jhang", "Rahim Yar Khan", "Kasur", "Sahiwal", "Okara", 
  "Wah Cantonment", "Dera Ghazi Khan", "Mirpur Khas", "Chiniot", 
  "Kamoke", "Mandi Bahauddin", "Toba Tek Singh", "Muzaffargarh", 
  "Hafizabad", "Khanewal", "Vehari", "Khushab", "Pakpattan", "Mianwali"
];

// --- Generate Paper Mock Data ---

export const CLASSES = [
  "9th Class",
  "10th Class",
  "11th Class",
  "12th Class"
];

export const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "9th Class": ["Physics", "Chemistry", "Biology", "Mathematics", "English", "Urdu", "Islamiyat", "Pak Studies", "Computer Science"],
  "10th Class": ["Physics", "Chemistry", "Biology", "Mathematics", "English", "Urdu", "Islamiyat", "Pak Studies", "Computer Science"],
  "11th Class": ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "English", "Urdu", "Islamiyat Elective"],
  "12th Class": ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "English", "Urdu", "Pak Studies"]
};

// Mock Paper Patterns
export const PAPER_PATTERNS: PaperPattern[] = [
  {
    id: "p1",
    name: "Pattern Type 1 (MCQs Only)",
    description: "Objective type paper ideal for quick assessments.",
    totalMarks: 20,
    sections: [
      { id: "s1", type: 'MCQ', title: "Q.1 Multiple Choice Questions", questionCount: 20, attemptCount: 20, marksPerQuestion: 1 }
    ]
  },
  {
    id: "p2",
    name: "Pattern Type 2 (Short Questions)",
    description: "Focus on conceptual short questions.",
    totalMarks: 20,
    sections: [
      { id: "s1", type: 'SHORT', title: "Q.1 Short Questions", questionCount: 10, attemptCount: 10, marksPerQuestion: 2 }
    ]
  },
  {
    id: "p3",
    name: "Pattern Type 3 (Standard Board)",
    description: "Balanced mix of MCQs, Short and Long questions.",
    totalMarks: 60,
    sections: [
      { id: "s1", type: 'MCQ', title: "Q.1 Multiple Choice Questions", questionCount: 12, attemptCount: 12, marksPerQuestion: 1 },
      { id: "s2", type: 'SHORT', title: "Q.2 Short Questions", questionCount: 15, attemptCount: 15, marksPerQuestion: 2 },
      { id: "s3", type: 'LONG', title: "Q.3 Long Questions", questionCount: 3, attemptCount: 2, marksPerQuestion: 9 }
    ]
  },
  {
    id: "p4",
    name: "Pattern Type 4 (Advanced/Numerical)",
    description: "Includes Numericals or Essays depending on subject.",
    totalMarks: 75,
    sections: [
      { id: "s1", type: 'MCQ', title: "Q.1 Multiple Choice Questions", questionCount: 15, attemptCount: 15, marksPerQuestion: 1 },
      { id: "s2", type: 'SHORT', title: "Q.2 Short Questions", questionCount: 12, attemptCount: 12, marksPerQuestion: 2 },
      { id: "s3", type: 'LONG', title: "Q.3 Theory Questions", questionCount: 3, attemptCount: 2, marksPerQuestion: 8 },
      { id: "s4", type: 'NUMERICAL', title: "Q.4 Numericals / Applied", questionCount: 2, attemptCount: 1, marksPerQuestion: 10 } // Might fail validation for some subjects
    ]
  },
  {
    id: "p5",
    name: "Pattern Type 5 (Language Special)",
    description: "Designed for English/Urdu with Essays and Translation.",
    totalMarks: 75,
    sections: [
      { id: "s1", type: 'MCQ', title: "Q.1 MCQs", questionCount: 15, attemptCount: 15, marksPerQuestion: 1 },
      { id: "s2", type: 'SHORT', title: "Q.2 Short Answers", questionCount: 10, attemptCount: 10, marksPerQuestion: 2 },
      { id: "s3", type: 'ESSAY', title: "Q.3 Essay Writing", questionCount: 3, attemptCount: 1, marksPerQuestion: 15 },
      { id: "s4", type: 'TRANSLATION', title: "Q.4 Translation", questionCount: 1, attemptCount: 1, marksPerQuestion: 10 }
    ]
  }
];

// Helper to generate mock chapters and subtopics
export const getChaptersForSubject = (subject: string, classLevel: string): Chapter[] => {
  // Define Question Types available per subject type
  let subjectTypes: QuestionType[] = ['MCQ', 'SHORT', 'LONG'];
  
  if (subject === "Mathematics" || subject === "Physics") {
    subjectTypes.push('NUMERICAL');
  }
  
  if (subject === "English" || subject === "Urdu") {
    subjectTypes = ['MCQ', 'SHORT', 'ESSAY', 'TRANSLATION'];
  }

  // Generate Unique Prefix to avoid ID collision between subjects
  // e.g. "9th Class" "Physics" -> "9th-phys"
  const cleanClass = classLevel.toLowerCase().replace(/\s+/g, '-');
  const cleanSubject = subject.toLowerCase().replace(/\s+/g, '-').substring(0, 4);
  const idPrefix = `${cleanClass}-${cleanSubject}`;

  // Specific Mock Data for Chemistry 9th
  if (subject === "Chemistry" && classLevel === "9th Class") {
    return [
      {
        id: `${idPrefix}-c1`, name: "Fundamentals of Chemistry",
        availableQuestionTypes: ['MCQ', 'SHORT', 'LONG', 'NUMERICAL'], 
        subtopics: [
          { id: `${idPrefix}-c1-s1`, name: "Branches of Chemistry" },
          { id: `${idPrefix}-c1-s2`, name: "Basic Definitions" },
          { id: `${idPrefix}-c1-s3`, name: "Atomic Number and Mass Number" },
          { id: `${idPrefix}-c1-s4`, name: "Relative Atomic Mass" },
          { id: `${idPrefix}-c1-s5`, name: "Empirical and Molecular Formula" },
          { id: `${idPrefix}-c1-s6`, name: "Avogadro's Number" }
        ]
      },
      {
        id: `${idPrefix}-c2`, name: "Structure of Atoms",
        availableQuestionTypes: ['MCQ', 'SHORT', 'LONG'],
        subtopics: [
          { id: `${idPrefix}-c2-s1`, name: "Rutherford's Atomic Model" },
          { id: `${idPrefix}-c2-s2`, name: "Bohr's Atomic Model" },
          { id: `${idPrefix}-c2-s3`, name: "Electronic Configuration" },
          { id: `${idPrefix}-c2-s4`, name: "Isotopes and their Uses" }
        ]
      },
      {
        id: `${idPrefix}-c3`, name: "Periodic Table & Periodicity",
        availableQuestionTypes: ['MCQ', 'SHORT', 'LONG'],
        subtopics: [
          { id: `${idPrefix}-c3-s1`, name: "History of Periodic Table" },
          { id: `${idPrefix}-c3-s2`, name: "Modern Periodic Table" },
          { id: `${idPrefix}-c3-s3`, name: "Periodicity of Properties" },
          { id: `${idPrefix}-c3-s4`, name: "Electron Affinity" }
        ]
      },
      {
        id: `${idPrefix}-c4`, name: "Structure of Molecules",
        availableQuestionTypes: ['MCQ', 'SHORT', 'LONG'],
        subtopics: [
          { id: `${idPrefix}-c4-s1`, name: "Why do atoms form chemical bonds?" },
          { id: `${idPrefix}-c4-s2`, name: "Types of Bonds" },
          { id: `${idPrefix}-c4-s3`, name: "Intermolecular Forces" },
          { id: `${idPrefix}-c4-s4`, name: "Nature of Bonding" }
        ]
      }
    ];
  }

  // Generic data for other subjects with UNIQUE IDs
  return Array.from({ length: 8 }, (_, i) => ({
    id: `${idPrefix}-ch${i+1}`,
    name: `Chapter ${i+1}: ${subject} Concepts`,
    availableQuestionTypes: subjectTypes,
    subtopics: [
      { id: `${idPrefix}-ch${i+1}-s1`, name: `Introduction to Chapter ${i+1}` },
      { id: `${idPrefix}-ch${i+1}-s2`, name: `Core Concepts` },
      { id: `${idPrefix}-ch${i+1}-s3`, name: `Advanced Analysis` },
      { id: `${idPrefix}-ch${i+1}-s4`, name: `Practical Applications` }
    ]
  }));
};

// --- Mock Question Generator ---
export const generateMockQuestions = (subject: string, chapters: Chapter[], selectedChapterIds: string[]): Question[] => {
  // STRICT MODE: Returning empty array as user requested no dummy data for paper generation
  // This function is kept only if we need it for demos, but for the actual app logic we are bypassing it.
  return [];
};