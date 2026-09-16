import { env } from "cloudflare:workers";
import { ensure } from "@/server/security";

/**
 * Rate limit com o binding nativo do Workers.
 *
 * O `Map` em memória de antes vivia dentro de um isolate: com o tráfego
 * espalhado por vários isolates, o limite de 60/min virava 60 vezes o
 * número de isolates ativos. O binding nativo não custa request nem CPU
 * relevante.
 */

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };
type Env = { LOGIN_LIMIT: Limiter; ACTION_LIMIT: Limiter };

const clientIp = (request: Request) =>
  request.headers.get("CF-Connecting-IP") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "local";

/**
 * Se o binding falhar (erro de infra, não "limite excedido"), deixa passar
 * em vez de derrubar a operação inteira. Rate limit é proteção, não pode
 * virar um ponto único de falha para todo /api/action e /api/auth.
 */
async function checkedLimit(
  limiter: Limiter,
  key: string,
): Promise<boolean> {
  try {
    return (await limiter.limit({ key })).success;
  } catch (error) {
    console.error("[jornadas/ratelimit]", error);
    return true;
  }
}

/** Use no /api/auth. */
export async function guardLogin(
  request: Request,
  identifier?: string,
): Promise<void> {
  const key = `login:${clientIp(request)}:${identifier ?? ""}`;
  const success = await checkedLimit((env as unknown as Env).LOGIN_LIMIT, key);
  ensure(success, "Muitas tentativas. Aguarde um minuto.", "RATE_LIMIT", 429);
}

/** Use no /api/action. */
export async function guardAction(
  request: Request,
  actorId: string,
): Promise<void> {
  const key = `action:${actorId || clientIp(request)}`;
  const success = await checkedLimit((env as unknown as Env).ACTION_LIMIT, key);
  ensure(success, "Muitas tentativas. Aguarde um minuto.", "RATE_LIMIT", 429);
}
