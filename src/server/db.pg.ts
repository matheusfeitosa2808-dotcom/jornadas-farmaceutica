import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { env } from "cloudflare:workers";

type Queryer = (text: string, values?: unknown[]) => Promise<any>;
type Relation = {
  model: string;
  kind: "one" | "many";
  sourceKey: string;
  targetKey: string;
};

type ModelMeta = {
  table: string;
  fields: readonly string[];
  id?: string;
  updatedAt?: boolean;
  createdAt?: boolean;
  uniques?: Record<string, readonly string[]>;
  relations?: Record<string, Relation>;
};

const models: Record<string, ModelMeta> = {
  edition: {
    table: "Edition",
    id: "id",
    createdAt: true,
    updatedAt: true,
    fields: [
      "id",
      "name",
      "slug",
      "year",
      "slogan",
      "description",
      "startAt",
      "endAt",
      "timezone",
      "status",
      "maxActivities",
      "maxCheckins",
      "normalMinutes",
      "noShowMinutes",
      "lateMinutes",
      "checkoutMinutes",
      "reminderMinutes",
      "allowMultipleRewards",
      "logoUrl",
      "primaryColor",
      "secondaryColor",
      "backgroundColor",
      "certificateTemplateUrl",
      "createdAt",
      "updatedAt",
    ],
    relations: {
      participants: {
        model: "participant",
        kind: "many",
        sourceKey: "id",
        targetKey: "editionId",
      },
      categories: {
        model: "activityCategory",
        kind: "many",
        sourceKey: "id",
        targetKey: "editionId",
      },
      speakers: {
        model: "speaker",
        kind: "many",
        sourceKey: "id",
        targetKey: "editionId",
      },
      activities: {
        model: "activity",
        kind: "many",
        sourceKey: "id",
        targetKey: "editionId",
      },
      rewards: {
        model: "rewardItem",
        kind: "many",
        sourceKey: "id",
        targetKey: "editionId",
      },
      sponsors: {
        model: "sponsor",
        kind: "many",
        sourceKey: "id",
        targetKey: "editionId",
      },
      arenaConfig: {
        model: "arenaConfig",
        kind: "one",
        sourceKey: "id",
        targetKey: "editionId",
      },
      arenaChallenges: {
        model: "arenaChallenge",
        kind: "many",
        sourceKey: "id",
        targetKey: "editionId",
      },
    },
  },
  participant: {
    table: "Participant",
    id: "id",
    createdAt: true,
    updatedAt: true,
    fields: [
      "id",
      "editionId",
      "name",
      "firstName",
      "normalizedName",
      "ra",
      "semester",
      "photoUrl",
      "active",
      "createdAt",
      "updatedAt",
    ],
    uniques: { editionId_ra: ["editionId", "ra"] },
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
      enrollments: {
        model: "enrollment",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      waitlist: {
        model: "waitlistEntry",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      attendances: {
        model: "attendance",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      stamps: {
        model: "passportStamp",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      reservations: {
        model: "rewardReservation",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      deliveries: {
        model: "rewardDelivery",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      certificates: {
        model: "certificate",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      arenaCompletions: {
        model: "arenaCompletion",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      arenaAwards: {
        model: "arenaXpAward",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
      xpTransactions: {
        model: "xpTransaction",
        kind: "many",
        sourceKey: "id",
        targetKey: "participantId",
      },
    },
  },
  role: { table: "Role", id: "id", fields: ["id", "name"] },
  permission: { table: "Permission", id: "id", fields: ["id", "description"] },
  rolePermission: {
    table: "RolePermission",
    fields: ["roleId", "permissionId"],
    uniques: { roleId_permissionId: ["roleId", "permissionId"] },
  },
  adminUser: {
    table: "AdminUser",
    id: "id",
    createdAt: true,
    updatedAt: true,
    fields: [
      "id",
      "name",
      "email",
      "passwordHash",
      "role",
      "permissions",
      "active",
      "createdAt",
      "updatedAt",
    ],
  },
  session: {
    table: "Session",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "kind",
      "adminId",
      "participantId",
      "expiresAt",
      "createdAt",
    ],
    relations: {
      admin: {
        model: "adminUser",
        kind: "one",
        sourceKey: "adminId",
        targetKey: "id",
      },
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
    },
  },
  activityCategory: {
    table: "ActivityCategory",
    id: "id",
    fields: [
      "id",
      "editionId",
      "name",
      "slug",
      "color",
      "icon",
      "order",
      "requiresEnrollment",
      "requiresCheckin",
      "requiresCheckout",
      "generatesStamp",
      "generatesCertificate",
      "active",
      "stampUrl",
    ],
    uniques: { editionId_slug: ["editionId", "slug"] },
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
      activities: {
        model: "activity",
        kind: "many",
        sourceKey: "id",
        targetKey: "categoryId",
      },
    },
  },
  speaker: {
    table: "Speaker",
    id: "id",
    fields: [
      "id",
      "editionId",
      "name",
      "bio",
      "photoUrl",
      "curriculumUrl",
      "institution",
    ],
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
    },
  },
  activity: {
    table: "Activity",
    id: "id",
    createdAt: true,
    updatedAt: true,
    fields: [
      "id",
      "editionId",
      "categoryId",
      "title",
      "description",
      "startAt",
      "endAt",
      "block",
      "room",
      "capacity",
      "enrollmentOpen",
      "enrollmentDeadline",
      "swapDeadline",
      "workload",
      "status",
      "allowWaitlist",
      "stampUrl",
      "createdAt",
      "updatedAt",
    ],
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
      category: {
        model: "activityCategory",
        kind: "one",
        sourceKey: "categoryId",
        targetKey: "id",
      },
      speakers: {
        model: "activitySpeaker",
        kind: "many",
        sourceKey: "id",
        targetKey: "activityId",
      },
      enrollments: {
        model: "enrollment",
        kind: "many",
        sourceKey: "id",
        targetKey: "activityId",
      },
      waitlist: {
        model: "waitlistEntry",
        kind: "many",
        sourceKey: "id",
        targetKey: "activityId",
      },
      attendances: {
        model: "attendance",
        kind: "many",
        sourceKey: "id",
        targetKey: "activityId",
      },
    },
  },
  activitySpeaker: {
    table: "ActivitySpeaker",
    fields: ["activityId", "speakerId"],
    uniques: { activityId_speakerId: ["activityId", "speakerId"] },
    relations: {
      activity: {
        model: "activity",
        kind: "one",
        sourceKey: "activityId",
        targetKey: "id",
      },
      speaker: {
        model: "speaker",
        kind: "one",
        sourceKey: "speakerId",
        targetKey: "id",
      },
    },
  },
  enrollment: {
    table: "Enrollment",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "participantId",
      "activityId",
      "status",
      "lateEnrollment",
      "source",
      "cancelledAt",
      "cancelReason",
      "createdAt",
    ],
    uniques: { participantId_activityId: ["participantId", "activityId"] },
    relations: {
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
      activity: {
        model: "activity",
        kind: "one",
        sourceKey: "activityId",
        targetKey: "id",
      },
    },
  },
  waitlistEntry: {
    table: "WaitlistEntry",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "participantId",
      "activityId",
      "status",
      "createdAt",
      "promotedAt",
    ],
    uniques: { participantId_activityId: ["participantId", "activityId"] },
    relations: {
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
      activity: {
        model: "activity",
        kind: "one",
        sourceKey: "activityId",
        targetKey: "id",
      },
    },
  },
  attendance: {
    table: "Attendance",
    id: "id",
    fields: [
      "id",
      "editionId",
      "participantId",
      "activityId",
      "checkinAt",
      "checkoutAt",
      "status",
    ],
    uniques: { participantId_activityId: ["participantId", "activityId"] },
    relations: {
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
      activity: {
        model: "activity",
        kind: "one",
        sourceKey: "activityId",
        targetKey: "id",
      },
    },
  },
  attendanceEvent: {
    table: "AttendanceEvent",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "attendanceId",
      "operation",
      "operatorId",
      "reason",
      "createdAt",
    ],
  },
  passportStamp: {
    table: "PassportStamp",
    id: "id",
    fields: [
      "id",
      "editionId",
      "participantId",
      "activityId",
      "categoryId",
      "attendanceId",
      "issuedAt",
      "issuedBy",
      "status",
    ],
    uniques: { participantId_activityId: ["participantId", "activityId"] },
  },
  rewardItem: {
    table: "RewardItem",
    id: "id",
    fields: [
      "id",
      "editionId",
      "name",
      "description",
      "imageUrl",
      "total",
      "active",
      "order",
      "confirmationMinutes",
      "redemptionStartsAt",
      "exclusiveGroup",
      "redemptionMode",
      "xpCost",
      "maxPerParticipant",
    ],
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
    },
  },
  rewardRule: {
    table: "RewardRule",
    id: "id",
    fields: [
      "id",
      "editionId",
      "rewardId",
      "minCheckins",
      "categoryId",
      "activityId",
      "completeJourney",
    ],
  },
  rewardEligibility: {
    table: "RewardEligibility",
    id: "id",
    updatedAt: true,
    fields: [
      "id",
      "editionId",
      "rewardId",
      "participantId",
      "eligible",
      "reason",
      "updatedAt",
    ],
    uniques: { rewardId_participantId: ["rewardId", "participantId"] },
  },
  rewardDraw: {
    table: "RewardDraw",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "rewardId",
      "round",
      "stockSnapshot",
      "eligibleCount",
      "operatorId",
      "mode",
      "status",
      "randomSeed",
      "snapshot",
      "createdAt",
      "cancelledAt",
      "cancelReason",
    ],
    uniques: { rewardId_round: ["rewardId", "round"] },
    relations: {
      entries: {
        model: "rewardDrawEntry",
        kind: "many",
        sourceKey: "id",
        targetKey: "drawId",
      },
      reservations: {
        model: "rewardReservation",
        kind: "many",
        sourceKey: "id",
        targetKey: "drawId",
      },
    },
  },
  rewardDrawEntry: {
    table: "RewardDrawEntry",
    id: "id",
    fields: ["id", "drawId", "participantId", "winner", "rank"],
    uniques: { drawId_participantId: ["drawId", "participantId"] },
  },
  rewardReservation: {
    table: "RewardReservation",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "rewardId",
      "participantId",
      "drawId",
      "quantity",
      "status",
      "expiresAt",
      "confirmedAt",
      "createdAt",
    ],
    relations: {
      deliveries: {
        model: "rewardDelivery",
        kind: "many",
        sourceKey: "id",
        targetKey: "reservationId",
      },
    },
  },
  rewardDelivery: {
    table: "RewardDelivery",
    id: "id",
    fields: [
      "id",
      "editionId",
      "participantId",
      "rewardId",
      "reservationId",
      "quantity",
      "operatorId",
      "status",
      "deliveredAt",
      "reversedAt",
      "reverseReason",
    ],
  },
  certificate: {
    table: "Certificate",
    id: "id",
    fields: [
      "id",
      "editionId",
      "participantId",
      "activityId",
      "code",
      "workload",
      "status",
      "pdfUrl",
      "issuedAt",
      "invalidatedAt",
      "invalidationReason",
    ],
    relations: {
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
      activity: {
        model: "activity",
        kind: "one",
        sourceKey: "activityId",
        targetKey: "id",
      },
    },
  },
  notification: {
    table: "Notification",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "type",
      "title",
      "message",
      "audience",
      "dedupeKey",
      "createdAt",
    ],
    relations: {
      recipients: {
        model: "notificationRecipient",
        kind: "many",
        sourceKey: "id",
        targetKey: "notificationId",
      },
    },
  },
  notificationRecipient: {
    table: "NotificationRecipient",
    id: "id",
    fields: ["id", "notificationId", "participantId", "readAt", "pushedAt"],
    uniques: {
      notificationId_participantId: ["notificationId", "participantId"],
    },
    relations: {
      notification: {
        model: "notification",
        kind: "one",
        sourceKey: "notificationId",
        targetKey: "id",
      },
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
    },
  },
  pushSubscription: {
    table: "PushSubscription",
    id: "id",
    createdAt: true,
    fields: ["id", "participantId", "endpoint", "p256dh", "auth", "createdAt"],
  },
  auditLog: {
    table: "AuditLog",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "actorType",
      "actorId",
      "action",
      "entityType",
      "entityId",
      "oldValue",
      "newValue",
      "reason",
      "ip",
      "createdAt",
    ],
  },
  importJob: {
    table: "ImportJob",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "operatorId",
      "filename",
      "status",
      "valid",
      "invalid",
      "duplicates",
      "createdAt",
      "confirmedAt",
    ],
    relations: {
      rows: {
        model: "importRow",
        kind: "many",
        sourceKey: "id",
        targetKey: "jobId",
      },
    },
  },
  importRow: {
    table: "ImportRow",
    id: "id",
    fields: ["id", "jobId", "row", "name", "ra", "semester", "status", "error"],
  },
  sponsor: {
    table: "Sponsor",
    id: "id",
    fields: ["id", "editionId", "name", "logoUrl", "url", "order", "active"],
  },
  arenaConfig: {
    table: "ArenaConfig",
    id: "id",
    createdAt: true,
    updatedAt: true,
    fields: [
      "id",
      "editionId",
      "enabled",
      "logoUrl",
      "accentColor",
      "rankingEnabled",
      "rankingVisibility",
      "firstPlaceTitle",
      "secondPlaceTitle",
      "thirdPlaceTitle",
      "transitionEffect",
      "xpReleaseMode",
      "xpReleaseDelaySeconds",
      "combinePendingAwards",
      "createdAt",
      "updatedAt",
    ],
    uniques: { editionId: ["editionId"] },
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
    },
  },
  arenaChallenge: {
    table: "ArenaChallenge",
    id: "id",
    createdAt: true,
    updatedAt: true,
    fields: [
      "id",
      "editionId",
      "title",
      "slug",
      "description",
      "instructions",
      "iconUrl",
      "xpReward",
      "mode",
      "validationMode",
      "minTeamSize",
      "maxTeamSize",
      "repeatable",
      "maxCompletionsPerParticipant",
      "startsAt",
      "endsAt",
      "category",
      "active",
      "order",
      "createdAt",
      "updatedAt",
    ],
    uniques: { editionId_slug: ["editionId", "slug"] },
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
      completions: {
        model: "arenaCompletion",
        kind: "many",
        sourceKey: "id",
        targetKey: "challengeId",
      },
      awards: {
        model: "arenaXpAward",
        kind: "many",
        sourceKey: "id",
        targetKey: "challengeId",
      },
    },
  },
  arenaCompletion: {
    table: "ArenaCompletion",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "challengeId",
      "participantId",
      "teamSessionId",
      "completedAt",
      "validatedBy",
      "status",
      "xpAwarded",
      "reason",
      "createdAt",
    ],
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
      challenge: {
        model: "arenaChallenge",
        kind: "one",
        sourceKey: "challengeId",
        targetKey: "id",
      },
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
      award: {
        model: "arenaXpAward",
        kind: "one",
        sourceKey: "id",
        targetKey: "completionId",
      },
    },
  },
  arenaXpAward: {
    table: "ArenaXpAward",
    id: "id",
    createdAt: true,
    updatedAt: true,
    fields: [
      "id",
      "editionId",
      "participantId",
      "challengeId",
      "completionId",
      "amount",
      "status",
      "releaseMode",
      "releaseAt",
      "releasedAt",
      "releasedBy",
      "xpTransactionId",
      "animationStatus",
      "animationDeliveredAt",
      "animationSeenAt",
      "animationVariant",
      "createdAt",
      "updatedAt",
    ],
    uniques: {
      completionId: ["completionId"],
      xpTransactionId: ["xpTransactionId"],
    },
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
      challenge: {
        model: "arenaChallenge",
        kind: "one",
        sourceKey: "challengeId",
        targetKey: "id",
      },
      completion: {
        model: "arenaCompletion",
        kind: "one",
        sourceKey: "completionId",
        targetKey: "id",
      },
      transaction: {
        model: "xpTransaction",
        kind: "one",
        sourceKey: "xpTransactionId",
        targetKey: "id",
      },
    },
  },
  xpTransaction: {
    table: "XpTransaction",
    id: "id",
    createdAt: true,
    fields: [
      "id",
      "editionId",
      "participantId",
      "type",
      "balanceDelta",
      "rankingDelta",
      "sourceType",
      "sourceId",
      "description",
      "idempotencyKey",
      "createdBy",
      "createdAt",
    ],
    uniques: { idempotencyKey: ["idempotencyKey"] },
    relations: {
      edition: {
        model: "edition",
        kind: "one",
        sourceKey: "editionId",
        targetKey: "id",
      },
      participant: {
        model: "participant",
        kind: "one",
        sourceKey: "participantId",
        targetKey: "id",
      },
      award: {
        model: "arenaXpAward",
        kind: "one",
        sourceKey: "id",
        targetKey: "xpTransactionId",
      },
    },
  },
};

