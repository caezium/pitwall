"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from "recharts";
import { CardSkeleton, TableSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";
import { AccountSelector } from "@/components/account-selector";

const COLORS = ["#4f7df7", "#34d399", "#f59e0b", "#f87171", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

export default function InvestmentsPage() {
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const performance = trpc.investments.performance.useQuery();
  const positions = trpc.investments.positions.useQuery();
  const trades = trpc.investments.trades.useQuery({});
  const snapshots = trpc.investments.snapshot.useQuery();
  const exportData = trpc.export.trades.useQuery({});

  if (performance.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 rounded-lg" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
        <div className="h-56 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
    );
  }
  if (performance.error) return <QueryError error={performance.error} onRetry={() => performance.refetch()} />;

  const perf = performance.data!;
  const allPositions = positions.data ?? [];
  const filteredPositions = accountFilter ? allPositions.filter((p: any) => p.accountId === accountFilter) : allPositions;

  // Allocation pie data
  const pieData = filteredPositions.filter((p: any) => p.marketValue > 0).map((p: any) => ({
    name: p.symbol,
    value: p.marketValue,
  }));

  // Portfolio value history from snapshots
  const historyData = (snapshots.data ?? [])
    .slice()
    .reverse()
    .map((s: any) => ({ date: s.date.slice(5), value: s.netLiquidation }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Investments</h1>
        <div className="flex gap-2 items-center">
          <AccountSelector selected={accountFilter} onChange={setAccountFilter} />
          <ExportButton data={exportData.data} filename="trades.csv" />
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: perf.lastSync ? "var(--accent-green)" : "var(--text-muted)" }}
        />
        {perf.lastSync ? `Last sync: ${new Date(perf.lastSync).toLocaleString()}` : "No positions synced yet."}
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Net Liquidation</p>
          <p className="balance-lg mt-2" style={{ color: "var(--accent-green)" }}>{formatCurrency(perf.netLiquidation)}</p>
        </div>
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Cash</p>
          <p className="balance-md mt-2" style={{ color: "var(--text-primary)" }}>{formatCurrency(perf.cash)}</p>
        </div>
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Unrealized P&L</p>
          <p
            className="balance-md mt-2"
            style={{ color: perf.totalUnrealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
          >
            {formatCurrency(perf.totalUnrealizedPnl)}
          </p>
        </div>
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total Return</p>
          <p
            className="balance-md mt-2"
            style={{ color: perf.totalReturn >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
          >
            {perf.totalReturn.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Portfolio Value Line Chart + Allocation Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {historyData.length > 1 && (
          <div className="finance-card">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Portfolio Value</p>
            <div className="h-48 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip
                    formatter={(v: any) => formatCurrency(v)}
                    contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}
                    labelStyle={{ color: "var(--text-secondary)" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                  />
                  <Line type="monotone" dataKey="value" stroke="var(--accent-blue)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {pieData.length > 0 && (
          <div className="finance-card">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Allocation</p>
            <div className="flex items-center gap-4 mt-4">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2} strokeWidth={0}>
                      {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => formatCurrency(v)}
                      contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}
                      labelStyle={{ color: "var(--text-secondary)" }}
                      itemStyle={{ color: "var(--text-primary)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-xs">
                {pieData.slice(0, 8).map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="category-dot" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="mono" style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                    <span className="ml-auto mono font-medium" style={{ color: "var(--text-primary)" }}>{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Positions Table */}
      <div className="finance-card !p-0 overflow-hidden">
        <p className="text-xs font-medium uppercase tracking-wide px-5 pt-5" style={{ color: "var(--text-muted)" }}>
          Positions
        </p>
        {filteredPositions.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-3" style={{ background: "var(--bg-input)" }}>
              📊
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No positions yet</p>
          </div>
        ) : (
          <table className="w-full mt-3">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Symbol</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Description</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Qty</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Avg Cost</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Mkt Value</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-5 py-3.5 text-sm mono font-bold" style={{ color: "var(--text-primary)" }}>{p.symbol}</td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>{p.description ?? "-"}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-primary)" }}>{p.quantity}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-secondary)" }}>{formatCurrency(p.avgCost)}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-primary)" }}>{formatCurrency(p.marketValue)}</td>
                  <td
                    className="px-5 py-3.5 text-sm text-right mono font-semibold"
                    style={{ color: p.unrealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
                  >
                    {formatCurrency(p.unrealizedPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Trades */}
      <div className="finance-card !p-0 overflow-hidden">
        <p className="text-xs font-medium uppercase tracking-wide px-5 pt-5" style={{ color: "var(--text-muted)" }}>
          Recent Trades
        </p>
        {(trades.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-3" style={{ background: "var(--bg-input)" }}>
              💱
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No trades yet</p>
          </div>
        ) : (
          <table className="w-full mt-3">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Symbol</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Action</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Qty</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Price</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Commission</th>
              </tr>
            </thead>
            <tbody>
              {(trades.data ?? []).map((t: any) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>{t.tradeDate}</td>
                  <td className="px-5 py-3.5 text-sm mono font-medium" style={{ color: "var(--text-primary)" }}>{t.symbol}</td>
                  <td className="px-5 py-3.5 text-sm">
                    <span
                      className="px-2 py-0.5 rounded-lg text-xs font-medium"
                      style={{
                        background: t.action === "buy" ? "rgba(52, 211, 153, 0.15)" : t.action === "sell" ? "rgba(248, 113, 113, 0.15)" : "rgba(79, 125, 247, 0.15)",
                        color: t.action === "buy" ? "var(--accent-green)" : t.action === "sell" ? "var(--accent-red)" : "var(--accent-blue)",
                      }}
                    >
                      {t.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-primary)" }}>{t.quantity}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-primary)" }}>{formatCurrency(t.price)}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-muted)" }}>{formatCurrency(t.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
