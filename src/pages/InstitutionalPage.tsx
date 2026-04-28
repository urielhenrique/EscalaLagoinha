import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const pillars = [
  "Isolamento por igreja em todas as operações críticas",
  "Gestão de admins por unidade com trilha de auditoria",
  "Escalas, trocas, presença e alertas em um único fluxo",
  "Painel executivo e ranking para engajamento sustentável",
  "Onboarding self-service com período de trial",
];

export function InstitutionalPage() {
  return (
    <main className="min-h-screen bg-app-900 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-100">
            Institucional
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">
            Plataforma para operação ministerial em escala SaaS.
          </h1>
          <p className="mt-4 max-w-3xl text-app-100">
            Estruturamos governança, previsibilidade e crescimento para redes de
            igrejas que precisam padronizar processos e manter autonomia local.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {pillars.map((item) => (
            <article
              key={item}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <p className="text-sm text-app-100">{item}</p>
              </div>
            </article>
          ))}
        </section>

        <footer className="flex flex-wrap gap-3">
          <Link
            to="/onboarding"
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-app-900 transition hover:bg-brand-400"
          >
            Iniciar onboarding
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Voltar para landing
          </Link>
        </footer>
      </div>
    </main>
  );
}
