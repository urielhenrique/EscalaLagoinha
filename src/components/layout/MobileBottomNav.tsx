import {
  Bell,
  CalendarCheck2,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../services/api";
import { listNotifications } from "../../services/notificationsApi";

type MobileBottomNavProps = {
  onMenuOpen: () => void;
};

const defaultActions = [
  {
    key: "dashboard",
    label: "Inicio",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "escalas",
    label: "Escalas",
    path: "/minhas-escalas",
    icon: CalendarCheck2,
  },
  {
    key: "ranking",
    label: "Ranking",
    path: "/ranking",
    icon: Trophy,
  },
  {
    key: "notificacoes",
    label: "Avisos",
    path: "/notificacoes",
    icon: Bell,
    hasUnread: true,
  },
] as const;

export function MobileBottomNav({ onMenuOpen }: MobileBottomNavProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const load = async () => {
      controllerRef.current?.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;

      try {
        const res = await listNotifications(false, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setUnreadCount(res.data.filter((n) => !n.lida).length);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn(getErrorMessage(err, "Falha ao buscar notificacoes."));
      }
    };

    void load();

    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, []);

  const actions =
    user?.perfil === "ADMIN" ||
    user?.perfil === "MASTER_ADMIN" ||
    user?.perfil === "MASTER_PLATFORM_ADMIN"
      ? defaultActions.map((item) =>
          item.key === "escalas"
            ? {
                ...item,
                label: "Gestao",
                path: "/gestao-escalas",
                icon: ShieldCheck,
              }
            : item,
        )
      : defaultActions;

  return (
    <nav
      className="fixed inset-x-2 bottom-2 z-30 rounded-2xl border border-white/15 bg-app-850/92 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5 gap-1">
        {actions.map((item) => (
          <li key={item.key}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                [
                  "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition",
                  isActive
                    ? "bg-brand-500/18 text-brand-100"
                    : "text-app-200 hover:bg-white/5 hover:text-white",
                ].join(" ")
              }
            >
              <span className="relative">
                <item.icon className="h-4 w-4" />
                {"hasUnread" in item && item.hasUnread && unreadCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full border border-brand-400/50 bg-brand-500 px-0.5 text-[9px] font-bold text-app-900">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMenuOpen}
            className="flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-app-200 transition hover:bg-white/5 hover:text-white"
            aria-label="Abrir menu completo"
          >
            <Menu className="h-4 w-4" />
            <span>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
