import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  csrf,
  errorResponse,
  getActor,
  ensure,
  safeUrl,
} from "@/server/security";
export async function POST(req: NextRequest) {
  try {
    csrf(req, false);
    const actor = await getActor(
      req,
      req.cookies.get("jornadas_admin") ? "admin" : "participant",
    );
    ensure(actor, "Faça login.", "UNAUTHORIZED", 401);
    const form = await req.formData(),
      file = form.get("file");
    ensure(
      file instanceof File && file.size > 0 && file.size <= 5_000_000,
      "Arquivo deve ter até 5 MB.",
    );
    const mime = file.type.toLowerCase(),
      allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    ensure(
      allowed.includes(mime),
      "Formato não permitido. Use PNG, JPG, WebP ou PDF.",
    );
    if (actor.type === "participant")
      ensure(
        mime.startsWith("image/"),
        "Participantes podem enviar somente foto.",
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    const signatureMatches =
      (mime === "image/png" &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mime === "image/jpeg" &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      (mime === "image/webp" &&
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP") ||
      (mime === "application/pdf" &&
        bytes.subarray(0, 5).toString("ascii") === "%PDF-");
    ensure(
      signatureMatches,
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
    const ext: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "application/pdf": "pdf",
      },
      name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext[mime]}`,
      dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes, { flag: "wx" });
    return NextResponse.json({ ok: true, url: safeUrl(`/uploads/${name}`) });
  } catch (e) {
    return errorResponse(e);
  }
}
