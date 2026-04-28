import { RefreshCw, ShieldCheck, UserCog, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  deactivateUser,
  listAllUsers,
  listPendingUsers,
  updateUserProfile,
} from "../services/adminApi";
import { getErrorMessage } from "../services/api";
import type { UserItem } from "../types/domain";

type Perfil = "VOLUNTARIO" | "ADMIN" | "MASTER_ADMIN" | "MASTER_PLATFORM_ADMIN";

const PERFIL_LABEL: Record<Perfil, string> = {
  VOLUNTARIO: "Voluntário",
  ADMIN: "Admin",
  MASTER_ADMIN: "Master Admin",
  MASTER_PLATFORM_ADMIN: "Platform Admin",
};

const PERFIL_COLOR: Record<Perfil, string> = {
  VOLUNTARIO: "text-app-300 bg-white/5 border-white/10",
  ADMIN: "text-violet-300 bg-violet-500/10 border-violet-400/20",
  MASTER_ADMIN: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  MASTER_PLATFORM_ADMIN: "text-cyan-300 bg-cyan-500/10 border-cyan-400/20",
};

type KpiCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
};

function KpiCard({ label, value, icon }: KpiCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-app-850/60 p-4 flex items-center gap-4">
      <div className="rounded-xl bg-white/5 p-3 text-app-300">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-app-300">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      </div>
    </article>
  );
}

export function MasterAdminPage() {
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    setErro(null);
    setIsLoading(true);
    try {
      const [usersRes, pendingRes] = await Promise.all([
        listAllUsers(),
        listPendingUsers(),
      ]);
      setAllUsers(usersRes.data);
      setPendingUsers(pendingRes.data);
    } catch (error) {
      setErro(getErrorMessage(error, "Falha ao carregar painel master."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleChangePerfil = async (user: UserItem, novoPerfil: Perfil) => {
    if (user.perfil === novoPerfil) return;
    setProcessingId(user.id);
    setErro(null);
    setSucesso(null);
    try {
      await updateUserProfile(user.id, novoPerfil);
      setAllUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, perfil: novoPerfil } : u)),
      );
      setSucesso(`${user.nome} agora é ${PERFIL_LABEL[novoPerfil]}.`);
    } catch (error) {
      setErro(getErrorMessage(error, "Falha ao alterar perfil."));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeactivate = async (user: UserItem) => {
    if (!confirm(`Desativar ${user.nome}? Ele perderá o acesso ao sistema.`))
      return;
    setProcessingId(user.id);
    setErro(null);
    setSucesso(null);
    try {
      await deactivateUser(user.id);
      setAllUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSucesso(`${user.nome} foi desativado.`);
    } catch (error) {
      setErro(getErrorMessage(error, "Falha ao desativar usuário."));
    } finally {
      setProcessingId(null);
    }
  };

  const voluntarios = useMemo(
    () => allUsers.filter((u) => u.perfil === "VOLUNTARIO"),
    [allUsers],
  );
  const adminUsers = useMemo(
    () => allUsers.filter((u) => u.perfil === "ADMIN"),
    [allUsers],
  );
  const masterUsers = useMemo(
    () => allUsers.filter((u) => u.perfil === "MASTER_ADMIN"),
    [allUsers],
  );

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return allUsers;
    return allUsers.filter(
      (u) =>
        u.nome.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
    );
  }, [allUsers, searchTerm]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Painel Master Admin
          </h1>
          <p className="text-sm text-app-200">
            Gerencie perfis e permissões de todos os usuários da plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-app-100 transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </header>

      {erro ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {erro}
        </div>
      ) : null}

      {sucesso ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {sucesso}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-app-200">
          Carregando painel...
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <KpiCard
              label="Masters"
              value={masterUsers.length}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <KpiCard
              label="Admins"
              value={adminUsers.length}
              icon={<UserCog className="h-5 w-5" />}
            />
            <KpiCard
              label="Voluntários"
              value={voluntarios.length}
              icon={<Users className="h-5 w-5" />}
            />
            <KpiCard
              label="Pendentes"
              value={pendingUsers.length}
              icon={<Users className="h-5 w-5" />}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-app-200">
              Como promover um voluntário a Admin de ministério:
            </p>
            <ol className="ml-4 list-decimal space-y-1 text-sm text-app-300">
              <li>
                Primeiro aprove o cadastro dele na página{" "}
                <strong className="text-app-100">
                  Aprovação de voluntários
                </strong>
                .
              </li>
              <li>
                Localize o usuário na tabela abaixo e use o seletor de perfil.
              </li>
              <li>
                Escolha <strong className="text-violet-300">Admin</strong> — ele
                ganhará acesso ao painel administrativo completo.
              </li>
            </ol>
          </div>

          <article className="rounded-2xl border border-white/10 bg-app-850/60 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                Todos os usuários ({allUsers.length})
              </h2>
              <input
                type="search"
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-app-400 outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/30 w-64"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-app-400">
                    <th className="pb-2 pr-4">Usuário</th>
                    <th className="pb-2 pr-4">Perfil atual</th>
                    <th className="pb-2 pr-4">Alterar para</th>
                    <th className="pb-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((user) => {
                    const perfil = user.perfil as Perfil;
                    const isProcessing = processingId === user.id;
                    const isPlatform = perfil === "MASTER_PLATFORM_ADMIN";

                    return (
                      <tr key={user.id} className="group">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-white">{user.nome}</p>
                          <p className="text-xs text-app-300">{user.email}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${PERFIL_COLOR[perfil] ?? "text-app-300"}`}
                          >
                            {PERFIL_LABEL[perfil] ?? perfil}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            disabled={isProcessing || isPlatform}
                            value={perfil}
                            onChange={(e) =>
                              void handleChangePerfil(
                                user,
                                e.target.value as Perfil,
                              )
                            }
                            className="rounded-lg border border-white/15 bg-app-900 px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400/50 disabled:opacity-50"
                          >
                            <option value="VOLUNTARIO">Voluntário</option>
                            <option value="ADMIN">Admin</option>
                            <option value="MASTER_ADMIN">Master Admin</option>
                            <option value="MASTER_PLATFORM_ADMIN">
                              Platform Admin
                            </option>
                          </select>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            disabled={
                              isProcessing ||
                              perfil === "MASTER_ADMIN" ||
                              isPlatform
                            }
                            onClick={() => void handleDeactivate(user)}
                            className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            Desativar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-sm text-app-400"
                      >
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
