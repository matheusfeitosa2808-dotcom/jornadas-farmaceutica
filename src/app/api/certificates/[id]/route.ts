import { NextRequest } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/server/db";
import {
  getActor,
  errorResponse,
  ensure,
  hasPermission,
} from "@/server/security";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      cert = await db.certificate.findUnique({
        where: { id },
        include: {
          participant: true,
          activity: { include: { edition: true, category: true } },
        },
      });
    ensure(cert, "Certificado não encontrado.", "NOT_FOUND", 404);
    const admin = await getActor(req, "admin"),
      participant = await getActor(req, "participant");
    ensure(
      (admin && hasPermission(admin, "certificates.manage")) ||
        participant?.id === cert.participantId,
      "Acesso negado.",
      "FORBIDDEN",
      403,
    );
    ensure(
      cert.status !== "INVALIDATED",
      "Certificado invalidado.",
      "INVALIDATED",
      410,
    );
    ensure(
      new Date() > cert.activity.edition.endAt,
      "Certificado disponível após o encerramento da edição.",
      "EVENT_NOT_FINISHED",
      403,
    );
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      readFile(
        path.join(process.cwd(), "public", "fonts", "sansation-400.ttf"),
      ),
      readFile(
        path.join(process.cwd(), "public", "fonts", "sansation-700.ttf"),
      ),
    ]);
    const sans = await pdf.embedFont(regularBytes, { subset: true }),
      serif = sans,
      serifBold = await pdf.embedFont(boldBytes, { subset: true }),
      page = pdf.addPage([842, 595]),
      { width, height } = page.getSize();
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.975, 0.963, 0.92),
    });
    page.drawRectangle({
      x: 25,
      y: 25,
      width: width - 50,
      height: height - 50,
      borderColor: rgb(0.68, 0.52, 0.21),
      borderWidth: 1.5,
    });
    page.drawRectangle({
      x: 36,
      y: 36,
      width: width - 72,
      height: height - 72,
      borderColor: rgb(0.1, 0.31, 0.34),
      borderWidth: 0.6,
    });
    const center = (
      text: string,
      size: number,
      font: any,
      y: number,
      color = rgb(0.07, 0.24, 0.27),
    ) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const fittedSize =
        textWidth > width - 120
          ? Math.max(8, (size * (width - 120)) / textWidth)
          : size;
      page.drawText(text, {
        x: (width - font.widthOfTextAtSize(text, fittedSize)) / 2,
        y,
        size: fittedSize,
        font,
        color,
      });
    };
    center("JORNADA FARMACÊUTICA", 18, serifBold, 500, rgb(0.68, 0.5, 0.16));
    center(
      cert.activity.edition.name.toUpperCase(),
      10,
      sans,
      480,
      rgb(0.1, 0.31, 0.34),
    );
    center("CERTIFICADO", 40, serif, 404);
    center("Certificamos que", 12, sans, 365, rgb(0.35, 0.4, 0.4));
    center(cert.participant.name, 25, serifBold, 326);
    center(`participou da atividade "${cert.activity.title}"`, 13, sans, 282);
    center(
      `com carga horária de ${cert.workload} hora(s), promovida pela ${cert.activity.edition.name}.`,
      12,
      sans,
      258,
    );
    center(
      `Emitido em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: cert.activity.edition.timezone }).format(cert.issuedAt)}.`,
      10,
      sans,
      210,
      rgb(0.35, 0.4, 0.4),
    );
    center(`Código de validação: ${cert.code}`, 10, sans, 108);
    center(
      `${process.env.APP_ORIGIN || new URL(req.url).origin}/api/validate?code=${cert.code}`,
      8,
      sans,
      90,
      rgb(0.35, 0.4, 0.4),
    );
    const bytes = await pdf.save();
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="certificado-${cert.code}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
