import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserProfile } from "../types/auth";

type PrivateRouteProps = {
  allowedProfiles?: UserProfile[];
};

export function PrivateRoute({ allowedProfiles }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="animate-fade rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-app-200">
          Verificando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.status === "PENDENTE") {
    return <Navigate to="/aguardando-aprovacao" replace />;
  }

  if (allowedProfiles?.length && user?.perfil) {
    if (!allowedProfiles.includes(user.perfil)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
