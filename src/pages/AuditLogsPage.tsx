import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { getErrorMessage } from "../services/api";
import { listAuditLogs } from "../services/auditLogsApi";
import type { AuditLogItem } from "../types/domain";
import { formatDateTime } from "../utils/date";

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const getAuditSummary = (log: AuditLogItem) => {
    const actor = log.user?.nome ?? "Sistema";
    const action = log.action.replaceAll("_", " ").toLowerCase();
    const moduleName = log.module.replaceAll("_", " ").toLowerCase();

    return `${actor} executou ${action} no módulo ${moduleName}.`;
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listAuditLogs({
        module: moduleFilter || undefined,
        action: actionFilter || undefined,
        search: searchFilter || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 200,
      });
      setLogs(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível carregar os logs."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [moduleFilter, actionFilter, searchFilter, from, to]);

  const modules = useMemo(() => {
    return Array.from(new Set(logs.map((item) => item.module))).sort();
  }, [logs]);

  const kpis = useMemo(() => {
    return [
      { label: "Logs", value: logs.length },
      {
        label: "Módulos",
        value: new Set(logs.map((item) => item.module)).size,
      },
      {
        label: "Autores",
        value: new Set(logs.map((item) => item.user?.id).filter(Boolean)).size,
      },
    ];
  }, [logs]);

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Compliance"
        title="Auditoria Administrativa"
        description="Rastreie ações críticas com autoria, módulo, estado anterior e novo estado."
      />

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-5">
        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Módulo
          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Todos</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200 md:col-span-2">
          Ação (contém)
          <input
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
            placeholder="Ex.: USER_APPROVED, SCHEDULE_UPDATED"
          />
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Busca
          <input
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
            placeholder="Autor, e-mail, target"
          />
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          De
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Até
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
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

      {!isLoading && logs.length === 0 ? (
        <EmptyState
          title="Sem logs para os filtros"
          description="Ajuste os filtros para visualizar eventos de auditoria."
        />
      ) : null}

      {!isLoading && logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => (
            <article
              key={log.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-app-200">
                  <span className="rounded-full border border-brand-400/30 bg-brand-500/15 px-2 py-0.5 text-brand-100">
                    {log.module}
                  </span>
                  <span>{log.action}</span>
                </div>
                <span className="text-xs text-app-200">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>

              <p className="mt-2 text-sm text-app-100">
                Autor: {log.user?.nome ?? "Sistema"} ({log.user?.email ?? "n/a"}
                )
              </p>
              <p className="mt-2 text-sm text-white">{getAuditSummary(log)}</p>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-app-900/80 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-app-200">
                    Estado Anterior
                  </p>
                  <pre className="mt-1 max-h-40 overflow-auto text-xs text-app-100">
                    {JSON.stringify(log.oldValue ?? {}, null, 2)}
                  </pre>
                </div>

                <div className="rounded-xl border border-white/10 bg-app-900/80 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-app-200">
                    Novo Estado
                  </p>
                  <pre className="mt-1 max-h-40 overflow-auto text-xs text-app-100">
                    {JSON.stringify(log.newValue ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
