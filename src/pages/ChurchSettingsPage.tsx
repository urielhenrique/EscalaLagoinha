import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createCurrentChurchInviteLink,
  getCurrentChurch,
  updateCurrentChurchSettings,
} from "../services/churchesApi";
import { getErrorMessage } from "../services/api";

type SettingsForm = {
  customChurchName: string;
  customPlatformName: string;
  defaultEmailFrom: string;
  approvalPolicy: "MANUAL" | "AUTO";
  reminderLeadMinutes: number;
  customDomain: string;
};

export function ChurchSettingsPage() {
  const [churchName, setChurchName] = useState("");
  const [form, setForm] = useState<SettingsForm>({
    customChurchName: "",
    customPlatformName: "",
    defaultEmailFrom: "",
    approvalPolicy: "MANUAL",
    reminderLeadMinutes: 1440,
    customDomain: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteMinistry, setInviteMinistry] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getCurrentChurch();
        const church = response.data;
        const settings = church.settings;

        setChurchName(church.nome);
        setForm({
          customChurchName: settings?.customChurchName ?? "",
          customPlatformName: settings?.customPlatformName ?? "",
          defaultEmailFrom: settings?.defaultEmailFrom ?? "",
          approvalPolicy: settings?.approvalPolicy ?? "MANUAL",
          reminderLeadMinutes: settings?.reminderLeadMinutes ?? 1440,
          customDomain: settings?.customDomain ?? "",
        });
      } catch (err) {
        setError(getErrorMessage(err, "Falha ao carregar configurações."));
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateCurrentChurchSettings(form);
      setSuccess("Configurações salvas com sucesso.");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao salvar configurações."));
    } finally {
      setIsSaving(false);
    }
  };

  const generateInvite = async () => {
    setIsGeneratingInvite(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await createCurrentChurchInviteLink({
        ministryName: inviteMinistry.trim() || undefined,
      });

      setInviteUrl(response.data.inviteUrl);
      setSuccess("Link de convite gerado com sucesso.");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao gerar link de convite."));
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-white">
          Configurações da Igreja
        </h1>
        <p className="text-sm text-app-200">
          Personalize regras operacionais da unidade: aprovação, reminders e
          domínio.
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

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-app-200">
          Carregando configurações...
        </div>
      ) : (
        <article className="rounded-2xl border border-white/10 bg-app-850/60 p-5">
          <p className="mb-4 text-xs uppercase tracking-[0.12em] text-app-300">
            Unidade atual: {churchName}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-app-300">
                Nome público da igreja
              </span>
              <input
                value={form.customChurchName}
                onChange={(e) =>
                  setForm((c) => ({ ...c, customChurchName: e.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-app-300">Nome da plataforma</span>
              <input
                value={form.customPlatformName}
                onChange={(e) =>
                  setForm((c) => ({ ...c, customPlatformName: e.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-app-300">E-mail padrão</span>
              <input
                type="email"
                value={form.defaultEmailFrom}
                onChange={(e) =>
                  setForm((c) => ({ ...c, defaultEmailFrom: e.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-app-300">
                Política de aprovação
              </span>
              <select
                value={form.approvalPolicy}
                onChange={(e) =>
                  setForm((c) => ({
                    ...c,
                    approvalPolicy: e.target.value as "MANUAL" | "AUTO",
                  }))
                }
                className="w-full rounded-xl border border-white/15 bg-app-900 px-3 py-2 text-sm text-white"
              >
                <option value="MANUAL">Manual</option>
                <option value="AUTO">Automática</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-app-300">
                Lembrete (minutos antes)
              </span>
              <input
                type="number"
                min={15}
                value={form.reminderLeadMinutes}
                onChange={(e) =>
                  setForm((c) => ({
                    ...c,
                    reminderLeadMinutes: Number(e.target.value),
                  }))
                }
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-app-300">Domínio customizado</span>
              <input
                value={form.customDomain}
                onChange={(e) =>
                  setForm((c) => ({ ...c, customDomain: e.target.value }))
                }
                placeholder="escala.suaigreja.com"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar configurações"}
          </button>

          <div
            id="ministerios"
            className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-app-300">
              Ministérios
            </p>
            <p className="mt-1 text-sm text-app-200">
              Para criar, editar e organizar ministérios da sua igreja, acesse a
              tela de gestão operacional.
            </p>

            <a
              href="/gestao-escalas"
              className="mt-3 inline-flex items-center rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20"
            >
              Ir para Gestão de Escalas
            </a>
          </div>

          <div
            id="convite-link"
            className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-app-300">
              Convite por link
            </p>
            <p className="mt-1 text-sm text-app-200">
              Gere um link para cadastro de voluntários já vinculado à sua
              igreja.
            </p>

            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                value={inviteMinistry}
                onChange={(e) => setInviteMinistry(e.target.value)}
                placeholder="Ministério sugerido (opcional)"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                disabled={isGeneratingInvite}
                onClick={() => void generateInvite()}
                className="rounded-xl border border-brand-400/35 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/20 disabled:opacity-60"
              >
                {isGeneratingInvite ? "Gerando..." : "Gerar link"}
              </button>
            </div>

            {inviteUrl ? (
              <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
                <p className="text-xs text-emerald-200">Link pronto:</p>
                <p className="mt-1 break-all text-sm text-emerald-100">
                  {inviteUrl}
                </p>
              </div>
            ) : null}
          </div>
        </article>
      )}
    </section>
  );
}
