import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";

export function GoogleCallbackHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const googleCalendar = params.get("google_calendar");

    if (!googleCalendar) return;

    const googleError = params.get("google_error");

    if (googleCalendar === "connected") {
      success("Google Calendar conectado com sucesso.");
    } else if (googleCalendar === "error") {
      toastError(googleError || "Erro ao conectar com o Google Calendar.");
    }

    const cleanUrl = location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    if (location.pathname === "/") {
      navigate("/meu-perfil", { replace: true });
    }
  }, [location.search, location.pathname, navigate, success, toastError]);

  return null;
}
