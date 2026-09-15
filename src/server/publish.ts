/**
 * Publicação de eventos de tempo real para desenvolvimento local.
 *
 * Em produção (Cloudflare), `@/server/publish` resolve para
 * `publish.cloudflare.ts` via alias em `vite.config.ts`, que publica no
 * Durable Object da edição. Fora do Workers não há tempo real: quem estiver
 * com a tela aberta só vê a mudança no próximo refresh manual.
 */

export type RealtimeEvent = {
  type: string;
  editionId: string;
  at?: string;
  participantId?: string;
  audience?: "all" | "admin";
};

export function publish(_event: RealtimeEvent): void {
  // sem Durable Object fora do Workers
}
