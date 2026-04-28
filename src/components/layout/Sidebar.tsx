import {
  Bell,
  BrainCircuit,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Crown,
  FileBarChart2,
  GraduationCap,
  History,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Network,
  LogOut,
  Palette,
  Repeat2,
  ScanLine,
  Send,
  ShieldCheck,
  TrendingUp,
  Trophy,
  UserCheck,
  UserCircle2,
  X,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { menuItems } from "../../data/dashboard";
import { useAuth } from "../../hooks/useAuth";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const menuIconMap = {
  dashboard: LayoutDashboard,
  "minha-escala": CalendarCheck2,
  "minha-disponibilidade": CalendarClock,
  "meu-perfil": UserCircle2,
  "gestao-escalas": ShieldCheck,
  "aprovacao-voluntarios": UserCheck,
  "master-admin": Crown,
  eventos: CalendarDays,
  "solicitar-troca": Repeat2,
  "minhas-solicitacoes": Send,
  "solicitacoes-recebidas": Inbox,
  "historico-trocas": History,
  notificacoes: Bell,
  "check-in": ScanLine,
  presenca: ClipboardCheck,
  auditoria: ShieldCheck,
  relatorios: FileBarChart2,
  ranking: Trophy,
  "ia-insights": BrainCircuit,
  ministerios: Building2,
  igrejas: Building2,
  "config-igreja": ShieldCheck,
  branding: Palette,
  "multi-unidade": Network,
  ajuda: LifeBuoy,
  treinamento: GraduationCap,
  "painel-estrategico": TrendingUp,
} as const;

const perfilLabel: Record<string, string> = {
  MASTER_PLATFORM_ADMIN: "Platform Admin",
  MASTER_ADMIN: "Master Admin",
  ADMIN: "Administrador",
  VOLUNTARIO: "Voluntário",
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = menuItems.filter((item) => {
    if (!item.allowedProfiles?.length) {
      return true;
    }

    if (!user?.perfil) {
      return false;
    }

    return item.allowedProfiles.includes(user.perfil);
  });

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.nome
    ? user.nome
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-40 flex w-76 max-w-[85vw] flex-col border-r border-white/10 bg-app-850/95 backdrop-blur-xl transition-transform duration-300",
        "lg:static lg:z-auto lg:translate-x-0 lg:bg-app-850/70",
        isOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
      aria-label="Menu principal"
      aria-modal="true"
      role="dialog"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-400/40 bg-brand-500/15 shadow-[0_0_36px_rgba(22,213,176,0.24)]">
            <span className="font-display text-base font-semibold text-brand-100">
              EL
            </span>
          </div>
          <div>
            <p className="font-display text-[15px] font-semibold text-white">
              Escala Lagoinha
            </p>
            <p className="text-xs text-app-200">
              {user?.church?.nome ?? "Multi-tenant"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-app-100 lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav scrollável */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-5 py-2 scrollbar-thin">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-app-200/80">
          Navegação
        </p>
        <ul className="space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = menuIconMap[item.key as keyof typeof menuIconMap];

            return (
              <li key={item.key}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                      isActive
                        ? "bg-brand-500/15 text-brand-100 ring-1 ring-brand-400/35"
                        : "text-app-100/85 hover:bg-white/5 hover:text-white",
                    ].join(" ")
                  }
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User profile footer */}
      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-sm font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {user?.nome ?? "Usuário"}
            </p>
            <p className="truncate text-xs text-app-200">
              {user?.perfil ? (perfilLabel[user.perfil] ?? user.perfil) : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-app-200 transition hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sair da conta
        </button>
      </div>
    </aside>
  );
}
