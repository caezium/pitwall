import { sql } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

export const dashboardRouter = router({
  overview: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const yearStart = `${now.getFullYear()}-01-01`;

    // Monthly expenses
    const [monthlyExpenses] = await ctx.db
      .select({
        total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(schema.expenses)
      .where(sql`${schema.expenses.date} >= ${monthStart}`);

    // Expenses by domain this month
    const domainBreakdown = await ctx.db
      .select({
        domain: schema.categories.domain,
        total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`,
      })
      .from(schema.expenses)
      .leftJoin(
        schema.categories,
        sql`${schema.expenses.categoryId} = ${schema.categories.id}`
      )
      .where(sql`${schema.expenses.date} >= ${monthStart}`)
      .groupBy(schema.categories.domain);

    // AI costs this month
    const [aiCosts] = await ctx.db
      .select({
        total: sql<number>`coalesce(sum(${schema.aiUsageRecords.cost}), 0)`,
      })
      .from(schema.aiUsageRecords)
      .where(sql`${schema.aiUsageRecords.date} >= ${monthStart}`);

    // Latest portfolio snapshot
    const latestSnapshot = await ctx.db.query.portfolioSnapshots.findFirst({
      orderBy: (s, { desc }) => [desc(s.date)],
    });

    // Recent expenses
    const recentExpenses = await ctx.db.query.expenses.findMany({
      with: { category: true },
      orderBy: (e, { desc }) => [desc(e.date)],
      limit: 5,
    });

    return {
      monthlyBurn: monthlyExpenses?.total ?? 0,
      monthlyTransactions: monthlyExpenses?.count ?? 0,
      domainBreakdown,
      aiCostsMtd: aiCosts?.total ?? 0,
      portfolio: latestSnapshot
        ? {
            netLiquidation: latestSnapshot.netLiquidation,
            cash: latestSnapshot.cash,
            date: latestSnapshot.date,
          }
        : null,
      recentExpenses,
    };
  }),
});
