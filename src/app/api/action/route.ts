import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { transaction } from "@/server/db";
import {
  getActor,
  csrf,
  errorResponse,
  ensure,
  requireParticipant,
  requirePermission,
  safeUrl,
  hashPassword,
  normalizeName,
  permissionsList,
  rolePermissions,
} from "@/server/security";
import {
  audit,
  cancelEnrollment,
  checkAttendance,
  correctAttendance,
  enroll,
  issueCertificate,
  joinWaitlist,
  notify,
  promoteWaitlist,
  swapEnrollment,
} from "@/server/domain";
import { publish } from "@/server/events";
const D = (v: any) => (v ? new Date(v) : null),
  N = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d),
  B = (v: any, d = false) => (v === undefined ? d : Boolean(v));
async function rewardStock(tx: any, rewardId: string) {
  const r = await tx.rewardItem.findUnique({ where: { id: rewardId } });
  ensure(r, "Brinde não encontrado.", "NOT_FOUND", 404);
  const reserved = await tx.rewardReservation.aggregate({
      _sum: { quantity: true },
      where: { rewardId, status: { in: ["RESERVED", "CONFIRMED"] } },
    }),
    delivered = await tx.rewardDelivery.aggregate({
      _sum: { quantity: true },
      where: { rewardId, status: "DELIVERED" },
    });
  return {
    reward: r,
    available: Math.max(
      0,
      r.total - (reserved._sum.quantity || 0) - (delivered._sum.quantity || 0),
    ),
  };
}
async function recalc(tx: any, editionId: string, participantIds?: string[]) {
  const [people, rewards, rules, att] = await Promise.all([
    tx.participant.findMany({
      where: {
        editionId,
        active: true,
        ...(participantIds?.length ? { id: { in: participantIds } } : {}),
      },
    }),
    tx.rewardItem.findMany({ where: { editionId, active: true } }),
    tx.rewardRule.findMany({ where: { editionId } }),
    tx.attendance.findMany({
      where: {
        editionId,
        ...(participantIds?.length
          ? { participantId: { in: participantIds } }
          : {}),
        checkinAt: { not: null },
        status: { notIn: ["CANCELLED", "INVALIDATED"] },
      },
    }),
  ]);
  for (const p of people)
    for (const r of rewards) {
      const rule = rules.find((x: any) => x.rewardId === r.id),
        mine = att.filter((x: any) => x.participantId === p.id);
      const eligible =
        !!rule &&
        mine.length >= rule.minCheckins &&
        (!rule.activityId ||
          mine.some((x: any) => x.activityId === rule.activityId)) &&
        (!rule.categoryId ||
          (await tx.passportStamp.findFirst({
            where: {
              participantId: p.id,
              categoryId: rule.categoryId,
              status: "VALID",
            },
          }))) &&
        (!rule.completeJourney ||
          mine.length >=
            (await tx.edition.findUnique({ where: { id: editionId } }))
              .maxCheckins);
      const reason = eligible
        ? "Requisitos concluídos."
        : `Complete ${Math.max(0, (rule?.minCheckins || 0) - mine.length)} atividade(s).`;
      await tx.rewardEligibility.upsert({
        where: {
          rewardId_participantId: { rewardId: r.id, participantId: p.id },
        },
        create: {
          editionId,
          rewardId: r.id,
          participantId: p.id,
          eligible,
          reason,
        },
        update: { eligible, reason },
      });
    }
}
async function saveEntity(
  tx: any,
  entity: string,
  data: any,
  editionId: string,
  actor: any,
) {
  const id = data.id;
  requirePermission(
    actor,
    entity === "user"
      ? "users.manage"
      : entity === "edition"
        ? "editions.write"
        : entity === "participant"
          ? "participants.write"
          : ["reward", "rule"].includes(entity)
            ? "rewards.manage"
            : "activities.write",
  );
  let result: any;
  if (entity === "edition") {
    const current = id ? await tx.edition.findUnique({ where: { id } }) : null;
    const v = {
      name: data.name ?? current?.name,
      slug: data.slug ?? current?.slug,
      year: N(data.year ?? current?.year),
      slogan: data.slogan ?? current?.slogan ?? "",
      description: data.description ?? current?.description ?? "",
      startAt: D(data.startAt ?? current?.startAt)!,
      endAt: D(data.endAt ?? current?.endAt)!,
      timezone: data.timezone ?? current?.timezone ?? "America/Manaus",
      status: data.status ?? current?.status ?? "DRAFT",
      maxActivities: N(data.maxActivities ?? current?.maxActivities, 5),
      maxCheckins: N(data.maxCheckins ?? current?.maxCheckins, 5),
      normalMinutes: N(
        data.normalMinutes ?? data.checkinMinutes ?? current?.normalMinutes,
        15,
      ),
      noShowMinutes: N(data.noShowMinutes ?? current?.noShowMinutes, 20),
      lateMinutes: N(
        data.lateMinutes ?? data.lateCheckinMinutes ?? current?.lateMinutes,
        25,
      ),
      checkoutMinutes: N(data.checkoutMinutes ?? current?.checkoutMinutes, 24),
      reminderMinutes: Array.isArray(data.reminderMinutes)
        ? data.reminderMinutes.join(",")
        : String(data.reminderMinutes ?? current?.reminderMinutes ?? "30,10"),
      allowMultipleRewards: B(
        data.allowMultipleRewards,
        current?.allowMultipleRewards ?? true,
      ),
      logoUrl:
        safeUrl(data.logoUrl ?? current?.logoUrl, false) ||
        "/assets/brand/logo-jornada-2026-trimmed.webp",
      primaryColor: data.primaryColor ?? current?.primaryColor ?? "#174f58",
      secondaryColor:
        data.secondaryColor ?? current?.secondaryColor ?? "#b18a3b",
      backgroundColor:
        data.backgroundColor ?? current?.backgroundColor ?? "#f8f9f6",
    };
    result = id
      ? await tx.edition.update({ where: { id }, data: v })
      : await tx.edition.create({ data: v });
  } else if (entity === "participant") {
    const name = String(data.fullName || data.name || "").trim(),
      ra = String(data.ra || "").trim();
    ensure(
      name && ra && N(data.semester) > 0,
      "Nome, RA e semestre são obrigatórios.",
    );
    const firstName = name.split(/\s+/)[0];
    const v = {
      editionId,
      name,
      firstName,
      normalizedName: normalizeName(firstName),
      ra,
      semester: N(data.semester),
      photoUrl: safeUrl(data.photoUrl),
      active: B(data.active, true),
    };
    result = id
      ? await tx.participant.update({ where: { id }, data: v })
      : await tx.participant.create({ data: v });
  } else if (entity === "category") {
    const v = {
      editionId,
      name: data.name,
      slug: data.slug,
      color: data.color || "#174f58",
      icon: data.icon || "book",
      order: N(data.order),
      requiresEnrollment: B(data.requiresEnrollment, true),
      requiresCheckin: B(data.requiresCheckin, true),
      requiresCheckout: B(data.requiresCheckout),
      generatesStamp: B(data.generatesStamp, true),
      generatesCertificate: B(data.generatesCertificate),
      active: B(data.active, true),
      stampUrl: safeUrl(data.stampUrl),
    };
    result = id
      ? await tx.activityCategory.update({ where: { id }, data: v })
      : await tx.activityCategory.create({ data: v });
  } else if (entity === "speaker") {
    const v = {
      editionId,
      name: data.name,
      bio: data.bio || "",
      institution: data.institution || "",
      photoUrl: safeUrl(data.photoUrl),
      curriculumUrl: safeUrl(data.curriculumUrl),
    };
    result = id
      ? await tx.speaker.update({ where: { id }, data: v })
      : await tx.speaker.create({ data: v });
  } else if (entity === "activity") {
    const startAt = D(data.startAt)!,
      endAt = D(data.endAt)!;
    ensure(startAt < endAt, "O fim deve ocorrer depois do início.");
    if (id) {
      const conflicts = await tx.enrollment.findMany({
        where: {
          activityId: id,
          status: { in: ["ACTIVE", "COMPLETED"] },
          participant: {
            enrollments: {
              some: {
                status: { in: ["ACTIVE", "COMPLETED"] },
                activityId: { not: id },
                activity: { startAt: { lt: endAt }, endAt: { gt: startAt } },
              },
            },
          },
        },
        include: { participant: true },
      });
      if (conflicts.length && !data.confirmConflicts)
        throw Object.assign(
          new Error("A alteração cria conflitos para participantes inscritos."),
          {
            details: {
              conflicts: conflicts.map((x: any) => ({
                participantId: x.participantId,
                participantName: x.participant.name,
              })),
            },
          },
        );
    }
    const v = {
      editionId,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description || "",
      startAt,
      endAt,
      block: data.block || "",
      room: data.room || "",
      capacity: N(data.capacity, 20),
      enrollmentOpen: B(data.enrollmentOpen, true),
      enrollmentDeadline: D(data.enrollmentDeadline),
      swapDeadline: D(data.swapDeadline ?? data.changeDeadline),
      workload: N(data.workload ?? data.workloadHours, 1),
      status: data.status || "OPEN",
      allowWaitlist: B(data.allowWaitlist, true),
      stampUrl: safeUrl(data.stampUrl),
    };
    result = id
      ? await tx.activity.update({
          where: { id },
          data: {
            ...v,
            speakers: {
              deleteMany: {},
              create: (data.speakerIds || []).map((speakerId: string) => ({
                speakerId,
              })),
            },
          },
        })
      : await tx.activity.create({
          data: {
            ...v,
            speakers: {
              create: (data.speakerIds || []).map((speakerId: string) => ({
                speakerId,
              })),
            },
          },
        });
  } else if (entity === "reward") {
    const v = {
      editionId,
      name: data.name,
      description: data.description || "",
      imageUrl: safeUrl(data.imageUrl),
      total: N(data.total ?? data.stockTotal),
      active: B(data.active, true),
      order: N(data.order),
      confirmationMinutes: N(data.confirmationMinutes, 60),
      redemptionStartsAt: D(data.redemptionStartsAt),
      exclusiveGroup: data.exclusiveGroup || null,
    };
    result = id
      ? await tx.rewardItem.update({ where: { id }, data: v })
      : await tx.rewardItem.create({ data: v });
  } else if (entity === "rule") {
    const v = {
      editionId,
      rewardId: data.rewardId,
      minCheckins: N(data.minCheckins, 1),
      categoryId: data.categoryId || null,
      activityId: data.activityId || null,
      completeJourney: B(data.completeJourney) || data.type === "FULL_JOURNEY",
    };
    result = id
      ? await tx.rewardRule.update({ where: { id }, data: v })
      : await tx.rewardRule.create({ data: v });
    await recalc(tx, editionId);
  } else if (entity === "sponsor") {
    const v = {
      editionId,
      name: data.name,
      logoUrl: safeUrl(data.logoUrl),
      url: safeUrl(data.url),
      order: N(data.order),
      active: B(data.active, true),
    };
    result = id
      ? await tx.sponsor.update({ where: { id }, data: v })
      : await tx.sponsor.create({ data: v });
  } else if (entity === "user") {
    ensure(data.email && data.name, "Nome e e-mail são obrigatórios.");
    const role = data.role || "OPERATOR",
      permissions = JSON.stringify(
        [...(rolePermissions[role] || []), ...(data.permissions || [])].filter(
          (x: string, i: number, a: string[]) =>
            permissionsList.includes(x) && a.indexOf(x) === i,
        ),
      );
    const v: any = {
      name: data.name,
      email: String(data.email).toLowerCase(),
      role,
      permissions,
      active: B(data.active, true),
    };
    if (data.password) {
      ensure(
        String(data.password).length >= 10,
        "A senha deve ter ao menos 10 caracteres.",
      );
      v.passwordHash = hashPassword(data.password);
    }
    if (id) result = await tx.adminUser.update({ where: { id }, data: v });
    else {
      ensure(v.passwordHash, "A senha é obrigatória ao criar.");
      result = await tx.adminUser.create({ data: v });
    }
  } else throw new Error("Entidade inválida.");
  await audit(
    tx,
    actor,
    entity === "edition" ? result.id : editionId,
    "entity.save",
    entity,
    result.id,
    undefined,
    result,
  );
  return result;
}
export async function POST(req: NextRequest) {
  try {
    csrf(req);
    const body = (await req.json()) as any,
      scope =
        body.scope === "admin" ||
        (!body.scope && Boolean(req.cookies.get("jornadas_admin")))
          ? "admin"
          : "participant",
      actor = await getActor(req, scope);
    ensure(actor, "Faça login para continuar.", "UNAUTHORIZED", 401);
    const editionId = String(body.editionId || actor.editionId || "");
    if (actor.type === "participant") requireParticipant(actor, editionId);
    let result: any,
      message = "Alteração salva.";
    await transaction(async (tx) => {
      switch (body.action) {
        case "entity.save":
          result = await saveEntity(
            tx,
            body.entity,
            body.data || {},
            editionId,
            actor,
          );
          break;
        case "enrollment.create":
          requireParticipant(actor, editionId);
          result = await enroll(
            tx,
            editionId,
            actor.id,
            body.activityId,
            actor,
          );
          message = "Inscrição confirmada.";
          break;
        case "enrollment.cancel":
          result = await cancelEnrollment(
            tx,
            editionId,
            body.enrollmentId,
            actor,
          );
          message = "Inscrição cancelada.";
          break;
        case "enrollment.swap":
          result = await swapEnrollment(
            tx,
            editionId,
            body.enrollmentId,
            body.activityId,
            actor,
          );
          message = "Troca confirmada.";
          break;
        case "waitlist.join":
          requireParticipant(actor, editionId);
          result = await joinWaitlist(
            tx,
            editionId,
            actor.id,
            body.activityId,
            actor,
          );
          message = "Você entrou na lista de espera.";
          break;
        case "waitlist.leave":
          requireParticipant(actor, editionId);
          result = await tx.waitlistEntry.updateMany({
            where: {
              editionId,
              participantId: actor.id,
              activityId: body.activityId,
              status: "WAITING",
            },
            data: { status: "REMOVED" },
          });
          await audit(
            tx,
            actor,
            editionId,
            "waitlist.leave",
            "WaitlistEntry",
            body.activityId,
          );
          break;
        case "attendance.checkin":
          result = await checkAttendance(
            tx,
            editionId,
            body.activityId,
            String(body.ra),
            "CHECK_IN",
            actor,
          );
          await recalc(tx, editionId, [result.participantId]);
          message = "Presença confirmada e carimbo emitido.";
          break;
        case "attendance.checkout":
          result = await checkAttendance(
            tx,
            editionId,
            body.activityId,
            String(body.ra),
            "CHECK_OUT",
            actor,
          );
          message = "Check-out confirmado.";
          break;
        case "attendance.correct":
          result = await correctAttendance(
            tx,
            editionId,
            body.attendanceId,
            body.operation,
            body.reason,
            actor,
          );
          await recalc(tx, editionId, [result.participantId]);
          break;
        case "activity.cancel": {
          requirePermission(actor, "activities.write");
          ensure(
            String(body.reason || "").trim().length >= 5,
            "Informe o motivo.",
          );
          result = await tx.activity.update({
            where: { id: body.activityId },
            data: { status: "CANCELLED" },
          });
          const affected = await tx.enrollment.findMany({
            where: { activityId: body.activityId, status: "ACTIVE" },
          });
          await tx.enrollment.updateMany({
            where: { activityId: body.activityId, status: "ACTIVE" },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelReason: body.reason,
            },
          });
          await tx.waitlistEntry.updateMany({
            where: { activityId: body.activityId, status: "WAITING" },
            data: { status: "REMOVED" },
          });
          await notify(
            tx,
            editionId,
            affected.map((x: any) => x.participantId),
            "ACTIVITY_CANCELLED",
            "Atividade cancelada",
            result.title,
          );
          await audit(
            tx,
            actor,
            editionId,
            "activity.cancel",
            "Activity",
            result.id,
            undefined,
            result,
            body.reason,
          );
          break;
        }
        case "edition.duplicate": {
          requirePermission(actor, "editions.write");
          const src = await tx.edition.findUniqueOrThrow({
            where: { id: body.sourceEditionId },
            include: { categories: true, sponsors: true },
          });
          result = await tx.edition.create({
            data: {
              name: body.name,
              slug: `${src.slug.replace(/-\d{4}$/, "")}-${body.year}-${randomBytes(2).toString("hex")}`,
              year: N(body.year),
              slogan: src.slogan,
              description: src.description,
              startAt: src.startAt,
              endAt: src.endAt,
              timezone: src.timezone,
              status: "DRAFT",
              maxActivities: src.maxActivities,
              maxCheckins: src.maxCheckins,
              normalMinutes: src.normalMinutes,
              noShowMinutes: src.noShowMinutes,
              lateMinutes: src.lateMinutes,
              checkoutMinutes: src.checkoutMinutes,
              reminderMinutes: src.reminderMinutes,
              allowMultipleRewards: src.allowMultipleRewards,
              logoUrl: src.logoUrl,
              primaryColor: src.primaryColor,
              secondaryColor: src.secondaryColor,
              backgroundColor: src.backgroundColor,
              categories: {
                create: src.categories.map((c: any) => ({
                  name: c.name,
                  slug: c.slug,
                  color: c.color,
                  icon: c.icon,
                  order: c.order,
                  requiresEnrollment: c.requiresEnrollment,
                  requiresCheckin: c.requiresCheckin,
                  requiresCheckout: c.requiresCheckout,
                  generatesStamp: c.generatesStamp,
                  generatesCertificate: c.generatesCertificate,
                  active: c.active,
                  stampUrl: c.stampUrl,
                })),
              },
              sponsors: body.copySponsors
                ? {
                    create: src.sponsors.map((s: any) => ({
                      name: s.name,
                      logoUrl: s.logoUrl,
                      url: s.url,
                      order: s.order,
                      active: s.active,
                    })),
                  }
                : undefined,
            },
          });
          await audit(
            tx,
            actor,
            result.id,
            "edition.duplicate",
            "Edition",
            result.id,
            src,
            result,
          );
          break;
        }
        case "draw.execute": {
          requirePermission(actor, "draws.execute");
          await recalc(tx, editionId);
          const { reward, available } = await rewardStock(tx, body.rewardId);
          ensure(available > 0, "Sem estoque disponível.");
          const elig = await tx.rewardEligibility.findMany({
            where: { editionId, rewardId: reward.id, eligible: true },
          });
          const prior = await tx.rewardReservation.findMany({
            where: {
              rewardId: reward.id,
              status: {
                in: ["AWAITING_CONFIRMATION", "RESERVED", "DELIVERED"],
              },
            },
          });
          const blocked = new Set(prior.map((x: any) => x.participantId)),
            pool = elig.filter((x: any) => !blocked.has(x.participantId));
          ensure(pool.length > 0, "Nenhum elegível disponível.");
          const round =
              (await tx.rewardDraw.count({ where: { rewardId: reward.id } })) +
              1,
            seed = randomBytes(20).toString("hex"),
            ordered = pool
              .map((e: any) => ({
                ...e,
                key: createHash("sha256")
                  .update(seed + e.participantId)
                  .digest("hex"),
              }))
              .sort((a: any, b: any) => a.key.localeCompare(b.key)),
            winners = ordered.slice(0, Math.min(available, ordered.length)),
            draw = await tx.rewardDraw.create({
              data: {
                editionId,
                rewardId: reward.id,
                round,
                stockSnapshot: available,
                eligibleCount: pool.length,
                operatorId: actor.id,
                mode: pool.length <= available ? "GUARANTEED" : "DRAW",
                randomSeed: seed,
                snapshot: JSON.stringify(pool.map((e: any) => e.participantId)),
                entries: {
                  create: ordered.map((e: any, i: number) => ({
                    participantId: e.participantId,
                    winner: i < winners.length,
                    rank: i + 1,
                  })),
                },
              },
            });
          for (const w of winners)
            await tx.rewardReservation.create({
              data: {
                editionId,
                rewardId: reward.id,
                participantId: w.participantId,
                drawId: draw.id,
                status: "AWAITING_CONFIRMATION",
                expiresAt: new Date(
                  Date.now() + reward.confirmationMinutes * 60000,
                ),
              },
            });
          await notify(
            tx,
            editionId,
            winners.map((x: any) => x.participantId),
            "REWARD_WIN",
            "Você foi contemplado!",
            `${reward.name} · Confirme dentro do prazo.`,
          );
          await audit(
            tx,
            actor,
            editionId,
            "draw.execute",
            "RewardDraw",
            draw.id,
            undefined,
            draw,
          );
          result = draw;
          message =
            pool.length <= available
              ? "Todos os elegíveis foram contemplados."
              : "Sorteio concluído.";
          break;
        }
        case "draw.cancel": {
          requirePermission(actor, "draws.execute");
          const reason = String(body.reason || "").trim();
          ensure(reason.length >= 5, "Informe o motivo do cancelamento.");
          const draw = await tx.rewardDraw.findFirst({
            where: { id: body.drawId, editionId },
            include: { reservations: { include: { deliveries: true } } },
          });
          ensure(draw, "Sorteio não encontrado.", "NOT_FOUND", 404);
          ensure(draw.status === "EXECUTED", "Este sorteio já foi cancelado.");
          ensure(
            !draw.reservations.some((reservation: any) =>
              reservation.deliveries.some(
                (delivery: any) => delivery.status === "DELIVERED",
              ),
            ),
            "Não é possível cancelar um sorteio com brindes já retirados.",
          );
          const before = draw;
          await tx.rewardReservation.updateMany({
            where: {
              drawId: draw.id,
              status: { in: ["AWAITING_CONFIRMATION", "RESERVED"] },
            },
            data: { status: "EXPIRED" },
          });
          result = await tx.rewardDraw.update({
            where: { id: draw.id },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelReason: reason,
            },
          });
          await audit(
            tx,
            actor,
            editionId,
            "draw.cancel",
            "RewardDraw",
            draw.id,
            before,
            result,
            reason,
          );
          message = "Sorteio cancelado e estoque liberado.";
          break;
        }
        case "reservation.confirm": {
          requireParticipant(actor, editionId);
          const res = await tx.rewardReservation.findFirst({
            where: {
              id: body.reservationId,
              participantId: actor.id,
              editionId,
            },
          });
          ensure(
            res && res.status === "AWAITING_CONFIRMATION",
            "Reserva indisponível.",
          );
          ensure(
            res.expiresAt >= new Date(),
            "Prazo de confirmação expirado.",
            "EXPIRED",
          );
          result = await tx.rewardReservation.update({
            where: { id: res.id },
            data: { status: "RESERVED", confirmedAt: new Date() },
          });
          await audit(
            tx,
            actor,
            editionId,
            "reservation.confirm",
            "RewardReservation",
            res.id,
            res,
            result,
          );
          message = "Brinde reservado para retirada.";
          break;
        }
        case "delivery.create": {
          requirePermission(actor, "deliveries.manage");
          ensure(
            Array.isArray(body.reservationIds) && body.reservationIds.length,
            "Selecione ao menos um item.",
          );
          result = [];
          for (const rid of body.reservationIds) {
            const r = await tx.rewardReservation.findFirst({
              where: {
                id: rid,
                editionId,
                status: { in: ["RESERVED", "CONFIRMED"] },
              },
            });
            ensure(r, "Reserva indisponível.");
            const reward = await tx.rewardItem.findUnique({
              where: { id: r.rewardId },
              include: { edition: true },
            });
            ensure(reward, "Brinde não encontrado.", "NOT_FOUND", 404);
            const redemptionStartsAt = reward.redemptionStartsAt;
            ensure(
              !redemptionStartsAt || redemptionStartsAt.getTime() <= Date.now(),
              `${reward.name} só poderá ser retirado a partir de ${new Intl.DateTimeFormat(
                "pt-BR",
                {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: reward.edition.timezone,
                },
              ).format(redemptionStartsAt || undefined)}.`,
            );
            const del = await tx.rewardDelivery.create({
              data: {
                editionId,
                participantId: r.participantId,
                rewardId: r.rewardId,
                reservationId: r.id,
                quantity: r.quantity,
                operatorId: actor.id,
              },
            });
            await tx.rewardReservation.update({
              where: { id: r.id },
              data: { status: "DELIVERED" },
            });
            result.push(del);
            await audit(
              tx,
              actor,
              editionId,
              "delivery.create",
              "RewardDelivery",
              del.id,
              undefined,
              del,
            );
          }
          message = "Retirada confirmada.";
          break;
        }
        case "delivery.reverse": {
          requirePermission(actor, "deliveries.manage");
          ensure(
            String(body.reason || "").trim().length >= 5,
            "Informe o motivo.",
          );
          const old = await tx.rewardDelivery.findFirst({
            where: { id: body.deliveryId, editionId, status: "DELIVERED" },
          });
          ensure(old, "Entrega não encontrada.");
          result = await tx.rewardDelivery.update({
            where: { id: old.id },
            data: {
              status: "REVERSED",
              reversedAt: new Date(),
              reverseReason: body.reason,
            },
          });
          await tx.rewardReservation.update({
            where: { id: old.reservationId },
            data: { status: "RESERVED" },
          });
          await audit(
            tx,
            actor,
            editionId,
            "delivery.reverse",
            "RewardDelivery",
            old.id,
            old,
            result,
            body.reason,
          );
          break;
        }
        case "certificate.issue":
          requirePermission(actor, "certificates.manage");
          result = await issueCertificate(
            tx,
            editionId,
            body.participantId,
            body.activityId,
            actor,
          );
          break;
        case "certificate.invalidate": {
          requirePermission(actor, "certificates.manage");
          ensure(
            String(body.reason || "").trim().length >= 5,
            "Informe o motivo.",
          );
          const cert = await tx.certificate.findFirst({
            where: { id: body.id, editionId },
          });
          ensure(cert, "Certificado não encontrado.");
          result = await tx.certificate.update({
            where: { id: cert.id },
            data: {
              status: "INVALIDATED",
              invalidatedAt: new Date(),
              invalidationReason: body.reason,
            },
          });
          await audit(
            tx,
            actor,
            editionId,
            "certificate.invalidate",
            "Certificate",
            cert.id,
            cert,
            result,
            body.reason,
          );
          break;
        }
        case "notification.send": {
          requirePermission(actor, "notifications.send");
          const recipients = await tx.participant.findMany({
            where: {
              editionId,
              active: true,
              ...(body.audience === "semester"
                ? { semester: N(body.semester) }
                : {}),
            },
          });
          result = await notify(
            tx,
            editionId,
            recipients.map((x: any) => x.id),
            "ANNOUNCEMENT",
            body.title,
            body.message,
            undefined,
            body.audience,
          );
          break;
        }
        case "notification.read":
          requireParticipant(actor, editionId);
          result = await tx.notificationRecipient.updateMany({
            where: {
              participantId: actor.id,
              OR: [{ id: body.id }, { notificationId: body.id }],
            },
            data: { readAt: new Date() },
          });
          break;
        case "participant.photo":
          requireParticipant(actor, editionId);
          result = await tx.participant.update({
            where: { id: actor.id },
            data: { photoUrl: safeUrl(body.photoUrl) },
          });
          break;
        case "import.confirm": {
          requirePermission(actor, "participants.write");
          const job = await tx.importJob.findFirst({
            where: { id: body.jobId, editionId, status: "PREVIEW" },
            include: { rows: { where: { status: "VALID" } } },
          });
          ensure(job, "Importação não encontrada.");
          for (const row of job.rows)
            await tx.participant.create({
              data: {
                editionId,
                name: row.name,
                firstName: row.name.split(/\s+/)[0],
                normalizedName: normalizeName(row.name.split(/\s+/)[0]),
                ra: row.ra,
                semester: row.semester!,
              },
            });
          result = await tx.importJob.update({
            where: { id: job.id },
            data: { status: "IMPORTED", confirmedAt: new Date() },
          });
          await audit(
            tx,
            actor,
            editionId,
            "import.confirm",
            "ImportJob",
            job.id,
            job,
            result,
          );
          message = `${job.valid} participantes importados.`;
          break;
        }
        case "jobs.run": {
          requirePermission(actor, "editions.write");
          const now = new Date(),
            acts = await tx.activity.findMany({
              where: { editionId, startAt: { lte: now } },
              include: { edition: true },
            });
          let noshow = 0;
          for (const a of acts) {
            if (
              now >=
              new Date(a.startAt.getTime() + a.edition.noShowMinutes * 60000)
            ) {
              const active = await tx.enrollment.findMany({
                where: {
                  activityId: a.id,
                  status: "ACTIVE",
                  lateEnrollment: false,
                },
              });
              for (const e of active) {
                const attendance = await tx.attendance.findUnique({
                  where: {
                    participantId_activityId: {
                      participantId: e.participantId,
                      activityId: a.id,
                    },
                  },
                });
                if (!attendance?.checkinAt) {
                  await tx.enrollment.update({
                    where: { id: e.id },
                    data: { status: "NO_SHOW" },
                  });
                  noshow++;
                }
              }
              await promoteWaitlist(tx, editionId, a.id, now);
            }
          }
          const exp = await tx.rewardReservation.updateMany({
            where: {
              editionId,
              status: "AWAITING_CONFIRMATION",
              expiresAt: { lt: now },
            },
            data: { status: "EXPIRED" },
          });
          await recalc(tx, editionId);
          result = { noShows: noshow, expired: exp.count };
          break;
        }
        default:
          throw new Error("Ação não reconhecida.");
      }
    });
    publish(editionId);
    const flat =
      result && typeof result === "object" && !Array.isArray(result)
        ? result
        : {};
    return NextResponse.json({ ok: true, ...flat, result, message });
  } catch (e: any) {
    if (e.details && !(e.name === "DomainError"))
      return NextResponse.json(
        { error: e.message, code: "CONFLICTS", details: e.details },
        { status: 409 },
      );
    return errorResponse(e);
  }
}
