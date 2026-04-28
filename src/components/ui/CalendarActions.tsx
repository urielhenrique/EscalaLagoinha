import { CalendarPlus, Download } from "lucide-react";
import type { ScheduleItem } from "../../types/domain";
import { buildGoogleCalendarUrl, downloadIcsFile } from "../../utils/calendar";

type CalendarActionsProps = {
  schedule: ScheduleItem;
  compact?: boolean;
};

export function CalendarActions({
  schedule,
  compact = false,
}: CalendarActionsProps) {
  const title = `${schedule.event.nome} - ${schedule.ministry.nome}`;
  const description = [
    `Ministério: ${schedule.ministry.nome}`,
    `Voluntário: ${schedule.volunteer.nome}`,
    `Status: ${schedule.status}`,
    schedule.event.descricao ? `Observações: ${schedule.event.descricao}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const googleUrl = buildGoogleCalendarUrl({
    title,
    description,
    start: schedule.event.dataInicio,
    end: schedule.event.dataFim,
  });

  const onDownloadIcs = () => {
    const safeDate = schedule.event.dataInicio.slice(0, 10);
    const filename = `${schedule.ministry.nome}-${safeDate}.ics`
      .toLowerCase()
      .replace(/\s+/g, "-");

    downloadIcsFile(
      {
        title,
        description,
        start: schedule.event.dataInicio,
        end: schedule.event.dataFim,
      },
      filename,
    );
  };

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-2",
        compact ? "mt-2" : "mt-3",
      ].join(" ")}
    >
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className={[
          "inline-flex items-center gap-1 rounded-lg border border-brand-400/30 bg-brand-500/12 text-xs font-semibold text-brand-100 transition hover:bg-brand-500/20",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        ].join(" ")}
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        {compact ? "Google" : "Adicionar ao Google Agenda"}
      </a>

      <button
        type="button"
        onClick={onDownloadIcs}
        className={[
          "inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/6 text-xs font-semibold text-app-100 transition hover:bg-white/10",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        ].join(" ")}
      >
        <Download className="h-3.5 w-3.5" />
        {compact ? ".ics" : "Baixar .ics"}
      </button>
    </div>
  );
}