const qid = (value: string) => `"${value.replace(/"/g, '""')}"`;
const qcol = (alias: string, field: string) => `${qid(alias)}.${qid(field)}`;

function meta(model: string): ModelMeta {
  const value = models[model];
  if (!value) throw new Error(`Modelo SQL desconhecido: ${model}`);
  return value;
}

function fieldMeta(model: string, field: string) {
  const m = meta(model);
  if (!m.fields.includes(field))
    throw new Error(`Campo SQL desconhecido: ${model}.${field}`);
}

function relationMeta(model: string, name: string) {
  return meta(model).relations?.[name];
}

function scalarCondition(
  model: string,
  alias: string,
  field: string,
  value: any,
  params: unknown[],
): string {
  fieldMeta(model, field);
  const col = qcol(alias, field);
  if (value === undefined) return "TRUE";
  if (value === null) return `${col} IS NULL`;
  if (value instanceof Date) {
    params.push(value);
    return `${col} = $${params.length}`;
  }
  if (Array.isArray(value)) {
    if (!value.length) return "FALSE";
    params.push(value);
    return `${col} = ANY($${params.length})`;
  }
  if (typeof value !== "object") {
    params.push(value);
    return `${col} = $${params.length}`;
  }

  const clauses: string[] = [];
  for (const [op, operand] of Object.entries(value)) {
    if (op === "mode") continue;
    if (op === "equals")
      clauses.push(scalarCondition(model, alias, field, operand, params));
    else if (op === "in") {
      const values = Array.isArray(operand) ? operand : [];
      if (!values.length) clauses.push("FALSE");
      else {
        params.push(values);
        clauses.push(`${col} = ANY($${params.length})`);
      }
    } else if (op === "notIn") {
      const values = Array.isArray(operand) ? operand : [];
      if (!values.length) clauses.push("TRUE");
      else {
        params.push(values);
        clauses.push(`NOT (${col} = ANY($${params.length}))`);
      }
    } else if (op === "not") {
      if (operand === null) clauses.push(`${col} IS NOT NULL`);
      else if (typeof operand === "object" && operand !== null)
        clauses.push(
          `NOT (${scalarCondition(model, alias, field, operand, params)})`,
        );
      else {
        params.push(operand);
        clauses.push(`${col} <> $${params.length}`);
      }
    } else if (["lt", "lte", "gt", "gte"].includes(op)) {
      const operators: Record<string, string> = {
        lt: "<",
        lte: "<=",
        gt: ">",
        gte: ">=",
      };
      params.push(operand);
      clauses.push(`${col} ${operators[op]} $${params.length}`);
    } else if (op === "contains") {
      params.push(`%${String(operand)}%`);
      clauses.push(`${col} ILIKE $${params.length}`);
    } else if (op === "startsWith") {
      params.push(`${String(operand)}%`);
      clauses.push(`${col} ILIKE $${params.length}`);
    } else if (op === "endsWith") {
      params.push(`%${String(operand)}`);
      clauses.push(`${col} ILIKE $${params.length}`);
    } else throw new Error(`Operador SQL desconhecido: ${op}`);
  }
  return clauses.length ? clauses.join(" AND ") : "TRUE";
}

