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

  const rows = input.rows.map((row) => {
    const name = String(row.name || "").trim();
    const firstName = name.split(/\s+/)[0] || "";
    return {
      name,
      firstName,
      normalizedName: normalizeName(firstName),
      ra: String(row.ra || "").trim(),
      semester: Number(row.semester),
    };
  });

  const client = new Client({
    connectionString: connectionString(),
    connectionTimeoutMillis: 10_000,
    application_name: "jornadas-participant-import",
  });

  await client.connect();
  try {
    const result = await client.query(
      `
      INSERT INTO "Participant" (
        "id",
        "editionId",
        "name",
        "firstName",
        "normalizedName",
        "ra",
        "semester",
        "active",
        "createdAt",
        "updatedAt"
      )
      SELECT
        gen_random_uuid()::text,
        $1::text,
        src."name",
        src."firstName",
        src."normalizedName",
        src."ra",
        src."semester",
        TRUE,
        NOW(),
        NOW()
      FROM jsonb_to_recordset($2::jsonb) AS src(
        "name" text,
        "firstName" text,
        "normalizedName" text,
        "ra" text,
        "semester" integer
      )
      WHERE src."name" <> ''
        AND src."ra" <> ''
        AND src."semester" >= 1
      ON CONFLICT ("editionId", "ra") DO NOTHING
      RETURNING "id"
      `,
      [input.editionId, JSON.stringify(rows)],
    );

    return { inserted: result.rowCount || 0 };
  } finally {
    try {
      await client.end();
    } catch {
      // best effort
    }
  }
}
