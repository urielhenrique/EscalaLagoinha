import { useEffect, useState } from "react";
import { CheckCircle2, ScanLine } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import {
  checkInAttendance,
  confirmAttendance,
  listMyAttendance,
} from "../services/attendanceApi";
import { getErrorMessage } from "../services/api";
import type { AttendanceItem } from "../types/domain";
import { formatDateTime } from "../utils/date";

const statusLabel: Record<string, string> = {
  CONFIRMADO: "Confirmado",
  PRESENTE: "Presente",
  ATRASADO: "Atrasado",
  AUSENTE: "Ausente",
  JUSTIFICADO: "Justificado",
};

export function CheckInPage() {
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listMyAttendance();
      setAttendance(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível carregar presença."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleConfirm = async (scheduleId: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await confirmAttendance(scheduleId);
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Falha ao confirmar presença."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (scheduleId: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await checkInAttendance(scheduleId);
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Falha ao realizar check-in."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Culto"
        title="Check-in e Presença"
        description="Confirme antecipadamente e faça check-in no dia do culto para fortalecer seu score."
      />

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}

      {!isLoading && attendance.length === 0 ? (
        <EmptyState
          title="Nenhuma presença registrada"
          description="Quando você for escalado e confirmar participação, aparecerá aqui."
        />
      ) : null}

      {!isLoading && attendance.length > 0 ? (
        <div className="space-y-3">
          {attendance.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">
                    {item.schedule.event.nome}
                  </h3>
                  <p className="text-sm text-app-100">
                    {item.schedule.ministry.nome}
                  </p>
                  <p className="mt-1 text-xs text-app-200">
                    {formatDateTime(item.schedule.event.dataInicio)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.12em] text-brand-100">
                    Status: {statusLabel[item.status ?? ""] ?? "Não definido"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleConfirm(item.scheduleId)}
                    disabled={
                      isSubmitting ||
                      item.status === "CONFIRMADO" ||
                      item.status === "PRESENTE"
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-brand-400/35 bg-brand-500/15 px-3 py-2 text-xs font-semibold text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmar presença
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCheckIn(item.scheduleId)}
                    disabled={isSubmitting || item.status === "PRESENTE"}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    Estou presente
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-app-200">
                <span>
                  Confirmação:{" "}
                  {item.confirmedAt
                    ? formatDateTime(item.confirmedAt)
                    : "Pendente"}
                </span>
                <span>
                  Check-in:{" "}
                  {item.checkedInAt
                    ? formatDateTime(item.checkedInAt)
                    : "Pendente"}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