function buildWhere(
  model: string,
  where: any,
  params: unknown[],
  alias = "t",
): string {
  if (!where || !Object.keys(where).length) return "TRUE";
  const clauses: string[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === "AND" || key === "OR" || key === "NOT") {
      const items = Array.isArray(value) ? value : [value];
      const nested = items.map(
        (entry) => `(${buildWhere(model, entry, params, alias)})`,
      );
      if (key === "AND")
        clauses.push(nested.length ? nested.join(" AND ") : "TRUE");
      if (key === "OR")
        clauses.push(nested.length ? nested.join(" OR ") : "FALSE");
      if (key === "NOT")
        clauses.push(nested.length ? `NOT (${nested.join(" AND ")})` : "TRUE");
      continue;
    }
    const compound = meta(model).uniques?.[key];
    if (
      compound &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      clauses.push(
        `(${compound.map((field) => scalarCondition(model, alias, field, (value as any)[field], params)).join(" AND ")})`,
      );
      continue;
    }
    const relation = relationMeta(model, key);
    if (relation) {
      if (value === null) {
        if (relation.kind === "one") {
          clauses.push(`${qcol(alias, relation.sourceKey)} IS NULL`);
          continue;
        }
        throw new Error(`Filtro nulo invalido na relacao ${model}.${key}`);
      }
      if (!value || typeof value !== "object")
        throw new Error(`Filtro invalido na relacao ${model}.${key}`);
      const targetAlias = `r${params.length}_${clauses.length}`;
      const targetTable = qid(meta(relation.model).table);
      const join = `${qcol(targetAlias, relation.targetKey)} = ${qcol(alias, relation.sourceKey)}`;
      if (relation.kind === "many") {
        const relValue = value as any;
        if ("some" in relValue) {
          const child = buildWhere(
            relation.model,
            relValue.some,
            params,
            targetAlias,
          );
          clauses.push(
            `EXISTS (SELECT 1 FROM ${targetTable} AS ${qid(targetAlias)} WHERE ${join} AND (${child}))`,
          );
        } else if ("none" in relValue) {
          const child = buildWhere(
            relation.model,
            relValue.none,
            params,
            targetAlias,
          );
          clauses.push(
            `NOT EXISTS (SELECT 1 FROM ${targetTable} AS ${qid(targetAlias)} WHERE ${join} AND (${child}))`,
          );
        } else if ("every" in relValue) {
          const child = buildWhere(
            relation.model,
            relValue.every,
            params,
            targetAlias,
          );
          clauses.push(
            `NOT EXISTS (SELECT 1 FROM ${targetTable} AS ${qid(targetAlias)} WHERE ${join} AND NOT (${child}))`,
          );
        } else {
          const child = buildWhere(
            relation.model,
            relValue,
            params,
            targetAlias,
          );
          clauses.push(
            `EXISTS (SELECT 1 FROM ${targetTable} AS ${qid(targetAlias)} WHERE ${join} AND (${child}))`,
          );
        }
      } else {
        const child = buildWhere(relation.model, value, params, targetAlias);
        clauses.push(
          `EXISTS (SELECT 1 FROM ${targetTable} AS ${qid(targetAlias)} WHERE ${join} AND (${child}))`,
        );
      }
      continue;
    }
    clauses.push(scalarCondition(model, alias, key, value, params));
  }
  return clauses.length ? clauses.join(" AND ") : "TRUE";
}

