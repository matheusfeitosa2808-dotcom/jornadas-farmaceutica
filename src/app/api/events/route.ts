import { NextRequest } from "next/server";
import { getActor } from "@/server/security";
import { subscribe } from "@/server/events";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") || "participant",
    actor = await getActor(req, scope);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const editionId =
    req.nextUrl.searchParams.get("editionId") || actor.editionId || "*";
  let off = () => {},
    timer: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`event: ready\ndata: {}\n\n`));
      off = subscribe(editionId, () =>
        controller.enqueue(encoder.encode(`event: update\ndata: {}\n\n`)),
      );
      timer = setInterval(
        () => controller.enqueue(encoder.encode(`: keepalive\n\n`)),
        25000,
      );
    },
    cancel() {
      off();
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
