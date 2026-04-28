import type { ScheduleStatus } from "../../types/domain";

type StatusBadgeProps = {
  status: ScheduleStatus;
};

const labels: Record<ScheduleStatus, string> = {
  CONFIRMADO: "Confirmado",
  PENDENTE: "Pendente",
  CANCELADO: "Cancelado",
};

const styles: Record<ScheduleStatus, string> = {
  CONFIRMADO:
    "border-emerald-300/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
  PENDENTE:
    "border-amber-300/40 bg-amber-500/15 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.18)]",
  CANCELADO:
    "border-rose-300/40 bg-rose-500/15 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.16)]",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
        styles[status],
      ].join(" ")}
    >
      {labels[status]}
    </span>
  );
}