function buildOrder(model: string, orderBy: any, alias = "t"): string {
  if (!orderBy) return "";
  const items = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    for (const [key, directionOrNested] of Object.entries(item)) {
      const relation = relationMeta(model, key);
      if (
        relation &&
        relation.kind === "one" &&
        directionOrNested &&
        typeof directionOrNested === "object"
      ) {
        for (const [childField, direction] of Object.entries(
          directionOrNested as any,
        )) {
          fieldMeta(relation.model, childField);
          const targetTable = qid(meta(relation.model).table);
          const subAlias = `ord_${key}`;
          parts.push(
            `(SELECT ${qcol(subAlias, childField)} FROM ${targetTable} AS ${qid(subAlias)} WHERE ${qcol(subAlias, relation.targetKey)} = ${qcol(alias, relation.sourceKey)} LIMIT 1) ${String(direction).toUpperCase() === "DESC" ? "DESC" : "ASC"}`,
          );
        }
      } else {
        fieldMeta(model, key);
        parts.push(
          `${qcol(alias, key)} ${String(directionOrNested).toUpperCase() === "DESC" ? "DESC" : "ASC"}`,
        );
      }
    }
  }
  return parts.length ? ` ORDER BY ${parts.join(", ")}` : "";
}

async function hydrateRows(
  model: string,
  rows: any[],
  spec: any,
  query: Queryer,
): Promise<any[]> {
  if (!rows.length || !spec) return rows;
  for (const row of rows) {
    for (const [key, option] of Object.entries(spec)) {
      if (key === "_count") {
        const countSelect = (option as any)?.select || {};
        const countResult: Record<string, number> = {};
        for (const [relName, relArgs] of Object.entries(countSelect)) {
          const relation = relationMeta(model, relName);
          if (!relation || relation.kind !== "many") continue;
          const where = {
            [relation.targetKey]: row[relation.sourceKey],
            ...(((relArgs as any)?.where || {}) as object),
          };
          countResult[relName] = await countInternal(
            relation.model,
            { where },
            query,
          );
        }
        row._count = countResult;
        continue;
      }
      const relation = relationMeta(model, key);
      if (!relation || option === false) continue;
      const args = option === true ? {} : (option as any);
      const relationWhere = {
        [relation.targetKey]: row[relation.sourceKey],
        ...(args.where || {}),
      };
      if (relation.kind === "many")
        row[key] = await findManyInternal(
          relation.model,
          { ...args, where: relationWhere },
          query,
        );
      else if (
        row[relation.sourceKey] === null ||
        row[relation.sourceKey] === undefined
      )
        row[key] = null;
      else
        row[key] = await findFirstInternal(
          relation.model,
          { ...args, where: relationWhere },
          query,
        );
    }
  }
  return rows;
}

