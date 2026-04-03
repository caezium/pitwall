import { eq, and, gte, sql } from "drizzle-orm";
import { schema } from "@pitwall/db";
import type { PitwallDatabase } from "@pitwall/db";

type AISyncResult = {
  provider: string;
  recordsInserted: number;
  errors: string[];
};

export class AIBillingService {
  constructor(private db: PitwallDatabase) {}

  async syncAnthropic(adminApiKey: string): Promise<AISyncResult> {
    const result: AISyncResult = {
      provider: "anthropic",
      recordsInserted: 0,
      errors: [],
    };

    try {
      // Get last synced date for incremental sync
      const lastRecord = this.db
        .select({ date: schema.aiUsageRecords.date })
        .from(schema.aiUsageRecords)
        .where(eq(schema.aiUsageRecords.provider, "anthropic"))
        .orderBy(sql`${schema.aiUsageRecords.date} DESC`)
        .limit(1)
        .get();

      const startDate = lastRecord?.date ?? this.getDefaultStartDate();
      const endDate = new Date().toISOString().split("T")[0];

      // Fetch cost report
      const costRes = await fetch(
        `https://api.anthropic.com/v1/organizations/cost_report?` +
          new URLSearchParams({
            starting_at: `${startDate}T00:00:00Z`,
            ending_at: `${endDate}T23:59:59Z`,
            bucket_width: "1d",
            group_by: "model",
          }),
        {
          headers: {
            "x-api-key": adminApiKey,
            "anthropic-version": "2023-06-01",
          },
        }
      );

      if (!costRes.ok) {
        result.errors.push(
          `Anthropic cost API returned ${costRes.status}: ${await costRes.text()}`
        );
        return result;
      }

      const costData = await costRes.json();

      // Fetch usage report for token counts
      const usageRes = await fetch(
        `https://api.anthropic.com/v1/organizations/usage_report/messages?` +
          new URLSearchParams({
            starting_at: `${startDate}T00:00:00Z`,
            ending_at: `${endDate}T23:59:59Z`,
            bucket_width: "1d",
            group_by: "model",
          }),
        {
          headers: {
            "x-api-key": adminApiKey,
            "anthropic-version": "2023-06-01",
          },
        }
      );

      let usageData: any = null;
      if (usageRes.ok) {
        usageData = await usageRes.json();
      }

      // Process cost buckets
      if (costData?.data) {
        for (const bucket of costData.data) {
          const date =
            bucket.started_at?.split("T")[0] ?? bucket.date ?? startDate;
          const model = bucket.model ?? "unknown";
          const cost = bucket.cost_usd ?? bucket.total_cost ?? 0;
          const externalId = `anthropic-${date}-${model}`;

          // Check for duplicate
          const existing = this.db
            .select({ id: schema.aiUsageRecords.id })
            .from(schema.aiUsageRecords)
            .where(eq(schema.aiUsageRecords.externalId, externalId))
            .get();

          if (existing) continue;

          // Find matching usage data for token counts
          let inputTokens = 0;
          let outputTokens = 0;
          let cacheTokens = 0;
          if (usageData?.data) {
            const match = usageData.data.find(
              (u: any) =>
                (u.started_at?.split("T")[0] ?? u.date) === date &&
                u.model === model
            );
            if (match) {
              inputTokens = match.input_tokens ?? match.uncached_input_tokens ?? 0;
              outputTokens = match.output_tokens ?? 0;
              cacheTokens = match.cache_creation_tokens ?? match.cached_input_tokens ?? 0;
            }
          }

          this.db
            .insert(schema.aiUsageRecords)
            .values({
              provider: "anthropic",
              model,
              date,
              inputTokens,
              outputTokens,
              cacheTokens,
              cost,
              externalId,
              source: "api",
            })
            .run();

          result.recordsInserted++;
        }
      }
    } catch (err) {
      result.errors.push(
        `Anthropic sync error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return result;
  }

  async syncOpenAI(apiKey: string): Promise<AISyncResult> {
    const result: AISyncResult = {
      provider: "openai",
      recordsInserted: 0,
      errors: [],
    };

    try {
      const lastRecord = this.db
        .select({ date: schema.aiUsageRecords.date })
        .from(schema.aiUsageRecords)
        .where(eq(schema.aiUsageRecords.provider, "openai"))
        .orderBy(sql`${schema.aiUsageRecords.date} DESC`)
        .limit(1)
        .get();

      const startDate = lastRecord?.date ?? this.getDefaultStartDate();

      // OpenAI usage endpoint
      const res = await fetch(
        `https://api.openai.com/v1/organization/usage/completions?` +
          new URLSearchParams({
            start_time: String(
              Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)
            ),
            bucket_width: "1d",
            group_by: ["model"].toString(),
          }),
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (!res.ok) {
        // Fallback: try the older /v1/usage endpoint
        const fallbackRes = await fetch(
          `https://api.openai.com/v1/usage?date=${startDate}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        if (!fallbackRes.ok) {
          result.errors.push(
            `OpenAI API returned ${res.status}. Fallback also failed: ${fallbackRes.status}`
          );
          return result;
        }

        const fallbackData = await fallbackRes.json();
        if (fallbackData?.data) {
          for (const item of fallbackData.data) {
            const date = startDate;
            const model = item.snapshot_id ?? item.model ?? "unknown";
            const inputTokens = item.n_context_tokens_total ?? 0;
            const outputTokens = item.n_generated_tokens_total ?? 0;
            const externalId = `openai-${date}-${model}`;

            const existing = this.db
              .select({ id: schema.aiUsageRecords.id })
              .from(schema.aiUsageRecords)
              .where(eq(schema.aiUsageRecords.externalId, externalId))
              .get();
            if (existing) continue;

            this.db
              .insert(schema.aiUsageRecords)
              .values({
                provider: "openai",
                model,
                date,
                inputTokens,
                outputTokens,
                cost: 0, // older endpoint doesn't include cost
                externalId,
                source: "api",
              })
              .run();
            result.recordsInserted++;
          }
        }
        return result;
      }

      const data = await res.json();

      if (data?.data) {
        for (const bucket of data.data) {
          const date = new Date((bucket.start_time ?? 0) * 1000)
            .toISOString()
            .split("T")[0];

          for (const result_item of bucket.results ?? []) {
            const model = result_item.model ?? "unknown";
            const inputTokens = result_item.input_tokens ?? 0;
            const outputTokens = result_item.output_tokens ?? 0;
            const cost =
              (result_item.input_cost ?? 0) + (result_item.output_cost ?? 0);
            const externalId = `openai-${date}-${model}`;

            const existing = this.db
              .select({ id: schema.aiUsageRecords.id })
              .from(schema.aiUsageRecords)
              .where(eq(schema.aiUsageRecords.externalId, externalId))
              .get();
            if (existing) continue;

            this.db
              .insert(schema.aiUsageRecords)
              .values({
                provider: "openai",
                model,
                date,
                inputTokens,
                outputTokens,
                cost: cost / 100, // API returns cents
                externalId,
                source: "api",
              })
              .run();
            result.recordsInserted++;
          }
        }
      }
    } catch (err) {
      result.errors.push(
        `OpenAI sync error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return result;
  }

  async syncAll(keys: {
    anthropicAdminKey?: string;
    openaiKey?: string;
  }): Promise<AISyncResult[]> {
    const results: AISyncResult[] = [];

    if (keys.anthropicAdminKey) {
      results.push(await this.syncAnthropic(keys.anthropicAdminKey));
    }
    if (keys.openaiKey) {
      results.push(await this.syncOpenAI(keys.openaiKey));
    }

    return results;
  }

  private getDefaultStartDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }
}
