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
    try {
      const res = await fetch(
        `/api/state?scope=${scope}${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as any;
      if (!res.ok) throw new Error(body.error || "Não foi possível atualizar.");
      setData(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [scope, editionId]);
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);
  const actorId = data?.actor?.id;
  useEffect(() => {
    if (!actorId || scope !== "admin") return;
    const events = new EventSource(
      `/api/events?scope=${scope}${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`,
    );
    events.onmessage = () => refresh();
    events.addEventListener("update", () => refresh());
    return () => events.close();
  }, [actorId, scope, editionId, refresh]);
  const action = async (actionName: string, payload: any = {}) => {
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionName,
          scope,
          editionId: data?.edition?.id || editionId,
          ...payload,
        }),
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
      await refresh();
      toast(body.message || "Alteração salva.");
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