function selectRow(model: string, row: any, select: any): any {
  if (!select) return row;
  const result: Record<string, any> = {};
  for (const [key, option] of Object.entries(select)) {
    if (!option) continue;
    if (key === "_count") {
      result[key] = row[key];
      continue;
    }
    const relation = relationMeta(model, key);
    if (relation) {
      if (option === true) result[key] = row[key];
      else if (relation.kind === "many")
        result[key] = (row[key] || []).map((child: any) =>
          selectRow(relation.model, child, (option as any).select),
        );
      else
        result[key] = row[key]
          ? selectRow(relation.model, row[key], (option as any).select)
          : null;
      continue;
    }
    fieldMeta(model, key);
    result[key] = row[key];
  }
  return result;
}

async function findManyInternal(
  model: string,
  args: any = {},
  query: Queryer,
): Promise<any[]> {
  const m = meta(model),
    params: unknown[] = [];
  const where = buildWhere(model, args.where, params, "t");
  let sql =
    `SELECT ${qid("t")}.* FROM ${qid(m.table)} AS ${qid("t")} WHERE ${where}` +
    buildOrder(model, args.orderBy, "t");
  if (Number.isInteger(args.take) && args.take >= 0) {
    params.push(args.take);
    sql += ` LIMIT $${params.length}`;
  }
  if (Number.isInteger(args.skip) && args.skip > 0) {
    params.push(args.skip);
    sql += ` OFFSET $${params.length}`;
  }
  const response = await query(sql, params);
  let rows = response.rows as any[];
  const projectionSpec: Record<string, any> = { ...(args.include || {}) };
  if (args.select)
    for (const [key, option] of Object.entries(args.select))
      if (key === "_count" || relationMeta(model, key))
        projectionSpec[key] = option;
  rows = await hydrateRows(
    model,
    rows,
    Object.keys(projectionSpec).length ? projectionSpec : undefined,
    query,
  );
  if (args.select) rows = rows.map((row) => selectRow(model, row, args.select));
  return rows;
}

