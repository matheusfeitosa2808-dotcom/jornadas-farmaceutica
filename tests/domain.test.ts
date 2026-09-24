import { describe, expect, it } from "vitest";
import {
  correctAttendanceByRa,
  overlaps,
  minute,
  validateEnrollment,
} from "@/server/domain";
import {
  hashPassword,
  verifyPassword,
  normalizeName,
  hasPermission,
  rolePermissions,
} from "@/server/security";
describe("regras centrais", () => {
  it("normaliza nome do login sem depender de caixa ou acento", () => {
    expect(normalizeName("  LÍVIA ")).toBe("livia");
  });
  it("protege senha administrativa com salt e comparação segura", () => {
    const a = hashPassword("Jornada@2026!"),
      b = hashPassword("Jornada@2026!");
    expect(a).not.toBe(b);
    expect(verifyPassword("Jornada@2026!", a)).toBe(true);
    expect(verifyPassword("errada", a)).toBe(false);
  });
  it("detecta sobreposição e permite atividades contíguas", () => {
    const t = new Date("2026-10-23T18:30:00Z");
    const A = { startAt: t, endAt: new Date(t.getTime() + 60 * minute) };
    expect(
      overlaps(A, {
        startAt: new Date(t.getTime() + 30 * minute),
        endAt: new Date(t.getTime() + 90 * minute),
      }),
    ).toBe(true);
    expect(
      overlaps(A, {
        startAt: A.endAt,
        endAt: new Date(A.endAt.getTime() + minute),
      }),
    ).toBe(false);
  });
  it("ignora inscrição antiga quando a atividade relacionada foi cancelada", async () => {
    const startAt = new Date("2026-10-23T18:30:00Z");
    const target = {
      id: "nova",
      editionId: "edicao",
      enrollmentOpen: true,
      status: "OPEN",
      startAt,
      endAt: new Date(startAt.getTime() + 60 * minute),
      enrollmentDeadline: null,
      capacity: 30,
      edition: {
        status: "ACTIVE",
        lateMinutes: 15,
        maxActivities: 1,
      },
    };
    const tx = {
      activity: { findFirst: async () => target },
      participant: { findFirst: async () => ({ id: "participante" }) },
      enrollment: {
        findMany: async () => [
          {
            id: "inscricao-cancelada",
            activityId: "antiga",
            status: "ACTIVE",
            activity: {
              id: "antiga",
              status: "CANCELLED",
              startAt,
              endAt: new Date(startAt.getTime() + 60 * minute),
            },
          },
        ],
        count: async () => 0,
      },
    } as any;

    await expect(
      validateEnrollment(tx, "edicao", "participante", "nova", startAt),
    ).resolves.toBe(target);
  });
  it("mantém o conflito quando a outra atividade continua válida", async () => {
    const startAt = new Date("2026-10-23T18:30:00Z");
    const target = {
      id: "nova",
      editionId: "edicao",
      enrollmentOpen: true,
      status: "OPEN",
      startAt,
      endAt: new Date(startAt.getTime() + 60 * minute),
      enrollmentDeadline: null,
      capacity: 30,
      edition: {
        status: "ACTIVE",
        lateMinutes: 15,
        maxActivities: 0,
      },
    };
    const tx = {
      activity: { findFirst: async () => target },
      participant: { findFirst: async () => ({ id: "participante" }) },
      enrollment: {
        findMany: async () => [
          {
            id: "inscricao-ativa",
            activityId: "antiga",
            status: "ACTIVE",
            activity: {
              id: "antiga",
              title: "Palestra anterior",
              status: "OPEN",
              startAt,
              endAt: new Date(startAt.getTime() + 60 * minute),
            },
          },
        ],
        count: async () => 0,
      },
    } as any;

    await expect(
      validateEnrollment(tx, "edicao", "participante", "nova", startAt),
    ).rejects.toMatchObject({ code: "SCHEDULE_CONFLICT" });
  });
  it("mantém permissões de operador restritas à operação", () => {
    expect(rolePermissions.OPERATOR).toContain("attendance.register");
    expect(rolePermissions.OPERATOR).not.toContain("rewards.manage");
    expect(
      hasPermission(
        {
          type: "admin",
          id: "1",
          name: "Op",
          role: "OPERATOR",
          permissions: rolePermissions.OPERATOR,
        },
        "attendance.register",
      ),
    ).toBe(true);
    expect(
      hasPermission(
        {
          type: "admin",
          id: "1",
          name: "Op",
          role: "OPERATOR",
          permissions: rolePermissions.OPERATOR,
        },
        "audit.read",
      ),
    ).toBe(false);
  });
  it("documenta limites inclusivos T+15/T+20/T+25", () => {
    const start = new Date("2026-10-23T18:30:00Z");
    expect(new Date(start.getTime() + 15 * minute).toISOString()).toBe(
      "2026-10-23T18:45:00.000Z",
    );
    expect(new Date(start.getTime() + 20 * minute).toISOString()).toBe(
      "2026-10-23T18:50:00.000Z",
    );
    expect(new Date(start.getTime() + 25 * minute).toISOString()).toBe(
      "2026-10-23T18:55:00.000Z",
    );
  });
  it("corrige presença por RA de forma idempotente e recompõe os derivados", async () => {
    const now = new Date("2026-10-24T01:00:00Z");
    const activity = {
      id: "palestra",
      editionId: "edicao",
      categoryId: "categoria",
      title: "Palestra teste",
      status: "FINISHED",
      workload: 2,
      category: {
        requiresCheckin: true,
        requiresCheckout: true,
        generatesStamp: true,
        generatesCertificate: true,
      },
      edition: {},
    };
    let attendance: any = null;
    let certificate: any = null;
    const events: string[] = [];
    const enrollments: any[] = [];
    const stamps: any[] = [];
    const tx = {
      activity: { findFirst: async () => activity },
      participant: {
        findUnique: async () => ({
          id: "participante",
          name: "Amanda",
          active: true,
        }),
      },
      attendance: {
        findUnique: async () => attendance,
        upsert: async ({ create, update }: any) => {
          attendance = attendance
            ? { ...attendance, ...update }
            : { id: "presenca", ...create };
          return attendance;
        },
      },
      attendanceEvent: {
        create: async ({ data }: any) => {
          events.push(data.operation);
          return data;
        },
      },
      enrollment: {
        upsert: async ({ create, update }: any) => {
          const row = enrollments[0]
            ? Object.assign(enrollments[0], update)
            : { id: "inscricao", ...create };
          if (!enrollments.length) enrollments.push(row);
          return row;
        },
      },
      passportStamp: {
        upsert: async ({ create, update }: any) => {
          const row = stamps[0]
            ? Object.assign(stamps[0], update)
            : { id: "carimbo", ...create };
          if (!stamps.length) stamps.push(row);
          return row;
        },
      },
      certificate: {
        findFirst: async () => certificate,
        create: async ({ data }: any) => {
          certificate = { id: "certificado", status: "GENERATED", ...data };
          return certificate;
        },
        update: async ({ data }: any) => {
          certificate = { ...certificate, ...data };
          return certificate;
        },
      },
      auditLog: { create: async ({ data }: any) => data },
      notification: {
        findUnique: async () => null,
        create: async ({ data }: any) => data,
      },
    } as any;
    const actor = {
      type: "admin" as const,
      id: "admin",
      name: "Comissão",
      role: "ADMIN_GENERAL",
      permissions: [],
    };

    const first = await correctAttendanceByRa(
      tx,
      "edicao",
      "palestra",
      " 48079 ",
      "Ajuste solicitado pela comissão.",
      actor,
      now,
    );
    const second = await correctAttendanceByRa(
      tx,
      "edicao",
      "palestra",
      "48079",
      "Conferência posterior do registro.",
      actor,
      now,
    );

    expect(first.status).toBe("COMPLETED");
    expect(second.alreadyComplete).toBe(true);
    expect(events).toEqual(["CHECK_IN", "CHECK_OUT"]);
    expect(enrollments[0]).toMatchObject({
      status: "COMPLETED",
      source: "ADMIN_CORRECTION",
    });
    expect(stamps[0]).toMatchObject({
      status: "VALID",
      activityId: "palestra",
    });
    expect(certificate).toMatchObject({
      participantId: "participante",
      activityId: "palestra",
    });
  });
});
