export type NegativeFraction = 'HALF' | 'THIRD' | 'FOURTH';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED';

export type QuestionOption = { en: string; hi: string };

export type StaffTestRow = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  branchId: string;
  branchName: string;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  negativeEnabled: boolean;
  negativeFraction: NegativeFraction | null;
  attemptCount: number;
};

export type TestQuestionPreview = {
  subjectName: string;
  questionEn: string;
  questionHi: string;
  correctIndex: number | string;
  answerDescription: string;
  opt1en: string;
  opt1hi: string;
  opt2en: string;
  opt2hi: string;
  opt3en: string;
  opt3hi: string;
  opt4en: string;
  opt4hi: string;
  opt5en: string;
  opt5hi: string;
  opt6en: string;
  opt6hi: string;
};

export type AvailableTest = {
  id: string;
  name: string;
  courseName: string;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  negativeEnabled: boolean;
  negativeFraction: NegativeFraction | null;
  subjects: string[];
  attemptStatus: AttemptStatus | null;
  marksObtained: number | null;
};

export type ExamQuestion = {
  id: string;
  sortOrder: number;
  subjectName: string;
  questionEn: string;
  questionHi: string;
  options: QuestionOption[];
  correctIndex?: number;
  selectedIndex?: number | null;
  answerDescription?: string;
  secondsSpent?: number;
};

export type LocalAnswer = {
  selectedIndex: number | null;
  markedForReview: boolean;
  visited: boolean;
  secondsSpent: number;
};

export type ExamStart = {
  attemptId: string;
  testId: string;
  name: string;
  courseName: string;
  durationMinutes: number;
  remainingSeconds: number;
  totalMarks: number;
  questionCount: number;
  negativeEnabled: boolean;
  negativeFraction: NegativeFraction | null;
  warningCount: number;
  startedAt: string;
  questions: ExamQuestion[];
};

export type TestResult = {
  testId: string;
  name: string;
  courseName: string;
  status: AttemptStatus;
  marksObtained: number;
  totalMarks: number;
  rank: number;
  totalAttempts: number;
  timeSpentSeconds: number;
  subjects: Array<{ subjectName: string; total: number; attempted: number; wrong: number; marks: number }>;
  top10: Array<{ studentName: string; marksObtained: number; timeSpentSeconds: number; rank: number }>;
};

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function negativeLabel(frac: NegativeFraction | null | undefined): string {
  if (frac === 'HALF') return '1/2';
  if (frac === 'THIRD') return '1/3';
  if (frac === 'FOURTH') return '1/4';
  return '';
}

export function previewToQuestion(row: TestQuestionPreview) {
  const options = [
    { en: row.opt1en, hi: row.opt1hi },
    { en: row.opt2en, hi: row.opt2hi },
    { en: row.opt3en, hi: row.opt3hi },
    { en: row.opt4en, hi: row.opt4hi },
    { en: row.opt5en, hi: row.opt5hi },
    { en: row.opt6en, hi: row.opt6hi }
  ].filter((o) => o.en.trim() || o.hi.trim());
  return {
    subjectName: row.subjectName.trim() || 'General',
    questionEn: row.questionEn.trim(),
    questionHi: row.questionHi.trim(),
    correctIndex: Number(row.correctIndex) || 1,
    answerDescription: row.answerDescription.trim(),
    options
  };
}

export function emptyPreviewRow(): TestQuestionPreview {
  return {
    subjectName: '',
    questionEn: '',
    questionHi: '',
    correctIndex: 1,
    answerDescription: '',
    opt1en: '',
    opt1hi: '',
    opt2en: '',
    opt2hi: '',
    opt3en: '',
    opt3hi: '',
    opt4en: '',
    opt4hi: '',
    opt5en: '',
    opt5hi: '',
    opt6en: '',
    opt6hi: ''
  };
}
