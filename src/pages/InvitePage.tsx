import { Link, useSearchParams } from "react-router-dom";

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const church = searchParams.get("church");
  const ministry = searchParams.get("ministry");

  const registerHref = `/cadastro${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <main className="min-h-screen bg-app-900 px-6 py-12 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.16em] text-brand-100">
          Convite de voluntariado
        </p>
        <h1 className="mt-3 font-display text-3xl">Você foi convidado(a)</h1>
        <p className="mt-3 text-sm text-app-200">
          {church
            ? `Cadastro vinculado à igreja ${church}.`
            : "Cadastro em ambiente multi-igreja."}
        </p>
        {ministry ? (
          <p className="mt-2 text-sm text-app-200">
            Ministério sugerido: <strong>{ministry}</strong>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <Link
            to={registerHref}
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-app-900 transition hover:bg-brand-400"
          >
            Continuar cadastro
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Já tenho conta
          </Link>
        </div>
      </div>
    </main>
  );
}
