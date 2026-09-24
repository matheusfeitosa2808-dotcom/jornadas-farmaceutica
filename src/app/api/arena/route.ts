import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/server/db";
import { arenaPayload } from "@/server/arena";
import {
  ensure,
  errorResponse,
  getActor,
  requirePermission,
} from "@/server/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const scope =
      request.nextUrl.searchParams.get("scope") === "admin"
        ? "admin"
        : "participant";
    const actor = await getActor(request, scope);
    ensure(
      actor,
      "Faça login para acessar a Farma Arena.",
      "UNAUTHORIZED",
      401,
    );
    if (actor.type === "admin") requirePermission(actor, "arena.read");
    const editionId =
      request.nextUrl.searchParams.get("editionId") || actor.editionId || "";
    const view = request.nextUrl.searchParams.get("view") || "desafios";
    ensure(editionId, "Edição não informada.");
    if (actor.type === "participant")
      ensure(
        actor.editionId === editionId,
        "Edição inválida.",
        "FORBIDDEN",
        403,
      );
    const payload = await transaction((tx) =>
      arenaPayload(tx, editionId, actor, actor.type === "admin", view),
    );
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
