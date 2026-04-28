import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  HelpCircle,
  LifeBuoy,
  Mail,
  Search,
  X,
} from "lucide-react";
import { SectionHeader } from "../components/ui/SectionHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import {
  listHelpArticles,
  getHelpArticle,
  type ArticleCategory,
  type HelpArticle,
  type HelpArticleSummary,
} from "../services/helpCenterApi";
import { getErrorMessage } from "../services/api";

// ─── Tipos de categoria ────────────────────────────────────────────────────

type CategoryMeta = {
  key: ArticleCategory;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
};

const CATEGORIES: CategoryMeta[] = [
  {
    key: "LOGIN_ACESSO",
    label: "Login e Acesso",
    description: "Senha, login, cadastro e convites",
    color: "from-sky-500/20 to-sky-600/10 border-sky-400/30",
    icon: <span className="text-2xl">🔑</span>,
  },
  {
    key: "ESCALAS",
    label: "Escalas",
    description: "Criar, editar e gerenciar escalas",
    color: "from-violet-500/20 to-violet-600/10 border-violet-400/30",
    icon: <span className="text-2xl">📅</span>,
  },
  {
    key: "TROCA_ESCALA",
    label: "Troca de Escala",
    description: "Solicitar e aprovar trocas entre voluntários",
    color: "from-amber-500/20 to-amber-600/10 border-amber-400/30",
    icon: <span className="text-2xl">🔄</span>,
  },
  {
    key: "APROVACAO_VOLUNTARIOS",
    label: "Aprovação de Voluntários",
    description: "Fluxo de aprovação e gestão de membros",
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-400/30",
    icon: <span className="text-2xl">✅</span>,
  },
  {
    key: "NOTIFICACOES",
    label: "Notificações",
    description: "Alertas, lembretes e preferências",
    color: "from-rose-500/20 to-rose-600/10 border-rose-400/30",
    icon: <span className="text-2xl">🔔</span>,
  },
  {
    key: "ADMIN_MASTER",
    label: "Admin Master",
    description: "Painel avançado e controles administrativos",
    color: "from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-400/30",
    icon: <span className="text-2xl">👑</span>,
  },
  {
    key: "CONFIGURACOES",
    label: "Configurações da Igreja",
    description: "Branding, políticas e personalizações",
    color: "from-cyan-500/20 to-cyan-600/10 border-cyan-400/30",
    icon: <span className="text-2xl">⚙️</span>,
  },
  {
    key: "GERAL",
    label: "Geral",
    description: "Dúvidas gerais sobre o sistema",
    color: "from-slate-500/20 to-slate-600/10 border-slate-400/30",
    icon: <span className="text-2xl">💡</span>,
  },
];

// ─── FAQ estático (seed visual) ───────────────────────────────────────────

const STATIC_FAQ = [
  {
    pergunta: "Como aprovar um voluntário?",
    resposta:
      'Acesse "Aprovação de Voluntários" no menu lateral. Você verá a lista de voluntários pendentes. Clique em "Aprovar" para liberar o acesso.',
    categoria: "APROVACAO_VOLUNTARIOS" as ArticleCategory,
  },
  {
    pergunta: "Como criar uma nova escala?",
    resposta:
      'Vá em "Gestão de Escalas" e clique em "+ Nova Escala". Selecione o evento, ministério e voluntários disponíveis.',
    categoria: "ESCALAS" as ArticleCategory,
  },
  {
    pergunta: "Como solicitar troca de escala?",
    resposta:
      'Em "Minhas Escalas", encontre o evento desejado e clique em "Solicitar Troca". O líder irá receber a notificação automaticamente.',
    categoria: "TROCA_ESCALA" as ArticleCategory,
  },
  {
    pergunta: "Não consigo fazer login. O que fazer?",
    resposta:
      'Verifique seu e-mail e senha. Caso tenha esquecido, clique em "Esqueci minha senha" na tela de login para redefinir.',
    categoria: "LOGIN_ACESSO" as ArticleCategory,
  },
  {
    pergunta: "Como adicionar no Google Agenda?",
    resposta:
      'Na tela de detalhes da escala, há um botão "Adicionar ao Google Agenda" que exporta o evento no formato iCal.',
    categoria: "ESCALAS" as ArticleCategory,
  },
  {
    pergunta: "Como configurar a identidade visual da minha igreja?",
    resposta:
      'Acesse "Configurações > Identidade Visual" no menu. Lá você pode definir cores, logo e nome personalizado.',
    categoria: "CONFIGURACOES" as ArticleCategory,
  },
  {
    pergunta: "Como funciona o check-in de presença?",
    resposta:
      'O voluntário escaneado acessa "Check-in" no menu e confirma presença. O admin pode visualizar em "Gestão de Presença".',
    categoria: "GERAL" as ArticleCategory,
  },
  {
    pergunta: "Posso ter múltiplas unidades da mesma igreja?",
    resposta:
      "Sim! No plano avançado, o Dashboard Multi-Unidade permite gerenciar várias igrejas em uma única conta Master Admin.",
    categoria: "ADMIN_MASTER" as ArticleCategory,
  },
];

// ─── Componente ArticleModal ───────────────────────────────────────────────

