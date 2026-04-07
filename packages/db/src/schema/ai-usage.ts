import { sqliteTable, text, real, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const aiUsageRecords = sqliteTable("ai_usage_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text("provider", {
    enum: ["openai", "anthropic", "openrouter", "google", "other"],
  }).notNull(),
  model: text("model").notNull(),
  date: text("date").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheTokens: integer("cache_tokens"),
  cost: real("cost").notNull(),
  externalId: text("external_id"),
  source: text("source", {
    enum: ["api", "csv", "manual"],
  })
    .notNull()
    .default("manual"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index("idx_ai_usage_date").on(t.date),
  index("idx_ai_usage_provider").on(t.provider),
  uniqueIndex("idx_ai_usage_external_id").on(t.externalId),
]);
