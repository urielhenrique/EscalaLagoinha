import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthInput } from "../components/auth/AuthInput";
import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";

type LocationState = {
  from?: string;
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination =
    (location.state as LocationState | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);

    if (!email || !senha) {
      setErro("Preencha email e senha para entrar.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email, senha });
      navigate(destination, { replace: true });
    } catch (error) {
      const rawMessage = getErrorMessage(
        error,
        "Não foi possível entrar. Tente novamente.",
      );

      const normalized = rawMessage.toLowerCase().includes("credenciais")
        ? "Email ou senha inválidos"
        : rawMessage;

      setErro(normalized);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse sua conta para visualizar sua escala."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="email"
          type="email"
          label="Email"
          placeholder="voce@igreja.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <AuthInput
          id="senha"
          type="password"
          label="Senha"
          placeholder="Sua senha"
          autoComplete="current-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
        />

        {erro ? (
          <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {erro}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link
          to="/recuperar-senha"
          className="text-brand-100 transition hover:text-brand-50"
        >
          Esqueci minha senha
        </Link>
        <Link
          to="/cadastro"
          className="text-brand-100 transition hover:text-brand-50"
        >
          Criar conta
        </Link>
      </div>
    </AuthLayout>
  );
}
