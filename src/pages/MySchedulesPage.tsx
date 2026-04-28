import { useEffect, useMemo, useState } from "react";
import { CalendarDays, LayoutGrid, List } from "lucide-react";
import { CalendarActions } from "../components/ui/CalendarActions";
import { EmptyState } from "../components/ui/EmptyState";
import { PaginationControls } from "../components/ui/PaginationControls";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { listSchedules } from "../services/schedulesApi";
import { getErrorMessage } from "../services/api";
import type { ScheduleItem, ScheduleStatus } from "../types/domain";
import {
  formatDate,
  formatDateTime,
  formatTimeRange,
  formatWeekday,
  isPastSchedule,
} from "../utils/date";

type PeriodFilter = "PROXIMAS" | "PASSADAS" | "TODAS";
type ViewMode = "CARDS" | "LISTA" | "CALENDARIO";
type SortOption = "DATA_ASC" | "DATA_DESC" | "EVENTO_ASC";

const PAGE_SIZE = 9;

const statusOptions: Array<{ value: "TODOS" | ScheduleStatus; label: string }> =
  [
    { value: "TODOS", label: "Todos status" },
    { value: "CONFIRMADO", label: "Confirmado" },
    { value: "PENDENTE", label: "Pendente" },
    { value: "CANCELADO", label: "Cancelado" },
  ];

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: "PROXIMAS", label: "Próximas" },
  { value: "PASSADAS", label: "Passadas" },
  { value: "TODAS", label: "Todas" },
];

