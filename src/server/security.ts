import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

export class DomainError extends Error {
  constructor(
    message: string,
    public code = "VALIDATION",
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  message: string,
  code = "VALIDATION",
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(message, code, status);
}
export type Actor = {
  type: "admin" | "participant";
  id: string;
  name: string;
  editionId?: string;
  role?: string;
  permissions?: string[];
  ip?: string;
};
export const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, expected] = hash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const target = Buffer.from(expected, "hex");
  return target.length === actual.length && timingSafeEqual(target, actual);
}
export const permissionsList = [
  "editions.write",
  "participants.read",
  "participants.write",
  "activities.read",
  "activities.write",
  "attendance.register",
  "attendance.correct",
  "rewards.manage",
  "draws.execute",
  "deliveries.manage",
  "certificates.manage",
  "notifications.send",
  "reports.export",
  "audit.read",
  "users.manage",
];
export const rolePermissions: Record<string, string[]> = {
  ADMIN_GENERAL: permissionsList,
  ORGANIZATION: permissionsList.filter(
    (p) => !["users.manage", "editions.write", "audit.read"].includes(p),
  ),
  OPERATOR: ["participants.read", "activities.read", "attendance.register"],
};
export function hasPermission(actor: Actor | null, permission: string) {
  return (
    actor?.type === "admin" &&
    (actor.role === "ADMIN_GENERAL" || actor.permissions?.includes(permission))
  );
}
export function requirePermission(
  actor: Actor | null,
  permission: string,
): asserts actor is Actor {
  ensure(
    hasPermission(actor, permission),
    "Seu perfil não tem permissão para esta ação.",
    "FORBIDDEN",
    403,
  );
}
export function requireParticipant(
  actor: Actor | null,
  editionId: string,
): asserts actor is Actor {
  ensure(
    actor?.type === "participant" && actor.editionId === editionId,
    "Entre como participante desta edição.",
    "UNAUTHORIZED",
    401,
  );
}
export async function getActor(
  request: NextRequest,
  scope: string = "participant",
): Promise<Actor | null> {
  if (scope === "public") return null;
  const kind = scope === "admin" ? "admin" : "participant";
  const raw = request.cookies.get(`jornadas_${kind}`)?.value;
  if (!raw) return null;
  const session = await db.session.findUnique({
    where: { id: tokenHash(raw) },
    include: { admin: true, participant: true },
  });
  if (!session || session.kind !== kind || session.expiresAt <= new Date())
    return null;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (kind === "admin" && session.admin?.active) {
    const user = session.admin;
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(user.permissions);
    } catch {
      /* invalid saved grants deny */
    }
    return {
      type: "admin",
      id: user.id,
      name: user.name,
      role: user.role,
      permissions,
      ip,
    };
  }
  if (kind === "participant" && session.participant?.active) {
    const user = session.participant;
    return {
      type: "participant",
      id: user.id,
      name: user.name,
      editionId: user.editionId,
      ip,
    };
  }
  return null;
}
export function csrf(request: NextRequest, json = true) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    new URL(request.url).protocol.replace(":", "");
  const requestOrigin = host
    ? `${protocol}://${host}`
    : new URL(request.url).origin;
  ensure(
    origin === requestOrigin || origin === process.env.APP_ORIGIN,
    "Origem da solicitação inválida.",
    "CSRF",
    403,
  );
  if (json)
    ensure(
      request.headers.get("content-type")?.split(";")[0] === "application/json",
      "Envie JSON válido.",
      "CONTENT_TYPE",
      415,
    );
}
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(
  request: NextRequest,
  key: string,
  limit = 60,
  windowMs = 60000,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(id);
  if (!bucket || bucket.until <= now)
    buckets.set(id, { count: 1, until: now + windowMs });
  else {
    bucket.count++;
    ensure(
      bucket.count <= limit,
      "Muitas tentativas. Aguarde um minuto.",
      "RATE_LIMIT",
      429,
    );
  }
  if (buckets.size > 5000)
    for (const [entry, value] of buckets)
      if (value.until < now) buckets.delete(entry);
}
export function errorResponse(error: unknown) {
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  const code = (error as { code?: string })?.code;
  if (code === "P2002")
    return NextResponse.json(
      {
        error: "Registro duplicado. Verifique o RA, slug ou e-mail.",
        code: "DUPLICATE",
      },
      { status: 409 },
    );
  if (code === "P2025")
    return NextResponse.json(
      { error: "Registro não encontrado.", code: "NOT_FOUND" },
      { status: 404 },
    );
  console.error("[jornadas]", error);
  return NextResponse.json(
    { error: "Não foi possível concluir a operação.", code: "INTERNAL" },
    { status: 500 },
  );
}
export function safeUrl(value: unknown, nullable = true): string | null {
  if (value === null || value === undefined || value === "")
    return nullable ? null : "";
  ensure(typeof value === "string" && value.length <= 2000, "URL inválida.");
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"))
    return value;
  try {
    ensure(
      ["https:", "http:"].includes(new URL(value).protocol),
      "URL inválida.",
    );
    return value;
  } catch {
    throw new DomainError("URL inválida.");
  }
}
