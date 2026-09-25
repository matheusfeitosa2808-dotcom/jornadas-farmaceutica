import { randomUUID } from "node:crypto";
import { STAMP_XP_REWARD } from "@/lib/xp";
import { rewardRedemptionMode, rewardXpCost } from "@/lib/rewards";
import { FARMA_ARENA_STAMP_URL } from "@/lib/farma-arena";
import type { Actor } from "./security";
import { ensure, requireParticipant, requirePermission } from "./security";
import { audit, notify } from "./domain";

export const defaultArenaConfig = (editionId: string) => ({
  editionId,
  enabled: true,
  logoUrl: "/assets/stamps/farma-arena-2026-v2.webp",
  accentColor: "#9f2f2f",
  rankingEnabled: true,
  rankingVisibility: "AUTHENTICATED",
  firstPlaceTitle: "Rei da Jornada",
  secondPlaceTitle: "Guerreiro da Jornada",
  thirdPlaceTitle: "Desafiante da Jornada",
  transitionEffect: "EMBER_STAMP",
  xpReleaseMode: "MANUAL",
  xpReleaseDelaySeconds: 0,
  combinePendingAwards: false,
});

export const EGRESS_INVITATION_CHALLENGE_SLUG = "convite-de-egressos";

const ARENA_PASSPORT_ACTIVITY_PREFIX = "arena-passport-activity:";
const ARENA_PASSPORT_CATEGORY_PREFIX = "arena-passport-category:";
export const arenaPassportActivityId = (editionId: string) =>
  `${ARENA_PASSPORT_ACTIVITY_PREFIX}${editionId}`;
export const isArenaPassportStamp = (stamp: any) =>
  String(stamp?.activityId || "").startsWith(ARENA_PASSPORT_ACTIVITY_PREFIX);

const asDate = (value: unknown) => (value ? new Date(value as any) : null);
const titleForRank = (rank: number, config: any) =>
  rank === 1
    ? config.firstPlaceTitle
    : rank === 2
      ? config.secondPlaceTitle
      : rank === 3
        ? config.thirdPlaceTitle
        : null;

export function rankingDisplayName(name: string) {
  const parts = String(name || "Participante")
    .trim()
    .split(/\s+/);
  if (parts.length < 2) return parts[0];
  return `${parts[0]} ${parts.at(-1)?.slice(0, 1)}.`;
}

export function publicArenaRanking(ranking: any[]) {
  return ranking.map((row: any) => ({
    participantId: row.participantId,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    semester: row.semester,
    rank: row.rank,
    xpTotal: row.xpTotal,
    title: row.title,
  }));
}

export async function buildArenaXpBreakdown(
  tx: any,
  editionId: string,
  participantId: string,
) {
  const participant = await tx.participant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      editionId: true,
      active: true,
      name: true,
      photoUrl: true,
      semester: true,
    },
  });
  ensure(
    participant?.active && participant.editionId === editionId,
    "Participante não encontrado no ranking.",
    "NOT_FOUND",
    404,
  );

  const [transactions, stamps] = await Promise.all([
    tx.xpTransaction.findMany({
      where: { editionId, participantId },
      orderBy: { createdAt: "desc" },
    }),
    tx.passportStamp.findMany({
      where: { editionId, participantId, status: "VALID" },
      orderBy: { issuedAt: "desc" },
    }),
  ]);
  const eligibleStamps = stamps.filter(
    (stamp: any) => !isArenaPassportStamp(stamp),
  );
  const activityIds = [
    ...new Set(eligibleStamps.map((stamp: any) => stamp.activityId)),
  ];
  const activities = activityIds.length
    ? await tx.activity.findMany({
        where: { editionId, id: { in: activityIds } },
        select: { id: true, title: true },
      })
    : [];
  const activityById = new Map(
    activities.map((activity: any) => [activity.id, activity.title]),
  );
  const entries = [
    ...transactions
      .filter((item: any) => Number(item.rankingDelta || 0) !== 0)
      .map((item: any) => ({
        id: item.id,
        source: item.sourceType,
        label: item.description || "Ajuste de XP",
        amount: Number(item.rankingDelta || 0),
        createdAt: item.createdAt,
      })),
    ...eligibleStamps.map((stamp: any) => ({
      id: `stamp-${stamp.id}`,
      source: "PASSPORT_STAMP",
      label: `Carimbo: ${activityById.get(stamp.activityId) || "atividade da Jornada"}`,
      amount: STAMP_XP_REWARD,
      createdAt: stamp.issuedAt,
    })),
  ].sort(
    (a: any, b: any) =>
      (asDate(b.createdAt)?.getTime() || 0) -
      (asDate(a.createdAt)?.getTime() || 0),
  );

  return {
    participant: {
      participantId: participant.id,
      displayName: rankingDisplayName(participant.name),
      photoUrl: participant.photoUrl,
      semester: participant.semester,
    },
    xpTotal: entries.reduce(
      (sum: number, item: any) => sum + Number(item.amount || 0),
      0,
    ),
    entries,
  };
}

type ArenaRankingCacheEntry = {
  expiresAt: number;
  promise: Promise<any[]>;
};

const arenaCacheContext = globalThis as unknown as {
  jornadasArenaRankingCache?: Map<string, ArenaRankingCacheEntry>;
};
const arenaRankingCache =
  arenaCacheContext.jornadasArenaRankingCache ??
  new Map<string, ArenaRankingCacheEntry>();
arenaCacheContext.jornadasArenaRankingCache = arenaRankingCache;

export function invalidateArenaRanking(editionId?: string) {
  if (editionId) arenaRankingCache.delete(editionId);
  else arenaRankingCache.clear();
}

