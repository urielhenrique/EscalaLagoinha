import { Check, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  approveUser,
  listPendingUsers,
  rejectUser,
} from "../services/adminApi";
import { getErrorMessage } from "../services/api";
import type { UserItem } from "../types/domain";

export function ApproveVolunteersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const loadPending = async () => {
    setErro(null);
    setIsLoading(true);

    try {
      const response = await listPendingUsers();
      setUsers(response.data);
    } catch (error) {
      setErro(
        getErrorMessage(error, "Falha ao carregar voluntários pendentes."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPending();
  }, []);

  const runAction = async (userId: string, action: "approve" | "reject") => {
    setProcessingId(userId);
    setErro(null);

    try {
      if (action === "approve") {
        await approveUser(userId);
      } else {
        await rejectUser(userId);
      }

      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível concluir a ação."));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Aprovação de voluntários
          </h1>
          <p className="text-sm text-app-200">
            Revise os cadastros pendentes e aprove ou recuse cada solicitação.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPending()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-app-100 transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </header>

      {erro ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {erro}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-app-200">
          Carregando solicitações pendentes...
        </div>
      ) : null}

      {!isLoading && users.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-app-200">
          Nenhum cadastro pendente no momento.
        </div>
      ) : null}

      {!isLoading && users.length > 0 ? (
        <ul className="space-y-3">
          {users.map((user) => {
            const isProcessing = processingId === user.id;

            return (
              <li
                key={user.id}
                className="rounded-2xl border border-white/10 bg-app-850/50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {user.nome}
                    </p>
                    <p className="text-sm text-app-200">{user.email}</p>
                    <p className="text-xs text-app-300">{user.telefone}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void runAction(user.id, "approve")}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/85 px-3 py-2 text-xs font-semibold text-app-900 transition hover:bg-emerald-400 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprovar
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void runAction(user.id, "reject")}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500/85 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Recusar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
