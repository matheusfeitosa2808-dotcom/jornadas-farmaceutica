import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import {
  csrf,
  errorResponse,
  normalizeName,
  rateLimit,
  tokenHash,
  verifyPassword,
} from "@/server/security";
export async function POST(req: NextRequest) {
  try {
    csrf(req);
    const b = (await req.json()) as any,
      kind = b.kind === "admin" ? "admin" : "participant";
    const credentialKey = createHash("sha256")
      .update(
        kind === "admin"
          ? String(b.email || "")
              .trim()
              .toLowerCase()
          : `${String(b.editionId || "")}:${String(b.ra || "").trim()}`,
      )
      .digest("hex");
    let id: string;
    if (kind === "admin") {
      const u = await db.adminUser.findUnique({
        where: {
          email: String(b.email || "")
            .trim()
            .toLowerCase(),
        },
      });
      if (
        !u ||
        !u.active ||
        !verifyPassword(String(b.password || ""), u.passwordHash)
      ) {
        rateLimit(req, `login:${kind}:${credentialKey}`, 12, 60000);
        throw Object.assign(new Error("Credenciais inválidas."), {
          status: 401,
        });
      }
      id = u.id;
    } else {
      const p = await db.participant.findFirst({
        where: {
          editionId: String(b.editionId || ""),
          ra: String(b.ra || "").trim(),
          normalizedName: normalizeName(String(b.firstName || "")),
          active: true,
        },
      });
      if (!p) {
        rateLimit(req, `login:${kind}:${credentialKey}`, 12, 60000);
        throw Object.assign(
          new Error("Nome ou RA não conferem com o cadastro."),
          { status: 401 },
        );
      }
      id = p.id;
    }
    const token = randomBytes(32).toString("base64url");
    await db.session.create({
      data: {
        id: tokenHash(token),
        kind,
        adminId: kind === "admin" ? id : null,
        participantId: kind === "participant" ? id : null,
        expiresAt: new Date(Date.now() + (kind === "admin" ? 8 : 24) * 3600000),
      },
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(`jornadas_${kind}`, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: (kind === "admin" ? 8 : 24) * 3600,
    });
    return res;
  } catch (e: any) {
    if (e.status)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    csrf(req, false);
    const kind =
        req.nextUrl.searchParams.get("kind") === "admin"
          ? "admin"
          : "participant",
      token = req.cookies.get(`jornadas_${kind}`)?.value;
    if (token) await db.session.deleteMany({ where: { id: tokenHash(token) } });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(`jornadas_${kind}`, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
