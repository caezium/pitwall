import { router } from "../trpc";
import { expensesRouter } from "./expenses";
import { dashboardRouter } from "./dashboard";
import { aiUsageRouter } from "./ai-usage";
import { budgetsRouter } from "./budgets";
import { investmentsRouter } from "./investments";
import { settingsRouter } from "./settings";
import { importRouter } from "./import";
import { exportRouter } from "./export";
import { recurringRouter } from "./recurring";
import { subscriptionsRouter } from "./subscriptions";
import { backupRouter } from "./backup";
import { kartingRouter } from "./karting";

export const appRouter = router({
  expenses: expensesRouter,
  dashboard: dashboardRouter,
  aiUsage: aiUsageRouter,
  budgets: budgetsRouter,
  investments: investmentsRouter,
  settings: settingsRouter,
  import: importRouter,
  export: exportRouter,
  recurring: recurringRouter,
  subscriptions: subscriptionsRouter,
  backup: backupRouter,
  karting: kartingRouter,
});

export type AppRouter = typeof appRouter;
