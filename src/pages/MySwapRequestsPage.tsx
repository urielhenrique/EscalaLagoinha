import { useEffect, useMemo, useState } from "react";
import { Ban } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { SwapRequestCard } from "../components/ui/SwapRequestCard";
import { getErrorMessage } from "../services/api";
import {
  cancelSwapRequest,
  listMySwapRequests,
} from "../services/swapRequestsApi";
import type { SwapRequestItem, SwapRequestStatus } from "../types/domain";

export function MySwapRequestsPage() {
  const [items, setItems] = useState<SwapRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"TODOS" | SwapRequestStatus>("TODOS");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listMySwapRequests();
      setItems(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível carregar suas solicitações.",
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
    if (filter === "TODOS") {
      return items;
    }

    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const handleCancel = async (id: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await cancelSwapRequest(id);
      setSuccess("Solicitação cancelada com sucesso.");
      await load();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível cancelar solicitação."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Troca"
        title="Minhas Solicitações"
        description="Acompanhe o andamento das trocas que você enviou."
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
        {["TODOS", "PENDENTE", "APROVADO", "RECUSADO", "CANCELADO"].map(
          (value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as "TODOS" | SwapRequestStatus)}
              className={[
                "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                filter === value
                  ? "bg-brand-500/20 text-brand-100"
                  : "text-app-200 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {value}
            </button>
          ),
        )}
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
          title="Sem solicitações"
          description="Você ainda não enviou solicitações de troca com os filtros atuais."
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
                  <button
                    type="button"
                    onClick={() => void handleCancel(request.id)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancelar
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