export async function arenaConfig(tx: any, editionId: string, create = false) {
  const current = await tx.arenaConfig.findUnique({ where: { editionId } });
  if (current || !create) return current || defaultArenaConfig(editionId);
  return tx.arenaConfig.create({ data: defaultArenaConfig(editionId) });
}

export function rankArenaParticipants(
  participants: any[],
  transactions: any[],
  completions: any[],
  config: any,
  stamps: any[] = [],
) {
  const txByParticipant = new Map<string, any[]>();
  for (const item of transactions) {
    const list = txByParticipant.get(item.participantId) || [];
    list.push(item);
    txByParticipant.set(item.participantId, list);
  }
  const challengesByParticipant = new Map<string, Set<string>>();
  for (const item of completions) {
    const set = challengesByParticipant.get(item.participantId) || new Set();
    set.add(item.challengeId);
    challengesByParticipant.set(item.participantId, set);
  }
  const stampsByParticipant = new Map<string, any[]>();
  for (const stamp of stamps) {
    if (isArenaPassportStamp(stamp)) continue;
    const list = stampsByParticipant.get(stamp.participantId) || [];
    list.push(stamp);
    stampsByParticipant.set(stamp.participantId, list);
  }
  const rows = participants.map((participant: any) => {
    const mine = txByParticipant.get(participant.id) || [];
    const myStamps = stampsByParticipant.get(participant.id) || [];
    const stampXp = myStamps.length * STAMP_XP_REWARD;
    const xpTotal =
      stampXp +
      mine.reduce(
        (sum: number, item: any) => sum + Number(item.rankingDelta || 0),
        0,
      );
    const xpAvailable =
      stampXp +
      mine.reduce(
        (sum: number, item: any) => sum + Number(item.balanceDelta || 0),
        0,
      );
    const rankingMoments = mine
      .filter((item: any) => Number(item.rankingDelta) !== 0)
      .map((item: any) => asDate(item.createdAt)?.getTime() || 0)
      .concat(
        myStamps.map((stamp: any) => asDate(stamp.issuedAt)?.getTime() || 0),
      );
    return {
      participantId: participant.id,
      displayName: rankingDisplayName(participant.name),
      photoUrl: participant.photoUrl,
      semester: participant.semester,
      xpTotal,
      xpAvailable,
      completedChallenges:
        challengesByParticipant.get(participant.id)?.size || 0,
      tieAt: rankingMoments.length
        ? Math.max(...rankingMoments)
        : Number.MAX_SAFE_INTEGER,
    };
  });
  rows.sort(
    (a: any, b: any) =>
      b.xpTotal - a.xpTotal ||
      b.completedChallenges - a.completedChallenges ||
      a.tieAt - b.tieAt ||
      a.participantId.localeCompare(b.participantId),
  );
  return rows.map((row: any, index: number) => ({
    participantId: row.participantId,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    semester: row.semester,
    rank: index + 1,
    xpTotal: row.xpTotal,
    xpAvailable: row.xpAvailable,
    completedChallenges: row.completedChallenges,
    title: titleForRank(index + 1, config),
  }));
}

export async function buildArenaRanking(
  tx: any,
  editionId: string,
  knownConfig?: any,
) {
  const [config, participants, transactions, completions, stamps] =
    await Promise.all([
      knownConfig || arenaConfig(tx, editionId),
      tx.participant.findMany({
        where: { editionId, active: true },
        select: { id: true, name: true, photoUrl: true, semester: true },
      }),
      tx.xpTransaction.findMany({
        where: { editionId },
        select: {
          participantId: true,
          rankingDelta: true,
          balanceDelta: true,
          createdAt: true,
        },
      }),
      tx.arenaCompletion.findMany({
        where: { editionId, status: "VALID" },
        select: { participantId: true, challengeId: true },
      }),
      tx.passportStamp.findMany({
        where: { editionId, status: "VALID" },
        select: { participantId: true, activityId: true, issuedAt: true },
      }),
    ]);
  return rankArenaParticipants(
    participants,
    transactions,
    completions,
    config,
    stamps,
  );
}

export async function cachedArenaRanking(
  tx: any,
  editionId: string,
  knownConfig?: any,
) {
  const now = Date.now();
  const current = arenaRankingCache.get(editionId);
  if (current && current.expiresAt > now) return current.promise;

  const promise = buildArenaRanking(tx, editionId, knownConfig);
  arenaRankingCache.set(editionId, { expiresAt: now + 30_000, promise });
  try {
    return await promise;
  } catch (error) {
    if (arenaRankingCache.get(editionId)?.promise === promise)
      arenaRankingCache.delete(editionId);
    throw error;
  }
}

