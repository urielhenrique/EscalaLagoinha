import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearAuthStorage,
  clearAuthUser,
  getAuthToken,
  getAuthUser,
  saveAuthToken,
  saveAuthUser,
} from "../services/authStorage";
import {
  forgotPasswordRequest,
  loginRequest,
  meRequest,
  registerRequest,
  resetPasswordRequest,
} from "../services/authApi";
import { profileToAuthUser } from "../services/authMapper";
import type { AuthUser, LoginPayload, RegisterPayload } from "../types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  getProfile: () => Promise<void>;
  solicitarCadastro: (payload: RegisterPayload) => Promise<void>;
  enviarRecuperacaoSenha: (email: string) => Promise<void>;
  redefinirSenha: (token: string, novaSenha: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = getAuthToken();
      const storedUser = getAuthUser();

      if (!token) {
        clearAuthStorage();
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (storedUser) {
        setUser(storedUser);
      }

      try {
        const profileResponse = await meRequest();
        const resolvedUser = profileToAuthUser(
          profileResponse.data,
          storedUser?.nome,
        );

        saveAuthUser(resolvedUser);
        setUser(resolvedUser);
      } catch {
        clearAuthStorage();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await loginRequest(payload);
    const { token, user: userData } = response.data;

    const authUser: AuthUser = {
      id: userData.id,
      nome: userData.nome,
      email: userData.email,
      telefone: userData.telefone,
      foto: userData.foto,
      perfil: userData.perfil,
      status: userData.status,
      ativo: userData.ativo,
    };

    saveAuthToken(token);
    saveAuthUser(authUser);
    setUser(authUser);
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
  };

  const getProfile = async () => {
    const storedUser = getAuthUser();
    const response = await meRequest();
    const authUser = profileToAuthUser(response.data, storedUser?.nome);

    saveAuthUser(authUser);
    setUser(authUser);
  };

  const solicitarCadastro = async (payload: RegisterPayload) => {
    await registerRequest(payload);
    clearAuthUser();
  };

  const enviarRecuperacaoSenha = async (email: string) => {
    await forgotPasswordRequest(email);
  };

  const redefinirSenha = async (token: string, novaSenha: string) => {
    await resetPasswordRequest(token, novaSenha);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      getProfile,
      solicitarCadastro,
      enviarRecuperacaoSenha,
      redefinirSenha,
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
