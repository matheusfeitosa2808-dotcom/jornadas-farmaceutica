import { env } from "cloudflare:workers";

type StoredFile = {
  body: Uint8Array;
  contentType: string;
  etag?: string;
};

const keyFor = (name: string) => `uploads/${name}`;

export async function saveUpload(
  name: string,
  bytes: Uint8Array,
  contentType: string,
) {
  await env.UPLOADS.put(keyFor(name), bytes, {
    httpMetadata: { contentType },
  });
  return `/api/files/${encodeURIComponent(name)}`;
}

export async function readStoredFile(
  name: string,
): Promise<StoredFile | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  const object = await env.UPLOADS.get(keyFor(name));
  if (!object) return null;
  return {
    body: new Uint8Array(await object.arrayBuffer()),
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
    etag: object.httpEtag,
  };
}

export async function readPublicAsset(pathname: string) {
  if (pathname.startsWith("/api/files/")) {
    const stored = await readStoredFile(
      decodeURIComponent(pathname.slice("/api/files/".length)),
    );
    if (!stored) throw new Error("Arquivo não encontrado.");
    return stored.body;
  }
  const response = await env.ASSETS.fetch(
    new Request(new URL(pathname, "https://assets.local")),
  );
  if (!response.ok) throw new Error("Arquivo estático não encontrado.");
  return new Uint8Array(await response.arrayBuffer());
}
