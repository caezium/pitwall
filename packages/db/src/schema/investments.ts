import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const positions = sqliteTable("positions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  quantity: real("quantity").notNull(),
  avgCost: real("avg_cost").notNull(),
  marketValue: real("market_value").notNull(),
  unrealizedPnl: real("unrealized_pnl").notNull().default(0),
  lastSyncAt: text("last_sync_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const trades = sqliteTable("trades", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull(),
  tradeId: text("trade_id").unique(),
  symbol: text("symbol").notNull(),
  action: text("action", {
    enum: ["buy", "sell", "dividend"],
  }).notNull(),
  quantity: real("quantity").notNull(),
  price: real("price").notNull(),
  commission: real("commission").notNull().default(0),
  tradeDate: text("trade_date").notNull(),
  settleDate: text("settle_date"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const portfolioSnapshots = sqliteTable("portfolio_snapshots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  date: text("date").notNull().unique(),
  netLiquidation: real("net_liquidation").notNull(),
  cash: real("cash").notNull(),
  allocationJson: text("allocation_json"),
  positionsJson: text("positions_json"),
});
