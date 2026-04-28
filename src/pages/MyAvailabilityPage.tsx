import { useEffect, useMemo, useState } from "react";
import { CalendarX2, Sparkles, Save, Trash2 } from "lucide-react";
import { SectionHeader } from "../components/ui/SectionHeader";
import { getErrorMessage } from "../services/api";
import {
  addBlockedDate,
  getMyAvailability,
  removeBlockedDate,
  saveMinistryPreferences,
  saveWeeklyAvailability,
} from "../services/availabilityApi";
import { listVisibleMinistries } from "../services/ministriesApi";
import type {
  AvailabilityDayOfWeek,
  AvailabilityPeriod,
  AvailabilityPreference,
  BlockedDateItem,
  MinistryItem,
} from "../types/domain";
import { formatDate } from "../utils/date";

type SlotValue = AvailabilityPreference | "NAO_DEFINIDO";

const dayOptions: Array<{ value: AvailabilityDayOfWeek; label: string }> = [
  { value: "SEGUNDA", label: "Segunda" },
  { value: "TERCA", label: "Terça" },
  { value: "QUARTA", label: "Quarta" },
  { value: "QUINTA", label: "Quinta" },
  { value: "SEXTA", label: "Sexta" },
  { value: "SABADO", label: "Sábado" },
  { value: "DOMINGO", label: "Domingo" },
];

const periodOptions: Array<{ value: AvailabilityPeriod; label: string }> = [
  { value: "MANHA", label: "Manhã" },
  { value: "TARDE", label: "Tarde" },
  { value: "NOITE", label: "Noite" },
];

function slotKey(day: AvailabilityDayOfWeek, period: AvailabilityPeriod) {
  return `${day}:${period}`;
}

