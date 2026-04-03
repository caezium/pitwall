import { z } from "zod";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

function getPeriodRange(period: string, startDate: string) {
  const now = new Date();
  const start = new Date(startDate);
  let periodStart: Date;
  let periodEnd: Date;

  switch (period) {
    case "monthly": {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    }
    case "quarterly": {
      const q = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), q * 3, 1);
      periodEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
      break;
    }
    case "yearly": {
      periodStart = new Date(now.getFullYear(), 0, 1);
      periodEnd = new Date(now.getFullYear(), 11, 31);
      break;
    }
    default:
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return {
    start: periodStart.toISOString().split("T")[0],
    end: periodEnd.toISOString().split("T")[0],
  };
}

export const budgetsRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    const rows = ctx.db
      .select()
      .from(schema.budgets)
      .leftJoin(schema.categories, eq(schema.budgets.categoryId, schema.categories.id))
      .all();

    return rows.map((r) => ({ ...r.budgets, category: r.categories }));
  }),

  status: publicProcedure.query(({ ctx }) => {
    const rows = ctx.db
      .select()
      .from(schema.budgets)
      .leftJoin(schema.categories, eq(schema.budgets.categoryId, schema.categories.id))
      .all();

    const budgets = rows.map((r) => ({ ...r.budgets, category: r.categories }));

    return budgets.map((budget) => {
      const range = getPeriodRange(budget.period, budget.startDate);

      let spent = 0;
      if (budget.categoryId) {
        const result = ctx.db
          .select({
            total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`,
          })
          .from(schema.expenses)
          .where(
            and(
              eq(schema.expenses.categoryId, budget.categoryId),
              gte(schema.expenses.date, range.start),
              lte(schema.expenses.date, range.end)
            )
          )
          .get();
        spent = result?.total ?? 0;
      } else {
        const result = ctx.db
          .select({
            total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`,
          })
          .from(schema.expenses)
          .where(
            and(
              gte(schema.expenses.date, range.start),
              lte(schema.expenses.date, range.end)
            )
          )
          .get();
        spent = result?.total ?? 0;
      }

      const remaining = budget.amount - spent;
      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      return {
        ...budget,
        spent,
        remaining,
        percentUsed: Math.min(percentUsed, 100),
        overBudget: spent > budget.amount,
        periodRange: range,
      };
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        categoryId: z.string().optional(),
        amount: z.number().positive(),
        period: z.enum(["monthly", "quarterly", "yearly"]),
        rollover: z.boolean().default(false),
        startDate: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(schema.budgets)
        .values(input)
        .returning()
        .get();
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        amount: z.number().positive().optional(),
        period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
        rollover: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db
        .update(schema.budgets)
        .set(data)
        .where(eq(schema.budgets.id, id))
        .returning()
        .get();
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.delete(schema.budgets).where(eq(schema.budgets.id, input.id)).run();
      return { success: true };
    }),

  forecast: publicProcedure
    .input(z.object({ months: z.number().min(1).max(12).default(3) }))
    .query(({ ctx, input }) => {
      // 3-month rolling average forecast
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startDate = threeMonthsAgo.toISOString().split("T")[0];

      const monthlySpending = ctx.db
        .select({
          month: sql<string>`substr(${schema.expenses.date}, 1, 7)`,
          total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`,
        })
        .from(schema.expenses)
        .where(gte(schema.expenses.date, startDate))
        .groupBy(sql`substr(${schema.expenses.date}, 1, 7)`)
        .orderBy(sql`substr(${schema.expenses.date}, 1, 7)`)
        .all();

      const avgMonthly =
        monthlySpending.length > 0
          ? monthlySpending.reduce((s, m) => s + m.total, 0) /
            monthlySpending.length
          : 0;

      const forecast = [];
      for (let i = 1; i <= input.months; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i);
        forecast.push({
          month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          projected: avgMonthly,
        });
      }

      return { historical: monthlySpending, forecast, avgMonthly };
    }),
});
