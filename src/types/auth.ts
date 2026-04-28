export type UserProfile =
  | "MASTER_PLATFORM_ADMIN"
  | "MASTER_ADMIN"
  | "ADMIN"
  | "VOLUNTARIO";
export type UserStatus = "PENDENTE" | "ATIVO" | "INATIVO";

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  foto?: string | null;
  perfil?: UserProfile;
  status?: UserStatus;
  ativo?: boolean;
  churchId?: string | null;
  church?: {
    id: string;
    nome: string;
    slug: string;
  } | null;
};

export type LoginPayload = {
  email: string;
  senha: string;
};

export type RegisterPayload = {
  nomeCompleto: string;
  email: string;
  telefone: string;
  senha: string;
  confirmarSenha: string;
  ministerioInteresse: string;
  churchSlug?: string;
};

export type OnboardingChurchPayload = {
  churchName: string;
  churchSlug: string;
  churchAddress: string;
  churchCity: string;
  churchState: string;
  responsibleName: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
};

export type OnboardingChurchResponse = {
  message: string;
  token: string;
  user: AuthLoginResponse["user"];
  church: {
    id: string;
    nome: string;
    slug: string;
  };
};

export type AuthLoginResponse = {
  user: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    foto: string | null;
    perfil: UserProfile;
    status: UserStatus;
    ativo: boolean;
    churchId: string | null;
    church: {
      id: string;
      nome: string;
      slug: string;
    } | null;
    createdAt: string;
  };
  token: string;
};

export type AuthMeResponse = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  foto: string | null;
  perfil: UserProfile;
  status: UserStatus;
  ativo: boolean;
  churchId: string | null;
  church: {
    id: string;
    nome: string;
    slug: string;
  } | null;
  createdAt: string;
};

export type RegisterResponse = {
  message: string;
  status: UserStatus;
};
