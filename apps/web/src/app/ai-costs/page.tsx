"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CardSkeleton, TableSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#f59e0b",
  openai: "#34d399",
  openrouter: "#ec4899",
  google: "#4f7df7",
  other: "#8b5cf6",
};

export default function AICostsPage() {
  const summary = trpc.aiUsage.summary.useQuery();
  const syncMutation = trpc.aiUsage.syncNow.useMutation({ onSuccess: () => summary.refetch() });
  const tokscaleMutation = trpc.aiUsage.syncTokscale.useMutation({ onSuccess: () => summary.refetch() });
  const exportData = trpc.export.aiUsage.useQuery({});

  if (summary.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 rounded-lg" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
        <div className="h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
    );
  }
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
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>AI Costs</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData.data} filename="ai-costs.csv" />
          <button
            onClick={() => tokscaleMutation.mutate()}
            disabled={tokscaleMutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--accent-green)", color: "#000" }}
            title="Pulls token usage from local Claude Code/Codex/Cursor logs via tokscale CLI"
          >
            {tokscaleMutation.isPending ? "Syncing tokscale..." : "Sync from tokscale"}
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--accent-blue)", color: "#fff" }}
            title="Pulls billing usage from configured Anthropic / OpenAI / OpenRouter API keys"
          >
            {syncMutation.isPending ? "Syncing..." : "Sync APIs"}
          </button>
        </div>
      </div>

      {tokscaleMutation.data && (
        <div className="finance-card" style={{ borderColor: tokscaleMutation.data.success ? "rgba(52, 211, 153, 0.3)" : "rgba(248, 113, 113, 0.3)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="font-medium" style={{ color: tokscaleMutation.data.success ? "var(--accent-green)" : "var(--accent-red)" }}>
              tokscale:
            </span>{" "}
            {tokscaleMutation.data.message}
          </p>
        </div>
      )}

      {syncMutation.data && (
        <div className="finance-card" style={{ borderColor: "rgba(52, 211, 153, 0.3)" }}>
          {syncMutation.data.map((r: any) => (
            <p key={r.provider} className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {r.provider}: {r.recordsInserted} new records
              {r.errors.length > 0 && <span style={{ color: "var(--accent-red)" }}> ({r.errors.length} errors)</span>}
            </p>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total MTD</p>
          <p className="balance-lg mt-2" style={{ color: "var(--accent-blue)" }}>{formatCurrency(data.totalMtd)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>since {data.since}</p>
        </div>
        {data.byProvider.map((p: any) => (
          <div key={p.provider} className="finance-card">
            <p className="text-xs font-medium uppercase tracking-wide capitalize" style={{ color: "var(--text-muted)" }}>{p.provider}</p>
            <p className="balance-md mt-2" style={{ color: "var(--text-primary)" }}>{formatCurrency(p.totalCost)}</p>
            <p className="text-xs mt-1 mono" style={{ color: "var(--text-muted)" }}>{(p.totalInput + p.totalOutput).toLocaleString()} tokens</p>
          </div>
        ))}
      </div>

      {/* Daily Cost Trend */}
      {chartData.length > 0 && (
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Daily Cost Trend</p>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                <YAxis tickFormatter={(v) => `$${v.toFixed(2)}`} stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                  itemStyle={{ color: "var(--text-primary)" }}
                />
                {providers.map((provider: string) => (
                  <Area
                    key={provider}
                    type="monotone"
                    dataKey={provider}
                    stackId="1"
                    stroke={PROVIDER_COLORS[provider] ?? "var(--text-muted)"}
                    fill={PROVIDER_COLORS[provider] ?? "var(--text-muted)"}
                    fillOpacity={0.3}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* By Model Table */}
      {data.byModel.length > 0 && (
        <div className="finance-card !p-0 overflow-hidden">
          <p className="text-xs font-medium uppercase tracking-wide px-5 pt-5" style={{ color: "var(--text-muted)" }}>
            Cost by Model
          </p>
          <table className="w-full mt-3">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Provider</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Model</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Input</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Output</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-5 py-3.5 text-sm capitalize" style={{ color: "var(--text-primary)" }}>{m.provider}</td>
                  <td className="px-5 py-3.5 text-sm mono" style={{ color: "var(--text-secondary)" }}>{m.model}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-secondary)" }}>{m.totalInput.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono" style={{ color: "var(--text-secondary)" }}>{m.totalOutput.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono font-semibold" style={{ color: "var(--text-primary)" }}>{formatCurrency(m.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.totalMtd === 0 && (
        <div className="finance-card flex flex-col items-center py-16">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: "var(--bg-input)" }}>
            🤖
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No AI usage data</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Configure your API keys in Settings and click &quot;Sync Now&quot;</p>
          <a href="/settings" className="text-sm mt-3 font-medium" style={{ color: "var(--accent-blue)" }}>
            Go to Settings →
          </a>
        </div>
      )}
    </div>
  );
}
