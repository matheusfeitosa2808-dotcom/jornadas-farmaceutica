import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.LOAD_TEST_URL || "http://127.0.0.1:3000";
const participantsCount = Number(process.env.LOAD_TEST_PARTICIPANTS || 250);
const eventDays = Number(process.env.LOAD_TEST_DAYS || 4);
const rewardsCount = Number(process.env.LOAD_TEST_REWARDS || 6);
const jsonHeaders = { Origin: baseUrl, "Content-Type": "application/json" };

type Sample = {
  ok: boolean;
  status: number;
  durationMs: number;
  bytes: number;
  error?: string;
};

function percentile(values: number[], value: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)
  ];
}

function summarize(label: string, samples: Sample[], wallMs: number) {
  const durations = samples.map((sample) => sample.durationMs);
  const successful = samples.filter((sample) => sample.ok).length;
  return {
    label,
    requests: samples.length,
    successful,
    failed: samples.length - successful,
    successRate: Number(
      ((successful / Math.max(1, samples.length)) * 100).toFixed(2),
    ),
    wallMs: Math.round(wallMs),
    requestsPerSecond: Number(
      ((samples.length * 1000) / Math.max(1, wallMs)).toFixed(2),
    ),
    averageMs: Math.round(
      durations.reduce((total, item) => total + item, 0) /
        Math.max(1, durations.length),
    ),
    p95Ms: Math.round(percentile(durations, 0.95)),
    p99Ms: Math.round(percentile(durations, 0.99)),
    maxMs: Math.round(Math.max(0, ...durations)),
    transferredMb: Number(
      (
        samples.reduce((total, item) => total + item.bytes, 0) / 1_000_000
      ).toFixed(2),
    ),
    errors: samples
      .filter((sample) => !sample.ok)
      .slice(0, 5)
      .map((sample) => sample.error),
  };
}

