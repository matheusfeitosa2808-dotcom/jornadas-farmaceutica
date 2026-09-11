import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import path from "node:path";

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
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
