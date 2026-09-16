import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredFile = {
  body: Uint8Array;
  contentType: string;
  etag?: string;
};

const publicRoot = path.resolve(process.cwd(), "public");

function publicPath(pathname: string) {
  const resolved = path.resolve(publicRoot, pathname.replace(/^\/+/, ""));
  if (!resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Caminho de arquivo inválido.");
  }
  return resolved;
}

export async function saveUpload(
  name: string,
  bytes: Uint8Array,
  contentType: string,
) {
  // O disco local não guarda metadata como o R2. O nome sempre carrega a
  // extensão validada por quem chamou (ver /api/upload), então o tipo é
  // recuperado a partir dela em readStoredFile.
  void contentType;
  const directory = publicPath("uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), bytes, { flag: "wx" });
  return `/api/files/${encodeURIComponent(name)}`;
}

const mimeByExtension: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function readStoredFile(name: string): Promise<StoredFile | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  try {
    const body = await readFile(publicPath(`uploads/${name}`));
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = mimeByExtension[extension] ?? "application/octet-stream";
    return { body, contentType };
  } catch {
    return null;
  }
}

export async function readPublicAsset(pathname: string) {
  if (pathname.startsWith("/api/files/")) {
    const stored = await readStoredFile(
      decodeURIComponent(pathname.slice("/api/files/".length)),
    );
    if (!stored) throw new Error("Arquivo não encontrado.");
    return stored.body;
  }
  return readFile(publicPath(pathname));
}
