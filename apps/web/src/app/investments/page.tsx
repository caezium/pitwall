"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";

export default function InvestmentsPage() {
  const performance = trpc.investments.performance.useQuery();
  const positions = trpc.investments.positions.useQuery();
  const trades = trpc.investments.trades.useQuery({ limit: 20 });
  const snapshots = trpc.investments.snapshot.useQuery();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Investments</h2>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <div
          className={`w-2 h-2 rounded-full ${
            performance.data?.lastSync ? "bg-green-500" : "bg-zinc-600"
          }`}
        />
        {performance.data?.lastSync
          ? `Last sync: ${new Date(performance.data.lastSync).toLocaleString()}`
          : "No positions synced yet. Import via CSV or connect IBKR Gateway."}
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Net Liquidation</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(performance.data?.netLiquidation ?? 0)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Cash</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(performance.data?.cash ?? 0)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Unrealized P&L</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              (performance.data?.totalUnrealizedPnl ?? 0) >= 0
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {formatCurrency(performance.data?.totalUnrealizedPnl ?? 0)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Total Return</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              (performance.data?.totalReturn ?? 0) >= 0
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {(performance.data?.totalReturn ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Allocation */}
      {performance.data?.allocation &&
        performance.data.allocation.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Allocation</h3>
            <div className="space-y-2">
              {performance.data.allocation.map((a) => (
                <div key={a.symbol} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-mono">{a.symbol}</span>
                  <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${a.percent}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm text-zinc-400">
                    {a.percent.toFixed(1)}%
                  </span>
                  <span className="w-24 text-right text-sm font-mono">
                    {formatCurrency(a.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Positions Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <h3 className="text-lg font-semibold p-6 pb-0">Positions</h3>
        {positions.data?.length === 0 ? (
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
              {positions.data?.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-sm font-mono font-bold">
                    {p.symbol}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {p.description ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {p.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatCurrency(p.avgCost)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatCurrency(p.marketValue)}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-right font-mono ${
                      p.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <h3 className="text-lg font-semibold p-6 pb-0">Recent Trades</h3>
        {trades.data?.length === 0 ? (
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
              {trades.data?.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {t.tradeDate}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">{t.symbol}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        t.action === "buy"
                          ? "bg-green-900/50 text-green-400"
                          : t.action === "sell"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-blue-900/50 text-blue-400"
                      }`}
                    >
                      {t.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {t.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatCurrency(t.price)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-zinc-500">
                    {formatCurrency(t.commission)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
