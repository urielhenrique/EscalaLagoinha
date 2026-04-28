import { useEffect, useMemo, useState } from "react";
import { PencilLine, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { PaginationControls } from "../components/ui/PaginationControls";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../hooks/useAuth";
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from "../services/eventsApi";
import { getErrorMessage } from "../services/api";
import type { EventItem } from "../types/domain";
import { formatDateTime, toInputDateTime } from "../utils/date";

type EventForm = {
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
};

const initialForm: EventForm = {
  nome: "",
  descricao: "",
  dataInicio: "",
  dataFim: "",
};

const PAGE_SIZE = 6;
type EventSort = "DATA_ASC" | "DATA_DESC" | "NOME_ASC";

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

export function EventsPage() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === "ADMIN";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<EventSort>("DATA_ASC");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [form, setForm] = useState<EventForm>(initialForm);

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
  }, []);

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
        new Date(second.dataInicio).getTime()
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

  const openCreateModal = () => {
    setEditingEvent(null);
    setForm(initialForm);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: EventItem) => {
    setEditingEvent(event);
    setForm({
      nome: event.nome,
      descricao: event.descricao,
      dataInicio: toInputDateTime(event.dataInicio),
      dataFim: toInputDateTime(event.dataFim),
    });
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setForm(initialForm);
  };

  const handleSave = async () => {
    if (!form.nome || !form.descricao || !form.dataInicio || !form.dataFim) {
      setError("Preencha todos os campos obrigatórios para salvar o evento.");
      return;
    }

    const dataInicioIso = toIsoOrNull(form.dataInicio);
    const dataFimIso = toIsoOrNull(form.dataFim);

    if (!dataInicioIso || !dataFimIso) {
      setError("Datas inválidas. Verifique os horários informados.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          nome: form.nome,
          descricao: form.descricao,
          dataInicio: dataInicioIso,
          dataFim: dataFimIso,
        });
        setSuccess("Evento atualizado com sucesso.");
      } else {
        await createEvent({
          nome: form.nome,
          descricao: form.descricao,
          dataInicio: dataInicioIso,
          dataFim: dataFimIso,
        });
        setSuccess("Evento criado com sucesso.");
      }

      await loadEvents();
      closeModal();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível salvar o evento."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (event: EventItem) => {
    const confirmed = window.confirm(
      `Deseja excluir o evento ${event.nome}? Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await deleteEvent(event.id);
      setSuccess("Evento removido com sucesso.");
      await loadEvents();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Não foi possível remover o evento."),
      );
    }
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Eventos"
        title="Agenda de Eventos"
        description="Visualize e mantenha os eventos oficiais da igreja com início e fim definidos."
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20"
            >
              <Plus className="h-4 w-4" />
              Novo evento
            </button>
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
            Seu perfil pode visualizar eventos, mas apenas administradores
            criam, editam e excluem.
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
                  <h3 className="font-display text-xl font-semibold text-white">
                    {event.nome}
                  </h3>
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
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-app-200">Nome</span>
            <input
              value={form.nome}
              onChange={(event) =>
                setForm((current) => ({ ...current, nome: event.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-app-200">Descrição</span>
            <textarea
              value={form.descricao}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  descricao: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-app-200">Data início</span>
              <input
                type="datetime-local"
                value={form.dataInicio}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dataInicio: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-app-200">Data fim</span>
              <input
                type="datetime-local"
                value={form.dataFim}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dataFim: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-app-850 px-3 py-2 text-app-100 outline-none"
              />
            </label>
          </div>
        </div>
      </Modal>
    </section>
  );
}
