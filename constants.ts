import { Chapter, QuestionType, PaperPattern, Question } from './types';

// Vibrant High-Contrast Colors for Cards (Classes & Subjects on Light/Warm-Bronze Theme)
export const CARD_COLORS = [
  { from: 'from-[#C29B61]/10', to: 'to-[#B0894F]/15', border: 'border-[#E6D5B8]', hoverBorder: 'hover:border-[#C29B61]', icon: 'text-[#B0894F]', groupHoverIcon: 'group-hover:text-[#94703C]', shadow: 'hover:shadow-[0_8px_25px_rgba(194,155,97,0.18)]' },
  { from: 'from-slate-500/10', to: 'to-slate-600/15', border: 'border-slate-300', hoverBorder: 'hover:border-slate-600', icon: 'text-slate-700', groupHoverIcon: 'group-hover:text-slate-900', shadow: 'hover:shadow-[0_8px_25px_rgba(71,85,105,0.15)]' },
  { from: 'from-amber-500/10', to: 'to-orange-500/15', border: 'border-amber-300', hoverBorder: 'hover:border-[#B0894F]', icon: 'text-[#B0894F]', groupHoverIcon: 'group-hover:text-[#785A31]', shadow: 'hover:shadow-[0_8px_25px_rgba(194,155,97,0.18)]' },
  { from: 'from-emerald-500/10', to: 'to-teal-500/15', border: 'border-emerald-300', hoverBorder: 'hover:border-emerald-600', icon: 'text-emerald-700', groupHoverIcon: 'group-hover:text-emerald-800', shadow: 'hover:shadow-[0_8px_25px_rgba(16,185,129,0.15)]' },
  { from: 'from-blue-500/10', to: 'to-indigo-500/15', border: 'border-blue-300', hoverBorder: 'hover:border-blue-600', icon: 'text-blue-700', groupHoverIcon: 'group-hover:text-blue-800', shadow: 'hover:shadow-[0_8px_25px_rgba(59,130,246,0.15)]' },
  { from: 'from-purple-500/10', to: 'to-fuchsia-500/15', border: 'border-purple-300', hoverBorder: 'hover:border-purple-600', icon: 'text-purple-700', groupHoverIcon: 'group-hover:text-purple-800', shadow: 'hover:shadow-[0_8px_25px_rgba(168,85,247,0.15)]' },
  { from: 'from-cyan-500/10', to: 'to-sky-500/15', border: 'border-cyan-300', hoverBorder: 'hover:border-cyan-600', icon: 'text-cyan-700', groupHoverIcon: 'group-hover:text-cyan-800', shadow: 'hover:shadow-[0_8px_25px_rgba(6,182,212,0.15)]' },
  { from: 'from-rose-500/10', to: 'to-pink-500/15', border: 'border-rose-300', hoverBorder: 'hover:border-rose-600', icon: 'text-rose-700', groupHoverIcon: 'group-hover:text-rose-800', shadow: 'hover:shadow-[0_8px_25px_rgba(244,63,94,0.15)]' }
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