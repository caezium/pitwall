import { z } from "zod";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";
import { AIBillingService } from "../services/ai-billing";

export const aiUsageRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          provider: z.enum(["openai", "anthropic", "google", "other"]).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          limit: z.number().min(1).max(200).default(100),
          offset: z.number().min(0).default(0),
        })
        .default({})
    )
    .query(({ ctx, input }) => {
      const filters = input;
      const conditions = [];

      if (filters.provider) {
        conditions.push(eq(schema.aiUsageRecords.provider, filters.provider));
      }
      if (filters.startDate) {
        conditions.push(gte(schema.aiUsageRecords.date, filters.startDate));
      }
      if (filters.endDate) {
        conditions.push(lte(schema.aiUsageRecords.date, filters.endDate));
      }

      return ctx.db
        .select()
        .from(schema.aiUsageRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.aiUsageRecords.date))
        .limit(filters.limit)
        .offset(filters.offset)
        .all();
    }),

  summary: publicProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .default({})
    )
    .query(({ ctx, input }) => {
      const now = new Date();
      const monthStart =
        input.startDate ??
        new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];

      const byProvider = ctx.db
        .select({
          provider: schema.aiUsageRecords.provider,
          totalCost: sql<number>`coalesce(sum(${schema.aiUsageRecords.cost}), 0)`,
          totalInput: sql<number>`coalesce(sum(${schema.aiUsageRecords.inputTokens}), 0)`,
          totalOutput: sql<number>`coalesce(sum(${schema.aiUsageRecords.outputTokens}), 0)`,
          records: sql<number>`count(*)`,
        })
        .from(schema.aiUsageRecords)
        .where(gte(schema.aiUsageRecords.date, monthStart))
        .groupBy(schema.aiUsageRecords.provider)
        .all();

      const byModel = ctx.db
        .select({
          provider: schema.aiUsageRecords.provider,
          model: schema.aiUsageRecords.model,
          totalCost: sql<number>`coalesce(sum(${schema.aiUsageRecords.cost}), 0)`,
          totalInput: sql<number>`coalesce(sum(${schema.aiUsageRecords.inputTokens}), 0)`,
          totalOutput: sql<number>`coalesce(sum(${schema.aiUsageRecords.outputTokens}), 0)`,
        })
        .from(schema.aiUsageRecords)
        .where(gte(schema.aiUsageRecords.date, monthStart))
        .groupBy(schema.aiUsageRecords.provider, schema.aiUsageRecords.model)
        .orderBy(sql`sum(${schema.aiUsageRecords.cost}) DESC`)
        .all();

      const dailyTrend = ctx.db
        .select({
          date: schema.aiUsageRecords.date,
          provider: schema.aiUsageRecords.provider,
          totalCost: sql<number>`coalesce(sum(${schema.aiUsageRecords.cost}), 0)`,
        })
        .from(schema.aiUsageRecords)
        .where(gte(schema.aiUsageRecords.date, monthStart))
        .groupBy(schema.aiUsageRecords.date, schema.aiUsageRecords.provider)
        .orderBy(schema.aiUsageRecords.date)
        .all();

      const totalMtd = byProvider.reduce((sum, p) => sum + p.totalCost, 0);

      return { byProvider, byModel, dailyTrend, totalMtd, since: monthStart };
    }),

  syncNow: publicProcedure.mutation(async ({ ctx }) => {
    const service = new AIBillingService(ctx.db);

    // Get API keys from settings
    const anthropicKey = ctx.db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "anthropic_admin_api_key"))
      .get();

    const openaiKey = ctx.db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "openai_api_key"))
      .get();

    return service.syncAll({
      anthropicAdminKey: anthropicKey?.value,
      openaiKey: openaiKey?.value,
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        provider: z.enum(["openai", "anthropic", "google", "other"]),
        model: z.string().min(1),
        date: z.string(),
        inputTokens: z.number().int().min(0).default(0),
        outputTokens: z.number().int().min(0).default(0),
        cost: z.number().min(0),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(schema.aiUsageRecords)
        .values({ ...input, source: "manual" })
        .returning()
        .get();
    }),
});
