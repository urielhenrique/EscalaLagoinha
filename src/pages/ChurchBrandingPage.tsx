import { Palette, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getCurrentChurch,
  updateCurrentChurchSettings,
} from "../services/churchesApi";
import { getErrorMessage } from "../services/api";

export function ChurchBrandingPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0EA5E9");
  const [secondaryColor, setSecondaryColor] = useState("#22D3EE");
  const [accentColor, setAccentColor] = useState("#F59E0B");
  const [platformName, setPlatformName] = useState("Escala SaaS");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getCurrentChurch();
        const settings = response.data.settings;
        setLogoUrl(settings?.logoUrl ?? "");
        setPrimaryColor(settings?.primaryColor ?? "#0EA5E9");
        setSecondaryColor(settings?.secondaryColor ?? "#22D3EE");
        setAccentColor(settings?.accentColor ?? "#F59E0B");
        setPlatformName(settings?.customPlatformName ?? "Escala SaaS");
      } catch (err) {
        setError(getErrorMessage(err, "Falha ao carregar branding."));
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const previewStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 55%, ${accentColor} 100%)`,
    }),
    [primaryColor, secondaryColor, accentColor],
  );

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateCurrentChurchSettings({
        logoUrl,
        primaryColor,
        secondaryColor,
        accentColor,
        customPlatformName: platformName,
      });
      setSuccess("Identidade visual atualizada com sucesso.");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao salvar branding."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-white">
          Identidade Visual (White-label)
        </h1>
        <p className="text-sm text-app-200">
          Prepare o produto para domínio próprio, logo e tema por igreja.
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
          Carregando branding...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1.2fr]">
          <article className="rounded-2xl border border-white/10 bg-app-850/60 p-5">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Palette className="h-4 w-4" />
              <h2 className="text-base font-semibold">Configuração visual</h2>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-app-300">Nome da plataforma</span>
                <input
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-app-300">URL da logo</span>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://cdn.suaigreja.com/logo.svg"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-app-300">Primária</span>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/20 bg-transparent"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-app-300">Secundária</span>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/20 bg-transparent"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-app-300">Acento</span>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/20 bg-transparent"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void save()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar branding"}
            </button>
          </article>

          <article className="rounded-2xl border border-white/10 bg-app-850/60 p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.14em] text-app-300">
              Preview White-label
            </p>
            <div
              style={previewStyle}
              className="relative overflow-hidden rounded-2xl border border-white/25 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.3)]"
            >
              <div className="mb-4 flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-10 w-10 rounded-lg bg-white/90 object-contain p-1"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-sm font-bold text-app-900">
                    WL
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-white">
                    {platformName}
                  </p>
                  <p className="text-xs text-white/80">SaaS Edition</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-white/20 px-3 py-2 text-xs text-white">
                  Theme token: primary
                </div>
                <div className="rounded-lg bg-white/20 px-3 py-2 text-xs text-white">
                  Theme token: secondary
                </div>
                <div className="rounded-lg bg-white/20 px-3 py-2 text-xs text-white">
                  Theme token: accent
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
