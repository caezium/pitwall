import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

export const settingsRouter = router({
  get: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(({ ctx, input }) => {
      const setting = ctx.db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, input.key))
        .get();
      return setting ?? null;
    }),

  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(schema.appSettings).all();
  }),

  set: publicProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      const existing = ctx.db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, input.key))
        .get();

      if (existing) {
        ctx.db
          .update(schema.appSettings)
          .set({ value: input.value, updatedAt: new Date().toISOString() })
          .where(eq(schema.appSettings.key, input.key))
          .run();
      } else {
        ctx.db
          .insert(schema.appSettings)
          .values({
            key: input.key,
            value: input.value,
            updatedAt: new Date().toISOString(),
          })
          .run();
      }

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ key: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.db
        .delete(schema.appSettings)
        .where(eq(schema.appSettings.key, input.key))
        .run();
      return { success: true };
    }),
});
