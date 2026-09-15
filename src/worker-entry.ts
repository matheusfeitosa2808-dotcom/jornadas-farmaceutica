import handler from "vinext/server/fetch-handler";
import { NextRequest } from "next/server";
import { getActor } from "@/server/security";

export { EditionHub } from "@/realtime/EditionHub";

/**
 * Entrada customizada do Worker: delega tudo para o handler do vinext, exceto
 * o upgrade de WebSocket em /api/events, que vai direto para o Durable Object
 * da edição. Next.js não expõe upgrade de WebSocket em route handlers, então
 * essa rota nunca chegaria ao vinext de qualquer forma.
 */

interface Env {
  EDITION_HUB: DurableObjectNamespace;
}

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/api/events" &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const scope = url.searchParams.get("scope") === "admin" ? "admin" : "participant";
      const actor = await getActor(new NextRequest(request), scope);
      if (!actor) return new Response("Unauthorized", { status: 401 });

      const editionId =
        url.searchParams.get("editionId") || actor.editionId || "*";

      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set("scope", scope);
      if (actor.type === "participant") {
        forwardUrl.searchParams.set("participantId", actor.id);
      }

      const id = env.EDITION_HUB.idFromName(editionId);
      const stub = env.EDITION_HUB.get(id);
      return stub.fetch(new Request(forwardUrl, request));
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
