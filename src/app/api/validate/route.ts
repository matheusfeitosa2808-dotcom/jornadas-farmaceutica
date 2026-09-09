import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { errorResponse } from "@/server/security";
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code") || "",
      c = await db.certificate.findUnique({
        where: { code },
        include: {
          participant: { select: { name: true } },
          activity: {
            select: {
              title: true,
              workload: true,
              edition: { select: { name: true, year: true } },
            },
          },
        },
      });
    if (!c)
      return NextResponse.json(
        { valid: false, message: "Código não encontrado." },
        { status: 404 },
      );
    return NextResponse.json({
      valid: c.status !== "INVALIDATED",
      status: c.status,
      name: c.participant.name,
      activity: c.activity.title,
      edition: c.activity.edition.name,
      workload: c.workload,
      issuedAt: c.issuedAt,
      invalidatedAt: c.invalidatedAt,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
