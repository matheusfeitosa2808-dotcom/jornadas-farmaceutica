import { NextResponse } from "next/server";
import { readStoredFile } from "@/server/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const file = await readStoredFile(name);
  if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  return new Response(Uint8Array.from(file.body).buffer, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(file.etag ? { ETag: file.etag } : {}),
    },
  });
}
