import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildStoreReportPdf } from "@/server/store-report-pdf";

describe("store report PDF", () => {
  it("creates a printable A4 report with store data", async () => {
    const bytes = await buildStoreReportPdf({
      edition: { name: "Jornada Farmacêutica 2026", timezone: "America/Manaus" },
      generatedAt: new Date("2026-09-26T23:30:00-04:00"),
      participants: [{ id: "p1", name: "Amanda Farias", ra: "48079" }],
      rewards: [
        {
          id: "r1",
          name: "Caneta",
          total: 96,
          redemptionMode: "XP_STORE",
          xpCost: 350,
        },
      ],
      reservations: [
        {
          id: "res1",
          participantId: "p1",
          rewardId: "r1",
          status: "RESERVED",
          createdAt: "2026-09-26T20:00:00.000Z",
        },
      ],
      deliveries: [],
      draws: [],
      transactions: [{ sourceId: "res1", balanceDelta: -350 }],
    });
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getTitle()).toContain("Relatório da Loja");
    expect(pdf.getPages()[0].getSize()).toEqual({ width: 595.28, height: 841.89 });
  });
});
