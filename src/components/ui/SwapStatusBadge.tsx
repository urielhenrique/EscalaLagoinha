import type { SwapRequestStatus } from "../../types/domain";

type SwapStatusBadgeProps = {
  status: SwapRequestStatus;
};

const labels: Record<SwapRequestStatus, string> = {
  PENDENTE: "🟡 Pendente",
  APROVADO: "🟢 Aprovado",
  RECUSADO: "🔴 Recusado",
  CANCELADO: "⚫ Cancelado",
};

const styles: Record<SwapRequestStatus, string> = {
  PENDENTE:
    "border-amber-300/40 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]",
  APROVADO:
    "border-emerald-300/40 bg-emerald-500/15 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
  RECUSADO:
    "border-rose-300/40 bg-rose-500/15 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.18)]",
  CANCELADO:
    "border-slate-300/35 bg-slate-500/15 text-slate-100 shadow-[0_0_18px_rgba(100,116,139,0.16)]",
};

export function SwapStatusBadge({ status }: SwapStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        styles[status],
      ].join(" ")}
    >
      {labels[status]}
    </span>
  );
}
