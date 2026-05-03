import { sql } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

export const dashboardRouter = router({
  overview: publicProcedure.query(async ({ ctx }) => {
    // Use rolling 30-day window so recent activity always shows
    // (avoids "empty dashboard" when current calendar month has no data yet)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const windowStart = thirtyDaysAgo.toISOString().split("T")[0];

    // Recent expenses (rolling 30 days)
    const [monthlyExpenses] = await ctx.db
      .select({
        total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(schema.expenses)
      .where(sql`${schema.expenses.date} >= ${windowStart}`);

    // Expenses by domain (rolling 30 days)
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
      .where(sql`${schema.expenses.date} >= ${windowStart}`)
      .groupBy(schema.categories.domain);

    // AI costs (rolling 30 days)
    const [aiCosts] = await ctx.db
      .select({
        total: sql<number>`coalesce(sum(${schema.aiUsageRecords.cost}), 0)`,
      })
      .from(schema.aiUsageRecords)
      .where(sql`${schema.aiUsageRecords.date} >= ${windowStart}`);

    // Active subscriptions monthly equivalent
    const activeSubs = await ctx.db
      .select()
      .from(schema.subscriptions)
      .where(sql`${schema.subscriptions.active} = 1`);

    const subscriptionMonthly = activeSubs.reduce((sum, s) => {
      if (s.frequency === "monthly") return sum + s.amount;
      if (s.frequency === "yearly") return sum + s.amount / 12;
      return sum;
    }, 0);

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
      subscriptionMonthly,
      activeSubsCount: activeSubs.length,
      portfolio: latestSnapshot
        ? {
            netLiquidation: latestSnapshot.netLiquidation,
            cash: latestSnapshot.cash,
            date: latestSnapshot.date,
          }
        : null,
      recentExpenses,
      windowStart,
    };
  }),
});
