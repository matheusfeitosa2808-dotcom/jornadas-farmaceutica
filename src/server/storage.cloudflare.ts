import { env } from "cloudflare:workers";

type StoredFile = {
  body: Uint8Array;
  contentType: string;
  etag?: string;
};

type R2ObjectLike = {
  httpMetadata?: { contentType?: string };
  httpEtag: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};
type R2BucketLike = {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
};
type Env = {
  UPLOADS: R2BucketLike;
  ASSETS: { fetch(request: Request): Promise<Response> };
};

const bindings = () => env as unknown as Env;
const keyFor = (name: string) => `uploads/${name}`;

export async function saveUpload(
  name: string,
  bytes: Uint8Array,
  contentType: string,
) {
  await bindings().UPLOADS.put(keyFor(name), bytes, {
    httpMetadata: { contentType },
  });
  return `/api/files/${encodeURIComponent(name)}`;
}

export async function readStoredFile(
  name: string,
): Promise<StoredFile | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  const object = await bindings().UPLOADS.get(keyFor(name));
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
  const response = await bindings().ASSETS.fetch(
    new Request(new URL(pathname, "https://assets.local")),
  );
  if (!response.ok) throw new Error("Arquivo estático não encontrado.");
  return new Uint8Array(await response.arrayBuffer());
}
