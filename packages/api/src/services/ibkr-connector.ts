import { eq } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import { schema } from "@pitwall/db";
import type { PitwallDatabase } from "@pitwall/db";
import { decrypt } from "../lib/crypto";

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
    return { connected: this.connected, host: this.host, port: this.port };
  }

  async syncPositions(): Promise<SyncResult> {
    if (!this.ib || !this.connected) {
      return { success: false, message: "Not connected to IB Gateway", count: 0 };
    }

    try {
      const { EventName } = await import("@stoqey/ib");

      return new Promise((resolve) => {
        const positions: any[] = [];
        const timeout = setTimeout(() => {
          cleanup();
          resolve({ success: false, message: "Position sync timed out", count: 0 });
        }, 30000);

        const onPosition = (account: string, contract: any, pos: number, avgCost: number) => {
          positions.push({
            accountId: account,
            symbol: contract.symbol,
            description: contract.localSymbol ?? contract.symbol,
            quantity: pos,
            avgCost,
            marketValue: pos * avgCost,
            unrealizedPnl: 0,
          });
        };

        const onEnd = () => {
          clearTimeout(timeout);
          cleanup();

          for (const pos of positions) {
            const existing = this.db
              .select()
              .from(schema.positions)
              .where(eq(schema.positions.symbol, pos.symbol))
              .get();

            if (existing) {
              this.db
                .update(schema.positions)
                .set({ ...pos, lastSyncAt: new Date().toISOString() })
                .where(eq(schema.positions.id, existing.id))
                .run();
            } else {
              this.db.insert(schema.positions).values(pos).run();
            }
          }

          resolve({ success: true, message: `Synced ${positions.length} positions`, count: positions.length });
        };

        const cleanup = () => {
          this.ib.removeListener(EventName.position, onPosition);
          this.ib.removeListener(EventName.positionEnd, onEnd);
        };

        this.ib.on(EventName.position, onPosition);
        this.ib.on(EventName.positionEnd, onEnd);
        this.ib.reqPositions();
      });
    } catch (err) {
      return { success: false, message: `Sync error: ${err instanceof Error ? err.message : String(err)}`, count: 0 };
    }
  }

  async takeSnapshot(): Promise<SyncResult> {
    const positions = this.db.select().from(schema.positions).all();
    if (positions.length === 0) {
      return { success: false, message: "No positions to snapshot", count: 0 };
    }

    const today = new Date().toISOString().split("T")[0];
    const netLiquidation = positions.reduce((s, p) => s + p.marketValue, 0);
    const allocation = positions.map((p) => ({
      symbol: p.symbol,
      value: p.marketValue,
      percent: netLiquidation > 0 ? (p.marketValue / netLiquidation) * 100 : 0,
    }));

    const existing = this.db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.date, today))
      .get();

    const data = {
      date: today,
      netLiquidation,
      cash: 0,
      allocationJson: JSON.stringify(allocation),
      positionsJson: JSON.stringify(positions.map((p) => ({ symbol: p.symbol, qty: p.quantity, value: p.marketValue, pnl: p.unrealizedPnl }))),
    };

    if (existing) {
      this.db.update(schema.portfolioSnapshots).set(data).where(eq(schema.portfolioSnapshots.id, existing.id)).run();
    } else {
      this.db.insert(schema.portfolioSnapshots).values(data).run();
    }

    return { success: true, message: `Snapshot saved for ${today}`, count: positions.length };
  }

  /**
   * Import trades from IBKR Flex Query XML using proper XML parser.
   */
  importFlexTrades(xmlContent: string): SyncResult {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        isArray: (name) => name === "Trade",
      });

      const parsed = parser.parse(xmlContent);

      // Navigate to trades — Flex XML structure varies
      let trades: any[] = [];
      const findTrades = (obj: any): void => {
        if (!obj || typeof obj !== "object") return;
        if (obj.Trade) {
          trades = Array.isArray(obj.Trade) ? obj.Trade : [obj.Trade];
          return;
        }
        for (const val of Object.values(obj)) {
          findTrades(val);
        }
      };
      findTrades(parsed);

      let count = 0;
      for (const trade of trades) {
        const tradeId = trade.tradeID ?? trade.TradeID ?? trade.transactionID;
        if (!tradeId) continue;

        // Dedup
        const existing = this.db
          .select()
          .from(schema.trades)
          .where(eq(schema.trades.tradeId, String(tradeId)))
          .get();
        if (existing) continue;

        const symbol = trade.symbol ?? trade.Symbol ?? "";
        const buySell = trade.buySell ?? trade.BuySell ?? trade.side ?? "";
        const action = buySell.toUpperCase() === "SELL" ? "sell" : buySell.toUpperCase() === "BUY" ? "buy" : "dividend";
        const dateTime = trade.dateTime ?? trade.DateTime ?? trade.tradeDate ?? trade.TradeDate ?? "";
        const tradeDate = dateTime.includes(";") ? dateTime.split(";")[0] : dateTime.split("T")[0] ?? dateTime;

        this.db
          .insert(schema.trades)
          .values({
            accountId: trade.accountId ?? trade.AccountId ?? "default",
            symbol,
            action: action as "buy" | "sell" | "dividend",
            quantity: Math.abs(parseFloat(trade.quantity ?? trade.Quantity ?? "0")),
            price: parseFloat(trade.tradePrice ?? trade.TradePrice ?? trade.price ?? "0"),
            commission: Math.abs(parseFloat(trade.ibCommission ?? trade.IBCommission ?? trade.commission ?? "0")),
            tradeDate,
            tradeId: String(tradeId),
          })
          .run();

        count++;
      }

      return { success: true, message: `Imported ${count} trades from Flex Query`, count };
    } catch (err) {
      return { success: false, message: `Flex import error: ${err instanceof Error ? err.message : String(err)}`, count: 0 };
    }
  }
}
