import { z } from "zod";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (val: unknown) => {
    const str = val == null ? "" : String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export const exportRouter = router({
  expenses: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).default({})
    )
    .query(({ ctx, input }) => {
      const conditions = [];
      if (input.startDate) conditions.push(gte(schema.expenses.date, input.startDate));
      if (input.endDate) conditions.push(lte(schema.expenses.date, input.endDate));

      const rows = ctx.db
        .select({
          date: schema.expenses.date,
          description: schema.expenses.description,
          amount: schema.expenses.amount,
          currency: schema.expenses.currency,
          category: schema.categories.name,
          domain: schema.categories.domain,
          eventName: schema.expenses.eventName,
          trackName: schema.expenses.trackName,
          notes: schema.expenses.notes,
        })
        .from(schema.expenses)
        .leftJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.expenses.date))
        .all();

      return toCSV(
        ["date", "description", "amount", "currency", "category", "domain", "eventName", "trackName", "notes"],
        rows
      );
    }),

  aiUsage: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).default({})
    )
    .query(({ ctx, input }) => {
      const conditions = [];
      if (input.startDate) conditions.push(gte(schema.aiUsageRecords.date, input.startDate));
      if (input.endDate) conditions.push(lte(schema.aiUsageRecords.date, input.endDate));

      const rows = ctx.db
        .select()
        .from(schema.aiUsageRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.aiUsageRecords.date))
        .all();

      return toCSV(
        ["date", "provider", "model", "inputTokens", "outputTokens", "cacheTokens", "cost", "source"],
        rows
      );
    }),

  trades: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).default({})
    )
    .query(({ ctx, input }) => {
      const conditions = [];
      if (input.startDate) conditions.push(gte(schema.trades.tradeDate, input.startDate));
      if (input.endDate) conditions.push(lte(schema.trades.tradeDate, input.endDate));

      const rows = ctx.db
        .select()
        .from(schema.trades)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.trades.tradeDate))
        .all();

      return toCSV(
        ["tradeDate", "symbol", "action", "quantity", "price", "commission", "accountId"],
        rows
      );
    }),
});
