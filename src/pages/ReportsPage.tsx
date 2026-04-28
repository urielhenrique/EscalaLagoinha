import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { listVisibleMinistries } from "../services/ministriesApi";
import { getErrorMessage } from "../services/api";
import { exportReports, getReportsOverview } from "../services/reportsApi";
import { listActiveVolunteers } from "../services/usersApi";
import type {
  MinistryItem,
  ReportsOverviewResponse,
  UserItem,
  VolunteerReportRow,
} from "../types/domain";
import { formatDateTime } from "../utils/date";

export function ReportsPage() {
  const [report, setReport] = useState<ReportsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [volunteerId, setVolunteerId] = useState("");
  const [search, setSearch] = useState("");
  const [ministries, setMinistries] = useState<MinistryItem[]>([]);
  const [volunteers, setVolunteers] = useState<UserItem[]>([]);

  const deferredSearch = useDeferredValue(search);

  const loadFilters = async () => {
    const [ministriesResponse, volunteersResponse] = await Promise.all([
      listVisibleMinistries(),
      listActiveVolunteers(),
    ]);

    setMinistries(ministriesResponse.data);
    setVolunteers(volunteersResponse.data);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await loadFilters();
      const response = await getReportsOverview({
        from: from || undefined,
        to: to || undefined,
        ministryId: ministryId || undefined,
        volunteerId: volunteerId || undefined,
      });
      setReport(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível carregar o relatório."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [from, to, ministryId, volunteerId]);

  const kpis = useMemo(() => {
    if (!report) {
      return null;
    }

    return [
      { label: "Escalas", value: report.totals.schedules },
      { label: "Voluntários", value: report.totals.volunteers },
      { label: "Ministérios", value: report.totals.ministries },
      { label: "Presentes", value: report.totals.present },
      { label: "Atrasos", value: report.totals.late },
      { label: "Faltas", value: report.totals.absent },
      { label: "Canceladas", value: report.totals.cancelledSchedules },
      { label: "Taxa geral", value: `${report.totals.attendanceRate}%` },
    ];
  }, [report]);

  const filteredVolunteerFrequency = useMemo(() => {
    if (!report) {
      return [];
    }

    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return report.frequencyByVolunteer;
    }

    return report.frequencyByVolunteer.filter((row) => {
      return [row.volunteerName, row.ministryName]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [deferredSearch, report]);

  const topOperationalRisks = report?.attendanceExceptions.slice(0, 6) ?? [];
  const topRanking = report?.monthlyRanking.slice(0, 8) ?? [];
  const activeVolunteers = report?.mostActiveVolunteers.slice(0, 6) ?? [];

  const renderVolunteerTable = (rows: VolunteerReportRow[]) => {
    if (rows.length === 0) {
      return (
        <EmptyState
          title="Sem resultados"
          description="Nenhum voluntário corresponde aos filtros atuais."
        />
      );
    }

    return (
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.12em] text-app-200">
            <tr>
              <th className="px-4 py-3">Voluntário</th>
              <th className="px-4 py-3">Ministério</th>
              <th className="px-4 py-3">Escalas</th>
              <th className="px-4 py-3">Confirmado</th>
              <th className="px-4 py-3">Presente</th>
              <th className="px-4 py-3">Atrasado</th>
              <th className="px-4 py-3">Ausente</th>
              <th className="px-4 py-3">Taxa</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.volunteerId}-${row.ministryName}`}
                className="border-t border-white/8"
              >
                <td className="px-4 py-3 text-white">{row.volunteerName}</td>
                <td className="px-4 py-3 text-app-100">{row.ministryName}</td>
                <td className="px-4 py-3 text-app-100">{row.totalSchedules}</td>
                <td className="px-4 py-3 text-brand-100">{row.confirmed}</td>
                <td className="px-4 py-3 text-emerald-300">{row.present}</td>
                <td className="px-4 py-3 text-amber-300">{row.late}</td>
                <td className="px-4 py-3 text-rose-300">{row.absent}</td>
                <td className="px-4 py-3 text-app-100">
                  {row.attendanceRate}%
                </td>
                <td className="px-4 py-3 font-semibold text-brand-100">
                  {row.operationalScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Inteligência Operacional"
        title="Relatórios e Exportação"
        description="Monitore frequência, ranking, faltas, inatividade e cancelamentos com exportação pronta para liderança."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {(["csv", "xlsx", "pdf"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() =>
                  void exportReports(format, {
                    from: from || undefined,
                    to: to || undefined,
                    ministryId: ministryId || undefined,
                    volunteerId: volunteerId || undefined,
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-100 transition hover:bg-brand-500/20"
              >
                <Download className="h-3.5 w-3.5" />
                {format}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-5">
        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Período inicial
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Período final
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Ministério
          <select
            value={ministryId}
            onChange={(event) => setMinistryId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Todos</option>
            {ministries.map((ministry) => (
              <option key={ministry.id} value={ministry.id}>
                {ministry.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Voluntário
          <select
            value={volunteerId}
            onChange={(event) => setVolunteerId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Todos</option>
            {volunteers.map((volunteer) => (
              <option key={volunteer.id} value={volunteer.id}>
                {volunteer.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Busca inteligente
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome do voluntário ou ministério"
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      {kpis ? (
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {kpis.map((kpi) => (
            <article
              key={kpi.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                {kpi.label}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold text-white">
                {kpi.value}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : null}

      {!isLoading && report && report.frequencyByVolunteer.length === 0 ? (
        <EmptyState
          title="Sem dados para o período"
          description="Amplie o intervalo de datas para encontrar escalas e presença."
        />
      ) : null}

      {!isLoading && report && report.frequencyByVolunteer.length > 0 ? (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                  Frequência por voluntário
                </p>
                <h3 className="mt-1 font-display text-2xl text-white">
                  Operação detalhada
                </h3>
              </div>
              {renderVolunteerTable(filteredVolunteerFrequency)}
            </section>

            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                  Top ranking mensal
                </p>
                <h3 className="mt-1 font-display text-2xl text-white">
                  Score e consistência
                </h3>
              </div>
              <div className="space-y-2">
                {topRanking.map((row) => (
                  <article
                    key={`${row.month}-${row.volunteerId}-${row.ministryName}`}
                    className="rounded-2xl border border-white/10 bg-app-900/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {row.volunteerName}
                        </p>
                        <p className="text-xs text-app-200">
                          {row.ministryName} • {row.month}
                        </p>
                      </div>
                      <p className="font-display text-2xl text-brand-100">
                        {row.operationalScore}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                Voluntários mais ativos
              </p>
              <div className="space-y-2">
                {activeVolunteers.map((row) => (
                  <article
                    key={`${row.volunteerId}-${row.ministryName}`}
                    className="rounded-2xl border border-white/10 bg-app-900/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {row.volunteerName}
                        </p>
                        <p className="text-xs text-app-200">
                          {row.ministryName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-300">
                          {row.totalSchedules} escalas
                        </p>
                        <p className="text-xs text-brand-100">
                          Score {row.operationalScore}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                Faltas e atrasos
              </p>
              <div className="space-y-2">
                {topOperationalRisks.length === 0 ? (
                  <EmptyState
                    title="Sem riscos relevantes"
                    description="Nenhum voluntário com faltas ou atrasos no período."
                  />
                ) : (
                  topOperationalRisks.map((row) => (
                    <article
                      key={`${row.volunteerId}-${row.ministryName}`}
                      className="rounded-2xl border border-white/10 bg-app-900/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {row.volunteerName}
                          </p>
                          <p className="text-xs text-app-200">
                            {row.ministryName}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                          {row.riskLevel}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-app-100">
                        Faltas {row.absent} • Atrasos {row.late} • Justificados{" "}
                        {row.justified}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                Voluntários inativos
              </p>
              <div className="space-y-2">
                {report.inactiveVolunteers.length === 0 ? (
                  <EmptyState
                    title="Sem inatividade"
                    description="Todos os voluntários filtrados tiveram atuação no período."
                  />
                ) : (
                  report.inactiveVolunteers.slice(0, 8).map((row) => (
                    <article
                      key={row.volunteerId}
                      className="rounded-2xl border border-white/10 bg-app-900/70 p-3"
                    >
                      <p className="font-semibold text-white">
                        {row.volunteerName}
                      </p>
                      <p className="text-xs text-app-200">{row.email}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-rose-200">
                        {row.status.replaceAll("_", " ")}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                  Frequência por ministério
                </p>
                <h3 className="mt-1 font-display text-2xl text-white">
                  Visão de liderança
                </h3>
              </div>
              <div className="space-y-2">
                {report.frequencyByMinistry.map((row) => (
                  <article
                    key={row.ministryId}
                    className="rounded-2xl border border-white/10 bg-app-900/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {row.ministryName}
                        </p>
                        <p className="text-xs text-app-200">
                          Escalas {row.totalSchedules} • Taxa{" "}
                          {row.attendanceRate}%
                        </p>
                      </div>
                      <p className="font-display text-2xl text-brand-100">
                        {row.operationalScore}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-app-200">
                  Escalas realizadas e canceladas
                </p>
                <h3 className="mt-1 font-display text-2xl text-white">
                  Histórico operacional
                </h3>
              </div>
              <div className="space-y-2">
                {report.completedSchedules.slice(0, 6).map((row) => (
                  <article
                    key={row.eventId}
                    className="rounded-2xl border border-white/10 bg-app-900/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {row.eventName}
                        </p>
                        <p className="text-xs text-app-200">
                          {formatDateTime(row.eventDate)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-300">
                        {row.completedSchedules}/{row.totalSchedules}
                      </p>
                    </div>
                  </article>
                ))}

                {report.cancelledSchedules.slice(0, 4).map((row) => (
                  <article
                    key={row.scheduleId}
                    className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3"
                  >
                    <p className="font-semibold text-white">{row.eventName}</p>
                    <p className="text-xs text-rose-100">
                      {row.volunteerName} • {row.ministryName}
                    </p>
                    <p className="mt-1 text-[11px] text-rose-200">
                      Cancelada em {formatDateTime(row.cancelledAt)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
