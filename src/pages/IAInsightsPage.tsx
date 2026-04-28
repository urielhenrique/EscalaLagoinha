import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Gauge,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { listEvents } from "../services/eventsApi";
import {
  generateSmartSchedule,
  getSmartSchedulerInsights,
} from "../services/smartSchedulerApi";
import type {
  AbsenceRisk,
  EventItem,
  SmartSchedulerGeneration,
  SmartSchedulerInsights,
} from "../types/domain";
import { formatDateTime } from "../utils/date";

function riskClasses(risk: AbsenceRisk) {
  if (risk === "ALTO") {
    return "border-rose-400/35 bg-rose-500/15 text-rose-100";
  }

  if (risk === "MEDIO") {
    return "border-amber-400/35 bg-amber-500/15 text-amber-100";
  }

  return "border-emerald-400/35 bg-emerald-500/15 text-emerald-100";
}

export function IAInsightsPage() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === "ADMIN";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [slotsPerMinistry, setSlotsPerMinistry] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [insights, setInsights] = useState<SmartSchedulerInsights | null>(null);
  const [generationResult, setGenerationResult] =
    useState<SmartSchedulerGeneration | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const loadEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listEvents();
      setEvents(response.data);

      if (response.data.length > 0) {
        const nextEvent = [...response.data].sort(
          (a, b) =>
            new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
        )[0];
        setSelectedEventId(nextEvent.id);
      }
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível carregar os eventos para IA.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadInsights = async (eventId: string) => {
    if (!eventId) {
      return;
    }

    setError(null);

    try {
      const response = await getSmartSchedulerInsights(eventId);
      setInsights(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível carregar os insights inteligentes.",
        ),
      );
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    void loadEvents();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedEventId || !isAdmin) {
      return;
    }

    void loadInsights(selectedEventId);
  }, [isAdmin, selectedEventId]);

  const handleGenerateSmartSchedule = async () => {
    if (!selectedEventId) {
      setError("Selecione um evento para gerar escala inteligente.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await generateSmartSchedule(selectedEventId, {
        slotsPerMinistry,
      });

      setGenerationResult(response.data);

      const warningsCount = response.data.warnings.length;
      setSuccess(
        warningsCount > 0
          ? `Escala gerada com ${response.data.createdCount} alocação(ões), com ${warningsCount} aviso(s).`
          : `Escala gerada com ${response.data.createdCount} alocação(ões) com sucesso.`,
      );

      await loadInsights(selectedEventId);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível gerar a escala inteligente.",
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="space-y-5">
        <SectionHeader
          eyebrow="Smart Scheduler"
          title="IA Insights"
          description="Acesso restrito ao perfil administrador."
        />
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-amber-100">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Acesso restrito
          </div>
          <p className="mt-2 text-sm text-amber-100/85">
            Entre com usuário ADMIN para usar geração inteligente de escalas.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Smart Scheduler"
        title="IA Insights"
        description="Sugestões automáticas, ranking de voluntários e geração inteligente de escala por evento."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-xs text-app-200">
              Slots por ministério
              <input
                type="number"
                min={1}
                max={8}
                value={slotsPerMinistry}
                onChange={(event) =>
                  setSlotsPerMinistry(
                    Math.min(8, Math.max(1, Number(event.target.value) || 1)),
                  )
                }
                className="ml-2 w-14 rounded-md border border-white/10 bg-app-900 px-2 py-1 text-app-100 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleGenerateSmartSchedule()}
              disabled={isGenerating || !selectedEventId}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="h-4 w-4" />
              )}
              Gerar Escala Inteligente
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-white/10 bg-linear-to-br from-app-900 via-app-850 to-app-900 p-4">
        <label className="text-xs uppercase tracking-[0.14em] text-app-200/80">
          Evento alvo
        </label>
        <select
          value={selectedEventId}
          onChange={(event) => {
            setSelectedEventId(event.target.value);
            setGenerationResult(null);
            setSuccess(null);
          }}
          className="mt-2 w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none md:max-w-md"
        >
          <option value="">Selecione um evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.nome} · {formatDateTime(event.dataInicio)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-20" />
          <Skeleton className="h-48" />
        </div>
      ) : null}

      {!isLoading && !selectedEvent ? (
        <EmptyState
          title="Nenhum evento disponível"
          description="Cadastre eventos para habilitar o Smart Scheduler."
        />
      ) : null}

      {!isLoading && selectedEvent && insights ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-app-200/80">
                Ranking total
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
                <Users className="h-5 w-5 text-brand-200" />
                {insights.ranking.length}
              </p>
              <p className="mt-1 text-xs text-app-200">Voluntários avaliados</p>
            </article>

            <article className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-rose-100/90">
                Risco alto
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-rose-100">
                <AlertTriangle className="h-5 w-5" />
                {insights.alerts.riscoAusencia.alto}
              </p>
              <p className="mt-1 text-xs text-rose-100/80">Demandam atenção</p>
            </article>

            <article className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-100/90">
                Sobrecarga
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-amber-100">
                <Gauge className="h-5 w-5" />
                {insights.alerts.sobrecarga.length}
              </p>
              <p className="mt-1 text-xs text-amber-100/80">
                Carga recente elevada
              </p>
            </article>

            <article className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-sky-100/90">
                Pouco escalados
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-sky-100">
                <Sparkles className="h-5 w-5" />
                {insights.alerts.poucoEscalados.length}
              </p>
              <p className="mt-1 text-xs text-sky-100/80">
                Oportunidade de equilíbrio
              </p>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="font-display text-lg font-semibold text-white">
                  Ranking inteligente de voluntários
                </h3>
                <span className="text-xs text-app-200">
                  Atualizado em {formatDateTime(insights.generatedAt)}
                </span>
              </div>

              {insights.ranking.length === 0 ? (
                <div className="px-4 py-6 text-sm text-app-200">
                  Nenhum voluntário apto encontrado para este evento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-app-200">
                      <tr>
                        <th className="px-4 py-3">Voluntário</th>
                        <th className="px-4 py-3 text-right">Score</th>
                        <th className="px-4 py-3 text-right">Risco</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {insights.ranking.slice(0, 12).map((volunteer) => (
                        <tr
                          key={volunteer.volunteerId}
                          className="hover:bg-white/5"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">
                              {volunteer.nome}
                            </p>
                            <p className="text-xs text-app-200">
                              {volunteer.email}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex min-w-10 justify-center rounded-lg border border-brand-400/30 bg-brand-500/15 px-2 py-1 font-semibold text-brand-100">
                              {volunteer.score}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={[
                                "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                                riskClasses(volunteer.riscoAusencia),
                              ].join(" ")}
                            >
                              {volunteer.riscoAusencia}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                <BrainCircuit className="h-5 w-5 text-brand-200" />
                Insights da IA
              </h3>

              <ul className="mt-3 space-y-2 text-sm text-app-100">
                {insights.insights.local.map((line) => (
                  <li
                    key={line}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-xl border border-brand-300/25 bg-brand-500/10 px-3 py-3 text-sm text-brand-100">
                <p className="font-semibold">OpenAI (opcional)</p>
                <p className="mt-1 text-brand-100/85">
                  {insights.insights.ai ||
                    "Sem API key ativa. Usando heurística local profissional para recomendações."}
                </p>
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-display text-lg font-semibold text-white">
              Sugestões automáticas por ministério
            </h3>
            <p className="mt-1 text-sm text-app-200">
              Prévia dos melhores nomes para composição da escala.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {insights.suggestionsByMinistry.map((row) => (
                <div
                  key={row.ministry.id}
                  className="rounded-xl border border-white/10 bg-app-900/60 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {row.ministry.nome}
                  </p>
                  {row.suggestions.length === 0 ? (
                    <p className="mt-2 text-xs text-app-200">
                      Sem candidatos aptos.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {row.suggestions.slice(0, 4).map((suggestion) => (
                        <div
                          key={suggestion.volunteerId}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-app-100">
                              {suggestion.nome}
                            </span>
                            <span className="text-xs font-semibold text-brand-100">
                              Score {suggestion.score}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-white/10">
                            <div
                              className="h-1.5 rounded-full bg-brand-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(8, (suggestion.score + 15) * 3),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>

          {generationResult ? (
            <article className="rounded-2xl border border-brand-300/30 bg-brand-500/10 p-4">
              <h3 className="font-display text-lg font-semibold text-brand-100">
                Resultado da geração inteligente
              </h3>
              <p className="mt-1 text-sm text-brand-100/85">
                {generationResult.createdCount} escala(s) criada(s)
                automaticamente.
              </p>

              {generationResult.warnings.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {generationResult.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                    >
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
