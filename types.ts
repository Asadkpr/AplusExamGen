
export interface InstituteProfile {
  instituteName: string;
  instituteType: string;
  address: string;
  city: string;
  contactNumber: string;
  logoUrl?: string; // Base64 string for local storage mock
  showLogoOnPapers: boolean;
  showContactOnPapers: boolean;
  saveAsDefault: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  whatsapp?: string;
  passwordHash: string; // In a real app, never store plain passwords. Simulating hash storage.
  createdAt: number;
  instituteProfile?: InstituteProfile;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface Subtopic {
  id: string;
  name: string;
}

// QuestionType is now a string to support custom "Other" types defined by admins
export type QuestionType = string;

export interface Question {
  id: string;
  type: QuestionType;
  text: string;     // English Text
  textUrdu?: string; // Urdu Text
  // Optional properties for questions that have sub-parts (Part A, Part B)
  textPartA?: string;
  textPartB?: string;
  textPartC?: string;
  textPartAUrdu?: string;
  textPartBUrdu?: string;
  textPartCUrdu?: string;
  chapterId: string;
  subtopic?: string; // ID or Name of the subtopic
  marks: number;
  options?: string[]; // For MCQs (English)
  optionsUrdu?: string[]; // For MCQs (Urdu)
  correctAnswer?: string; // For Answer Key (e.g., 'A', 'Newton', etc.)
  targetSectionId?: string; // Links a selected question to a specific section in a pattern
}

export interface Chapter {
  id: string;
  name: string;
  subtopics: Subtopic[];
  availableQuestionTypes: QuestionType[];
}

export interface PaperPatternSectionPart {
  id: string;
  label: string; // e.g. "(a)", "(b)"
  marks: number;
  type?: QuestionType; // e.g., 'LONG', 'NUMERICAL', 'SHORT'
}

export interface PaperPatternSection {
  id: string;
  type: QuestionType;
  title: string;
  questionCount: number;
  attemptCount: number;
  marksPerQuestion: number;
  subParts?: PaperPatternSectionPart[];
}

export interface PaperPattern {
  id: string;
  name: string;
  description: string;
  totalMarks: number;
  sections: PaperPatternSection[];
  subject?: string; // Optional: Link pattern to specific subject
  classLevel?: string; // Optional: Link pattern to specific class
  timeAllowed?: string; // New: e.g. "2:00 Hours"
}

export interface SavedPaper {
  id: string;
  title: string; // e.g., "9th Class Physics"
  createdAt: number;
  classLevel: string;
  subject: string;
  totalMarks: number;
  sections: PaperPatternSection[];
  questions: Question[]; // Snapshot of selected questions
  instituteProfile?: InstituteProfile; // Snapshot of institute details at time of generation
  userId: string; // ID of the teacher who created it
  createdBy?: string; // Name of the teacher
  // Metadata for state restoration
  selectedChapterIds?: string[];
  selectedSubtopicIds?: string[];
  medium?: 'English' | 'Urdu' | 'Both';
  fontSize?: number;
  timeAllowed?: string; // New: stored from pattern
}

export type ViewState = 
  | 'LOGIN' 
  | 'SIGNUP' 
  | 'INSTITUTE_SETUP' 
  | 'DASHBOARD'
  | 'GENERATE_PAPER'
  | 'SAVED_PAPERS'
  | 'PAPER_PATTERNS'
  | 'PROFILE_SETTINGS'
  | 'HELP_SUPPORT'
  | 'UPLOAD_PAPER'
  | 'MANAGE_CONTENT'
  | 'ABOUT_US';
