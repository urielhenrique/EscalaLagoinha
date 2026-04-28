import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthInput } from "../components/auth/AuthInput";
import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";

const ministerios = [
  "Louvor",
  "Mídia",
  "Recepção",
  "Kids",
  "Intercessão",
  "Produção",
];

export function RegisterPage() {
  const { solicitarCadastro } = useAuth();
  const [searchParams] = useSearchParams();

  const churchSlug = searchParams.get("church") ?? undefined;
  const ministryFromInvite = searchParams.get("ministry");
  const ministerioOptions = useMemo(() => {
    if (ministryFromInvite && !ministerios.includes(ministryFromInvite)) {
      return [ministryFromInvite, ...ministerios];
    }

    return ministerios;
  }, [ministryFromInvite]);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [ministerioInteresse, setMinisterioInteresse] = useState(
    ministryFromInvite && ministerios.includes(ministryFromInvite)
      ? ministryFromInvite
      : ministerios[0],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const senhasDiferentes = useMemo(() => {
    return (
      senha.length > 0 && confirmarSenha.length > 0 && senha !== confirmarSenha
    );
  }, [confirmarSenha, senha]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setMensagem(null);

    if (!nomeCompleto || !email || !telefone || !senha || !confirmarSenha) {
      setErro("Preencha todos os campos para solicitar o cadastro.");
      return;
    }

    if (senhasDiferentes) {
      setErro("As senhas não conferem.");
      return;
    }

    setIsSubmitting(true);

    try {
      await solicitarCadastro({
        nomeCompleto,
        email,
        telefone,
        senha,
        confirmarSenha,
        ministerioInteresse,
        churchSlug,
      });

      setMensagem("Seu cadastro foi enviado com sucesso");
      setNomeCompleto("");
      setEmail("");
      setTelefone("");
      setSenha("");
      setConfirmarSenha("");
    } catch (error) {
      setErro(
        getErrorMessage(
          error,
          "Não foi possível enviar sua solicitação agora.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Cadastro de voluntário"
      subtitle="Preencha os dados para solicitar participação nos ministérios."
    >
      {churchSlug ? (
        <p className="mb-4 rounded-xl border border-brand-400/25 bg-brand-500/10 px-3 py-2 text-xs text-brand-100">
          Convite identificado para a igreja: <strong>{churchSlug}</strong>
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="nomeCompleto"
          type="text"
          label="Nome completo"
          placeholder="Seu nome"
          value={nomeCompleto}
          onChange={(event) => setNomeCompleto(event.target.value)}
        />

        <AuthInput
          id="emailCadastro"
          type="email"
          label="Email"
          placeholder="voce@igreja.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <AuthInput
          id="telefone"
          type="tel"
          label="Telefone"
          placeholder="(62) 99999-9999"
          value={telefone}
          onChange={(event) => setTelefone(event.target.value)}
        />

        <AuthInput
          id="senhaCadastro"
          type="password"
          label="Senha"
          placeholder="Crie uma senha"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
        />

        <AuthInput
          id="confirmarSenha"
          type="password"
          label="Confirmar senha"
          placeholder="Repita a senha"
          value={confirmarSenha}
          onChange={(event) => setConfirmarSenha(event.target.value)}
        />

        <label htmlFor="ministerioInteresse" className="block space-y-2">
          <span className="text-sm font-medium text-app-100">
            Ministério de interesse
          </span>
          <select
            id="ministerioInteresse"
            value={ministerioInteresse}
            onChange={(event) => setMinisterioInteresse(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/30"
          >
            {ministerioOptions.map((ministerio) => (
              <option
                key={ministerio}
                value={ministerio}
                className="bg-app-850 text-white"
              >
                {ministerio}
              </option>
            ))}
          </select>
        </label>

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
          {isSubmitting ? "Enviando..." : "Solicitar cadastro"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        Já possui conta?{" "}
        <Link
          to="/login"
          className="text-brand-100 transition hover:text-brand-50"
        >
          Entrar
        </Link>
      </div>
    </AuthLayout>
  );
}
