import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Question } from '../../types';
import { PageHeader, Card, Button, Spinner, Badge } from '../../components/ui';
import { QuestionView } from '../../components/QuestionView';

export default function ImportPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ questions: Question[]; warnImages?: string } | null>(null);

  const sendFile = (file: File) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setError('Apenas arquivos PDF são aceitos.');
      return;
    }
    setError('');
    setFileName(file.name);
    setProcessing(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    api
      .post('/import/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => {
        setResult({ questions: res.data.questions ?? [], warnImages: res.data.warnImages });
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setProcessing(false));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) sendFile(file);
  };

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendFile(file);
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Importar PDF"
        subtitle="A IA extrai as questões, preserva os elementos visuais e sugere a classificação. Você revisa e aprova."
      />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

      {!processing && !result && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-14 text-center transition ${
            dragging
              ? 'border-primary-400 bg-primary-500/10'
              : 'border-[color:var(--border)] bg-[color:var(--bg-card)] hover:border-primary-500/40'
          }`}
        >
          <div className="mx-auto mb-4 p-4 rounded-2xl bg-primary-500/10 border border-primary-500/20 w-fit">
            <FileUp size={40} className="text-primary-400" />
          </div>
          <p className="font-bold text-slate-100 mb-1">Arraste o PDF de questões aqui</p>
          <p className="text-sm text-slate-400 mb-4">ou clique para escolher o arquivo (máx. 15 MB)</p>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onSelect} />
        </div>
      )}

      {processing && (
        <Card className="text-center py-12">
          <Spinner label={`Extraindo questões de "${fileName}"...`} />
          <p className="text-xs text-slate-500 mt-2">Separando questões, lendo gabarito e classificando com IA.</p>
        </Card>
      )}

      {result && (
        <div className="animate-fade-in">
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 flex items-start gap-4">
            <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-emerald-300">{result.questions.length} questão(is) extraída(s) de "{fileName}"</p>
              <p className="text-sm text-slate-300 mt-1">As questões válidas foram para a fila de revisão.</p>
            </div>
          </div>

          {result.warnImages && (
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 flex items-start gap-4">
              <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-300">{result.warnImages}</p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {result.questions.map((q) => (
              <Card key={q.id} className="!p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {q.number && <Badge tone="neutral">Questão {q.number}</Badge>}
                    {q.gabarito && <Badge tone="teal">Gabarito: {q.gabarito.toUpperCase()}</Badge>}
                    {q.classificationSource === 'ai' && <Badge tone="blue">IA</Badge>}
                  </div>
                  <Link to={`/professor/questoes/${q.id}/revisar`} className="text-sm font-semibold text-primary-300 hover:text-primary-200">
                    Revisar →
                  </Link>
                </div>
                <QuestionView question={q} compact />
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => { setResult(null); setFileName(''); }} variant="outline">
              <FileText size={16} /> Importar outro PDF
            </Button>
            <Link to="/professor/questoes" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20">
              Ir para a fila de revisão →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}