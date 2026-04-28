import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthInput } from "../components/auth/AuthInput";
import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";

export function ResetPasswordPage() {
  const { redefinirSenha } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setMensagem(null);

    if (!token) {
      setErro("Token inválido. Solicite um novo link de recuperação.");
      return;
    }

    if (!novaSenha || novaSenha.length < 8) {
      setErro("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não conferem.");
      return;
    }

    setIsSubmitting(true);

    try {
      await redefinirSenha(token, novaSenha);
      setMensagem("Senha redefinida com sucesso. Agora você já pode entrar.");
      setNovaSenha("");
      setConfirmarSenha("");
    } catch (error) {
      setErro(
        getErrorMessage(
          error,
          "Não foi possível redefinir a senha. Solicite um novo link.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Redefinir senha"
      subtitle="Digite uma nova senha para acessar sua conta."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="novaSenha"
          type="password"
          label="Nova senha"
          placeholder="Digite sua nova senha"
          value={novaSenha}
          onChange={(event) => setNovaSenha(event.target.value)}
        />

        <AuthInput
          id="confirmarNovaSenha"
          type="password"
          label="Confirmar nova senha"
          placeholder="Repita sua nova senha"
          value={confirmarSenha}
          onChange={(event) => setConfirmarSenha(event.target.value)}
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
          {isSubmitting ? "Atualizando..." : "Redefinir senha"}
        </button>
      </form>

      <div className="mt-4 text-sm">
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
