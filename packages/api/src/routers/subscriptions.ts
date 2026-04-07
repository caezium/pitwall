import { z } from "zod";
import { eq, desc, sql, gte } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

export const subscriptionsRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(schema.subscriptions).orderBy(desc(schema.subscriptions.createdAt)).all();
  }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      provider: z.string().min(1),
      type: z.enum(["subscription", "credits", "prepaid"]),
      amount: z.number().positive(),
      currency: z.string().default("USD"),
      frequency: z.enum(["monthly", "yearly", "one-time"]),
      startDate: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(schema.subscriptions).values(input).returning().get();
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      amount: z.number().positive().optional(),
      active: z.boolean().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(schema.subscriptions).set(data).where(eq(schema.subscriptions.id, id)).returning().get();
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, input.id)).run();
      return { success: true };
    }),

  // Record a payment for a subscription
  addPayment: publicProcedure
    .input(z.object({
      subscriptionId: z.string(),
      amount: z.number().positive(),
      date: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(schema.subscriptionPayments).values(input).returning().get();
    }),

  payments: publicProcedure
    .input(z.object({ subscriptionId: z.string().optional() }).default({}))
    .query(({ ctx, input }) => {
      if (input.subscriptionId) {
        return ctx.db.select().from(schema.subscriptionPayments)
          .where(eq(schema.subscriptionPayments.subscriptionId, input.subscriptionId))
          .orderBy(desc(schema.subscriptionPayments.date)).all();
      }
      return ctx.db.select().from(schema.subscriptionPayments)
        .orderBy(desc(schema.subscriptionPayments.date)).limit(50).all();
    }),

  summary: publicProcedure.query(({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const activeSubs = ctx.db.select().from(schema.subscriptions)
      .where(eq(schema.subscriptions.active, true)).all();

    const monthlyPayments = ctx.db.select({
      total: sql<number>`coalesce(sum(${schema.subscriptionPayments.amount}), 0)`,
    }).from(schema.subscriptionPayments)
      .where(gte(schema.subscriptionPayments.date, monthStart)).get();

    // Calculate monthly equivalent cost
    const monthlyEquivalent = activeSubs.reduce((sum, sub) => {
      switch (sub.frequency) {
        case "monthly": return sum + sub.amount;
        case "yearly": return sum + sub.amount / 12;
        case "one-time": return sum;
        default: return sum;
      }
    }, 0);

    const byProvider = new Map<string, number>();
    activeSubs.forEach((s) => {
      const monthly = s.frequency === "yearly" ? s.amount / 12 : s.frequency === "monthly" ? s.amount : 0;
      byProvider.set(s.provider, (byProvider.get(s.provider) ?? 0) + monthly);
    });

    return {
      activeSubs: activeSubs.length,
      monthlyEquivalent,
      paymentsThisMonth: monthlyPayments?.total ?? 0,
      byProvider: [...byProvider.entries()].map(([provider, monthly]) => ({ provider, monthly })),
    };
  }),
});
