import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(), // "Claude Pro", "ChatGPT Plus", "OpenRouter Credits"
  provider: text("provider").notNull(), // "anthropic", "openai", "openrouter", "google", "other"
  type: text("type", {
    enum: ["subscription", "credits", "prepaid"],
  }).notNull(),
  amount: real("amount").notNull(), // monthly cost or credit purchase amount
  currency: text("currency").notNull().default("USD"),
  frequency: text("frequency", {
    enum: ["monthly", "yearly", "one-time"],
  }).notNull(),
  startDate: text("start_date").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index("idx_subscriptions_provider").on(t.provider),
]);

// Track individual subscription payments / credit purchases
export const subscriptionPayments = sqliteTable("subscription_payments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  subscriptionId: text("subscription_id").references(() => subscriptions.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index("idx_sub_payments_date").on(t.date),
  index("idx_sub_payments_sub").on(t.subscriptionId),
]);
