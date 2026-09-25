import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/server/db";
import {
  arenaConfig,
  buildArenaXpBreakdown,
  buildArenaRanking,
  cachedArenaRanking,
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
    const wantsFullRanking =
      actor.type === "admin" ||
      request.nextUrl.searchParams.get("full") === "1";
    const detailParticipantId =
      request.nextUrl.searchParams.get("participantId") || "";
    ensure(editionId, "Edição não informada.");
    if (actor.type === "participant")
      ensure(
        actor.editionId === editionId,
        "Edição inválida.",
        "FORBIDDEN",
        403,
      );
    const result = await transaction(async (tx) => {
      const config = await arenaConfig(tx, editionId);
      const ranking =
        actor.type === "admin"
          ? await buildArenaRanking(tx, editionId, config)
          : await cachedArenaRanking(tx, editionId, config);
      const safeRanking = publicArenaRanking(ranking);
      if (detailParticipantId) {
        ensure(
          config.rankingEnabled,
          "O ranking ainda não está disponível.",
          "FORBIDDEN",
          403,
        );
        const rankedParticipant = safeRanking.find(
          (row: any) => row.participantId === detailParticipantId,
        );
        ensure(
          rankedParticipant,
          "Participante não encontrado no ranking.",
          "NOT_FOUND",
          404,
        );
        const detail = await buildArenaXpBreakdown(
          tx,
          editionId,
          detailParticipantId,
        );
        return {
          ...detail,
          participant: {
            ...detail.participant,
            rank: rankedParticipant.rank,
          },
          xpTotal: rankedParticipant.xpTotal,
        };
      }
      const own =
        actor.type === "participant"
          ? ranking.find((row: any) => row.participantId === actor.id)
          : null;
      return {
        enabled: config.rankingEnabled,
        ranking: config.rankingEnabled
          ? wantsFullRanking
            ? safeRanking
            : safeRanking.slice(0, 3)
          : [],
        myRanking: own ? publicArenaRanking([own])[0] : null,
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
