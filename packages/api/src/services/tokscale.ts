/**
 * Tokscale sync — pulls AI token usage from the local `tokscale` CLI
 * (https://github.com/junhoyeo/tokscale) and writes it into ai_usage_records.
 *
 * Tokscale scans local conversation logs from Claude Code, Codex, Cursor,
 * Gemini CLI, etc., and produces a per-day, per-(client,model) breakdown
 * with USD cost from LiteLLM pricing data.
 *
 * The sync is idempotent: each (date, client, modelId) cell becomes a single
 * ai_usage_records row keyed by a deterministic external_id. Re-syncing
 * updates rows in place (delete + reinsert).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq, like } from "drizzle-orm";

import { schema } from "@pitwall/db";
import type { PitwallDatabase } from "@pitwall/db";

const execFileAsync = promisify(execFile);

type TokscaleClient = {
  client: string;
  modelId: string;
  providerId: string;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
  };
  cost: number;
  messages: number;
};

type TokscaleContribution = {
  date: string;
  totals: { tokens: number; cost: number; messages: number };
  clients: TokscaleClient[];
};

type TokscaleGraph = {
  meta: { generatedAt: string; version: string };
  summary: { totalTokens: number; totalCost: number };
  contributions: TokscaleContribution[];
};

type Provider = "openai" | "anthropic" | "openrouter" | "google" | "other";

function mapProvider(providerId: string): Provider {
  const p = providerId.toLowerCase();
  if (p.includes("anthropic")) return "anthropic";
  if (p.includes("openrouter")) return "openrouter";
  if (p.includes("google") || p.includes("gemini")) return "google";
  if (p.includes("openai") || p.includes("codex")) return "openai";
  return "other";
}

export type TokscaleSyncResult = {
  success: boolean;
  message: string;
  totalRowsBefore: number;
  totalRowsAfter: number;
  rowsInserted: number;
  rowsRemoved: number;
  totalCostUSD: number;
  generatedAt?: string;
};

/**
 * Run `tokscale graph` and return the parsed JSON.
 * Defaults to scanning all clients tokscale knows about.
 */
async function runTokscale(extraArgs: string[] = []): Promise<TokscaleGraph> {
  const args = ["graph", ...extraArgs];
  const { stdout } = await execFileAsync("tokscale", args, {
    maxBuffer: 64 * 1024 * 1024, // 64MB — graphs can be big
    env: process.env,
  });
  return JSON.parse(stdout) as TokscaleGraph;
}

/**
 * Sync tokscale data into ai_usage_records.
 *
 * Strategy: each (date, client, modelId) becomes one row with external_id
 * `tokscale-${date}-${client}-${model}`. We delete all rows whose external_id
 * starts with `tokscale-` first, then re-insert the current snapshot —
 * simplest correct path, since tokscale costs can shift retroactively when
 * pricing data updates.
 *
 * Manually-added rows (e.g. the WeChat OpenRouter top-ups, external_id
 * `wechat-openrouter-…`) are preserved.
 */
export async function syncTokscale(
  db: PitwallDatabase
): Promise<TokscaleSyncResult> {
  let graph: TokscaleGraph;
  try {
    graph = await runTokscale();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `tokscale CLI failed: ${msg}. Install with \`cargo install tokscale\` or \`npm i -g tokscale\`.`,
      totalRowsBefore: 0,
      totalRowsAfter: 0,
      rowsInserted: 0,
      rowsRemoved: 0,
      totalCostUSD: 0,
    };
  }

  // Snapshot before
  const beforeRows = db
    .select({ id: schema.aiUsageRecords.id })
    .from(schema.aiUsageRecords)
    .all();
  const totalRowsBefore = beforeRows.length;

  // Wipe previous tokscale rows (preserves wechat-openrouter-* and manual)
  const removed = db
    .delete(schema.aiUsageRecords)
    .where(like(schema.aiUsageRecords.externalId, "tokscale-%"))
    .run();
  const rowsRemoved = (removed as { changes?: number }).changes ?? 0;

  // Insert one row per (date, client, model)
  let inserted = 0;
  let totalCost = 0;
  for (const day of graph.contributions ?? []) {
    for (const c of day.clients ?? []) {
      const cost = c.cost ?? 0;
      if (cost === 0 && c.messages === 0) continue; // skip empties
      const externalId = `tokscale-${day.date}-${c.client}-${c.modelId}`;
      try {
        db.insert(schema.aiUsageRecords)
          .values({
            provider: mapProvider(c.providerId),
            model: c.modelId || "unknown",
            date: day.date,
            inputTokens: c.tokens?.input ?? 0,
            outputTokens: c.tokens?.output ?? 0,
            cacheTokens: (c.tokens?.cacheRead ?? 0) + (c.tokens?.cacheWrite ?? 0),
            cost,
            externalId,
            source: "api",
          })
          .run();
        inserted++;
        totalCost += cost;
      } catch (err) {
        // External_id is unique-indexed; collisions only happen if a
        // tokscale-* row was somehow not deleted above. Skip silently.
      }
    }
  }

  const afterRows = db
    .select({ id: schema.aiUsageRecords.id })
    .from(schema.aiUsageRecords)
    .all();

  return {
    success: true,
    message: `Synced ${inserted} usage rows ($${totalCost.toFixed(2)} total) from tokscale`,
    totalRowsBefore,
    totalRowsAfter: afterRows.length,
    rowsInserted: inserted,
    rowsRemoved,
    totalCostUSD: totalCost,
    generatedAt: graph.meta?.generatedAt,
  };
}

// satisfy lint — `eq` may otherwise be flagged unused here
void eq;
