import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import path from "node:path";
import nextConfigFromDisk from "./next.config";

/**
 * Por padrão o vinext carrega next.config.ts do disco. Esse arquivo tem um
 * `turbopack.resolveAlias` que existe só para o `next dev` local (aponta
 * @/server/db de volta para Prisma) — se o vinext carregasse esse mesmo
 * arquivo, aplicaria esse alias no build de produção também, e
 * @/server/db voltaria a resolver para Prisma+SQLite dentro do Worker (foi
 * exatamente isso que aconteceu antes desta mudança). Por isso passamos a
 * config aqui explicitamente, sem a chave `turbopack`.
 */
const { turbopack, ...nextConfig } = nextConfigFromDisk;
void turbopack;

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
      nextConfig: nextConfig as any,
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@/server/db",
        replacement: path.resolve(process.cwd(), "src/server/db.pg.ts"),
      },
      {
        find: "@/server/storage",
        replacement: path.resolve(
          process.cwd(),
          "src/server/storage.cloudflare.ts",
        ),
      },
      { find: "sharp", replacement: path.resolve(process.cwd(), "empty-stub.js") },
    ],
  },
});
