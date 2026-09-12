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
  const refreshPromise = useRef<Promise<void> | null>(null);
  const refreshQueued = useRef(false);
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreEventsUntil = useRef(0);
  const pendingWhileHidden = useRef(false);

  const toast = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 5000);
  }, []);

  const fetchState = useCallback(async () => {
    const res = await fetch(
      `/api/state?scope=${scope}${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`,
      { cache: scope === "public" ? "default" : "no-store" },
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Não foi possível atualizar.");
    setData(body);
    setError("");
  }, [scope, editionId]);

  const refresh = useCallback(async () => {
    if (refreshPromise.current) {
      refreshQueued.current = true;
      return refreshPromise.current;
    }

    const run = async () => {
      try {
        await fetchState();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro de conexão.");
      } finally {
        setLoading(false);
      }
    };

    refreshPromise.current = run().finally(async () => {
      refreshPromise.current = null;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        await refresh();
      }
    });

    return refreshPromise.current;
  }, [fetchState]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const actorId = data?.actor?.id;

  useEffect(() => {
    if (!actorId || scope !== "admin") return;

    const scheduleRefresh = () => {
      if (Date.now() < ignoreEventsUntil.current) return;
      if (document.visibilityState === "hidden") {
        pendingWhileHidden.current = true;
        return;
      }
      if (eventTimer.current) clearTimeout(eventTimer.current);
      eventTimer.current = setTimeout(() => {
        eventTimer.current = null;
        void refresh();
      }, 350);
    };

    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        pendingWhileHidden.current
      ) {
        pendingWhileHidden.current = false;
        scheduleRefresh();
      }
    };

    const events = new EventSource(
      `/api/events?scope=${scope}${editionId ? "&editionId=" + encodeURIComponent(editionId) : ""}`,
    );
    events.addEventListener("update", scheduleRefresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.removeEventListener("update", scheduleRefresh);
      events.close();
      document.removeEventListener("visibilitychange", onVisibility);
      if (eventTimer.current) clearTimeout(eventTimer.current);
      eventTimer.current = null;
    };
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
      const body = await res.json();
      if (!res.ok)
        throw Object.assign(
          new Error(body.error || "Não foi possível concluir."),
          {
            code: body.code,
            details: body.details,
            conflicts: body.conflicts,
          },
        );

      // O POST publica um evento SSE para os administradores. Atualizamos uma vez
      // imediatamente e ignoramos o eco desse mesmo evento para evitar duas cargas
      // completas de /api/state para cada alteração.
      if (scope === "admin") ignoreEventsUntil.current = Date.now() + 1200;
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
