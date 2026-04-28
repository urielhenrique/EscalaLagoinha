import { CalendarX2, type LucideIcon } from "lucide-react";
import { isValidElement, type ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon | ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  const defaultIcon = <CalendarX2 className="h-6 w-6" />;
  const iconNode = isValidElement(icon)
    ? icon
    : icon
      ? (() => {
          const IconComponent = icon as LucideIcon;
          return <IconComponent className="h-6 w-6" />;
        })()
      : defaultIcon;

  return (
    <div className="animate-fade rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-app-200">
        {iconNode}
      </div>
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-app-200">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