function ArticleModal({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getHelpArticle(slug)
      .then(setArticle)
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-900/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-app-800 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-app-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : article ? (
          <>
            <h2 className="mb-4 font-display text-xl font-bold text-white">
              {article.titulo}
            </h2>
            <div className="prose prose-invert max-w-none text-app-200">
              {article.conteudo.split("\n").map((line, i) => (
                <p key={i} className="mb-3 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          </>
        ) : (
          <p className="text-app-300">Artigo não encontrado.</p>
        )}
      </div>
    </div>
  );
}

// ─── Componente FAQItem ───────────────────────────────────────────────────

function FAQItem({
  pergunta,
  resposta,
}: {
  pergunta: string;
  resposta: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={[
        "rounded-xl border transition-all duration-200",
        open
          ? "border-brand-400/40 bg-brand-500/10"
          : "border-white/8 bg-app-800/60 hover:border-white/20",
      ].join(" ")}
    >
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium text-white">{pergunta}</span>
        <ChevronRight
          className={[
            "h-4 w-4 shrink-0 text-app-400 transition-transform duration-200",
            open ? "rotate-90" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div className="border-t border-white/8 px-5 pb-4 pt-3">
          <p className="text-sm leading-relaxed text-app-200">{resposta}</p>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────

export function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ArticleCategory | null>(null);
  const [articles, setArticles] = useState<HelpArticleSummary[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [openArticleSlug, setOpenArticleSlug] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch articles when category/query changes
  useEffect(() => {
    if (!selectedCategory && !debouncedQuery) {
      setArticles([]);
      return;
    }
    setLoadingArticles(true);
    setArticleError(null);
    listHelpArticles(selectedCategory ?? undefined, debouncedQuery || undefined)
      .then(setArticles)
      .catch((e) =>
        setArticleError(getErrorMessage(e, "Erro ao buscar artigos.")),
      )
      .finally(() => setLoadingArticles(false));
  }, [selectedCategory, debouncedQuery]);

  const filteredFAQ = STATIC_FAQ.filter((item) => {
    if (
      selectedCategory &&
      item.categoria !== selectedCategory &&
      selectedCategory !== "GERAL"
    ) {
      return false;
    }
    if (
      debouncedQuery &&
      !item.pergunta.toLowerCase().includes(debouncedQuery.toLowerCase()) &&
      !item.resposta.toLowerCase().includes(debouncedQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-brand-500/15 via-app-800 to-violet-500/10 p-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(22,213,176,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 ring-1 ring-brand-400/30">
            <LifeBuoy className="h-7 w-7 text-brand-300" />
          </div>
          <h1 className="mb-2 font-display text-3xl font-bold text-white">
            Central de Ajuda
          </h1>
          <p className="mb-6 text-app-300">
            Encontre respostas rápidas, artigos e guias para usar o sistema com
            excelência
          </p>

          {/* Search */}
          <div className="relative mx-auto max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-app-400" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar artigos, dúvidas frequentes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-app-900/60 py-3.5 pl-11 pr-4 text-white placeholder-app-400 outline-none backdrop-blur-sm transition-all focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-app-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Categorias */}
      <section>
        <SectionHeader title="Categorias" subtitle="Navegue por tema" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.key ? null : cat.key,
                )
              }
              className={[
                "flex flex-col gap-2 rounded-xl border bg-linear-to-br p-4 text-left transition-all duration-200 hover:scale-[1.02]",
                cat.color,
                selectedCategory === cat.key
                  ? "ring-2 ring-brand-400/60 ring-offset-1 ring-offset-app-900"
                  : "",
              ].join(" ")}
            >
              <div>{cat.icon}</div>
              <p className="font-semibold text-white">{cat.label}</p>
              <p className="text-xs text-app-300">{cat.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Artigos da base de conhecimento */}
      {(selectedCategory || debouncedQuery) && (
        <section>
          <SectionHeader
            title="Artigos"
            subtitle={
              debouncedQuery
                ? `Resultados para "${debouncedQuery}"`
                : CATEGORIES.find((c) => c.key === selectedCategory)?.label
            }
          />
          <div className="mt-4 space-y-2">
            {loadingArticles ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))
            ) : articleError ? (
              <p className="text-sm text-rose-400">{articleError}</p>
            ) : articles.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-10 w-10 text-app-500" />}
                title="Nenhum artigo encontrado"
                description="Ainda não há artigos publicados nessa categoria. Tente outra categoria ou veja o FAQ abaixo."
              />
            ) : (
              articles.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setOpenArticleSlug(a.slug)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/8 bg-app-800/60 px-5 py-3.5 text-left transition-all hover:border-brand-400/40 hover:bg-brand-500/8"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-4 w-4 shrink-0 text-brand-400" />
                    <span className="font-medium text-white">{a.titulo}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-app-500" />
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section>
        <SectionHeader
          title="Perguntas Frequentes"
          subtitle="As dúvidas mais comuns respondidas"
        />
        <div className="mt-4 space-y-2">
          {filteredFAQ.length === 0 ? (
            <EmptyState
              icon={<HelpCircle className="h-10 w-10 text-app-500" />}
              title="Nenhuma pergunta encontrada"
              description="Tente outra busca ou selecione uma categoria diferente."
            />
          ) : (
            filteredFAQ.map((item, i) => (
              <FAQItem
                key={i}
                pergunta={item.pergunta}
                resposta={item.resposta}
              />
            ))
          )}
        </div>
      </section>

      {/* Contato / Suporte */}
      <section>
        <div className="rounded-2xl border border-white/10 bg-app-800/50 p-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/30">
              <Mail className="h-6 w-6 text-violet-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">
                Não encontrou o que precisava?
              </h3>
              <p className="mt-1 text-sm text-app-300">
                Entre em contato com o suporte ou envie uma sugestão de melhoria
                para a equipe.
              </p>
            </div>
            <a
              href="/ajuda/feedback"
              className="shrink-0 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
            >
              Enviar Feedback
            </a>
          </div>
        </div>
      </section>

      {/* Article Modal */}
      {openArticleSlug && (
        <ArticleModal
          slug={openArticleSlug}
          onClose={() => setOpenArticleSlug(null)}
        />
      )}
    </div>
  );
}