async function findFirstInternal(
  model: string,
  args: any = {},
  query: Queryer,
): Promise<any | null> {
  return (
    (await findManyInternal(model, { ...args, take: 1 }, query))[0] ?? null
  );
}

async function countInternal(
  model: string,
  args: any = {},
  query: Queryer,
): Promise<number> {
  const m = meta(model),
    params: unknown[] = [];
  const where = buildWhere(model, args.where, params, "t");
  const response = await query(
    `SELECT COUNT(*)::int AS "count" FROM ${qid(m.table)} AS ${qid("t")} WHERE ${where}`,
    params,
  );
  return Number(response.rows[0]?.count || 0);
}

function scalarData(
  model: string,
  data: any,
  creating: boolean,
): Record<string, any> {
  const m = meta(model),
    result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (
      value === undefined ||
      relationMeta(model, key) ||
      !m.fields.includes(key)
    )
      continue;
    result[key] = value;
  }
  const now = new Date();
  if (creating && m.id && !result[m.id] && model !== "session")
    result[m.id] = randomUUID();
  if (
    creating &&
    m.createdAt &&
    result.createdAt === undefined &&
    m.fields.includes("createdAt")
  )
    result.createdAt = now;
  if (m.updatedAt && m.fields.includes("updatedAt")) result.updatedAt = now;
  return result;
}

