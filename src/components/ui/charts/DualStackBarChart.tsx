type DualStackBarChartRow = {
  label: string;
  primary: number;
  secondary: number;
};

type DualStackBarChartProps = {
  title: string;
  rows: DualStackBarChartRow[];
  primaryLabel: string;
  secondaryLabel: string;
};

export function DualStackBarChart({
  title,
  rows,
  primaryLabel,
  secondaryLabel,
}: DualStackBarChartProps) {
  const max = Math.max(1, ...rows.map((row) => row.primary + row.secondary));

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-3 text-[11px] text-app-200">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand-300" />
            {primaryLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-300" />
            {secondaryLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const total = row.primary + row.secondary;
          const width = (total / max) * 100;
          const primaryWidth = total > 0 ? (row.primary / total) * 100 : 0;

          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-app-100">{row.label}</span>
                <span className="text-app-200">{total}</span>
              </div>
              <div className="h-3 rounded-full bg-app-900/80">
                <div
                  className="flex h-3 overflow-hidden rounded-full"
                  style={{ width: `${Math.max(8, width)}%` }}
                >
                  <div
                    className="bg-brand-300/85"
                    style={{ width: `${primaryWidth}%` }}
                  />
                  <div
                    className="bg-rose-300/85"
                    style={{ width: `${100 - primaryWidth}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
