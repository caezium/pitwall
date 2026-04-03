import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index";
import path from "path";

export type PitwallDatabase = BetterSQLite3Database<typeof schema>;

let _db: PitwallDatabase | null = null;

export function getDb(): PitwallDatabase {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const dbPath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "pitwall.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export { schema };
