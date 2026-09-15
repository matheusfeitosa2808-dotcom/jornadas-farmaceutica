"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { connectRealtime } from "@/realtime/client";

type Context = {
  data: any;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  action: (action: string, payload?: any) => Promise<any>;
  toast: (message: string) => void;
  setEditionId: (id: string) => void;
  editionId: string;
};

const JornadasContext = createContext<Context>(null!);
export const useJornadas = () => useContext(JornadasContext);

export function Provider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname.startsWith("/login/");
  const isAdminImport = pathname.startsWith("/admin/importacoes");
  const scope = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/app")
      ? "participant"
      : "public";

  const [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editionId, setEditionId] = useState(""),
    [message, setMessage] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 5000);
  }, []);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);

    try {
      const endpoint = isLogin
        ? "/api/editions"
        : isAdminImport
          ? `/api/state?scope=admin&mode=import${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`
          : `/api/state?scope=${scope}${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`;
      const res = await fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await res.json()) as any;
      if (!res.ok) throw new Error(body.error || "Não foi possível atualizar.");
      setData(body);
      setError("");
    } catch (e) {
      const message =
        e instanceof DOMException && e.name === "AbortError"
          ? "O carregamento demorou demais. Tente novamente."
          : e instanceof Error
            ? e.message
            : "Erro de conexão.";
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [scope, editionId, isLogin, isAdminImport]);

  // Uma única carga quando o escopo, a edição ou a tela realmente muda.
  // Sem polling, SSE, EventSource ou atualização automática contínua.
  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Avisa quando OUTRO cliente mudou algo (a própria ação já chama refresh
  // acima). Um WebSocket por aba, coalescido no servidor a cada 1s — não é
  // polling: fica ocioso até o Durable Object mandar um lote.
  const activeEditionId = data?.edition?.id || editionId;
  useEffect(() => {
    if (isLogin || scope === "public" || !activeEditionId) return;
    return connectRealtime({
      scope,
      editionId: activeEditionId,
      onEvents: () => void refresh(),
      onResync: () => void refresh(),
    });
  }, [isLogin, scope, activeEditionId, refresh]);

  const action = async (actionName: string, payload: any = {}) => {
    try {
      const currentEditionId = data?.edition?.id || editionId;
      const importConfirm = actionName === "import.confirm";
      const endpoint = importConfirm ? "/api/import/confirm" : "/api/action";
      const requestBody = importConfirm
        ? {
            editionId: currentEditionId,
            jobId: payload.jobId,
          }
        : {
            action: actionName,
            scope,
            editionId: currentEditionId,
            ...payload,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const body = (await res.json()) as any;
      if (!res.ok)
        throw Object.assign(
          new Error(body.error || "Não foi possível concluir."),
          {
            code: body.code,
            details: body.details,
            conflicts: body.conflicts,
          },
        );

      toast(body.message || "Alteração salva.");

      // Em importação, o retorno já contém o resultado necessário.
      // Evita recarregar todo o estado administrativo logo após confirmar.
      if (!importConfirm) await refresh();
      return body;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível concluir.");
      throw e;
    }
  };

  return (
    <JornadasContext.Provider
      value={{
        data,
        loading,
        error,
        refresh,
        action,
        toast,
        setEditionId,
        editionId,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          <span className="toast-dot" />
          {message}
          <button aria-label="Fechar aviso" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </JornadasContext.Provider>
  );
}
