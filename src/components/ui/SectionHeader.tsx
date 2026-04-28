import type { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="animate-fade rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-app-200/75">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-white sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-app-200">{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
