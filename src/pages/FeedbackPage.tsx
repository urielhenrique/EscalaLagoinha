import { useState } from "react";
import {
  Bug,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  Send,
  Star,
  TrendingUp,
} from "lucide-react";
import { SectionHeader } from "../components/ui/SectionHeader";
import { submitFeedback, type FeedbackType } from "../services/helpCenterApi";
import { getErrorMessage } from "../services/api";

type FeedbackTypeMeta = {
  key: FeedbackType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

const FEEDBACK_TYPES: FeedbackTypeMeta[] = [
  {
    key: "BUG_REPORT",
    label: "Reportar Problema",
    description: "Algo não está funcionando corretamente",
    icon: <Bug className="h-5 w-5" />,
    color:
      "border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  },
  {
    key: "FEATURE_REQUEST",
    label: "Solicitar Funcionalidade",
    description: "Sugira uma nova funcionalidade para o sistema",
    icon: <Lightbulb className="h-5 w-5" />,
    color:
      "border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  },
  {
    key: "IMPROVEMENT",
    label: "Sugestão de Melhoria",
    description: "Algo pode ser melhorado ou simplificado",
    icon: <TrendingUp className="h-5 w-5" />,
    color:
      "border-violet-400/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20",
  },
  {
    key: "GENERAL_FEEDBACK",
    label: "Feedback Geral",
    description: "Compartilhe sua experiência com o sistema",
    icon: <MessageSquare className="h-5 w-5" />,
    color:
      "border-brand-400/40 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20",
  },
];

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
          aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
        >
          <Star
            className={[
              "h-7 w-7 transition-colors",
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-app-600",
            ].join(" ")}
          />
        </button>
      ))}
    </div>
  );
}

export function FeedbackPage() {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [avaliacao, setAvaliacao] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitFeedback({
        id: "",
        tipo: selectedType,
        titulo,
        descricao,
        avaliacao: avaliacao || undefined,
        paginaOrigem: window.location.pathname,
      });
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err, "Erro ao enviar feedback."));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-500/20 ring-2 ring-brand-400/30">
          <CheckCircle2 className="h-10 w-10 text-brand-400" />
        </div>
        <h2 className="mb-3 font-display text-2xl font-bold text-white">
          Feedback Enviado!
        </h2>
        <p className="mb-6 max-w-md text-app-300">
          Obrigado por contribuir para a melhoria do sistema. Sua mensagem foi
          recebida e será analisada pela equipe.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSuccess(false);
              setSelectedType(null);
              setTitulo("");
              setDescricao("");
              setAvaliacao(0);
            }}
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-app-200 transition-colors hover:bg-white/8"
          >
            Enviar outro
          </button>
          <a
            href="/ajuda"
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-400"
          >
            Central de Ajuda
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <SectionHeader
        title="Enviar Feedback"
        subtitle="Ajude-nos a melhorar o sistema com sua experiência"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de feedback */}
        <div>
          <p className="mb-3 text-sm font-medium text-app-200">
            Qual o tipo de feedback?
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEEDBACK_TYPES.map((ft) => (
              <button
                key={ft.key}
                type="button"
                onClick={() => setSelectedType(ft.key)}
                className={[
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150",
                  ft.color,
                  selectedType === ft.key
                    ? "ring-2 ring-brand-400/50 ring-offset-1 ring-offset-app-900"
                    : "",
                ].join(" ")}
              >
                <div className="mt-0.5 shrink-0">{ft.icon}</div>
                <div>
                  <p className="font-semibold text-white">{ft.label}</p>
                  <p className="text-xs text-app-300">{ft.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Avaliação rápida da experiência */}
        <div className="rounded-xl border border-white/10 bg-app-800/50 p-5">
          <p className="mb-3 text-sm font-medium text-app-200">
            Como você avalia sua experiência geral? (opcional)
          </p>
          <StarRating value={avaliacao} onChange={setAvaliacao} />
          {avaliacao > 0 && (
            <p className="mt-2 text-xs text-app-400">
              {
                ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"][
                  avaliacao
                ]
              }
            </p>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-app-200">
            Título <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Resumo breve do seu feedback"
            maxLength={200}
            required
            className="w-full rounded-xl border border-white/15 bg-app-900/60 px-4 py-3 text-white placeholder-app-500 outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-app-200">
            Descrição detalhada <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva com detalhes sua sugestão, problema ou experiência..."
            maxLength={2000}
            required
            rows={5}
            className="w-full resize-none rounded-xl border border-white/15 bg-app-900/60 px-4 py-3 text-white placeholder-app-500 outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
          />
          <p className="mt-1 text-right text-xs text-app-500">
            {descricao.length}/2000
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !selectedType || !titulo || !descricao}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 font-semibold text-white transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? "Enviando..." : "Enviar Feedback"}
        </button>
      </form>
    </div>
  );
}
