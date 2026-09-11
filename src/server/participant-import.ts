import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { env } from "cloudflare:workers";

export type ParticipantImportRow = {
  name: string;
  ra: string;
  semester: number;
};

function connectionString() {
  const hyperdrive = (env as any)?.HYPERDRIVE?.connectionString;
  if (hyperdrive) return hyperdrive;
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL não configurada no Worker.");
  return value;
}

const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export async function insertParticipantsBulk(input: {
  editionId: string;
  rows: ParticipantImportRow[];
}) {
  if (!input.rows.length) return { inserted: 0 };

  const client = new Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: 10_000,
    application_name: "jornadas-participant-import",
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    const now = new Date();
    const values: unknown[] = [];
    const tuples = input.rows.map((row, index) => {
      const firstName = String(row.name || "").trim().split(/\s+/)[0] || "";
      const base = index * 10;
      values.push(
        randomUUID(),
        input.editionId,
        String(row.name || "").trim(),
        firstName,
        normalizeName(firstName),
        String(row.ra || "").trim(),
        Number(row.semester),
        true,
        now,
        now,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
    });

    const result = await client.query(
      `INSERT INTO "Participant" ("id", "editionId", "name", "firstName", "normalizedName", "ra", "semester", "active", "createdAt", "updatedAt")
       VALUES ${tuples.join(", ")}
       RETURNING "id"`,
      values,
    );

    await client.query("COMMIT");
    return { inserted: result.rowCount || 0 };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // best effort
    }
    throw error;
  } finally {
    try {
      await client.end();
    } catch {
      // best effort
    }
  }
}
