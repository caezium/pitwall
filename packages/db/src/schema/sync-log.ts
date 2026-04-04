import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const syncLogs = sqliteTable("sync_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  service: text("service").notNull(), // "anthropic", "openai", "ibkr"
  status: text("status", {
    enum: ["success", "failed", "partial"],
  }).notNull(),
  recordsInserted: integer("records_inserted").notNull().default(0),
  message: text("message"),
  errorDetail: text("error_detail"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index("idx_sync_logs_service").on(t.service),
  index("idx_sync_logs_created").on(t.createdAt),
]);
