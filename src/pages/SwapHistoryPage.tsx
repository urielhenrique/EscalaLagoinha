import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { SwapRequestCard } from "../components/ui/SwapRequestCard";
import { getErrorMessage } from "../services/api";
import { listSwapHistory } from "../services/swapRequestsApi";
import type { SwapRequestItem, SwapRequestStatus } from "../types/domain";

export function SwapHistoryPage() {
  const [items, setItems] = useState<SwapRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"TODOS" | SwapRequestStatus>(
    "TODOS",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await listSwapHistory();
        setItems(response.data);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Não foi possível carregar o histórico de trocas.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "TODOS") {
      return items;
    }

    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Troca"
        title="Histórico de Trocas"
        description="Acompanhe todas as solicitações, inclusive aprovadas, recusadas e canceladas."
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
        {["TODOS", "APROVADO", "RECUSADO", "CANCELADO", "PENDENTE"].map(
          (value) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setStatusFilter(value as "TODOS" | SwapRequestStatus)
              }
              className={[
                "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                statusFilter === value
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

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          title="Histórico vazio"
          description="Ainda não há registros de troca para os filtros selecionados."
        />
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((request) => (
            <SwapRequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
