import type { NextConfig } from "next";

/**
 * tsconfig.json aponta @/server/db para db.pg.ts (Postgres/Hyperdrive)
 * porque é isso que o build de produção (vinext/Vite) precisa. O `next dev`
 * (Turbopack) lê o mesmo tsconfig, então sem este override ele tentaria
 * carregar `cloudflare:workers` em cima do Node puro e quebraria toda rota
 * que toca o banco. Aqui, só para o dev local, aponta de volta para
 * Prisma+SQLite.
 *
 * Isso só fica isolado do build de produção porque vite.config.ts passa
 * `nextConfig` explicitamente para o plugin `vinext` — sem isso, o vinext
 * carregaria este arquivo do disco e aplicaria este mesmo alias na hora de
 * montar o Worker, quebrando @/server/db lá também (foi exatamente isso
 * que aconteceu quando esse override foi adicionado sem o `nextConfig`
 * explícito). Ao mudar algo aqui, replique manualmente em vite.config.ts.
 */
const config: NextConfig = {
  serverExternalPackages: ["@prisma/client", "exceljs", "web-push"],
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.3.183"],
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      "@/server/db": "./src/server/db.ts",
      "@/server/storage": "./src/server/storage.ts",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default config;
