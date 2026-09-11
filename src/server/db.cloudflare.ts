import { env } from "cloudflare:workers";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma-cloudflare";

const globalDb = globalThis as unknown as {
  jornadasCloudflareDb?: PrismaClient;
};

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const db =
  globalDb.jornadasCloudflareDb ?? new PrismaClient({ adapter });
globalDb.jornadasCloudflareDb = db;

export type Tx = Prisma.TransactionClient;

export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 15_000,
        timeout: 30_000,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 4 || !["P2034", "P2028", "P1008"].includes(code ?? "")) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt));
    }
  }
}
