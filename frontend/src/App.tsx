import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import ProfessorHome from './pages/professor/Home';
import Classes from './pages/professor/Classes';
import ClassDetail from './pages/professor/ClassDetail';
import Questions from './pages/professor/Questions';
import QuestionReview from './pages/professor/QuestionReview';
import ImportPdf from './pages/professor/ImportPdf';
import Exams from './pages/professor/Exams';
import ExamCreate from './pages/professor/ExamCreate';
import ExamPreview from './pages/professor/ExamPreview';
import Results from './pages/professor/Results';
import Catalogo from './pages/professor/Catalogo';
import AlunoHome from './pages/aluno/Home';
import AlunoTurmas from './pages/aluno/Turmas';
import AlunoExams from './pages/aluno/Exams';
import TakeExam from './pages/aluno/TakeExam';
import ExamResult from './pages/aluno/ExamResult';
import AlunoResults from './pages/aluno/AlunoResults';
import AdminUsuarios from './pages/admin/Usuarios';
import AdminDashboard from './pages/admin/Dashboard';

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Spinner label="Carregando..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function ProfessorOnly({ children }: { children: React.ReactNode }) {
  const { isProfessor, loading } = useAuth();
  if (loading) return <Spinner label="Carregando..." />;
  if (!isProfessor) return <Navigate to="/aluno/inicio" replace />;
  return <>{children}</>;
}

function AlunoOnly({ children }: { children: React.ReactNode }) {
  const { isProfessor, loading } = useAuth();
  if (loading) return <Spinner label="Carregando..." />;
  if (isProfessor) return <Navigate to="/inicio" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Spinner label="Carregando..." />;
  if (!isAdmin) return <Navigate to="/inicio" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { isAuthenticated, loading, isProfessor } = useAuth();
  if (loading) return <Spinner label="Carregando..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={isProfessor ? '/inicio' : '/aluno/inicio'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/inicio" element={<Protected><ProfessorOnly><ProfessorHome /></ProfessorOnly></Protected>} />

          <Route path="/professor/turmas" element={<Protected><ProfessorOnly><Classes /></ProfessorOnly></Protected>} />
          <Route path="/professor/turmas/:id" element={<Protected><ProfessorOnly><ClassDetail /></ProfessorOnly></Protected>} />
          <Route path="/professor/questoes" element={<Protected><ProfessorOnly><Questions /></ProfessorOnly></Protected>} />
          <Route path="/professor/questoes/:id/revisar" element={<Protected><ProfessorOnly><QuestionReview /></ProfessorOnly></Protected>} />
          <Route path="/professor/importar" element={<Protected><ProfessorOnly><ImportPdf /></ProfessorOnly></Protected>} />
          <Route path="/professor/simulados" element={<Protected><ProfessorOnly><Exams /></ProfessorOnly></Protected>} />
          <Route path="/professor/simulados/novo" element={<Protected><ProfessorOnly><ExamCreate /></ProfessorOnly></Protected>} />
          <Route path="/professor/simulados/:id" element={<Protected><ProfessorOnly><ExamPreview /></ProfessorOnly></Protected>} />
          <Route path="/professor/resultados" element={<Protected><ProfessorOnly><Results /></ProfessorOnly></Protected>} />
          <Route path="/professor/catalogo" element={<Protected><ProfessorOnly><Catalogo /></ProfessorOnly></Protected>} />

          <Route path="/admin/dashboard" element={<Protected><AdminOnly><AdminDashboard /></AdminOnly></Protected>} />
          <Route path="/admin/usuarios" element={<Protected><AdminOnly><AdminUsuarios /></AdminOnly></Protected>} />

          <Route path="/aluno/inicio" element={<Protected><AlunoOnly><AlunoHome /></AlunoOnly></Protected>} />
          <Route path="/aluno/simulados" element={<Protected><AlunoOnly><AlunoExams /></AlunoOnly></Protected>} />
          <Route path="/aluno/simulados/:id/responder" element={<Protected><AlunoOnly><TakeExam /></AlunoOnly></Protected>} />
          <Route path="/aluno/simulados/:id/resultado" element={<Protected><AlunoOnly><ExamResult /></AlunoOnly></Protected>} />
          <Route path="/aluno/resultados" element={<Protected><AlunoOnly><AlunoResults /></AlunoOnly></Protected>} />
          <Route path="/aluno/turmas" element={<Protected><AlunoOnly><AlunoTurmas /></AlunoOnly></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;