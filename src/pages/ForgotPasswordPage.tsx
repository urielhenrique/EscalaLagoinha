import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthInput } from "../components/auth/AuthInput";
import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuth } from "../hooks/useAuth";

export function ForgotPasswordPage() {
  const { enviarRecuperacaoSenha } = useAuth();
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMensagem(null);
    setErro(null);

    if (!email) {
      setErro("Informe o email para receber o link de recuperação.");
      return;
    }

    setIsSubmitting(true);

    try {
      await enviarRecuperacaoSenha(email);
      setMensagem(
        "Se o email existir, enviaremos um link de recuperação em instantes.",
      );
    } catch {
      setErro("Não foi possível enviar o link agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperação de senha"
      subtitle="Informe seu email para receber o link de recuperação."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="emailRecuperacao"
          type="email"
          label="Email"
          placeholder="voce@igreja.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        {erro ? (
          <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {erro}
          </p>
        ) : null}

        {mensagem ? (
          <p className="rounded-xl border border-brand-400/25 bg-brand-500/10 px-3 py-2 text-sm text-brand-100">
            {mensagem}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Enviando..." : "Enviar link de recuperação"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        Lembrou sua senha?{" "}
        <Link
          to="/login"
          className="text-brand-100 transition hover:text-brand-50"
        >
          Voltar para login
        </Link>
      </div>
    </AuthLayout>
  );
}
