"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";

export default function AICostsPage() {
  const summary = trpc.aiUsage.summary.useQuery();
  const records = trpc.aiUsage.list.useQuery({ limit: 50 });
  const syncMutation = trpc.aiUsage.syncNow.useMutation({
    onSuccess: () => {
      summary.refetch();
      records.refetch();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">AI Costs</h2>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {syncMutation.isPending ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      {syncMutation.data && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm">
          {syncMutation.data.map((r) => (
            <p key={r.provider}>
              {r.provider}: {r.recordsInserted} new records
              {r.errors.length > 0 && (
                <span className="text-red-400">
                  {" "}
                  ({r.errors.length} errors)
                </span>
              )}
            </p>
          ))}
        </div>
      )}

      {/* MTD Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Total MTD</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(summary.data?.totalMtd ?? 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            since {summary.data?.since}
          </p>
        </div>
        {summary.data?.byProvider.map((p) => (
          <div
            key={p.provider}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <p className="text-sm text-zinc-400 capitalize">{p.provider}</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(p.totalCost)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {(p.totalInput + p.totalOutput).toLocaleString()} tokens
            </p>
          </div>
        ))}
      </div>

      {/* By Model */}
      {summary.data?.byModel && summary.data.byModel.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Cost by Model</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3 text-right">Input Tokens</th>
                <th className="px-4 py-3 text-right">Output Tokens</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {summary.data.byModel.map((m, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-sm capitalize">
                    {m.provider}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">{m.model}</td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-400">
                    {m.totalInput.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-400">
                    {m.totalOutput.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatCurrency(m.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily Trend */}
      {summary.data?.dailyTrend && summary.data.dailyTrend.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Trend</h3>
          <div className="space-y-1">
            {summary.data.dailyTrend.map((d, i) => {
              const maxCost = Math.max(
                ...summary.data!.dailyTrend.map((t) => t.totalCost)
              );
              const width =
                maxCost > 0 ? (d.totalCost / maxCost) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-zinc-500 text-xs">{d.date}</span>
                  <span className="w-16 text-xs capitalize text-zinc-400">
                    {d.provider}
                  </span>
                  <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono text-xs">
                    {formatCurrency(d.totalCost)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Records */}
      {records.data && records.data.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-zinc-500 text-sm">
            No AI usage records yet. Configure your API keys in Settings and
            click &quot;Sync Now&quot;, or import a CSV.
          </p>
        </div>
      )}
    </div>
  );
}
