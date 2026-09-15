import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha para desenvolvimento local (Node puro).
 *
 * Em produção (Cloudflare), `@/server/password` resolve para
 * `password.cloudflare.ts` via alias em `vite.config.ts` — PBKDF2 via
 * WebCrypto, mais barato em CPU cobrada. Aqui fica o scrypt de sempre, só
 * para rodar fora do Worker.
 */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [algorithm, salt, expected] = hash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const target = Buffer.from(expected, "hex");
  return target.length === actual.length && timingSafeEqual(target, actual);
}

/** Local sempre grava no formato atual, então nunca precisa regravar. */
export function needsRehash(_stored: string): boolean {
  return false;
}
