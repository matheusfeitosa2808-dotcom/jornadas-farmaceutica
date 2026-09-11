import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { env } from "cloudflare:workers";

export type ImportPreviewRow = {
  row: number;
  name: string;
  ra: string;
  semester: number | null;
  status: "VALID" | "INVALID";
  error: string | null;
};

function connectionString() {
  const hyperdrive = (env as any)?.HYPERDRIVE?.connectionString;
  if (hyperdrive) return hyperdrive;
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL não configurada no Worker.");
  return value;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: 10_000,
    application_name: "jornadas-import",
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch {
      // best effort
    }
  }
}

export async function createImportPreview(input: {
  editionId: string;
  operatorId: string;
  filename: string;
  valid: number;
  invalid: number;
  duplicates: number;
  rows: ImportPreviewRow[];
}) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const jobId = randomUUID();
      const createdAt = new Date();

      await client.query(
        `INSERT INTO "ImportJob" ("id", "editionId", "operatorId", "filename", "status", "valid", "invalid", "duplicates", "createdAt")
         VALUES ($1, $2, $3, $4, 'PREVIEW', $5, $6, $7, $8)`,
        [
          jobId,
          input.editionId,
          input.operatorId,
          input.filename,
          input.valid,
          input.invalid,
          input.duplicates,
          createdAt,
        ],
      );

      const storedRows = input.rows.map((row) => ({ id: randomUUID(), ...row }));
      if (storedRows.length) {
        const values: unknown[] = [];
        const tuples = storedRows.map((row, index) => {
          const base = index * 8;
          values.push(
            row.id,
            jobId,
            row.row,
            row.name,
            row.ra,
            row.semester,
            row.status,
            row.error,
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        });

        await client.query(
          `INSERT INTO "ImportRow" ("id", "jobId", "row", "name", "ra", "semester", "status", "error") VALUES ${tuples.join(", ")}`,
          values,
        );
      }

      await client.query("COMMIT");
      return {
        id: jobId,
        editionId: input.editionId,
        operatorId: input.operatorId,
        filename: input.filename,
        status: "PREVIEW",
        valid: input.valid,
        invalid: input.invalid,
        duplicates: input.duplicates,
        createdAt,
        confirmedAt: null,
        rows: storedRows,
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // best effort
      }
      throw error;
    }
  });
}

const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export async function confirmImportBulk(input: {
  jobId: string;
  editionId: string;
}) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const jobResult = await client.query(
        `SELECT * FROM "ImportJob" WHERE "id" = $1 AND "editionId" = $2 AND "status" = 'PREVIEW' LIMIT 1`,
        [input.jobId, input.editionId],
      );
      const job = jobResult.rows[0];
      if (!job) {
        const error: any = new Error("Importação não encontrada ou já confirmada.");
        error.status = 404;
        throw error;
      }

      const rowsResult = await client.query(
        `SELECT "name", "ra", "semester" FROM "ImportRow" WHERE "jobId" = $1 AND "status" = 'VALID' ORDER BY "row" ASC`,
        [input.jobId],
      );
      const rows = rowsResult.rows as Array<{ name: string; ra: string; semester: number }>;

      let inserted = 0;
      if (rows.length) {
        const now = new Date();
        const values: unknown[] = [];
        const tuples = rows.map((row, index) => {
          const firstName = String(row.name || "").trim().split(/\s+/)[0] || "";
          const base = index * 10;
          values.push(
            randomUUID(),
            input.editionId,
            row.name,
            firstName,
            normalizeName(firstName),
            String(row.ra),
            Number(row.semester),
            true,
            now,
            now,
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
        });

        const insertedResult = await client.query(
          `INSERT INTO "Participant" ("id", "editionId", "name", "firstName", "normalizedName", "ra", "semester", "active", "createdAt", "updatedAt")
           VALUES ${tuples.join(", ")}
           ON CONFLICT ("editionId", "ra") DO NOTHING
           RETURNING "id"`,
          values,
        );
        inserted = insertedResult.rowCount || 0;
      }

      const confirmedAt = new Date();
      const updatedResult = await client.query(
        `UPDATE "ImportJob" SET "status" = 'IMPORTED', "confirmedAt" = $2 WHERE "id" = $1 RETURNING *`,
        [input.jobId, confirmedAt],
      );

      await client.query("COMMIT");
      return {
        job: updatedResult.rows[0],
        requested: rows.length,
        inserted,
        skipped: Math.max(0, rows.length - inserted),
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // best effort
      }
      throw error;
    }
  });
}
