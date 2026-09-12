import { useEffect, useState } from "react";
import { Calendar, Clock, Repeat, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { Skeleton } from "./Skeleton";
import { listRecurrenceGroup } from "../../services/eventsApi";
import { getErrorMessage } from "../../services/api";
import { formatDateTime } from "../../utils/date";
import {
  formatIsoDate,
  formatRecurrenceDays,
} from "../../utils/recurrence";
import type { EventItem, RecurrenceDay } from "../../types/domain";

type SeriesDetailModalProps = {
  isOpen: boolean;
  currentEvent: EventItem;
  refreshKey?: number;
  onClose: () => void;
  onSelectOccurrence: (event: EventItem) => void;
  onDeleteOccurrence: (event: EventItem) => void;
};

export function SeriesDetailModal({
  isOpen,
  currentEvent,
  refreshKey = 0,
  onClose,
  onSelectOccurrence,
  onDeleteOccurrence,
}: SeriesDetailModalProps) {
  const [occurrences, setOccurrences] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !currentEvent.recurrenceGroupId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await listRecurrenceGroup(
          currentEvent.recurrenceGroupId!,
        );
        if (!cancelled) {
          setOccurrences(response.data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              requestError,
              "Não foi possível carregar a série.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentEvent.recurrenceGroupId]);

  useEffect(() => {
    if (!isOpen) {
      setOccurrences([]);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !currentEvent.recurrenceGroupId) {
      return;
    }

    if (refreshKey <= 0) {
      return;
    }

    let cancelled = false;

    async function reload() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await listRecurrenceGroup(
          currentEvent.recurrenceGroupId!,
        );
        if (!cancelled) {
          setOccurrences(response.data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              requestError,
              "Não foi possível carregar a série.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void reload();

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentEvent.recurrenceGroupId, refreshKey]);

  if (!currentEvent.recurrenceGroupId) {
    return null;
  }

  const days = (currentEvent.recurrenceDays ?? []) as RecurrenceDay[];
  const startDate = currentEvent.recurrenceStart
    ? formatIsoDate(currentEvent.recurrenceStart)
    : null;
  const endDate = currentEvent.recurrenceEnd
    ? formatIsoDate(currentEvent.recurrenceEnd)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentEvent.nome}
      subtitle="Detalhes da série recorrente"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-app-200 transition hover:bg-white/10"
        >
          Fechar
        </button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Repeat className="h-4 w-4 text-brand-300" />
            <span className="text-app-200">Frequência:</span>
            <span className="font-medium text-app-100">Semanal</span>
          </div>

          {days.length > 0 ? (
            <div className="flex items-start gap-2 text-sm">
              <Calendar className="mt-0.5 h-4 w-4 text-brand-300" />
              <span className="text-app-200">Dias:</span>
              <span className="font-medium text-app-100">
                {formatRecurrenceDays(days)}
              </span>
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-brand-300" />
            <span className="text-app-200">Horário:</span>
            <span className="font-medium text-app-100">
              {formatDateTime(currentEvent.dataInicio)}
            </span>
          </div>

          {startDate && endDate ? (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-brand-300" />
              <span className="text-app-200">Período:</span>
              <span className="font-medium text-app-100">
                {startDate} → {endDate}
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-app-100">
              Ocorrências
            </h4>
            {isLoading ? null : (
              <span className="text-xs text-app-300">
                {occurrences.length} total
              </span>
            )}
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error ? (
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {occurrences.map((occ) => {
                const isSelected = occ.id === currentEvent.id;
                return (
                  <div
                    key={occ.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                      isSelected
                        ? "border border-brand-400/40 bg-brand-500/15 text-brand-100"
                        : "border border-transparent text-app-100 hover:bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOccurrence(occ);
                        onClose();
                      }}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isSelected
                            ? "bg-brand-500 text-white"
                            : "bg-white/10 text-app-200"
                        }`}
                      >
                        {occ.recurrenceIndex != null
                          ? occ.recurrenceIndex + 1
                          : "–"}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {formatDateTime(occ.dataInicio)}
                        </span>
                        {isSelected ? (
                          <span className="text-xs text-brand-200">
                            ● Ocorrência atual
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOccurrence(occ);
                      }}
                      className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-rose-400/35 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                      aria-label="Excluir esta ocorrência"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!isLoading && !error && occurrences.length === 0 ? (
            <p className="text-xs text-app-300">
              Nenhuma ocorrência encontrada.
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
