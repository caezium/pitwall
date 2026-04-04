import { z } from "zod";
import { eq, lte } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

function getNextDate(currentDate: string, frequency: string): string {
  const d = new Date(currentDate);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split("T")[0];
}

export const recurringRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(schema.recurringExpenses).all();
  }),

  create: publicProcedure
    .input(z.object({
      categoryId: z.string().optional(),
      amount: z.number().positive(),
      description: z.string().min(1),
      frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "yearly"]),
      nextDate: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(schema.recurringExpenses).values(input).returning().get();
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      amount: z.number().positive().optional(),
      description: z.string().min(1).optional(),
      frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "yearly"]).optional(),
      nextDate: z.string().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(schema.recurringExpenses).set(data).where(eq(schema.recurringExpenses.id, id)).returning().get();
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db.delete(schema.recurringExpenses).where(eq(schema.recurringExpenses.id, input.id)).run();
      return { success: true };
    }),

  // Process due recurring expenses — creates actual expense entries
  processDue: publicProcedure.mutation(({ ctx }) => {
    const today = new Date().toISOString().split("T")[0];
    const due = ctx.db
      .select()
      .from(schema.recurringExpenses)
      .where(lte(schema.recurringExpenses.nextDate, today))
      .all()
      .filter((r) => r.enabled);

    let created = 0;
    for (const item of due) {
      // Create the expense
      ctx.db.insert(schema.expenses).values({
        categoryId: item.categoryId,
        amount: item.amount,
        currency: item.currency,
        date: item.nextDate,
        description: item.description,
        notes: `Auto-created from recurring: ${item.description}`,
      }).run();

      // Advance nextDate
      ctx.db.update(schema.recurringExpenses)
        .set({ nextDate: getNextDate(item.nextDate, item.frequency) })
        .where(eq(schema.recurringExpenses.id, item.id))
        .run();

      created++;
    }

    return { processed: created };
  }),
});
