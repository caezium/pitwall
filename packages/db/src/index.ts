import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index";
import path from "path";

const dbPath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "pitwall.db");

// @ts-expect-error -- bypass webpack bundling of native module
const Database = __non_webpack_require__("better-sqlite3");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
export { schema };
