import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ToastItem = {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
};

type ToastEntryProps = ToastItem & {
  onRemove: (id: string) => void;
};

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const styleMap = {
  success:
    "border-emerald-400/35 bg-emerald-500/15 [&_.toast-icon]:text-emerald-300",
  error: "border-rose-400/35 bg-rose-500/15 [&_.toast-icon]:text-rose-300",
  info: "border-brand-400/35 bg-brand-500/15 [&_.toast-icon]:text-brand-300",
  warning: "border-amber-400/35 bg-amber-500/15 [&_.toast-icon]:text-amber-300",
};

function ToastEntry({ id, message, type, onRemove }: ToastEntryProps) {
  const Icon = iconMap[type];
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // small delay so the enter animation runs
    timerRef.current = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(timerRef.current);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => onRemove(id), 280);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      onClick={dismiss}
      className={[
        "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300",
        "bg-app-850/95",
        styleMap[type],
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-3 opacity-0 scale-95",
      ].join(" ")}
      style={{
        transform: visible ? undefined : "translateY(12px) scale(0.95)",
      }}
    >
      <Icon className="toast-icon mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm font-medium text-white">{message}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="mt-0.5 text-app-200 hover:text-white"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type ToastProps = {
  items: ToastItem[];
  onRemove: (id: string) => void;
};

export function Toast({ items, onRemove }: ToastProps) {
  if (items.length === 0) return null;

  return (
    <div
      aria-label="Notificações do sistema"
      className="fixed bottom-24 right-4 z-100 flex w-[min(92vw,22rem)] flex-col gap-2 lg:bottom-6"
    >
      {items.map((item) => (
        <ToastEntry key={item.id} {...item} onRemove={onRemove} />
      ))}
    </div>
  );
}
