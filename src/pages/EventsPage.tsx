import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarCheck2, CalendarX2, LoaderCircle, PencilLine, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { PaginationControls } from "../components/ui/PaginationControls";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../hooks/useAuth";
import {
  createEvent,
  deleteEvent,
  getEventSyncStatus,
  listEvents,
  seedDefaultEvents,
  updateEvent,
  unlinkEventFromGoogle,
} from "../services/eventsApi";
import { getGoogleCalendarStatus, type GoogleCalendarStatus } from "../services/googleCalendarApi";
import { getErrorMessage } from "../services/api";
import type {
  EventItem,
  RecurrenceDay,
  RecurrenceEventResponse,
} from "../types/domain";
import { formatDateTime, toInputDateTime } from "../utils/date";
import {
  calculateOccurrences,
  formatDateShort,
  toIsoDate,
} from "../utils/recurrence";
import { SeriesDetailModal } from "../components/ui/SeriesDetailModal";

type EventForm = {
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  isRecurring: boolean;
  recurrenceStart: string;
  recurrenceEnd: string;
  selectedDays: RecurrenceDay[];
};

type FieldName =
  | "nome"
  | "descricao"
  | "dataInicio"
  | "dataFim"
  | "recurrenceStart"
  | "recurrenceEnd"
  | "selectedDays";

type FieldErrors = Partial<Record<FieldName, string>>;

const initialForm: EventForm = {
  nome: "",
  descricao: "",
  dataInicio: "",
  dataFim: "",
  isRecurring: false,
  recurrenceStart: "",
  recurrenceEnd: "",
  selectedDays: [],
};

const PAGE_SIZE = 6;
type EventSort = "DATA_ASC" | "DATA_DESC" | "NOME_ASC";

const DAY_OPTIONS: Array<{ value: RecurrenceDay; label: string }> = [
  { value: "DOMINGO", label: "Dom" },
  { value: "SEGUNDA", label: "Seg" },
  { value: "TERCA", label: "Ter" },
  { value: "QUARTA", label: "Qua" },
  { value: "QUINTA", label: "Qui" },
  { value: "SEXTA", label: "Sex" },
  { value: "SABADO", label: "Sab" },
];

const MAX_PREVIEW = 10;

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function isRecurrenceResponse(
  result: EventItem | RecurrenceEventResponse,
): result is RecurrenceEventResponse {
  return "totalEvents" in result;
}

