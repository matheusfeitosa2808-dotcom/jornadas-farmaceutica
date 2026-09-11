import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { confirmImportBulk } from "@/server/import-bulk";
import { insertParticipantsBulk } from "@/server/participant-import";
import {
  csrf,
  errorResponse,
  getActor,
  requirePermission,
  ensure,
} from "@/server/security";

export async function POST(req: NextRequest) {
  try {
    csrf(req);
    const actor = await getActor(req, "admin");
    requirePermission(actor, "participants.write");

    const body = (await req.json()) as any;
    const editionId = String(body.editionId || "").trim();
    const jobId = String(body.jobId || "").trim();

    ensure(editionId, "Edição não informada.");
    ensure(jobId, "Importação não informada.");

    if (jobId.startsWith("ephemeral.")) {
      const encoded = jobId.slice("ephemeral.".length);
      let payload: any;
      try {
        payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      } catch {
        ensure(false, "Prévia de importação inválida.");
      }

      ensure(payload?.editionId === editionId, "A edição da prévia não confere.");
      ensure(
        Number.isFinite(payload?.createdAt) && Date.now() - payload.createdAt <= 60 * 60 * 1000,
        "A prévia expirou. Gere uma nova pré-visualização.",
      );
      ensure(Array.isArray(payload?.rows), "Prévia sem participantes válidos.");

      const normalizedRows = payload.rows
        .map((row: any) => ({
          name: String(row?.name || "").trim(),
          ra: String(row?.ra || "").trim(),
          semester: Number(row?.semester),
        }))
        .filter(
          (row: any) =>
            row.name &&
            row.ra &&
            Number.isInteger(row.semester) &&
            row.semester >= 1,
        );

      const existing = new Set(
        (
          await db.participant.findMany({
            where: { editionId },
            select: { ra: true },
          })
        ).map((row: any) => String(row.ra)),
      );

      const seen = new Set<string>();
      const fresh = normalizedRows.filter((row: any) => {
        if (existing.has(row.ra) || seen.has(row.ra)) return false;
        seen.add(row.ra);
        return true;
      });

      const insertedResult = await insertParticipantsBulk({
        editionId,
        rows: fresh,
      });
      const skipped = normalizedRows.length - insertedResult.inserted;
      const message =
        skipped > 0
          ? `${insertedResult.inserted} participantes importados; ${skipped} já existiam e foram ignorados.`
          : `${insertedResult.inserted} participantes importados.`;

      return NextResponse.json({
        ok: true,
        imported: insertedResult.inserted,
        skipped,
        message,
      });
    }

    const result = await confirmImportBulk({ jobId, editionId });
    const message =
      result.skipped > 0
        ? `${result.inserted} participantes importados; ${result.skipped} já existiam e foram ignorados.`
        : `${result.inserted} participantes importados.`;

    return NextResponse.json({
      ok: true,
      result: result.job,
      imported: result.inserted,
      skipped: result.skipped,
      message,
    });
  } catch (e: any) {
    if (e?.status)
      return NextResponse.json({ error: e.message }, { status: e.status });

    if (process.env.DEV_SEED === "true") {
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : "Erro interno na importação.",
          code: e?.code || e?.pgCode || "IMPORT_INTERNAL",
          detail: e?.detail,
          constraint: e?.constraint,
        },
        { status: 500 },
      );
    }

    return errorResponse(e);
  }
}
