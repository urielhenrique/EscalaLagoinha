import type { ReactNode } from "react";
import type { SwapRequestItem } from "../../types/domain";
import { formatDateTime } from "../../utils/date";
import { SwapStatusBadge } from "./SwapStatusBadge";

type SwapRequestCardProps = {
  request: SwapRequestItem;
  actions?: ReactNode;
};

export function SwapRequestCard({ request, actions }: SwapRequestCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-linear-to-b from-white/8 to-white/4 p-4 shadow-[0_12px_32px_rgba(2,6,14,0.36)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-app-200">
            Solicitação enviada em {formatDateTime(request.createdAt)}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold text-white">
            Troca entre {request.requester.nome} e{" "}
            {request.requestedVolunteer.nome}
          </h3>
        </div>
        <SwapStatusBadge status={request.status} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-app-850/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.12em] text-app-200">
            Escala de origem
          </p>
          <p className="mt-1 font-semibold text-white">
            {request.requesterShift.event.nome}
          </p>
          <p className="text-sm text-app-200">
            {request.requesterShift.ministry.nome}
          </p>
          <p className="text-sm text-app-200">
            Voluntário: {request.requesterShift.volunteer.nome}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-app-850/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.12em] text-app-200">
            Escala solicitada
          </p>
          <p className="mt-1 font-semibold text-white">
            {request.requestedShift.event.nome}
          </p>
          <p className="text-sm text-app-200">
            {request.requestedShift.ministry.nome}
          </p>
          <p className="text-sm text-app-200">
            Voluntário: {request.requestedShift.volunteer.nome}
          </p>
        </div>
      </div>

      {actions ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>
      ) : null}
    </article>
  );
}
