import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  Gauge,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { DonutDistributionChart } from "../components/ui/charts/DonutDistributionChart";
import { DualStackBarChart } from "../components/ui/charts/DualStackBarChart";
import { MiniBarChart } from "../components/ui/charts/MiniBarChart";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import {
  getAdminExecutiveDashboard,
  getVolunteerExecutiveDashboard,
} from "../services/executiveDashboardApi";
import type {
  AdminExecutiveDashboard,
  RankingItem,
  VolunteerExecutiveDashboard,
} from "../types/domain";
import { formatDateTime } from "../utils/date";

function engagementClass(status: RankingItem["statusEngajamento"]) {
  if (status === "ALTO") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "MODERADO") {
    return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
  }

  if (status === "BAIXO") {
    return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  }

  return "border-rose-400/30 bg-rose-500/15 text-rose-100";
}

function KpiCard(props: {
  title: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const Icon = props.icon;

  return (
    <article className="rounded-2xl border border-white/10 bg-linear-to-b from-white/8 to-white/4 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-app-200/80">
          {props.title}
        </p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-400/35 bg-brand-500/15 text-brand-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display text-2xl font-semibold text-white">
        {props.value}
      </p>
      <p className="mt-1 text-sm text-app-200">{props.detail}</p>
    </article>
  );
}

function RankingTable({ title, rows }: { title: string; rows: RankingItem[] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="table-touch min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-app-200">
            <tr>
              <th className="px-4 py-3">Voluntario</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Confirmacao</th>
              <th className="px-4 py-3 text-right">Engajamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {rows.map((item) => (
              <tr key={item.volunteerId} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{item.nome}</p>
                  <p className="text-xs text-app-200">#{item.rank}</p>
                </td>
                <td className="px-4 py-3 text-right text-brand-100">
                  {item.scoreGeral}
                </td>
                <td className="px-4 py-3 text-right text-app-100">
                  {item.taxaConfirmacao}%
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                      engagementClass(item.statusEngajamento),
                    ].join(" ")}
                  >
                    {item.statusEngajamento}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.perfil === "ADMIN";

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [adminData, setAdminData] = useState<AdminExecutiveDashboard | null>(
    null,
  );
  const [volunteerData, setVolunteerData] =
    useState<VolunteerExecutiveDashboard | null>(null);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (isAdmin) {
          const response = await getAdminExecutiveDashboard();
          setAdminData(response.data);
          setVolunteerData(null);
        } else {
          const response = await getVolunteerExecutiveDashboard();
          setVolunteerData(response.data);
          setAdminData(null);
        }
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Nao foi possivel carregar o dashboard.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [isAdmin, refreshSeed]);

  const topScoreEvolution = useMemo(() => {
    if (!adminData || adminData.graficos.evolucaoScore.length === 0) {
      return [] as Array<{ label: string; value: number }>;
    }

    const first = adminData.graficos.evolucaoScore[0];
    return first.pontos.map((point) => ({
      label: point.mes,
      value: point.valor,
    }));
  }, [adminData]);

  const showFirstUseChecklist =
    isAdmin &&
    adminData &&
    (adminData.kpis.escalasDoMes === 0 ||
      adminData.kpis.totalVoluntariosAtivos <= 1 ||
      adminData.kpis.solicitacoesPendentes === 0);

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow={isAdmin ? "Executive Dashboard" : "Meu Painel"}
        title={
          isAdmin ? "Visao executiva da operacao" : "Seu desempenho voluntario"
        }
        description={
          isAdmin
            ? "Indicadores estrategicos, ranking gamificado e alertas inteligentes em uma unica visao SaaS."
            : "Acompanhe sua evolucao, score pessoal e proximas escalas com insights objetivos."
        }
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/ranking")}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20"
            >
              <Trophy className="h-4 w-4" />
              Ver ranking completo
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRefreshSeed((s) => s + 1)}
              disabled={isLoading}
              aria-label="Atualizar dashboard"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-app-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              <RefreshCw
                className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(
                  " ",
                )}
              />
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-36" />
          <Skeleton className="h-44" />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!isLoading && isAdmin && adminData ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              title="Voluntarios ativos"
              value={`${adminData.kpis.totalVoluntariosAtivos}`}
              detail="Base operacional atual"
              icon={Users}
            />
            <KpiCard
              title="Escalas do mes"
              value={`${adminData.kpis.escalasDoMes}`}
              detail="Volume de execucao mensal"
              icon={CalendarClock}
            />
            <KpiCard
              title="Solicitacoes pendentes"
              value={`${adminData.kpis.solicitacoesPendentes}`}
              detail="Trocas aguardando decisao"
              icon={AlertTriangle}
            />
          </div>

          {showFirstUseChecklist ? (
            <article className="rounded-2xl border border-brand-400/25 bg-brand-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-100">
                Primeiros passos
              </p>
              <h3 className="mt-1 text-sm font-semibold text-white">
                Sua operação está em fase inicial. Complete o checklist:
              </h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Link
                  to="/eventos"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-100 transition hover:bg-white/10"
                >
                  1) Criar eventos de culto
                </Link>
                <Link
                  to="/gestao-escalas"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-100 transition hover:bg-white/10"
                >
                  2) Publicar as primeiras escalas
                </Link>
                <Link
                  to="/igreja/configuracoes"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-100 transition hover:bg-white/10"
                >
                  3) Gerar link de convite para voluntários
                </Link>
                <Link
                  to="/aprovacao-voluntarios"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-100 transition hover:bg-white/10"
                >
                  4) Aprovar e ativar novos cadastros
                </Link>
              </div>
            </article>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <MiniBarChart
              title="Frequencia por mes"
              points={adminData.graficos.frequenciaPorMes.map((item) => ({
                label: item.mes,
                value: item.valor,
              }))}
            />
            <DualStackBarChart
              title="Presenca por ministerio"
              rows={adminData.graficos.presencaPorMinisterio.map((item) => ({
                label: item.ministerio,
                primary: item.confirmado,
                secondary: item.cancelado,
              }))}
              primaryLabel="Confirmado"
              secondaryLabel="Cancelado"
            />
            <DonutDistributionChart
              title="Distribuicao de escalas"
              data={adminData.graficos.distribuicaoEscalas}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
            <RankingTable title="Ranking geral" rows={adminData.rankingGeral} />

            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <BrainCircuit className="h-4 w-4 text-brand-200" />
                Insights da IA
              </h3>

              <ul className="mt-3 space-y-2 text-sm text-app-100">
                {adminData.insightsIa.local.map((line) => (
                  <li
                    key={line}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-3 rounded-xl border border-brand-300/25 bg-brand-500/10 px-3 py-2 text-xs text-brand-100">
                {adminData.insightsIa.ai ||
                  "Sem API key ativa. Motor local heuristico em uso."}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-app-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-app-200/80">
                  Evolucao de score (lider)
                </p>
                {topScoreEvolution.length > 0 ? (
                  <div className="mt-2 flex items-end gap-2">
                    {topScoreEvolution.map((point) => (
                      <div key={point.label} className="flex-1 text-center">
                        <div className="h-20 rounded-md bg-app-900/80 p-1">
                          <div
                            className="mt-auto rounded-sm bg-brand-300/85"
                            style={{
                              height: `${Math.max(6, Math.min(100, (point.value + 8) * 8))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-app-300">
                          {point.label}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-app-300">
                    Sem dados suficientes.
                  </p>
                )}
              </div>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-rose-100/80">
                Risco de ausencia
              </p>
              <ul className="mt-2 space-y-2 text-sm text-rose-100">
                {adminData.alertas.riscoAusencia.slice(0, 4).map((item) => (
                  <li key={item.volunteerId}>{item.nome}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-100/80">
                Sobrecarga
              </p>
              <ul className="mt-2 space-y-2 text-sm text-amber-100">
                {adminData.alertas.sobrecarregados.slice(0, 4).map((item) => (
                  <li key={item.volunteerId}>{item.nome}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-sky-100/80">
                Pouco escalados
              </p>
              <ul className="mt-2 space-y-2 text-sm text-sky-100">
                {adminData.alertas.poucoEscalados.slice(0, 4).map((item) => (
                  <li key={item.volunteerId}>{item.nome}</li>
                ))}
              </ul>
            </article>
          </div>
        </>
      ) : null}

      {!isLoading && !isAdmin && volunteerData ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              title="Score pessoal"
              value={`${volunteerData.scorePessoal.scoreGeral}`}
              detail={`Badge atual: ${volunteerData.badgeAtual}`}
              icon={Sparkles}
            />
            <KpiCard
              title="Ranking pessoal"
              value={`#${volunteerData.rankingPessoal.posicao}`}
              detail={`entre ${volunteerData.rankingPessoal.total} voluntarios`}
              icon={Trophy}
            />
            <KpiCard
              title="Frequencia mensal"
              value={`${volunteerData.frequenciaMensal}%`}
              detail="Aderencia nas escalas do mes"
              icon={Gauge}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <MiniBarChart
              title="Frequencia por mes"
              points={volunteerData.graficos.frequenciaPorMes.map((item) => ({
                label: item.mes,
                value: item.valor,
              }))}
              valueSuffix="%"
            />
            <DualStackBarChart
              title="Presenca por ministerio"
              rows={volunteerData.graficos.presencaPorMinisterio.map(
                (item) => ({
                  label: item.ministerio,
                  primary: item.confirmado,
                  secondary: item.cancelado,
                }),
              )}
              primaryLabel="Confirmado"
              secondaryLabel="Cancelado"
            />
            <DonutDistributionChart
              title="Distribuicao de escalas"
              data={volunteerData.graficos.distribuicaoEscalas}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold text-white">
                Proxima escala
              </h3>

              {volunteerData.proximaEscala ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-app-900/60 p-3">
                  <p className="font-medium text-white">
                    {volunteerData.proximaEscala.event.nome}
                  </p>
                  <p className="text-sm text-app-200">
                    {volunteerData.proximaEscala.ministry.nome} ·{" "}
                    {formatDateTime(
                      volunteerData.proximaEscala.event.dataInicio,
                    )}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-app-300">
                  Nenhuma proxima escala encontrada.
                </p>
              )}

              <h4 className="mt-4 text-xs uppercase tracking-[0.12em] text-app-200/80">
                Historico recente
              </h4>
              <ul className="mt-2 space-y-2">
                {volunteerData.historicoRecente.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-100"
                  >
                    {item.event.nome} · {item.ministry.nome}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Activity className="h-4 w-4 text-brand-200" />
                Sugestoes da IA
              </h3>

              <ul className="mt-3 space-y-2 text-sm text-app-100">
                {volunteerData.sugestoesIa.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-xl border border-white/10 bg-app-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-app-200/80">
                  Evolucao de score
                </p>
                <div className="mt-2 flex items-end gap-2">
                  {volunteerData.graficos.evolucaoScore.map((point) => (
                    <div key={point.mes} className="flex-1 text-center">
                      <div className="h-20 rounded-md bg-app-900/80 p-1">
                        <div
                          className="mt-auto rounded-sm bg-brand-300/85"
                          style={{
                            height: `${Math.max(6, Math.min(100, (point.valor + 8) * 8))}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-app-300">
                        {point.mes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </>
      ) : null}

      {!isLoading && !adminData && !volunteerData && !error ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Dados indisponiveis no momento.
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="fixed bottom-22 right-4 inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-3 py-2 text-xs text-brand-100 sm:bottom-4">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Carregando inteligencia executiva...
        </div>
      ) : null}
    </section>
  );
}
