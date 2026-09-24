import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import {
  ensure,
  errorResponse,
  getActor,
  normalizeName,
  requirePermission,
} from "@/server/security";

export const dynamic = "force-dynamic";

function styleSheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column, index) => {
    column.width = widths[index] || 18;
  });
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF174F58" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 24;
  if (sheet.columnCount)
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getActor(request, "admin");
    requirePermission(actor, "participants.read");

    const editionId = request.nextUrl.searchParams.get("editionId") || "";
    ensure(editionId, "Edição não informada.");
    const query = normalizeName(request.nextUrl.searchParams.get("q") || "");
    const semester = request.nextUrl.searchParams.get("semester") || "";
    const presence = request.nextUrl.searchParams.get("presence") || "";

    const [edition, participants, attendances, enrollments, stamps] =
      await Promise.all([
        db.edition.findUnique({ where: { id: editionId } }),
        db.participant.findMany({
          where: { editionId },
          orderBy: [{ name: "asc" }, { ra: "asc" }],
        }),
        db.attendance.findMany({ where: { editionId } }),
        db.enrollment.findMany({ where: { editionId } }),
        db.passportStamp.findMany({
          where: { editionId, status: "VALID" },
        }),
      ]);
    ensure(edition, "Edição não encontrada.", "NOT_FOUND", 404);

    const attendanceByParticipant = new Map<string, any[]>();
    for (const attendance of attendances) {
      const rows = attendanceByParticipant.get(attendance.participantId) || [];
      rows.push(attendance);
      attendanceByParticipant.set(attendance.participantId, rows);
    }
    const enrollmentCount = new Map<string, number>();
    for (const enrollment of enrollments) {
      if (!["ACTIVE", "COMPLETED"].includes(enrollment.status)) continue;
      enrollmentCount.set(
        enrollment.participantId,
        (enrollmentCount.get(enrollment.participantId) || 0) + 1,
      );
    }
    const stampCount = new Map<string, number>();
    for (const stamp of stamps)
      stampCount.set(
        stamp.participantId,
        (stampCount.get(stamp.participantId) || 0) + 1,
      );

    const validAttendances = (participantId: string) =>
      (attendanceByParticipant.get(participantId) || []).filter(
        (item) =>
          item.checkinAt && !["CANCELLED", "INVALIDATED"].includes(item.status),
      );
    const filtered = participants.filter((participant) => {
      const searchable = normalizeName(`${participant.name} ${participant.ra}`);
      if (query && !searchable.includes(query)) return false;
      if (semester && String(participant.semester) !== semester) return false;
      const hasPresence = validAttendances(participant.id).length > 0;
      if (presence === "yes" && !hasPresence) return false;
      if (presence === "no" && hasPresence) return false;
      return true;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Jornadas";
    workbook.created = new Date();

    const summary = workbook.addWorksheet("Resumo");
    summary.addRow(["Indicador", "Quantidade"]);
    summary.addRows([
      ["Participantes exportados", filtered.length],
      ["Participantes ativos", filtered.filter((p) => p.active).length],
      ["Participantes inativos", filtered.filter((p) => !p.active).length],
      [
        "Com presença registrada",
        filtered.filter((p) => validAttendances(p.id).length > 0).length,
      ],
      [
        "Sem presença registrada",
        filtered.filter((p) => validAttendances(p.id).length === 0).length,
      ],
      [
        "Total de check-ins válidos",
        filtered.reduce(
          (total, participant) =>
            total + validAttendances(participant.id).length,
          0,
        ),
      ],
      [
        "Total de check-outs",
        filtered.reduce(
          (total, participant) =>
            total +
            validAttendances(participant.id).filter((item) => item.checkoutAt)
              .length,
          0,
        ),
      ],
      [
        "Total de carimbos",
        filtered.reduce(
          (total, participant) => total + (stampCount.get(participant.id) || 0),
          0,
        ),
      ],
    ]);
    styleSheet(summary, [34, 18]);

    const bySemester = workbook.addWorksheet("Por semestre");
    bySemester.addRow(["Semestre", "Total", "Ativos", "Com presença"]);
    const semesters: number[] = Array.from(
      new Set<number>(filtered.map((p: any) => Number(p.semester))),
    ).sort((a, b) => a - b);
    for (const value of semesters) {
      const rows = filtered.filter((p) => Number(p.semester) === value);
      bySemester.addRow([
        `${value}º`,
        rows.length,
        rows.filter((p) => p.active).length,
        rows.filter((p) => validAttendances(p.id).length > 0).length,
      ]);
    }
    styleSheet(bySemester, [18, 16, 16, 20]);

    const details = workbook.addWorksheet("Participantes");
    details.addRow([
      "Nome",
      "RA",
      "Semestre",
      "Status",
      "Inscrições",
      "Check-ins",
      "Check-outs",
      "Carimbos",
    ]);
    for (const participant of filtered) {
      const ownAttendances = validAttendances(participant.id);
      details.addRow([
        participant.name,
        participant.ra,
        `${participant.semester}º`,
        participant.active ? "Ativo" : "Inativo",
        enrollmentCount.get(participant.id) || 0,
        ownAttendances.length,
        ownAttendances.filter((item) => item.checkoutAt).length,
        stampCount.get(participant.id) || 0,
      ]);
    }
    styleSheet(details, [38, 16, 14, 14, 14, 14, 14, 14]);

    const buffer = await workbook.xlsx.writeBuffer();
    const suffix = new Date().toISOString().slice(0, 10);
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="participantes-${suffix}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
