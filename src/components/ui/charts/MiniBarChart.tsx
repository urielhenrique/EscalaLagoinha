type ChartPoint = {
  label: string;
  value: number;
};

type MiniBarChartProps = {
  title: string;
  points: ChartPoint[];
  valueSuffix?: string;
};

export function MiniBarChart({
  title,
  points,
  valueSuffix = "",
}: MiniBarChartProps) {
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {points.map((point) => {
          const size = Math.max(8, Math.round((point.value / max) * 100));

          return (
            <div key={point.label} className="space-y-1 text-center">
              <div className="h-28 rounded-xl border border-white/10 bg-app-900/70 p-1">
                <div
                  className="mt-auto h-full rounded-md bg-linear-to-t from-brand-500/70 via-brand-300/60 to-cyan-200/80"
                  style={{
                    height: `${size}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-app-200">{point.label}</p>
              <p className="text-[11px] font-semibold text-brand-100">
                {point.value}
                {valueSuffix}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}