async function applyNestedWrites(
  model: string,
  parent: any,
  data: any,
  query: Queryer,
): Promise<void> {
  for (const [key, value] of Object.entries(data || {})) {
    const relation = relationMeta(model, key);
    if (
      !relation ||
      relation.kind !== "many" ||
      !value ||
      typeof value !== "object"
    )
      continue;
    const nested = value as any;
    if (nested.deleteMany !== undefined) {
      const where =
        nested.deleteMany && Object.keys(nested.deleteMany).length
          ? nested.deleteMany
          : {};
      await deleteManyInternal(
        relation.model,
        {
          where: { [relation.targetKey]: parent[relation.sourceKey], ...where },
        },
        query,
      );
    }
    if (nested.create !== undefined) {
      for (const child of Array.isArray(nested.create)
        ? nested.create
        : [nested.create]) {
        await createInternal(
          relation.model,
          {
            data: {
              ...child,
              [relation.targetKey]: parent[relation.sourceKey],
            },
          },
          query,
        );
      }
    }
  }
}

async function createInternal(
  model: string,
  args: any,
  query: Queryer,
): Promise<any> {
  const m = meta(model),
    data = scalarData(model, args?.data || {}, true),
    keys = Object.keys(data);
  let response: any;
  if (keys.length) {
    const values = keys.map((key) => data[key]);
    response = await query(
      `INSERT INTO ${qid(m.table)} (${keys.map(qid).join(", ")}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *`,
      values,
    );
  } else
    response = await query(
      `INSERT INTO ${qid(m.table)} DEFAULT VALUES RETURNING *`,
    );
  let row = response.rows[0];
  await applyNestedWrites(model, row, args?.data || {}, query);
  if (args?.include || args?.select) {
    const firstUnique = Object.values(m.uniques || {})[0];
    const lookup =
      m.id && row[m.id] !== undefined
        ? { [m.id]: row[m.id] }
        : Object.fromEntries(
            firstUnique?.map((field) => [field, row[field]]) || [],
          );
    row = await findFirstInternal(
      model,
      { where: lookup, include: args.include, select: args.select },
      query,
    );
  }
  return row;
}

async function updateInternal(
  model: string,
  args: any,
  query: Queryer,
): Promise<any> {
  const m = meta(model),
    data = scalarData(model, args?.data || {}, false),
    keys = Object.keys(data);
  const params: unknown[] = keys.map((key) => data[key]);
  const where = buildWhere(model, args?.where || {}, params, "t");
  let row: any;
  if (keys.length) {
    const set = keys
      .map((key, index) => `${qid(key)} = $${index + 1}`)
      .join(", ");
    row = (
      await query(
        `UPDATE ${qid(m.table)} AS ${qid("t")} SET ${set} WHERE ${where} RETURNING *`,
        params,
      )
    ).rows[0];
  } else
    row = await findFirstInternal(model, { where: args?.where || {} }, query);
  if (!row) {
    const error: any = new Error(`${m.table} não encontrado.`);
    error.code = "P2025";
    throw error;
  }
  await applyNestedWrites(model, row, args?.data || {}, query);
  if (args?.include || args?.select)
    row = await findFirstInternal(
      model,
      {
        where: m.id ? { [m.id]: row[m.id] } : args.where,
        include: args.include,
        select: args.select,
      },
      query,
    );
  return row;
}

async function updateManyInternal(
  model: string,
  args: any,
  query: Queryer,
): Promise<{ count: number }> {
  const m = meta(model),
    data = scalarData(model, args?.data || {}, false),
    keys = Object.keys(data);
  if (!keys.length) return { count: 0 };
  const params: unknown[] = keys.map((key) => data[key]);
  const where = buildWhere(model, args?.where || {}, params, "t");
  const set = keys
    .map((key, index) => `${qid(key)} = $${index + 1}`)
    .join(", ");
  const response = await query(
    `UPDATE ${qid(m.table)} AS ${qid("t")} SET ${set} WHERE ${where} RETURNING 1`,
    params,
  );
  return { count: response.rowCount || 0 };
}

async function deleteManyInternal(
  model: string,
  args: any,
  query: Queryer,
): Promise<{ count: number }> {
  const m = meta(model),
    params: unknown[] = [];
  const where = buildWhere(model, args?.where || {}, params, "t");
  const response = await query(
    `DELETE FROM ${qid(m.table)} AS ${qid("t")} WHERE ${where}`,
    params,
  );
  return { count: response.rowCount || 0 };
}

