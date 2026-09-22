import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/server/db";
import { arenaConfig } from "@/server/arena";
import { ensure, errorResponse, getActor } from "@/server/security";

export const dynamic = "force-dynamic";

/**
 * Fila leve de animações pendentes. Ela é consultada em todas as telas do
 * participante e, por isso, não deve calcular ranking nem carregar a loja.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActor(request, "participant");
    ensure(
      actor?.type === "participant",
      "Faça login para continuar.",
      "UNAUTHORIZED",
      401,
    );

    const editionId =
      request.nextUrl.searchParams.get("editionId") || actor.editionId || "";
    ensure(
      editionId && editionId === actor.editionId,
      "Edição inválida.",
      "FORBIDDEN",
      403,
    );

    const payload = await transaction(async (tx) => {
      const [config, pendingRevealAwards] = await Promise.all([
        arenaConfig(tx, editionId),
        tx.arenaXpAward.findMany({
          where: {
            editionId,
            participantId: actor.id,
            status: "RELEASED",
            animationStatus: { in: ["QUEUED", "DELIVERED"] },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const challengeIds = [
        ...new Set(
          pendingRevealAwards.map((award: any) => String(award.challengeId)),
        ),
      ];
      const challenges = challengeIds.length
        ? await tx.arenaChallenge.findMany({
            where: { editionId, id: { in: challengeIds } },
          })
        : [];

      return {
        config: {
          combinePendingAwards: config.combinePendingAwards,
        },
        challenges,
        pendingRevealAwards,
      };
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
