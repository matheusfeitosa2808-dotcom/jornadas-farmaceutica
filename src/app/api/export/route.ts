import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { getActor, errorResponse, requirePermission } from "@/server/security";
const fmt = (v: any) => (v instanceof Date ? v.toISOString() : (v ?? ""));
function sheet(wb: ExcelJS.Workbook, name: string, rows: any[]) {
  const ws = wb.addWorksheet(name);
  const keys = Array.from(new Set<string>(rows.flatMap((r) => Object.keys(r))));
  ws.columns = keys.map((k) => ({
    header: k,
    key: k,
    width: Math.min(
      42,
      Math.max(
        14,
        k.length + 3,
        ...rows.map((r) => String(fmt(r[k])).length + 2),
      ),
    ),
  }));
  rows.forEach((r) =>
    ws.addRow(Object.fromEntries(keys.map((k) => [k, fmt(r[k])]))),
  );
  ws.views = [{ state: "frozen", ySplit: 1 }];
  if (keys.length)
    ws.autoFilter = {
      from: "A1",
      to: `${String.fromCharCode(64 + Math.min(keys.length, 26))}1`,
    };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF174F58" },
  };
}
export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req, "admin");
    requirePermission(actor, "reports.export");
    const editionId = req.nextUrl.searchParams.get("editionId") || "";
    const [p, a, e, w, att, st, c, r, el, d, res, del] = await Promise.all([
      db.participant.findMany({ where: { editionId } }),
      db.activity.findMany({
        where: { editionId },
        include: { category: true },
      }),
      db.enrollment.findMany({ where: { editionId } }),
      db.waitlistEntry.findMany({ where: { editionId } }),
      db.attendance.findMany({ where: { editionId } }),
      db.passportStamp.findMany({ where: { editionId } }),
      db.certificate.findMany({ where: { editionId } }),
      db.rewardItem.findMany({ where: { editionId } }),
      db.rewardEligibility.findMany({ where: { editionId } }),
      db.rewardDraw.findMany({ where: { editionId } }),
      db.rewardReservation.findMany({ where: { editionId } }),
      db.rewardDelivery.findMany({ where: { editionId } }),
    ]);
    const pn = (id: string) => p.find((x) => x.id === id)?.name || id,
      an = (id: string) => a.find((x) => x.id === id)?.title || id,
      rn = (id: string) => r.find((x) => x.id === id)?.name || id;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Jornadas";
    sheet(
      wb,
      "Participantes",
      p.map((x) => ({
        Nome: x.name,
        RA: x.ra,
        Semestre: x.semester,
        Ativo: x.active,
      })),
    );
    sheet(
      wb,
      "Atividades",
      a.map((x) => ({
        Atividade: x.title,
        Categoria: x.category.name,
        Inicio: x.startAt,
        Fim: x.endAt,
        Bloco: x.block,
        Sala: x.room,
        Capacidade: x.capacity,
        Status: x.status,
      })),
    );
    sheet(
      wb,
      "Inscrições",
      e.map((x) => ({
        Nome: pn(x.participantId),
        RA: p.find((y) => y.id === x.participantId)?.ra,
        Atividade: an(x.activityId),
        Status: x.status,
        Tardia: x.lateEnrollment,
        Data: x.createdAt,
      })),
    );
    sheet(
      wb,
      "Lista de Espera",
      w.map((x) => ({
        Nome: pn(x.participantId),
        Atividade: an(x.activityId),
        Status: x.status,
        Entrada: x.createdAt,
        Promovido: x.promotedAt,
      })),
    );
    sheet(
      wb,
      "Presenças",
      att.map((x) => ({
        Nome: pn(x.participantId),
        Atividade: an(x.activityId),
        "Check-in": x.checkinAt,
        "Check-out": x.checkoutAt,
        Status: x.status,
      })),
    );
    sheet(
      wb,
      "Matriz de Presença",
      p.map((x) => ({
        Nome: x.name,
        RA: x.ra,
        ...Object.fromEntries(
          a.map((y) => [
            y.title,
            att.some(
              (z) =>
                z.participantId === x.id &&
                z.activityId === y.id &&
                z.checkinAt,
            )
              ? "PRESENTE"
              : "",
          ]),
        ),
      })),
    );
    sheet(
      wb,
      "Passaportes",
      st.map((x) => ({
        Nome: pn(x.participantId),
        Atividade: an(x.activityId),
        Emitido: x.issuedAt,
        Status: x.status,
      })),
    );
    sheet(
      wb,
      "Certificados",
      c.map((x) => ({
        Nome: pn(x.participantId),
        Atividade: an(x.activityId),
        Código: x.code,
        Carga: x.workload,
        Status: x.status,
      })),
    );
    sheet(
      wb,
      "Brindes",
      r.map((x) => ({ Brinde: x.name, Total: x.total, Ativo: x.active })),
    );
    sheet(
      wb,
      "Elegibilidade",
      el.map((x) => ({
        Nome: pn(x.participantId),
        Brinde: rn(x.rewardId),
        Elegível: x.eligible,
        Motivo: x.reason,
      })),
    );
    sheet(
      wb,
      "Sorteios",
      d.map((x) => ({
        Brinde: rn(x.rewardId),
        Rodada: x.round,
        Elegíveis: x.eligibleCount,
        Estoque: x.stockSnapshot,
        Modo: x.mode,
        Status: x.status,
        Data: x.createdAt,
      })),
    );
    sheet(
      wb,
      "Reservas",
      res.map((x) => ({
        Nome: pn(x.participantId),
        Brinde: rn(x.rewardId),
        Quantidade: x.quantity,
        Status: x.status,
        Expira: x.expiresAt,
      })),
    );
    sheet(
      wb,
      "Entregas",
      del.map((x) => ({
        Nome: pn(x.participantId),
        Brinde: rn(x.rewardId),
        Quantidade: x.quantity,
        Status: x.status,
        Data: x.deliveredAt,
        Reversão: x.reverseReason,
      })),
    );
    sheet(
      wb,
      "Estoque Final",
      r.map((x) => {
        const reserved = res.filter(
            (y) =>
              y.rewardId === x.id &&
              ["RESERVED", "CONFIRMED"].includes(y.status),
          ).length,
          delivered = del.filter(
            (y) => y.rewardId === x.id && y.status === "DELIVERED",
          ).length;
        return {
          Brinde: x.name,
          Total: x.total,
          Disponível: x.total - reserved - delivered,
          Reservado: reserved,
          Entregue: delivered,
        };
      }),
    );
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="jornadas-${editionId}.xlsx"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
