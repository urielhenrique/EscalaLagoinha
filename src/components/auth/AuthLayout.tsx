import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="absolute inset-0 -z-10 opacity-80">
        <div className="absolute left-[-10%] top-[-25%] h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-8%] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-app-850/65 shadow-[0_20px_80px_rgba(2,8,18,0.6)] backdrop-blur-xl lg:grid-cols-2">
        <aside className="hidden border-r border-white/10 bg-gradient-to-b from-white/8 to-transparent p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-100/80">
              Escala Lagoinha
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-white">
              Church Volunteer Manager
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-app-200">
              Plataforma para organizar escalas, voluntários e ministérios da
              Lagoinha Jardim Atlântico com clareza e agilidade.
            </p>
          </div>

          <div className="animate-fade rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-app-200">
            Experiência visual premium inspirada em SaaS modernos, pronta para
            integração com API real nas próximas etapas.
          </div>
        </aside>

        <div className="animate-rise p-6 sm:p-8 lg:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-100/80">
            Bem-vindo
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 text-sm text-app-200">{subtitle}</p>

          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 text-sm text-app-200">{footer}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