async function deleteInternal(
  model: string,
  args: any,
  query: Queryer,
): Promise<any> {
  const m = meta(model),
    params: unknown[] = [];
  const where = buildWhere(model, args?.where || {}, params, "t");
  const row = (
    await query(
      `DELETE FROM ${qid(m.table)} AS ${qid("t")} WHERE ${where} RETURNING *`,
      params,
    )
  ).rows[0];
  if (!row) {
    const error: any = new Error(`${m.table} não encontrado.`);
    error.code = "P2025";
    throw error;
  }
  return row;
}

async function aggregateInternal(
  model: string,
  args: any,
  query: Queryer,
): Promise<any> {
  const m = meta(model),
    params: unknown[] = [],
    where = buildWhere(model, args?.where || {}, params, "t");
  const fields = Object.entries(args?._sum || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([field]) => {
      fieldMeta(model, field);
      return `COALESCE(SUM(${qcol("t", field)}), 0) AS ${qid(field)}`;
    });
  if (!fields.length) return { _sum: {} };
  return {
    _sum:
      (
        await query(
          `SELECT ${fields.join(", ")} FROM ${qid(m.table)} AS ${qid("t")} WHERE ${where}`,
          params,
        )
      ).rows[0] || {},
  };
}

function isUniqueViolation(error: any) {
  return (
    error?.code === "23505" ||
    error?.pgCode === "23505" ||
    error?.code === "P2002"
  );
}

async function upsertInternal(
  model: string,
  args: any,
  query: Queryer,
): Promise<any> {
  if (await findFirstInternal(model, { where: args.where }, query))
    return updateInternal(
      model,
      { where: args.where, data: args.update },
      query,
    );
  try {
    return await createInternal(model, { data: args.create }, query);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return updateInternal(
      model,
      { where: args.where, data: args.update },
      query,
    );
  }
}

function normalizePgError(error: any) {
  if (!error || typeof error !== "object") return error;
  if (!error.pgCode && typeof error.code === "string")
    error.pgCode = error.code;
  if (error.code === "23505") error.code = "P2002";
  return error;
}

function createDb(query: Queryer): any {
  const result: Record<string, any> = {};
  for (const model of Object.keys(models)) {
    result[model] = {
      findMany: (args: any = {}) => findManyInternal(model, args, query),
      findFirst: (args: any = {}) => findFirstInternal(model, args, query),
      findUnique: (args: any = {}) => findFirstInternal(model, args, query),
      findUniqueOrThrow: async (args: any = {}) => {
        const row = await findFirstInternal(model, args, query);
        if (!row) {
          const error: any = new Error(`${meta(model).table} não encontrado.`);
          error.code = "P2025";
          throw error;
        }
        return row;
      },
      count: (args: any = {}) => countInternal(model, args, query),
      aggregate: (args: any = {}) => aggregateInternal(model, args, query),
      create: (args: any) => createInternal(model, args, query),
      update: (args: any) => updateInternal(model, args, query),
      updateMany: (args: any) => updateManyInternal(model, args, query),
      delete: (args: any) => deleteInternal(model, args, query),
      deleteMany: (args: any = {}) => deleteManyInternal(model, args, query),
      upsert: (args: any) => upsertInternal(model, args, query),
    };
  }
  return result;
}

class Semaphore {
  private available: number;
  private waiting: Array<() => void> = [];
  constructor(limit: number) {
    this.available = limit;
  }
  async acquire() {
    if (this.available > 0) {
      this.available--;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }
  release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.available++;
  }
}

const sockets = new Semaphore(4);
function connectionString(): string {
  const hyperdrive = (env as any)?.HYPERDRIVE?.connectionString;

  if (hyperdrive) {
    return hyperdrive;
  }

  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error("DATABASE_URL não configurada no Worker.");
  }

  return value;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  await sockets.acquire();
  const client = new Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: 10_000,
    application_name: "jornadas-worker",
  });
  try {
    await client.connect();
    return await fn(client);
  } catch (error) {
    throw normalizePgError(error);
  } finally {
    try {
      await client.end();
    } catch {
      /* already closed */
    }
    sockets.release();
  }
}

function publicModel(model: string): any {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string") return undefined;
        return (...args: any[]) =>
          withClient(async (client) => {
            const scoped = createDb((text, values) =>
              client.query(text, values as any[]),
            );
            const method = scoped[model]?.[property];
            if (typeof method !== "function")
              throw new Error(
                `Operação SQL desconhecida: ${model}.${property}`,
              );
            return method(...args);
          });
      },
    },
  );
}

export const db: any = Object.fromEntries(
  Object.keys(models).map((model) => [model, publicModel(model)]),
);
export type Tx = any;

export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await withClient(async (client) => {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const tx = createDb((text, values) =>
          client.query(text, values as any[]),
        );
        try {
          const result = await fn(tx);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {
            /* best effort */
          }
          throw error;
        }
      });
    } catch (error: any) {
      const code = error?.pgCode || error?.code;
      if (attempt >= 4 || !["40001", "40P01"].includes(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
    }
  }
  throw new Error("Transação não concluída.");
}
