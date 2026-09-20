import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { readPublicAsset } from "@/server/storage";
import { buildCertificatePdf } from "@/server/certificate-pdf";
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
          activity: {
            include: {
              edition: true,
              category: true,
              speakers: { include: { speaker: true } },
            },
          },
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
    const [template, regularFont, boldFont] = await Promise.all([
      readPublicAsset(
        "/assets/certificates/certificado-farmacia-modelo.png",
      ),
      readPublicAsset("/fonts/sansation-400.ttf"),
      readPublicAsset("/fonts/sansation-700.ttf"),
    ]);
    const origin = process.env.APP_ORIGIN || new URL(req.url).origin;
    const bytes = await buildCertificatePdf(
      {
        participantName: cert.participant.name,
        activityTitle: cert.activity.title,
        speakerNames: cert.activity.speakers.map(
          (relation: any) => relation.speaker.name,
        ),
        workload: cert.workload,
        issuedAt: cert.issuedAt,
        timezone: cert.activity.edition.timezone,
        code: cert.code,
        validationUrl: `${origin}/api/validate?code=${cert.code}`,
      },
      { template, regularFont, boldFont },
    );
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