async function measured(request: () => Promise<Response>): Promise<Sample> {
  const started = performance.now();
  try {
    const response = await request();
    const body = await response.arrayBuffer();
    return {
      ok: response.ok,
      status: response.status,
      durationMs: performance.now() - started,
      bytes: body.byteLength,
      error: response.ok ? undefined : new TextDecoder().decode(body),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: performance.now() - started,
      bytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function burst(label: string, requests: Array<() => Promise<Response>>) {
  const started = performance.now();
  const samples = await Promise.all(
    requests.map((request) => measured(request)),
  );
  const summary = summarize(label, samples, performance.now() - started);
  console.log(
    `${label}: ${summary.successful}/${summary.requests} em ${summary.wallMs} ms`,
  );
  return summary;
}

function state(
  cookie: string,
  scope: "participant" | "admin",
  editionId: string,
) {
  return fetch(
    `${baseUrl}/api/state?scope=${scope}&editionId=${encodeURIComponent(editionId)}`,
    {
      headers: { Cookie: cookie },
    },
  );
}

function action(
  cookie: string,
  scope: "participant" | "admin",
  editionId: string,
  actionName: string,
  payload: Record<string, unknown> = {},
) {
  return fetch(`${baseUrl}/api/action`, {
    method: "POST",
    headers: { ...jsonHeaders, Cookie: cookie },
    body: JSON.stringify({ action: actionName, scope, editionId, ...payload }),
  });
}

async function login(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    text,
    cookie: response.headers.get("set-cookie")?.split(";", 1)[0] || "",
  };
}

async function participantLogins(
  editionId: string,
  participants: Array<{ id: string; ra: string }>,
  day: number,
) {
  const started = performance.now();
  const results = await Promise.all(
    participants.map(async (participant) => {
      const requestStarted = performance.now();
      try {
        const result = await login({
          kind: "participant",
          editionId,
          firstName: "Carga",
          ra: participant.ra,
        });
        return {
          participant,
          cookie: result.cookie,
          sample: {
            ok: result.response.ok,
            status: result.response.status,
            durationMs: performance.now() - requestStarted,
            bytes: Buffer.byteLength(result.text),
            error: result.response.ok ? undefined : result.text,
          } satisfies Sample,
        };
      } catch (error) {
        return {
          participant,
          cookie: "",
          sample: {
            ok: false,
            status: 0,
            durationMs: performance.now() - requestStarted,
            bytes: 0,
            error: error instanceof Error ? error.message : String(error),
          } satisfies Sample,
        };
      }
    }),
  );
  const summary = summarize(
    `Dia ${day}: 250 logins`,
    results.map((item) => item.sample),
    performance.now() - started,
  );
  console.log(
    `${summary.label}: ${summary.successful}/${summary.requests} em ${summary.wallMs} ms`,
  );
  return { results, summary };
}

async function main() {
  const health = await fetch(`${baseUrl}/api/state?scope=public`);
  if (!health.ok) throw new Error(`Servidor indisponível em ${baseUrl}.`);

  const now = Date.now();
  const edition = await db.edition.create({
    data: {
      name: `Evento completo DEV — ${now}`,
      slug: `evento-completo-dev-${now}`,
      year: 2026,
      startAt: new Date(now - 60 * 60_000),
      endAt: new Date(now + 30 * 24 * 60 * 60_000),
      status: "ACTIVE",
      maxActivities: eventDays,
      maxCheckins: eventDays,
      normalMinutes: 1_440,
      noShowMinutes: 1_440,
      lateMinutes: 1_440,
      checkoutMinutes: 60,
    },
  });

  try {
    const categories = await Promise.all(
      Array.from({ length: eventDays }, (_, index) =>
        db.activityCategory.create({
          data: {
            editionId: edition.id,
            name: `Dia ${index + 1}`,
            slug: `dia-${index + 1}`,
            order: index,
            generatesStamp: true,
            generatesCertificate: true,
          },
        }),
      ),
    );
    const activities = await Promise.all(
      categories.map((category, index) =>
        db.activity.create({
          data: {
            editionId: edition.id,
            categoryId: category.id,
            title: `Atividade principal — dia ${index + 1}`,
            startAt: new Date(now + (index + 1) * 2 * 24 * 60 * 60_000),
            endAt: new Date(
              now + (index + 1) * 2 * 24 * 60 * 60_000 + 2 * 60 * 60_000,
            ),
            capacity: participantsCount,
            status: "OPEN",
          },
        }),
      ),
    );
    const rewards = await Promise.all(
      Array.from({ length: rewardsCount }, (_, index) =>
        db.rewardItem.create({
          data: {
            editionId: edition.id,
            name: `Brinde ${index + 1}`,
            total: participantsCount,
            order: index,
            confirmationMinutes: 1_440,
            redemptionStartsAt: new Date(now - 60_000),
            rules: {
              create: {
                editionId: edition.id,
                minCheckins: Math.min(eventDays, index + 1),
              },
            },
          },
        }),
      ),
    );
    await db.participant.createMany({
      data: Array.from({ length: participantsCount }, (_, index) => ({
        editionId: edition.id,
        name: `Carga ${String(index + 1).padStart(3, "0")}`,
        firstName: "Carga",
        normalizedName: "carga",
        ra: `EV${now}${String(index + 1).padStart(3, "0")}`,
        semester: (index % 10) + 1,
      })),
    });
    const participants = await db.participant.findMany({
      where: { editionId: edition.id },
      orderBy: { ra: "asc" },
      select: { id: true, ra: true },
    });
    const adminLogin = await login({
      kind: "admin",
      email: "admin@jornadas.dev",
      password: "Jornada@2026!",
    });
    if (!adminLogin.response.ok)
      throw new Error(`Login do operador falhou: ${adminLogin.text}`);

    const summaries: ReturnType<typeof summarize>[] = [];
    const initialLogin = await participantLogins(edition.id, participants, 0);
    summaries.push(initialLogin.summary);
    let sessions = initialLogin.results;

    for (const activity of activities) {
      summaries.push(
        await burst(
          `Pré-evento: 250 inscrições em ${activity.title}`,
          sessions.map(
            (item) => () =>
              action(
                item.cookie,
                "participant",
                edition.id,
                "enrollment.create",
                { activityId: activity.id },
              ),
          ),
        ),
      );
      summaries.push(
        await burst(
          `Pré-evento: atualização após inscrição em ${activity.title}`,
          sessions.map(
            (item) => () => state(item.cookie, "participant", edition.id),
          ),
        ),
      );
    }

    for (let day = 1; day <= eventDays; day++) {
      const currentActivity = activities[day - 1];
      await db.activity.update({
        where: { id: currentActivity.id },
        data: {
          startAt: new Date(Date.now() - 5 * 60_000),
          endAt: new Date(Date.now() + 20 * 60 * 60_000),
        },
      });
      const dailyLogin = await participantLogins(edition.id, participants, day);
      sessions = dailyLogin.results;
      summaries.push(dailyLogin.summary);
      summaries.push(
        await burst(
          `Dia ${day}: abertura do aplicativo`,
          sessions.map(
            (item) => () => state(item.cookie, "participant", edition.id),
          ),
        ),
      );

      summaries.push(
        await burst(`Dia ${day}: aviso da organização`, [
          () =>
            action(
              adminLogin.cookie,
              "admin",
              edition.id,
              "notification.send",
              {
                audience: "all",
                title: `Programação do dia ${day}`,
                message: "Atividades disponíveis no aplicativo.",
              },
            ),
        ]),
      );
      summaries.push(
        await burst(`Dia ${day}: atualização administrativa após aviso`, [
          () => state(adminLogin.cookie, "admin", edition.id),
        ]),
      );
      const notification = await db.notification.findFirstOrThrow({
        where: { editionId: edition.id },
        orderBy: { createdAt: "desc" },
      });
      summaries.push(
        await burst(
          `Dia ${day}: leitura do aviso`,
          sessions.map(
            (item) => () =>
              action(
                item.cookie,
                "participant",
                edition.id,
                "notification.read",
                { id: notification.id },
              ),
          ),
        ),
      );
      summaries.push(
        await burst(
          `Dia ${day}: atualização após leitura`,
          sessions.map(
            (item) => () => state(item.cookie, "participant", edition.id),
          ),
        ),
      );

      summaries.push(
        await burst(
          `Dia ${day}: 250 check-ins`,
          participants.map(
            (participant) => () =>
              action(
                adminLogin.cookie,
                "admin",
                edition.id,
                "attendance.checkin",
                { activityId: currentActivity.id, ra: participant.ra },
              ),
          ),
        ),
      );
      summaries.push(
        await burst(
          `Dia ${day}: atualização administrativa após check-in`,
          participants.map(
            () => () => state(adminLogin.cookie, "admin", edition.id),
          ),
        ),
      );
      summaries.push(
        await burst(
          `Dia ${day}: atualização manual dos participantes`,
          sessions.map(
            (item) => () => state(item.cookie, "participant", edition.id),
          ),
        ),
      );
    }

    await db.edition.update({
      where: { id: edition.id },
      data: { endAt: new Date(Date.now() - 60_000) },
    });
    summaries.push(
      await burst(
        "Pós-evento: emissão de 250 certificados",
        participants.map(
          (participant) => () =>
            action(
              adminLogin.cookie,
              "admin",
              edition.id,
              "certificate.issue",
              {
                participantId: participant.id,
                activityId: activities[eventDays - 1].id,
              },
            ),
        ),
      ),
    );
    summaries.push(
      await burst(
        "Pós-evento: atualização administrativa após certificados",
        participants.map(
          () => () => state(adminLogin.cookie, "admin", edition.id),
        ),
      ),
    );
    const certificates = await db.certificate.findMany({
      where: { editionId: edition.id },
      orderBy: { participantId: "asc" },
    });
    const cookieByParticipant = new Map(
      sessions.map((item) => [item.participant.id, item.cookie]),
    );
    summaries.push(
      await burst(
        "Pós-evento: download de 250 certificados",
        certificates.map(
          (certificate) => () =>
            fetch(`${baseUrl}/api/certificates/${certificate.id}`, {
              headers: {
                Cookie:
                  cookieByParticipant.get(certificate.participantId) || "",
              },
            }),
        ),
      ),
    );

    const finalReward = rewards[rewards.length - 1];
    summaries.push(
      await burst("Pós-evento: sorteio e reservas de brindes", [
        () =>
          action(adminLogin.cookie, "admin", edition.id, "draw.execute", {
            rewardId: finalReward.id,
          }),
      ]),
    );
    summaries.push(
      await burst("Pós-evento: atualização administrativa após sorteio", [
        () => state(adminLogin.cookie, "admin", edition.id),
      ]),
    );
    const reservations = await db.rewardReservation.findMany({
      where: { editionId: edition.id, rewardId: finalReward.id },
      orderBy: { participantId: "asc" },
    });
    summaries.push(
      await burst(
        "Pós-evento: confirmação de 250 brindes",
        reservations.map(
          (reservation) => () =>
            action(
              cookieByParticipant.get(reservation.participantId) || "",
              "participant",
              edition.id,
              "reservation.confirm",
              { reservationId: reservation.id },
            ),
        ),
      ),
    );
    summaries.push(
      await burst(
        "Pós-evento: atualização após confirmação de brinde",
        reservations.map(
          (reservation) => () =>
            state(
              cookieByParticipant.get(reservation.participantId) || "",
              "participant",
              edition.id,
            ),
        ),
      ),
    );
    summaries.push(
      await burst(
        "Dia da retirada: entrega de 250 brindes",
        reservations.map(
          (reservation) => () =>
            action(adminLogin.cookie, "admin", edition.id, "delivery.create", {
              reservationIds: [reservation.id],
            }),
        ),
      ),
    );
    summaries.push(
      await burst(
        "Dia da retirada: atualização administrativa",
        reservations.map(
          () => () => state(adminLogin.cookie, "admin", edition.id),
        ),
      ),
    );
    summaries.push(
      await burst(
        "Perfil: personalização de 250 participantes",
        sessions.map(
          (item) => () =>
            action(
              item.cookie,
              "participant",
              edition.id,
              "participant.photo",
              { photoUrl: "/assets/brand/logo-jornadas.png" },
            ),
        ),
      ),
    );
    summaries.push(
      await burst(
        "Perfil: atualização após personalização",
        sessions.map(
          (item) => () => state(item.cookie, "participant", edition.id),
        ),
      ),
    );

    const [
      attendanceCount,
      stampCount,
      certificateCount,
      deliveryCount,
      eligibilityCount,
      sessionCount,
    ] = await Promise.all([
      db.attendance.count({
        where: { editionId: edition.id, checkinAt: { not: null } },
      }),
      db.passportStamp.count({
        where: { editionId: edition.id, status: "VALID" },
      }),
      db.certificate.count({
        where: { editionId: edition.id, status: "RELEASED" },
      }),
      db.rewardDelivery.count({
        where: { editionId: edition.id, status: "DELIVERED" },
      }),
      db.rewardEligibility.count({ where: { editionId: edition.id } }),
      db.session.count({ where: { participant: { editionId: edition.id } } }),
    ]);
    const measuredRequests = summaries.reduce(
      (total, item) => total + item.requests,
      0,
    );
    const failedRequests = summaries.reduce(
      (total, item) => total + item.failed,
      0,
    );
    const adminMutations =
      eventDays +
      participantsCount * eventDays +
      participantsCount +
      1 +
      participantsCount;
    const projectedWithAdminEvents = measuredRequests + adminMutations;
    const report = {
      generatedAt: new Date().toISOString(),
      target: baseUrl,
      environment: "Next.js DEV + SQLite local",
      scenario: {
        days: eventDays,
        participants: participantsCount,
        activities: activities.length,
        rewards: rewards.length,
        participantAutomaticRefreshInterval: null,
        dailyUse:
          "login, abertura do app, aviso, leitura, check-in e atualização manual",
        postEventUse:
          "certificados, sorteio, confirmação, retirada e personalização de perfil",
      },
      totals: {
        measuredRequests,
        failedRequests,
        successRate: Number(
          (
            ((measuredRequests - failedRequests) / measuredRequests) *
            100
          ).toFixed(2),
        ),
        transferredMb: Number(
          summaries
            .reduce((total, item) => total + item.transferredMb, 0)
            .toFixed(2),
        ),
        projectedAdminEventRefreshes: adminMutations,
        projectedRequestsIncludingAdminEvents: projectedWithAdminEvents,
        shareOfWorkersFreeDailyLimitAcrossFourDaysPercent: Number(
          ((projectedWithAdminEvents / (100_000 * eventDays)) * 100).toFixed(2),
        ),
      },
      integrity: {
        expectedAttendances: participantsCount * eventDays,
        attendanceCount,
        expectedStamps: participantsCount * eventDays,
        stampCount,
        expectedCertificates: participantsCount,
        certificateCount,
        expectedDeliveries: participantsCount,
        deliveryCount,
        expectedEligibilities: participantsCount * rewardsCount,
        eligibilityCount,
        participantSessions: sessionCount,
      },
      results: summaries,
    };
    await mkdir("work", { recursive: true });
    const output = `work/event-load-test-${eventDays}-days-${participantsCount}-${now}.json`;
    await writeFile(output, JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({ ...report, results: undefined, output }, null, 2),
    );
    if (
      failedRequests > 0 ||
      attendanceCount !== participantsCount * eventDays ||
      stampCount !== participantsCount * eventDays ||
      certificateCount !== participantsCount ||
      deliveryCount !== participantsCount ||
      eligibilityCount !== participantsCount * rewardsCount
    )
      process.exitCode = 1;
  } finally {
    await db.edition.update({
      where: { id: edition.id },
      data: { status: "ARCHIVED" },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
