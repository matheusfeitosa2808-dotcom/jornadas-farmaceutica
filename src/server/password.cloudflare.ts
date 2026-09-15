import { env } from "cloudflare:workers";
import { scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha com PBKDF2 via WebCrypto + pepper.
 *
 * O `scryptSync` de antes bloqueia o isolate por ~80ms de CPU cobrada a cada
 * login. Aqui o custo cai para ~25ms e o pepper (segredo do Worker, fora do
 * banco) mantém alto o custo de um ataque offline caso o dump vaze.
 *
 * Hashes `scrypt$...` antigos continuam sendo verificados. Quando o login
 * acerta com um deles, `needsRehash` devolve true: regrave o hash ali mesmo,
 * e em uma temporada a base inteira migra sozinha.
 */

const ITERATIONS = 100_000;
const KEY_BITS = 256;
const PREFIX = "pbkdf2";

const pepper = () =>
  (env as unknown as { PASSWORD_PEPPER?: string }).PASSWORD_PEPPER ?? "";

const bytesToHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex: string) =>
  new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((byte) => parseInt(byte, 16)));

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password + pepper()),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    KEY_BITS,
  );

  return bytesToHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `${PREFIX}$${ITERATIONS}$${bytesToHex(salt.buffer)}$${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm] = stored.split("$");

  if (algorithm === PREFIX) {
    const [, iterations, saltHex, expected] = stored.split("$");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password + pepper()),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: hexToBytes(saltHex),
        iterations: Number(iterations),
      },
      key,
      KEY_BITS,
    );
    return safeEqual(bytesToHex(bits), expected);
  }

  if (algorithm === "scrypt") {
    const [, salt, expected] = stored.split("$");
    if (!salt || !expected) return false;
    const derived = scryptSync(password, salt, 64);
    const target = Buffer.from(expected, "hex");
    return target.length === derived.length && timingSafeEqual(target, derived);
  }

  return false;
}

/** true quando o hash guardado ainda é do formato antigo. */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`${PREFIX}$${ITERATIONS}$`);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
