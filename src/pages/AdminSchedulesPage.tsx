import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  LoaderCircle,
  PencilLine,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { PaginationControls } from "../components/ui/PaginationControls";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { listEvents } from "../services/eventsApi";
import { getErrorMessage } from "../services/api";
import { listVisibleMinistries } from "../services/ministriesApi";
import {
  cancelSchedule,
  createSchedule,
  listSchedules,
  updateSchedule,
} from "../services/schedulesApi";
import { getManualSmartSuggestions } from "../services/smartSchedulerApi";
import { listActiveVolunteers } from "../services/usersApi";
import type {
  EventItem,
  ManualSmartSuggestions,
  MinistryItem,
  ScheduleItem,
  ScheduleStatus,
  SmartVolunteerInsight,
  UserItem,
} from "../types/domain";
import { formatDateTime } from "../utils/date";

type FormValues = {
  eventId: string;
  ministryId: string;
  volunteerId: string;
  status: ScheduleStatus;
};

const initialForm: FormValues = {
  eventId: "",
  ministryId: "",
  volunteerId: "",
  status: "PENDENTE",
};

const statusOptions: ScheduleStatus[] = ["PENDENTE", "CONFIRMADO", "CANCELADO"];
const PAGE_SIZE = 8;

type SortOption = "DATA_ASC" | "DATA_DESC" | "EVENTO_ASC" | "VOLUNTARIO_ASC";

