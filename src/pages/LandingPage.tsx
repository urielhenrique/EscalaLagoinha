import { ArrowRight, Building2, Church, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.22),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.2),transparent_35%),linear-gradient(180deg,#071121_0%,#0f172a_100%)] text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <div className="rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur md:p-12">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-100">
            Escala Lagoinha SaaS
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight md:text-6xl">
            Operação de voluntários com isolamento total por igreja.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-app-100 md:text-lg">
            Plataforma multi-unidade com onboarding em minutos, trilha auditável
            e experiência white-label para escalar ministérios sem perder
            governança.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-app-900 transition hover:bg-brand-400"
            >
              Começar implantação
              <Rocket className="h-4 w-4" />
            </Link>
            <Link
              to="/institucional"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Conhecer solução
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-500/10 px-5 py-3 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20"
            >
              Entrar
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Church className="h-5 w-5 text-brand-200" />
              <h2 className="mt-3 text-sm font-semibold">Multi-congregação</h2>
              <p className="mt-1 text-sm text-app-200">
                Cada igreja com dados, usuários e regras 100% isolados.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Building2 className="h-5 w-5 text-brand-200" />
              <h2 className="mt-3 text-sm font-semibold">White-label nativo</h2>
              <p className="mt-1 text-sm text-app-200">
                Domínio, cores, marca e políticas por unidade.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Rocket className="h-5 w-5 text-brand-200" />
              <h2 className="mt-3 text-sm font-semibold">Entrada guiada</h2>
              <p className="mt-1 text-sm text-app-200">
                Onboarding com conta administrativa e link de convite imediato.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
