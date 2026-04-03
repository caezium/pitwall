import { router } from "../trpc";
import { expensesRouter } from "./expenses";
import { dashboardRouter } from "./dashboard";

export const appRouter = router({
  expenses: expensesRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
