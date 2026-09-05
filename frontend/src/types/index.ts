export type Role = 'admin' | 'professor' | 'aluno';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleDisplay?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  organizationId: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Turma {
  id: string;
  name: string;
  organizationId: string;
  professorId: string;
  archived?: boolean;
  createdAt: string;
}

export interface TurmaMember {
  id: string;
  turmaId: string;
  userId: string;
  status: 'ativo' | 'pendente';
  users?: { id: string; name: string; email: string; role?: string };
  createdAt?: string;
}

export interface TurmaDetail extends Turma {
  members?: TurmaMember[];
  exams?: Array<{ id: string; title: string; status: string; createdAt: string }>;
  membershipStatus?: string;
}

export interface CatalogItem {
  id: string;
  organizationId: string;
  level: number;
  name: string;
  parentId: string | null;
  topics?: CatalogItem[];
  subtopics?: CatalogItem[];
}

export interface Alternative {
  letter: string;
  text: string;
}

export interface QuestionImage {
  id?: string;
  caption?: string;
  type?: string;
}

export interface Question {
  id: string;
  organizationId: string;
  importJobId?: string | null;
  createdBy: string;
  number?: number | null;
  statement: string;
  alternatives: Alternative[];
  images?: QuestionImage[];
  gabarito?: string | null;
  gabaritoOrigin?: 'document' | 'ai' | 'professor' | null;
  gabaritoConfidence?: number | null;
  catalogItemId?: string | null;
  classificationSource?: 'ai' | 'professor' | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  catalog_items?: { id: string; name: string; level: number } | null;
  createdAt: string;
}

export interface ImportJob {
  id: string;
  organizationId: string;
  userId: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string | null;
  totalQuestions?: number | null;
  createdAt: string;
  questions?: Question[];
}

export interface ImportResult {
  job: ImportJob;
  questions: Question[];
  warnImages?: string;
}

export interface Exam {
  id: string;
  title: string;
  turmaId: string;
  organizationId: string;
  createdBy: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string | null;
  createdAt: string;
  turmas?: { id: string; name: string } | null;
  questions?: ExamQuestion[];
  hasAttempt?: boolean;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  order: number;
  questions?: Question & { gabarito?: string | null };
}

export interface Attempt {
  id: string;
  examId: string;
  userId: string;
  status: 'in_progress' | 'submitted';
  startedAt: string;
  submittedAt?: string | null;
}

export interface TakeQuestion {
  id: string;
  number?: number | null;
  statement: string;
  alternatives: Alternative[];
  images?: QuestionImage[];
  selected: string | null;
}

export interface TakeData {
  attempt: Attempt;
  examTitle: string;
  questions: TakeQuestion[];
}

export interface SubmitResult {
  attempt: Attempt;
  correct: number;
  total: number;
  percent: number;
}

export interface MyResult {
  attempt: Attempt;
  correct: number;
  total: number;
  percent: number;
  questions: Array<{
    number?: number | null;
    statement: string;
    gabarito?: string | null;
    selected?: string | null;
    isCorrect?: boolean | null;
  }>;
}

export interface StudentResult {
  studentId: string;
  name: string;
  email: string;
  status: 'nao_iniciou' | 'in_progress' | 'submitted';
  correct: number;
  percent: number;
  submittedAt?: string | null;
  startedAt?: string | null;
}

export interface ByExamResults {
  examId: string;
  total: number;
  students: StudentResult[];
}

export interface QuestionStat {
  questionId: string;
  number?: number | null;
  statement: string;
  answered: number;
  correct: number;
  rate: number;
}

export interface ByQuestionResults {
  examId: string;
  totalAlunos: number;
  totalResponded: number;
  questions: QuestionStat[];
}

export interface Notice {
  id: string;
  turmaId: string;
  createdBy: string;
  message: string;
  createdAt: string;
  turmas?: { id: string; name: string };
  users?: { id: string; name: string };
}

export interface ProfessorDashboard {
  turmas: Array<{ id: string; name: string; archived?: boolean; createdAt: string }>;
  pendingReviews: number;
  recentExams: Array<{ id: string; title: string; status: string; publishedAt?: string | null; createdAt: string; turmas?: { name: string } | { id: string; name: string } }>;
}

export interface AlunoDashboard {
  exams: Exam[];
  notices: Notice[];
  results: Array<{
    attemptId: string;
    examId: string;
    examTitle: string | null;
    turmaName: string | null;
    correct: number;
    total: number;
    percent: number;
    submittedAt?: string | null;
  }>;
}