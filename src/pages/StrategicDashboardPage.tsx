import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Lightbulb,
  Minus,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { getStrategicDashboard } from "../services/executiveDashboardApi";
import type {
  MinistryHealthItem,
  PredictiveAlert,
  StrategicDashboard,
} from "../types/domain";

// ─── helpers ─────────────────────────────────────────────────────────────────

function healthColor(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function healthBg(score: number) {
  if (score >= 75) return "bg-emerald-500/20 border-emerald-500/30";
  if (score >= 50) return "bg-amber-500/20 border-amber-500/30";
  return "bg-red-500/20 border-red-500/30";
}

function healthLabel(score: number) {
  if (score >= 75) return "Saudável";
  if (score >= 50) return "Atenção";
  return "Crítico";
}

function alertIcon(type: PredictiveAlert["type"]) {
  switch (type) {
    case "POSITIVO":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case "RISCO_ALTO":
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    case "SOBRECARGA":
      return <Zap className="h-4 w-4 text-amber-400 shrink-0" />;
    case "DEFICIT":
      return <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />;
    case "EVASAO":
      return <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />;
  }
}

function alertBg(type: PredictiveAlert["type"]) {
  switch (type) {
    case "POSITIVO":
      return "border-emerald-500/30 bg-emerald-500/10";
    case "RISCO_ALTO":
      return "border-red-500/30 bg-red-500/10";
    case "SOBRECARGA":
      return "border-amber-500/30 bg-amber-500/10";
    case "DEFICIT":
      return "border-orange-500/30 bg-orange-500/10";
    case "EVASAO":
      return "border-rose-500/30 bg-rose-500/10";
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-app-800/60 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
          {label}
        </span>
        <div className={`rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-white">{value}</span>
        {delta !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-sm font-medium mb-0.5 ${
              delta > 0
                ? "text-emerald-400"
                : delta < 0
                  ? "text-red-400"
                  : "text-white/40"
            }`}
          >
            {delta > 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : delta < 0 ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-white/40">{sub}</span>}
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="8"
      />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text
        x="40"
        y="44"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="white"
      >
        {score}
      </text>
    </svg>
  );
}

function MinistryCard({ m }: { m: MinistryHealthItem }) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 ${healthBg(m.healthScore)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-white text-sm leading-snug line-clamp-2">
          {m.nome}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${healthBg(m.healthScore)} ${healthColor(m.healthScore)} shrink-0`}
        >
          {healthLabel(m.healthScore)}
        </span>
      </div>

      <div className="flex items-center justify-center">
        <HealthRing score={m.healthScore} />
      </div>

      <div className="grid grid-cols-3 gap-1 text-center">
        {[
          { label: "Presença", value: `${m.attendanceRate}%` },
          { label: "Membros", value: m.memberCount },
          { label: "Trocas", value: `${m.swapRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col">
            <span className="text-white font-semibold text-sm">{value}</span>
            <span className="text-white/40 text-[10px]">{label}</span>
          </div>
        ))}
      </div>

      {m.leaderName && (
        <p className="text-[11px] text-white/40 truncate">
          Líder: {m.leaderName}
        </p>
      )}
    </div>
  );
}

