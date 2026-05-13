"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";
import { AccountSelector } from "@/components/account-selector";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionTitle } from "@/components/ui/section-title";
import { LwcAreaChart } from "@/components/ui/lwc-area-chart";
import {
  Wallet, TrendingUp, Activity, Coins,
  ArrowUpRight, ArrowDownRight,
  CircleAlert, RefreshCcw, FileText,
} from "lucide-react";

type Position = {
  id: string;
  accountId: string;
  symbol: string;
  description: string | null;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnl: number;
};

type Trade = {
  id: string;
  symbol: string;
  action: "buy" | "sell" | "dividend";
  quantity: number;
  price: number;
  commission: number;
  tradeDate: string;
};

const SYMBOL_COLORS = ["#ff3838", "#ffd23f", "#2ee59d", "#5b8dff", "#b48cff", "#ff7ab6", "#ff7a45", "#4cc9f0"];

export default function InvestmentsPage() {
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const performance = trpc.investments.performance.useQuery();
  const positions = trpc.investments.positions.useQuery();
  const trades = trpc.investments.trades.useQuery({});
  const snapshots = trpc.investments.snapshot.useQuery();
  const exportData = trpc.export.trades.useQuery({});
  const utils = trpc.useUtils();
  const ibkrSync = trpc.investments.ibkrSync.useMutation({
    onSuccess: () => {
      utils.investments.performance.invalidate();
      utils.investments.positions.invalidate();
      utils.investments.snapshot.invalidate();
    },
  });
  const flexImport = trpc.investments.importFlexXml.useMutation({
    onSuccess: () => {
      utils.investments.performance.invalidate();
      utils.investments.positions.invalidate();
      utils.investments.trades.invalidate();
      utils.investments.snapshot.invalidate();
    },
  });
  const [flexOpen, setFlexOpen] = useState(false);
  const [flexXml, setFlexXml] = useState("");

  if (performance.isLoading) return <InvestmentsSkeleton />;
  if (performance.error) return <QueryError error={performance.error} onRetry={() => performance.refetch()} />;
  const perf = performance.data!;

  const allPositions = (positions.data ?? []) as Position[];
  const filteredPositions = accountFilter
    ? allPositions.filter((p) => p.accountId === accountFilter)
    : allPositions;

  const totalMV = filteredPositions.reduce((s, p) => s + p.marketValue, 0);

  // Allocation sorted by mkt value
  const allocation = filteredPositions
    .filter((p) => p.marketValue > 0)
    .slice()
    .sort((a, b) => b.marketValue - a.marketValue);

  // Portfolio value history (lightweight-charts series)
  const historyRaw = ((snapshots.data ?? []) as Array<{ date: string; netLiquidation: number }>)
    .slice()
    .reverse();
  const navSeries = historyRaw.map((s) => ({ time: s.date, value: s.netLiquidation }));
  const navFirst = navSeries[0]?.value ?? perf.netLiquidation;
  const navLast = navSeries[navSeries.length - 1]?.value ?? perf.netLiquidation;
  const navDelta = navLast - navFirst;
  const navDeltaPct = navFirst > 0 ? (navDelta / navFirst) * 100 : 0;

  const recentTrades = (trades.data ?? []) as Trade[];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
      {/* ====== Main column ====== */}
      <div className="space-y-5 min-w-0">
        {/* Page-level actions row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector selected={accountFilter} onChange={setAccountFilter} />
            {perf.lastSync && (
              <span className="pill pill-mute">
                <RefreshCcw size={11} />
                Last sync {new Date(perf.lastSync).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton data={exportData.data} filename="trades.csv" />
            <button
              onClick={() => setFlexOpen((v) => !v)}
              className="btn btn-secondary"
              title="Paste IBKR Activity Flex Query XML"
            >
              <FileText size={14} />
              Import Flex XML
            </button>
            <button
              onClick={() => ibkrSync.mutate()}
              disabled={ibkrSync.isPending}
              className="btn btn-primary"
              title="Connect to IB Gateway, pull positions, take a daily snapshot"
            >
              <RefreshCcw size={14} className={ibkrSync.isPending ? "animate-spin" : ""} />
              {ibkrSync.isPending ? "Syncing…" : "Sync IBKR"}
            </button>
          </div>
        </div>

        {/* Sync banners */}
        {ibkrSync.data && (
          <SyncBanner
            success={ibkrSync.data.success}
            label={`IBKR ${ibkrSync.data.host}:${ibkrSync.data.port}`}
            message={ibkrSync.data.message}
          />
        )}
        {flexImport.data && (
          <SyncBanner
            success={flexImport.data.success}
            label="Flex XML"
            message={flexImport.data.message}
          />
        )}

        {/* Flex paste */}
        {flexOpen && (
          <div className="finance-card">
            <SectionTitle
              eyebrow="Manual import"
              title="Paste Activity Flex Query XML"
              right={
                <button onClick={() => { setFlexOpen(false); setFlexXml(""); }} className="btn btn-ghost !text-[12px]">
                  Close
                </button>
              }
            />
            <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
              Use{" "}
              <span className="mono" style={{ color: "var(--text-secondary)" }}>
                scripts/import_ibkr_flex.sh &lt;TOKEN&gt; &lt;QUERY_ID&gt;
              </span>{" "}
              if you'd rather automate it.
            </p>
            <textarea
              value={flexXml}
              onChange={(e) => setFlexXml(e.target.value)}
              placeholder='<FlexQueryResponse queryName="…" type="AF"> … </FlexQueryResponse>'
              className="textarea textarea-bordered w-full text-[12px] mono"
              style={{ minHeight: 180 }}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[11.5px] mono" style={{ color: "var(--text-muted)" }}>
                {flexXml.length.toLocaleString()} chars
              </span>
              <button
                onClick={() => flexImport.mutate({ xml: flexXml })}
                disabled={flexImport.isPending || flexXml.length < 50}
                className="btn btn-success"
              >
                {flexImport.isPending ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Net liquidation"
            value={formatCurrency(perf.netLiquidation, "USD")}
            icon={Wallet}
            iconColor="green"
            pill={
              navSeries.length > 1
                ? { tone: navDelta >= 0 ? "pos" : "neg", text: `${navDelta >= 0 ? "↗" : "↘"} ${navDeltaPct.toFixed(2)}%` }
                : undefined
            }
            glow
          />
          <MetricCard
            label="Cash"
            value={formatCurrency(perf.cash, "USD")}
            icon={Coins}
            iconColor="yellow"
          />
          <MetricCard
            label="Unrealized P/L"
            value={
              <span style={{ color: perf.totalUnrealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                {perf.totalUnrealizedPnl >= 0 ? "+" : ""}{formatCurrency(perf.totalUnrealizedPnl, "USD")}
              </span>
            }
            icon={Activity}
            iconColor={perf.totalUnrealizedPnl >= 0 ? "green" : "red"}
            pill={{
              tone: perf.totalUnrealizedPnl >= 0 ? "pos" : "neg",
              text: `${perf.totalReturn >= 0 ? "+" : ""}${perf.totalReturn.toFixed(2)}%`,
            }}
          />
          <MetricCard
            label="Positions"
            value={`${perf.positionCount}`}
            sub={`${allocation.length > 0 ? allocation[0].symbol : "—"} is largest`}
            icon={TrendingUp}
            iconColor="blue"
          />
        </div>

        {/* NetLiq history chart */}
        <div className="finance-card">
          <SectionTitle
            eyebrow="NetLiq history"
            title={
              <span className="flex items-center gap-2">
                Portfolio value
                <span className="balance-md mono" style={{ color: "var(--text-secondary)" }}>
                  {formatCurrency(perf.netLiquidation, "USD")}
                </span>
              </span>
            }
            right={
              navSeries.length > 1 && (
                <span className={`pill ${navDelta >= 0 ? "pill-pos" : "pill-neg"}`}>
                  {navDelta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {formatCurrency(navDelta, "USD")} · {navDeltaPct.toFixed(2)}%
                </span>
              )
            }
          />
          {navSeries.length > 1 ? (
            <LwcAreaChart
              data={navSeries}
              height={280}
              topColor={navDelta >= 0 ? "rgba(46, 229, 157, 0.30)" : "rgba(255, 56, 56, 0.30)"}
              bottomColor={navDelta >= 0 ? "rgba(46, 229, 157, 0.0)" : "rgba(255, 56, 56, 0.0)"}
              lineColor={navDelta >= 0 ? "#2ee59d" : "#ff3838"}
              priceFormat={(v) => `$${v.toFixed(0)}`}
            />
          ) : (
            <div
              className="rounded-[12px] flex flex-col items-center justify-center text-center px-6"
              style={{
                height: 280,
                border: "1px dashed var(--border)",
                background: "var(--bg-input)",
              }}
            >
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                One snapshot logged so far.
              </p>
              <p className="text-[12px] mt-1 max-w-md" style={{ color: "var(--text-muted)" }}>
                Re-run Flex Query (daily or weekly) to build a NetLiq history line. Each import adds a snapshot for that report date.
              </p>
            </div>
          )}
        </div>

        {/* Positions table */}
        <div className="finance-card !p-0 overflow-hidden">
          <div className="px-5 pt-5">
            <SectionTitle eyebrow="Holdings" title="Positions" />
          </div>
          {filteredPositions.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12 px-6">
              <CircleAlert size={28} style={{ color: "var(--text-muted)" }} />
              <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>No positions yet</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>Sync from IBKR or paste Flex XML above.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Description</th>
                  <th className="!text-right">Qty</th>
                  <th className="!text-right">Avg cost</th>
                  <th className="!text-right">Market value</th>
                  <th className="!text-right">% of NAV</th>
                  <th className="!text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions
                  .slice()
                  .sort((a, b) => b.marketValue - a.marketValue)
                  .map((p, i) => {
                    const pct = totalMV > 0 ? (p.marketValue / totalMV) * 100 : 0;
                    const pnlPct = p.avgCost > 0 ? ((p.marketValue - p.avgCost * p.quantity) / (p.avgCost * p.quantity)) * 100 : 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[10px] font-bold"
                              style={{
                                background: SYMBOL_COLORS[i % SYMBOL_COLORS.length] + "22",
                                color: SYMBOL_COLORS[i % SYMBOL_COLORS.length],
                              }}
                            >
                              {p.symbol.slice(0, 3)}
                            </div>
                            <span className="mono font-semibold">{p.symbol}</span>
                          </div>
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>{p.description ?? "—"}</td>
                        <td className="!text-right mono">{p.quantity}</td>
                        <td className="!text-right mono" style={{ color: "var(--text-secondary)" }}>
                          {formatCurrency(p.avgCost, "USD")}
                        </td>
                        <td className="!text-right mono font-semibold">
                          {formatCurrency(p.marketValue, "USD")}
                        </td>
                        <td className="!text-right">
                          <span className="mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="!text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span
                              className="mono font-semibold"
                              style={{ color: p.unrealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
                            >
                              {p.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(p.unrealizedPnl, "USD")}
                            </span>
                            <span
                              className={`pill ${pnlPct >= 0 ? "pill-pos" : "pill-neg"} !text-[10px]`}
                            >
                              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent trades table */}
        <div className="finance-card !p-0 overflow-hidden">
          <div className="px-5 pt-5">
            <SectionTitle eyebrow="Activity" title="Recent trades" right={
              <a href="#" className="text-[12px] font-medium" style={{ color: "var(--accent-red)" }}>
                {recentTrades.length} total
              </a>
            } />
          </div>
          {recentTrades.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <CircleAlert size={28} style={{ color: "var(--text-muted)" }} />
              <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>No trades yet</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbol</th>
                  <th>Action</th>
                  <th className="!text-right">Qty</th>
                  <th className="!text-right">Price</th>
                  <th className="!text-right">Notional</th>
                  <th className="!text-right">Comm.</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: "var(--text-secondary)" }}>{t.tradeDate}</td>
                    <td className="mono font-semibold">{t.symbol}</td>
                    <td>
                      <span
                        className={`pill ${t.action === "buy" ? "pill-pos" : t.action === "sell" ? "pill-neg" : "pill-info"}`}
                      >
                        {t.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="!text-right mono">{t.quantity}</td>
                    <td className="!text-right mono" style={{ color: "var(--text-secondary)" }}>
                      {formatCurrency(t.price, "USD")}
                    </td>
                    <td className="!text-right mono">
                      {formatCurrency(t.quantity * t.price, "USD")}
                    </td>
                    <td className="!text-right mono" style={{ color: "var(--text-muted)" }}>
                      {formatCurrency(t.commission, "USD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ====== Right rail ====== */}
      <div className="space-y-5 min-w-0">
        {/* Allocation stacked bar + list */}
        <div className="rail-card">
          <SectionTitle eyebrow="Allocation" title={`${allocation.length} holdings`} />
          {allocation.length > 0 ? (
            <>
              <div className="flex w-full h-3 rounded-full overflow-hidden">
                {allocation.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      background: SYMBOL_COLORS[i % SYMBOL_COLORS.length],
                      width: `${(p.marketValue / totalMV) * 100}%`,
                    }}
                    title={`${p.symbol} ${((p.marketValue / totalMV) * 100).toFixed(1)}%`}
                  />
                ))}
              </div>
              <ul className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {allocation.map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ background: SYMBOL_COLORS[i % SYMBOL_COLORS.length] }}
                      />
                      <span className="text-[12.5px] mono font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {p.symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px]">
                      <span className="mono" style={{ color: "var(--text-muted)" }}>
                        {((p.marketValue / totalMV) * 100).toFixed(1)}%
                      </span>
                      <span className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                        {formatCurrency(p.marketValue, "USD")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
              Nothing held yet.
            </p>
          )}
        </div>

        {/* Winners & losers */}
        {filteredPositions.length > 0 && (
          <div className="rail-card">
            <SectionTitle eyebrow="Movers" title="Winners & losers" />
            <div className="space-y-1.5">
              {filteredPositions
                .slice()
                .sort((a, b) => b.unrealizedPnl - a.unrealizedPnl)
                .slice(0, 3)
                .map((p) => (
                  <MoverRow key={`top-${p.id}`} p={p} />
                ))}
              <div className="h-px my-2" style={{ background: "var(--border)" }} />
              {filteredPositions
                .slice()
                .sort((a, b) => a.unrealizedPnl - b.unrealizedPnl)
                .slice(0, 2)
                .map((p) => (
                  <MoverRow key={`bot-${p.id}`} p={p} />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MoverRow({ p }: { p: Position }) {
  const pos = p.unrealizedPnl >= 0;
  const pnlPct = p.avgCost > 0 ? ((p.marketValue - p.avgCost * p.quantity) / (p.avgCost * p.quantity)) * 100 : 0;
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="mono text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {p.symbol}
        </span>
        <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
          {p.description ?? ""}
        </span>
      </div>
      <span
        className={`pill ${pos ? "pill-pos" : "pill-neg"}`}
      >
        {pos ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
        {pnlPct.toFixed(1)}%
      </span>
    </div>
  );
}

function SyncBanner({ success, label, message }: { success: boolean; label: string; message: string }) {
  return (
    <div
      className="finance-card !py-3"
      style={{
        borderColor: success ? "rgba(46, 229, 157, 0.30)" : "rgba(255, 56, 56, 0.30)",
        background: success ? "rgba(46, 229, 157, 0.04)" : "rgba(255, 56, 56, 0.04)",
      }}
    >
      <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        <span
          className="font-medium"
          style={{ color: success ? "var(--accent-green)" : "var(--accent-red)" }}
        >
          {label}:
        </span>{" "}
        {message}
      </p>
    </div>
  );
}

function InvestmentsSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 animate-pulse">
      <div className="space-y-5">
        <div className="h-10 rounded-xl" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
        <div className="h-80 rounded-2xl" style={{ background: "var(--bg-card)" }} />
        <div className="h-64 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
      <div className="space-y-5">
        <div className="h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
        <div className="h-48 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
    </div>
  );
}
