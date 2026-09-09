import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
for (const folder of ["brand", "stamps"])
  for (const file of await readdir(`public/assets/${folder}`)) {
    if (!file.endsWith(".png")) continue;
    await sharp(`public/assets/${folder}/${file}`)
      .resize({
        width: folder === "brand" ? 1200 : 500,
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toFile(`public/assets/${folder}/${path.basename(file, ".png")}.webp`);
  }
await mkdir("public/icons", { recursive: true });
for (const size of [192, 512])
  await sharp("public/assets/stamps/selo-1.png")
    .resize(Math.round(size * 0.7), Math.round(size * 0.7), { fit: "inside" })
    .extend({
      top: Math.round(size * 0.15),
      bottom: Math.round(size * 0.15),
      left: Math.round(size * 0.15),
      right: Math.round(size * 0.15),
      background: "#f8f9f6",
    })
    .resize(size, size)
    .flatten({ background: "#f8f9f6" })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
await sharp("public/icons/icon-512.png").toFile(
  "public/icons/maskable-512.png",
);
