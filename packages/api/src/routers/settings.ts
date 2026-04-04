import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";
import { encrypt, decrypt, isSensitiveKey } from "../lib/crypto";

export const settingsRouter = router({
  get: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(({ ctx, input }) => {
      const setting = ctx.db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, input.key))
        .get();

      if (!setting) return null;

      return {
        ...setting,
        value: isSensitiveKey(setting.key) ? decrypt(setting.value) : setting.value,
      };
    }),

  getAll: publicProcedure.query(({ ctx }) => {
    const settings = ctx.db.select().from(schema.appSettings).all();
    return settings.map((s) => ({
      ...s,
      // Mask sensitive values in list view
      value: isSensitiveKey(s.key) ? "••••••••" : s.value,
    }));
  }),

  set: publicProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      const storedValue = isSensitiveKey(input.key)
        ? encrypt(input.value)
        : input.value;

      const existing = ctx.db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, input.key))
        .get();

      if (existing) {
        ctx.db
          .update(schema.appSettings)
          .set({ value: storedValue, updatedAt: new Date().toISOString() })
          .where(eq(schema.appSettings.key, input.key))
          .run();
      } else {
        ctx.db
          .insert(schema.appSettings)
          .values({
            key: input.key,
            value: storedValue,
            updatedAt: new Date().toISOString(),
          })
          .run();
      }

      return { success: true };
    }),

  // Get decrypted value for internal use (by other services)
  getDecrypted: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(({ ctx, input }) => {
      const setting = ctx.db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, input.key))
        .get();

      if (!setting) return null;
      return decrypt(setting.value);
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
