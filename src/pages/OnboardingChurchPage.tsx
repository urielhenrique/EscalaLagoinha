import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onboardingChurchRequest } from "../services/authApi";
import { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function OnboardingChurchPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [churchName, setChurchName] = useState("");
  const [churchSlug, setChurchSlug] = useState("");
  const [churchAddress, setChurchAddress] = useState("");
  const [churchCity, setChurchCity] = useState("");
  const [churchState, setChurchState] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = useMemo(() => {
    return adminPassword.length > 0 && adminPassword === confirmPassword;
  }, [adminPassword, confirmPassword]);

  const handleChurchNameBlur = () => {
    if (!churchSlug && churchName) {
      setChurchSlug(slugify(churchName));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!passwordsMatch) {
      setError("As senhas do administrador não conferem.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onboardingChurchRequest({
        churchName,
        churchSlug: slugify(churchSlug),
        churchAddress,
        churchCity,
        churchState,
        responsibleName,
        adminName,
        adminEmail,
        adminPhone,
        adminPassword,
      });

      await login({ email: adminEmail, senha: adminPassword });
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Falha ao concluir onboarding."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-app-900 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-brand-100">
            Onboarding
          </p>
          <h1 className="font-display text-3xl md:text-4xl">
            Implante sua igreja em poucos minutos
          </h1>
          <p className="text-sm text-app-200">
            Criamos sua unidade, plano trial e usuário master admin em um único
            passo.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              value={churchName}
              onBlur={handleChurchNameBlur}
              onChange={(e) => setChurchName(e.target.value)}
              placeholder="Nome da igreja"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              value={churchSlug}
              onChange={(e) => setChurchSlug(e.target.value)}
              placeholder="slug-da-igreja"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              value={churchAddress}
              onChange={(e) => setChurchAddress(e.target.value)}
              placeholder="Endereço"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              required
              value={churchCity}
              onChange={(e) => setChurchCity(e.target.value)}
              placeholder="Cidade"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              value={churchState}
              onChange={(e) => setChurchState(e.target.value)}
              placeholder="UF"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Responsável principal"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Nome do admin"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="Email do admin"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="Telefone do admin"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              minLength={6}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Senha inicial"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              required
              minLength={6}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar senha"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
          </div>

          {error ? (
            <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:opacity-60"
            >
              {isSubmitting ? "Implantando..." : "Concluir onboarding"}
            </button>
            <Link
              to="/"
              className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold"
            >
              Voltar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
