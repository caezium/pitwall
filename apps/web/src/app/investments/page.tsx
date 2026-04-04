"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from "recharts";
import { CardSkeleton, TableSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";
import { AccountSelector } from "@/components/account-selector";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

export default function InvestmentsPage() {
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const performance = trpc.investments.performance.useQuery();
  const positions = trpc.investments.positions.useQuery();
  const trades = trpc.investments.trades.useQuery({});
  const snapshots = trpc.investments.snapshot.useQuery();
  const exportData = trpc.export.trades.useQuery({});

  if (performance.isLoading) return <div className="space-y-4"><div className="grid grid-cols-4 gap-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div><TableSkeleton /></div>;
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
        <h2 className="text-2xl font-bold">Investments</h2>
        <div className="flex gap-2 items-center">
          <AccountSelector selected={accountFilter} onChange={setAccountFilter} />
          <ExportButton data={exportData.data} filename="trades.csv" />
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <div className={`w-2 h-2 rounded-full ${perf.lastSync ? "bg-green-500" : "bg-zinc-600"}`} />
        {perf.lastSync ? `Last sync: ${new Date(perf.lastSync).toLocaleString()}` : "No positions synced yet."}
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Net Liquidation</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(perf.netLiquidation)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Cash</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(perf.cash)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Unrealized P&L</p>
          <p className={`text-2xl font-bold mt-1 ${perf.totalUnrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatCurrency(perf.totalUnrealizedPnl)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Total Return</p>
          <p className={`text-2xl font-bold mt-1 ${perf.totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
            {perf.totalReturn.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Portfolio Value Line Chart + Allocation Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {historyData.length > 1 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Portfolio Value</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <XAxis dataKey="date" stroke="#52525b" fontSize={11} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="#52525b" fontSize={11} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {pieData.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Allocation</h3>
            <div className="flex items-center gap-4">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}>
                      {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                {pieData.slice(0, 8).map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-zinc-400 font-mono">{d.name}</span>
                    <span className="ml-auto font-mono">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Positions Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <h3 className="text-lg font-semibold p-6 pb-0">Positions</h3>
        {filteredPositions.length === 0 ? (
          <p className="p-6 text-zinc-500 text-sm">No positions yet.</p>
        ) : (
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Avg Cost</th>
                <th className="px-4 py-3 text-right">Mkt Value</th>
                <th className="px-4 py-3 text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((p: any) => (
                <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm font-mono font-bold">{p.symbol}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{p.description ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-right">{p.quantity}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(p.avgCost)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(p.marketValue)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-mono ${p.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(p.unrealizedPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Trades */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <h3 className="text-lg font-semibold p-6 pb-0">Recent Trades</h3>
        {(trades.data ?? []).length === 0 ? (
          <p className="p-6 text-zinc-500 text-sm">No trades yet.</p>
        ) : (
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {(trades.data ?? []).map((t: any) => (
                <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm text-zinc-400">{t.tradeDate}</td>
                  <td className="px-4 py-3 text-sm font-mono">{t.symbol}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.action === "buy" ? "bg-green-900/50 text-green-400" : t.action === "sell" ? "bg-red-900/50 text-red-400" : "bg-blue-900/50 text-blue-400"}`}>{t.action}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{t.quantity}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(t.price)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-zinc-500">{formatCurrency(t.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
