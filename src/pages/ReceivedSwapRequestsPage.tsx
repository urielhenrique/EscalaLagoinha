import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { SwapRequestCard } from "../components/ui/SwapRequestCard";
import { getErrorMessage } from "../services/api";
import {
  approveSwapRequest,
  listReceivedSwapRequests,
  rejectSwapRequest,
} from "../services/swapRequestsApi";
import type { SwapRequestItem } from "../types/domain";

export function ReceivedSwapRequestsPage() {
  const [items, setItems] = useState<SwapRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listReceivedSwapRequests();
      setItems(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível carregar solicitações recebidas.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!showOnlyPending) {
      return items;
    }

    return items.filter((item) => item.status === "PENDENTE");
  }, [items, showOnlyPending]);

  const handleApprove = async (id: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await approveSwapRequest(id);
      setSuccess("Troca aprovada e escalas atualizadas automaticamente.");
      await load();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível aprovar a solicitação.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (id: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await rejectSwapRequest(id);
      setSuccess("Solicitação recusada com sucesso.");
      await load();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível recusar a solicitação.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Troca"
        title="Solicitações Recebidas"
        description="Aprove ou recuse trocas recebidas de outros voluntários."
      />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <label className="inline-flex items-center gap-2 text-sm text-app-100">
          <input
            type="checkbox"
            checked={showOnlyPending}
            onChange={(event) => setShowOnlyPending(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-app-850"
          />
          Mostrar apenas pendentes
        </label>
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
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação recebida"
          description="Quando outro voluntário solicitar troca para você, ela aparecerá aqui."
        />
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((request) => (
            <SwapRequestCard
              key={request.id}
              request={request}
              actions={
                request.status === "PENDENTE" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleReject(request.id)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApprove(request.id)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprovar
                    </button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
