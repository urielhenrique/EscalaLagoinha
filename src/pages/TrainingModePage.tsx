import { useState } from "react";
import {
  Award,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Repeat2,
  ScanLine,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { SectionHeader } from "../components/ui/SectionHeader";
import { InlineHint } from "../components/ui/ContextualHelp";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type TrackId = "voluntario" | "lider" | "admin" | "master_admin";

type TrackStep = {
  id: string;
  title: string;
  description: string;
  detail: string;
  href?: string;
  icon: React.ReactNode;
};

type Track = {
  id: TrackId;
  title: string;
  subtitle: string;
  audience: string;
  icon: React.ReactNode;
  color: string;
  steps: TrackStep[];
};

// ─── Trilhas de treinamento ───────────────────────────────────────────────

const TRACKS: Track[] = [
  {
    id: "voluntario",
    title: "Trilha do Voluntário",
    subtitle: "Primeiros passos para servir com excelência",
    audience: "Voluntários recém-chegados",
    icon: <Users className="h-6 w-6" />,
    color: "from-sky-500/20 to-sky-600/10 border-sky-400/30",
    steps: [
      {
        id: "v1",
        title: "Complete seu perfil",
        description: "Adicione foto, telefone e suas informações de contato",
        detail:
          "Um perfil completo ajuda os líderes a te reconhecerem e facilita a comunicação. Atualize nome, telefone e foto na seção Meu Perfil.",
        href: "/meu-perfil",
        icon: <Users className="h-5 w-5 text-sky-300" />,
      },
      {
        id: "v2",
        title: "Configure sua disponibilidade",
        description: "Informe os dias e horários em que você pode servir",
        detail: `Acesse "Minha Disponibilidade" no menu. Marque os dias e períodos em que está disponível para que o sistema possa te incluir nas escalas automaticamente.`,
        href: "/minha-disponibilidade",
        icon: <CalendarCheck2 className="h-5 w-5 text-sky-300" />,
      },
      {
        id: "v3",
        title: "Veja suas escalas",
        description: "Acompanhe quando e onde você foi escalado",
        detail:
          'Em "Minhas Escalas" você verá todos os eventos em que foi confirmado. Você receberá notificações automáticas por e-mail.',
        href: "/minhas-escalas",
        icon: <LayoutDashboard className="h-5 w-5 text-sky-300" />,
      },
      {
        id: "v4",
        title: "Faça check-in no dia do evento",
        description: "Confirme sua presença ao chegar no culto",
        detail: `Acesse "Check-in" no menu e confirme sua presença. Isso ajuda os líderes a rastrear a pontualidade e presença da equipe.`,
        href: "/check-in",
        icon: <ScanLine className="h-5 w-5 text-sky-300" />,
      },
      {
        id: "v5",
        title: "Solicite trocas quando precisar",
        description: "Se não puder servir, solicite troca com outro voluntário",
        detail: `Em "Solicitar Troca", selecione o evento e o voluntário com quem quer trocar. O líder receberá a solicitação e aprovará se possível.`,
        href: "/trocas/solicitar",
        icon: <Repeat2 className="h-5 w-5 text-sky-300" />,
      },
    ],
  },
  {
    id: "lider",
    title: "Trilha do Líder",
    subtitle: "Gerencie sua equipe com eficiência",
    audience: "Líderes de ministério",
    icon: <GraduationCap className="h-6 w-6" />,
    color: "from-violet-500/20 to-violet-600/10 border-violet-400/30",
    steps: [
      {
        id: "l1",
        title: "Aprove os voluntários pendentes",
        description: "Libere o acesso dos novos membros da sua equipe",
        detail: `Em "Aprovação de Voluntários" você verá todos que solicitaram entrar. Revise o perfil e aprove ou recuse o acesso ao sistema.`,
        href: "/aprovacao-voluntarios",
        icon: <UserCheck className="h-5 w-5 text-violet-300" />,
      },
      {
        id: "l2",
        title: "Crie ou gerencie eventos",
        description: "Adicione os cultos e eventos do calendário",
        detail: `Em "Eventos", crie os cultos, ensaios e eventos especiais. Defina data, horário e recorrência para facilitar o planejamento.`,
        href: "/eventos",
        icon: <CalendarCheck2 className="h-5 w-5 text-violet-300" />,
      },
      {
        id: "l3",
        title: "Gere escalas automáticas com IA",
        description: "Use a IA para criar escalas balanceadas automaticamente",
        detail: `Em "IA Insights" você pode gerar escalas inteligentes baseadas na disponibilidade dos voluntários. A IA distribui equitativamente considerando histórico e preferências.`,
        href: "/ia-insights",
        icon: <BookOpen className="h-5 w-5 text-violet-300" />,
      },
      {
        id: "l4",
        title: "Acompanhe a presença",
        description: "Monitore quem compareceu aos eventos",
        detail: `Em "Gestão de Presença" você vê o registro de check-ins. Identifique voluntários com muitas faltas e converse antes que vire um problema.`,
        href: "/presenca",
        icon: <CheckCircle2 className="h-5 w-5 text-violet-300" />,
      },
      {
        id: "l5",
        title: "Analise os relatórios",
        description: "Visualize métricas de presença e engajamento",
        detail:
          "Os relatórios mostram taxas de presença, faltas, trocas e engajamento. Exporte em CSV ou PDF para compartilhar com a liderança.",
        href: "/relatorios",
        icon: <Award className="h-5 w-5 text-violet-300" />,
      },
    ],
  },
  {
    id: "admin",
    title: "Trilha do Administrador",
    subtitle: "Configure e personalize o sistema para sua igreja",
    audience: "Administradores da igreja",
    icon: <Settings className="h-6 w-6" />,
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-400/30",
    steps: [
      {
        id: "a1",
        title: "Configure as informações da igreja",
        description: "Defina nome, endereço e dados principais",
        detail: `Em "Configurações da Igreja" você personaliza todas as informações institucionais, políticas de aprovação e regras de troca.`,
        href: "/igreja/configuracoes",
        icon: <Settings className="h-5 w-5 text-emerald-300" />,
      },
      {
        id: "a2",
        title: "Personalize a identidade visual",
        description: "Defina cores, logo e nome personalizado",
        detail: `Em "Identidade Visual" você pode customizar o sistema com as cores e logo da sua igreja, criando uma experiência personalizada.`,
        href: "/igreja/branding",
        icon: <Award className="h-5 w-5 text-emerald-300" />,
      },
      {
        id: "a3",
        title: "Crie os ministérios",
        description: "Organize sua equipe por áreas de serviço",
        detail:
          "Crie os ministérios da sua igreja (Louvor, Mídia, Recepção etc.) e defina os líderes responsáveis por cada um. A seção de Ministérios fica dentro das Configurações da Igreja.",
        href: "/igreja/configuracoes#ministerios",
        icon: <Users className="h-5 w-5 text-emerald-300" />,
      },
      {
        id: "a4",
        title: "Convide os líderes e voluntários",
        description: "Use links de convite para adicionar a equipe",
        detail:
          "Gere links de convite personalizados para que líderes e voluntários se cadastrem diretamente já vinculados à sua igreja.",
        href: "/igreja/configuracoes#convite-link",
        icon: <UserCheck className="h-5 w-5 text-emerald-300" />,
      },
      {
        id: "a5",
        title: "Monitore via auditoria",
        description: "Acompanhe todas as ações realizadas no sistema",
        detail: `O log de auditoria registra todas as ações importantes: aprovações, exclusões, alterações de escala. Acesse em "Auditoria".`,
        href: "/auditoria",
        icon: <BookOpen className="h-5 w-5 text-emerald-300" />,
      },
    ],
  },
  {
    id: "master_admin",
    title: "Trilha do Master Admin",
    subtitle: "Gerencie múltiplas igrejas e a plataforma",
    audience: "Master Admins e Platform Admins",
    icon: <Award className="h-6 w-6" />,
    color: "from-amber-500/20 to-amber-600/10 border-amber-400/30",
    steps: [
      {
        id: "m1",
        title: "Acesse o Painel Master Admin",
        description: "Visão consolidada de todas as igrejas na plataforma",
        detail:
          "O Painel Master Admin oferece uma visão executiva com métricas de todas as igrejas: usuários ativos, escalas criadas, engajamento.",
        href: "/master-admin",
        icon: <LayoutDashboard className="h-5 w-5 text-amber-300" />,
      },
      {
        id: "m2",
        title: "Gerencie as igrejas cadastradas",
        description: "Adicione, edite e monitore as igrejas da plataforma",
        detail: `Em "Gestão de Igrejas" você pode visualizar, ativar/desativar e gerenciar todas as igrejas cadastradas na plataforma.`,
        href: "/igrejas",
        icon: <Settings className="h-5 w-5 text-amber-300" />,
      },
      {
        id: "m3",
        title: "Use o Dashboard Multi-Unidade",
        description: "Compare métricas entre as unidades",
        detail:
          "O Dashboard Multi-Unidade mostra uma comparação entre as unidades, destacando as mais engajadas e as que precisam de atenção.",
        href: "/multi-unidade",
        icon: <Award className="h-5 w-5 text-amber-300" />,
      },
      {
        id: "m4",
        title: "Configure o branding da plataforma",
        description: "Customize a aparência global do sistema",
        detail:
          "A identidade visual da plataforma pode ser customizada globalmente. As igrejas herdam o padrão, mas podem sobrescrever com suas próprias cores.",
        href: "/igreja/branding",
        icon: <GraduationCap className="h-5 w-5 text-amber-300" />,
      },
    ],
  },
];

// ─── Componente TrackCard ─────────────────────────────────────────────────

function TrackCard({
  track,
  onSelect,
}: {
  track: Track;
  onSelect: (id: TrackId) => void;
}) {
  return (
    <button
      onClick={() => onSelect(track.id)}
      className={[
        "flex flex-col gap-4 rounded-2xl border bg-linear-to-br p-6 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-xl",
        track.color,
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
          {track.icon}
        </div>
        <ChevronRight className="h-5 w-5 text-app-400" />
      </div>
      <div>
        <h3 className="mb-1 font-display text-lg font-bold text-white">
          {track.title}
        </h3>
        <p className="mb-3 text-sm text-app-300">{track.subtitle}</p>
        <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs text-app-400">
          {track.audience}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-app-400">
        <BookOpen className="h-4 w-4" />
        <span>{track.steps.length} passos</span>
      </div>
    </button>
  );
}

// ─── Componente StepDetail ────────────────────────────────────────────────

function StepDetail({
  step,
  index,
  total,
  completed,
  onToggle,
}: {
  step: TrackStep;
  index: number;
  total: number;
  completed: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={[
        "rounded-xl border transition-all",
        completed
          ? "border-brand-400/30 bg-brand-500/8"
          : "border-white/8 bg-app-800/50",
      ].join(" ")}
    >
      <div className="flex items-start gap-4 p-4">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onToggle}
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
              completed
                ? "border-brand-400 bg-brand-500 text-white"
                : "border-app-600 bg-app-800 text-app-400 hover:border-brand-400/60",
            ].join(" ")}
            aria-label={
              completed ? "Marcar como não concluído" : "Marcar como concluído"
            }
          >
            {completed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <span className="text-xs font-bold">{index + 1}</span>
            )}
          </button>
          {index < total - 1 && (
            <div
              className={[
                "h-8 w-0.5",
                completed ? "bg-brand-500/40" : "bg-app-700",
              ].join(" ")}
            />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {step.icon}
              <h4
                className={[
                  "font-semibold",
                  completed
                    ? "text-brand-300 line-through opacity-70"
                    : "text-white",
                ].join(" ")}
              >
                {step.title}
              </h4>
            </div>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="shrink-0 text-xs text-app-400 hover:text-white"
            >
              {expanded ? "Menos" : "Detalhes"}
            </button>
          </div>
          <p className="mt-1 text-sm text-app-300">{step.description}</p>

          {expanded && (
            <div className="mt-3 rounded-lg border border-white/8 bg-app-900/40 p-3">
              <p className="text-sm leading-relaxed text-app-200">
                {step.detail}
              </p>
              {step.href && (
                <a
                  href={step.href}
                  className="mt-2 inline-block text-sm font-medium text-brand-400 hover:text-brand-300"
                >
                  Ir para esta seção →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────

export function TrainingModePage() {
  const { user } = useAuth();
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const track = TRACKS.find((t) => t.id === selectedTrack);

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const progress = track
    ? Math.round(
        (track.steps.filter((s) => completedSteps.has(s.id)).length /
          track.steps.length) *
          100,
      )
    : 0;

  // Sugerir trilha baseada no perfil
  const suggestedTrackId: TrackId | null =
    user?.perfil === "VOLUNTARIO"
      ? "voluntario"
      : user?.perfil === "ADMIN"
        ? "admin"
        : user?.perfil === "MASTER_ADMIN"
          ? "master_admin"
          : null;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-violet-500/15 via-app-800 to-brand-500/10 p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 ring-1 ring-violet-400/30">
              <GraduationCap className="h-6 w-6 text-violet-300" />
            </div>
            <h1 className="mb-2 font-display text-3xl font-bold text-white">
              Modo Treinamento
            </h1>
            <p className="text-app-300">
              Trilhas guiadas para dominar o sistema passo a passo
            </p>
          </div>
          {selectedTrack && track && (
            <div className="text-center sm:text-right">
              <p className="mb-1 text-sm text-app-400">Progresso</p>
              <p className="font-display text-4xl font-bold text-white">
                {progress}%
              </p>
              <p className="text-xs text-app-400">
                {track.steps.filter((s) => completedSteps.has(s.id)).length}/
                {track.steps.length} concluídos
              </p>
            </div>
          )}
        </div>
      </div>

      {!selectedTrack ? (
        <>
          {suggestedTrackId && (
            <InlineHint variant="tip">
              Com base no seu perfil, recomendamos começar pela{" "}
              <strong>
                {TRACKS.find((t) => t.id === suggestedTrackId)?.title}
              </strong>
              .
            </InlineHint>
          )}

          <section>
            <SectionHeader
              title="Escolha sua trilha"
              subtitle="Cada trilha é adaptada ao seu papel no sistema"
            />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TRACKS.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onSelect={setSelectedTrack}
                />
              ))}
            </div>
          </section>
        </>
      ) : track ? (
        <section>
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setSelectedTrack(null)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-app-300 transition-colors hover:bg-white/8 hover:text-white"
            >
              ← Voltar
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                {track.title}
              </h2>
              <p className="text-sm text-app-400">{track.subtitle}</p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mb-6 overflow-hidden rounded-full bg-app-700">
            <div
              className="h-2 rounded-full bg-linear-to-r from-brand-500 to-violet-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {progress === 100 && (
            <div className="mb-6 rounded-xl border border-brand-400/30 bg-brand-500/15 p-5 text-center">
              <div className="mb-2 text-4xl">🎉</div>
              <h3 className="mb-1 font-display text-lg font-bold text-white">
                Parabéns! Trilha concluída!
              </h3>
              <p className="text-sm text-app-300">
                Você completou todos os passos. Agora você está pronto para usar
                o sistema com excelência.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {track.steps.map((step, i) => (
              <StepDetail
                key={step.id}
                step={step}
                index={i}
                total={track.steps.length}
                completed={completedSteps.has(step.id)}
                onToggle={() => toggleStep(step.id)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
