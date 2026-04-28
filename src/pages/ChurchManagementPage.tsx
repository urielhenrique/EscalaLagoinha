import { Building2, Plus, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  changeChurchAdminRole,
  createChurch,
  listChurchAdmins,
  listVisibleChurches,
} from "../services/churchesApi";
import { getErrorMessage } from "../services/api";
import type { ChurchItem, UserItem } from "../types/domain";

type CreateChurchForm = {
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  responsavelPrincipal: string;
};

const PERFIL_OPTIONS = [
  { value: "VOLUNTARIO", label: "Voluntário" },
  { value: "ADMIN", label: "Admin" },
  { value: "MASTER_ADMIN", label: "Master Admin" },
] as const;

export function ChurchManagementPage() {
  const [churches, setChurches] = useState<ChurchItem[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string>("");
  const [admins, setAdmins] = useState<UserItem[]>([]);
  const [form, setForm] = useState<CreateChurchForm>({
    nome: "",
    slug: "",
    cidade: "",
    estado: "",
    responsavelPrincipal: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedChurch = useMemo(
    () => churches.find((church) => church.id === selectedChurchId),
    [churches, selectedChurchId],
  );

  const load = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await listVisibleChurches();
      setChurches(response.data);
      const first = response.data[0]?.id;
      if (first) {
        setSelectedChurchId((current) => current || first);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar igrejas."));
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdmins = async (churchId: string) => {
    try {
      const response = await listChurchAdmins(churchId);
      setAdmins(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar admins da igreja."));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedChurchId) return;
    void loadAdmins(selectedChurchId);
  }, [selectedChurchId]);

  const handleCreateChurch = async () => {
    if (!form.nome || !form.slug) {
      setError("Nome e slug são obrigatórios.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      await createChurch({
        nome: form.nome,
        slug: form.slug,
        cidade: form.cidade || undefined,
        estado: form.estado || undefined,
        responsavelPrincipal: form.responsavelPrincipal || undefined,
      });
      setSuccess("Igreja criada com sucesso.");
      setForm({
        nome: "",
        slug: "",
        cidade: "",
        estado: "",
        responsavelPrincipal: "",
      });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao criar igreja."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (
    userId: string,
    perfil: "VOLUNTARIO" | "ADMIN" | "MASTER_ADMIN",
  ) => {
    if (!selectedChurchId) return;
    setError(null);
    setSuccess(null);

    try {
      await changeChurchAdminRole(selectedChurchId, userId, perfil);
      setAdmins((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, perfil } : user,
        ),
      );
      setSuccess("Perfil atualizado com sucesso.");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao alterar perfil."));
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-white">
          Gestão de Igrejas
        </h1>
        <p className="text-sm text-app-200">
          Estrutura multi-congregação para operação SaaS e crescimento
          comercial.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.6fr]">
        <article className="rounded-2xl border border-white/10 bg-app-850/60 p-4">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Plus className="h-4 w-4" />
            <h2 className="text-base font-semibold">Nova congregação</h2>
          </div>
          <div className="grid gap-3">
            <input
              value={form.nome}
              onChange={(e) => setForm((c) => ({ ...c, nome: e.target.value }))}
              placeholder="Nome da igreja"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-app-400"
            />
            <input
              value={form.slug}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/--+/g, "-"),
                }))
              }
              placeholder="slug-da-igreja"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-app-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.cidade}
                onChange={(e) =>
                  setForm((c) => ({ ...c, cidade: e.target.value }))
                }
                placeholder="Cidade"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-app-400"
              />
              <input
                value={form.estado}
                onChange={(e) =>
                  setForm((c) => ({ ...c, estado: e.target.value }))
                }
                placeholder="Estado"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-app-400"
              />
            </div>
            <input
              value={form.responsavelPrincipal}
              onChange={(e) =>
                setForm((c) => ({ ...c, responsavelPrincipal: e.target.value }))
              }
              placeholder="Responsável principal"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-app-400"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCreateChurch()}
              className="mt-1 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:opacity-60"
            >
              {isSaving ? "Criando..." : "Criar igreja"}
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-app-850/60 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">
              Administração por igreja
            </h2>
            <select
              value={selectedChurchId}
              onChange={(e) => setSelectedChurchId(e.target.value)}
              className="rounded-lg border border-white/15 bg-app-900 px-2 py-1.5 text-xs text-white"
            >
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.nome}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p className="text-sm text-app-300">Carregando igrejas...</p>
          ) : null}

          {selectedChurch ? (
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-app-900/40 p-3">
                <p className="text-[11px] uppercase text-app-300">Usuários</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {selectedChurch._count?.users ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-app-900/40 p-3">
                <p className="text-[11px] uppercase text-app-300">
                  Ministérios
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {selectedChurch._count?.ministries ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-app-900/40 p-3">
                <p className="text-[11px] uppercase text-app-300">Eventos</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {selectedChurch._count?.events ?? 0}
                </p>
              </div>
            </div>
          ) : null}

          <ul className="space-y-2">
            {admins.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-app-900/35 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {user.nome}
                  </p>
                  <p className="text-xs text-app-300">{user.email}</p>
                </div>
                <select
                  value={user.perfil}
                  onChange={(e) =>
                    void handleRoleChange(
                      user.id,
                      e.target.value as "VOLUNTARIO" | "ADMIN" | "MASTER_ADMIN",
                    )
                  }
                  className="rounded-lg border border-white/15 bg-app-900 px-2 py-1.5 text-xs text-white"
                >
                  {PERFIL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
            {admins.length === 0 ? (
              <li className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-sm text-app-300">
                Nenhum usuário ativo encontrado para esta igreja.
              </li>
            ) : null}
          </ul>
        </article>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-app-850/40 p-4">
          <div className="flex items-center gap-2 text-app-100">
            <Building2 className="h-4 w-4" />
            <p className="text-sm font-semibold">Tenant isolado</p>
          </div>
          <p className="mt-2 text-xs text-app-300">
            Cada igreja possui dados, admins e configurações próprios.
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-app-850/40 p-4">
          <div className="flex items-center gap-2 text-app-100">
            <Shield className="h-4 w-4" />
            <p className="text-sm font-semibold">Governança</p>
          </div>
          <p className="mt-2 text-xs text-app-300">
            Mudanças críticas de perfil são auditadas para rastreabilidade.
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-app-850/40 p-4">
          <div className="flex items-center gap-2 text-app-100">
            <Users className="h-4 w-4" />
            <p className="text-sm font-semibold">Escala comercial</p>
          </div>
          <p className="mt-2 text-xs text-app-300">
            Base pronta para planos e limites por unidade no futuro billing.
          </p>
        </article>
      </div>
    </section>
  );
}
