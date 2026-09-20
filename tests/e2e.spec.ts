import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import ExcelJS from "exceljs";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@jornadas.dev";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Jornada@2026!";
const operatorEmail = process.env.E2E_OPERATOR_EMAIL ?? "operador@jornadas.dev";
const operatorPassword = process.env.E2E_OPERATOR_PASSWORD ?? "Jornada@2026!";
let sequence = 0;

type Row = { id: string; [key: string]: unknown };
type State = {
  edition: Row;
  editions: Row[];
  activities: Row[];
  categories: Row[];
  participants: Row[];
  enrollments: Row[];
  waitlist: Row[];
  attendances: Row[];
  stamps: Row[];
  rewards: Row[];
  rules: Row[];
  draws: Row[];
  reservations: Row[];
  deliveries: Row[];
  certificates: Row[];
  audit: Row[];
};
type Participant = { id: string; firstName: string; name: string; ra: string };
type Fixture = {
  admin: APIRequestContext;
  editionId: string;
  editionName: string;
  categoryId: string;
  participants: Participant[];
  clients: APIRequestContext[];
};

async function client(): Promise<APIRequestContext> {
  return request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
}

async function authenticateAdmin(operator = false): Promise<APIRequestContext> {
  const api = await client();
  const response = await api.post("/api/auth", {
    data: {
      kind: "admin",
      email: operator ? operatorEmail : adminEmail,
      password: operator ? operatorPassword : adminPassword,
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  return api;
}

async function action(
  api: APIRequestContext,
  editionId: string,
  actionName: string,
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const importConfirm = actionName === "import.confirm";
  const response = await api.post(
    importConfirm ? "/api/import/confirm" : "/api/action",
    {
      data: importConfirm
        ? { editionId, jobId: data.jobId }
        : { action: actionName, editionId, ...data },
    },
  );
  expect(
    response.ok(),
    `${actionName}: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  return response.json();
}

async function save(
  api: APIRequestContext,
  editionId: string,
  entity: string,
  data: Record<string, unknown>,
): Promise<string> {
  const response = await action(api, editionId, "entity.save", {
    entity,
    data,
  });
  expect(typeof response.id).toBe("string");
  return response.id as string;
}

async function state(
  api: APIRequestContext,
  editionId: string,
  scope = "admin",
): Promise<State> {
  const response = await api.get(
    `/api/state?scope=${scope}&editionId=${encodeURIComponent(editionId)}`,
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function arenaState(
  api: APIRequestContext,
  editionId: string,
  scope: "admin" | "participant" = "participant",
): Promise<any> {
  const response = await api.get(
    `/api/arena?scope=${scope}&editionId=${encodeURIComponent(editionId)}`,
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function makeFixture(): Promise<Fixture> {
  const admin = await authenticateAdmin();
  const unique = `${Date.now()}-${++sequence}`;
  const editionName = `QA DEV Jornada ${unique}`;
  const editionId = await save(admin, "", "edition", {
    name: editionName,
    slug: `qa-dev-${unique}`,
    year: new Date().getFullYear(),
    slogan: "Edição isolada para testes automáticos",
    description: "Dados QA DEV; não utilizar em operação real.",
    startAt: new Date(Date.now() - 86_400_000).toISOString(),
    endAt: new Date(Date.now() + 86_400_000).toISOString(),
    timezone: "America/Manaus",
    status: "ACTIVE",
    maxActivities: 5,
    maxCheckins: 5,
    normalMinutes: 15,
    noShowMinutes: 20,
    lateMinutes: 25,
    checkoutMinutes: 24,
    allowMultipleRewards: true,
  });
  const categoryId = await save(admin, editionId, "category", {
    name: "Categoria QA DEV",
    slug: `categoria-qa-${unique}`,
    color: "#174d55",
    requiresEnrollment: true,
    requiresCheckin: true,
    requiresCheckout: false,
    generatesStamp: true,
    generatesCertificate: true,
    active: true,
    stampUrl: "/assets/stamps/selo-1.png",
  });
  const participants: Participant[] = [];
  for (const [index, firstName] of ["Lívia", "Bruno", "Carla"].entries()) {
    const ra = `${unique.replaceAll("-", "")}${index}`;
    const name = `${firstName} QA DEV ${unique}`;
    const id = await save(admin, editionId, "participant", {
      fullName: name,
      ra,
      semester: "8",
      active: true,
    });
    participants.push({ id, firstName, name, ra });
  }
  return {
    admin,
    editionId,
    editionName,
    categoryId,
    participants,
    clients: [admin],
  };
}

async function participantClient(
  fixture: Fixture,
  index = 0,
): Promise<APIRequestContext> {
  const api = await client();
  fixture.clients.push(api);
  const participant = fixture.participants[index];
  const response = await api.post("/api/auth", {
    data: {
      kind: "participant",
      editionId: fixture.editionId,
      firstName: ` ${participant.firstName.toUpperCase()} `,
      ra: participant.ra,
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  return api;
}

async function activity(
  fixture: Fixture,
  values: Record<string, unknown> = {},
): Promise<string> {
  return save(fixture.admin, fixture.editionId, "activity", {
    title: `Atividade QA DEV ${++sequence}`,
    description: "Atividade exclusiva dos testes.",
    categoryId: fixture.categoryId,
    startAt: new Date(Date.now() - 120_000).toISOString(),
    endAt: new Date(Date.now() + 3_600_000).toISOString(),
    block: "QA",
    room: "01",
    capacity: 5,
    enrollmentOpen: true,
    workload: 1,
    status: "OPEN",
    allowWaitlist: true,
    ...values,
  });
}

async function finish(fixture: Fixture): Promise<void> {
  // O histórico QA é preservado em edição arquivada; a edição DEV principal não é alterada.
  try {
    await action(fixture.admin, fixture.editionId, "entity.save", {
      entity: "edition",
      data: { id: fixture.editionId, status: "ARCHIVED" },
    });
  } finally {
    await Promise.all(fixture.clients.map((api) => api.dispose()));
  }
}

async function expectFailure(
  api: APIRequestContext,
  editionId: string,
  actionName: string,
  data: Record<string, unknown>,
  statuses = [400, 403, 409, 422],
): Promise<void> {
  const response = await api.post("/api/action", {
    data: { action: actionName, editionId, ...data },
  });
  expect(statuses, await response.text()).toContain(response.status());
}

async function selectAdminEdition(page: Page, fixture: Fixture): Promise<void> {
  await page
    .getByLabel("Edição ativa", { exact: true })
    .selectOption(fixture.editionId);
  await expect(page.getByLabel("Edição ativa", { exact: true })).toHaveValue(
    fixture.editionId,
  );
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
}

test("@api administração: exclui atividade sem histórico e edita brinde sem perder estoque comprometido", async () => {
  const fixture = await makeFixture();
  try {
    const unusedActivity = await activity(fixture, {
      title: "Palestra removível QA DEV",
    });
    await action(fixture.admin, fixture.editionId, "activity.delete", {
      activityId: unusedActivity,
      reason: "Correção da programação de teste",
    });
    expect(
      (await state(fixture.admin, fixture.editionId)).activities.some(
        (item) => item.id === unusedActivity,
      ),
    ).toBeFalsy();

    const enrolledActivity = await activity(fixture, {
      title: "Palestra com inscrição QA DEV",
    });
    const participant = await participantClient(fixture);
    await action(participant, fixture.editionId, "enrollment.create", {
      activityId: enrolledActivity,
    });
    const blocked = await fixture.admin.post("/api/action", {
      data: {
        action: "activity.delete",
        editionId: fixture.editionId,
        activityId: enrolledActivity,
        reason: "Correção da programação de teste",
      },
    });
    expect(blocked.status(), await blocked.text()).toBe(409);
    expect(
      (await state(fixture.admin, fixture.editionId)).activities.some(
        (item) => item.id === enrolledActivity,
      ),
    ).toBeTruthy();

    const rewardId = await save(fixture.admin, fixture.editionId, "reward", {
      name: "Brinde QA DEV",
      description: "Primeira descrição",
      imageUrl: "/assets/stamps/selo-5.webp",
      total: 2,
      confirmationMinutes: 30,
      active: true,
    });
    await save(fixture.admin, fixture.editionId, "reward", {
      id: rewardId,
      name: "Brinde atualizado QA DEV",
      description: "Descrição editada",
      imageUrl: "/assets/stamps/selo-6.webp",
      stockTotal: 3,
      confirmationMinutes: 45,
      active: false,
    });
    expect(
      (await state(fixture.admin, fixture.editionId)).rewards.find(
        (item) => item.id === rewardId,
      ),
    ).toMatchObject({
      name: "Brinde atualizado QA DEV",
      description: "Descrição editada",
      imageUrl: "/assets/stamps/selo-6.webp",
      stockTotal: 3,
      confirmationMinutes: 45,
      active: false,
    });
    await save(fixture.admin, fixture.editionId, "reward", {
      id: rewardId,
      name: "Brinde atualizado QA DEV",
      imageUrl: "",
    });
    expect(
      (await state(fixture.admin, fixture.editionId)).rewards.find(
        (item) => item.id === rewardId,
      )?.imageUrl,
    ).toBeNull();
    await expectFailure(fixture.admin, fixture.editionId, "entity.save", {
      entity: "reward",
      data: { id: rewardId, name: "Estoque inválido", stockTotal: -1 },
    });
  } finally {
    await finish(fixture);
  }
});

test("@api jornada integrada: cadastro, conflito, presença, carimbo, sorteio, confirmação, entrega e Excel", async () => {
  const fixture = await makeFixture();
  try {
    const participantApis = [
      await participantClient(fixture, 0),
      await participantClient(fixture, 1),
    ];
    const operator = await authenticateAdmin(true);
    fixture.clients.push(operator);
    const current = await activity(fixture, { title: "Clínica QA DEV" });
    const overlapping = await activity(fixture, { title: "Conflito QA DEV" });
    for (const api of participantApis) {
      await action(api, fixture.editionId, "enrollment.create", {
        activityId: current,
      });
    }
    await expectFailure(
      participantApis[0],
      fixture.editionId,
      "enrollment.create",
      { activityId: overlapping },
    );
    for (const participant of fixture.participants.slice(0, 2)) {
      await action(operator, fixture.editionId, "attendance.checkin", {
        activityId: current,
        ra: participant.ra,
      });
    }
    const ownState = await state(
      participantApis[0],
      fixture.editionId,
      "participant",
    );
    expect(
      ownState.attendances.some(
        (item) => item.activityId === current && item.checkinAt,
      ),
    ).toBeTruthy();
    expect(
      ownState.stamps.filter((item) => item.activityId === current),
    ).toHaveLength(1);

    const rewardId = await save(fixture.admin, fixture.editionId, "reward", {
      name: "Garrafa QA DEV",
      description: "Uma unidade para dois elegíveis.",
      total: 1,
      active: true,
      confirmationMinutes: 30,
      redemptionStartsAt: "2099-09-24T04:00:00.000Z",
    });
    await save(fixture.admin, fixture.editionId, "rule", {
      rewardId,
      minCheckins: 1,
    });
    await action(fixture.admin, fixture.editionId, "draw.execute", {
      rewardId,
    });
    const drawn = await state(fixture.admin, fixture.editionId);
    expect(
      drawn.draws.filter((item) => item.rewardId === rewardId),
    ).toHaveLength(1);
    const reservations = drawn.reservations.filter(
      (item) =>
        item.rewardId === rewardId && item.status === "AWAITING_CONFIRMATION",
    );
    expect(reservations).toHaveLength(1);
    const reservation = reservations[0];
    const winnerIndex = fixture.participants.findIndex(
      (item) => item.id === reservation.participantId,
    );
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(winnerIndex).toBeLessThan(2);
    await action(
      participantApis[winnerIndex],
      fixture.editionId,
      "reservation.confirm",
      { reservationId: reservation.id },
    );
    await expectFailure(fixture.admin, fixture.editionId, "entity.save", {
      entity: "reward",
      data: { id: rewardId, name: "Estoque indevido", stockTotal: 0 },
    });
    await expectFailure(fixture.admin, fixture.editionId, "delivery.create", {
      reservationIds: [reservation.id],
    });
    await save(fixture.admin, fixture.editionId, "reward", {
      id: rewardId,
      name: "Garrafa QA DEV",
      description: "Uma unidade para dois elegíveis.",
      total: 1,
      active: true,
      confirmationMinutes: 30,
      redemptionStartsAt: "2020-09-24T04:00:00.000Z",
    });
    await action(fixture.admin, fixture.editionId, "delivery.create", {
      reservationIds: [reservation.id],
    });
    const delivered = await state(fixture.admin, fixture.editionId);
    const reward = delivered.rewards.find((item) => item.id === rewardId);
    expect(reward).toMatchObject({ available: 0, reserved: 0, delivered: 1 });
    expect(
      delivered.deliveries.filter((item) => item.status === "DELIVERED"),
    ).toHaveLength(1);
    expect(delivered.audit.length).toBeGreaterThan(0);

    const response = await fixture.admin.get(
      `/api/export?editionId=${fixture.editionId}`,
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("spreadsheetml");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await response.body()) as any);
    const sheets = workbook.worksheets.map((sheet) => sheet.name);
    expect(sheets).toEqual(
      expect.arrayContaining([
        "Participantes",
        "Atividades",
        "Presenças",
        "Passaportes",
        "Brindes",
        "Sorteios",
        "Entregas",
        "Estoque Final",
      ]),
    );
    expect(workbook.worksheets).toHaveLength(14);
    const rows = workbook.getWorksheet("Participantes")?.getSheetValues();
    expect(JSON.stringify(rows)).toContain(fixture.participants[0].ra);
  } finally {
    await finish(fixture);
  }
});

test("@api privacidade, isolamento de edição, RA duplicado, RBAC e proteção de origem", async () => {
  const fixture = await makeFixture();
  const other = await makeFixture();
  try {
    const participant = await participantClient(fixture);
    const operator = await authenticateAdmin(true);
    const publicApi = await client();
    fixture.clients.push(operator, publicApi);
    await expectFailure(fixture.admin, fixture.editionId, "entity.save", {
      entity: "participant",
      data: {
        name: "Duplicado QA DEV",
        ra: fixture.participants[0].ra,
        semester: "8",
      },
    });
    const wrongLogin = await publicApi.post("/api/auth", {
      data: {
        kind: "participant",
        editionId: fixture.editionId,
        firstName: "Nome errado",
        ra: fixture.participants[0].ra,
      },
    });
    expect([400, 401, 403]).toContain(wrongLogin.status());
    const publicResponse = await publicApi.get(
      `/api/state?scope=public&editionId=${fixture.editionId}`,
    );
    expect(publicResponse.ok()).toBeTruthy();
    const publicText = await publicResponse.text();
    for (const person of fixture.participants) {
      expect(publicText).not.toContain(person.ra);
      expect(publicText).not.toContain(person.name);
    }
    const own = await state(participant, fixture.editionId, "participant");
    expect(own.participants.map((item) => item.id)).toEqual([
      fixture.participants[0].id,
    ]);
    const otherEdition = await participant.get(
      `/api/state?scope=participant&editionId=${other.editionId}`,
    );
    if (otherEdition.ok()) {
      expect(await otherEdition.text()).not.toContain(other.participants[0].ra);
    } else {
      expect([401, 403, 404]).toContain(otherEdition.status());
    }
    await expectFailure(
      participant,
      fixture.editionId,
      "entity.save",
      {
        entity: "participant",
        data: { id: fixture.participants[0].id, name: "Alteração proibida" },
      },
      [401, 403],
    );
    await expectFailure(
      operator,
      fixture.editionId,
      "entity.save",
      { entity: "reward", data: { name: "Proibido", total: 10 } },
      [401, 403],
    );
    const forbiddenExport = await operator.get(
      `/api/export?editionId=${fixture.editionId}`,
    );
    expect([401, 403]).toContain(forbiddenExport.status());
    const otherActivity = await activity(other);
    await expectFailure(
      participant,
      fixture.editionId,
      "enrollment.create",
      { activityId: otherActivity },
      [400, 403, 404, 409],
    );
    const csrf = await fixture.admin.post("/api/action", {
      headers: { Origin: "https://untrusted.invalid" },
      data: {
        action: "entity.save",
        editionId: fixture.editionId,
        entity: "participant",
        data: { name: "Ataque QA", ra: "0000000", semester: "8" },
      },
    });
    expect(csrf.status()).toBe(403);
  } finally {
    await finish(fixture);
    await finish(other);
  }
});

test("@api última vaga concorrente e troca com rollback preservam ocupação", async () => {
  const fixture = await makeFixture();
  try {
    const first = await participantClient(fixture, 0);
    const second = await participantClient(fixture, 1);
    const oneSeat = await activity(fixture, { capacity: 1 });
    const results = await Promise.all(
      [first, second].map((api) =>
        api.post("/api/action", {
          data: {
            action: "enrollment.create",
            editionId: fixture.editionId,
            activityId: oneSeat,
          },
        }),
      ),
    );
    expect(
      results.filter((result) => result.ok()).length,
    ).toBeGreaterThanOrEqual(1);
    const afterRace = await state(fixture.admin, fixture.editionId);
    const active = afterRace.enrollments.filter(
      (item) => item.activityId === oneSeat && item.status === "ACTIVE",
    );
    expect(active).toHaveLength(1);
    expect(
      afterRace.activities.find((item) => item.id === oneSeat)?.enrolledCount,
    ).toBe(1);
    const winner = fixture.participants.findIndex(
      (item) => item.id === active[0].participantId,
    );
    const winnerApi = winner === 0 ? first : second;
    const fullDestination = await activity(fixture, {
      capacity: 1,
      startAt: new Date(Date.now() + 7_200_000).toISOString(),
      endAt: new Date(Date.now() + 10_800_000).toISOString(),
    });
    const third = await participantClient(fixture, 2);
    await action(third, fixture.editionId, "enrollment.create", {
      activityId: fullDestination,
    });
    await expectFailure(winnerApi, fixture.editionId, "enrollment.swap", {
      enrollmentId: active[0].id,
      activityId: fullDestination,
    });
    const afterFailure = await state(fixture.admin, fixture.editionId);
    expect(
      afterFailure.enrollments.find((item) => item.id === active[0].id)?.status,
    ).toBe("ACTIVE");
    const availableDestination = await activity(fixture, {
      capacity: 1,
      startAt: new Date(Date.now() + 14_400_000).toISOString(),
      endAt: new Date(Date.now() + 18_000_000).toISOString(),
    });
    await action(winnerApi, fixture.editionId, "enrollment.swap", {
      enrollmentId: active[0].id,
      activityId: availableDestination,
    });
    const afterSwap = await state(fixture.admin, fixture.editionId);
    expect(
      afterSwap.enrollments.find((item) => item.id === active[0].id)?.status,
    ).toBe("CANCELLED");
    expect(
      afterSwap.enrollments.filter(
        (item) =>
          item.participantId === active[0].participantId &&
          item.activityId === availableDestination &&
          item.status === "ACTIVE",
      ),
    ).toHaveLength(1);
  } finally {
    await finish(fixture);
  }
});

test("@api check-in tardio, geração única de carimbo e liberação administrativa do certificado", async () => {
  const fixture = await makeFixture();
  try {
    const participant = await participantClient(fixture);
    const late = await activity(fixture, {
      startAt: new Date(Date.now() - 16 * 60_000).toISOString(),
    });
    await action(participant, fixture.editionId, "enrollment.create", {
      activityId: late,
    });
    await action(fixture.admin, fixture.editionId, "jobs.run");
    await action(fixture.admin, fixture.editionId, "attendance.checkin", {
      activityId: late,
      ra: fixture.participants[0].ra,
    });
    // Repetir uma confirmação não pode criar duas presenças/carimbos.
    await fixture.admin.post("/api/action", {
      data: {
        action: "attendance.checkin",
        editionId: fixture.editionId,
        activityId: late,
        ra: fixture.participants[0].ra,
      },
    });
    const checked = await state(fixture.admin, fixture.editionId);
    expect(
      checked.enrollments.find(
        (item) =>
          item.activityId === late &&
          item.participantId === fixture.participants[0].id,
      )?.lateEnrollment,
    ).toBe(true);
    expect(
      checked.attendances.filter(
        (item) =>
          item.activityId === late &&
          item.participantId === fixture.participants[0].id,
      ),
    ).toHaveLength(1);
    expect(
      checked.stamps.filter(
        (item) =>
          item.activityId === late &&
          item.participantId === fixture.participants[0].id,
      ),
    ).toHaveLength(1);
    const certificate = await action(
      fixture.admin,
      fixture.editionId,
      "certificate.issue",
      {
        participantId: fixture.participants[0].id,
        activityId: late,
      },
    );
    expect(certificate.status).toBe("RELEASED");
    const closed = await activity(fixture, {
      startAt: new Date(Date.now() - 26 * 60_000).toISOString(),
      endAt: new Date(Date.now() + 1_800_000).toISOString(),
    });
    const another = await participantClient(fixture, 1);
    await expectFailure(another, fixture.editionId, "enrollment.create", {
      activityId: closed,
    });
  } finally {
    await finish(fixture);
  }
});

test("@api última unidade e reversão de entrega não duplicam estoque", async () => {
  const fixture = await makeFixture();
  try {
    const participant = await participantClient(fixture);
    const current = await activity(fixture);
    await action(participant, fixture.editionId, "enrollment.create", {
      activityId: current,
    });
    await action(fixture.admin, fixture.editionId, "attendance.checkin", {
      activityId: current,
      ra: fixture.participants[0].ra,
    });
    const rewardId = await save(fixture.admin, fixture.editionId, "reward", {
      name: "Caneta QA DEV",
      total: 1,
      active: true,
      confirmationMinutes: 30,
    });
    await save(fixture.admin, fixture.editionId, "rule", {
      rewardId,
      minCheckins: 1,
    });
    await action(fixture.admin, fixture.editionId, "draw.execute", {
      rewardId,
    });
    const pending = await state(fixture.admin, fixture.editionId);
    const reservation = pending.reservations.find(
      (item) => item.rewardId === rewardId,
    );
    expect(reservation).toBeDefined();
    await action(participant, fixture.editionId, "reservation.confirm", {
      reservationId: reservation!.id,
    });
    const otherAdmin = await authenticateAdmin();
    fixture.clients.push(otherAdmin);
    await Promise.all(
      [fixture.admin, otherAdmin].map((api) =>
        api.post("/api/action", {
          data: {
            action: "delivery.create",
            editionId: fixture.editionId,
            reservationIds: [reservation!.id],
          },
        }),
      ),
    );
    const after = await state(fixture.admin, fixture.editionId);
    const deliveries = after.deliveries.filter(
      (item) => item.status === "DELIVERED",
    );
    expect(deliveries).toHaveLength(1);
    expect(after.rewards.find((item) => item.id === rewardId)).toMatchObject({
      available: 0,
      reserved: 0,
      delivered: 1,
    });
    await expectFailure(fixture.admin, fixture.editionId, "delivery.reverse", {
      deliveryId: deliveries[0].id,
      reason: "",
    });
    await action(fixture.admin, fixture.editionId, "delivery.reverse", {
      deliveryId: deliveries[0].id,
      reason: "Reversão QA DEV para verificar conservação do estoque",
    });
    await fixture.admin.post("/api/action", {
      data: {
        action: "delivery.reverse",
        editionId: fixture.editionId,
        deliveryId: deliveries[0].id,
        reason: "Repetição QA DEV",
      },
    });
    const reversed = await state(fixture.admin, fixture.editionId);
    const reward = reversed.rewards.find((item) => item.id === rewardId)!;
    expect(reward.delivered).toBe(0);
    expect(Number(reward.available) + Number(reward.reserved)).toBe(1);
    expect(
      reversed.deliveries.filter((item) => item.status === "REVERSED"),
    ).toHaveLength(1);
  } finally {
    await finish(fixture);
  }
});

test("@api fila FIFO libera no-show e promove a primeira pessoa dentro da janela tardia", async () => {
  const fixture = await makeFixture();
  try {
    const first = await participantClient(fixture, 0);
    const waiting = await participantClient(fixture, 1);
    const activityId = await activity(fixture, {
      title: "Fila FIFO QA DEV",
      capacity: 1,
      startAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    await action(first, fixture.editionId, "enrollment.create", { activityId });
    await action(waiting, fixture.editionId, "waitlist.join", { activityId });
    const before = await state(fixture.admin, fixture.editionId);
    const activityRow = before.activities.find(
      (item) => item.id === activityId,
    )!;
    await action(fixture.admin, fixture.editionId, "entity.save", {
      entity: "activity",
      data: {
        ...activityRow,
        id: activityId,
        startAt: new Date(Date.now() - 21 * 60_000).toISOString(),
        endAt: new Date(Date.now() + 39 * 60_000).toISOString(),
      },
    });
    await action(fixture.admin, fixture.editionId, "jobs.run");
    const after = await state(fixture.admin, fixture.editionId);
    expect(
      after.enrollments.find(
        (item) =>
          item.activityId === activityId &&
          item.participantId === fixture.participants[0].id,
      )?.status,
    ).toBe("NO_SHOW");
    expect(
      after.enrollments.find(
        (item) =>
          item.activityId === activityId &&
          item.participantId === fixture.participants[1].id,
      ),
    ).toMatchObject({
      status: "ACTIVE",
      lateEnrollment: true,
      source: "WAITLIST",
    });
    expect(
      after.waitlist.find(
        (item) => item.participantId === fixture.participants[1].id,
      )?.status,
    ).toBe("PROMOTED");
  } finally {
    await finish(fixture);
  }
});

test("@api importação CSV e XLSX apresenta prévia, rejeita duplicados e confirma válidos", async () => {
  const fixture = await makeFixture();
  try {
    const csvRa = `CSV${Date.now()}`;
    const csv = [
      "Nome completo;RA;Semestre",
      `Pessoa CSV QA DEV;${csvRa};7`,
      `Duplicado QA DEV;${fixture.participants[0].ra};8`,
      "Sem RA;;6",
    ].join("\n");
    const csvResponse = await fixture.admin.post("/api/import", {
      multipart: {
        editionId: fixture.editionId,
        file: {
          name: "participantes.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csv),
        },
      },
    });
    expect(csvResponse.ok(), await csvResponse.text()).toBeTruthy();
    const csvPreview = await csvResponse.json();
    expect(csvPreview).toMatchObject({
      valid: 1,
      invalid: 2,
      duplicates: 1,
      status: "PREVIEW",
    });
    await action(fixture.admin, fixture.editionId, "import.confirm", {
      jobId: csvPreview.id,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Participantes");
    const xlsxRa = `XLSX${Date.now()}`;
    sheet.addRows([
      ["Nome completo", "RA", "Semestre"],
      ["Pessoa XLSX QA DEV", xlsxRa, 5],
    ]);
    const xlsxBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const xlsxResponse = await fixture.admin.post("/api/import", {
      multipart: {
        editionId: fixture.editionId,
        file: {
          name: "participantes.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: xlsxBuffer,
        },
      },
    });
    expect(xlsxResponse.ok(), await xlsxResponse.text()).toBeTruthy();
    const xlsxPreview = await xlsxResponse.json();
    expect(xlsxPreview).toMatchObject({
      valid: 1,
      invalid: 0,
      status: "PREVIEW",
    });
    await action(fixture.admin, fixture.editionId, "import.confirm", {
      jobId: xlsxPreview.id,
    });
    const imported = await state(fixture.admin, fixture.editionId);
    expect(imported.participants.map((item) => item.ra)).toEqual(
      expect.arrayContaining([csvRa, xlsxRa]),
    );
  } finally {
    await finish(fixture);
  }
});

test("@api check-out libera certificado, validação pública e cancelamento de sorteio devolve estoque", async () => {
  const fixture = await makeFixture();
  try {
    const participant = await participantClient(fixture, 0);
    const initial = await state(fixture.admin, fixture.editionId);
    const category = initial.categories.find(
      (item) => item.id === fixture.categoryId,
    )!;
    await action(fixture.admin, fixture.editionId, "entity.save", {
      entity: "category",
      data: { ...category, id: fixture.categoryId, requiresCheckout: true },
    });
    const activityId = await activity(fixture, {
      title: "Palestra com certificado QA DEV",
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 23 * 60_000).toISOString(),
    });
    await action(participant, fixture.editionId, "enrollment.create", {
      activityId,
    });
    await action(fixture.admin, fixture.editionId, "attendance.checkin", {
      activityId,
      ra: fixture.participants[0].ra,
    });
    await action(fixture.admin, fixture.editionId, "attendance.checkout", {
      activityId,
      ra: fixture.participants[0].ra,
    });
    await action(fixture.admin, fixture.editionId, "entity.save", {
      entity: "edition",
      data: {
        id: fixture.editionId,
        endAt: new Date(Date.now() - 1000).toISOString(),
        status: "FINISHED",
      },
    });
    const issued = await action(
      fixture.admin,
      fixture.editionId,
      "certificate.issue",
      {
        participantId: fixture.participants[0].id,
        activityId,
      },
    );
    expect(typeof issued.code).toBe("string");
    const pdf = await fixture.admin.get(`/api/certificates/${issued.id}`);
    expect(pdf.ok(), await pdf.text()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
    const publicApi = await client();
    fixture.clients.push(publicApi);
    const validation = await publicApi.get(`/api/validate?code=${issued.code}`);
    expect(validation.ok(), await validation.text()).toBeTruthy();
    expect(await validation.json()).toMatchObject({ valid: true });

    const rewardId = await save(fixture.admin, fixture.editionId, "reward", {
      name: "Prêmio cancelável QA DEV",
      description: "Estoque deve retornar ao cancelar.",
      total: 1,
      active: true,
      confirmationMinutes: 30,
    });
    await save(fixture.admin, fixture.editionId, "rule", {
      rewardId,
      minCheckins: 1,
    });
    const draw = await action(
      fixture.admin,
      fixture.editionId,
      "draw.execute",
      { rewardId },
    );
    await action(fixture.admin, fixture.editionId, "draw.cancel", {
      drawId: draw.id,
      reason: "Sorteio de validação cancelado",
    });
    const cancelled = await state(fixture.admin, fixture.editionId);
    expect(cancelled.draws.find((item) => item.id === draw.id)).toMatchObject({
      status: "CANCELLED",
    });
    expect(
      cancelled.rewards.find((item) => item.id === rewardId),
    ).toMatchObject({ available: 1 });
  } finally {
    await finish(fixture);
  }
});

test("@api Farma Arena mantém XP, ranking, permissões e resgates consistentes", async () => {
  const fixture = await makeFixture();
  try {
    await save(fixture.admin, fixture.editionId, "arenaConfig", {
      enabled: true,
      rankingEnabled: true,
      xpReleaseMode: "MANUAL",
      combinePendingAwards: false,
    });
    const challengeId = await save(
      fixture.admin,
      fixture.editionId,
      "arenaChallenge",
      {
        title: "Cálculo Relâmpago QA DEV",
        description: "Desafio individual automatizado.",
        instructions: "Validar o resultado com a equipe.",
        xpReward: 125,
        mode: "INDIVIDUAL",
        active: true,
      },
    );
    const participant = await participantClient(fixture);
    const operator = await authenticateAdmin(true);
    fixture.clients.push(operator);

    await expectFailure(
      participant,
      fixture.editionId,
      "arena.challenge.complete",
      { challengeId, ra: fixture.participants[0].ra },
      [403],
    );

    const completion = await action(
      operator,
      fixture.editionId,
      "arena.challenge.complete",
      { challengeId, ra: fixture.participants[0].ra },
    );
    const awardId = (completion.awards as Array<{ id: string }>)[0].id;
    const completionId = (completion.completions as Array<{ id: string }>)[0]
      .id;

    const pending = await arenaState(
      participant,
      fixture.editionId,
      "participant",
    );
    expect(pending).toMatchObject({ myXpTotal: 0, myXpAvailable: 0 });
    expect(pending.awards).toContainEqual(
      expect.objectContaining({ id: awardId, status: "PENDING" }),
    );

    await expectFailure(
      operator,
      fixture.editionId,
      "arena.award.release",
      { awardId },
      [403],
    );
    const released = await action(
      fixture.admin,
      fixture.editionId,
      "arena.award.release",
      { awardId },
    );
    expect(released).toMatchObject({
      xpDelta: 125,
      xpTotalBefore: 0,
      xpTotalAfter: 125,
      xpAvailableBefore: 0,
      xpAvailableAfter: 125,
    });
    const repeated = await action(
      fixture.admin,
      fixture.editionId,
      "arena.award.release",
      { awardId },
    );
    expect(repeated.alreadyReleased).toBe(true);

    const earned = await arenaState(
      participant,
      fixture.editionId,
      "participant",
    );
    expect(earned).toMatchObject({ myXpTotal: 125, myXpAvailable: 125 });
    expect(earned.pendingRevealAwards).toHaveLength(1);
    expect(JSON.stringify(earned.ranking)).not.toContain(
      fixture.participants[0].ra,
    );
    await action(participant, fixture.editionId, "arena.award.seen", {
      awardId,
    });
    expect(
      (
        await arenaState(participant, fixture.editionId, "participant")
      ).pendingRevealAwards,
    ).toHaveLength(0);

    const teamChallengeId = await save(
      fixture.admin,
      fixture.editionId,
      "arenaChallenge",
      {
        title: "Equipe Atômica QA DEV",
        xpReward: 50,
        mode: "TEAM",
        minTeamSize: 2,
        maxTeamSize: 3,
        active: true,
      },
    );
    await expectFailure(
      operator,
      fixture.editionId,
      "arena.challenge.completeTeam",
      {
        challengeId: teamChallengeId,
        ras: [fixture.participants[1].ra, "RA-INEXISTENTE-QA"],
      },
      [404],
    );
    const adminArena = await arenaState(
      fixture.admin,
      fixture.editionId,
      "admin",
    );
    expect(
      adminArena.completions.filter(
        (item: { challengeId: string }) =>
          item.challengeId === teamChallengeId,
      ),
    ).toHaveLength(0);

    const rewardId = await save(
      fixture.admin,
      fixture.editionId,
      "reward",
      {
        name: "Brinde XP QA DEV",
        description: "Reserva transacional de teste.",
        total: 1,
        active: true,
        redemptionMode: "XP_STORE",
        xpCost: 100,
        maxPerParticipant: 1,
      },
    );
    const purchased = await action(
      participant,
      fixture.editionId,
      "reward.purchase",
      { rewardId },
    );
    expect(
      await arenaState(participant, fixture.editionId, "participant"),
    ).toMatchObject({ myXpTotal: 125, myXpAvailable: 25 });
    await action(
      participant,
      fixture.editionId,
      "reward.purchase.cancel",
      { reservationId: (purchased.reservation as { id: string }).id },
    );
    expect(
      await arenaState(participant, fixture.editionId, "participant"),
    ).toMatchObject({ myXpTotal: 125, myXpAvailable: 125 });

    await action(
      operator,
      fixture.editionId,
      "arena.challenge.revoke",
      { completionId, reason: "Resultado revogado em teste" },
    );
    expect(
      await arenaState(participant, fixture.editionId, "participant"),
    ).toMatchObject({ myXpTotal: 0, myXpAvailable: 0 });
  } finally {
    await finish(fixture);
  }
});

test("@mobile participante entra e navega na programação, Farma Arena e passaporte", async ({
  page,
}) => {
  const fixture = await makeFixture();
  try {
    const title = "Curso mobile QA DEV";
    await activity(fixture, { title });
    await page.goto("/login/participante");
    await page
      .getByLabel("Edição", { exact: true })
      .selectOption(fixture.editionId);
    await page
      .getByLabel("Primeiro nome", { exact: true })
      .fill(fixture.participants[0].firstName);
    await page
      .getByLabel("RA", { exact: true })
      .fill(fixture.participants[0].ra);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(/Olá, Lívia/).first()).toBeVisible();
    await page.getByRole("link", { name: "Programação", exact: true }).click();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Farma Arena", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/arena$/);
    await expect(
      page.getByRole("heading", {
        name: "Desafios que transformam conhecimento em conquista.",
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // O badge do Next Dev ocupa o primeiro item da barra em viewport móvel.
    // As demais rotas da barra já foram exercitadas acima; seguimos para a
    // página inicial diretamente para validar o atalho do passaporte.
    await page.goto("/app");
    await page.getByRole("link", { name: "Abrir meu passaporte" }).click();
    await expect(page).toHaveURL(/\/app\/passaporte$/);
    await expect(
      page.getByText(fixture.participants[0].ra, { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /check.?in/i })).toHaveCount(
      0,
    );
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Perfil", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/perfil$/);
    await expect(
      page.getByRole("heading", { name: fixture.participants[0].name }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await finish(fixture);
  }
});

test("@desktop administração entra e consulta participantes da edição selecionada", async ({
  page,
}) => {
  const fixture = await makeFixture();
  try {
    await page.goto("/login/admin");
    await page.getByLabel("Login ou e-mail", { exact: true }).fill(adminEmail);
    await page.getByLabel("Senha", { exact: true }).fill(adminPassword);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await selectAdminEdition(page, fixture);
    await page
      .getByRole("link", { name: "Participantes", exact: true })
      .click();
    await expect(
      page.getByText(fixture.participants[0].name, { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await finish(fixture);
  }
});

test("@mobile modo operação encontra o RA e confirma presença", async ({
  page,
}) => {
  const fixture = await makeFixture();
  try {
    const participant = await participantClient(fixture);
    const activityId = await activity(fixture, {
      title: "Operação mobile QA DEV",
    });
    await action(participant, fixture.editionId, "enrollment.create", {
      activityId,
    });
    const operator = await authenticateAdmin(true);
    fixture.clients.push(operator);
    await page.context().addCookies((await operator.storageState()).cookies);
    await page.goto("/admin/operacao");
    await selectAdminEdition(page, fixture);
    await page
      .getByLabel("Atividade", { exact: true })
      .selectOption(activityId);
    await page
      .getByLabel("RA do participante", { exact: true })
      .fill(fixture.participants[0].ra);
    await page
      .getByRole("button", { name: "Buscar participante", exact: true })
      .click();
    await expect(
      page.getByText(fixture.participants[0].name, { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirmar check-in", exact: true })
      .click();
    await expect
      .poll(async () => {
        const current = await state(
          participant,
          fixture.editionId,
          "participant",
        );
        return current.stamps.filter((item) => item.activityId === activityId)
          .length;
      })
      .toBe(1);
    await expectNoHorizontalOverflow(page);
  } finally {
    await finish(fixture);
  }
});
