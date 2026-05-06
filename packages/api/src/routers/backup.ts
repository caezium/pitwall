import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  createBackup,
  getStatus,
  listBackups,
  pruneBackups,
} from "../services/backup";

export const backupRouter = router({
  status: publicProcedure.query(() => getStatus()),

  list: publicProcedure.query(() => listBackups()),

  now: publicProcedure.mutation(async () => {
    const file = await createBackup();
    const { removed } = pruneBackups();
    return { file, pruned: removed };
  }),

  prune: publicProcedure
    .input(
      z
        .object({
          keepDays: z.number().int().positive().max(365).optional(),
          keepCount: z.number().int().positive().max(100).optional(),
        })
        .default({})
    )
    .mutation(({ input }) => pruneBackups(input)),
});
