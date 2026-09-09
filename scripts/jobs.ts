import { db, transaction } from "../src/server/db";
import { promoteWaitlist, audit } from "../src/server/domain";
async function run() {
  const now = new Date(),
    editions = await db.edition.findMany({ where: { status: "ACTIVE" } });
  for (const edition of editions)
    await transaction(async (tx) => {
      const acts = await tx.activity.findMany({
        where: {
          editionId: edition.id,
          startAt: {
            lte: new Date(now.getTime() - edition.noShowMinutes * 60000),
          },
        },
      });
      for (const a of acts) {
        const active = await tx.enrollment.findMany({
          where: { activityId: a.id, status: "ACTIVE", lateEnrollment: false },
        });
        for (const e of active) {
          const att = await tx.attendance.findUnique({
            where: {
              participantId_activityId: {
                participantId: e.participantId,
                activityId: a.id,
              },
            },
          });
          if (!att?.checkinAt) {
            await tx.enrollment.update({
              where: { id: e.id },
              data: { status: "NO_SHOW" },
            });
            await audit(
              tx,
              null,
              edition.id,
              "enrollment.no_show",
              "Enrollment",
              e.id,
              e,
              { status: "NO_SHOW" },
            );
          }
        }
        await promoteWaitlist(tx, edition.id, a.id, now);
      }
      const expired = await tx.rewardReservation.findMany({
        where: {
          editionId: edition.id,
          status: "AWAITING_CONFIRMATION",
          expiresAt: { lt: now },
        },
      });
      for (const r of expired) {
        await tx.rewardReservation.update({
          where: { id: r.id },
          data: { status: "EXPIRED" },
        });
        await audit(
          tx,
          null,
          edition.id,
          "reservation.expire",
          "RewardReservation",
          r.id,
          r,
          { status: "EXPIRED" },
        );
      }
    });
}
run().finally(() => db.$disconnect());
