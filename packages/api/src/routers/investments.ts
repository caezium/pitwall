import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { schema } from "@pitwall/db";
import { router, publicProcedure } from "../trpc";
import { IBKRConnector } from "../services/ibkr-connector";

export const investmentsRouter = router({
  positions: publicProcedure.query(({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.positions)
      .orderBy(desc(sql`abs(${schema.positions.marketValue})`))
      .all();
  }),

  trades: publicProcedure
    .input(
      z
        .object({
          symbol: z.string().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        })
        .default({})
    )
    .query(({ ctx, input }) => {
      const filters = input;
      return ctx.db
        .select()
        .from(schema.trades)
        .where(
          filters.symbol ? eq(schema.trades.symbol, filters.symbol) : undefined
        )
        .orderBy(desc(schema.trades.tradeDate))
        .limit(filters.limit)
        .offset(filters.offset)
        .all();
    }),

  snapshot: publicProcedure.query(({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.portfolioSnapshots)
      .orderBy(desc(schema.portfolioSnapshots.date))
      .limit(90)
      .all();
  }),

  performance: publicProcedure.query(({ ctx }) => {
    const positions = ctx.db.select().from(schema.positions).all();
    const latestSnapshot = ctx.db
      .select()
      .from(schema.portfolioSnapshots)
      .orderBy(desc(schema.portfolioSnapshots.date))
      .limit(1)
      .get();

    const totalMarketValue = positions.reduce(
      (s, p) => s + p.marketValue,
      0
    );
    const totalCostBasis = positions.reduce(
      (s, p) => s + p.avgCost * p.quantity,
      0
    );
    const totalUnrealizedPnl = positions.reduce(
      (s, p) => s + p.unrealizedPnl,
      0
    );
    const totalReturn =
      totalCostBasis > 0
        ? ((totalMarketValue - totalCostBasis) / totalCostBasis) * 100
        : 0;

    // Allocation breakdown
    const allocation = positions.map((p) => ({
      symbol: p.symbol,
      value: p.marketValue,
      percent:
        totalMarketValue > 0 ? (p.marketValue / totalMarketValue) * 100 : 0,
    }));

    return {
      totalMarketValue,
      totalCostBasis,
      totalUnrealizedPnl,
      totalReturn,
      positionCount: positions.length,
      allocation,
      netLiquidation: latestSnapshot?.netLiquidation ?? totalMarketValue,
      cash: latestSnapshot?.cash ?? 0,
      lastSync: positions[0]?.lastSyncAt ?? null,
    };
  }),

  // Manual position upsert (for CSV import or manual entry)
  upsertPosition: publicProcedure
    .input(
      z.object({
        accountId: z.string().default("default"),
        symbol: z.string().min(1),
        description: z.string().optional(),
        quantity: z.number(),
        avgCost: z.number(),
        marketValue: z.number(),
        unrealizedPnl: z.number().default(0),
      })
    )
    .mutation(({ ctx, input }) => {
      const existing = ctx.db
        .select()
        .from(schema.positions)
        .where(eq(schema.positions.symbol, input.symbol))
        .get();

      if (existing) {
        return ctx.db
          .update(schema.positions)
          .set({ ...input, lastSyncAt: new Date().toISOString() })
          .where(eq(schema.positions.id, existing.id))
          .returning()
          .get();
      }

      return ctx.db
        .insert(schema.positions)
        .values(input)
        .returning()
        .get();
    }),

  /** Connect to IB Gateway, sync positions, take a snapshot, then disconnect. */
  ibkrSync: publicProcedure.mutation(async ({ ctx }) => {
    const ibkr = new IBKRConnector(ctx.db);
    const conn = await ibkr.connect();
    if (!conn.connected) {
      return {
        success: false,
        message: conn.error ?? "Could not connect to IB Gateway",
        host: conn.host,
        port: conn.port,
        positionsSynced: 0,
        snapshot: null as null | { date: string; netLiquidation: number },
      };
    }
    try {
      const sync = await ibkr.syncPositions();
      const snap = await ibkr.takeSnapshot();
      const latest = ctx.db
        .select()
        .from(schema.portfolioSnapshots)
        .orderBy(desc(schema.portfolioSnapshots.date))
        .limit(1)
        .get();
      return {
        success: sync.success,
        message: `${sync.message}; ${snap.message}`,
        host: conn.host,
        port: conn.port,
        positionsSynced: sync.count,
        snapshot: latest
          ? { date: latest.date, netLiquidation: latest.netLiquidation }
          : null,
      };
    } finally {
      await ibkr.disconnect();
    }
  }),

  /** Read-only: just check whether the gateway is reachable, no DB writes. */
  ibkrStatus: publicProcedure.mutation(async ({ ctx }) => {
    const ibkr = new IBKRConnector(ctx.db);
    const result = await ibkr.connect();
    await ibkr.disconnect();
    return result;
  }),

  /**
   * Import IBKR Activity Flex Query XML. Paste the XML from a Flex Query
   * download URL or saved file. Trades section is required; positions
   * section is optional.
   */
  importFlexXml: publicProcedure
    .input(z.object({ xml: z.string().min(50) }))
    .mutation(({ ctx, input }) => {
      const ibkr = new IBKRConnector(ctx.db);
      return ibkr.importFlexTrades(input.xml);
    }),

  addTrade: publicProcedure
    .input(
      z.object({
        accountId: z.string().default("default"),
        symbol: z.string().min(1),
        action: z.enum(["buy", "sell", "dividend"]),
        quantity: z.number(),
        price: z.number(),
        commission: z.number().default(0),
        tradeDate: z.string(),
        tradeId: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(schema.trades)
        .values(input)
        .returning()
        .get();
    }),
});
