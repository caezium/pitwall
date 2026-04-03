import { eq, sql } from "drizzle-orm";
import { schema } from "@pitwall/db";
import type { PitwallDatabase } from "@pitwall/db";

/**
 * IBKR Connector — manages connection to IB Gateway via @stoqey/ib.
 *
 * IB Gateway must be running locally for live data.
 * Falls back gracefully when offline.
 *
 * Usage:
 *   const connector = new IBKRConnector(db);
 *   await connector.connect();
 *   await connector.syncPositions();
 *   await connector.takeSnapshot();
 */

type IBKRConnectionStatus = {
  connected: boolean;
  host: string;
  port: number;
  error?: string;
};

type SyncResult = {
  success: boolean;
  message: string;
  count: number;
};

export class IBKRConnector {
  private ib: any = null;
  private connected = false;
  private host: string;
  private port: number;

  constructor(private db: PitwallDatabase) {
    // Read config from settings
    const hostSetting = db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "ibkr_gateway_host"))
      .get();

    const portSetting = db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "ibkr_gateway_port"))
      .get();

    this.host = hostSetting?.value ?? "127.0.0.1";
    this.port = parseInt(portSetting?.value ?? "7497");
  }

  async connect(): Promise<IBKRConnectionStatus> {
    try {
      // Dynamically import @stoqey/ib only when connecting
      const { IBApi, EventName } = await import("@stoqey/ib");

      this.ib = new IBApi({ host: this.host, port: this.port, clientId: 1 });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.connected = false;
          resolve({
            connected: false,
            host: this.host,
            port: this.port,
            error: "Connection timeout (10s). Is IB Gateway running?",
          });
        }, 10000);

        this.ib.on(EventName.connected, () => {
          clearTimeout(timeout);
          this.connected = true;
          resolve({ connected: true, host: this.host, port: this.port });
        });

        this.ib.on(EventName.error, (err: Error) => {
          clearTimeout(timeout);
          this.connected = false;
          resolve({
            connected: false,
            host: this.host,
            port: this.port,
            error: err.message,
          });
        });

        this.ib.connect();
      });
    } catch (err) {
      return {
        connected: false,
        host: this.host,
        port: this.port,
        error: `Failed to initialize: ${err instanceof Error ? err.message : String(err)}. Install @stoqey/ib: pnpm add @stoqey/ib --filter @pitwall/api`,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.ib && this.connected) {
      this.ib.disconnect();
      this.connected = false;
    }
  }

  getStatus(): IBKRConnectionStatus {
    return {
      connected: this.connected,
      host: this.host,
      port: this.port,
    };
  }

  async syncPositions(): Promise<SyncResult> {
    if (!this.ib || !this.connected) {
      return {
        success: false,
        message: "Not connected to IB Gateway",
        count: 0,
      };
    }

    try {
      const { EventName } = await import("@stoqey/ib");

      return new Promise((resolve) => {
        const positions: any[] = [];
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            message: "Position sync timed out",
            count: 0,
          });
        }, 30000);

        this.ib.on(
          EventName.position,
          (account: string, contract: any, pos: number, avgCost: number) => {
            positions.push({
              accountId: account,
              symbol: contract.symbol,
              description: contract.localSymbol ?? contract.symbol,
              quantity: pos,
              avgCost,
              marketValue: pos * avgCost, // Will be updated with market data
              unrealizedPnl: 0,
            });
          }
        );

        this.ib.on(EventName.positionEnd, () => {
          clearTimeout(timeout);

          // Upsert all positions
          for (const pos of positions) {
            const existing = this.db
              .select()
              .from(schema.positions)
              .where(eq(schema.positions.symbol, pos.symbol))
              .get();

            if (existing) {
              this.db
                .update(schema.positions)
                .set({
                  ...pos,
                  lastSyncAt: new Date().toISOString(),
                })
                .where(eq(schema.positions.id, existing.id))
                .run();
            } else {
              this.db.insert(schema.positions).values(pos).run();
            }
          }

          resolve({
            success: true,
            message: `Synced ${positions.length} positions`,
            count: positions.length,
          });
        });

        this.ib.reqPositions();
      });
    } catch (err) {
      return {
        success: false,
        message: `Sync error: ${err instanceof Error ? err.message : String(err)}`,
        count: 0,
      };
    }
  }

  async takeSnapshot(): Promise<SyncResult> {
    const positions = this.db.select().from(schema.positions).all();

    if (positions.length === 0) {
      return {
        success: false,
        message: "No positions to snapshot",
        count: 0,
      };
    }

    const today = new Date().toISOString().split("T")[0];
    const netLiquidation = positions.reduce(
      (s, p) => s + p.marketValue,
      0
    );
    const totalCostBasis = positions.reduce(
      (s, p) => s + p.avgCost * p.quantity,
      0
    );

    const allocation = positions.map((p) => ({
      symbol: p.symbol,
      value: p.marketValue,
      percent:
        netLiquidation > 0 ? (p.marketValue / netLiquidation) * 100 : 0,
    }));

    // Upsert snapshot for today
    const existing = this.db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.date, today))
      .get();

    const data = {
      date: today,
      netLiquidation,
      cash: 0, // Would come from account summary
      allocationJson: JSON.stringify(allocation),
      positionsJson: JSON.stringify(
        positions.map((p) => ({
          symbol: p.symbol,
          qty: p.quantity,
          value: p.marketValue,
          pnl: p.unrealizedPnl,
        }))
      ),
    };

    if (existing) {
      this.db
        .update(schema.portfolioSnapshots)
        .set(data)
        .where(eq(schema.portfolioSnapshots.id, existing.id))
        .run();
    } else {
      this.db.insert(schema.portfolioSnapshots).values(data).run();
    }

    return {
      success: true,
      message: `Snapshot saved for ${today}`,
      count: positions.length,
    };
  }

  /**
   * Import trades from IBKR Flex Query XML (Activity Statement).
   * This is a simplified parser — the Flex XML format is well-defined.
   */
  importFlexTrades(xmlContent: string): SyncResult {
    try {
      // Simple XML extraction for <Trade> elements
      const tradeMatches = xmlContent.matchAll(
        /<Trade\s[^>]*?symbol="([^"]*)"[^>]*?dateTime="([^"]*)"[^>]*?buySell="([^"]*)"[^>]*?quantity="([^"]*)"[^>]*?tradePrice="([^"]*)"[^>]*?ibCommission="([^"]*)"[^>]*?tradeID="([^"]*)"[^>]*?accountId="([^"]*)"[^>]*?\/?>/g
      );

      let count = 0;
      for (const match of tradeMatches) {
        const [, symbol, dateTime, buySell, qty, price, commission, tradeId, accountId] = match;

        // Dedup by tradeId
        const existing = this.db
          .select()
          .from(schema.trades)
          .where(eq(schema.trades.tradeId, tradeId))
          .get();
        if (existing) continue;

        const action =
          buySell === "SELL" ? "sell" : buySell === "BUY" ? "buy" : "dividend";

        this.db
          .insert(schema.trades)
          .values({
            accountId: accountId ?? "default",
            symbol,
            action: action as "buy" | "sell" | "dividend",
            quantity: Math.abs(parseFloat(qty)),
            price: parseFloat(price),
            commission: Math.abs(parseFloat(commission)),
            tradeDate: dateTime.split(";")[0] ?? dateTime,
            tradeId,
          })
          .run();

        count++;
      }

      return {
        success: true,
        message: `Imported ${count} trades from Flex Query`,
        count,
      };
    } catch (err) {
      return {
        success: false,
        message: `Flex import error: ${err instanceof Error ? err.message : String(err)}`,
        count: 0,
      };
    }
  }
}
