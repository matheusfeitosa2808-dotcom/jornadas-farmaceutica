import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { buildStoreReportPdf } from "@/server/store-report-pdf";
import { errorResponse, getActor, requirePermission } from "@/server/security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req, "admin");
    requirePermission(actor, "rewards.manage");
    const editionId = req.nextUrl.searchParams.get("editionId") || actor.editionId || "";
    const edition = await db.edition.findUnique({ where: { id: editionId } });
    if (!edition) return new Response("Edição não encontrada.", { status: 404 });
    const [participants, rewards, reservations, deliveries, draws, transactions] =
      await Promise.all([
        db.participant.findMany({ where: { editionId }, orderBy: { name: "asc" } }),
        db.rewardItem.findMany({ where: { editionId }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
        db.rewardReservation.findMany({ where: { editionId }, orderBy: { createdAt: "desc" } }),
        db.rewardDelivery.findMany({ where: { editionId }, orderBy: { deliveredAt: "desc" } }),
        db.rewardDraw.findMany({ where: { editionId }, orderBy: { createdAt: "desc" } }),
        db.xpTransaction.findMany({
          where: {
            editionId,
            sourceType: { in: ["REWARD_PURCHASE", "REWARD_REFUND", "REWARD_REALLOCATION"] },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    const bytes = await buildStoreReportPdf({
      edition,
      generatedAt: new Date(),
      participants,
      rewards,
      reservations,
      deliveries,
      draws,
      transactions,
    });
    const suffix = cleanFilename(edition.name || editionId);
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-loja-${suffix}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function cleanFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
