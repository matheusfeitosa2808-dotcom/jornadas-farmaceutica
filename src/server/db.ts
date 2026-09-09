import { Prisma, PrismaClient } from "@prisma/client";

const globalDb = globalThis as unknown as {
  jornadasDb?: PrismaClient;
  jornadasLock?: Promise<unknown>;
};
export const db = globalDb.jornadasDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.jornadasDb = db;
export type Tx = Prisma.TransactionClient;

/** SQLite has one writer. PostgreSQL additionally detects inter-process serializable conflicts. */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const previous = globalDb.jornadasLock ?? Promise.resolve();
  let release!: () => void;
  globalDb.jornadasLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 15000,
          timeout: 30000,
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (attempt >= 4 || !["P2034", "P2028", "P1008"].includes(code ?? ""))
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt));
      }
    }
  } finally {
    release();
  }
}
