"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function isInICloud(p: string): boolean {
  return p.includes("Mobile Documents") || p.includes("CloudDocs");
}

export function BackupsCard() {
  const status = trpc.backup.status.useQuery(undefined, { refetchInterval: 30_000 });
  const list = trpc.backup.list.useQuery(undefined, { refetchInterval: 30_000 });
  const utils = trpc.useUtils();
  const [flash, setFlash] = useState<string | null>(null);

  const backupNow = trpc.backup.now.useMutation({
    onSuccess: ({ file, pruned }) => {
      const msg = pruned.length
        ? `Backed up ${file.name} · pruned ${pruned.length}`
        : `Backed up ${file.name}`;
      setFlash(msg);
      setTimeout(() => setFlash(null), 3000);
      utils.backup.status.invalidate();
      utils.backup.list.invalidate();
    },
    onError: (err) => {
      setFlash(`Error: ${err.message}`);
      setTimeout(() => setFlash(null), 5000);
    },
  });

  const s = status.data;
  const items = list.data ?? [];
  const inCloud = s ? isInICloud(s.dbPath) : false;
  const backupsInCloud = s ? isInICloud(s.backupDir) : false;

  return (
    <div className="finance-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Backups
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Local snapshots of your database. Auto-runs every {s?.intervalHours ?? 6}h
            {s?.autoBackupEnabled ? "" : " (currently disabled)"}.
          </p>
        </div>
        <button
          onClick={() => backupNow.mutate()}
          disabled={backupNow.isPending}
          className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent-blue)", color: "#fff" }}
        >
          {backupNow.isPending ? "Backing up…" : "Backup now"}
        </button>
      </div>

      {flash && (
        <div
          className="text-xs mb-3 px-3 py-2 rounded-lg"
          style={{
            background: flash.startsWith("Error") ? "var(--bg-input)" : "var(--bg-input)",
            color: flash.startsWith("Error") ? "var(--accent-red)" : "var(--accent-green)",
          }}
        >
          {flash}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 mb-3">
        <Row label="Last backup" value={formatRelative(s?.lastBackupAt ?? null)} />
        <Row
          label="Total"
          value={`${s?.backupCount ?? 0} files · ${formatBytes(s?.totalSizeBytes ?? 0)}`}
        />
        <Row
          label="Database"
          value={s?.dbPath ?? ""}
          mono
          badge={inCloud ? "iCloud" : null}
        />
        <Row
          label="Backup dir"
          value={s?.backupDir ?? ""}
          mono
          badge={backupsInCloud ? "iCloud" : null}
        />
      </div>

      {items.length > 0 && (
        <details className="mt-3">
          <summary
            className="text-xs cursor-pointer select-none"
            style={{ color: "var(--text-muted)" }}
          >
            Show {items.length} backup{items.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {items.map((b) => (
              <div
                key={b.path}
                className="text-xs flex items-center justify-between mono"
                style={{ color: "var(--text-secondary)" }}
              >
                <span>{b.name}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {formatBytes(b.size)} · {formatRelative(b.mtime)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
        To restore, stop the app and{" "}
        <span className="mono">cp &lt;backup&gt; {s?.dbPath ?? "<db>"}</span>.
        {!inCloud && (
          <>
            {" "}For automatic cloud sync, run{" "}
            <span className="mono">scripts/setup-icloud.sh</span> to move the DB
            into iCloud Drive.
          </>
        )}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className={mono ? "mono break-all" : ""}
        style={{ color: "var(--text-primary)" }}
      >
        {value}
        {badge && (
          <span
            className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: "var(--accent-blue)", color: "#fff" }}
          >
            {badge}
          </span>
        )}
      </span>
    </div>
  );
}
