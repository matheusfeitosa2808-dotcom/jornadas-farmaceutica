import { ensure } from "@/server/security";

/**
 * Rate limit para desenvolvimento local (Map em memória, por isolate).
 *
 * Em produção (Cloudflare), `@/server/ratelimit` resolve para
 * `ratelimit.cloudflare.ts` via alias em `vite.config.ts`, que usa o
 * binding nativo do Workers em vez desse Map.
 */

const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

const buckets = new Map<string, { count: number; until: number }>();

function hit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.until <= now) {
    buckets.set(key, { count: 1, until: now + windowMs });
  } else {
    bucket.count++;
    ensure(
      bucket.count <= limit,
      "Muitas tentativas. Aguarde um minuto.",
      "RATE_LIMIT",
      429,
    );
  }
  if (buckets.size > 5000) {
    for (const [entry, value] of buckets) if (value.until < now) buckets.delete(entry);
  }
}

export async function guardLogin(
  request: Request,
  identifier?: string,
): Promise<void> {
  hit(`login:${clientIp(request)}:${identifier ?? ""}`, 10, 60_000);
}

export async function guardAction(
  request: Request,
  actorId: string,
): Promise<void> {
  hit(`action:${actorId || clientIp(request)}`, 120, 60_000);
}