function BarChart({
  data,
  primaryKey,
  secondaryKey,
  primaryColor,
  secondaryColor,
}: {
  data: Array<{ mes: string; [key: string]: unknown }>;
  primaryKey: string;
  secondaryKey?: string;
  primaryColor: string;
  secondaryColor?: string;
}) {
  const maxVal = Math.max(
    ...data.map((d) =>
      Math.max(
        Number(d[primaryKey] ?? 0),
        secondaryKey ? Number(d[secondaryKey] ?? 0) : 0,
      ),
    ),
    1,
  );

  return (
    <div className="flex items-end gap-2 h-32 pt-2">
      {data.map((d) => {
        const primary = Number(d[primaryKey] ?? 0);
        const secondary = secondaryKey ? Number(d[secondaryKey] ?? 0) : null;
        return (
          <div
            key={d.mes}
            className="flex flex-col items-center gap-1 flex-1 min-w-0"
          >
            <div className="flex items-end gap-0.5 flex-1 w-full">
              <div
                className={`rounded-t flex-1 transition-all ${primaryColor}`}
                style={{
                  height: `${(primary / maxVal) * 100}%`,
                  minHeight: primary > 0 ? 4 : 0,
                }}
                title={`${d.mes}: ${primary}`}
              />
              {secondary !== null && (
                <div
                  className={`rounded-t flex-1 transition-all ${secondaryColor}`}
                  style={{
                    height: `${(secondary / maxVal) * 100}%`,
                    minHeight: secondary > 0 ? 4 : 0,
                  }}
                  title={`${d.mes} confirmadas: ${secondary}`}
                />
              )}
            </div>
            <span className="text-[10px] text-white/40 truncate w-full text-center">
              {d.mes.split("/")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function StrategicDashboardPage() {
  const [data, setData] = useState<StrategicDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStrategicDashboard();
      setData(res.data);
    } catch {
      setError("Não foi possível carregar o dashboard estratégico.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Dashboard Estratégico"
          subtitle="Carregando métricas..."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Dashboard Estratégico" />
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-300">{error ?? "Erro desconhecido."}</p>
          <button
            onClick={load}
            className="mt-3 text-sm text-white/60 hover:text-white transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const {
    kpis,
    ministryHealth,
    predictiveAlerts,
    crescimentoMensal,
    frequenciaMensal,
    recommendations,
    overloadedLeaders,
  } = data;

  const positiveAlerts = predictiveAlerts.filter((a) => a.type === "POSITIVO");
  const negativeAlerts = predictiveAlerts.filter((a) => a.type !== "POSITIVO");

  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        title="Dashboard Estratégico"
        subtitle="Inteligência operacional e preditiva para tomada de decisão"
      />

      {/* ── Saúde Operacional — destaque ────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-linear-to-br from-brand-600/20 to-app-800/80 p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <HealthRing score={kpis.operationalHealth} />
          <span
            className={`text-sm font-semibold ${healthColor(kpis.operationalHealth)}`}
          >
            Saúde {healthLabel(kpis.operationalHealth)}
          </span>
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-xl font-bold text-white">
            Saúde Operacional Geral
          </h2>
          <p className="text-white/50 text-sm max-w-lg">
            Score ponderado entre saúde dos ministérios (40%), taxa de presença
            (40%) e cobertura de voluntários (20%).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className="text-center rounded-lg border border-white/10 bg-app-700/40 px-4 py-2">
            <p className="text-lg font-bold text-white">
              {kpis.avgMinistryHealth}%
            </p>
            <p className="text-[11px] text-white/40">Saúde média ministérios</p>
          </div>
          <div className="text-center rounded-lg border border-white/10 bg-app-700/40 px-4 py-2">
            <p className="text-lg font-bold text-white">
              {kpis.overallAttendanceRate}%
            </p>
            <p className="text-[11px] text-white/40">Taxa de presença</p>
          </div>
        </div>
      </div>

      {/* ── KPIs grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Voluntários Ativos"
          value={kpis.totalActiveVolunteers}
          sub={`${kpis.newThisMonth} novos este mês`}
          delta={kpis.growthDelta}
          icon={Users}
          accent="bg-brand-500/20 text-brand-400"
        />
        <KpiCard
          label="Taxa de Retenção"
          value={`${kpis.retentionRate}%`}
          sub="últimos 60 dias"
          icon={Shield}
          accent="bg-indigo-500/20 text-indigo-400"
        />
        <KpiCard
          label="Taxa de Presença"
          value={`${kpis.overallAttendanceRate}%`}
          sub="últimos 90 dias"
          icon={Activity}
          accent="bg-cyan-500/20 text-cyan-400"
        />
        <KpiCard
          label="Ministérios"
          value={kpis.totalMinistries}
          sub={`${kpis.pendingApprovals} aprovações pendentes`}
          icon={BarChart3}
          accent="bg-violet-500/20 text-violet-400"
        />
      </div>

      {/* ── Alertas preditivos ───────────────────────────────────────── */}
      {predictiveAlerts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Alertas Preditivos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {positiveAlerts.map((alert, i) => (
              <div
                key={`pos-${i}`}
                className={`flex items-start gap-3 rounded-xl border p-4 ${alertBg(alert.type)}`}
              >
                {alertIcon(alert.type)}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {alert.titulo}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {alert.descricao}
                  </p>
                </div>
              </div>
            ))}
            {negativeAlerts.map((alert, i) => (
              <div
                key={`neg-${i}`}
                className={`flex items-start gap-3 rounded-xl border p-4 ${alertBg(alert.type)}`}
              >
                {alertIcon(alert.type)}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {alert.titulo}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {alert.descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Saúde por Ministério ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-400" />
          Saúde por Ministério
        </h3>
        {ministryHealth.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-app-800/60 p-8 text-center text-white/40">
            Nenhum ministério encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ministryHealth.map((m) => (
              <MinistryCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>

      {/* ── Gráficos ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Crescimento mensal */}
        <div className="rounded-xl border border-white/10 bg-app-800/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-400" />
              Novos Voluntários / Mês
            </h4>
          </div>
          <BarChart
            data={crescimentoMensal}
            primaryKey="novos"
            primaryColor="bg-brand-500"
          />
        </div>

        {/* Frequência mensal */}
        <div className="rounded-xl border border-white/10 bg-app-800/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Escalas Agendadas vs Confirmadas
            </h4>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm bg-cyan-500/60 inline-block" />
              Agendadas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm bg-emerald-500/60 inline-block" />
              Confirmadas
            </span>
          </div>
          <BarChart
            data={frequenciaMensal}
            primaryKey="escaladas"
            secondaryKey="confirmadas"
            primaryColor="bg-cyan-500/60"
            secondaryColor="bg-emerald-500/60"
          />
        </div>
      </div>

      {/* ── Líderes sobrecarregados ──────────────────────────────────── */}
      {overloadedLeaders.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Líderes com Alta Carga
          </h3>
          <div className="rounded-xl border border-white/10 bg-app-800/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">
                    Líder
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase">
                    Escalas (90d)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {overloadedLeaders.map((l) => (
                  <tr
                    key={l.leaderId}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {l.nome}
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {l.escalasGerenciadas}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Sobrecarga
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Recomendações estratégicas ───────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-400" />
          Recomendações Estratégicas
        </h3>
        <div className="space-y-2">
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-app-800/60 p-4"
            >
              <ChevronRight className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-sm text-white/80">{rec}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <p className="text-xs text-white/30 text-right flex items-center justify-end gap-1">
        <Info className="h-3 w-3" />
        Dados dos últimos 90 dias — atualizado em{" "}
        {new Date(data.generatedAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