export function MySchedulesPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"TODOS" | ScheduleStatus>(
    "TODOS",
  );
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("PROXIMAS");
  const [viewMode, setViewMode] = useState<ViewMode>("CARDS");
  const [sortBy, setSortBy] = useState<SortOption>("DATA_ASC");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await listSchedules({ volunteerId: user.id });
        setSchedules(response.data);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Não foi possível carregar suas escalas agora.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [user?.id]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      const isPast = isPastSchedule(schedule.event.dataFim);

      if (periodFilter === "PROXIMAS" && isPast) {
        return false;
      }

      if (periodFilter === "PASSADAS" && !isPast) {
        return false;
      }

      if (statusFilter !== "TODOS" && schedule.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [periodFilter, schedules, statusFilter]);

  const sortedSchedules = useMemo(() => {
    const list = [...filteredSchedules];

    list.sort((first, second) => {
      if (sortBy === "DATA_DESC") {
        return (
          new Date(second.event.dataInicio).getTime() -
          new Date(first.event.dataInicio).getTime()
        );
      }

      if (sortBy === "EVENTO_ASC") {
        return first.event.nome.localeCompare(second.event.nome, "pt-BR");
      }

      return (
        new Date(first.event.dataInicio).getTime() -
        new Date(second.event.dataInicio).getTime()
      );
    });

    return list;
  }, [filteredSchedules, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedSchedules.length / PAGE_SIZE));
  const paginatedSchedules = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedSchedules.slice(start, end);
  }, [page, sortedSchedules]);

  useEffect(() => {
    setPage(1);
  }, [periodFilter, sortBy, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, ScheduleItem[]>();

    for (const schedule of paginatedSchedules) {
      const key = schedule.event.dataInicio.slice(0, 10);
      const list = groups.get(key) ?? [];
      list.push(schedule);
      groups.set(key, list);
    }

    return Array.from(groups.entries()).sort(([first], [second]) =>
      first.localeCompare(second),
    );
  }, [paginatedSchedules]);

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Escalas"
        title="Minhas Escalas"
        description="Acompanhe agendas futuras, histórico e status das suas participações."
        action={
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                viewMode === "CARDS"
                  ? "bg-brand-500/20 text-brand-100"
                  : "text-app-200 hover:bg-white/5",
              ].join(" ")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("LISTA")}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                viewMode === "LISTA"
                  ? "bg-brand-500/20 text-brand-100"
                  : "text-app-200 hover:bg-white/5",
              ].join(" ")}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode("CALENDARIO")}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                viewMode === "CALENDARIO"
                  ? "bg-brand-500/20 text-brand-100"
                  : "text-app-200 hover:bg-white/5",
              ].join(" ")}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendário
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
        {periodOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriodFilter(option.value)}
            className={[
              "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
              periodFilter === option.value
                ? "bg-brand-500/20 text-brand-100"
                : "text-app-200 hover:bg-white/5 hover:text-white",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "TODOS" | ScheduleStatus)
          }
          className="ml-auto rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortOption)}
          className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
        >
          <option value="DATA_ASC">Data: mais próxima</option>
          <option value="DATA_DESC">Data: mais distante</option>
          <option value="EVENTO_ASC">Evento: A-Z</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-42" />
          ))}
        </div>
      ) : null}

      {!isLoading && filteredSchedules.length === 0 ? (
        <EmptyState
          title="Nenhuma escala encontrada"
          description="Ajuste os filtros ou aguarde novas agendas do seu ministério."
        />
      ) : null}

      {!isLoading && sortedSchedules.length > 0 && viewMode === "CARDS" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedSchedules.map((schedule, index) => (
            <article
              key={schedule.id}
              className="animate-rise rounded-2xl border border-white/10 bg-linear-to-b from-white/8 to-white/4 p-5 shadow-[0_10px_40px_rgba(2,8,20,0.4)]"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-app-200/75">
                    {formatWeekday(schedule.event.dataInicio)}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white">
                    {schedule.event.nome}
                  </h3>
                </div>
                <StatusBadge status={schedule.status} />
              </div>

              <dl className="space-y-2 text-sm text-app-200">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <dt>Data</dt>
                  <dd className="font-medium text-app-100">
                    {formatDate(schedule.event.dataInicio)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <dt>Horário</dt>
                  <dd className="font-medium text-app-100">
                    {formatTimeRange(
                      schedule.event.dataInicio,
                      schedule.event.dataFim,
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <dt>Ministério</dt>
                  <dd className="font-medium text-app-100">
                    {schedule.ministry.nome}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Função</dt>
                  <dd className="font-medium text-app-100">
                    {schedule.volunteer.perfil === "ADMIN"
                      ? "Admin"
                      : "Voluntário"}
                  </dd>
                </div>
              </dl>

              <CalendarActions schedule={schedule} />
            </article>
          ))}
        </div>
      ) : null}

      {!isLoading && sortedSchedules.length > 0 && viewMode === "LISTA" ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-app-200">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Data e Horário</th>
                <th className="px-4 py-3">Ministério</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Calendário</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {paginatedSchedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-white/4">
                  <td className="px-4 py-3 font-medium text-white">
                    {schedule.event.nome}
                  </td>
                  <td className="px-4 py-3 text-app-200">
                    {formatDateTime(schedule.event.dataInicio)}
                  </td>
                  <td className="px-4 py-3 text-app-100">
                    {schedule.ministry.nome}
                  </td>
                  <td className="px-4 py-3 text-app-100">
                    {schedule.volunteer.perfil === "ADMIN"
                      ? "Admin"
                      : "Voluntário"}
                  </td>
                  <td className="px-4 py-3">
                    <CalendarActions schedule={schedule} compact />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={schedule.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!isLoading && sortedSchedules.length > 0 && viewMode === "CALENDARIO" ? (
        <div className="space-y-4">
          {groupedByDay.map(([day, daySchedules]) => (
            <section
              key={day}
              className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-b from-white/6 to-white/3"
            >
              <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="font-display text-lg font-semibold text-white">
                  {formatDate(day)}
                </h3>
                <span className="text-xs uppercase tracking-[0.12em] text-app-200">
                  {daySchedules.length} escala(s)
                </span>
              </header>
              <div className="space-y-2 p-3">
                {daySchedules.map((schedule) => (
                  <article
                    key={schedule.id}
                    className="rounded-xl border border-white/10 bg-app-850/70 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">
                        {schedule.event.nome}
                      </p>
                      <StatusBadge status={schedule.status} />
                    </div>
                    <p className="mt-1 text-sm text-app-200">
                      {formatTimeRange(
                        schedule.event.dataInicio,
                        schedule.event.dataFim,
                      )}{" "}
                      · {schedule.ministry.nome}
                    </p>
                    <CalendarActions schedule={schedule} compact />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
      {!isLoading && sortedSchedules.length > 0 ? (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </section>
  );
}
