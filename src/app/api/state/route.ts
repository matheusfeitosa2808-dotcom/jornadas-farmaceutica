import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/server/db";
import { getActor, errorResponse } from "@/server/security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") || "public";
    const mode = req.nextUrl.searchParams.get("mode") || "";
    const actor = await getActor(req, scope);

    return await transaction(async (db) => {
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
          editions.find((e: any) => e.status === "ACTIVE")?.id || editions[0]?.id;

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

      if (scope === "admin" && actor?.type === "admin" && mode === "import") {
        return NextResponse.json({
          actor,
          edition,
          editions,
          serverNow: new Date().toISOString(),
          devMode: process.env.DEV_SEED === "true",
        });
      }

      const [
        categories,
        speakers,
        rawActivities,
        rewards0,
        reservationsAll,
        deliveriesAll,
        sponsors,
      ] = await Promise.all([
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
          orderBy: { startAt: "asc" },
        }),
        db.rewardItem.findMany({
          where: { editionId },
          orderBy: { order: "asc" },
        }),
        db.rewardReservation.findMany({ where: { editionId } }),
        db.rewardDelivery.findMany({ where: { editionId } }),
        db.sponsor.findMany({
          where: { editionId, ...(scope === "public" ? { active: true } : {}) },
          orderBy: { order: "asc" },
        }),
      ]);

      const activityIds = rawActivities.map((a: any) => a.id);
      const [activitySpeakers, occupiedEnrollments, waitingEntries] = activityIds.length
        ? await Promise.all([
            db.activitySpeaker.findMany({
              where: { activityId: { in: activityIds } },
            }),
            db.enrollment.findMany({
              where: {
                editionId,
                activityId: { in: activityIds },
                status: { in: ["ACTIVE", "COMPLETED"] },
              },
              select: { activityId: true },
            }),
            db.waitlistEntry.findMany({
              where: {
                editionId,
                activityId: { in: activityIds },
                status: "WAITING",
              },
              select: { activityId: true },
            }),
          ])
        : [[], [], []];

      const speakerById = new Map(speakers.map((s: any) => [s.id, s]));
      const speakersByActivity = new Map<string, any[]>();
      for (const link of activitySpeakers as any[]) {
        const list = speakersByActivity.get(link.activityId) || [];
        const speaker = speakerById.get(link.speakerId);
        if (speaker) list.push(speaker);
        speakersByActivity.set(link.activityId, list);
      }

      const enrolledCount = new Map<string, number>();
      for (const row of occupiedEnrollments as any[])
        enrolledCount.set(row.activityId, (enrolledCount.get(row.activityId) || 0) + 1);

      const waitlistCount = new Map<string, number>();
      for (const row of waitingEntries as any[])
        waitlistCount.set(row.activityId, (waitlistCount.get(row.activityId) || 0) + 1);

      const activities = rawActivities.map((a: any) => {
        const activitySpeakersList = speakersByActivity.get(a.id) || [];
        return {
          ...a,
          speakerIds: activitySpeakersList.map((s: any) => s.id),
          speakers: activitySpeakersList,
          enrolledCount: enrolledCount.get(a.id) || 0,
          waitlistCount: waitlistCount.get(a.id) || 0,
          workloadHours: a.workload,
          changeDeadline: a.swapDeadline,
        };
      });

      const rewards = rewards0.map((r: any) => {
        const reserved = reservationsAll
            .filter(
              (x: any) =>
                x.rewardId === r.id &&
                ["RESERVED", "CONFIRMED"].includes(x.status),
            )
            .reduce((n: number, x: any) => n + x.quantity, 0),
          delivered = deliveriesAll
            .filter((x: any) => x.rewardId === r.id && x.status === "DELIVERED")
            .reduce((n: number, x: any) => n + x.quantity, 0);
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
      const participants = participants0.map((p: any) => ({ ...p, fullName: p.name }));
      const pids = participants.map((p: any) => p.id);
      const own = actor.type === "participant" ? { participantId: { in: pids } } : {};

      const [
        enrollments,
        waitlist,
        attendances,
        stamps,
        rules,
        eligibilities0,
        drawsBase,
        certificates,
        notificationRecipients,
        adminNotifications,
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
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),
        db.certificate.findMany({ where: { editionId, ...own } }),
        actor.type === "participant"
          ? db.notificationRecipient.findMany({
              where: { participantId: actor.id },
            })
          : Promise.resolve([]),
        actor.type === "admin"
          ? db.notification.findMany({
              where: { editionId },
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),
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

      let draws = drawsBase as any[];
      if (actor.type === "admin" && draws.length) {
        const drawIds = draws.map((d: any) => d.id);
        const entries = await db.rewardDrawEntry.findMany({
          where: { drawId: { in: drawIds } },
        });
        const entriesByDraw = new Map<string, any[]>();
        for (const entry of entries) {
          const list = entriesByDraw.get(entry.drawId) || [];
          list.push(entry);
          entriesByDraw.set(entry.drawId, list);
        }
        draws = draws.map((draw: any) => ({
          ...draw,
          entries: entriesByDraw.get(draw.id) || [],
        }));
      }

      let notifications: any[];
      if (actor.type === "participant") {
        const notificationIds = (notificationRecipients as any[]).map(
          (r: any) => r.notificationId,
        );
        const notificationRows = notificationIds.length
          ? await db.notification.findMany({
              where: { id: { in: notificationIds } },
            })
          : [];
        const notificationById = new Map<string, any>(
          notificationRows.map(
            (n: any) => [String(n.id), n] as [string, any],
          ),
        );
        notifications = (notificationRecipients as any[])
          .map((r: any) => {
            const notification = notificationById.get(String(r.notificationId));
            return notification
              ? {
                  ...notification,
                  readAt: r.readAt,
                  recipientId: r.id,
                }
              : null;
          })
          .filter(Boolean)
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
      } else {
        notifications = adminNotifications as any[];
      }

      const eligibilities = eligibilities0.map((e: any) => ({
        ...e,
        status: e.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
      }));
      const ownReservations =
        actor.type === "participant"
          ? reservationsAll.filter((x: any) => x.participantId === actor.id)
          : reservationsAll;
      const ownDeliveries =
        actor.type === "participant"
          ? deliveriesAll.filter((x: any) => x.participantId === actor.id)
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
        draws,
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
    });
  } catch (e) {
    return errorResponse(e);
  }
}
