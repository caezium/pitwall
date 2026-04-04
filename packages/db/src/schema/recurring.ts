import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { categories } from "./expenses";

export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  categoryId: text("category_id").references(() => categories.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  description: text("description").notNull(),
  frequency: text("frequency", {
    enum: ["weekly", "biweekly", "monthly", "quarterly", "yearly"],
  }).notNull(),
  nextDate: text("next_date").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
