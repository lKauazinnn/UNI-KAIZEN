import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, AreaChart, Area, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, FileQuestion, ClipboardList, GraduationCap, Send, School } from 'lucide-react';
import { api } from '../../services/api';
import { GeralDashboard } from '../../types';
import { PageHeader, Card, Spinner, EmptyState } from '../../components/ui';

const COLORS: Record<string, string> = {
  Pendentes: '#fbbf24',
  Aprovadas: '#34d399',
  Rejeitadas: '#f87171',
  Rascunho: '#fbbf24',
  Publicados: '#34d399',
  Arquivados: '#94a3b8',
};

const tick: any = { fontSize: 12, fill: '#94a3b8' };

const tooltipStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  fontSize: 12,
  color: '#e2e8f0',
};

export default function AdminDashboard() {
  const [data, setData] = useState<GeralDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/geral').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Carregando painel geral..." />;
  if (!data) return <EmptyState title="Painel indisponível" />;

  // Ranking de alunos (gamificação) está fora do escopo do primeiro MVP:
  // `topAlunos` continua vindo da API, mas não é exibido aqui.
  const { totais, questoesPorStatus, simulados, entregasPorDia, mediaPorSimulado, eficiencia } = data;
  const rotulados = entregasPorDia.map((d) => ({
    ...d,
    dia: d.data ? new Date(d.data.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—',
  }));

  const statCards = [
    { label: 'Turmas', value: totais.turmas, icon: School },
    { label: 'Questões no banco', value: totais.questoes, icon: FileQuestion },
    { label: 'Professores', value: totais.professores, icon: Users },
    { label: 'Alunos', value: totais.alunos, icon: GraduationCap },
    { label: 'Simulados entregues', value: totais.totalEntregas, icon: Send },
  ];

  const areaData = rotulados.length > 0 ? rotulados : [{ dia: '—', entregas: 0 }];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Visão geral do sistema"
        subtitle="Os números da plataforma para a organização, em um só lugar."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
              <s.icon size={16} className="text-primary-400" />
            </div>
            <p className="text-3xl font-bold text-slate-100">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <h2 className="font-bold text-slate-100 mb-4">Questões por status</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questoesPorStatus} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
                <Bar dataKey="value" name="Questões" radius={[8, 8, 0, 0]}>
                  {questoesPorStatus.map((q) => (
                    <Cell key={q.name} fill={COLORS[q.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-100 mb-4">Simulados por status</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={simulados} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3} stroke="none">
                  {simulados.map((s) => (
                    <Cell key={s.name} fill={COLORS[s.name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: '#cbd5e1', fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-100 mb-4">Entregas nos últimos dias</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEntregas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3cb8a5" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3cb8a5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="dia" tick={tick} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="entregas" name="Entregas" stroke="#3cb8a5" strokeWidth={2} fill="url(#gradEntregas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-100">Média de acerto por simulado</h2>
            <span className="text-xs text-slate-500">{mediaPorSimulado.length} simulado(s) com entregas</span>
          </div>
          {mediaPorSimulado.length === 0 ? (
            <EmptyState title="Sem entregas ainda" description="Quando os alunos entregarem simulados, a média aparece aqui." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mediaPorSimulado} layout="vertical" margin={{ top: 0, right: 24, left: 24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="titulo" width={140} tick={{ ...tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.06)' }} formatter={(v: any) => [`${v}%`, 'Média']} />
                  <Bar dataKey="media" name="Média" radius={[0, 8, 8, 0]} barSize={18}>
                    {mediaPorSimulado.map((m) => (
                      <Cell key={m.id} fill={m.media >= 60 ? '#34d399' : m.media >= 40 ? '#fbbf24' : '#f87171'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="!p-4">
        <div className="grid sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-slate-100">{eficiencia.totalAttempts}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tentativas iniciadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400">{eficiencia.totalEntregas}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Simulados entregues</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{eficiencia.totalAlunosVinculados}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Alunos vinculados a turmas</p>
          </div>
        </div>
      </Card>
    </div>
  );
}