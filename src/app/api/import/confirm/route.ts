import { NextRequest, NextResponse } from "next/server";
import { confirmImportBulk } from "@/server/import-bulk";
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
    return errorResponse(e);
  }
}
