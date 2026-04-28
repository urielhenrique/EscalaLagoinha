type DonutDistributionChartProps = {
  title: string;
  data: {
    confirmado: number;
    pendente: number;
    cancelado: number;
  };
};

export function DonutDistributionChart({
  title,
  data,
}: DonutDistributionChartProps) {
  const total = Math.max(1, data.confirmado + data.pendente + data.cancelado);
  const confirmedPercent = (data.confirmado / total) * 100;
  const pendingPercent = (data.pendente / total) * 100;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-28 w-28 rounded-full bg-app-900/80 p-2">
          <div
            className="h-full w-full rounded-full"
            style={{
              background: `conic-gradient(
                rgba(67, 231, 188, 0.95) 0 ${confirmedPercent}%,
                rgba(250, 204, 100, 0.95) ${confirmedPercent}% ${confirmedPercent + pendingPercent}%,
                rgba(251, 113, 133, 0.95) ${confirmedPercent + pendingPercent}% 100%
              )`,
            }}
          />
          <div className="absolute inset-5 rounded-full bg-app-900/95" />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-app-100">
            {total}
          </div>
        </div>

        <div className="space-y-2 text-xs text-app-200">
          <p>
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-brand-300" />
            Confirmado: {data.confirmado}
          </p>
          <p>
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
            Pendente: {data.pendente}
          </p>
          <p>
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-rose-300" />
            Cancelado: {data.cancelado}
          </p>
        </div>
      </div>
    </article>
  );
}
