import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index";
import path from "path";

export type PitwallDatabase = BetterSQLite3Database<typeof schema>;

// Minimal shape of better-sqlite3's Database, just the bits we need outside
// the regular Drizzle query path (online backups, etc).
export type RawSqlite = {
  backup: (destination: string) => Promise<{ pages: number }>;
  pragma: (cmd: string) => unknown;
  close: () => void;
};

let _db: PitwallDatabase | null = null;
let _raw: RawSqlite | null = null;

export function getDbPath(): string {
  return process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "pitwall.db");
}

export function getDb(): PitwallDatabase {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const sqlite = new Database(getDbPath());
    sqlite.pragma("journal_mode = WAL");
    _raw = sqlite as RawSqlite;
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

/**
 * Returns the raw better-sqlite3 Database handle for operations Drizzle
 * doesn't expose (e.g. the online backup API). Triggers DB initialization
 * on first call.
 */
export function getRawSqlite(): RawSqlite {
  getDb();
  if (!_raw) throw new Error("SQLite handle not initialized");
  return _raw;
}

export { schema };
