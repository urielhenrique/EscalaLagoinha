import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-0 py-0 sm:items-center sm:px-4 sm:py-8">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-app-900/80 backdrop-blur-sm"
        aria-label="Fechar modal"
      />

      <section className="relative z-10 w-full max-w-2xl animate-rise overflow-hidden rounded-t-3xl border border-white/15 bg-linear-to-b from-app-800/95 to-app-900/95 shadow-[0_28px_90px_rgba(1,5,13,0.65)] sm:rounded-3xl">
        <header className="flex items-start justify-between border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h3 className="font-display text-lg font-semibold text-white">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-app-200">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-app-100 transition hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[65vh] sm:px-6 sm:py-5">
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
