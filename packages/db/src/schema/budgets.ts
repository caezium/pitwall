import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { categories } from "./expenses";

export const budgets = sqliteTable("budgets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  categoryId: text("category_id").references(() => categories.id),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  period: text("period", {
    enum: ["monthly", "quarterly", "yearly"],
  }).notNull(),
  rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
  startDate: text("start_date").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));
