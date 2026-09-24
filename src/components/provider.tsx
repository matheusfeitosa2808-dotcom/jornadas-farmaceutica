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
import { readApiResponse } from "@/lib/api-response";

type Context = {
  data: any;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  action: (
    action: string,
    payload?: any,
    options?: { refresh?: boolean },
  ) => Promise<any>;
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
  const isAdminArena = pathname.startsWith("/admin/farma-arena");
  const isAdminDashboard = pathname === "/admin" || pathname === "/admin/";
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
      const endpoint =
        isLogin || scope === "public"
          ? "/api/editions"
          : isAdminImport
            ? `/api/state?scope=admin&mode=import${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`
            : isAdminArena
              ? `/api/state?scope=admin&mode=arena${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`
              : isAdminDashboard
                ? `/api/state?scope=admin&mode=dashboard${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`
                : `/api/state?scope=${scope}${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`;
      const res = await fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await readApiResponse<any>(
        res,
        "Não foi possível atualizar.",
      );
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
  }, [
    scope,
    editionId,
    isLogin,
    isAdminImport,
    isAdminArena,
    isAdminDashboard,
  ]);

  // Uma única carga quando o escopo, a edição ou a tela realmente muda.
  // Sem polling, SSE, EventSource ou atualização automática contínua.
  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Só a equipe administrativa precisa receber alterações em tempo real.
  // Participantes atualizam ao abrir/recarregar a página, evitando centenas de
  // conexões persistentes e recargas coletivas durante o evento.
  useEffect(() => {
    if (isLogin || scope !== "admin" || !data?.actor?.id) return;
    const activeEditionId = data?.edition?.id || editionId;
    if (!activeEditionId) return;
    const source = new EventSource(
      `/api/events?scope=${scope}&editionId=${encodeURIComponent(activeEditionId)}`,
    );
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 320);
    };
    source.addEventListener("update", update);
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [data?.actor?.id, data?.edition?.id, editionId, isLogin, refresh, scope]);

  const action = async (
    actionName: string,
    payload: any = {},
    options: { refresh?: boolean } = {},
  ) => {
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
      const body = await readApiResponse<any>(
        res,
        "Não foi possível concluir.",
      );

      toast(body.message || "Alteração salva.");

      // Em importação, o retorno já contém o resultado necessário.
      // Evita recarregar todo o estado administrativo logo após confirmar.
      if (!importConfirm && options.refresh !== false) await refresh();
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