export async function arenaPayload(
  tx: any,
  editionId: string,
  actor: Actor,
  includeAdmin = false,
  adminView = "all",
) {
  const challengeWhere = {
    editionId,
    ...(includeAdmin ? {} : { active: true }),
  };
  const configPromise = arenaConfig(tx, editionId);
  const challengesPromise = tx.arenaChallenge.findMany({
    where: challengeWhere,
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  const config = await configPromise;
  const wantsAdminView = (...views: string[]) =>
    !includeAdmin || adminView === "all" || views.includes(adminView);
  // O cache é invalidado por toda mutação de XP. Usá-lo também no painel
  // evita recalcular cinco conjuntos completos a cada troca de aba.
  const computedRanking = wantsAdminView("ranking")
    ? await cachedArenaRanking(tx, editionId, config)
    : [];
  const ranking = config.rankingEnabled || includeAdmin ? computedRanking : [];
  const ownId = actor.type === "participant" ? actor.id : undefined;
  const [
    challenges,
    completions,
    awards,
    transactions,
    stamps,
    rewards,
    reservations,
    operators,
    adminParticipants,
    creditChoices,
  ] = await Promise.all([
    challengesPromise,
    wantsAdminView("validacao")
      ? tx.arenaCompletion.findMany({
          where: { editionId, ...(ownId ? { participantId: ownId } : {}) },
          orderBy: { completedAt: "desc" },
          ...(includeAdmin ? { take: 20 } : {}),
        })
      : Promise.resolve([]),
    includeAdmin && wantsAdminView("liberacao")
      ? Promise.all([
          tx.arenaXpAward.findMany({
            where: { editionId, status: "PENDING" },
            orderBy: { createdAt: "desc" },
          }),
          tx.arenaXpAward.findMany({
            where: { editionId, status: "RELEASED" },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
        ]).then(([pending, released]) => [...pending, ...released])
      : !includeAdmin
        ? tx.arenaXpAward.findMany({
            where: { editionId, ...(ownId ? { participantId: ownId } : {}) },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    includeAdmin
      ? Promise.resolve([])
      : tx.xpTransaction.findMany({
          where: { editionId, ...(ownId ? { participantId: ownId } : {}) },
          orderBy: { createdAt: "desc" },
        }),
    includeAdmin
      ? Promise.resolve([])
      : tx.passportStamp.findMany({
          where: {
            editionId,
            status: "VALID",
            ...(ownId ? { participantId: ownId } : {}),
          },
          orderBy: { issuedAt: "desc" },
        }),
    wantsAdminView("loja")
      ? tx.rewardItem
          .findMany({
            where: {
              editionId,
              ...(includeAdmin ? {} : { active: true }),
            },
            orderBy: { order: "asc" },
          })
          .then((items: any[]) =>
            items
              .filter(
                (reward: any) => rewardRedemptionMode(reward) === "XP_STORE",
              )
              .map((reward: any) => ({
                ...reward,
                redemptionMode: "XP_STORE",
                xpCost: rewardXpCost(reward),
              })),
          )
      : Promise.resolve([]),
    includeAdmin
      ? Promise.resolve([])
      : tx.rewardReservation.findMany({
          where: { editionId, ...(ownId ? { participantId: ownId } : {}) },
          orderBy: { createdAt: "desc" },
        }),
    Promise.resolve([]),
    includeAdmin && wantsAdminView("liberacao")
      ? tx.participant.findMany({
          where: { editionId, active: true },
          select: {
            id: true,
            name: true,
            ra: true,
            semester: true,
            photoUrl: true,
          },
        })
      : Promise.resolve([]),
    includeAdmin && wantsAdminView("beneficios")
      ? tx.arenaCreditChoice.findMany({
          where: { editionId },
          include: { participant: true, challenge: true },
          orderBy: { createdAt: "desc" },
        })
      : ownId
        ? tx.arenaCreditChoice.findMany({
            where: { editionId, participantId: ownId },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
  ]);
  const rewardIds = rewards.map((reward: any) => reward.id);
  const [stockReservations, stockDeliveries] = rewardIds.length
    ? await Promise.all([
        tx.rewardReservation.findMany({
          where: {
            rewardId: { in: rewardIds },
            status: {
              in: ["AWAITING_CONFIRMATION", "RESERVED", "CONFIRMED"],
            },
          },
          select: { rewardId: true, quantity: true },
        }),
        tx.rewardDelivery.findMany({
          where: { rewardId: { in: rewardIds }, status: "DELIVERED" },
          select: { rewardId: true, quantity: true },
        }),
      ])
    : [[], []];
  const reservedByReward = new Map<string, number>();
  const deliveredByReward = new Map<string, number>();
  for (const row of stockReservations as any[])
    reservedByReward.set(
      row.rewardId,
      (reservedByReward.get(row.rewardId) || 0) + Number(row.quantity || 0),
    );
  for (const row of stockDeliveries as any[])
    deliveredByReward.set(
      row.rewardId,
      (deliveredByReward.get(row.rewardId) || 0) + Number(row.quantity || 0),
    );
  const rewardsWithAvailability = rewards.map((reward: any) => ({
    ...reward,
    stockAvailable: Math.max(
      0,
      reward.total -
        (reservedByReward.get(reward.id) || 0) -
        (deliveredByReward.get(reward.id) || 0),
    ),
  }));
  const pendingRevealAwards = ownId
    ? awards.filter(
        (award: any) =>
          award.status === "RELEASED" &&
          ["QUEUED", "DELIVERED"].includes(award.animationStatus),
      )
    : [];
  const my = ownId
    ? computedRanking.find((row: any) => row.participantId === ownId)
    : undefined;
  const creditChallenge = challenges.find(
    (challenge: any) => challenge.slug === EGRESS_INVITATION_CHALLENGE_SLUG,
  );
  const creditCompletion = creditChallenge
    ? completions.find(
        (completion: any) =>
          completion.challengeId === creditChallenge.id &&
          completion.status === "VALID",
      )
    : null;
  const creditSubmission = creditChallenge
    ? creditChoices.find(
        (choice: any) => choice.challengeId === creditChallenge.id,
      )
    : null;
  const completionById = new Map(
    completions.map((completion: any) => [completion.id, completion]),
  );
  const operatorById = new Map(
    operators.map((operator: any) => [operator.id, operator.name]),
  );
  const participantById = new Map(
    adminParticipants.map((participant: any) => [participant.id, participant]),
  );
  const awardsWithAdminContext = includeAdmin
    ? awards.map((award: any) => {
        const completion: any = completionById.get(award.completionId);
        return {
          ...award,
          participant: participantById.get(award.participantId),
          validatedAt: completion?.completedAt || award.createdAt,
          validatedByName:
            operatorById.get(completion?.validatedBy) ||
            "Equipe da organização",
        };
      })
    : awards;
  const ledger = [
    ...transactions,
    ...stamps
      .filter((stamp: any) => !isArenaPassportStamp(stamp))
      .map((stamp: any) => ({
        id: `stamp-xp-${stamp.id}`,
        editionId,
        participantId: stamp.participantId,
        type: "EARN",
        balanceDelta: STAMP_XP_REWARD,
        rankingDelta: STAMP_XP_REWARD,
        sourceType: "PASSPORT_STAMP",
        sourceId: stamp.id,
        description: "Carimbo conquistado",
        idempotencyKey: `stamp-xp-${stamp.id}`,
        createdBy: stamp.issuedBy,
        createdAt: stamp.issuedAt,
      })),
  ].sort(
    (a: any, b: any) =>
      (asDate(b.createdAt)?.getTime() || 0) -
      (asDate(a.createdAt)?.getTime() || 0),
  );
  return {
    config,
    challenges,
    // O participante recebe somente o pódio na carga principal. O restante
    // do ranking é buscado apenas quando ele pedir para ver a lista completa.
    ranking: publicArenaRanking(includeAdmin ? ranking : ranking.slice(0, 3)),
    myRanking: my ? publicArenaRanking([my])[0] : null,
    myRank: my?.rank || null,
    myXpTotal: my?.xpTotal || 0,
    myXpAvailable: my?.xpAvailable || 0,
    completedChallenges: my?.completedChallenges || 0,
    completions,
    awards: awardsWithAdminContext,
    pendingRevealAwards,
    transactions: ledger,
    rewards: rewardsWithAvailability,
    reservations,
    creditChoices: includeAdmin ? creditChoices : [],
    disciplineBenefit: includeAdmin
      ? null
      : {
          eligible: Boolean(creditCompletion),
          challengeId: creditChallenge?.id || null,
          challengeTitle: creditChallenge?.title || null,
          submitted: Boolean(creditSubmission),
          submission: creditSubmission || null,
        },
  };
}

export async function submitArenaCreditChoice(
  tx: any,
  editionId: string,
  disciplineInput: string,
  actor: Actor,
) {
  requireParticipant(actor, editionId);
  const discipline = String(disciplineInput || "").trim();
  ensure(discipline.length > 0, "Digite a disciplina escolhida.");
  ensure(
    discipline.length <= 120,
    "A disciplina deve ter no máximo 120 caracteres.",
  );
  const challenge = await tx.arenaChallenge.findFirst({
    where: {
      editionId,
      slug: EGRESS_INVITATION_CHALLENGE_SLUG,
      active: true,
    },
  });
  ensure(challenge, "Benefício ainda não disponível.", "NOT_FOUND", 404);
  const completion = await tx.arenaCompletion.findFirst({
    where: {
      editionId,
      challengeId: challenge.id,
      participantId: actor.id,
      status: "VALID",
    },
  });
  ensure(
    completion,
    "Conclua o desafio Convite de egressos para escolher a disciplina.",
    "FORBIDDEN",
    403,
  );
  const previous = await tx.arenaCreditChoice.findUnique({
    where: {
      participantId_challengeId: {
        participantId: actor.id,
        challengeId: challenge.id,
      },
    },
  });
  ensure(
    !previous,
    "Sua disciplina já foi enviada e não pode ser alterada.",
    "DUPLICATE",
    409,
  );
  const choice = await tx.arenaCreditChoice.create({
    data: {
      editionId,
      challengeId: challenge.id,
      participantId: actor.id,
      discipline,
    },
  });
  await audit(
    tx,
    actor,
    editionId,
    "arena.credit.submit",
    "ArenaCreditChoice",
    choice.id,
    undefined,
    choice,
  );
  return choice;
}

async function ensureArenaPassportStamp(
  tx: any,
  editionId: string,
  participantId: string,
  issuedBy: string,
) {
  const activityId = arenaPassportActivityId(editionId);
  const current = await tx.passportStamp.findFirst({
    where: { editionId, participantId, activityId },
  });
  if (current?.status === "VALID") return { stamp: current, granted: false };

  const edition = await tx.edition.findUnique({ where: { id: editionId } });
  ensure(edition, "Edição não encontrada.", "NOT_FOUND", 404);
  const now = new Date();
  const category = await tx.activityCategory.upsert({
    where: { editionId_slug: { editionId, slug: "farma-arena" } },
    create: {
      id: `${ARENA_PASSPORT_CATEGORY_PREFIX}${editionId}`,
      editionId,
      name: "Farma Arena",
      slug: "farma-arena",
      color: "#9f2f2f",
      icon: "trophy",
      order: 999,
      requiresEnrollment: false,
      requiresCheckin: false,
      requiresCheckout: false,
      generatesStamp: true,
      generatesCertificate: false,
      active: true,
      stampUrl: FARMA_ARENA_STAMP_URL,
      stampColor: "#b5221b",
    },
    update: {
      name: "Farma Arena",
      color: "#9f2f2f",
      generatesStamp: true,
      active: true,
      stampUrl: FARMA_ARENA_STAMP_URL,
      stampColor: "#b5221b",
    },
  });
  await tx.activity.upsert({
    where: { id: activityId },
    create: {
      id: activityId,
      editionId,
      categoryId: category.id,
      title: "Farma Arena",
      description:
        "Carimbo especial concedido na primeira conquista de XP da Farma Arena.",
      startAt: edition.startAt,
      endAt: edition.endAt,
      block: "Farma Arena",
      room: "Farma Arena",
      capacity: 100000,
      enrollmentOpen: false,
      workload: 0,
      status: "DRAFT",
      allowWaitlist: false,
      stampUrl: FARMA_ARENA_STAMP_URL,
      stampColor: "#b5221b",
    },
    update: {
      categoryId: category.id,
      title: "Farma Arena",
      description:
        "Carimbo especial concedido na primeira conquista de XP da Farma Arena.",
      enrollmentOpen: false,
      status: "DRAFT",
      allowWaitlist: false,
      stampUrl: FARMA_ARENA_STAMP_URL,
      stampColor: "#b5221b",
    },
  });
  const attendance = await tx.attendance.upsert({
    where: {
      participantId_activityId: { participantId, activityId },
    },
    create: {
      editionId,
      participantId,
      activityId,
      checkinAt: now,
      checkoutAt: now,
      status: "COMPLETED",
    },
    update: {
      status: "COMPLETED",
      checkinAt: now,
      checkoutAt: now,
    },
  });
  const stamp = await tx.passportStamp.upsert({
    where: {
      participantId_activityId: { participantId, activityId },
    },
    create: {
      editionId,
      participantId,
      activityId,
      categoryId: category.id,
      attendanceId: attendance.id,
      issuedAt: now,
      issuedBy,
      status: "VALID",
    },
    update: {
      categoryId: category.id,
      attendanceId: attendance.id,
      issuedBy,
      status: "VALID",
    },
  });
  return { stamp, granted: true };
}

async function revokeArenaPassportStampIfEmpty(
  tx: any,
  editionId: string,
  participantId: string,
) {
  const released = await tx.arenaXpAward.count({
    where: { editionId, participantId, status: "RELEASED" },
  });
  if (released) return;
  const activityId = arenaPassportActivityId(editionId);
  await tx.passportStamp.updateMany({
    where: { editionId, participantId, activityId, status: "VALID" },
    data: { status: "REVOKED" },
  });
  await tx.attendance.updateMany({
    where: { editionId, participantId, activityId },
    data: { status: "CANCELLED" },
  });
}

async function validateChallenge(
  tx: any,
  editionId: string,
  challengeId: string,
) {
  const challenge = await tx.arenaChallenge.findFirst({
    where: { id: challengeId, editionId, active: true },
  });
  ensure(challenge, "Desafio indisponível.", "NOT_FOUND", 404);
  const now = new Date();
  ensure(
    !challenge.startsAt || asDate(challenge.startsAt)! <= now,
    "Este desafio ainda não começou.",
  );
  ensure(
    !challenge.endsAt || asDate(challenge.endsAt)! >= now,
    "Este desafio já encerrou.",
  );
  return challenge;
}

async function validateParticipantsByRa(
  tx: any,
  editionId: string,
  ras: string[],
) {
  const clean = [
    ...new Set(ras.map((ra) => String(ra).trim()).filter(Boolean)),
  ];
  ensure(clean.length, "Informe ao menos um RA.");
  const participants = await tx.participant.findMany({
    where: { editionId, active: true, ra: { in: clean } },
  });
  const found = new Set(participants.map((participant: any) => participant.ra));
  const missing = clean.filter((ra) => !found.has(ra));
  ensure(
    !missing.length,
    `RA não encontrado: ${missing.join(", ")}.`,
    "PARTICIPANT_NOT_FOUND",
    404,
  );
  return clean.map((ra) =>
    participants.find((participant: any) => participant.ra === ra),
  );
}

async function releaseAwardCore(
  tx: any,
  editionId: string,
  awardId: string,
  actor: Actor,
) {
  const award = await tx.arenaXpAward.findFirst({
    where: { id: awardId, editionId },
    include: { challenge: true, completion: true },
  });
  ensure(award, "Prêmio de XP não encontrado.", "NOT_FOUND", 404);
  if (award.status === "RELEASED" && award.xpTransactionId) {
    const passportStamp = await ensureArenaPassportStamp(
      tx,
      editionId,
      award.participantId,
      actor.id,
    );
    const ranking = await buildArenaRanking(tx, editionId);
    const current = ranking.find(
      (row: any) => row.participantId === award.participantId,
    );
    return {
      award,
      alreadyReleased: true,
      rankAfter: current?.rank,
      xpTotalAfter: current?.xpTotal,
      xpAvailableAfter: current?.xpAvailable,
      passportStampGranted: passportStamp.granted,
    };
  }
  ensure(award.status === "PENDING", "Este prêmio não está pendente.");
  ensure(
    award.completion?.status === "VALID",
    "A conclusão deste desafio não é válida.",
  );
  const before = (await buildArenaRanking(tx, editionId)).find(
    (row: any) => row.participantId === award.participantId,
  );
  const transaction = await tx.xpTransaction.upsert({
    where: { idempotencyKey: `arena-award:${award.id}` },
    create: {
      editionId,
      participantId: award.participantId,
      type: "EARN",
      balanceDelta: award.amount,
      rankingDelta: award.amount,
      sourceType: "ARENA_AWARD",
      sourceId: award.id,
      description: `Desafio concluído: ${award.challenge.title}`,
      idempotencyKey: `arena-award:${award.id}`,
      createdBy: actor.id,
    },
    update: {},
  });
  const provisional = await tx.arenaXpAward.update({
    where: { id: award.id },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
      releasedBy: actor.id,
      xpTransactionId: transaction.id,
      animationStatus: "QUEUED",
    },
  });
  const passportStamp = await ensureArenaPassportStamp(
    tx,
    editionId,
    award.participantId,
    actor.id,
  );
  const after = (await buildArenaRanking(tx, editionId)).find(
    (row: any) => row.participantId === award.participantId,
  );
  const enteredTopThree =
    (before?.rank || Number.MAX_SAFE_INTEGER) > 3 && (after?.rank || 99) <= 3;
  const movedInsideTopThree =
    (before?.rank || 99) <= 3 &&
    (after?.rank || 99) <= 3 &&
    before?.rank !== after?.rank;
  const animationVariant =
    enteredTopThree || movedInsideTopThree ? `TOP_${after.rank}` : "STANDARD";
  const released =
    animationVariant === "STANDARD"
      ? provisional
      : await tx.arenaXpAward.update({
          where: { id: award.id },
          data: { animationVariant },
        });
  await notify(
    tx,
    editionId,
    [award.participantId],
    "ARENA_XP_RELEASED",
    "XP liberado!",
    `${award.challenge.title} · +${award.amount} XP${passportStamp.granted ? " · Carimbo especial da Farma Arena conquistado!" : ""}`,
  );
  await audit(
    tx,
    actor,
    editionId,
    "arena.award.release",
    "ArenaXpAward",
    award.id,
    award,
    released,
  );
  return {
    award: released,
    xpDelta: award.amount,
    xpTotalBefore: before?.xpTotal || 0,
    xpTotalAfter: after?.xpTotal || 0,
    xpAvailableBefore: before?.xpAvailable || 0,
    xpAvailableAfter: after?.xpAvailable || 0,
    rankBefore: before?.rank || null,
    rankAfter: after?.rank || null,
    title: after?.title || null,
    challengeTitle: award.challenge.title,
    passportStampGranted: passportStamp.granted,
  };
}

export async function completeArenaChallenge(
  tx: any,
  editionId: string,
  challengeId: string,
  ras: string[],
  actor: Actor,
  options: { individual?: boolean } = {},
) {
  requirePermission(actor, "arena.validate");
  const [challenge, config] = await Promise.all([
    validateChallenge(tx, editionId, challengeId),
    arenaConfig(tx, editionId, true),
  ]);
  const participants = await validateParticipantsByRa(tx, editionId, ras);
  if (options.individual) {
    ensure(
      participants.length === 1,
      "A liberação individual aceita apenas um participante.",
    );
  } else if (challenge.mode === "TEAM") {
    ensure(
      participants.length >= challenge.minTeamSize,
      `A equipe precisa de pelo menos ${challenge.minTeamSize} participantes.`,
    );
    ensure(
      participants.length <= challenge.maxTeamSize,
      `A equipe aceita no máximo ${challenge.maxTeamSize} participantes.`,
    );
  } else {
    ensure(
      participants.length === 1,
      "O desafio individual aceita apenas um participante.",
    );
  }
  const teamSessionId = challenge.mode === "TEAM" ? randomUUID() : null;
  const created: any[] = [];
  for (const participant of participants) {
    const prior = await tx.arenaCompletion.count({
      where: { challengeId, participantId: participant.id, status: "VALID" },
    });
    const limit = options.individual
      ? 1
      : challenge.repeatable
        ? Math.max(1, challenge.maxCompletionsPerParticipant)
        : 1;
    ensure(
      prior < limit,
      `${participant.name} já atingiu o limite deste desafio.`,
      "DUPLICATE",
      409,
    );
    const completion = await tx.arenaCompletion.create({
      data: {
        editionId,
        challengeId,
        participantId: participant.id,
        teamSessionId,
        validatedBy: actor.id,
        status: "VALID",
        xpAwarded: challenge.xpReward,
      },
    });
    const releaseMode = config.xpReleaseMode;
    const releaseAt =
      releaseMode === "SCHEDULED"
        ? new Date(
            Date.now() + Math.max(0, config.xpReleaseDelaySeconds) * 1000,
          )
        : null;
    const award = await tx.arenaXpAward.create({
      data: {
        editionId,
        participantId: participant.id,
        challengeId,
        completionId: completion.id,
        amount: challenge.xpReward,
        status: "PENDING",
        releaseMode,
        releaseAt,
        animationStatus: "QUEUED",
      },
    });
    await audit(
      tx,
      actor,
      editionId,
      "arena.challenge.complete",
      "ArenaCompletion",
      completion.id,
      undefined,
      completion,
    );
    created.push({ completion, award, participant });
  }
  const releases = [];
  if (config.xpReleaseMode === "IMMEDIATE") {
    for (const item of created)
      releases.push(
        await releaseAwardCore(tx, editionId, item.award.id, actor),
      );
  }
  return {
    teamSessionId,
    completions: created.map((item) => item.completion),
    awards: created.map((item) => item.award),
    releases,
  };
}

export async function releaseArenaAwards(
  tx: any,
  editionId: string,
  awardIds: string[],
  actor: Actor,
) {
  requirePermission(actor, "arena.release_xp");
  ensure(awardIds.length, "Selecione ao menos um prêmio.");
  const results = [];
  for (const id of [...new Set(awardIds)])
    results.push(await releaseAwardCore(tx, editionId, id, actor));
  return results;
}

export async function scheduleArenaAward(
  tx: any,
  editionId: string,
  awardId: string,
  releaseAt: Date,
  actor: Actor,
) {
  requirePermission(actor, "arena.release_xp");
  ensure(
    releaseAt instanceof Date && !Number.isNaN(releaseAt.getTime()),
    "Informe uma data e hora válidas.",
  );
  ensure(releaseAt.getTime() > Date.now(), "Escolha um horário futuro.");
  const award = await tx.arenaXpAward.findFirst({
    where: { id: awardId, editionId, status: "PENDING" },
  });
  ensure(award, "Prêmio pendente não encontrado.", "NOT_FOUND", 404);
  const updated = await tx.arenaXpAward.update({
    where: { id: award.id },
    data: { releaseMode: "SCHEDULED", releaseAt },
  });
  await audit(
    tx,
    actor,
    editionId,
    "arena.award.schedule",
    "ArenaXpAward",
    award.id,
    award,
    updated,
  );
  return updated;
}

export async function cancelArenaAward(
  tx: any,
  editionId: string,
  awardId: string,
  reason: string,
  actor: Actor,
) {
  requirePermission(actor, "arena.release_xp");
  ensure(
    reason.trim().length >= 5,
    "Informe um motivo com pelo menos 5 caracteres.",
  );
  const award = await tx.arenaXpAward.findFirst({
    where: { id: awardId, editionId, status: "PENDING" },
  });
  ensure(award, "Prêmio pendente não encontrado.", "NOT_FOUND", 404);
  const updated = await tx.arenaXpAward.update({
    where: { id: award.id },
    data: { status: "CANCELLED", animationStatus: "SKIPPED" },
  });
  await audit(
    tx,
    actor,
    editionId,
    "arena.award.cancel",
    "ArenaXpAward",
    award.id,
    award,
    updated,
    reason,
  );
  return updated;
}

export async function markArenaAwardSeen(
  tx: any,
  editionId: string,
  awardId: string,
  actor: Actor,
) {
  requireParticipant(actor, editionId);
  const award = await tx.arenaXpAward.findFirst({
    where: {
      id: awardId,
      editionId,
      participantId: actor.id,
      status: "RELEASED",
    },
  });
  ensure(award, "Conquista não encontrada.", "NOT_FOUND", 404);
  if (award.animationStatus === "SEEN") return award;
  return tx.arenaXpAward.update({
    where: { id: award.id },
    data: {
      animationStatus: "SEEN",
      animationSeenAt: new Date(),
      animationDeliveredAt: award.animationDeliveredAt || new Date(),
    },
  });
}

export async function revokeArenaCompletion(
  tx: any,
  editionId: string,
  completionId: string,
  reason: string,
  actor: Actor,
) {
  requirePermission(actor, "arena.validate");
  ensure(
    reason.trim().length >= 5,
    "Informe um motivo com pelo menos 5 caracteres.",
  );
  const completion = await tx.arenaCompletion.findFirst({
    where: { id: completionId, editionId, status: "VALID" },
    include: { award: true, challenge: true },
  });
  ensure(completion, "Conclusão válida não encontrada.", "NOT_FOUND", 404);
  if (completion.award?.status === "RELEASED") {
    await tx.xpTransaction.upsert({
      where: { idempotencyKey: `arena-revoke:${completion.id}` },
      create: {
        editionId,
        participantId: completion.participantId,
        type: "REVERSAL",
        balanceDelta: -completion.xpAwarded,
        rankingDelta: -completion.xpAwarded,
        sourceType: "ARENA_COMPLETION_REVERSAL",
        sourceId: completion.id,
        description: `Revogação: ${completion.challenge.title}`,
        idempotencyKey: `arena-revoke:${completion.id}`,
        createdBy: actor.id,
      },
      update: {},
    });
  }
  const updated = await tx.arenaCompletion.update({
    where: { id: completion.id },
    data: { status: "REVOKED", reason },
  });
  if (completion.award)
    await tx.arenaXpAward.update({
      where: { id: completion.award.id },
      data: { status: "REVOKED", animationStatus: "SKIPPED" },
    });
  await revokeArenaPassportStampIfEmpty(
    tx,
    editionId,
    completion.participantId,
  );
  await audit(
    tx,
    actor,
    editionId,
    "arena.challenge.revoke",
    "ArenaCompletion",
    completion.id,
    completion,
    updated,
    reason,
  );
  return updated;
}

export async function adjustArenaXp(
  tx: any,
  editionId: string,
  participantId: string,
  amount: number,
  reason: string,
  actor: Actor,
) {
  requirePermission(actor, "arena.adjust_xp");
  ensure(
    Number.isSafeInteger(amount) && amount !== 0,
    "Informe um ajuste inteiro diferente de zero.",
  );
  ensure(
    reason.trim().length >= 5,
    "Informe um motivo com pelo menos 5 caracteres.",
  );
  const participant = await tx.participant.findFirst({
    where: { id: participantId, editionId, active: true },
  });
  ensure(participant, "Participante não encontrado.", "NOT_FOUND", 404);
  const transaction = await tx.xpTransaction.create({
    data: {
      editionId,
      participantId,
      type: "ADJUSTMENT",
      balanceDelta: amount,
      rankingDelta: amount,
      sourceType: "ADMIN_ADJUSTMENT",
      sourceId: randomUUID(),
      description: reason.trim(),
      idempotencyKey: `arena-adjust:${randomUUID()}`,
      createdBy: actor.id,
    },
  });
  await audit(
    tx,
    actor,
    editionId,
    "arena.xp.adjust",
    "XpTransaction",
    transaction.id,
    undefined,
    transaction,
    reason,
  );
  return transaction;
}

async function rewardAvailable(tx: any, reward: any) {
  const [reserved, delivered] = await Promise.all([
    tx.rewardReservation.aggregate({
      _sum: { quantity: true },
      where: {
        rewardId: reward.id,
        status: { in: ["AWAITING_CONFIRMATION", "RESERVED", "CONFIRMED"] },
      },
    }),
    tx.rewardDelivery.aggregate({
      _sum: { quantity: true },
      where: { rewardId: reward.id, status: "DELIVERED" },
    }),
  ]);
  return Math.max(
    0,
    reward.total -
      Number(reserved._sum.quantity || 0) -
      Number(delivered._sum.quantity || 0),
  );
}

export async function purchaseXpReward(
  tx: any,
  editionId: string,
  rewardId: string,
  actor: Actor,
) {
  requireParticipant(actor, editionId);
  const rewardRecord = await tx.rewardItem.findFirst({
    where: {
      id: rewardId,
      editionId,
      active: true,
    },
  });
  const reward = rewardRecord
    ? { ...rewardRecord, xpCost: rewardXpCost(rewardRecord) }
    : null;
  ensure(reward, "Item indisponível na Loja XP.", "NOT_FOUND", 404);
  ensure(
    rewardRedemptionMode(reward) === "XP_STORE",
    "Este brinde é liberado por carimbo.",
  );
  ensure(
    reward.xpCost > 0,
    "Os valores em XP estão sendo calculados com base no ranking. As reservas serão liberadas em breve.",
    "REWARD_PRICING_PENDING",
    409,
  );
  ensure(
    !reward.redemptionStartsAt ||
      asDate(reward.redemptionStartsAt)! <= new Date(),
    "O período de resgate ainda não começou.",
  );
  const ranking = await buildArenaRanking(tx, editionId);
  const current = ranking.find((row: any) => row.participantId === actor.id);
  ensure(
    (current?.xpAvailable || 0) >= reward.xpCost,
    "XP disponível insuficiente.",
    "INSUFFICIENT_XP",
    409,
  );
  ensure(
    (await rewardAvailable(tx, reward)) > 0,
    "Item esgotado.",
    "OUT_OF_STOCK",
    409,
  );
  const previous = await tx.rewardReservation.count({
    where: {
      rewardId,
      participantId: actor.id,
      status: {
        in: ["AWAITING_CONFIRMATION", "RESERVED", "CONFIRMED", "DELIVERED"],
      },
    },
  });
  ensure(
    previous < reward.maxPerParticipant,
    "Você já atingiu o limite deste item.",
    "LIMIT_REACHED",
    409,
  );
  const reservation = await tx.rewardReservation.create({
    data: {
      editionId,
      rewardId,
      participantId: actor.id,
      quantity: 1,
      status: "RESERVED",
      confirmedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600000),
    },
  });
  const transaction = await tx.xpTransaction.create({
    data: {
      editionId,
      participantId: actor.id,
      type: "SPEND",
      balanceDelta: -reward.xpCost,
      rankingDelta: 0,
      sourceType: "REWARD_PURCHASE",
      sourceId: reservation.id,
      description: `Resgate: ${reward.name}`,
      idempotencyKey: `reward-purchase:${reservation.id}`,
      createdBy: actor.id,
    },
  });
  await notify(
    tx,
    editionId,
    [actor.id],
    "XP_STORE_PURCHASE",
    "Resgate confirmado",
    `${reward.name} reservado por ${reward.xpCost} XP.`,
  );
  await audit(
    tx,
    actor,
    editionId,
    "reward.purchase",
    "RewardReservation",
    reservation.id,
    undefined,
    { reservation, transaction },
  );
  return { reservation, transaction };
}

export async function cancelXpPurchase(
  tx: any,
  editionId: string,
  reservationId: string,
  actor: Actor,
) {
  const reservation = await tx.rewardReservation.findFirst({
    where: {
      id: reservationId,
      editionId,
      participantId: actor.type === "participant" ? actor.id : undefined,
      status: "RESERVED",
    },
  });
  ensure(reservation, "Reserva cancelável não encontrada.", "NOT_FOUND", 404);
  const reward = await tx.rewardItem.findFirst({
    where: { id: reservation.rewardId },
  });
  ensure(reward, "Este resgate não pertence à Loja XP.");
  ensure(
    rewardRedemptionMode(reward) === "XP_STORE",
    "Este resgate não pertence à Loja XP.",
  );
  if (actor.type === "admin") requirePermission(actor, "rewards.manage");
  const spend = await tx.xpTransaction.findFirst({
    where: {
      editionId,
      participantId: reservation.participantId,
      sourceType: "REWARD_PURCHASE",
      sourceId: reservation.id,
    },
  });
  ensure(spend, "Débito original não encontrado.");
  const refund = await tx.xpTransaction.upsert({
    where: { idempotencyKey: `reward-refund:${reservation.id}` },
    create: {
      editionId,
      participantId: reservation.participantId,
      type: "REFUND",
      balanceDelta: Math.abs(spend.balanceDelta),
      rankingDelta: 0,
      sourceType: "REWARD_REFUND",
      sourceId: reservation.id,
      description: `Reembolso: ${reward.name}`,
      idempotencyKey: `reward-refund:${reservation.id}`,
      createdBy: actor.id,
    },
    update: {},
  });
  const updated = await tx.rewardReservation.update({
    where: { id: reservation.id },
    data: { status: "EXPIRED" },
  });
  await audit(
    tx,
    actor,
    editionId,
    "reward.purchase.cancel",
    "RewardReservation",
    reservation.id,
    reservation,
    updated,
  );
  return { reservation: updated, transaction: refund };
}

export async function releaseScheduledArenaAwards(
  tx: any,
  editionId: string,
  actor: Actor,
) {
  const due = await tx.arenaXpAward.findMany({
    where: {
      editionId,
      status: "PENDING",
      releaseMode: "SCHEDULED",
      releaseAt: { lte: new Date() },
    },
  });
  const results = [];
  for (const award of due)
    results.push(await releaseAwardCore(tx, editionId, award.id, actor));
  return results;
}
