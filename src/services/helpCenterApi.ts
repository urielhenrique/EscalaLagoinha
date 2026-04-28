import { api } from "./api";

export type ArticleCategory =
  | "LOGIN_ACESSO"
  | "ESCALAS"
  | "TROCA_ESCALA"
  | "APROVACAO_VOLUNTARIOS"
  | "NOTIFICACOES"
  | "ADMIN_MASTER"
  | "CONFIGURACOES"
  | "GERAL";

export type FeedbackType =
  | "BUG_REPORT"
  | "FEATURE_REQUEST"
  | "GENERAL_FEEDBACK"
  | "IMPROVEMENT";

export type FeedbackStatus = "ABERTO" | "EM_ANALISE" | "RESOLVIDO" | "FECHADO";

export type HelpArticleSummary = {
  id: string;
  titulo: string;
  categoria: ArticleCategory;
  tags: string[];
  slug: string;
  visualizacoes: number;
  createdAt: string;
};

export type HelpArticle = HelpArticleSummary & {
  conteudo: string;
  publicado: boolean;
  updatedAt: string;
};

export type UserFeedback = {
  id: string;
  tipo: FeedbackType;
  titulo: string;
  descricao: string;
  paginaOrigem?: string;
  avaliacao?: number;
};

export async function listHelpArticles(
  categoria?: ArticleCategory,
  q?: string,
): Promise<HelpArticleSummary[]> {
  const params: Record<string, string> = {};
  if (categoria) params.categoria = categoria;
  if (q) params.q = q;
  const res = await api.get<HelpArticleSummary[]>("/help-center/articles", {
    params,
  });
  return res.data;
}

export async function getHelpArticle(slug: string): Promise<HelpArticle> {
  const res = await api.get<HelpArticle>(`/help-center/articles/${slug}`);
  return res.data;
}

export async function submitFeedback(
  dto: UserFeedback,
): Promise<{ id: string }> {
  const res = await api.post<{ id: string }>("/help-center/feedback", dto);
  return res.data;
}
