import { Download, RefreshCw, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyPendingUpdate,
  isInstallAvailable,
  isUpdateAvailable,
  promptInstall,
} from "../../pwa/sw-controller";

export function PwaExperience() {
  const [canInstall, setCanInstall] = useState(isInstallAvailable());
  const [canUpdate, setCanUpdate] = useState(isUpdateAvailable());
  const [installDismissed, setInstallDismissed] = useState(
    () => sessionStorage.getItem("pwa-install-dismissed") === "1",
  );

  useEffect(() => {
    const refreshState = () => {
      setCanInstall(isInstallAvailable());
      setCanUpdate(isUpdateAvailable());
    };

    window.addEventListener("pwa:install-available", refreshState);
    window.addEventListener("pwa:update-available", refreshState);

    return () => {
      window.removeEventListener("pwa:install-available", refreshState);
      window.removeEventListener("pwa:update-available", refreshState);
    };
  }, []);

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome !== "unavailable") {
      setCanInstall(false);
    }
  };

  const handleDismissInstall = () => {
    sessionStorage.setItem("pwa-install-dismissed", "1");
    setInstallDismissed(true);
  };

  const showInstall = canInstall && !installDismissed;

  return (
    <>
      {/* Banner de instalação */}
      {showInstall ? (
        <div className="fixed bottom-18 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-rise rounded-2xl border border-brand-400/30 bg-app-850/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
          <button
            type="button"
            onClick={handleDismissInstall}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-app-200 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-400/35 bg-brand-500/15 text-brand-100">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                Instalar no celular
              </p>
              <p className="text-xs text-app-200">
                Acesse mais rápido, sem abrir o navegador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleInstall()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-400/40 bg-brand-500/20 py-2.5 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/28"
          >
            <Download className="h-4 w-4" />
            Instalar agora
          </button>
        </div>
      ) : null}

      {/* Banner de atualização */}
      {canUpdate ? (
        <div className="fixed bottom-18 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-rise rounded-2xl border border-white/15 bg-app-850/98 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
          <p className="text-sm font-semibold text-white">
            Nova versão disponível
          </p>
          <p className="mt-1 text-xs text-app-200">
            Uma atualização com melhorias está pronta para ser aplicada.
          </p>
          <button
            type="button"
            onClick={applyPendingUpdate}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-400/40 bg-brand-500/20 py-2.5 text-sm font-semibold text-brand-100 transition hover:bg-brand-500/28"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar aplicativo
          </button>
        </div>
      ) : null}
    </>
  );
}
