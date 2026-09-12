import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getActor, errorResponse } from "@/server/security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") || "public";
    const actor = await getActor(req, scope);
    let editionId = req.nextUrl.searchParams.get("editionId") || actor?.editionId;

    const editions = await db.edition.findMany({
      where:
        scope === "public"
          ? { status: { in: ["PUBLISHED", "ACTIVE", "FINISHED"] } }
          : {},
      orderBy: [{ year: "desc" }],
    });

    if (!editionId)
      editionId =
        editions.find((e) => e.status === "ACTIVE")?.id || editions[0]?.id;

    if (!editionId)
      return NextResponse.json({
        actor,
        editions,
        edition: null,
        devMode: process.env.DEV_SEED === "true",
      });

    if (actor?.type === "participant" && actor.editionId !== editionId)
      editionId = actor.editionId;

    const edition = await db.edition.findUnique({ where: { id: editionId } });
    if (!edition) throw new Error("Edição não encontrada");

    // Dados-base independentes são carregados em paralelo. Antes, essas consultas
    // eram executadas em sequência em toda abertura/atualização do aplicativo.
    const [categories, speakers, rawActivities, rewards0, sponsors] =
      await Promise.all([
        db.activityCategory.findMany({
          where: { editionId },
          orderBy: { order: "asc" },
        }),
        db.speaker.findMany({ where: { editionId } }),
        db.activity.findMany({
          where: {
            editionId,
            ...(scope === "public" ? { status: { not: "DRAFT" } } : {}),
          },
          include: {
            speakers: { include: { speaker: true } },
            _count: {
              select: {
                enrollments: {
                  where: { status: { in: ["ACTIVE", "COMPLETED"] } },
                },
                waitlist: { where: { status: "WAITING" } },
              },
            },
          },
          orderBy: { startAt: "asc" },
        }),
        db.rewardItem.findMany({
          where: { editionId },
          orderBy: { order: "asc" },
        }),
        db.sponsor.findMany({
          where: {
            editionId,
            ...(scope === "public" ? { active: true } : {}),
          },
          orderBy: { order: "asc" },
        }),
      ]);

    const activities = rawActivities.map((a) => ({
      ...a,
      speakerIds: a.speakers.map((x) => x.speakerId),
      speakers: a.speakers.map((x) => x.speaker),
      enrolledCount: a._count.enrollments,
      waitlistCount: a._count.waitlist,
      workloadHours: a.workload,
      changeDeadline: a.swapDeadline,
      _count: undefined,
    }));

    let reservationsAll: any[] = [];
    let deliveriesAll: any[] = [];
    const reservedByReward = new Map<string, number>();
    const deliveredByReward = new Map<string, number>();

    if (scope === "admin" && actor?.type === "admin") {
      // O painel administrativo realmente usa as linhas completas. Carregamos uma
      // única vez e reutilizamos os mesmos dados para estoque e para a interface.
      [reservationsAll, deliveriesAll] = await Promise.all([
        db.rewardReservation.findMany({ where: { editionId } }),
        db.rewardDelivery.findMany({ where: { editionId } }),
      ]);

      for (const reservation of reservationsAll) {
        if (!["RESERVED", "CONFIRMED"].includes(reservation.status)) continue;
        reservedByReward.set(
          reservation.rewardId,
          (reservedByReward.get(reservation.rewardId) || 0) + reservation.quantity,
        );
      }
      for (const delivery of deliveriesAll) {
        if (delivery.status !== "DELIVERED") continue;
        deliveredByReward.set(
          delivery.rewardId,
          (deliveredByReward.get(delivery.rewardId) || 0) + delivery.quantity,
        );
      }
    } else {
      // Público e participante não precisam baixar todas as reservas/retiradas do
      // evento apenas para saber o estoque. O banco agrega por brinde e devolve
      // poucas linhas, mesmo com centenas de participantes.
      const [reservedAgg, deliveredAgg] = await Promise.all([
        db.rewardReservation.groupBy({
          by: ["rewardId"],
          where: {
            editionId,
            status: { in: ["RESERVED", "CONFIRMED"] },
          },
          _sum: { quantity: true },
        }),
        db.rewardDelivery.groupBy({
          by: ["rewardId"],
          where: { editionId, status: "DELIVERED" },
          _sum: { quantity: true },
        }),
      ]);

      for (const row of reservedAgg)
        reservedByReward.set(row.rewardId, row._sum.quantity || 0);
      for (const row of deliveredAgg)
        deliveredByReward.set(row.rewardId, row._sum.quantity || 0);

      if (actor?.type === "participant") {
        [reservationsAll, deliveriesAll] = await Promise.all([
          db.rewardReservation.findMany({
            where: { editionId, participantId: actor.id },
          }),
          db.rewardDelivery.findMany({
            where: { editionId, participantId: actor.id },
          }),
        ]);
      }
    }

    const rewards = rewards0.map((r) => {
      const reserved = reservedByReward.get(r.id) || 0;
      const delivered = deliveredByReward.get(r.id) || 0;
      const available = Math.max(0, r.total - reserved - delivered);
      return {
        ...r,
        stockTotal: r.total,
        stockReserved: reserved,
        stockDelivered: delivered,
        stockAvailable: available,
        available,
        reserved,
        delivered,
      };
    });

    if (scope === "public" || !actor) {
      const response = NextResponse.json({
        actor: null,
        edition,
        editions,
        categories,
        speakers,
        activities,
        rewards,
        sponsors,
        serverNow: new Date().toISOString(),
        devMode: process.env.DEV_SEED === "true",
      });
      // Programação pública pode ser compartilhada por alguns segundos entre todos
      // os visitantes. Isso evita uma consulta completa para cada celular que abre
      // a página ao mesmo tempo sem deixar alterações presas por muito tempo.
      response.headers.set(
        "Cache-Control",
        "public, s-maxage=15, stale-while-revalidate=45",
      );
      return response;
    }

    const participantWhere =
      actor.type === "participant" ? { id: actor.id } : { editionId };
    const participants0 = await db.participant.findMany({
      where: participantWhere,
      orderBy: { name: "asc" },
    });
    const participants = participants0.map((p) => ({ ...p, fullName: p.name }));
    const own = actor.type === "participant" ? { participantId: actor.id } : {};

    const [
      enrollments,
      waitlist,
      attendances,
      stamps,
      rules,
      eligibilities0,
      draws0,
      certificates,
      notifications0,
      audit,
      users,
    ] = await Promise.all([
      db.enrollment.findMany({ where: { editionId, ...own } }),
      db.waitlistEntry.findMany({
        where: { editionId, ...own },
        orderBy: { createdAt: "asc" },
      }),
      db.attendance.findMany({ where: { editionId, ...own } }),
      db.passportStamp.findMany({ where: { editionId, ...own } }),
      db.rewardRule.findMany({ where: { editionId } }),
      db.rewardEligibility.findMany({ where: { editionId, ...own } }),
      actor.type === "admin"
        ? db.rewardDraw.findMany({
            where: { editionId },
            include: { entries: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      db.certificate.findMany({ where: { editionId, ...own } }),
      actor.type === "participant"
        ? db.notificationRecipient.findMany({
            where: { participantId: actor.id },
            include: { notification: true },
            orderBy: { notification: { createdAt: "desc" } },
          })
        : db.notification.findMany({
            where: { editionId },
            orderBy: { createdAt: "desc" },
          }),
      actor.type === "admin"
        ? db.auditLog.findMany({
            where: { editionId },
            orderBy: { createdAt: "desc" },
            take: 1000,
          })
        : Promise.resolve([]),
      actor.type === "admin"
        ? db.adminUser.findMany({
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              permissions: true,
              active: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const notifications =
      actor.type === "participant"
        ? (notifications0 as any[]).map((r) => ({
            ...r.notification,
            readAt: r.readAt,
            recipientId: r.id,
          }))
        : (notifications0 as any[]);

    const eligibilities = eligibilities0.map((e) => ({
      ...e,
      status: e.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
    }));

    return NextResponse.json({
      actor,
      edition,
      editions,
      categories,
      speakers,
      activities,
      participant: actor.type === "participant" ? participants[0] : undefined,
      participants,
      enrollments,
      waitlist,
      attendances,
      stamps,
      rewards,
      rules,
      eligibilities,
      draws: draws0,
      reservations: reservationsAll,
      deliveries: deliveriesAll,
      certificates,
      notifications,
      audit,
      users: users.map((u: any) => ({
        ...u,
        permissions: JSON.parse(u.permissions || "[]"),
      })),
      sponsors,
      serverNow: new Date().toISOString(),
      devMode: process.env.DEV_SEED === "true",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
