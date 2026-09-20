import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/server/db";
import {
  arenaConfig,
  buildArenaRanking,
  publicArenaRanking,
} from "@/server/arena";
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
    ensure(actor, "Faça login para ver o ranking.", "UNAUTHORIZED", 401);
    if (actor.type === "admin") requirePermission(actor, "arena.read");
    const editionId =
      request.nextUrl.searchParams.get("editionId") || actor.editionId || "";
    ensure(editionId, "Edição não informada.");
    if (actor.type === "participant")
      ensure(
        actor.editionId === editionId,
        "Edição inválida.",
        "FORBIDDEN",
        403,
      );
    const result = await transaction(async (tx) => {
      const [config, ranking] = await Promise.all([
        arenaConfig(tx, editionId),
        buildArenaRanking(tx, editionId),
      ]);
      const safeRanking = publicArenaRanking(ranking);
      const own =
        actor.type === "participant"
          ? ranking.find((row: any) => row.participantId === actor.id)
          : null;
      return {
        enabled: config.rankingEnabled,
        ranking: config.rankingEnabled ? safeRanking : [],
        myRank: own?.rank || null,
        myXpTotal: own?.xpTotal || 0,
        myXpAvailable: own?.xpAvailable || 0,
        completedChallenges: own?.completedChallenges || 0,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
