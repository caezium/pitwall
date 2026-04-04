"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CardSkeleton, TableSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#f59e0b",
  openai: "#10b981",
  google: "#3b82f6",
  other: "#8b5cf6",
};

export default function AICostsPage() {
  const summary = trpc.aiUsage.summary.useQuery();
  const syncMutation = trpc.aiUsage.syncNow.useMutation({ onSuccess: () => summary.refetch() });
  const exportData = trpc.export.aiUsage.useQuery({});

  if (summary.isLoading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /><TableSkeleton /></div>;
  if (summary.error) return <QueryError error={summary.error} onRetry={() => summary.refetch()} />;
  const data = summary.data!;

  // Aggregate daily trend by date for stacked area chart
  const dateMap = new Map<string, Record<string, number>>();
  data.dailyTrend.forEach((d: any) => {
    const existing = dateMap.get(d.date) ?? {};
    existing[d.provider] = (existing[d.provider] ?? 0) + d.totalCost;
    dateMap.set(d.date, existing);
  });
  const chartData = [...dateMap.entries()]
    .map(([date, providers]) => ({ date: date.slice(5), ...providers }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const providers = [...new Set(data.dailyTrend.map((d: any) => d.provider))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">AI Costs</h2>
        <div className="flex gap-2">
          <ExportButton data={exportData.data} filename="ai-costs.csv" />
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {syncMutation.isPending ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>

      {syncMutation.data && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm">
          {syncMutation.data.map((r: any) => (
            <p key={r.provider}>{r.provider}: {r.recordsInserted} new records{r.errors.length > 0 && <span className="text-red-400"> ({r.errors.length} errors)</span>}</p>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Total MTD</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(data.totalMtd)}</p>
          <p className="text-xs text-zinc-500 mt-1">since {data.since}</p>
        </div>
        {data.byProvider.map((p: any) => (
          <div key={p.provider} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-sm text-zinc-400 capitalize">{p.provider}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(p.totalCost)}</p>
            <p className="text-xs text-zinc-500 mt-1">{(p.totalInput + p.totalOutput).toLocaleString()} tokens</p>
          </div>
        ))}
      </div>

      {/* Daily Cost Trend — Stacked Area Chart */}
      {chartData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Cost Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} />
                <YAxis tickFormatter={(v) => `$${v.toFixed(2)}`} stroke="#52525b" fontSize={11} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                />
                {providers.map((provider: string) => (
                  <Area
                    key={provider}
                    type="monotone"
                    dataKey={provider}
                    stackId="1"
                    stroke={PROVIDER_COLORS[provider] ?? "#71717a"}
                    fill={PROVIDER_COLORS[provider] ?? "#71717a"}
                    fillOpacity={0.4}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* By Model Table */}
      {data.byModel.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Cost by Model</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3 text-right">Input</th>
                <th className="px-4 py-3 text-right">Output</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m: any, i: number) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm capitalize">{m.provider}</td>
                  <td className="px-4 py-3 text-sm font-mono">{m.model}</td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-400">{m.totalInput.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-400">{m.totalOutput.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(m.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.totalMtd === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-zinc-500 text-sm">No AI usage data. Configure your API keys in Settings and click &quot;Sync Now&quot;.</p>
        </div>
      )}
    </div>
  );
}
