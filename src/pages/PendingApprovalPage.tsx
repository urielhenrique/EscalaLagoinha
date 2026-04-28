import { Clock3, LogOut } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function PendingApprovalPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-app-200">
          Verificando status...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.status !== "PENDENTE") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1b3a5b_0%,#0a1020_45%,#050816_100%)] px-4 py-10 text-white">
      <div className="mx-auto flex max-w-xl flex-col gap-6 rounded-3xl border border-white/12 bg-white/5 p-8 shadow-[0_28px_80px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-500/10 text-amber-200">
          <Clock3 className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold">
            Cadastro em análise
          </h1>
          <p className="text-sm text-app-100/90">
            Seu cadastro foi recebido e está aguardando aprovação da equipe
            administrativa. Você receberá um email assim que sua conta for
            liberada.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-app-900/40 p-4 text-sm text-app-100/90">
          Email cadastrado: <strong>{user?.email}</strong>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-app-100 transition hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </main>
  );
}
