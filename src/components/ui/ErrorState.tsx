import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Algo deu errado",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="animate-fade rounded-2xl border border-rose-400/20 bg-rose-500/8 px-6 py-10 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/12 text-rose-300">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="font-display text-base font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-app-200">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/12"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
