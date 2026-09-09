import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getActor, errorResponse } from "@/server/security";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") || "public",
      actor = await getActor(req, scope);
    let editionId =
      req.nextUrl.searchParams.get("editionId") || actor?.editionId;
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
    const categories = await db.activityCategory.findMany({
        where: { editionId },
        orderBy: { order: "asc" },
      }),
      speakers = await db.speaker.findMany({ where: { editionId } }),
      rawActivities = await db.activity.findMany({
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
      });
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
    const rewards0 = await db.rewardItem.findMany({
        where: { editionId },
        orderBy: { order: "asc" },
      }),
      reservationsAll = await db.rewardReservation.findMany({
        where: { editionId },
      }),
      deliveriesAll = await db.rewardDelivery.findMany({
        where: { editionId },
      });
    const rewards = rewards0.map((r) => {
      const reserved = reservationsAll
          .filter(
            (x) =>
              x.rewardId === r.id &&
              ["RESERVED", "CONFIRMED"].includes(x.status),
          )
          .reduce((n, x) => n + x.quantity, 0),
        delivered = deliveriesAll
          .filter((x) => x.rewardId === r.id && x.status === "DELIVERED")
          .reduce((n, x) => n + x.quantity, 0);
      return {
        ...r,
        stockTotal: r.total,
        stockReserved: reserved,
        stockDelivered: delivered,
        stockAvailable: Math.max(0, r.total - reserved - delivered),
        available: Math.max(0, r.total - reserved - delivered),
        reserved,
        delivered,
      };
    });
    const sponsors = await db.sponsor.findMany({
      where: { editionId, ...(scope === "public" ? { active: true } : {}) },
      orderBy: { order: "asc" },
    });
    if (scope === "public" || !actor)
      return NextResponse.json({
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
    const participantWhere =
      actor.type === "participant" ? { id: actor.id } : { editionId };
    const participants0 = await db.participant.findMany({
      where: participantWhere,
      orderBy: { name: "asc" },
    });
    const participants = participants0.map((p) => ({ ...p, fullName: p.name }));
    const pids = participants.map((p) => p.id),
      own = actor.type === "participant" ? { participantId: { in: pids } } : {};
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
    const ownReservations =
      actor.type === "participant"
        ? reservationsAll.filter((x) => x.participantId === actor.id)
        : reservationsAll;
    const ownDeliveries =
      actor.type === "participant"
        ? deliveriesAll.filter((x) => x.participantId === actor.id)
        : deliveriesAll;
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
      reservations: ownReservations,
      deliveries: ownDeliveries,
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
