import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const editions = await db.edition.findMany({
      where: { status: { in: ["PUBLISHED", "ACTIVE", "FINISHED"] } },
      orderBy: [{ year: "desc" }],
    });
    const edition =
      editions.find((e: any) => e.status === "ACTIVE") || editions[0] || null;

    return NextResponse.json({
      editions,
      edition,
      actor: null,
      devMode: process.env.DEV_SEED === "true",
    });
  } catch (error) {
    console.error("[jornadas/editions]", error);
    return NextResponse.json(
      { error: "Não foi possível carregar as edições." },
      { status: 500 },
    );
  }
}
