import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { saveUpload } from "@/server/storage";
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...bytes.slice(start, end));
    const startsWith = (signature: number[]) =>
      signature.every((value, index) => bytes[index] === value);
    const signatureMatches =
      (mime === "image/png" &&
        startsWith([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (mime === "image/jpeg" &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      (mime === "image/webp" &&
        ascii(0, 4) === "RIFF" &&
        ascii(8, 12) === "WEBP") ||
      (mime === "application/pdf" &&
        ascii(0, 5) === "%PDF-");
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
      name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext[mime]}`;
    const url = await saveUpload(name, bytes, mime);
    return NextResponse.json({ ok: true, url: safeUrl(url) });
  } catch (e) {
    return errorResponse(e);
  }
}
