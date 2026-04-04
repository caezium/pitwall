import { eq, sql } from "drizzle-orm";
import { schema } from "@pitwall/db";
import type { PitwallDatabase } from "@pitwall/db";
import { withRetry } from "../lib/retry";
import { decrypt } from "../lib/crypto";

type AISyncResult = {
  provider: string;
  recordsInserted: number;
  errors: string[];
};

export class AIBillingService {
  constructor(private db: PitwallDatabase) {}

  private logSync(service: string, status: "success" | "failed" | "partial", recordsInserted: number, message: string, errorDetail?: string, durationMs?: number) {
    this.db.insert(schema.syncLogs).values({ service, status, recordsInserted, message, errorDetail, durationMs }).run();
  }

  async syncAnthropic(adminApiKey: string): Promise<AISyncResult> {
    const result: AISyncResult = { provider: "anthropic", recordsInserted: 0, errors: [] };
    const start = Date.now();

    try {
      const lastRecord = this.db
        .select({ date: schema.aiUsageRecords.date })
        .from(schema.aiUsageRecords)
        .where(eq(schema.aiUsageRecords.provider, "anthropic"))
        .orderBy(sql`${schema.aiUsageRecords.date} DESC`)
        .limit(1)
        .get();

      const startDate = lastRecord?.date ?? this.getDefaultStartDate();
      const endDate = new Date().toISOString().split("T")[0];

      const costData = await withRetry(
        async () => {
          const res = await fetch(
            `https://api.anthropic.com/v1/organizations/cost_report?` +
              new URLSearchParams({
                starting_at: `${startDate}T00:00:00Z`,
                ending_at: `${endDate}T23:59:59Z`,
                bucket_width: "1d",
                group_by: "model",
              }),
            { headers: { "x-api-key": adminApiKey, "anthropic-version": "2023-06-01" } }
          );
          if (!res.ok) throw new Error(`Anthropic cost API returned ${res.status}`);
          return res.json();
        },
        { attempts: 3, delayMs: 2000, onRetry: (_, attempt) => result.errors.push(`Retry ${attempt} for Anthropic cost API`) }
      );

      let usageData: any = null;
      try {
        usageData = await withRetry(
          async () => {
            const res = await fetch(
              `https://api.anthropic.com/v1/organizations/usage_report/messages?` +
                new URLSearchParams({
                  starting_at: `${startDate}T00:00:00Z`,
                  ending_at: `${endDate}T23:59:59Z`,
                  bucket_width: "1d",
                  group_by: "model",
                }),
              { headers: { "x-api-key": adminApiKey, "anthropic-version": "2023-06-01" } }
            );
            if (!res.ok) throw new Error(`Anthropic usage API returned ${res.status}`);
            return res.json();
          },
          { attempts: 3, delayMs: 2000 }
        );
      } catch {
        // Usage data is optional; cost data is sufficient
      }

      if (costData?.data) {
        for (const bucket of costData.data) {
          const date = bucket.started_at?.split("T")[0] ?? bucket.date ?? startDate;
          const model = bucket.model ?? "unknown";
          const cost = bucket.cost_usd ?? bucket.total_cost ?? 0;
          const externalId = `anthropic-${date}-${model}`;

          const existing = this.db.select({ id: schema.aiUsageRecords.id }).from(schema.aiUsageRecords).where(eq(schema.aiUsageRecords.externalId, externalId)).get();
          if (existing) continue;

          let inputTokens = 0, outputTokens = 0, cacheTokens = 0;
          if (usageData?.data) {
            const match = usageData.data.find((u: any) => (u.started_at?.split("T")[0] ?? u.date) === date && u.model === model);
            if (match) {
              inputTokens = match.input_tokens ?? match.uncached_input_tokens ?? 0;
              outputTokens = match.output_tokens ?? 0;
              cacheTokens = match.cache_creation_tokens ?? match.cached_input_tokens ?? 0;
            }
          }

          this.db.insert(schema.aiUsageRecords).values({ provider: "anthropic", model, date, inputTokens, outputTokens, cacheTokens, cost, externalId, source: "api" }).run();
          result.recordsInserted++;
        }
      }

      this.logSync("anthropic", result.errors.length > 0 ? "partial" : "success", result.recordsInserted, `Synced ${result.recordsInserted} records`, undefined, Date.now() - start);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Anthropic sync error: ${msg}`);
      this.logSync("anthropic", "failed", 0, "Sync failed", msg, Date.now() - start);
    }

    return result;
  }

  async syncOpenAI(apiKey: string): Promise<AISyncResult> {
    const result: AISyncResult = { provider: "openai", recordsInserted: 0, errors: [] };
    const start = Date.now();

    try {
      const lastRecord = this.db
        .select({ date: schema.aiUsageRecords.date })
        .from(schema.aiUsageRecords)
        .where(eq(schema.aiUsageRecords.provider, "openai"))
        .orderBy(sql`${schema.aiUsageRecords.date} DESC`)
        .limit(1)
        .get();

      const startDate = lastRecord?.date ?? this.getDefaultStartDate();

      const data = await withRetry(
        async () => {
          const res = await fetch(
            `https://api.openai.com/v1/organization/usage/completions?` +
              new URLSearchParams({
                start_time: String(Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)),
                bucket_width: "1d",
                group_by: "model",
              }),
            { headers: { Authorization: `Bearer ${apiKey}` } }
          );
          if (!res.ok) throw new Error(`OpenAI API returned ${res.status}`);
          return res.json();
        },
        { attempts: 3, delayMs: 2000, onRetry: (_, attempt) => result.errors.push(`Retry ${attempt} for OpenAI API`) }
      );

      if (data?.data) {
        for (const bucket of data.data) {
          const date = new Date((bucket.start_time ?? 0) * 1000).toISOString().split("T")[0];
          for (const item of bucket.results ?? []) {
            const model = item.model ?? "unknown";
            const inputTokens = item.input_tokens ?? 0;
            const outputTokens = item.output_tokens ?? 0;
            const cost = ((item.input_cost ?? 0) + (item.output_cost ?? 0)) / 100;
            const externalId = `openai-${date}-${model}`;

            const existing = this.db.select({ id: schema.aiUsageRecords.id }).from(schema.aiUsageRecords).where(eq(schema.aiUsageRecords.externalId, externalId)).get();
            if (existing) continue;

            this.db.insert(schema.aiUsageRecords).values({ provider: "openai", model, date, inputTokens, outputTokens, cost, externalId, source: "api" }).run();
            result.recordsInserted++;
          }
        }
      }

      this.logSync("openai", result.errors.length > 0 ? "partial" : "success", result.recordsInserted, `Synced ${result.recordsInserted} records`, undefined, Date.now() - start);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`OpenAI sync error: ${msg}`);
      this.logSync("openai", "failed", 0, "Sync failed", msg, Date.now() - start);
    }

    return result;
  }

  async syncAll(keys: { anthropicAdminKey?: string; openaiKey?: string }): Promise<AISyncResult[]> {
    const results: AISyncResult[] = [];
    if (keys.anthropicAdminKey) results.push(await this.syncAnthropic(keys.anthropicAdminKey));
    if (keys.openaiKey) results.push(await this.syncOpenAI(keys.openaiKey));
    return results;
  }

  private getDefaultStartDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }
}
