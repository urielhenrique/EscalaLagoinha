import { Camera, Save, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { updateMyProfileRequest } from "../services/authApi";

type ProfileForm = {
  nome: string;
  email: string;
  telefone: string;
  foto: string;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Falha ao ler arquivo de imagem."));
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem."));
    reader.readAsDataURL(file);
  });
}

export function MyProfilePage() {
  const { user, getProfile } = useAuth();
  const [form, setForm] = useState<ProfileForm>({
    nome: "",
    email: "",
    telefone: "",
    foto: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  useEffect(() => {
    setForm({
      nome: user?.nome ?? "",
      email: user?.email ?? "",
      telefone: user?.telefone ?? "",
      foto: user?.foto ?? "",
    });
    setPreviewBroken(false);
  }, [user]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido (PNG, JPG, WEBP...).");
      event.currentTarget.value = "";
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError("A imagem deve ter no máximo 5MB.");
      event.currentTarget.value = "";
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((current) => ({ ...current, foto: dataUrl }));
      setPreviewBroken(false);
      setSuccess("Pré-visualização da foto atualizada. Clique em salvar.");
    } catch {
      setError("Não foi possível processar o arquivo da foto.");
    } finally {
      event.currentTarget.value = "";
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateMyProfileRequest({
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        foto: form.foto.trim() || undefined,
      });
      await getProfile();
      setSuccess("Perfil atualizado com sucesso.");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível atualizar seu perfil."));
    } finally {
      setIsSaving(false);
    }
  };

  const initials = form.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Meu Perfil"
        subtitle="Complete e mantenha seus dados atualizados"
      />

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

      <article className="rounded-2xl border border-white/10 bg-app-850/60 p-5">
        <div className="mb-5 flex items-center gap-4">
          {form.foto && !previewBroken ? (
            <img
              src={form.foto}
              alt="Foto do perfil"
              className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
              onError={() => setPreviewBroken(true)}
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-lg font-semibold text-white">
              {initials || <UserCircle2 className="h-8 w-8 text-app-300" />}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white">
              {form.nome || "Seu nome"}
            </p>
            <p className="text-xs text-app-300">
              {form.email || "seu@email.com"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-app-300">Nome completo</span>
            <input
              value={form.nome}
              onChange={(e) => setForm((c) => ({ ...c, nome: e.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Seu nome"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-app-300">E-mail</span>
            <input
              value={form.email}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-300"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-app-300">Telefone</span>
            <input
              value={form.telefone}
              onChange={(e) =>
                setForm((c) => ({ ...c, telefone: e.target.value }))
              }
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="(00) 90000-0000"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-app-300">URL da foto</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
              <Camera className="h-4 w-4 text-app-300" />
              <input
                value={form.foto}
                onChange={(e) => {
                  setForm((c) => ({ ...c, foto: e.target.value }));
                  setPreviewBroken(false);
                }}
                className="w-full bg-transparent text-sm text-white outline-none"
                placeholder="https://..."
              />
            </div>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-app-300">
              Enviar foto do dispositivo
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void handleFileChange(e)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-app-200 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-100 hover:file:bg-brand-500/30"
            />
            <p className="text-xs text-app-400">
              PNG, JPG ou WEBP com até 5MB.
            </p>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </button>
      </article>
    </section>
  );
}
