import { Chapter, QuestionType, PaperPattern, Question } from './types';

// Vibrant Colors for Cards (Classes & Subjects)
export const CARD_COLORS = [
  { from: 'from-blue-500/20', to: 'to-indigo-500/20', border: 'border-blue-500/30', hoverBorder: 'hover:border-blue-500', icon: 'text-blue-500', groupHoverIcon: 'group-hover:text-blue-400', shadow: 'hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)]' },
  { from: 'from-emerald-500/20', to: 'to-teal-500/20', border: 'border-emerald-500/30', hoverBorder: 'hover:border-emerald-500', icon: 'text-emerald-500', groupHoverIcon: 'group-hover:text-emerald-400', shadow: 'hover:shadow-[0_8px_30px_rgba(16,185,129,0.2)]' },
  { from: 'from-purple-500/20', to: 'to-fuchsia-500/20', border: 'border-purple-500/30', hoverBorder: 'hover:border-purple-500', icon: 'text-purple-500', groupHoverIcon: 'group-hover:text-purple-400', shadow: 'hover:shadow-[0_8px_30px_rgba(168,85,247,0.2)]' },
  { from: 'from-orange-500/20', to: 'to-red-500/20', border: 'border-orange-500/30', hoverBorder: 'hover:border-orange-500', icon: 'text-orange-500', groupHoverIcon: 'group-hover:text-orange-400', shadow: 'hover:shadow-[0_8px_30px_rgba(249,115,22,0.2)]' },
  { from: 'from-cyan-500/20', to: 'to-blue-500/20', border: 'border-cyan-500/30', hoverBorder: 'hover:border-cyan-500', icon: 'text-cyan-500', groupHoverIcon: 'group-hover:text-cyan-400', shadow: 'hover:shadow-[0_8px_30px_rgba(6,182,212,0.2)]' },
  { from: 'from-pink-500/20', to: 'to-rose-500/20', border: 'border-pink-500/30', hoverBorder: 'hover:border-pink-500', icon: 'text-pink-500', groupHoverIcon: 'group-hover:text-pink-400', shadow: 'hover:shadow-[0_8px_30px_rgba(236,72,153,0.2)]' },
  { from: 'from-yellow-500/20', to: 'to-orange-500/20', border: 'border-yellow-500/30', hoverBorder: 'hover:border-yellow-500', icon: 'text-yellow-500', groupHoverIcon: 'group-hover:text-yellow-400', shadow: 'hover:shadow-[0_8px_30px_rgba(234,179,8,0.2)]' },
  { from: 'from-green-500/20', to: 'to-emerald-500/20', border: 'border-green-500/30', hoverBorder: 'hover:border-green-500', icon: 'text-green-500', groupHoverIcon: 'group-hover:text-green-400', shadow: 'hover:shadow-[0_8px_30px_rgba(34,197,94,0.2)]' }
];

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
  "12th Class",
  "8th Class",
  "7th Class",
  "6th Class",
  "5th Class",
  "4th Class",
  "3rd Class"
];

export const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "9th Class": [],
  "10th Class": [],
  "11th Class": [],
  "12th Class": [],
  "8th Class": [],
  "7th Class": [],
  "6th Class": [],
  "5th Class": [],
  "4th Class": [],
  "3rd Class": []
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
  // Returning empty array as user requested no default subjects/content
  return [];
};

// --- Mock Question Generator ---
export const generateMockQuestions = (subject: string, chapters: Chapter[], selectedChapterIds: string[]): Question[] => {
  // STRICT MODE: Returning empty array as user requested no dummy data for paper generation
  // This function is kept only if we need it for demos, but for the actual app logic we are bypassing it.
  return [];
};

export const checkIsAdmin = (user?: { email?: string; id?: string; role?: string } | null): boolean => {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  const id = (user.id || '').trim();
  const role = (user.role || '').trim().toLowerCase();
  return (
    email === 'admin' ||
    email === 'admin@aplusexamgen.com' ||
    email === 'maserp89@gmail.com' ||
    id === 'local-admin' ||
    id === '9OpmJqoSigTY3kpnSSpg927cKKa2' ||
    role === 'admin'
  );
};