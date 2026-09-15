/**
 * Cliente de tempo real. Conecta ao Durable Object via WebSocket em
 * /api/events e avisa quando algo mudou em outro cliente/isolate.
 *
 * `onEvents`/`onResync` apenas disparam um refresh do estado local — a
 * aplicação de deltas ponto a ponto fica para uma etapa seguinte.
 */

export type RealtimeEvent = {
  type: string;
  editionId: string;
  at: string;
  participantId?: string;
};

export type RealtimeStatus = "connecting" | "online" | "offline";

export type RealtimeOptions = {
  scope: "admin" | "participant";
  editionId?: string;
  onEvents: (events: RealtimeEvent[]) => void;
  onResync: (reason: string) => void;
  onStatus?: (status: RealtimeStatus) => void;
};

const PING_MS = 45_000;
const MAX_BACKOFF_MS = 30_000;
/** Acima disso assumimos que perdemos eventos e pedimos o estado inteiro. */
const STALE_AFTER_MS = 20_000;

export function connectRealtime(options: RealtimeOptions): () => void {
  let socket: WebSocket | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let disconnectedAt = 0;
  let closed = false;

  const status = (value: RealtimeStatus) => options.onStatus?.(value);

  const open = () => {
    if (closed) return;
    status("connecting");

    const url = new URL("/api/events", location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("scope", options.scope);
    if (options.editionId) url.searchParams.set("editionId", options.editionId);

    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      const offlineFor = disconnectedAt ? Date.now() - disconnectedAt : 0;
      attempt = 0;
      disconnectedAt = 0;
      status("online");

      if (offlineFor > STALE_AFTER_MS) {
        options.onResync("reconexão após queda");
      }

      ping = setInterval(() => {
        // Respondido pelo runtime; não acorda o Durable Object.
        if (socket?.readyState === WebSocket.OPEN) socket.send("ping");
      }, PING_MS);
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string" || event.data === "pong") return;

      let message: { type?: string; events?: RealtimeEvent[]; reason?: string };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === "batch" && message.events?.length) {
        options.onEvents(message.events);
      } else if (message.type === "resync") {
        options.onResync(message.reason ?? "servidor pediu recarga");
      }
    });

    const down = () => {
      if (ping) clearInterval(ping);
      ping = null;
      socket = null;
      if (closed) return;

      if (!disconnectedAt) disconnectedAt = Date.now();
      status("offline");

      // Backoff exponencial com jitter, para muitos clientes não voltarem juntos.
      const base = Math.min(1000 * 2 ** attempt++, MAX_BACKOFF_MS);
      retry = setTimeout(open, base * (0.5 + Math.random() * 0.5));
    };

    socket.addEventListener("close", down);
    socket.addEventListener("error", down);
  };

  // Voltar de segundo plano costuma trazer a aba com dados velhos.
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    if (socket?.readyState === WebSocket.OPEN) return;
    if (retry) clearTimeout(retry);
    attempt = 0;
    open();
  };
  document.addEventListener("visibilitychange", onVisible);

  open();

  return () => {
    closed = true;
    document.removeEventListener("visibilitychange", onVisible);
    if (ping) clearInterval(ping);
    if (retry) clearTimeout(retry);
    socket?.close(1000, "saindo");
  };
}
