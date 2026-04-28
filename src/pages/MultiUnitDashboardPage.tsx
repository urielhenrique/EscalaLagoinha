import { BarChart3, Building2, CalendarRange, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listVisibleChurches } from "../services/churchesApi";
import { getErrorMessage } from "../services/api";
import type { ChurchItem } from "../types/domain";

function Kpi({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-app-850/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-app-300">{icon}</div>
      <p className="text-xs uppercase tracking-[0.08em] text-app-300">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}

export function MultiUnitDashboardPage() {
  const [churches, setChurches] = useState<ChurchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listVisibleChurches();
        setChurches(response.data);
      } catch (err) {
        setError(
          getErrorMessage(err, "Falha ao carregar dashboard multi-unidade."),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const totals = useMemo(() => {
    return churches.reduce(
      (acc, church) => {
        acc.users += church._count?.users ?? 0;
        acc.events += church._count?.events ?? 0;
        acc.ministries += church._count?.ministries ?? 0;
        return acc;
      },
      { users: 0, events: 0, ministries: 0 },
    );
  }, [churches]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-white">
          Dashboard Multi-Unidade
        </h1>
        <p className="text-sm text-app-200">
          Visão consolidada para operação com múltiplas igrejas e expansão SaaS.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-app-200">
          Carregando visão multi-unidade...
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              title="Igrejas"
              value={churches.length}
              icon={<Building2 className="h-5 w-5" />}
            />
            <Kpi
              title="Voluntários"
              value={totals.users}
              icon={<Users className="h-5 w-5" />}
            />
            <Kpi
              title="Eventos"
              value={totals.events}
              icon={<CalendarRange className="h-5 w-5" />}
            />
            <Kpi
              title="Ministérios"
              value={totals.ministries}
              icon={<BarChart3 className="h-5 w-5" />}
            />
          </div>

          <article className="rounded-2xl border border-white/10 bg-app-850/60 p-4">
            <h2 className="text-base font-semibold text-white">
              Unidades ativas
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {churches.map((church) => (
                <div
                  key={church.id}
                  className="rounded-xl border border-white/10 bg-app-900/35 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{church.nome}</p>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                      {church.subscription?.status ?? "TRIAL"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-app-300">
                    {church.cidade ?? "Cidade não informada"} ·{" "}
                    {church.estado ?? "--"}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-app-200">
                    <div className="rounded-lg bg-white/5 px-2 py-1">
                      Users: {church._count?.users ?? 0}
                    </div>
                    <div className="rounded-lg bg-white/5 px-2 py-1">
                      Ministries: {church._count?.ministries ?? 0}
                    </div>
                    <div className="rounded-lg bg-white/5 px-2 py-1">
                      Events: {church._count?.events ?? 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </>
      )}
    </section>
  );
}
