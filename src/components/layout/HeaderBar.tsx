import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Menu, Search, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../services/api";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../services/notificationsApi";
import type { NotificationItem } from "../../types/domain";
import { formatDateTime } from "../../utils/date";

type HeaderBarProps = {
  onMenuClick: () => void;
};

export function HeaderBar({ onMenuClick }: HeaderBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const notificationWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Ref para o AbortController da requisição em curso.
  // Garante que somente uma chamada esteja ativa ao mesmo tempo.
  const activeRequestRef = useRef<AbortController | null>(null);

  const pollingIntervalMs = useMemo(() => {
    const rawValue = Number(
      import.meta.env.VITE_NOTIFICATIONS_POLL_INTERVAL_MS,
    );
    if (!Number.isFinite(rawValue) || rawValue < 5000) {
      return 20000;
    }
    return rawValue;
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.lida).length,
    [notifications],
  );

  const quickNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications],
  );

  const loadNotifications = async () => {
    // Cancela a requisição anterior se ainda estiver em andamento.
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;

    setIsLoadingNotifications(true);

    try {
      const response = await listNotifications(false, controller.signal);

      // Se o signal foi abortado enquanto aguardava, ignoramos o resultado.
      if (!controller.signal.aborted) {
        setNotifications(response.data);
      }
    } catch (error) {
      // DOMException de abort não deve ser logado como erro real.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error(getErrorMessage(error, "Falha ao carregar notificações."));
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingNotifications(false);
        activeRequestRef.current = null;
      }
    }
  };

  useEffect(() => {
    void loadNotifications();

    const timer = window.setInterval(() => {
      void loadNotifications();
    }, pollingIntervalMs);

    return () => {
      window.clearInterval(timer);
      // Cancela requisição pendente ao desmontar o componente.
      activeRequestRef.current?.abort();
    };
  }, [pollingIntervalMs]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!notificationWrapperRef.current?.contains(target)) {
        setIsNotificationsOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleMarkAllQuick = async () => {
    try {
      await markAllNotificationsAsRead();
      await loadNotifications();
    } catch (error) {
      console.error(
        getErrorMessage(error, "Falha ao marcar notificações como lidas."),
      );
    }
  };

  const handleOpenNotification = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      await loadNotifications();
    } catch {
      // Se falhar ao marcar lida, ainda assim levamos para a central.
    }

    navigate("/notificacoes");
    setIsNotificationsOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 flex h-18 items-center border-b border-white/10 bg-app-900/75 px-4 backdrop-blur-xl sm:h-20 sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={onMenuClick}
        className="mr-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-app-100/90 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.18em] text-app-200/70">
          Igreja
        </p>
        <h1 className="truncate font-display text-lg font-semibold text-white sm:text-xl">
          Lagoinha Jardim Atlântico
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-app-200 transition hover:bg-white/10 sm:inline-flex"
          aria-label="Pesquisar"
        >
          <Search className="h-4 w-4" />
          Pesquisar
        </button>
        <div ref={notificationWrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((current) => !current)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-app-100 transition hover:bg-white/10"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border border-brand-400/50 bg-brand-500 px-1 text-[10px] font-semibold text-app-900">
                {unreadCount}
              </span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <section className="absolute -right-2.5 top-20 z-40 w-[min(92vw,23rem)] rounded-2xl border border-white/10 bg-app-850/98 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:right-0 sm:w-92">
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-app-200">
                    Central
                  </p>
                  <h3 className="font-display text-lg font-semibold text-white">
                    Notificações
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void handleMarkAllQuick()}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-400/35 bg-brand-500/15 px-2.5 py-1.5 text-xs font-semibold text-brand-100 transition hover:bg-brand-500/20"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Ler todas
                </button>
              </header>

              <div className="space-y-2">
                {isLoadingNotifications ? (
                  <p className="text-sm text-app-200">Carregando...</p>
                ) : null}

                {!isLoadingNotifications && quickNotifications.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-200">
                    Sem notificações por enquanto.
                  </p>
                ) : null}

                {!isLoadingNotifications
                  ? quickNotifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleOpenNotification(item.id)}
                        className={[
                          "w-full rounded-xl border px-3 py-2 text-left transition",
                          item.lida
                            ? "border-white/10 bg-white/5"
                            : "border-brand-400/30 bg-brand-500/10",
                        ].join(" ")}
                      >
                        <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                          {formatDateTime(item.createdAt)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {item.titulo}
                        </p>
                        <p className="text-xs text-app-200">{item.mensagem}</p>
                      </button>
                    ))
                  : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  navigate("/notificacoes");
                  setIsNotificationsOpen(false);
                }}
                className="mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-app-100 transition hover:bg-white/10"
              >
                Ver todas
              </button>
            </section>
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 transition hover:bg-white/10 sm:px-3"
          aria-label="Perfil do usuário"
        >
          <UserCircle2 className="h-6 w-6 text-brand-100" />
          <span className="hidden text-sm font-medium text-app-100 sm:inline">
            {user?.nome ?? "Você"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-app-200 transition hover:bg-white/10 hover:text-white"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
