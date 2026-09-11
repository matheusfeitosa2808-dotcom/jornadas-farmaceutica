import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { createImportPreview } from "@/server/import-bulk";
import {
  csrf,
  errorResponse,
  getActor,
  requirePermission,
  ensure,
} from "@/server/security";

const aliases: Record<string, string> = {
  "nome completo": "name",
  nome: "name",
  ra: "ra",
  "registro academico": "ra",
  semestre: "semester",
};

const norm = (v: any) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export async function POST(req: NextRequest) {
  try {
    csrf(req, false);
    const actor = await getActor(req, "admin");
    requirePermission(actor, "participants.write");

    const form = await req.formData();
    const file = form.get("file");
    const editionId = String(form.get("editionId") || "");

    ensure(editionId, "Selecione uma edição antes de importar.");
    ensure(
      file instanceof File && file.size <= 5_000_000,
      "Envie um arquivo XLSX ou CSV de até 5 MB.",
    );
    ensure(
      [
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
      ].includes(file.type) || /\.(csv|xlsx)$/i.test(file.name),
      "Formato inválido.",
    );

    const rows: any[][] = [];
    if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter(Boolean);
      for (const line of lines) {
        const sep =
          (line.match(/;/g) || []).length > (line.match(/,/g) || []).length
            ? ";"
            : ",";
        rows.push(line.split(sep).map((x) => x.trim().replace(/^"|"$/g, "")));
      }
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await file.arrayBuffer()) as any);
      const sheet = wb.worksheets[0];
      ensure(sheet, "Planilha vazia.");
      sheet.eachRow((row) =>
        rows.push(
          (row.values as any[])
            .slice(1)
            .map((v) =>
              typeof v === "object" && v && "text" in v ? v.text : v,
            ),
        ),
      );
    }

    ensure(
      rows.length > 1,
      "O arquivo precisa de cabeçalho e ao menos uma linha.",
    );

    const headers = rows[0].map(norm);
    const mapped = headers.map((h) => aliases[h]);
    ensure(
      mapped.includes("name") &&
        mapped.includes("ra") &&
        mapped.includes("semester"),
      "Use as colunas Nome completo, RA e Semestre.",
    );
    ensure(mapped.every(Boolean), "Há coluna desconhecida no arquivo.");

    const existing = new Set(
      (
        await db.participant.findMany({
          where: { editionId },
          select: { ra: true },
        })
      ).map((x: any) => String(x.ra)),
    );
    const seen = new Set<string>();

    let valid = 0;
    let invalid = 0;
    let duplicates = 0;

    const parsed = rows.slice(1).map((r, i) => {
      const value: any = {};
      mapped.forEach((k, j) => (value[k] = r[j]));
      value.name = String(value.name || "").trim();
      value.ra = String(value.ra || "").trim();
      value.semester = Number(value.semester);

      let error = "";
      if (!value.name) error = "Nome vazio";
      else if (!value.ra) error = "RA vazio";
      else if (!Number.isInteger(value.semester) || value.semester < 1)
        error = "Semestre inválido";
      else if (seen.has(value.ra) || existing.has(value.ra)) {
        error = existing.has(value.ra)
          ? "Participante já existente"
          : "RA duplicado no arquivo";
        duplicates++;
      }

      seen.add(value.ra);
      if (error) invalid++;
      else valid++;

      return {
        row: i + 2,
        name: value.name,
        ra: value.ra,
        semester: Number.isFinite(value.semester) ? value.semester : null,
        status: (error ? "INVALID" : "VALID") as "VALID" | "INVALID",
        error: error || null,
      };
    });

    const job = await createImportPreview({
      editionId,
      operatorId: actor.id,
      filename: file.name,
      valid,
      invalid,
      duplicates,
      rows: parsed,
    });

    return NextResponse.json({ ...job, errors: invalid });
  } catch (e) {
    return errorResponse(e);
  }
}
