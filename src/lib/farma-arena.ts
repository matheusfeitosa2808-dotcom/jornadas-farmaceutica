export const FARMA_ARENA_STAMP_URL =
  "/assets/stamps/farma-arena-2026-v2.webp";

export const FARMA_ARENA_FIRE_URL =
  "/assets/effects/farma-arena-fire.webp";

function normalized(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "");
}

export function isFarmaArena(category?: any, activity?: any) {
  return normalized(
    `${category?.name || ""} ${category?.slug || ""} ${activity?.title || ""}`,
  ).includes("farmaarena");
}

export function resolvedStampUrl(category?: any, activity?: any) {
  return isFarmaArena(category, activity)
    ? FARMA_ARENA_STAMP_URL
    : activity?.stampUrl || category?.stampUrl || "";
}

export function isLegacyFarmaArenaStamp(value: unknown) {
  return (
    value === FARMA_ARENA_STAMP_URL ||
    value === "/assets/stamps/selo-3.webp" ||
    value === "/assets/stamps/selo-3.png"
  );
}
