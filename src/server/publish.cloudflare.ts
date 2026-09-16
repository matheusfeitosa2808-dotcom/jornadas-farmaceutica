import { env } from "cloudflare:workers";
import type { RealtimeEvent } from "@/realtime/EditionHub";

export type { RealtimeEvent };

/**
 * Publica um evento no Durable Object da edição correspondente.
 *
 * Substitui o antigo `publish(editionId)` de `@/server/events`, que só
 * avisava "algo mudou" para o mesmo isolate. Aqui o aviso sai para todos os
 * clientes conectados, em qualquer isolate, coalescido em lotes de 1s.
 */

type Env = { EDITION_HUB: DurableObjectNamespace };

const hub = (editionId: string) => {
  const ns = (env as unknown as Env).EDITION_HUB;
  return ns.get(ns.idFromName(editionId));
};

/**
 * Use dentro das rotas de mutação. Não bloqueia a resposta HTTP e nunca deve
 * derrubar a escrita que já foi commitada só porque o aviso de tempo real
 * falhou (DO fora do ar, binding com problema, etc.).
 */
export function publish(event: RealtimeEvent): void {
  try {
    (
      hub(event.editionId) as never as {
        publish(e: RealtimeEvent): Promise<void>;
      }
    )
      .publish(event)
      .catch((error) => console.error("[jornadas/realtime]", error));
  } catch (error) {
    console.error("[jornadas/realtime]", error);
  }
}
