import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpCircle, X } from "lucide-react";
import { createPortal } from "react-dom";

// ─── ContextualHelp (tooltip/popover) ─────────────────────────────────────

type ContextualHelpProps = {
  title?: string;
  content: string;
  children?: ReactNode;
  /** Posição preferida do popover */
  placement?: "top" | "bottom" | "left" | "right";
  /** Se verdadeiro, mostra apenas ícone de interrogação */
  iconOnly?: boolean;
};

export function ContextualHelp({
  title,
  content,
  children,
  placement = "top",
  iconOnly = false,
}: ContextualHelpProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const positionClasses = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-app-700",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-app-700",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-app-700",
    right:
      "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-app-700",
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-lg text-app-400 transition-colors hover:text-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        aria-label="Ajuda contextual"
        aria-expanded={open}
      >
        {iconOnly ? (
          <HelpCircle className="h-4 w-4" />
        ) : (
          (children ?? <HelpCircle className="h-4 w-4" />)
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="tooltip"
          className={[
            "absolute z-50 w-64 rounded-xl border border-white/15 bg-app-750 p-4 shadow-2xl",
            positionClasses[placement],
          ].join(" ")}
        >
          {/* Arrow */}
          <span
            className={[
              "absolute h-0 w-0 border-4",
              arrowClasses[placement],
            ].join(" ")}
          />
          <button
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 rounded-md p-0.5 text-app-500 transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {title && (
            <p className="mb-1.5 pr-4 text-sm font-semibold text-white">
              {title}
            </p>
          )}
          <p className="text-xs leading-relaxed text-app-300">{content}</p>
        </div>
      )}
    </span>
  );
}

// ─── InlineHint — dica inline discreta ────────────────────────────────────

type InlineHintProps = {
  children: ReactNode;
  variant?: "info" | "tip" | "warning";
};

export function InlineHint({ children, variant = "info" }: InlineHintProps) {
  const variantStyles = {
    info: "border-sky-400/30 bg-sky-500/10 text-sky-300",
    tip: "border-brand-400/30 bg-brand-500/10 text-brand-300",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  };

  const icons = {
    info: "ℹ️",
    tip: "💡",
    warning: "⚠️",
  };

  return (
    <div
      className={[
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
        variantStyles[variant],
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0 text-base">{icons[variant]}</span>
      <span>{children}</span>
    </div>
  );
}

// ─── OnboardingStep — passo de onboarding ─────────────────────────────────

export type OnboardingStepDef = {
  title: string;
  description: string;
  action?: string;
  href?: string;
};

type OnboardingGuideProps = {
  steps: OnboardingStepDef[];
  title?: string;
  onDismiss?: () => void;
};

export function OnboardingGuide({
  steps,
  title = "Por onde começar?",
  onDismiss,
}: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="relative rounded-2xl border border-brand-400/30 bg-linear-to-br from-brand-500/15 via-app-800 to-violet-500/10 p-6">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-app-400 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Fechar guia"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">
          {title}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-5 flex gap-1.5">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className={[
              "h-1.5 rounded-full transition-all",
              i === currentStep
                ? "w-6 bg-brand-400"
                : i < currentStep
                  ? "w-4 bg-brand-600"
                  : "w-4 bg-app-600",
            ].join(" ")}
            aria-label={`Passo ${i + 1}`}
          />
        ))}
      </div>

      <h3 className="mb-2 font-display text-lg font-bold text-white">
        {step.title}
      </h3>
      <p className="mb-5 text-sm text-app-300">{step.description}</p>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleDismiss}
          className="text-sm text-app-400 transition-colors hover:text-white"
        >
          Pular guia
        </button>
        <div className="flex gap-2">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep((s) => s - 1)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-app-200 transition-colors hover:bg-white/8"
            >
              Anterior
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleDismiss}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
            >
              Concluir ✓
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
            >
              Próximo →
            </button>
          )}
        </div>
      </div>

      {step.action && step.href && (
        <a
          href={step.href}
          className="mt-3 block text-center text-sm font-medium text-brand-400 transition-colors hover:text-brand-300"
        >
          {step.action} →
        </a>
      )}
    </div>
  );
}
