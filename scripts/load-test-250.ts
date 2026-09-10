import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.LOAD_TEST_URL || "http://127.0.0.1:3000";
const participantsCount = Number(process.env.LOAD_TEST_PARTICIPANTS || 250);
const headers = { Origin: baseUrl, "Content-Type": "application/json" };

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
  const statuses = samples.reduce<Record<string, number>>((result, sample) => {
    result[sample.status] = (result[sample.status] || 0) + 1;
    return result;
  }, {});
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
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    p99Ms: Math.round(percentile(durations, 0.99)),
    maxMs: Math.round(Math.max(0, ...durations)),
    transferredMb: Number(
      (
        samples.reduce((total, item) => total + item.bytes, 0) / 1_000_000
      ).toFixed(2),
    ),
    statuses,
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
  return {
    summary: summarize(label, samples, performance.now() - started),
    samples,
  };
}

async function login(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0] || "";
  return { response, text, cookie };
}

async function main() {
  const health = await fetch(`${baseUrl}/api/state?scope=public`);
  if (!health.ok) throw new Error(`Servidor indisponível em ${baseUrl}.`);

  const now = Date.now();
  const edition = await db.edition.create({
    data: {
      name: `Carga DEV ${participantsCount} — ${now}`,
      slug: `carga-dev-${participantsCount}-${now}`,
      year: 2026,
      startAt: new Date(now - 60 * 60_000),
      endAt: new Date(now + 3 * 60 * 60_000),
      status: "ACTIVE",
      maxActivities: 1,
      maxCheckins: 1,
      normalMinutes: 60,
      noShowMinutes: 60,
      lateMinutes: 60,
      checkoutMinutes: 60,
    },
  });

  try {
    const category = await db.activityCategory.create({
      data: {
        editionId: edition.id,
        name: "Teste de carga",
        slug: "teste-de-carga",
        generatesStamp: true,
      },
    });
    const activity = await db.activity.create({
      data: {
        editionId: edition.id,
        categoryId: category.id,
        title: "Check-in simultâneo",
        startAt: new Date(now - 5 * 60_000),
        endAt: new Date(now + 60 * 60_000),
        capacity: participantsCount,
        status: "OPEN",
      },
    });
    await db.participant.createMany({
      data: Array.from({ length: participantsCount }, (_, index) => ({
        editionId: edition.id,
        name: `Carga ${String(index + 1).padStart(3, "0")}`,
        firstName: "Carga",
        normalizedName: "carga",
        ra: `LT${now}${String(index + 1).padStart(3, "0")}`,
        semester: 1,
      })),
    });
    const participants = await db.participant.findMany({
      where: { editionId: edition.id },
      orderBy: { ra: "asc" },
    });
    await db.enrollment.createMany({
      data: participants.map((participant) => ({
        editionId: edition.id,
        participantId: participant.id,
        activityId: activity.id,
        status: "ACTIVE",
        source: "LOAD_TEST",
      })),
    });

    const loginStarted = performance.now();
    const loginResults = await Promise.all(
      participants.map(async (participant) => {
        const started = performance.now();
        try {
          const result = await login({
            kind: "participant",
            editionId: edition.id,
            firstName: "Carga",
            ra: participant.ra,
          });
          return {
            participant,
            cookie: result.cookie,
            sample: {
              ok: result.response.ok,
              status: result.response.status,
              durationMs: performance.now() - started,
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
              durationMs: performance.now() - started,
              bytes: 0,
              error: error instanceof Error ? error.message : String(error),
            } satisfies Sample,
          };
        }
      }),
    );
    const loginSummary = summarize(
      "250 logins simultâneos",
      loginResults.map((item) => item.sample),
      performance.now() - loginStarted,
    );
    const authenticated = loginResults.filter((item) => item.cookie);

    const firstState = await burst(
      "250 carregamentos simultâneos do aplicativo",
      authenticated.map(
        (item) => () =>
          fetch(
            `${baseUrl}/api/state?scope=participant&editionId=${encodeURIComponent(edition.id)}`,
            { headers: { Cookie: item.cookie } },
          ),
      ),
    );

    const warmState = await burst(
      "250 atualizações simultâneas com servidor aquecido",
      authenticated.map(
        (item) => () =>
          fetch(
            `${baseUrl}/api/state?scope=participant&editionId=${encodeURIComponent(edition.id)}`,
            { headers: { Cookie: item.cookie } },
          ),
      ),
    );

    const adminLogin = await login({
      kind: "admin",
      email: "operador@jornadas.dev",
      password: "Jornada@2026!",
    });
    if (!adminLogin.response.ok)
      throw new Error(`Login do operador falhou: ${adminLogin.text}`);

    const checkins = await burst(
      "250 check-ins administrativos simultâneos",
      participants.map(
        (participant) => () =>
          fetch(`${baseUrl}/api/action`, {
            method: "POST",
            headers: { ...headers, Cookie: adminLogin.cookie },
            body: JSON.stringify({
              action: "attendance.checkin",
              editionId: edition.id,
              activityId: activity.id,
              ra: participant.ra,
            }),
          }),
      ),
    );

    const attendanceCount = await db.attendance.count({
      where: { editionId: edition.id, checkinAt: { not: null } },
    });
    const stampCount = await db.passportStamp.count({
      where: { editionId: edition.id, status: "VALID" },
    });
    const report = {
      generatedAt: new Date().toISOString(),
      target: baseUrl,
      participants: participantsCount,
      environment: "Next.js DEV + SQLite local",
      results: [
        loginSummary,
        firstState.summary,
        warmState.summary,
        checkins.summary,
      ],
      integrity: { attendanceCount, stampCount },
      projection: {
        automaticParticipantRefreshRequestsPerHour: 0,
        freeWorkersRequestsPerDay: 100_000,
        theoreticalFullRefreshBurstsPerDay: Math.floor(
          100_000 / participantsCount,
        ),
        note: "Estimativa isolada: não inclui login, ações administrativas ou outras rotas.",
      },
    };
    await mkdir("work", { recursive: true });
    const output = `work/load-test-${participantsCount}-${now}.json`;
    await writeFile(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, output }, null, 2));
    if (
      report.results.some((result) => result.failed > 0) ||
      attendanceCount !== participantsCount ||
      stampCount !== participantsCount
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
