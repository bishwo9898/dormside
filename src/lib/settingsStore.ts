import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

type SettingsRecord = {
  isOpen: boolean;
};

type SettingsRow = {
  is_open: boolean;
};

const settingsPath = path.join(process.cwd(), "src", "data", "settings.json");
const databaseUrl = process.env.DATABASE_URL;
const useDatabase = Boolean(databaseUrl);
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const globalForPg = globalThis as unknown as { pgPool?: Pool };
const pool =
  globalForPg.pgPool ??
  (databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
      })
    : null);

if (!globalForPg.pgPool && pool) {
  globalForPg.pgPool = pool;
}

const ensureSettingsTable = async () => {
  if (!pool) {
    return;
  }

  await pool.query(`
    create table if not exists store_settings (
      id boolean primary key default true,
      is_open boolean not null
    );
  `);

  await pool.query(
    "insert into store_settings (id, is_open) values (true, true) on conflict (id) do nothing",
  );
};

const readSettingsFile = async (): Promise<SettingsRecord> => {
  if (useDatabase && pool) {
    await ensureSettingsTable();
    const result = await pool.query<SettingsRow>(
      "select is_open from store_settings where id = true",
    );
    const row = result.rows[0];
    return { isOpen: row ? Boolean(row.is_open) : true };
  }

  try {
    const file = await fs.readFile(settingsPath, "utf-8");
    const data = JSON.parse(file) as SettingsRecord | null;
    return { isOpen: Boolean(data?.isOpen) };
  } catch {
    return { isOpen: true };
  }
};

const writeSettingsFile = async (settings: SettingsRecord) => {
  if (useDatabase) {
    return;
  }

  if (isVercel) {
    throw new Error(
      "Settings storage is not configured. Set DATABASE_URL to a Postgres database.",
    );
  }

  const payload = JSON.stringify(settings, null, 2);
  await fs.writeFile(settingsPath, payload, "utf-8");
};

export const getSettings = async (): Promise<SettingsRecord> => {
  return readSettingsFile();
};

export const updateSettings = async (
  next: SettingsRecord,
): Promise<SettingsRecord> => {
  const sanitized = { isOpen: Boolean(next.isOpen) };

  if (useDatabase && pool) {
    await ensureSettingsTable();
    await pool.query(
      "update store_settings set is_open = $1 where id = true",
      [sanitized.isOpen],
    );
    return sanitized;
  }

  await writeSettingsFile(sanitized);
  return sanitized;
};
