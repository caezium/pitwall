import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { CSVImporter } from "../services/csv-importer";

export const importRouter = router({
  parseCSV: publicProcedure
    .input(
      z.object({
        content: z.string().min(1),
        target: z.enum(["expenses", "ai_usage", "trades"]),
      })
    )
    .mutation(({ ctx, input }) => {
      const importer = new CSVImporter(ctx.db);
      const { headers, rows } = importer.parseCSV(input.content);
      const suggestedMapping = importer.suggestMapping(headers, input.target);

      return {
        headers,
        rowCount: rows.length,
        suggestedMapping,
        preview: rows.slice(0, 5),
      };
    }),

  execute: publicProcedure
    .input(
      z.object({
        content: z.string().min(1),
        target: z.enum(["expenses", "ai_usage", "trades"]),
        mapping: z.record(z.string()),
      })
    )
    .mutation(({ ctx, input }) => {
      const importer = new CSVImporter(ctx.db);
      const { rows } = importer.parseCSV(input.content);

      switch (input.target) {
        case "expenses":
          return importer.importExpenses(rows, input.mapping);
        case "ai_usage":
          return importer.importAIUsage(rows, input.mapping);
        case "trades":
          return importer.importTrades(rows, input.mapping);
      }
    }),
});
