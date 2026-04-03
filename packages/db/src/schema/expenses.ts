import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const categories = sqliteTable("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  domain: text("domain", {
    enum: ["karting", "ai", "investment", "general"],
  }).notNull(),
  parentId: text("parent_id"),
  icon: text("icon"),
  color: text("color"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  expenses: many(expenses),
}));

export const expenses = sqliteTable("expenses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  categoryId: text("category_id").references(() => categories.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  date: text("date").notNull(),
  description: text("description").notNull(),
  notes: text("notes"),
  eventName: text("event_name"),
  trackName: text("track_name"),
  receiptUrl: text("receipt_url"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
  expenseTags: many(expenseTags),
}));

export const tags = sqliteTable("tags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
});

export const tagsRelations = relations(tags, ({ many }) => ({
  expenseTags: many(expenseTags),
}));

export const expenseTags = sqliteTable("expense_tags", {
  expenseId: text("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export const expenseTagsRelations = relations(expenseTags, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseTags.expenseId],
    references: [expenses.id],
  }),
  tag: one(tags, {
    fields: [expenseTags.tagId],
    references: [tags.id],
  }),
}));
