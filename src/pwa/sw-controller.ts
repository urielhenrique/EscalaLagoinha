type InstallOutcome = "accepted" | "dismissed" | "unavailable";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }

  interface WindowEventMap {
    "pwa:install-available": Event;
    "pwa:update-available": Event;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let pendingRegistration: ServiceWorkerRegistration | null = null;

function emit(eventName: keyof WindowEventMap) {
  window.dispatchEvent(new Event(eventName));
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const shouldRegister = import.meta.env.PROD || import.meta.env.DEV;
  if (!shouldRegister) {
    return;
  }

  void navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      if (registration.waiting) {
        pendingRegistration = registration;
        emit("pwa:update-available");
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) {
          return;
        }

        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            pendingRegistration = registration;
            emit("pwa:update-available");
          }
        });
      });
    })
    .catch((error) => {
      console.error("Falha ao registrar service worker", error);
    });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit("pwa:install-available");
  });
}

export function isInstallAvailable() {
  return Boolean(deferredPrompt);
}

export async function promptInstall(): Promise<InstallOutcome> {
  if (!deferredPrompt) {
    return "unavailable";
  }

  const installEvent = deferredPrompt;
  deferredPrompt = null;

  await installEvent.prompt();
  const choice = await installEvent.userChoice;
  return choice.outcome;
}

export function isUpdateAvailable() {
  return Boolean(pendingRegistration?.waiting);
}

export function applyPendingUpdate() {
  if (!pendingRegistration?.waiting) {
    return;
  }

  pendingRegistration.waiting.postMessage({ type: "SKIP_WAITING" });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return;
    }
    refreshing = true;
    window.location.reload();
  });
}
