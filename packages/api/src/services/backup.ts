/**
 * Backup service: timestamped SQLite snapshots with retention policy.
 *
 * Strategy:
 * - Use SQLite's online backup API (better-sqlite3 `db.backup()`) so we can
 *   snapshot a live, opened database without corrupting WAL state.
 * - Backups land in $BACKUP_DIR (default: <dbDir>/backups/) with filenames
 *   like `pitwall-2026-05-06T08-15-22Z.db`.
 * - Retention: keep the last N daily backups + everything from the last 7
 *   days. Older backups are pruned automatically after each run.
 * - Auto-schedule: runs once at startup, then every $BACKUP_INTERVAL_HOURS
 *   hours (default 6). Disable with PITWALL_AUTO_BACKUP=0.
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import path from "path";

import { getRawSqlite, getDbPath as getDbPathFromDbPkg } from "@pitwall/db";

export type BackupFile = {
  name: string;
  path: string;
  size: number;
  mtime: string; // ISO
};

export type BackupStatus = {
  dbPath: string;
  backupDir: string;
  lastBackupAt: string | null;
  lastBackupPath: string | null;
  nextScheduledAt: string | null;
  autoBackupEnabled: boolean;
  intervalHours: number;
  backupCount: number;
  totalSizeBytes: number;
};

// Filenames look like: pitwall-2026-05-06T11-20-18-810Z.db (ms precision so
// concurrent backups never collide).
const FILENAME_RE = /^pitwall-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.db$/;

export function getDbPath(): string {
  return getDbPathFromDbPkg();
}

export function getBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  return path.join(path.dirname(getDbPath()), "backups");
}

export function getIntervalHours(): number {
  const n = Number(process.env.BACKUP_INTERVAL_HOURS ?? 6);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

export function isAutoBackupEnabled(): boolean {
  return process.env.PITWALL_AUTO_BACKUP !== "0";
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function fmtTs(d: Date): string {
  // 2026-05-06T08-15-22-123Z (filesystem-safe ISO with millisecond precision)
  return d.toISOString().replace(/[:.]/g, "-").replace(/-Z$/, "Z");
}

function parseTs(name: string): Date | null {
  const m = FILENAME_RE.exec(name);
  if (!m) return null;
  // Restore colons (HH:MM:SS) and the dot before milliseconds.
  const iso = m[1].replace(
    /^(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1$2:$3:$4.$5Z"
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function listBackups(): BackupFile[] {
  const dir = getBackupDir();
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir)
    .filter((n) => FILENAME_RE.test(n))
    .map((name) => {
      const full = path.join(dir, name);
      const st = statSync(full);
      return {
        name,
        path: full,
        size: st.size,
        mtime: st.mtime.toISOString(),
      } satisfies BackupFile;
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
  return entries;
}

/**
 * Take a snapshot of the live SQLite database via the online backup API.
 * Safe to run while the app is serving requests.
 *
 * After the backup we open the destination once in DELETE journal mode
 * to force a checkpoint, which collapses any -shm/-wal sidecars into the
 * main file so the backup is a single, self-contained .db.
 */
export async function createBackup(): Promise<BackupFile> {
  const dir = getBackupDir();
  ensureDir(dir);
  const name = `pitwall-${fmtTs(new Date())}.db`;
  const full = path.join(dir, name);

  await getRawSqlite().backup(full);

  // Collapse the WAL into the main db file so the backup is a single file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const dest = new Database(full);
  try {
    dest.pragma("journal_mode = DELETE");
  } finally {
    dest.close();
  }

  const st = statSync(full);
  return { name, path: full, size: st.size, mtime: st.mtime.toISOString() };
}

/**
 * Retention: keep all backups newer than `keepDays` days,
 * plus the most-recent `keepCount` regardless of age.
 */
export function pruneBackups(opts: { keepDays?: number; keepCount?: number } = {}): {
  removed: string[];
  kept: number;
} {
  const keepDays = opts.keepDays ?? 7;
  const keepCount = opts.keepCount ?? 10;
  const all = listBackups();
  const cutoff = Date.now() - keepDays * 86_400_000;
  const removed: string[] = [];

  for (let i = 0; i < all.length; i++) {
    const f = all[i];
    if (i < keepCount) continue;
    const ts = parseTs(f.name)?.getTime() ?? new Date(f.mtime).getTime();
    if (ts > cutoff) continue;
    try {
      unlinkSync(f.path);
      removed.push(f.name);
    } catch {
      // ignore – best-effort cleanup
    }
  }
  return { removed, kept: all.length - removed.length };
}

export function getStatus(): BackupStatus {
  const all = listBackups();
  const last = all[0];
  const intervalHours = getIntervalHours();
  return {
    dbPath: getDbPath(),
    backupDir: getBackupDir(),
    lastBackupAt: last?.mtime ?? null,
    lastBackupPath: last?.path ?? null,
    nextScheduledAt:
      last && isAutoBackupEnabled()
        ? new Date(new Date(last.mtime).getTime() + intervalHours * 3600_000).toISOString()
        : null,
    autoBackupEnabled: isAutoBackupEnabled(),
    intervalHours,
    backupCount: all.length,
    totalSizeBytes: all.reduce((s, f) => s + f.size, 0),
  };
}

// --- scheduler ---------------------------------------------------------------

let scheduled = false;

/**
 * Start the auto-backup loop. Idempotent: safe to call multiple times in
 * Next.js dev where modules are re-evaluated. Disable with
 * PITWALL_AUTO_BACKUP=0.
 */
export function startAutoBackup(): void {
  if (scheduled) return;
  if (!isAutoBackupEnabled()) return;
  scheduled = true;

  const intervalMs = getIntervalHours() * 3600_000;

  const run = async () => {
    try {
      const file = await createBackup();
      const { removed } = pruneBackups();
      const tag = removed.length ? ` (pruned ${removed.length})` : "";
      // eslint-disable-next-line no-console
      console.log(`[pitwall] backup → ${file.name} (${(file.size / 1024).toFixed(1)} KB)${tag}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[pitwall] backup failed:", err);
    }
  };

  // First run shortly after boot (give the app a moment to settle), then on interval.
  setTimeout(run, 5_000);
  setInterval(run, intervalMs).unref?.();
}
