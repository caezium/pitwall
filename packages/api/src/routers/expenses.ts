import { z } from "zod";
import { eq, desc, and, gte, lte, like } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

export const expensesRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          categoryId: z.string().optional(),
          domain: z
            .enum(["karting", "ai", "investment", "general"])
            .optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const filters = input;
      const conditions = [];

      if (filters.categoryId) {
        conditions.push(eq(schema.expenses.categoryId, filters.categoryId));
      }
      if (filters.startDate) {
        conditions.push(gte(schema.expenses.date, filters.startDate));
      }
      if (filters.endDate) {
        conditions.push(lte(schema.expenses.date, filters.endDate));
      }
      if (filters.search) {
        conditions.push(like(schema.expenses.description, `%${filters.search}%`));
      }

      const items = await ctx.db.query.expenses.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: { category: true, expenseTags: { with: { tag: true } } },
        orderBy: [desc(schema.expenses.date)],
        limit: filters.limit,
        offset: filters.offset,
      });

      return items;
    }),

  create: publicProcedure
    .input(
      z.object({
        categoryId: z.string().optional(),
        amount: z.number().positive(),
        currency: z.string().default("USD"),
        date: z.string(),
        description: z.string().min(1),
        notes: z.string().optional(),
        eventName: z.string().optional(),
        trackName: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tagIds, ...data } = input;

      const [expense] = await ctx.db
        .insert(schema.expenses)
        .values(data)
        .returning();

      if (tagIds?.length) {
        await ctx.db.insert(schema.expenseTags).values(
          tagIds.map((tagId) => ({
            expenseId: expense.id,
            tagId,
          }))
        );
      }

      return expense;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        categoryId: z.string().optional(),
        amount: z.number().positive().optional(),
        currency: z.string().optional(),
        date: z.string().optional(),
        description: z.string().min(1).optional(),
        notes: z.string().optional(),
        eventName: z.string().optional(),
        trackName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(schema.expenses)
        .set(data)
        .where(eq(schema.expenses.id, id))
        .returning();
      return updated;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(schema.expenses)
        .where(eq(schema.expenses.id, input.id));
      return { success: true };
    }),

  // Category management
  categories: publicProcedure
    .input(
      z
        .object({
          domain: z
            .enum(["karting", "ai", "investment", "general"])
            .optional(),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.categories.findMany({
        where: input.domain
          ? eq(schema.categories.domain, input.domain)
          : undefined,
      });
    }),

  createCategory: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        domain: z.enum(["karting", "ai", "investment", "general"]),
        parentId: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [category] = await ctx.db
        .insert(schema.categories)
        .values(input)
        .returning();
      return category;
    }),

  // Tag management
  tags: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tags.findMany();
  }),

  createTag: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [tag] = await ctx.db
        .insert(schema.tags)
        .values(input)
        .returning();
      return tag;
    }),
});
