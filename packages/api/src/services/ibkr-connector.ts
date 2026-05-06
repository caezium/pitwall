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
        const seen: string[] = [];
        const timeout = setTimeout(() => {
          this.connected = false;
          const trace = seen.length > 0 ? ` (events seen: ${seen.join(", ")})` : " (no events received from Gateway)";
          resolve({
            connected: false,
            host: this.host,
            port: this.port,
            error: `Connection timeout (30s).${trace}. Common fixes: (1) restart IB Gateway entirely after first-time API enable, (2) dismiss any popup/bulletin in the Gateway window, (3) confirm API → Settings has 'Read-Only API' off, port ${this.port}, and 127.0.0.1 in Trusted IPs.`,
          });
        }, 30000);

        // Treat several events as "ready": some Gateway versions emit
        // `nextValidId` / `server` before/instead of `connected`.
        const onReady = (label: string) => {
          if (this.connected) return;
          seen.push(label);
          if (label === "connected" || label === "nextValidId" || label === "server" || label === "managedAccounts") {
            clearTimeout(timeout);
            this.connected = true;
            resolve({ connected: true, host: this.host, port: this.port });
          }
        };

        this.ib.on(EventName.connected, () => onReady("connected"));
        this.ib.on(EventName.server, () => onReady("server"));
        this.ib.on(EventName.nextValidId, () => onReady("nextValidId"));
        this.ib.on(EventName.managedAccounts, () => onReady("managedAccounts"));

        this.ib.on(EventName.error, (err: Error) => {
          // 2104 / 2106 / 2158 are "data farm connection is OK" — not errors
          const msg = err?.message ?? String(err);
          if (/farm connection is OK|^2104|^2106|^2158/.test(msg)) return;
          clearTimeout(timeout);
          this.connected = false;
          resolve({
            connected: false,
            host: this.host,
            port: this.port,
            error: msg,
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
   * Import an IBKR Activity Flex Query XML. Handles both the Trades section
   * (inserted into `trades`) and the OpenPositions section (upserted into
   * `positions`, with all values converted to USD via fxRateToBase). Records
   * a portfolio snapshot for `reportDate` afterwards.
   *
   * Idempotent on trades (dedup by `tradeID`). For positions: any existing
   * row not present in this import is wiped, since Flex always returns the
   * full current snapshot of open positions.
   */
  importFlexTrades(xmlContent: string): SyncResult {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        isArray: (name) => name === "Trade" || name === "OpenPosition",
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
        const dateTime = String(trade.dateTime ?? trade.DateTime ?? trade.tradeDate ?? trade.TradeDate ?? "");
        // Flex defaults to yyyyMMdd[;HHmmss]. Normalize to ISO yyyy-MM-dd.
        const datePart = dateTime.includes(";")
          ? dateTime.split(";")[0]
          : dateTime.split("T")[0];
        const tradeDate = /^\d{8}$/.test(datePart)
          ? `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
          : datePart;

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

      // ---- Open Positions ----
      let openPositions: any[] = [];
      const findPositions = (obj: any): void => {
        if (!obj || typeof obj !== "object") return;
        if (obj.OpenPosition) {
          const list = Array.isArray(obj.OpenPosition) ? obj.OpenPosition : [obj.OpenPosition];
          openPositions = openPositions.concat(list);
          return;
        }
        for (const val of Object.values(obj)) findPositions(val);
      };
      findPositions(parsed);

      // Filter to SUMMARY rows only — LOT rows duplicate the same holding.
      const summaryPositions = openPositions.filter(
        (p) => (p.levelOfDetail ?? p.LevelOfDetail ?? "SUMMARY").toUpperCase() === "SUMMARY"
      );

      let positionCount = 0;
      let reportDate: string | null = null;
      const seenSymbols = new Set<string>();

      if (summaryPositions.length > 0) {
        const now = new Date().toISOString();
        for (const p of summaryPositions) {
          const accountId = String(p.accountId ?? p.AccountId ?? "default");
          const symbol = String(p.symbol ?? p.Symbol ?? "").trim();
          if (!symbol) continue;
          const fx = parseFloat(p.fxRateToBase ?? p.FXRateToBase ?? "1") || 1;
          const quantity = parseFloat(p.position ?? p.Position ?? "0") || 0;
          const markPrice = parseFloat(p.markPrice ?? p.MarkPrice ?? "0") || 0;
          const positionValue = parseFloat(p.positionValue ?? p.PositionValue ?? "0") || 0;
          const costBasisPrice = parseFloat(p.costBasisPrice ?? p.CostBasisPrice ?? "0") || 0;
          const unrealizedPnl = parseFloat(p.fifoPnlUnrealized ?? p.FifoPnlUnrealized ?? "0") || 0;
          const description = String(p.description ?? p.Description ?? symbol);

          const rowReportDate = String(p.reportDate ?? p.ReportDate ?? "");
          if (rowReportDate && !reportDate) {
            reportDate = /^\d{8}$/.test(rowReportDate)
              ? `${rowReportDate.slice(0, 4)}-${rowReportDate.slice(4, 6)}-${rowReportDate.slice(6, 8)}`
              : rowReportDate;
          }

          const key = `${accountId}|${symbol}`;
          seenSymbols.add(key);

          const data = {
            accountId,
            symbol,
            description,
            quantity,
            avgCost: costBasisPrice * fx,
            marketValue: positionValue * fx,
            unrealizedPnl: unrealizedPnl * fx,
            lastSyncAt: now,
          };

          const existing = this.db
            .select()
            .from(schema.positions)
            .where(eq(schema.positions.symbol, symbol))
            .get();
          if (existing) {
            this.db
              .update(schema.positions)
              .set(data)
              .where(eq(schema.positions.id, existing.id))
              .run();
          } else {
            this.db.insert(schema.positions).values(data).run();
          }
          positionCount++;
          // Track marketValue for stable mark-price (in USD)
          void markPrice;
        }

        // Wipe positions that disappeared (closed since last import).
        const allExisting = this.db.select().from(schema.positions).all();
        for (const e of allExisting) {
          const key = `${e.accountId}|${e.symbol}`;
          if (!seenSymbols.has(key)) {
            this.db.delete(schema.positions).where(eq(schema.positions.id, e.id)).run();
          }
        }
      }

      // Take a portfolio snapshot for the reportDate
      let snapshotMsg = "";
      if (reportDate && positionCount > 0) {
        const allPositions = this.db.select().from(schema.positions).all();
        const netLiq = allPositions.reduce((s, p) => s + p.marketValue, 0);
        const allocation = allPositions.map((p) => ({
          symbol: p.symbol,
          value: p.marketValue,
          percent: netLiq > 0 ? (p.marketValue / netLiq) * 100 : 0,
        }));
        const snapData = {
          date: reportDate,
          netLiquidation: netLiq,
          cash: 0,
          allocationJson: JSON.stringify(allocation),
          positionsJson: JSON.stringify(
            allPositions.map((p) => ({
              symbol: p.symbol,
              qty: p.quantity,
              value: p.marketValue,
              pnl: p.unrealizedPnl,
            }))
          ),
        };
        const existingSnap = this.db
          .select()
          .from(schema.portfolioSnapshots)
          .where(eq(schema.portfolioSnapshots.date, reportDate))
          .get();
        if (existingSnap) {
          this.db
            .update(schema.portfolioSnapshots)
            .set(snapData)
            .where(eq(schema.portfolioSnapshots.id, existingSnap.id))
            .run();
        } else {
          this.db.insert(schema.portfolioSnapshots).values(snapData).run();
        }
        snapshotMsg = `; snapshot for ${reportDate} (NetLiq $${netLiq.toFixed(2)})`;
      }

      return {
        success: true,
        message: `Imported ${count} trades + ${positionCount} positions${snapshotMsg}`,
        count: count + positionCount,
      };
    } catch (err) {
      return { success: false, message: `Flex import error: ${err instanceof Error ? err.message : String(err)}`, count: 0 };
    }
  }
}
