import { PrismaClient } from "@prisma/client";
import {
  hashPassword,
  normalizeName,
  permissionsList,
  rolePermissions,
} from "../src/server/security";
import { STAMP_XP_REWARD } from "../src/lib/xp";
const db = new PrismaClient();
async function main() {
  if (process.env.DEV_SEED !== "true")
    throw new Error("Seed fictício permitido somente com DEV_SEED=true.");
  for (const role of Object.keys(rolePermissions))
    await db.role.upsert({
      where: { id: role },
      update: { name: role },
      create: { id: role, name: role },
    });
  for (const id of permissionsList)
    await db.permission.upsert({
      where: { id },
      update: { description: id },
      create: { id, description: id },
    });
  for (const [role, grants] of Object.entries(rolePermissions))
    for (const permissionId of grants)
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role, permissionId } },
        update: {},
        create: { roleId: role, permissionId },
      });
  const now = Date.now(),
    h = 3600000,
    d = 24 * h;
  const edition = await db.edition.upsert({
    where: { slug: "jornada-farmaceutica-2026" },
    update: { status: "ACTIVE" },
    create: {
      name: "Jornada Farmacêutica 2026",
      slug: "jornada-farmaceutica-2026",
      year: 2026,
      slogan: "farmácia em movimento",
      description:
        "Conhecimento, conexões e futuro para a formação farmacêutica.",
      startAt: new Date(now - d),
      endAt: new Date(now + 30 * d),
      timezone: "America/Manaus",
      status: "ACTIVE",
      maxActivities: 5,
      maxCheckins: 5,
      normalMinutes: 15,
      noShowMinutes: 20,
      lateMinutes: 25,
      checkoutMinutes: 24,
      logoUrl: "/assets/brand/logo-jornada-2026-trimmed.webp",
      primaryColor: "#174f58",
      secondaryColor: "#b18a3b",
      backgroundColor: "#f8f9f6",
    },
  });
  const catData = [
    [
      "Palestra",
      "palestra",
      "#1d6172",
      true,
      true,
      "/assets/stamps/selo-1.webp",
    ],
    [
      "FarmaArena",
      "farma-arena",
      "#a6403a",
      false,
      false,
      "/assets/stamps/selo-3.webp",
    ],
    ["Cursos", "cursos", "#47805f", false, true, "/assets/stamps/selo-6.webp"],
    ["Outros", "outros", "#bf8e25", false, false, "/assets/stamps/selo-9.webp"],
  ] as const;
  const categories: any = {};
  for (let i = 0; i < catData.length; i++) {
    const [name, slug, color, checkout, certificate, stampUrl] = catData[i];
    categories[slug] = await db.activityCategory.upsert({
      where: { editionId_slug: { editionId: edition.id, slug } },
      update: {},
      create: {
        editionId: edition.id,
        name,
        slug,
        color,
        order: i,
        requiresCheckout: checkout,
        generatesCertificate: certificate,
        stampUrl,
      },
    });
  }
  const speakers: any = {};
  for (const s of [
    {
      name: "Dra. Helena Ribeiro",
      institution: "Faculdade Cathedral",
      bio: "Farmacêutica clínica e pesquisadora em segurança do paciente.",
      curriculumUrl: "https://lattes.cnpq.br/",
    },
    {
      name: "Prof. Rafael Nascimento",
      institution: "Rede de Farmácias Boa Vista",
      bio: "Especialista em gestão, inovação e serviços farmacêuticos.",
      curriculumUrl: "https://lattes.cnpq.br/",
    },
  ]) {
    speakers[s.name] = await db.speaker
      .create({ data: { editionId: edition.id, ...s } })
      .catch(() =>
        db.speaker.findFirstOrThrow({
          where: { editionId: edition.id, name: s.name },
        }),
      );
  }
  async function activity(key: string, data: any, speakerIds: string[]) {
    let item = await db.activity.findFirst({
      where: { editionId: edition.id, title: data.title },
    });
    if (!item)
      item = await db.activity.create({
        data: {
          editionId: edition.id,
          ...data,
          speakers: { create: speakerIds.map((speakerId) => ({ speakerId })) },
        },
      });
    return item;
  }
  const past = await activity(
    "past",
    {
      categoryId: categories.cursos.id,
      title: "Cuidado farmacêutico que transforma",
      description:
        "Práticas centradas na pessoa, acolhimento e decisões clínicas seguras.",
      startAt: new Date(now - 3 * h),
      endAt: new Date(now - 2 * h),
      block: "Bloco B",
      room: "Sala 03",
      capacity: 20,
      workload: 1,
      status: "FINISHED",
      stampUrl: "/assets/stamps/selo-6.webp",
    },
    [speakers["Dra. Helena Ribeiro"].id],
  );
  const live = await activity(
    "live",
    {
      categoryId: categories["farma-arena"].id,
      title: "FarmaArena · Inovação em movimento",
      description:
        "Casos, escolhas e soluções para desafios reais da profissão farmacêutica.",
      startAt: new Date(now - 5 * 60000),
      endAt: new Date(now + 55 * 60000),
      block: "Bloco A",
      room: "Auditório 01",
      capacity: 20,
      workload: 1,
      status: "IN_PROGRESS",
      stampUrl: "/assets/stamps/selo-3.webp",
    },
    [speakers["Prof. Rafael Nascimento"].id],
  );
  await db.activity.update({
    where: { id: live.id },
    data: {
      startAt: new Date(now - 5 * 60000),
      endAt: new Date(now + 55 * 60000),
      status: "IN_PROGRESS",
    },
  });
  const lecture = await activity(
    "lecture",
    {
      categoryId: categories.palestra.id,
      title: "Farmácia Clínica · caminhos para o futuro",
      description:
        "Uma conversa sobre cuidado, evidência e o futuro da atuação farmacêutica.",
      startAt: new Date(now + 22 * h),
      endAt: new Date(now + 24 * h),
      block: "Bloco B",
      room: "Auditório Principal",
      capacity: 200,
      workload: 2,
      status: "OPEN",
      stampUrl: "/assets/stamps/selo-1.webp",
    },
    [speakers["Dra. Helena Ribeiro"].id],
  );
  await activity(
    "course",
    {
      categoryId: categories.cursos.id,
      title: "Oficina de comunicação em saúde",
      description:
        "Prática guiada para comunicar orientações com clareza e empatia.",
      startAt: new Date(now + 25 * h),
      endAt: new Date(now + 27 * h),
      block: "Bloco C",
      room: "Sala 08",
      capacity: 15,
      workload: 2,
      status: "OPEN",
      stampUrl: "/assets/stamps/selo-8.webp",
    },
    [speakers["Prof. Rafael Nascimento"].id],
  );
  const people = [
    ["Lívia Andrade DEV", "Lívia", "48884", 8],
    ["Marina Costa DEV", "Marina", "48885", 6],
    ["João Ribeiro DEV", "João", "48886", 4],
    ["Ana Oliveira DEV", "Ana", "48887", 2],
    ["Pedro Lima DEV", "Pedro", "48888", 10],
  ] as const;
  const participants: any = {};
  for (const [name, firstName, ra, semester] of people)
    participants[ra] = await db.participant.upsert({
      where: { editionId_ra: { editionId: edition.id, ra } },
      update: {},
      create: {
        editionId: edition.id,
        name,
        firstName,
        normalizedName: normalizeName(firstName),
        ra,
        semester,
      },
    });
  const livia = participants["48884"];
  await db.arenaConfig.upsert({
    where: { editionId: edition.id },
    update: {},
    create: {
      editionId: edition.id,
      enabled: true,
      logoUrl: "/assets/stamps/farma-arena-2026-v2.webp",
      accentColor: "#981e27",
      rankingEnabled: true,
      xpReleaseMode: "MANUAL",
      firstPlaceTitle: "Rei da Jornada",
      secondPlaceTitle: "Guerreiro da Jornada",
      thirdPlaceTitle: "Desafiante da Jornada",
    },
  });
  const arenaChallengesData = [
    [
      "Cálculo Relâmpago",
      "calculo-relampago",
      "CONHECIMENTO",
      "INDIVIDUAL",
      120,
    ],
    [
      "Interações Medicamentosas",
      "interacoes-medicamentosas",
      "PRÁTICA",
      "TEAM",
      180,
    ],
    ["Stop da Bula", "stop-da-bula", "CONHECIMENTO", "TEAM", 160],
    ["Quem Sou Eu?", "quem-sou-eu", "CRIATIVIDADE", "INDIVIDUAL", 140],
    ["Semáforo da Dispensação", "semaforo-dispensacao", "PRÁTICA", "TEAM", 200],
    [
      "Quiz Verdadeiro ou Falso",
      "quiz-verdadeiro-falso",
      "CONHECIMENTO",
      "TEAM",
      170,
    ],
    ["Roleta Farmacêutica", "roleta-farmaceutica", "ESTRATÉGIA", "TEAM", 150],
    [
      "7 Erros da Receita",
      "sete-erros-receita",
      "CONHECIMENTO",
      "INDIVIDUAL",
      110,
    ],
    [
      "Imagem & Ação Farmacêutica",
      "imagem-acao-farmaceutica",
      "INTEGRAÇÃO",
      "TEAM",
      130,
    ],
    ["Desafio por QR Code", "desafio-qr-code", "ESTRATÉGIA", "TEAM", 300],
  ] as const;
  const arenaChallenges: any[] = [];
  for (let i = 0; i < arenaChallengesData.length; i++) {
    const [title, slug, category, mode, xpReward] = arenaChallengesData[i];
    arenaChallenges.push(
      await db.arenaChallenge.upsert({
        where: { editionId_slug: { editionId: edition.id, slug } },
        update: {},
        create: {
          editionId: edition.id,
          title,
          slug,
          category,
          mode,
          xpReward,
          description:
            "Uma experiência rápida que combina ciência, colaboração e decisão.",
          instructions:
            "Participe no espaço da Farma Arena e apresente o resultado à equipe de validação.",
          minTeamSize: mode === "TEAM" ? 2 : 1,
          maxTeamSize: mode === "TEAM" ? 5 : 1,
          order: i,
        },
      }),
    );
  }
  const demoXp = [620, 510, 430, 340, 260];
  for (let i = 0; i < people.length; i++) {
    const participant = participants[people[i][2]];
    await db.xpTransaction.upsert({
      where: {
        idempotencyKey: `seed-arena-xp:${edition.id}:${participant.id}`,
      },
      update: { balanceDelta: demoXp[i], rankingDelta: demoXp[i] },
      create: {
        editionId: edition.id,
        participantId: participant.id,
        type: "EARN",
        balanceDelta: demoXp[i],
        rankingDelta: demoXp[i],
        sourceType: "SEED",
        sourceId: arenaChallenges[i].id,
        description: "Pontuação demonstrativa da Farma Arena",
        idempotencyKey: `seed-arena-xp:${edition.id}:${participant.id}`,
        createdBy: "seed",
      },
    });
  }
  for (const a of [past, live, lecture])
    await db.enrollment.upsert({
      where: {
        participantId_activityId: { participantId: livia.id, activityId: a.id },
      },
      update: {},
      create: {
        editionId: edition.id,
        participantId: livia.id,
        activityId: a.id,
        status: a.id === past.id ? "COMPLETED" : "ACTIVE",
      },
    });
  const attendance = await db.attendance.upsert({
    where: {
      participantId_activityId: {
        participantId: livia.id,
        activityId: past.id,
      },
    },
    update: {},
    create: {
      editionId: edition.id,
      participantId: livia.id,
      activityId: past.id,
      checkinAt: new Date(now - 3 * h + 5 * 60000),
      status: "COMPLETED",
    },
  });
  await db.passportStamp.upsert({
    where: { attendanceId: attendance.id },
    update: {},
    create: {
      editionId: edition.id,
      participantId: livia.id,
      activityId: past.id,
      categoryId: past.categoryId,
      attendanceId: attendance.id,
      issuedBy: "seed",
      status: "VALID",
    },
  });
  const rewards = [
    ["Chaveiro", 230, 1, true],
    ["Caneta", 100, 2, false],
    ["Bloco", 100, 2, false],
    ["Botton", 60, 3, false],
    ["Ecobag", 30, 4, false],
    ["Garrafa", 20, 5, false],
  ] as const;
  const redemptionStartsAt = new Date("2026-09-24T04:00:00.000Z");
  for (let i = 0; i < rewards.length; i++) {
    const [name, total, min, guaranteed] = rewards[i];
    let reward = await db.rewardItem.findFirst({
      where: { editionId: edition.id, name },
    });
    if (!reward)
      reward = await db.rewardItem.create({
        data: {
          editionId: edition.id,
          name,
          description: guaranteed
            ? "Seu primeiro carimbo libera esta lembrança da Jornada."
            : "Troque o XP dos seus carimbos por esta lembrança.",
          total,
          order: i,
          confirmationMinutes: 60,
          redemptionStartsAt,
          redemptionMode: guaranteed ? "ELIGIBILITY" : "XP_STORE",
          xpCost: guaranteed ? 0 : min * STAMP_XP_REWARD,
        },
      });
    else
      reward = await db.rewardItem.update({
        where: { id: reward.id },
        data: {
          redemptionStartsAt,
          redemptionMode: guaranteed ? "ELIGIBILITY" : "XP_STORE",
          xpCost: guaranteed ? 0 : min * STAMP_XP_REWARD,
        },
      });
    if (!(await db.rewardRule.findFirst({ where: { rewardId: reward.id } })))
      await db.rewardRule.create({
        data: {
          editionId: edition.id,
          rewardId: reward.id,
          minCheckins: min,
          completeJourney: min === 5,
        },
      });
  }
  const xpReward = await db.rewardItem.findFirst({
    where: { editionId: edition.id, name: "Kit Campeão da Arena" },
  });
  if (!xpReward)
    await db.rewardItem.create({
      data: {
        editionId: edition.id,
        name: "Kit Campeão da Arena",
        description:
          "Uma lembrança exclusiva para quem transformou desafios em conquistas.",
        imageUrl: "/assets/rewards/garrafa.webp",
        total: 25,
        active: true,
        order: 20,
        confirmationMinutes: 1440,
        redemptionStartsAt,
        redemptionMode: "XP_STORE",
        xpCost: 300,
        maxPerParticipant: 1,
      },
    });
  await db.adminUser.upsert({
    where: { email: "admin@jornadas.dev" },
    update: { passwordHash: hashPassword("Jornada@2026!") },
    create: {
      name: "Admin Geral DEV",
      email: "admin@jornadas.dev",
      passwordHash: hashPassword("Jornada@2026!"),
      role: "ADMIN_GENERAL",
      permissions: JSON.stringify(permissionsList),
    },
  });
  await db.adminUser.upsert({
    where: { email: "operador@jornadas.dev" },
    update: { passwordHash: hashPassword("Jornada@2026!") },
    create: {
      name: "Operador DEV",
      email: "operador@jornadas.dev",
      passwordHash: hashPassword("Jornada@2026!"),
      role: "OPERATOR",
      permissions: JSON.stringify(rolePermissions.OPERATOR),
    },
  });
  const note = await db.notification.findFirst({
    where: { editionId: edition.id, dedupeKey: "seed-welcome" },
  });
  if (!note) {
    const n = await db.notification.create({
      data: {
        editionId: edition.id,
        type: "ANNOUNCEMENT",
        title: "Sua Jornada começou",
        message:
          "Confira a programação e escolha os encontros que farão parte do seu passaporte.",
        audience: "all",
        dedupeKey: "seed-welcome",
      },
    });
    await db.notificationRecipient.createMany({
      data: Object.values(participants).map((p: any) => ({
        notificationId: n.id,
        participantId: p.id,
      })),
    });
  }
  console.log(`Seed DEV pronta: ${edition.name}`);
}
main().finally(() => db.$disconnect());
