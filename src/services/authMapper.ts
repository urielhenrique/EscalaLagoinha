import type { AuthMeResponse, AuthUser } from "../types/auth";

export function profileToAuthUser(
  profile: AuthMeResponse,
  fallbackName?: string,
): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    perfil: profile.perfil,
    status: profile.status,
    nome:
      profile.nome ??
      fallbackName ??
      profile.email.split("@")[0] ??
      "Voluntário",
    telefone: profile.telefone,
    foto: profile.foto,
    ativo: profile.ativo,
    churchId: profile.churchId,
    church: profile.church,
  };
}
