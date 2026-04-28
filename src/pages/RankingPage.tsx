import { Flame, Medal, ShieldAlert, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { getRanking } from "../services/executiveDashboardApi";
import type { RankingResponse } from "../types/domain";

const statusClasses = {
  ALTO: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
  MODERADO: "border-cyan-400/30 bg-cyan-500/15 text-cyan-100",
  BAIXO: "border-amber-400/30 bg-amber-500/15 text-amber-100",
  CRITICO: "border-rose-400/30 bg-rose-500/15 text-rose-100",
} as const;

export function RankingPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<RankingResponse | null>(null);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getRanking(50);
        setPayload(response.data);
      } catch (requestError) {
        setError(
          getErrorMessage(requestError, "Nao foi possivel carregar o ranking."),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Gamificacao"
        title="Ranking de Voluntarios"
        description="Score geral, badges e engajamento em tempo real para motivar toda a equipe."
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!isLoading && payload && payload.ranking.length === 0 ? (
        <EmptyState
          title="Sem voluntarios no ranking"
          description="Cadastre e ative voluntarios para gerar pontuacao e gamificacao."
        />
      ) : null}

      {!isLoading && payload && payload.ranking.length > 0 ? (
        <>
          {payload.myPosition && user ? (
            <article className="rounded-2xl border border-brand-300/30 bg-brand-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-brand-100/80">
                Seu destaque
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <p className="inline-flex items-center gap-2 text-xl font-semibold text-brand-100">
                  <Trophy className="h-5 w-5" />#{payload.myPosition.rank}
                </p>
                <p className="text-sm text-brand-100/90">
                  {payload.myPosition.nome} · Score{" "}
                  {payload.myPosition.scoreGeral}
                </p>
                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                    statusClasses[payload.myPosition.statusEngajamento],
                  ].join(" ")}
                >
                  {payload.myPosition.statusEngajamento}
                </span>
              </div>
            </article>
          ) : null}

          <div className="space-y-3 md:hidden">
            {payload.ranking.map((item) => (
              <article
                key={item.volunteerId}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.nome}
                    </p>
                    <p className="text-xs text-app-200">
                      {item.ministerios.join(", ")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white">
                    #{item.rank}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <p className="rounded-lg border border-white/10 bg-app-900/60 px-2 py-2 text-app-200">
                    Score{" "}
                    <span className="ml-1 font-semibold text-brand-100">
                      {item.scoreGeral}
                    </span>
                  </p>
                  <p className="rounded-lg border border-white/10 bg-app-900/60 px-2 py-2 text-app-200">
                    Freq.{" "}
                    <span className="ml-1 font-semibold text-white">
                      {item.frequenciaMensal}%
                    </span>
                  </p>
                  <p className="rounded-lg border border-white/10 bg-app-900/60 px-2 py-2 text-app-200">
                    Confirm.{" "}
                    <span className="ml-1 font-semibold text-white">
                      {item.taxaConfirmacao}%
                    </span>
                  </p>
                  <div className="rounded-lg border border-white/10 bg-app-900/60 px-2 py-2">
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        statusClasses[item.statusEngajamento],
                      ].join(" ")}
                    >
                      {item.statusEngajamento}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
            <div className="overflow-x-auto">
              <table className="table-touch min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-app-200">
                  <tr>
                    <th className="px-4 py-3">Posicao</th>
                    <th className="px-4 py-3">Voluntario</th>
                    <th className="px-4 py-3 text-right">Score</th>
                    <th className="px-4 py-3 text-right">Frequencia mes</th>
                    <th className="px-4 py-3 text-right">Confirmacao</th>
                    <th className="px-4 py-3 text-right">Engajamento</th>
                    <th className="px-4 py-3">Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {payload.ranking.map((item) => (
                    <tr key={item.volunteerId} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold text-white">
                          {item.rank <= 3 ? (
                            <Medal className="h-3.5 w-3.5 text-amber-200" />
                          ) : null}
                          #{item.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{item.nome}</p>
                        <p className="text-xs text-app-200">
                          {item.ministerios.join(", ")}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-brand-400/30 bg-brand-500/15 px-2 py-1 font-semibold text-brand-100">
                          <Flame className="h-3.5 w-3.5" />
                          {item.scoreGeral}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-app-100">
                        {item.frequenciaMensal}%
                      </td>
                      <td className="px-4 py-3 text-right text-app-100">
                        {item.taxaConfirmacao}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={[
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                            statusClasses[item.statusEngajamento],
                          ].join(" ")}
                        >
                          {item.statusEngajamento}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.badges.length > 0 ? (
                            item.badges.map((badge) => (
                              <span
                                key={`${item.volunteerId}-${badge}`}
                                className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[11px] text-app-100"
                              >
                                {badge}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-app-300">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Sem badge
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-app-300">
            Total avaliado: {payload.totalVoluntarios} voluntarios.
          </p>
        </>
      ) : null}
    </section>
  );
}