export function EventsPage() {
  const { user } = useAuth();
  const isAdmin =
    user?.perfil === "ADMIN" ||
    user?.perfil === "MASTER_ADMIN" ||
    user?.perfil === "MASTER_PLATFORM_ADMIN";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<EventSort>("DATA_ASC");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [form, setForm] = useState<EventForm>(initialForm);
  const formRef = useRef<HTMLFormElement>(null);

  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [seriesEvent, setSeriesEvent] = useState<EventItem | null>(null);
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);

  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null);
  const [syncingEvents, setSyncingEvents] = useState<Set<string>>(new Set());
  const [eventSyncStatuses, setEventSyncStatuses] = useState<Map<string, { syncedCount: number; totalCount: number }>>(new Map());

  const loadGoogleStatus = async () => {
    try {
      const response = await getGoogleCalendarStatus();
      setGoogleStatus(response.data);
    } catch {
      setGoogleStatus(null);
    }
  };

  const loadEventSyncStatuses = async (eventsToFetch: EventItem[]) => {
    const statuses = new Map<string, { syncedCount: number; totalCount: number }>();
    for (const event of eventsToFetch) {
      try {
        const response = await getEventSyncStatus(event.id);
        const data = response.data;
        if (data?.schedules) {
          const syncedCount = data.schedules.filter((s) => s.synced).length;
          statuses.set(event.id, { syncedCount, totalCount: data.schedules.length });
        }
      } catch {
        // ignore per-event errors
      }
    }
    setEventSyncStatuses(statuses);
  };

  const handleUnlinkGoogle = async (eventId: string) => {
    setSyncingEvents((prev) => new Set(prev).add(eventId));
    try {
      await unlinkEventFromGoogle(eventId);
      setSuccess("Evento desvinculado do Google Calendar.");
      if (googleStatus?.connected) {
        await loadEventSyncStatuses(events);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao desvincular do Google Calendar."));
    } finally {
      setSyncingEvents((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const loadEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listEvents();
      setEvents(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível carregar os eventos."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
    void loadGoogleStatus();
  }, []);

  useEffect(() => {
    if (googleStatus?.connected && events.length > 0) {
      void loadEventSyncStatuses(events);
    }
  }, [googleStatus?.connected, events]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return events;
    }

    return events.filter((event) =>
      [event.nome, event.descricao]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [events, query]);

  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];

    list.sort((first, second) => {
      if (sortBy === "DATA_DESC") {
        return (
          new Date(second.dataInicio).getTime() -
          new Date(first.dataInicio).getTime()
        );
      }

      if (sortBy === "NOME_ASC") {
        return first.nome.localeCompare(second.nome, "pt-BR");
      }

      return (
        new Date(first.dataInicio).getTime() -
        new Date(first.dataInicio).getTime()
      );
    });

    return list;
  }, [filteredEvents, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / PAGE_SIZE));
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedEvents.slice(start, end);
  }, [page, sortedEvents]);

  useEffect(() => {
    setPage(1);
  }, [query, sortBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const previewOccurrences = useMemo(() => {
    if (!form.isRecurring) {
      return [];
    }
    return calculateOccurrences(
      form.recurrenceStart,
      form.recurrenceEnd,
      form.selectedDays,
    );
  }, [form.isRecurring, form.recurrenceStart, form.recurrenceEnd, form.selectedDays]);

  const previewTotal = previewOccurrences.length;
  const previewVisible = previewOccurrences.slice(0, MAX_PREVIEW);
  const previewRemaining = Math.max(0, previewTotal - MAX_PREVIEW);

  const openCreateModal = () => {
    setEditingEvent(null);
    setForm(initialForm);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: EventItem) => {
    setEditingEvent(event);
    setForm({
      nome: event.nome,
      descricao: event.descricao,
      dataInicio: toInputDateTime(event.dataInicio),
      dataFim: toInputDateTime(event.dataFim),
      isRecurring: false,
      recurrenceStart: "",
      recurrenceEnd: "",
      selectedDays: [],
    });
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setForm(initialForm);
    setFieldErrors({});
    setFormError(null);
  };

  const toggleDay = (day: RecurrenceDay) => {
    setForm((current) => {
      const isSelected = current.selectedDays.includes(day);
      return {
        ...current,
        selectedDays: isSelected
          ? current.selectedDays.filter((d) => d !== day)
          : [...current.selectedDays, day],
      };
    });
    setFieldErrors((prev) => {
      if (prev.selectedDays) {
        const next = { ...prev };
        delete next.selectedDays;
        return next;
      }
      return prev;
    });
  };

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  };

  const validateForm = (): { fieldErrors: FieldErrors; formError: string | null } => {
    const errors: FieldErrors = {};

    if (!form.nome) {
      errors.nome = "O nome do evento é obrigatório.";
    }
    if (!form.descricao) {
      errors.descricao = "A descrição do evento é obrigatória.";
    }
    if (!form.dataInicio) {
      errors.dataInicio = "A data de início é obrigatória.";
    }
    if (!form.dataFim) {
      errors.dataFim = "A data de término é obrigatória.";
    }

    const dataInicioIso = form.dataInicio ? toIsoOrNull(form.dataInicio) : null;
    const dataFimIso = form.dataFim ? toIsoOrNull(form.dataFim) : null;

    if (form.dataInicio && !dataInicioIso) {
      errors.dataInicio = "Data de início inválida.";
    }
    if (form.dataFim && !dataFimIso) {
      errors.dataFim = "Data de término inválida.";
    }

    if (dataInicioIso && dataFimIso && new Date(dataFimIso) <= new Date(dataInicioIso)) {
      errors.dataFim = "A data final deve ser posterior à data inicial.";
    }

    if (form.isRecurring) {
      if (!form.recurrenceStart) {
        errors.recurrenceStart = "Informe a data inicial da recorrência.";
      }
      if (!form.recurrenceEnd) {
        errors.recurrenceEnd = "Informe a data final da recorrência.";
      }

      if (form.recurrenceStart && form.recurrenceEnd) {
        const recStartIso = toIsoDate(form.recurrenceStart);
        const recEndIso = toIsoDate(form.recurrenceEnd);
        if (new Date(recEndIso) < new Date(recStartIso)) {
          errors.recurrenceEnd = "A data final da recorrência deve ser maior ou igual à data inicial.";
        }
      }

      if (form.selectedDays.length === 0) {
        errors.selectedDays = "Selecione pelo menos um dia da semana.";
      }

      if (previewTotal > 52) {
        return { fieldErrors: errors, formError: "O período selecionado gera mais de 52 ocorrências." };
      }

      if (previewTotal === 0 && form.recurrenceStart && form.recurrenceEnd && form.selectedDays.length > 0) {
        return { fieldErrors: errors, formError: "Nenhuma ocorrência válida gerada para a configuração informada." };
      }
    }

    return { fieldErrors: errors, formError: null };
  };

  const handleSave = async () => {
    const { fieldErrors: validationErrors, formError: generalError } = validateForm();
    if (Object.keys(validationErrors).length > 0 || generalError) {
      setFieldErrors(validationErrors);
      setFormError(generalError);

      const firstErrorField = (["nome", "descricao", "dataInicio", "dataFim", "recurrenceStart", "recurrenceEnd", "selectedDays"] as FieldName[]).find(
        (f) => validationErrors[f],
      );
      if (firstErrorField) {
        const el = formRef.current?.querySelector(`[name="${firstErrorField}"]`) as HTMLElement | null;
        el?.focus();
      }
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    setFormError(null);
    setError(null);
    setSuccess(null);

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          nome: form.nome,
          descricao: form.descricao,
          dataInicio: toIsoOrNull(form.dataInicio)!,
          dataFim: toIsoOrNull(form.dataFim)!,
        });
        setSuccess(
          editingEvent.recurrenceGroupId
            ? "Esta alteração foi aplicada somente a esta ocorrência."
            : "Evento atualizado com sucesso.",
        );
        if (editingEvent.recurrenceGroupId) {
          setSeriesRefreshKey((k) => k + 1);
        }
      } else {
        const payload = {
          nome: form.nome,
          descricao: form.descricao,
          dataInicio: toIsoOrNull(form.dataInicio)!,
          dataFim: toIsoOrNull(form.dataFim)!,
          ...(form.isRecurring
            ? {
                recurrence: {
                  type: "WEEKLY" as const,
                  startDate: toIsoDate(form.recurrenceStart),
                  endDate: toIsoDate(form.recurrenceEnd),
                  daysOfWeek: form.selectedDays,
                },
              }
            : {}),
        };

        const response = await createEvent(payload);
        const result = response.data;

        if (isRecurrenceResponse(result)) {
          setSuccess(
            `${result.totalEvents} eventos foram criados com sucesso.`,
          );
        } else {
          setSuccess("Evento criado com sucesso.");
        }
      }

      await loadEvents();
      closeModal();
    } catch (requestError) {
      setFormError(
        getErrorMessage(requestError, "Não foi possível salvar o evento."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (event: EventItem) => {
    const message = event.recurrenceGroupId
      ? `Deseja excluir esta ocorrência? Esta ação excluirá somente esta ocorrência da série. Esta ação não pode ser desfeita.`
      : `Deseja excluir o evento ${event.nome}? Esta ação não pode ser desfeita.`;

    const confirmed = window.confirm(message);

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await deleteEvent(event.id);
      setSuccess(
        event.recurrenceGroupId
          ? "Ocorrência removida com sucesso."
          : "Evento removido com sucesso.",
      );
      if (event.recurrenceGroupId) {
        setSeriesRefreshKey((k) => k + 1);
      }
      await loadEvents();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível remover o evento."),
      );
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeedingDefaults(true);
    setError(null);
    setSuccess(null);

    try {
      await seedDefaultEvents();
      setSuccess("Eventos padrão criados com sucesso.");
      await loadEvents();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível criar os eventos padrão.",
        ),
      );
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  const openSeriesDetail = (event: EventItem) => {
    setSeriesEvent(event);
    setIsSeriesModalOpen(true);
  };

  const handleSelectOccurrence = (occurrence: EventItem) => {
    openEditModal(occurrence);
  };

  const handleDeleteOccurrence = (occurrence: EventItem) => {
    void handleDelete(occurrence);
  };

  const getEventBadge = (event: EventItem) => {
    if (event.recurrenceType === "WEEKLY" && event.recurrenceGroupId) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openSeriesDetail(event);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-200 transition hover:bg-brand-500/25"
        >
          Recorrente
        </button>
      );
    }
    return null;
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Eventos"
        title="Agenda de Eventos"
        description="Visualize e mantenha os eventos oficiais da igreja com início e fim definidos."
        action={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSeedDefaults()}
                disabled={isSeedingDefaults}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-app-100 transition hover:bg-white/10 disabled:opacity-60"
              >
                {isSeedingDefaults
                  ? "Criando padrão..."
                  : "Criar eventos padrão"}
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20"
              >
                <Plus className="h-4 w-4" />
                Novo evento
              </button>
            </div>
          ) : null
        }
      />

      {!isAdmin ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-amber-100">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Modo leitura
          </div>
          <p className="mt-2 text-sm text-amber-100/85">
            Seu perfil pode visualizar eventos, mas apenas administradores da
            operação criam, editam e excluem.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar por nome ou descrição"
          className="min-w-[18rem] flex-1 rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
        />

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as EventSort)}
          className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
        >
          <option value="DATA_ASC">Data: mais próxima</option>
          <option value="DATA_DESC">Data: mais distante</option>
          <option value="NOME_ASC">Nome: A-Z</option>
        </select>
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : null}

      {!isLoading && filteredEvents.length === 0 ? (
        <EmptyState
          title="Nenhum evento encontrado"
          description="Ajuste sua busca ou cadastre um novo evento para começar a agenda."
        />
      ) : null}

      {!isLoading && sortedEvents.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {paginatedEvents.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border border-white/10 bg-linear-to-b from-white/8 to-white/4 p-5 shadow-[0_12px_40px_rgba(2,7,17,0.36)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {event.recurrenceType === "WEEKLY" &&
                    event.recurrenceGroupId ? (
                      <button
                        type="button"
                        onClick={() => openSeriesDetail(event)}
                        className="font-display text-xl font-semibold text-white text-left transition hover:text-brand-200"
                      >
                        {event.nome}
                      </button>
                    ) : (
                      <h3 className="font-display text-xl font-semibold text-white">
                        {event.nome}
                      </h3>
                    )}
                    {getEventBadge(event)}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-app-200">
                    {event.descricao}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(event)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-app-100 transition hover:bg-white/10"
                      aria-label="Editar evento"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(event)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-400/35 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                      aria-label="Excluir evento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <dt className="text-app-200">Início</dt>
                  <dd className="font-medium text-app-100">
                    {formatDateTime(event.dataInicio)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-app-200">Fim</dt>
                  <dd className="font-medium text-app-100">
                    {formatDateTime(event.dataFim)}
                  </dd>
                </div>
              </dl>

              {googleStatus?.connected ? (
                <div className="mt-3 flex items-center gap-2">
                  {syncingEvents.has(event.id) ? (
                    <LoaderCircle className="h-4 w-4 animate-spin text-app-300" />
                  ) : (() => {
                    const syncInfo = eventSyncStatuses.get(event.id);
                    if (syncInfo && syncInfo.totalCount > 0) {
                      return syncInfo.syncedCount === syncInfo.totalCount ? (
                        <CalendarCheck2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <CalendarCheck2 className="h-4 w-4 text-yellow-400" />
                      );
                    }
                    return <CalendarCheck2 className="h-4 w-4 text-app-400" />;
                  })()}
                  <span className="text-xs text-app-300">
                    {(() => {
                      const syncInfo = eventSyncStatuses.get(event.id);
                      if (syncInfo && syncInfo.totalCount > 0) {
                        return `Google Calendar: ${syncInfo.syncedCount}/${syncInfo.totalCount} escalas`;
                      }
                      return "Google Calendar conectado";
                    })()}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleUnlinkGoogle(event.id)}
                    disabled={syncingEvents.has(event.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                  >
                    <CalendarX2 className="h-3 w-3" />
                    Desvincular
                  </button>
                </div>
              ) : googleStatus?.connected === false ? null : null}
            </article>
          ))}
        </div>
      ) : null}

      {!isLoading && sortedEvents.length > 0 ? (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEvent ? "Editar evento" : "Novo evento"}
        subtitle="Preencha os dados básicos de agenda."
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-app-200 transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Salvar evento"}
            </button>
          </>
        }
      >
        <form ref={formRef} noValidate onSubmit={(e) => e.preventDefault()} className="space-y-3">
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <label className="block space-y-1 text-sm">
            <span className="text-app-200">Nome</span>
            <input
              name="nome"
              value={form.nome}
              onChange={(event) => {
                setForm((current) => ({ ...current, nome: event.target.value }));
                clearFieldError("nome");
              }}
              aria-invalid={!!fieldErrors.nome}
              aria-describedby={fieldErrors.nome ? "error-nome" : undefined}
              className={`w-full rounded-xl border bg-app-850 px-3 py-2 text-app-100 outline-none ${
                fieldErrors.nome
                  ? "border-rose-400/60 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                  : "border-white/10 focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20"
              }`}
            />
            {fieldErrors.nome ? (
              <p id="error-nome" className="text-xs text-rose-300" role="alert">
                {fieldErrors.nome}
              </p>
            ) : null}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-app-200">Descrição</span>
            <textarea
              name="descricao"
              value={form.descricao}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  descricao: event.target.value,
                }));
                clearFieldError("descricao");
              }}
              rows={3}
              aria-invalid={!!fieldErrors.descricao}
              aria-describedby={fieldErrors.descricao ? "error-descricao" : undefined}
              className={`w-full rounded-xl border bg-app-850 px-3 py-2 text-app-100 outline-none ${
                fieldErrors.descricao
                  ? "border-rose-400/60 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                  : "border-white/10 focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20"
              }`}
            />
            {fieldErrors.descricao ? (
              <p id="error-descricao" className="text-xs text-rose-300" role="alert">
                {fieldErrors.descricao}
              </p>
            ) : null}
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-app-200">Data início</span>
              <input
                name="dataInicio"
                type="datetime-local"
                value={form.dataInicio}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    dataInicio: event.target.value,
                  }));
                  clearFieldError("dataInicio");
                }}
                aria-invalid={!!fieldErrors.dataInicio}
                aria-describedby={fieldErrors.dataInicio ? "error-dataInicio" : undefined}
                className={`w-full rounded-xl border bg-app-850 px-3 py-2 text-app-100 outline-none ${
                  fieldErrors.dataInicio
                    ? "border-rose-400/60 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                    : "border-white/10 focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20"
                }`}
              />
              {fieldErrors.dataInicio ? (
                <p id="error-dataInicio" className="text-xs text-rose-300" role="alert">
                  {fieldErrors.dataInicio}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-app-200">Data fim</span>
              <input
                name="dataFim"
                type="datetime-local"
                value={form.dataFim}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    dataFim: event.target.value,
                  }));
                  clearFieldError("dataFim");
                }}
                aria-invalid={!!fieldErrors.dataFim}
                aria-describedby={fieldErrors.dataFim ? "error-dataFim" : undefined}
                className={`w-full rounded-xl border bg-app-850 px-3 py-2 text-app-100 outline-none ${
                  fieldErrors.dataFim
                    ? "border-rose-400/60 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                    : "border-white/10 focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20"
                }`}
              />
              {fieldErrors.dataFim ? (
                <p id="error-dataFim" className="text-xs text-rose-300" role="alert">
                  {fieldErrors.dataFim}
                </p>
              ) : null}
            </label>
          </div>

          {!editingEvent ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isRecurring: event.target.checked,
                      recurrenceStart: event.target.checked
                        ? current.dataInicio.split("T")[0]
                        : "",
                      recurrenceEnd: event.target.checked
                        ? current.dataFim.split("T")[0]
                        : "",
                      selectedDays: event.target.checked
                        ? current.selectedDays
                        : [],
                    }))
                  }
                  className="h-4 w-4 rounded border-white/20 bg-app-850 text-brand-500 accent-brand-500"
                />
                <span className="text-app-200">Evento recorrente</span>
              </label>

              {form.isRecurring ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-app-300">
                    Serão criadas ocorrências individuais para cada data
                    selecionada. Limite máximo: 52 ocorrências por série.
                  </p>

                  <div className="space-y-1 text-sm">
                    <span className="text-app-200">Frequência</span>
                    <div className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100">
                      Semanal
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <span className="text-app-200">Dias da semana</span>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana">
                      {DAY_OPTIONS.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          aria-pressed={form.selectedDays.includes(day.value)}
                          className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            form.selectedDays.includes(day.value)
                              ? "border border-brand-400/35 bg-brand-500/20 text-brand-100"
                              : "border border-white/10 bg-white/5 text-app-200 hover:bg-white/10"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    {fieldErrors.selectedDays ? (
                      <p id="error-selectedDays" className="text-xs text-rose-300" role="alert">
                        {fieldErrors.selectedDays}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="text-app-200">
                        Data inicial da recorrência
                      </span>
                      <input
                        name="recurrenceStart"
                        type="date"
                        value={form.recurrenceStart}
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            recurrenceStart: event.target.value,
                          }));
                          clearFieldError("recurrenceStart");
                        }}
                        aria-invalid={!!fieldErrors.recurrenceStart}
                        aria-describedby={fieldErrors.recurrenceStart ? "error-recurrenceStart" : undefined}
                        className={`w-full rounded-xl border bg-app-850 px-3 py-2 text-app-100 outline-none ${
                          fieldErrors.recurrenceStart
                            ? "border-rose-400/60 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                            : "border-white/10 focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20"
                        }`}
                      />
                      {fieldErrors.recurrenceStart ? (
                        <p id="error-recurrenceStart" className="text-xs text-rose-300" role="alert">
                          {fieldErrors.recurrenceStart}
                        </p>
                      ) : null}
                    </label>

                    <label className="block space-y-1 text-sm">
                      <span className="text-app-200">
                        Data final da recorrência
                      </span>
                      <input
                        name="recurrenceEnd"
                        type="date"
                        value={form.recurrenceEnd}
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            recurrenceEnd: event.target.value,
                          }));
                          clearFieldError("recurrenceEnd");
                        }}
                        aria-invalid={!!fieldErrors.recurrenceEnd}
                        aria-describedby={fieldErrors.recurrenceEnd ? "error-recurrenceEnd" : undefined}
                        className={`w-full rounded-xl border bg-app-850 px-3 py-2 text-app-100 outline-none ${
                          fieldErrors.recurrenceEnd
                            ? "border-rose-400/60 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                            : "border-white/10 focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20"
                        }`}
                      />
                      {fieldErrors.recurrenceEnd ? (
                        <p id="error-recurrenceEnd" className="text-xs text-rose-300" role="alert">
                          {fieldErrors.recurrenceEnd}
                        </p>
                      ) : null}
                    </label>
                  </div>

                  {previewTotal > 0 ? (
                    <div className="space-y-1 text-sm">
                      <span className="text-app-200">
                        Prévia das ocorrências ({previewTotal} total)
                      </span>
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-app-850 px-3 py-2">
                        {previewVisible.map((date, index) => (
                          <div
                            key={index}
                            className="text-xs text-app-100"
                          >
                            {formatDateShort(date)}
                          </div>
                        ))}
                        {previewRemaining > 0 ? (
                          <div className="text-xs text-app-300">
                            ... e mais {previewRemaining} ocorrências
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>

      {seriesEvent ? (
        <SeriesDetailModal
          isOpen={isSeriesModalOpen}
          currentEvent={seriesEvent}
          refreshKey={seriesRefreshKey}
          onClose={() => {
            setIsSeriesModalOpen(false);
            setSeriesEvent(null);
          }}
          onSelectOccurrence={handleSelectOccurrence}
          onDeleteOccurrence={handleDeleteOccurrence}
        />
      ) : null}
    </section>
  );
}
