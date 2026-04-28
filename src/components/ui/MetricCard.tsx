import { CalendarCheck2, Clock3, Sparkles, UsersRound } from "lucide-react";
import type { DashboardCard } from "../../types/dashboard";

type MetricCardProps = {
  card: DashboardCard;
  index: number;
};

const iconMap = {
  proximaEscala: CalendarCheck2,
  voluntariosHoje: UsersRound,
  proximosEventos: Sparkles,
  solicitacoes: Clock3,
} as const;

export function MetricCard({ card, index }: MetricCardProps) {
  const Icon = iconMap[card.icone];

  return (
    <article
      className="animate-rise rounded-2xl border border-white/10 bg-linear-to-b from-white/8 to-white/4 p-4 shadow-[0_8px_40px_rgba(3,8,18,0.45)] transition hover:border-white/15 hover:from-white/10 sm:p-5"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-app-200 sm:text-sm sm:tracking-wide sm:normal-case sm:uppercase-0">
          {card.titulo}
        </h2>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-400/30 bg-brand-500/15 text-brand-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p className="font-display text-2xl font-semibold text-white">
        {card.valor}
      </p>
      <p className="mt-1.5 text-sm text-app-200">{card.descricao}</p>
      <p className="mt-4 border-t border-white/10 pt-3 text-xs font-medium uppercase tracking-[0.12em] text-brand-100/90">
        {card.detalhe}
      </p>
    </article>
  );
}
