import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarX2, LoaderCircle, Unlink } from "lucide-react";
import {
  getGoogleCalendarStatus,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  type GoogleCalendarStatus,
} from "../../services/googleCalendarApi";
import { getErrorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Skeleton } from "../ui/Skeleton";

export function GoogleCalendarSection() {
  const { success, error: toastError } = useToast();
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await getGoogleCalendarStatus();
      setStatus(response.data);
    } catch (err) {
      setLoadError(
        getErrorMessage(
          err,
          "Não foi possível verificar a conexão com o Google Calendar.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await connectGoogleCalendar();
      window.location.href = response.data.authorizationUrl;
    } catch (err) {
      toastError(
        getErrorMessage(err, "Falha ao iniciar conexão com o Google Calendar."),
      );
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      "Deseja desconectar o Google Calendar? Esta ação pode ser desfeita reconectando novamente.",
    );
    if (!confirmed) return;

    setIsDisconnecting(true);
    try {
      await disconnectGoogleCalendar();
      setStatus((prev) =>
        prev ? { ...prev, connected: false } : null,
      );
      success("Google Calendar desconectado com sucesso.");
    } catch (err) {
      toastError(
        getErrorMessage(err, "Falha ao desconectar o Google Calendar."),
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        id="google-calendar"
        className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <p className="text-xs uppercase tracking-[0.12em] text-app-300">
          Google Calendar
        </p>
        <div className="mt-3 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        id="google-calendar"
        className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <p className="text-xs uppercase tracking-[0.12em] text-app-300">
          Google Calendar
        </p>
        <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
        <button
          type="button"
          onClick={() => void fetchStatus()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
        >
          <LoaderCircle className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const connected = status?.connected === true;

  return (
    <div
      id="google-calendar"
      className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <p className="text-xs uppercase tracking-[0.12em] text-app-300">
        Google Calendar
      </p>
      <p className="mt-1 text-sm text-app-200">
        Conecte sua conta Google para integrar seus eventos ao Google Calendar.
      </p>

      {connected ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">
              Google Calendar conectado
            </span>
          </div>
          <button
            type="button"
            disabled={isDisconnecting}
            onClick={() => void handleDisconnect()}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/12 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
          >
            {isDisconnecting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4" />
            )}
            {isDisconnecting ? "Desconectando..." : "Desconectar Google Calendar"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarX2 className="h-4 w-4 text-app-400" />
            <span className="text-sm text-app-200">Não conectado</span>
          </div>
          <button
            type="button"
            disabled={isConnecting}
            onClick={() => void handleConnect()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-app-900 transition hover:bg-brand-400 disabled:opacity-60"
          >
            {isConnecting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarCheck2 className="h-4 w-4" />
            )}
            {isConnecting ? "Conectando..." : "Conectar Google Calendar"}
          </button>
        </div>
      )}
    </div>
  );
}
