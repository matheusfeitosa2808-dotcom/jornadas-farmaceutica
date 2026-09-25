import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/server/db";
import {
  ARENA_RANKING_INTRO_ACTION,
  ARENA_RANKING_INTRO_VERSION,
  arenaConfig,
  arenaRankingIsLocked,
  arenaRankingRevealAt,
  buildArenaXpBreakdown,
  buildArenaRanking,
  cachedArenaRanking,
  publicArenaRanking,
  shouldShowArenaRankingIntro,
} from "@/server/arena";
import { audit } from "@/server/domain";
import {
  csrf,
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
      const revealAt = arenaRankingRevealAt(config);
      const rankingLocked =
        actor.type === "participant" && arenaRankingIsLocked(config);
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
        ensure(
          !rankingLocked,
          "A classificação ainda está protegida pelo contador.",
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
      const publicOwn = own ? publicArenaRanking([own])[0] : null;
      const introSeen =
        actor.type === "participant"
          ? await tx.auditLog.findFirst({
              where: {
                editionId,
                actorType: "participant",
                actorId: actor.id,
                action: ARENA_RANKING_INTRO_ACTION,
              },
              select: { id: true },
            })
          : null;
      return {
        enabled: config.rankingEnabled,
        ranking:
          config.rankingEnabled && !rankingLocked
            ? wantsFullRanking
              ? safeRanking
              : safeRanking.slice(0, 3)
            : [],
        rankingLocked,
        rankingRevealAt: revealAt?.toISOString() || null,
        serverNow: new Date().toISOString(),
        myRanking:
          publicOwn && rankingLocked
            ? { ...publicOwn, rank: null, title: null }
            : publicOwn,
        myRank: rankingLocked ? null : own?.rank || null,
        myXpTotal: own?.xpTotal || 0,
        myXpAvailable: own?.xpAvailable || 0,
        completedChallenges: own?.completedChallenges || 0,
        rankingIntro: {
          version: ARENA_RANKING_INTRO_VERSION,
          shouldShow: shouldShowArenaRankingIntro({
            participantId: actor.type === "participant" ? actor.id : null,
            rankingEnabled: config.rankingEnabled,
            rankingLocked,
            introSeen: Boolean(introSeen),
          }),
        },
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    csrf(request);
    const actor = await getActor(request, "participant");
    ensure(
      actor?.type === "participant",
      "Faça login para continuar.",
      "UNAUTHORIZED",
      401,
    );
    const body = await request.json().catch(() => ({}));
    const editionId = String(body.editionId || actor.editionId || "");
    ensure(
      editionId && editionId === actor.editionId,
      "Edição inválida.",
      "FORBIDDEN",
      403,
    );
    await transaction(async (tx) => {
      const existing = await tx.auditLog.findFirst({
        where: {
          editionId,
          actorType: "participant",
          actorId: actor.id,
          action: ARENA_RANKING_INTRO_ACTION,
        },
      });
      if (!existing)
        await audit(
          tx,
          actor,
          editionId,
          ARENA_RANKING_INTRO_ACTION,
          "ArenaRankingIntro",
          ARENA_RANKING_INTRO_VERSION,
          undefined,
          { seen: true },
        );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