const preferenceStyles: Record<SlotValue, string> = {
  NAO_DEFINIDO: "border-white/10 bg-app-850 text-app-200",
  DISPONIVEL: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  PREFERENCIAL: "border-brand-400/30 bg-brand-500/15 text-brand-100",
  INDISPONIVEL: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

function preferenceLabel(value: SlotValue) {
  if (value === "NAO_DEFINIDO") return "Não definido";
  if (value === "DISPONIVEL") return "Disponível";
  if (value === "PREFERENCIAL") return "Preferencial";
  return "Indisponível";
}

export function MyAvailabilityPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWeekly, setIsSavingWeekly] = useState(false);
  const [isSavingMinistry, setIsSavingMinistry] = useState(false);
  const [isAddingBlocked, setIsAddingBlocked] = useState(false);

  const [slotMap, setSlotMap] = useState<Record<string, SlotValue>>({});
  const [blockedDates, setBlockedDates] = useState<BlockedDateItem[]>([]);
  const [ministries, setMinistries] = useState<MinistryItem[]>([]);
  const [preferredMinistryIds, setPreferredMinistryIds] = useState<string[]>(
    [],
  );
  const [unavailableMinistryIds, setUnavailableMinistryIds] = useState<
    string[]
  >([]);

  const [blockedDate, setBlockedDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const conflictingMinistries = useMemo(() => {
    return preferredMinistryIds.filter((id) =>
      unavailableMinistryIds.includes(id),
    );
  }, [preferredMinistryIds, unavailableMinistryIds]);

  const summary = useMemo(() => {
    const values = Object.values(slotMap);
    const disponiveis = values.filter((item) => item === "DISPONIVEL").length;
    const preferenciais = values.filter(
      (item) => item === "PREFERENCIAL",
    ).length;
    const indisponiveis = values.filter(
      (item) => item === "INDISPONIVEL",
    ).length;

    return {
      disponiveis,
      preferenciais,
      indisponiveis,
      bloqueios: blockedDates.length,
    };
  }, [blockedDates.length, slotMap]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [availabilityRes, ministriesRes] = await Promise.all([
          getMyAvailability(),
          listVisibleMinistries(),
        ]);

        setMinistries(ministriesRes.data);
        setBlockedDates(availabilityRes.data.blockedDates);

        const map: Record<string, SlotValue> = {};
        for (const day of dayOptions) {
          for (const period of periodOptions) {
            map[slotKey(day.value, period.value)] = "NAO_DEFINIDO";
          }
        }

        for (const slot of availabilityRes.data.weekly) {
          map[slotKey(slot.dayOfWeek, slot.period)] = slot.preference;
        }

        setSlotMap(map);

        const preferred = availabilityRes.data.ministryPreferences
          .filter((item) => item.type === "PREFERENCIAL")
          .map((item) => item.ministryId);
        const unavailable = availabilityRes.data.ministryPreferences
          .filter((item) => item.type === "INDISPONIVEL")
          .map((item) => item.ministryId);

        setPreferredMinistryIds(preferred);
        setUnavailableMinistryIds(unavailable);
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            "Não foi possível carregar sua disponibilidade.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const handleWeeklySave = async () => {
    setIsSavingWeekly(true);
    setError(null);
    setSuccess(null);

    try {
      const slots = Object.entries(slotMap)
        .filter(([, value]) => value !== "NAO_DEFINIDO")
        .map(([key, value]) => {
          const [dayOfWeek, period] = key.split(":") as [
            AvailabilityDayOfWeek,
            AvailabilityPeriod,
          ];
          return {
            dayOfWeek,
            period,
            preference: value as AvailabilityPreference,
          };
        });

      await saveWeeklyAvailability({ slots });
      setSuccess("Disponibilidade semanal salva com sucesso.");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível salvar a disponibilidade semanal.",
        ),
      );
    } finally {
      setIsSavingWeekly(false);
    }
  };

  const applyPresetCulto = () => {
    const next = { ...slotMap };
    next[slotKey("DOMINGO", "NOITE")] = "PREFERENCIAL";
    next[slotKey("QUARTA", "NOITE")] = "DISPONIVEL";
    setSlotMap(next);
  };

  const clearWeekly = () => {
    const next: Record<string, SlotValue> = {};
    for (const day of dayOptions) {
      for (const period of periodOptions) {
        next[slotKey(day.value, period.value)] = "NAO_DEFINIDO";
      }
    }
    setSlotMap(next);
  };

  const handleMinistrySave = async () => {
    setIsSavingMinistry(true);
    setError(null);
    setSuccess(null);

    if (conflictingMinistries.length > 0) {
      setError(
        "Um mesmo ministério não pode estar em preferencial e indisponível.",
      );
      setIsSavingMinistry(false);
      return;
    }

    try {
      await saveMinistryPreferences({
        preferredMinistryIds,
        unavailableMinistryIds,
      });
      setSuccess("Preferências de ministério atualizadas com sucesso.");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível salvar preferências de ministério.",
        ),
      );
    } finally {
      setIsSavingMinistry(false);
    }
  };

  const handleAddBlockedDate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!blockedDate || !blockedReason) {
      setError("Informe data e motivo para bloquear.");
      return;
    }

    setIsAddingBlocked(true);

    try {
      const response = await addBlockedDate({
        date: blockedDate,
        reason: blockedReason,
      });
      setBlockedDates((current) => [...current, response.data]);
      setBlockedDate("");
      setBlockedReason("");
      setSuccess("Data bloqueada adicionada com sucesso.");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível adicionar data bloqueada.",
        ),
      );
    } finally {
      setIsAddingBlocked(false);
    }
  };

  const handleRemoveBlockedDate = async (id: string) => {
    setError(null);
    setSuccess(null);

    try {
      await removeBlockedDate(id);
      setBlockedDates((current) => current.filter((item) => item.id !== id));
      setSuccess("Data bloqueada removida com sucesso.");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível remover data bloqueada.",
        ),
      );
    }
  };

  const toggleIn = (array: string[], id: string) => {
    return array.includes(id)
      ? array.filter((current) => current !== id)
      : [...array, id];
  };

  return (
    <section className="space-y-6 pb-6">
      <SectionHeader
        eyebrow="Disponibilidade"
        title="Minha Disponibilidade"
        description="Defina dias e horários disponíveis, bloqueie datas específicas e configure preferência por ministério."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-200/90">
            Disponível
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-100">
            {summary.disponiveis}
          </p>
        </article>
        <article className="rounded-2xl border border-brand-400/20 bg-brand-500/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-100/90">
            Preferencial
          </p>
          <p className="mt-1 text-2xl font-semibold text-brand-100">
            {summary.preferenciais}
          </p>
        </article>
        <article className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-rose-200/90">
            Indisponível
          </p>
          <p className="mt-1 text-2xl font-semibold text-rose-100">
            {summary.indisponiveis}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-app-300">
            Datas bloqueadas
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {summary.bloqueios}
          </p>
        </article>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-app-200">
          Carregando disponibilidade...
        </div>
      ) : (
        <>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">
                Grade semanal
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyPresetCulto}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-app-100 transition hover:bg-white/12"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Preset culto
                </button>
                <button
                  type="button"
                  onClick={clearWeekly}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-app-100 transition hover:bg-white/12"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => void handleWeeklySave()}
                  disabled={isSavingWeekly}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSavingWeekly ? "Salvando..." : "Salvar grade"}
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-2 text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left text-xs uppercase tracking-[0.12em] text-app-300">
                      Dia
                    </th>
                    {periodOptions.map((period) => (
                      <th
                        key={period.value}
                        className="px-2 py-2 text-left text-xs uppercase tracking-[0.12em] text-app-300"
                      >
                        {period.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayOptions.map((day) => (
                    <tr key={day.value}>
                      <td className="px-2 py-2 font-semibold text-app-100">
                        {day.label}
                      </td>
                      {periodOptions.map((period) => {
                        const key = slotKey(day.value, period.value);
                        return (
                          <td key={key} className="px-2 py-2">
                            <select
                              value={slotMap[key] ?? "NAO_DEFINIDO"}
                              onChange={(event) =>
                                setSlotMap((current) => ({
                                  ...current,
                                  [key]: event.target.value as SlotValue,
                                }))
                              }
                              className={[
                                "w-full rounded-lg border px-2 py-2 text-xs outline-none",
                                preferenceStyles[
                                  slotMap[key] ?? "NAO_DEFINIDO"
                                ],
                              ].join(" ")}
                            >
                              <option value="NAO_DEFINIDO">Não definido</option>
                              <option value="DISPONIVEL">Disponível</option>
                              <option value="PREFERENCIAL">Preferencial</option>
                              <option value="INDISPONIVEL">Indisponível</option>
                            </select>
                            <p className="mt-1 text-[10px] text-app-300">
                              {preferenceLabel(slotMap[key] ?? "NAO_DEFINIDO")}
                            </p>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">
                Preferência de ministério
              </h2>
              <button
                type="button"
                onClick={() => void handleMinistrySave()}
                disabled={isSavingMinistry}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {isSavingMinistry ? "Salvando..." : "Salvar preferências"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ministries.map((ministry) => {
                const preferred = preferredMinistryIds.includes(ministry.id);
                const unavailable = unavailableMinistryIds.includes(
                  ministry.id,
                );

                return (
                  <article
                    key={ministry.id}
                    className="rounded-xl border border-white/10 bg-app-850/65 p-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      {ministry.nome}
                    </p>
                    <p className="mt-1 text-xs text-app-300 line-clamp-2">
                      {ministry.descricao || "Sem descrição cadastrada."}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPreferredMinistryIds((current) =>
                            toggleIn(current, ministry.id),
                          )
                        }
                        className={[
                          "rounded-lg border px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition",
                          preferred
                            ? "border-brand-400/40 bg-brand-500/20 text-brand-100"
                            : "border-white/15 bg-white/5 text-app-200 hover:bg-white/10",
                        ].join(" ")}
                      >
                        Preferencial
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setUnavailableMinistryIds((current) =>
                            toggleIn(current, ministry.id),
                          )
                        }
                        className={[
                          "rounded-lg border px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition",
                          unavailable
                            ? "border-rose-400/40 bg-rose-500/20 text-rose-200"
                            : "border-white/15 bg-white/5 text-app-200 hover:bg-white/10",
                        ].join(" ")}
                      >
                        Indisponível
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-app-300">
              Toque simples: cada ministério permite marcar preferencial ou
              indisponível sem abrir multiselect.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 font-display text-lg font-semibold text-white">
              Datas específicas bloqueadas
            </h2>

            <form
              onSubmit={handleAddBlockedDate}
              className="mb-4 grid gap-3 md:grid-cols-[180px_1fr_auto]"
            >
              <input
                type="date"
                value={blockedDate}
                onChange={(event) => setBlockedDate(event.target.value)}
                className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
              />
              <input
                type="text"
                value={blockedReason}
                onChange={(event) => setBlockedReason(event.target.value)}
                placeholder="Motivo (férias, viagem, compromisso pessoal...)"
                className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
              />
              <button
                type="submit"
                disabled={isAddingBlocked}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
              >
                <CalendarX2 className="h-3.5 w-3.5" />
                {isAddingBlocked ? "Adicionando..." : "Bloquear"}
              </button>
            </form>

            {blockedDates.length === 0 ? (
              <p className="text-sm text-app-300">
                Nenhuma data bloqueada até o momento.
              </p>
            ) : (
              <ul className="space-y-2">
                {blockedDates
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-app-850/65 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {formatDate(item.date)}
                        </p>
                        <p className="text-xs text-app-200">{item.reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveBlockedDate(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </article>
        </>
      )}
    </section>
  );
}
