import { randomBytes } from "node:crypto";
import type { Tx } from "@/server/db";
import { Actor, DomainError, ensure, requirePermission } from "./security";

export const minute = 60_000;
export const occupiedStatuses = ["ACTIVE", "COMPLETED"];
export const liveReservationStatuses = [
  "AWAITING_CONFIRMATION",
  "RESERVED",
  "DELIVERED",
];
export const overlaps = (
  a: { startAt: Date; endAt: Date },
  b: { startAt: Date; endAt: Date },
) => a.startAt < b.endAt && a.endAt > b.startAt;

export async function audit(
  tx: Tx,
  actor: Actor | null,
  editionId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown,
  reason?: string,
) {
  return tx.auditLog.create({
    data: {
      editionId,
      actorType: actor?.type ?? "SYSTEM",
      actorId: actor?.id ?? "jobs",
      action,
      entityType,
      entityId,
      oldValue: oldValue === undefined ? null : JSON.stringify(oldValue),
      newValue: newValue === undefined ? null : JSON.stringify(newValue),
      reason,
      ip: actor?.ip,
    },
  });
}
export async function notify(
  tx: Tx,
  editionId: string,
  participantIds: string[],
  type: string,
  title: string,
  message: string,
  dedupeKey?: string,
  audience = "selected",
) {
  const ids = [...new Set(participantIds)];
  if (!ids.length) return null;
  if (dedupeKey && (await tx.notification.findUnique({ where: { dedupeKey } })))
    return null;
  return tx.notification.create({
    data: {
      editionId,
      type,
      title,
      message,
      dedupeKey,
      audience,
      recipients: { create: ids.map((participantId) => ({ participantId })) },
    },
  });
}
export async function editionOf(tx: Tx, editionId: string) {
  const edition = await tx.edition.findUnique({ where: { id: editionId } });
  ensure(edition, "Edição não encontrada.", "NOT_FOUND", 404);
  return edition;
}
export async function activityOf(tx: Tx, editionId: string, id: string) {
  const activity = await tx.activity.findFirst({
    where: { id, editionId },
    include: { category: true, edition: true },
  });
  ensure(activity, "Atividade não encontrada nesta edição.", "NOT_FOUND", 404);
  return activity;
}
export async function validateEnrollment(
  tx: Tx,
  editionId: string,
  participantId: string,
  activityId: string,
  now: Date,
  excludeId?: string,
  checkCapacity = true,
) {
  const activity = await activityOf(tx, editionId, activityId);
  const edition = activity.edition;
  ensure(
    ["ACTIVE", "PUBLISHED"].includes(edition.status),
    "Esta edição não está aberta para inscrições.",
    "EDITION_CLOSED",
  );
  ensure(
    activity.enrollmentOpen &&
      !["DRAFT", "CANCELLED", "FINISHED"].includes(activity.status),
    "Inscrições encerradas.",
    "ENROLLMENT_CLOSED",
  );
  const participant = await tx.participant.findFirst({
    where: { id: participantId, editionId, active: true },
  });
  ensure(
    participant,
    "Participante não encontrado nesta edição.",
    "NOT_FOUND",
    404,
  );
  ensure(
    now <=
      new Date(activity.startAt.getTime() + edition.lateMinutes * minute) &&
      now < activity.endAt,
    "Prazo de inscrição encerrado.",
    "ENROLLMENT_DEADLINE",
  );
  ensure(
    !activity.enrollmentDeadline || now <= activity.enrollmentDeadline,
    "Prazo de inscrição encerrado.",
    "ENROLLMENT_DEADLINE",
  );
  const enrolled = await tx.enrollment.findMany({
    where: {
      editionId,
      participantId,
      status: { in: occupiedStatuses },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { activity: true },
  });
  ensure(
    !enrolled.some((e: any) => e.activityId === activityId),
    "Você já está inscrito nesta atividade.",
    "ALREADY_ENROLLED",
    409,
  );
  const conflict = enrolled.find((e: any) => overlaps(e.activity, activity));
  ensure(
    !conflict,
    `Conflito de horário${conflict ? ` com ${conflict.activity.title}` : ""}.`,
    "SCHEDULE_CONFLICT",
    409,
  );
  ensure(
    edition.maxActivities === 0 || enrolled.length < edition.maxActivities,
    "Limite de atividades da edição atingido.",
    "ACTIVITY_LIMIT",
  );
  if (checkCapacity) {
    const count = await tx.enrollment.count({
      where: { activityId, status: { in: occupiedStatuses } },
    });
    ensure(
      count < activity.capacity,
      "Atividade lotada. Entre na lista de espera.",
      "FULL",
      409,
    );
  }
  return activity;
}
export async function enroll(
  tx: Tx,
  editionId: string,
  participantId: string,
  activityId: string,
  actor: Actor | null,
  now = new Date(),
  excludeId?: string,
  source = "PARTICIPANT",
) {
  const activity = await validateEnrollment(
    tx,
    editionId,
    participantId,
    activityId,
    now,
    excludeId,
  );
  const lateEnrollment =
    now.getTime() >
    activity.startAt.getTime() + activity.edition.normalMinutes * minute;
  const data = {
    editionId,
    participantId,
    activityId,
    status: "ACTIVE",
    lateEnrollment,
    source,
    createdAt: now,
    cancelledAt: null,
    cancelReason: null,
  };
  const entry = await tx.enrollment.upsert({
    where: { participantId_activityId: { participantId, activityId } },
    create: data,
    update: data,
  });
  await tx.waitlistEntry.updateMany({
    where: { activityId, participantId, status: "WAITING" },
    data: { status: "PROMOTED", promotedAt: now },
  });
  await notify(
    tx,
    editionId,
    [participantId],
    source === "WAITLIST" ? "WAITLIST_PROMOTED" : "ENROLLMENT_CONFIRMED",
    source === "WAITLIST" ? "Sua vaga chegou!" : "Inscrição confirmada",
    `${activity.title} · ${activity.block} · ${activity.room}${lateEnrollment ? `. Check-in até ${new Date(activity.startAt.getTime() + activity.edition.lateMinutes * minute).toLocaleTimeString("pt-BR", { timeZone: activity.edition.timezone, hour: "2-digit", minute: "2-digit" })}.` : ""}`,
  );
  await audit(
    tx,
    actor,
    editionId,
    "enrollment.create",
    "Enrollment",
    entry.id,
    undefined,
    entry,
  );
  return entry;
}
export async function promoteWaitlist(
  tx: Tx,
  editionId: string,
  activityId: string,
  now = new Date(),
) {
  const activity = await activityOf(tx, editionId, activityId);
  const queue = await tx.waitlistEntry.findMany({
    where: { activityId, status: "WAITING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const promoted = [];
  for (const queued of queue) {
    const count = await tx.enrollment.count({
      where: { activityId, status: { in: occupiedStatuses } },
    });
    if (count >= activity.capacity) break;
    try {
      promoted.push(
        await enroll(
          tx,
          editionId,
          queued.participantId,
          activityId,
          null,
          now,
          undefined,
          "WAITLIST",
        ),
      );
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      if (
        ["ENROLLMENT_DEADLINE", "ENROLLMENT_CLOSED", "EDITION_CLOSED"].includes(
          error.code,
        )
      )
        break;
      if (
        [
          "SCHEDULE_CONFLICT",
          "ACTIVITY_LIMIT",
          "NOT_FOUND",
          "ALREADY_ENROLLED",
        ].includes(error.code)
      ) {
        await tx.waitlistEntry.update({
          where: { id: queued.id },
          data: { status: "SKIPPED" },
        });
        await notify(
          tx,
          editionId,
          [queued.participantId],
          "WAITLIST_SKIPPED",
          "Lista de espera atualizada",
          `Não foi possível promover sua inscrição: ${error.message}`,
        );
      } else throw error;
    }
  }
  return promoted;
}
export async function cancelEnrollment(
  tx: Tx,
  editionId: string,
  enrollmentId: string,
  actor: Actor,
  now = new Date(),
  reason = "Cancelada pelo participante",
) {
  const current = await tx.enrollment.findFirst({
    where: { id: enrollmentId, editionId },
    include: { activity: { include: { edition: true } } },
  });
  ensure(current, "Inscrição não encontrada.", "NOT_FOUND", 404);
  ensure(
    actor.type === "admin" || current.participantId === actor.id,
    "Inscrição de outro participante.",
    "FORBIDDEN",
    403,
  );
  if (actor.type === "admin") requirePermission(actor, "participants.write");
  ensure(
    current.status === "ACTIVE",
    "Esta inscrição não pode ser cancelada.",
    "INVALID_STATUS",
  );
  const attendance = await tx.attendance.findUnique({
    where: {
      participantId_activityId: {
        participantId: current.participantId,
        activityId: current.activityId,
      },
    },
  });
  ensure(
    !attendance?.checkinAt,
    "Uma presença confirmada deve ser corrigida pela organização.",
    "ALREADY_PRESENT",
  );
  if (actor.type === "participant")
    ensure(
      now <=
        (current.activity.swapDeadline ??
          new Date(
            current.activity.startAt.getTime() +
              current.activity.edition.lateMinutes * minute,
          )),
      "Prazo de cancelamento encerrado.",
      "SWAP_DEADLINE",
    );
  const result = await tx.enrollment.update({
    where: { id: current.id },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason },
  });
  await audit(
    tx,
    actor,
    editionId,
    "enrollment.cancel",
    "Enrollment",
    result.id,
    current,
    result,
    reason,
  );
  await notify(
    tx,
    editionId,
    [current.participantId],
    "ENROLLMENT_CANCELLED",
    "Inscrição cancelada",
    current.activity.title,
  );
  await promoteWaitlist(tx, editionId, current.activityId, now);
  return result;
}
export async function swapEnrollment(
  tx: Tx,
  editionId: string,
  enrollmentId: string,
  activityId: string,
  actor: Actor,
  now = new Date(),
) {
  const current = await tx.enrollment.findFirst({
    where: { id: enrollmentId, editionId },
    include: { activity: { include: { edition: true } } },
  });
  ensure(
    current && current.status === "ACTIVE",
    "Inscrição não encontrada ou inativa.",
    "NOT_FOUND",
    404,
  );
  ensure(
    actor.type === "admin" || actor.id === current.participantId,
    "Acesso negado.",
    "FORBIDDEN",
    403,
  );
  if (actor.type === "admin") requirePermission(actor, "participants.write");
  ensure(
    now <=
      (current.activity.swapDeadline ??
        new Date(
          current.activity.startAt.getTime() +
            current.activity.edition.lateMinutes * minute,
        )),
    "Prazo de troca encerrado.",
    "SWAP_DEADLINE",
  );
  const present = await tx.attendance.findUnique({
    where: {
      participantId_activityId: {
        participantId: current.participantId,
        activityId: current.activityId,
      },
    },
  });
  ensure(
    !present?.checkinAt,
    "Não é possível trocar atividade já frequentada.",
    "ALREADY_PRESENT",
  );
  const next = await enroll(
    tx,
    editionId,
    current.participantId,
    activityId,
    actor,
    now,
    current.id,
    "SWAP",
  );
  await tx.enrollment.update({
    where: { id: current.id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: `Troca para ${activityId}`,
    },
  });
  await audit(
    tx,
    actor,
    editionId,
    "enrollment.swap",
    "Enrollment",
    current.id,
    current,
    next,
  );
  await promoteWaitlist(tx, editionId, current.activityId, now);
  return next;
}
export async function joinWaitlist(
  tx: Tx,
  editionId: string,
  participantId: string,
  activityId: string,
  actor: Actor,
  now = new Date(),
) {
  const activity = await validateEnrollment(
    tx,
    editionId,
    participantId,
    activityId,
    now,
    undefined,
    false,
  );
  ensure(
    activity.allowWaitlist,
    "Esta atividade não tem lista de espera.",
    "WAITLIST_DISABLED",
  );
  const count = await tx.enrollment.count({
    where: { activityId, status: { in: occupiedStatuses } },
  });
  ensure(
    count >= activity.capacity,
    "Há vagas disponíveis. Faça sua inscrição.",
    "HAS_CAPACITY",
  );
  const old = await tx.waitlistEntry.findUnique({
    where: { participantId_activityId: { participantId, activityId } },
  });
  ensure(
    old?.status !== "WAITING",
    "Você já está na lista de espera.",
    "ALREADY_WAITING",
    409,
  );
  const result = await tx.waitlistEntry.upsert({
    where: { participantId_activityId: { participantId, activityId } },
    create: { editionId, participantId, activityId, createdAt: now },
    update: { status: "WAITING", createdAt: now, promotedAt: null },
  });
  await audit(
    tx,
    actor,
    editionId,
    "waitlist.join",
    "WaitlistEntry",
    result.id,
    undefined,
    result,
  );
  return result;
}
export async function checkAttendance(
  tx: Tx,
  editionId: string,
  activityId: string,
  ra: string,
  operation: "CHECK_IN" | "CHECK_OUT",
  actor: Actor,
  now = new Date(),
) {
  requirePermission(actor, "attendance.register");
  const activity = await activityOf(tx, editionId, activityId);
  ensure(
    !["DRAFT", "CANCELLED"].includes(activity.status),
    "Atividade indisponível.",
    "ACTIVITY_CLOSED",
  );
  const participant = await tx.participant.findUnique({
    where: { editionId_ra: { editionId, ra: ra.trim() } },
  });
  ensure(participant?.active, "Participante não encontrado.", "NOT_FOUND", 404);
  let enrollment = await tx.enrollment.findUnique({
    where: {
      participantId_activityId: { participantId: participant.id, activityId },
    },
  });
  const old = await tx.attendance.findUnique({
    where: {
      participantId_activityId: { participantId: participant.id, activityId },
    },
  });
  if (operation === "CHECK_IN") {
    ensure(
      activity.category.requiresCheckin,
      "Esta categoria não exige check-in.",
      "CHECKIN_DISABLED",
    );
    if (!activity.category.requiresEnrollment && !enrollment)
      enrollment = await enroll(
        tx,
        editionId,
        participant.id,
        activityId,
        actor,
        now,
        undefined,
        "OPERATION",
      );
    ensure(
      enrollment && enrollment.status === "ACTIVE",
      "Participante não está inscrito nesta atividade.",
      "NOT_ENROLLED",
    );
    ensure(!old?.checkinAt, "Presença já confirmada.", "ALREADY_PRESENT", 409);
    ensure(
      now >= activity.startAt,
      "Check-in disponível a partir do início da atividade.",
      "TOO_EARLY",
    );
    const limit = enrollment.lateEnrollment
      ? activity.edition.lateMinutes
      : activity.edition.normalMinutes;
    ensure(
      now <= new Date(activity.startAt.getTime() + limit * minute) &&
        now <= activity.endAt,
      "Janela de check-in encerrada.",
      "CHECKIN_WINDOW",
    );
    const checked = await tx.attendance.count({
      where: {
        editionId,
        participantId: participant.id,
        checkinAt: { not: null },
      },
    });
    ensure(
      activity.edition.maxCheckins === 0 ||
        checked < activity.edition.maxCheckins,
      "Limite de check-ins da edição atingido.",
      "CHECKIN_LIMIT",
    );
  } else {
    ensure(
      activity.category.requiresCheckout,
      "Esta atividade não exige check-out.",
      "CHECKOUT_DISABLED",
    );
    ensure(
      old?.checkinAt,
      "Registre o check-in antes do check-out.",
      "MISSING_CHECKIN",
    );
    ensure(
      !old.checkoutAt,
      "Check-out já confirmado.",
      "ALREADY_CHECKED_OUT",
      409,
    );
    ensure(
      now >=
        new Date(
          activity.endAt.getTime() - activity.edition.checkoutMinutes * minute,
        ) && now <= activity.endAt,
      "Check-out fora da janela permitida.",
      "CHECKOUT_WINDOW",
    );
  }
  const data =
    operation === "CHECK_IN"
      ? {
          checkinAt: now,
          checkoutAt: null,
          status: activity.category.requiresCheckout ? "PRESENT" : "COMPLETED",
        }
      : { checkoutAt: now, status: "COMPLETED" };
  const attendance = await tx.attendance.upsert({
    where: {
      participantId_activityId: { participantId: participant.id, activityId },
    },
    create: { editionId, participantId: participant.id, activityId, ...data },
    update: data,
  });
  await tx.attendanceEvent.create({
    data: {
      attendanceId: attendance.id,
      operation,
      operatorId: actor.id,
      createdAt: now,
    },
  });
  if (operation === "CHECK_IN" && activity.category.generatesStamp) {
    const stamp = {
      editionId,
      participantId: participant.id,
      activityId,
      categoryId: activity.categoryId,
      attendanceId: attendance.id,
      issuedBy: actor.id,
      issuedAt: now,
      status: "VALID",
    };
    await tx.passportStamp.upsert({
      where: { attendanceId: attendance.id },
      create: stamp,
      update: stamp,
    });
  }
  if (attendance.status === "COMPLETED")
    await tx.enrollment.updateMany({
      where: { participantId: participant.id, activityId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });
  if (
    attendance.status === "COMPLETED" &&
    activity.category.generatesCertificate
  )
    await issueCertificate(
      tx,
      editionId,
      participant.id,
      activityId,
      actor,
      now,
    );
  await audit(
    tx,
    actor,
    editionId,
    operation === "CHECK_IN" ? "attendance.checkin" : "attendance.checkout",
    "Attendance",
    attendance.id,
    old,
    attendance,
  );
  await notify(
    tx,
    editionId,
    [participant.id],
    operation,
    operation === "CHECK_IN" ? "Presença confirmada!" : "Check-out confirmado",
    `${activity.title}${operation === "CHECK_IN" && activity.category.generatesStamp ? " · Seu passaporte recebeu um novo carimbo." : ""}`,
  );
  return attendance;
}
export async function correctAttendance(
  tx: Tx,
  editionId: string,
  attendanceId: string,
  operation: string,
  reason: string,
  actor: Actor,
  now = new Date(),
) {
  requirePermission(actor, "attendance.correct");
  ensure(
    reason.trim().length >= 5,
    "Informe um motivo com pelo menos 5 caracteres.",
  );
  ensure(
    ["CANCEL_CHECK_IN", "CANCEL_CHECK_OUT", "CHECK_IN", "CHECK_OUT"].includes(
      operation,
    ),
    "Operação inválida.",
  );
  const old = await tx.attendance.findFirst({
    where: { id: attendanceId, editionId },
    include: { activity: { include: { category: true, edition: true } } },
  });
  ensure(old, "Presença não encontrada.", "NOT_FOUND", 404);
  if (operation === "CHECK_OUT")
    ensure(
      old.checkinAt && old.activity.category.requiresCheckout,
      "Check-out requer check-in válido e categoria com saída.",
    );
  if (operation === "CHECK_IN" && !old.checkinAt) {
    const count = await tx.attendance.count({
      where: {
        editionId,
        participantId: old.participantId,
        checkinAt: { not: null },
      },
    });
    ensure(
      old.activity.edition.maxCheckins === 0 ||
        count < old.activity.edition.maxCheckins,
      "Limite de check-ins atingido.",
      "CHECKIN_LIMIT",
    );
  }
  const update: Record<string, unknown> =
    operation === "CANCEL_CHECK_IN"
      ? { checkinAt: null, checkoutAt: null, status: "CANCELLED" }
      : operation === "CANCEL_CHECK_OUT"
        ? { checkoutAt: null, status: old.checkinAt ? "PRESENT" : "CANCELLED" }
        : operation === "CHECK_IN"
          ? {
              checkinAt: now,
              status: old.activity.category.requiresCheckout
                ? "PRESENT"
                : "COMPLETED",
            }
          : { checkoutAt: now, status: "COMPLETED" };
  const result = await tx.attendance.update({
    where: { id: attendanceId },
    data: update,
  });
  await tx.attendanceEvent.create({
    data: {
      attendanceId,
      operation,
      operatorId: actor.id,
      reason,
      createdAt: now,
    },
  });
  if (operation === "CANCEL_CHECK_IN")
    await tx.passportStamp.updateMany({
      where: { attendanceId },
      data: { status: "REVOKED" },
    });
  if (operation === "CHECK_IN" && old.activity.category.generatesStamp) {
    const stamp = {
      editionId,
      participantId: old.participantId,
      activityId: old.activityId,
      categoryId: old.activity.categoryId,
      attendanceId,
      issuedAt: now,
      issuedBy: actor.id,
      status: "VALID",
    };
    await tx.passportStamp.upsert({
      where: { attendanceId },
      create: stamp,
      update: stamp,
    });
  }
  await tx.enrollment.updateMany({
    where: { participantId: old.participantId, activityId: old.activityId },
    data: { status: result.status === "COMPLETED" ? "COMPLETED" : "ACTIVE" },
  });
  if (operation.startsWith("CANCEL"))
    await tx.certificate.updateMany({
      where: {
        editionId,
        participantId: old.participantId,
        activityId: old.activityId,
        status: { not: "INVALIDATED" },
      },
      data: {
        status: "INVALIDATED",
        invalidatedAt: now,
        invalidationReason: `Correção de presença: ${reason}`,
      },
    });
  await audit(
    tx,
    actor,
    editionId,
    "attendance.correct",
    "Attendance",
    attendanceId,
    old,
    result,
    reason,
  );
  return result;
}
export async function issueCertificate(
  tx: Tx,
  editionId: string,
  participantId: string,
  activityId: string,
  actor: Actor | null,
  now = new Date(),
) {
  const activity = await activityOf(tx, editionId, activityId);
  ensure(
    activity.category.generatesCertificate,
    "Esta atividade não gera certificado.",
    "CERTIFICATE_DISABLED",
  );
  const attendance = await tx.attendance.findUnique({
    where: { participantId_activityId: { participantId, activityId } },
  });
  ensure(
    attendance?.checkinAt &&
      (!activity.category.requiresCheckout || attendance.checkoutAt),
    "Presença incompleta: confira check-in e check-out.",
    "NOT_ELIGIBLE",
  );
  const existing = await tx.certificate.findFirst({
    where: { participantId, activityId, status: { not: "INVALIDATED" } },
  });
  if (existing) return existing;
  const certificate = await tx.certificate.create({
    data: {
      editionId,
      participantId,
      activityId,
      code: randomBytes(12).toString("hex").toUpperCase(),
      workload: activity.workload,
      issuedAt: now,
    },
  });
  await tx.certificate.update({
    where: { id: certificate.id },
    data: { pdfUrl: `/api/certificates/${certificate.id}` },
  });
  await audit(
    tx,
    actor,
    editionId,
    "certificate.issue",
    "Certificate",
    certificate.id,
    undefined,
    certificate,
  );
  await notify(
    tx,
    editionId,
    [participantId],
    "CERTIFICATE",
    "Seu certificado está disponível",
    activity.title,
  );
  return certificate;
}
