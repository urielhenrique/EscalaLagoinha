import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import {
  listAttendanceByEvent,
  markAttendanceStatus,
} from "../services/attendanceApi";
import { getErrorMessage } from "../services/api";
import { listEvents } from "../services/eventsApi";
import type {
  AttendanceItem,
  AttendanceStatus,
  EventItem,
} from "../types/domain";

const statusOptions: AttendanceStatus[] = [
  "CONFIRMADO",
  "PRESENTE",
  "ATRASADO",
  "AUSENTE",
  "JUSTIFICADO",
];

export function AttendanceManagePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadEvents = async () => {
    const response = await listEvents();
    setEvents(response.data);
    if (!eventId && response.data.length > 0) {
      setEventId(response.data[0].id);
    }
  };

  const loadAttendance = async (selectedEventId: string) => {
    if (!selectedEventId) {
      setAttendance([]);
      return;
    }

    const response = await listAttendanceByEvent(selectedEventId);
    setAttendance(response.data);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await loadEvents();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível carregar eventos."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    void loadAttendance(eventId)
      .catch((requestError) => {
        setError(
          getErrorMessage(requestError, "Não foi possível carregar presença."),
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [eventId]);

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === eventId) ?? null,
    [eventId, events],
  );

  const updateStatus = async (scheduleId: string, status: AttendanceStatus) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await markAttendanceStatus(scheduleId, {
        status,
        note: notes[scheduleId] || undefined,
      });
      await loadAttendance(eventId);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível atualizar o status."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Operação de Culto"
        title="Gestão de Presença"
        description="Marque atrasos, ausências e justificativas por evento."
      />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-app-200">
          Evento
          <select
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.nome}
              </option>
            ))}
          </select>
        </label>
        {selectedEvent ? (
          <p className="mt-2 text-xs text-app-200">
            Evento selecionado: {selectedEvent.nome}
          </p>
        ) : null}
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
        </div>
      ) : null}

      {!isLoading && attendance.length === 0 ? (
        <EmptyState
          title="Sem presença registrada"
          description="Escalas do evento aparecerão aqui para marcação rápida."
        />
      ) : null}

      {!isLoading && attendance.length > 0 ? (
        <div className="space-y-3">
          {attendance.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">
                    {item.schedule.volunteer.nome}
                  </h3>
                  <p className="text-xs text-app-200">
                    {item.schedule.ministry.nome}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-brand-100">
                    Status atual: {item.status ?? "PENDENTE"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    defaultValue={item.status ?? "CONFIRMADO"}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      const nextStatus = event.target.value as AttendanceStatus;
                      void updateStatus(item.scheduleId, nextStatus);
                    }}
                    className="rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={notes[item.scheduleId] ?? item.note ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.scheduleId]: event.target.value,
                    }))
                  }
                  placeholder="Observação, justificativa ou detalhe da ocorrência"
                  className="w-full rounded-xl border border-white/10 bg-app-900 px-3 py-2 text-sm text-white"
                />

                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <button
                      key={`${item.scheduleId}-${status}`}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void updateStatus(item.scheduleId, status)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-app-100 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
