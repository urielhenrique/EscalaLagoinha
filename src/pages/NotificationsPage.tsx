import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { getErrorMessage } from "../services/api";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notificationsApi";
import type { NotificationItem } from "../types/domain";
import { formatDateTime } from "../utils/date";

type FilterMode = "TODAS" | "NAO_LIDAS" | "LIDAS";

const typeLabelMap: Record<string, string> = {
  SCALE_CREATED: "Nova escala",
  REMINDER: "Lembrete",
  SWAP_REQUEST: "Troca recebida",
  SWAP_APPROVED: "Troca aprovada",
  SWAP_DECLINED: "Troca recusada",
  SCALE_CANCELLED: "Escala cancelada",
};

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("TODAS");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listNotifications(false);
      setItems(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível carregar notificações.",
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
    if (filter === "NAO_LIDAS") {
      return items.filter((item) => !item.lida);
    }

    if (filter === "LIDAS") {
      return items.filter((item) => item.lida);
    }

    return items;
  }, [filter, items]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.lida).length,
    [items],
  );

  const handleMarkAllAsRead = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await markAllNotificationsAsRead();
      setSuccess(
        `${response.data.updated} notificação(ões) marcadas como lidas.`,
      );
      await load();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível marcar todas como lidas.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await markNotificationAsRead(id);
      await load();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível marcar como lida."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await deleteNotification(id);
      await load();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível excluir notificação."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Centro"
        title="Notificações"
        description="Acompanhe lembretes, escalas e atualizações de troca em tempo real."
        action={
          <button
            type="button"
            onClick={() => void handleMarkAllAsRead()}
            disabled={isSubmitting || unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "TODAS", label: "Todas" },
            { value: "NAO_LIDAS", label: "Não lidas" },
            { value: "LIDAS", label: "Lidas" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value as FilterMode)}
              className={[
                "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                filter === option.value
                  ? "bg-brand-500/20 text-brand-100"
                  : "text-app-200 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-[0.12em] text-app-200">
          Não lidas: {unreadCount}
        </p>
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
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          title="Sem notificações"
          description="Nenhuma notificação para o filtro selecionado no momento."
        />
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((notification) => (
            <article
              key={notification.id}
              className={[
                "rounded-2xl border p-4",
                notification.lida
                  ? "border-white/10 bg-white/5"
                  : "border-brand-400/30 bg-brand-500/10",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                    {typeLabelMap[notification.tipo] ?? notification.tipo}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white">
                    {notification.titulo}
                  </h3>
                  <p className="mt-1 text-sm text-app-100">
                    {notification.mensagem}
                  </p>
                  <p className="mt-2 text-xs text-app-200">
                    {formatDateTime(notification.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!notification.lida ? (
                    <button
                      type="button"
                      onClick={() => void handleMarkAsRead(notification.id)}
                      disabled={isSubmitting}
                      className="rounded-lg border border-brand-400/35 bg-brand-500/15 px-2.5 py-1.5 text-xs font-semibold text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
                    >
                      Marcar lida
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleDelete(notification.id)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
