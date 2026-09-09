import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  csrf,
  errorResponse,
  getActor,
  requireParticipant,
  ensure,
} from "@/server/security";
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}
export async function POST(req: NextRequest) {
  try {
    csrf(req);
    const actor = await getActor(req, "participant");
    ensure(actor?.editionId, "Faça login.", "UNAUTHORIZED", 401);
    requireParticipant(actor, actor.editionId);
    const body = await req.json(),
      endpoint = String(body.endpoint || ""),
      p256dh = String(body.keys?.p256dh || ""),
      auth = String(body.keys?.auth || "");
    ensure(
      /^https:\/\//.test(endpoint) && p256dh && auth,
      "Inscrição push inválida.",
    );
    await db.pushSubscription.upsert({
      where: { endpoint },
      update: { participantId: actor.id, p256dh, auth },
      create: { participantId: actor.id, endpoint, p256dh, auth },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
