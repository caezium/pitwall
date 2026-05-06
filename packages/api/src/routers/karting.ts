import { z } from "zod";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";

/**
 * Karting cost-model + budget projections.
 *
 * The model lives as JSON under app_settings key `karting_budget_model`. It
 * holds a list of cost components (each with an amount + how often it incurs)
 * and a pair of usage assumptions (sessions/day, days/month). From those we
 * derive a projected monthly spend, broken down by component, that we can
 * compare against the user's actual karting expenses for the current month.
 */

const componentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  amount: z.number().min(0),
  // The amount covers this many of the unit. e.g. ¥400 fuel "per 6.5 sessions"
  // → amount=400, frequency=per-session, perUnit=6.5
  perUnit: z.number().positive().default(1),
  frequency: z.enum(["monthly", "per-day", "per-session"]),
  notes: z.string().optional(),
});

const modelSchema = z.object({
  components: z.array(componentSchema),
  assumptions: z.object({
    sessionsPerDay: z.number().positive().default(4),
    daysPerMonth: z.number().positive().default(6),
  }),
});

type CostComponent = z.infer<typeof componentSchema>;
type Model = z.infer<typeof modelSchema>;

const SETTINGS_KEY = "karting_budget_model";

const DEFAULT_MODEL: Model = {
  components: [
    { id: "coaching", name: "Coaching / team fees",       amount: 1300, perUnit: 1,   frequency: "monthly",      notes: "flat monthly" },
    { id: "transport", name: "Transportation",            amount: 300,  perUnit: 1,   frequency: "per-day",      notes: "per karting day, round trip" },
    { id: "fuel",     name: "Fuel",                       amount: 400,  perUnit: 6.5, frequency: "per-session",  notes: "¥400 per 6–7 sessions" },
    { id: "tires",    name: "Tires",                      amount: 1700, perUnit: 3.5, frequency: "per-day",      notes: "¥1700 per 3–4 days" },
    { id: "engine",   name: "Engine rebuild (amortized)", amount: 5000, perUnit: 3,   frequency: "monthly",      notes: "¥5000 every 3 months" },
  ],
  assumptions: { sessionsPerDay: 4, daysPerMonth: 6 },
};

function loadModel(db: typeof schema extends never ? never : import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema>): Model {
  const row = db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SETTINGS_KEY))
    .get();
  if (!row?.value) return DEFAULT_MODEL;
  try {
    const parsed = modelSchema.parse(JSON.parse(row.value));
    return parsed;
  } catch {
    return DEFAULT_MODEL;
  }
}

function projectMonthly(component: CostComponent, sessionsPerMonth: number, daysPerMonth: number): number {
  const unitCost = component.amount / component.perUnit;
  if (component.frequency === "monthly") {
    // perUnit=1 → ¥X/mo. perUnit=3 → ¥X every 3 months → ¥X/3 per month.
    return unitCost;
  }
  if (component.frequency === "per-day") return unitCost * daysPerMonth;
  if (component.frequency === "per-session") return unitCost * sessionsPerMonth;
  return 0;
}

export const kartingRouter = router({
  getBudget: publicProcedure.query(({ ctx }) => loadModel(ctx.db)),

  setBudget: publicProcedure.input(modelSchema).mutation(({ ctx, input }) => {
    const value = JSON.stringify(input);
    const existing = ctx.db
      .select({ key: schema.appSettings.key })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, SETTINGS_KEY))
      .get();
    if (existing) {
      ctx.db
        .update(schema.appSettings)
        .set({ value, updatedAt: new Date().toISOString() })
        .where(eq(schema.appSettings.key, SETTINGS_KEY))
        .run();
    } else {
      ctx.db
        .insert(schema.appSettings)
        .values({ key: SETTINGS_KEY, value })
        .run();
    }
    return input;
  }),

  /**
   * Project monthly karting cost from the model and compare to MTD actuals.
   * Returns per-component projection + the same view per actual category so
   * the UI can render side-by-side.
   */
  projection: publicProcedure
    .input(
      z.object({
        // Override assumptions for what-if analysis without persisting.
        sessionsPerDay: z.number().positive().optional(),
        daysPerMonth: z.number().positive().optional(),
      }).default({})
    )
    .query(({ ctx, input }) => {
      const model = loadModel(ctx.db);
      const sessionsPerDay = input.sessionsPerDay ?? model.assumptions.sessionsPerDay;
      const daysPerMonth = input.daysPerMonth ?? model.assumptions.daysPerMonth;
      const sessionsPerMonth = sessionsPerDay * daysPerMonth;

      const breakdown = model.components.map((c) => {
        const monthly = projectMonthly(c, sessionsPerMonth, daysPerMonth);
        return {
          id: c.id,
          name: c.name,
          frequency: c.frequency,
          unitCost: c.amount / c.perUnit,
          perUnit: c.perUnit,
          notes: c.notes,
          monthlyProjection: monthly,
        };
      });
      const projectedMonthly = breakdown.reduce((s, b) => s + b.monthlyProjection, 0);

      // Actuals: current calendar month, karting domain, all sub-categories.
      // Format dates in local time — toISOString() would shift local-midnight
      // back into the previous month for UTC-ahead timezones.
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
      const monthStart = `${yyyy}-${mm}-01`;
      const monthEnd = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`;

      const actualByCategory = ctx.db
        .select({
          name: schema.categories.name,
          total: sql<number>`coalesce(sum(${schema.expenses.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(schema.expenses)
        .leftJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
        .where(
          and(
            eq(schema.categories.domain, "karting"),
            gte(schema.expenses.date, monthStart),
            lte(schema.expenses.date, monthEnd),
            eq(schema.expenses.currency, "CNY"),
          )
        )
        .groupBy(schema.categories.name)
        .all();

      const actualTotal = actualByCategory.reduce((s, r) => s + (r.total ?? 0), 0);

      // Forecast for the rest of the month: pace = actual / day-of-month, EOM = pace × days_in_month
      const daysSoFar = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const pacedEom = daysSoFar > 0 ? (actualTotal / daysSoFar) * daysInMonth : 0;

      return {
        modelAssumptions: { sessionsPerDay, daysPerMonth, sessionsPerMonth },
        breakdown,
        projectedMonthly,
        actuals: {
          monthStart,
          monthEnd,
          daysSoFar,
          daysInMonth,
          totalCNY: actualTotal,
          byCategory: actualByCategory,
          pacedEndOfMonth: pacedEom,
        },
        delta: {
          modelVsActualSoFar: actualTotal - (projectedMonthly * (daysSoFar / daysInMonth)),
          modelVsPaced: pacedEom - projectedMonthly,
        },
      };
    }),
});
