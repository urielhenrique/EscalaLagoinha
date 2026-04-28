import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Send } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { listSchedules } from "../services/schedulesApi";
import {
  createSwapRequest,
  listEligibleSwapCandidates,
} from "../services/swapRequestsApi";
import type { ScheduleItem } from "../types/domain";
import { formatDateTime, formatTimeRange } from "../utils/date";

export function SwapRequestPage() {
  const { user } = useAuth();
  const [mySchedules, setMySchedules] = useState<ScheduleItem[]>([]);
  const [eligible, setEligible] = useState<ScheduleItem[]>([]);
  const [selectedRequesterShiftId, setSelectedRequesterShiftId] = useState("");
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRequesterShift = useMemo(
    () =>
      mySchedules.find((item) => item.id === selectedRequesterShiftId) ?? null,
    [mySchedules, selectedRequesterShiftId],
  );

  const loadMySchedules = async () => {
    if (!user?.id) {
      setIsLoadingSchedules(false);
      return;
    }

    setIsLoadingSchedules(true);
    setError(null);

    try {
      const response = await listSchedules({ volunteerId: user.id });
      const active = response.data.filter(
        (item) => item.status !== "CANCELADO",
      );
      setMySchedules(active);

      if (active.length > 0) {
        setSelectedRequesterShiftId((current) => current || active[0].id);
      }
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível carregar suas escalas para troca.",
        ),
      );
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  useEffect(() => {
    void loadMySchedules();
  }, [user?.id]);

  useEffect(() => {
    const loadEligible = async () => {
      if (!selectedRequesterShiftId) {
        setEligible([]);
        return;
      }

      setIsLoadingEligible(true);
      setError(null);

      try {
        const response = await listEligibleSwapCandidates(
          selectedRequesterShiftId,
        );
        setEligible(response.data);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Não foi possível carregar voluntários elegíveis.",
          ),
        );
      } finally {
        setIsLoadingEligible(false);
      }
    };

    void loadEligible();
  }, [selectedRequesterShiftId]);

  const handleSendRequest = async (targetShift: ScheduleItem) => {
    if (!selectedRequesterShift) {
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      await createSwapRequest({
        requesterShiftId: selectedRequesterShift.id,
        requestedShiftId: targetShift.id,
        requestedVolunteerId: targetShift.volunteerId,
      });
      setSuccess("Solicitação enviada com sucesso.");
      const refreshed = await listEligibleSwapCandidates(
        selectedRequesterShift.id,
      );
      setEligible(refreshed.data);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível enviar solicitação."),
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Troca"
        title="Solicitar Troca de Escala"
        description="Escolha uma escala sua e envie para voluntários elegíveis do mesmo ministério."
      />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="space-y-2 text-sm">
          <span className="text-app-200">Sua escala para troca</span>
          <select
            value={selectedRequesterShiftId}
            onChange={(event) =>
              setSelectedRequesterShiftId(event.target.value)
            }
            className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
            disabled={isLoadingSchedules || mySchedules.length === 0}
          >
            {mySchedules.length === 0 ? (
              <option value="">Sem escalas elegíveis</option>
            ) : null}
            {mySchedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.event.nome} · {schedule.ministry.nome} ·{" "}
                {formatDateTime(schedule.event.dataInicio)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedRequesterShift ? (
        <div className="rounded-2xl border border-brand-400/25 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
          <p className="font-semibold">Escala selecionada</p>
          <p className="mt-1">
            {selectedRequesterShift.event.nome} ·{" "}
            {selectedRequesterShift.ministry.nome} ·{" "}
            {formatTimeRange(
              selectedRequesterShift.event.dataInicio,
              selectedRequesterShift.event.dataFim,
            )}
          </p>
        </div>
      ) : null}

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

      {isLoadingSchedules || isLoadingEligible ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : null}

      {!isLoadingSchedules && !isLoadingEligible && eligible.length === 0 ? (
        <EmptyState
          title="Nenhum candidato elegível"
          description="Não encontramos voluntários ativos do mesmo ministério sem conflito de horário."
        />
      ) : null}

      {!isLoadingSchedules && !isLoadingEligible && eligible.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {eligible.map((candidate) => (
            <article
              key={candidate.id}
              className="rounded-2xl border border-white/10 bg-linear-to-b from-white/8 to-white/4 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                    Candidato
                  </p>
                  <h3 className="font-display text-lg font-semibold text-white">
                    {candidate.volunteer.nome}
                  </h3>
                </div>
                <StatusBadge status={candidate.status} />
              </div>

              <p className="font-medium text-app-100">{candidate.event.nome}</p>
              <p className="text-sm text-app-200">{candidate.ministry.nome}</p>
              <p className="mt-1 text-sm text-app-200">
                {formatDateTime(candidate.event.dataInicio)}
              </p>

              <button
                type="button"
                onClick={() => void handleSendRequest(candidate)}
                disabled={isSending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-3 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                Solicitar troca
              </button>
            </article>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-app-850/70 px-4 py-3 text-sm text-app-200">
        <p className="flex items-center gap-2 font-semibold text-app-100">
          <ArrowLeftRight className="h-4 w-4" />
          Regras aplicadas automaticamente
        </p>
        <ul className="mt-2 space-y-1">
          <li>• Mesmo ministério</li>
          <li>• Voluntário ativo</li>
          <li>• Sem conflito de horário</li>
          <li>• Sem auto troca e sem duplicidade pendente</li>
        </ul>
      </div>
    </section>
  );
}