export function AdminSchedulesPage() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === "ADMIN";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [ministries, setMinistries] = useState<MinistryItem[]>([]);
  const [volunteers, setVolunteers] = useState<UserItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"TODOS" | ScheduleStatus>(
    "TODOS",
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("DATA_ASC");
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(
    null,
  );
  const [form, setForm] = useState<FormValues>(initialForm);
  const [suggestionsState, setSuggestionsState] = useState<{
    isLoading: boolean;
    data: ManualSmartSuggestions | null;
    error: string | null;
  }>({
    isLoading: false,
    data: null,
    error: null,
  });

  const loadData = async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [
        schedulesResponse,
        eventsResponse,
        ministriesResponse,
        volunteersResponse,
      ] = await Promise.all([
        listSchedules(),
        listEvents(),
        listVisibleMinistries(),
        listActiveVolunteers(),
      ]);

      setSchedules(schedulesResponse.data);
      setEvents(eventsResponse.data);
      setMinistries(ministriesResponse.data);
      setVolunteers(volunteersResponse.data);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Não foi possível carregar os dados de gestão de escalas.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [isAdmin]);

  const filteredSchedules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return schedules.filter((schedule) => {
      if (statusFilter !== "TODOS" && schedule.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const text = [
        schedule.event.nome,
        schedule.ministry.nome,
        schedule.volunteer.nome,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(normalizedQuery);
    });
  }, [query, schedules, statusFilter]);

  const sortedSchedules = useMemo(() => {
    const list = [...filteredSchedules];

    list.sort((first, second) => {
      if (sortBy === "DATA_DESC") {
        return (
          new Date(second.event.dataInicio).getTime() -
          new Date(first.event.dataInicio).getTime()
        );
      }

      if (sortBy === "EVENTO_ASC") {
        return first.event.nome.localeCompare(second.event.nome, "pt-BR");
      }

      if (sortBy === "VOLUNTARIO_ASC") {
        return first.volunteer.nome.localeCompare(
          second.volunteer.nome,
          "pt-BR",
        );
      }

      return (
        new Date(first.event.dataInicio).getTime() -
        new Date(second.event.dataInicio).getTime()
      );
    });

    return list;
  }, [filteredSchedules, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedSchedules.length / PAGE_SIZE));
  const paginatedSchedules = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedSchedules.slice(start, end);
  }, [page, sortedSchedules]);

  useEffect(() => {
    setPage(1);
  }, [query, sortBy, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreateModal = () => {
    setEditingSchedule(null);
    setForm(initialForm);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
    setForm({
      eventId: schedule.eventId,
      ministryId: schedule.ministryId,
      volunteerId: schedule.volunteerId,
      status: schedule.status,
    });
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSchedule(null);
    setForm(initialForm);
    setSuggestionsState({ isLoading: false, data: null, error: null });
  };

  const applySmartSuggestion = (suggestion: SmartVolunteerInsight) => {
    setForm((current) => ({
      ...current,
      volunteerId: suggestion.volunteerId,
    }));
  };

  useEffect(() => {
    const shouldLoadSuggestions =
      isModalOpen && !!form.eventId && !!form.ministryId;

    if (!shouldLoadSuggestions) {
      setSuggestionsState({ isLoading: false, data: null, error: null });
      return;
    }

    let isMounted = true;

    setSuggestionsState({
      isLoading: true,
      data: null,
      error: null,
    });

    void getManualSmartSuggestions({
      eventId: form.eventId,
      ministryId: form.ministryId,
      limit: 5,
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setSuggestionsState({
          isLoading: false,
          data: response.data,
          error: null,
        });
      })
      .catch((requestError) => {
        if (!isMounted) {
          return;
        }

        setSuggestionsState({
          isLoading: false,
          data: null,
          error: getErrorMessage(
            requestError,
            "Não foi possível carregar sugestões inteligentes.",
          ),
        });
      });

    return () => {
      isMounted = false;
    };
  }, [form.eventId, form.ministryId, isModalOpen]);

  const handleSave = async () => {
    if (!form.eventId || !form.ministryId || !form.volunteerId) {
      setError(
        "Selecione evento, ministério e voluntário para salvar a escala.",
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, form);
        setSuccess("Escala atualizada com sucesso.");
      } else {
        await createSchedule(form);
        setSuccess("Escala criada com sucesso.");
      }

      await loadData();
      closeModal();
    } catch (requestError) {
      const message = getErrorMessage(
        requestError,
        "Não foi possível salvar a escala.",
      );
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (schedule: ScheduleItem) => {
    const confirmed = window.confirm(
      `Deseja cancelar a escala de ${schedule.volunteer.nome} para ${schedule.event.nome}?`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await cancelSchedule(schedule.id);
      setSuccess("Escala cancelada com sucesso.");
      await loadData();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível cancelar a escala."),
      );
    }
  };

  if (!isAdmin) {
    return (
      <section className="space-y-5">
        <SectionHeader
          eyebrow="Admin"
          title="Gestão de Escalas"
          description="Somente administradores podem acessar esta área."
        />
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-amber-100">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Acesso restrito
          </div>
          <p className="mt-2 text-sm text-amber-100/85">
            Entre com um perfil ADMIN para criar, editar ou cancelar escalas.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Admin"
        title="Gestão de Escalas"
        description="Crie e mantenha escalas com visão centralizada de eventos, ministérios e voluntários."
        action={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20"
          >
            <Plus className="h-4 w-4" />
            Nova escala
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por evento, ministério ou voluntário"
          className="min-w-[18rem] flex-1 rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "TODOS" | ScheduleStatus)
          }
          className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
        >
          <option value="TODOS">Todos status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortOption)}
          className="rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-sm text-app-100 outline-none"
        >
          <option value="DATA_ASC">Data: mais próxima</option>
          <option value="DATA_DESC">Data: mais distante</option>
          <option value="EVENTO_ASC">Evento: A-Z</option>
          <option value="VOLUNTARIO_ASC">Voluntário: A-Z</option>
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
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : null}

      {!isLoading && filteredSchedules.length === 0 ? (
        <EmptyState
          title="Nenhuma escala encontrada"
          description="Crie uma nova escala ou ajuste os filtros para encontrar resultados."
        />
      ) : null}

      {!isLoading && sortedSchedules.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-245 divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-app-200">
                <tr>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Ministério</th>
                  <th className="px-4 py-3">Voluntário</th>
                  <th className="px-4 py-3">Data início</th>
                  <th className="px-4 py-3 text-right">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {paginatedSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-white/4">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {schedule.event.nome}
                      </p>
                      <p className="text-xs text-app-200">
                        {formatDateTime(schedule.event.dataFim)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-app-100">
                      {schedule.ministry.nome}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-app-100">
                        {schedule.volunteer.nome}
                      </p>
                      <p className="text-xs text-app-200">
                        {schedule.volunteer.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-app-100">
                      {formatDateTime(schedule.event.dataInicio)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={schedule.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(schedule)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-app-100 transition hover:bg-white/10"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancel(schedule)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!isLoading && sortedSchedules.length > 0 ? (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingSchedule ? "Editar escala" : "Nova escala"}
        subtitle="Selecione evento, ministério e voluntário."
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
              {isSaving ? "Salvando..." : "Salvar escala"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-app-200">Evento</span>
            <select
              value={form.eventId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  eventId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
            >
              <option value="">Selecione</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-app-200">Ministério</span>
            <select
              value={form.ministryId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ministryId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
            >
              <option value="">Selecione</option>
              {ministries.map((ministry) => (
                <option key={ministry.id} value={ministry.id}>
                  {ministry.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-app-200">Voluntário</span>
            <select
              value={form.volunteerId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  volunteerId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
            >
              <option value="">Selecione</option>
              {volunteers.map((volunteer) => (
                <option key={volunteer.id} value={volunteer.id}>
                  {volunteer.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-app-200">Status</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as ScheduleStatus,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Se houver conflito de horário, o backend retornará uma mensagem
          amigável e a escala não será salva.
        </p>

        <div className="mt-4 rounded-xl border border-brand-400/30 bg-brand-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-100">
            <BrainCircuit className="h-4 w-4" />
            Melhores voluntários para esta escala
          </div>

          {suggestionsState.isLoading ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-brand-100/85">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Calculando score inteligente...
            </p>
          ) : null}

          {suggestionsState.error ? (
            <p className="mt-2 text-xs text-rose-200">
              {suggestionsState.error}
            </p>
          ) : null}

          {!suggestionsState.isLoading &&
          suggestionsState.data &&
          suggestionsState.data.suggestions.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {suggestionsState.data.suggestions.map((suggestion) => (
                <button
                  key={suggestion.volunteerId}
                  type="button"
                  onClick={() => applySmartSuggestion(suggestion)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left transition hover:border-brand-300/50 hover:bg-white/10"
                >
                  <p className="text-sm font-medium text-white">
                    {suggestion.nome}
                  </p>
                  <p className="mt-0.5 text-[11px] text-app-200">
                    Score {suggestion.score} · Risco {suggestion.riscoAusencia}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {!suggestionsState.isLoading &&
          suggestionsState.data &&
          suggestionsState.data.suggestions.length === 0 ? (
            <p className="mt-2 text-xs text-app-200">
              Sem candidatos aptos para o evento e ministério selecionados.
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
