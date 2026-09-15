import { DurableObject } from "cloudflare:workers";

/**
 * Hub de tempo real, um objeto por edição.
 *
 * Substitui o EventEmitter em globalThis (que só funcionava dentro de um
 * isolate, então um check-in tratado por outro isolate nunca chegava aos
 * clientes conectados no isolate atual).
 *
 * Custo: conexões ociosas hibernam e não geram duração cobrada. O ping do
 * cliente é respondido pelo runtime (auto-response) sem acordar o objeto.
 */

export type RealtimeEvent = {
  /** ex.: "state.changed", "attendance.checkin" */
  type: string;
  editionId: string;
  /** ISO. Preenchido no publish se vier vazio. */
  at?: string;
  /** Quando presente, só o próprio participante (e admins) recebem. */
  participantId?: string;
  /** "admin" = evento interno, participante nunca recebe. */
  audience?: "all" | "admin";
};

type Outgoing =
  | { type: "ready"; at: string }
  | { type: "batch"; events: RealtimeEvent[] }
  | { type: "resync"; reason: string };

interface HubEnv {
  EDITION_HUB: DurableObjectNamespace<EditionHub>;
}

export class EditionHub extends DurableObject<HubEnv> {
  /** Janela de coalescência. Uma rajada de check-ins vira um envio só. */
  private static readonly WINDOW_MS = 1000;
  /** Acima disso não vale a pena mandar delta: peça resync ao cliente. */
  private static readonly MAX_BUFFER = 150;

  constructor(ctx: DurableObjectState, env: HubEnv) {
    super(ctx, env);
    // Respondido pelo runtime: não acorda o objeto, não é cobrado.
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Esperado WebSocket.", { status: 426 });
    }

    const url = new URL(request.url);
    const scope =
      url.searchParams.get("scope") === "admin" ? "admin" : "participant";
    const participantId = url.searchParams.get("participantId") ?? "";

    if (scope === "participant" && !participantId) {
      return new Response("Participante não identificado.", { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();

    // As tags sobrevivem à hibernação: é assim que o filtro funciona depois
    // que o objeto acorda sem nenhum estado em memória.
    this.ctx.acceptWebSocket(
      server,
      scope === "admin"
        ? ["scope:admin"]
        : ["scope:participant", `p:${participantId}`],
    );

    this.send(server, { type: "ready", at: new Date().toISOString() });
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Chamado pelas rotas de API via RPC. Uma sessão RPC = 1 request de DO. */
  async publish(event: RealtimeEvent): Promise<void> {
    if (this.ctx.getWebSockets().length === 0) return;

    const buffered = await this.ctx.storage.get<RealtimeEvent[]>("pending");
    const pending = buffered ?? [];
    pending.push({ ...event, at: event.at ?? new Date().toISOString() });

    await this.ctx.storage.put(
      "pending",
      pending.slice(-(EditionHub.MAX_BUFFER + 1)),
    );

    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + EditionHub.WINDOW_MS);
    }
  }

  async alarm(): Promise<void> {
    const pending =
      (await this.ctx.storage.get<RealtimeEvent[]>("pending")) ?? [];
    await this.ctx.storage.delete("pending");
    if (pending.length === 0) return;

    const sockets = this.ctx.getWebSockets();
    if (sockets.length === 0) return;

    if (pending.length > EditionHub.MAX_BUFFER) {
      for (const ws of sockets) {
        this.send(ws, {
          type: "resync",
          reason: "muitas alterações de uma vez",
        });
      }
      return;
    }

    for (const ws of sockets) {
      const tags = this.ctx.getTags(ws);
      const isAdmin = tags.includes("scope:admin");
      const own = tags.find((t) => t.startsWith("p:"))?.slice(2);

      const events = isAdmin
        ? pending
        : pending.filter(
            (e) =>
              e.audience !== "admin" &&
              (e.participantId === undefined || e.participantId === own),
          );

      if (events.length) this.send(ws, { type: "batch", events });
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    try {
      // 1006 não pode ser devolvido ao fechar.
      ws.close(code === 1006 ? 1000 : code, reason);
    } catch {
      /* já fechado */
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, "Erro na conexão.");
    } catch {
      /* já fechado */
    }
  }

  private send(ws: WebSocket, message: Outgoing): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      /* socket caiu entre o getWebSockets e o send */
    }
  }
}
