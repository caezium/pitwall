"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionTitle } from "@/components/ui/section-title";
import { LwcAreaChart } from "@/components/ui/lwc-area-chart";
import { Cpu, Activity, Zap, RefreshCcw, FileText } from "lucide-react";

const PROVIDER_META: Record<string, { label: string; color: string; chip: "blue" | "green" | "yellow" | "purple" | "pink" | "red" }> = {
  anthropic:  { label: "Anthropic",  color: "#ffd23f", chip: "yellow" },
  openai:     { label: "OpenAI",     color: "#2ee59d", chip: "green" },
  openrouter: { label: "OpenRouter", color: "#ff7ab6", chip: "pink" },
  google:     { label: "Google",     color: "#5b8dff", chip: "blue" },
  other:      { label: "Other",      color: "#b48cff", chip: "purple" },
};

export default function AICostsPage() {
  const summary = trpc.aiUsage.summary.useQuery();
  const tokscaleMutation = trpc.aiUsage.syncTokscale.useMutation({ onSuccess: () => summary.refetch() });
  const syncMutation = trpc.aiUsage.syncNow.useMutation({ onSuccess: () => summary.refetch() });
  const exportData = trpc.export.aiUsage.useQuery({});

  if (summary.isLoading) return <AISkeleton />;
  if (summary.error || !summary.data) return <QueryError error={summary.error!} onRetry={() => summary.refetch()} />;
  const data = summary.data;

  // Daily totals (lightweight-charts area)
  const dateMap = new Map<string, number>();
  (data.dailyTrend as Array<{ date: string; provider: string; totalCost: number }>).forEach((d) => {
    dateMap.set(d.date, (dateMap.get(d.date) ?? 0) + d.totalCost);
  });
  const daily = [...dateMap.entries()]
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const totalTokens = (data.byProvider as Array<{ totalInput: number; totalOutput: number }>)
    .reduce((s, p) => s + p.totalInput + p.totalOutput, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
      {/* Main */}
      <div className="space-y-5 min-w-0">
        <div className="flex items-center justify-end gap-2">
          <ExportButton data={exportData.data} filename="ai-costs.csv" />
          <button
            onClick={() => tokscaleMutation.mutate()}
            disabled={tokscaleMutation.isPending}
            className="btn btn-success"
            title="Pulls token usage from local Claude Code/Codex/Cursor logs via tokscale CLI"
          >
            <FileText size={14} />
            {tokscaleMutation.isPending ? "Tokscale…" : "Sync tokscale"}
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="btn btn-primary"
            title="Pulls billing usage from configured provider API keys"
          >
            <RefreshCcw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "Syncing…" : "Sync APIs"}
          </button>
        </div>

        {tokscaleMutation.data && (
          <div
            className="finance-card !py-3"
            style={{
              borderColor: tokscaleMutation.data.success ? "rgba(46, 229, 157, 0.30)" : "rgba(255, 56, 56, 0.30)",
              background: tokscaleMutation.data.success ? "rgba(46, 229, 157, 0.04)" : "rgba(255, 56, 56, 0.04)",
            }}
          >
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              <span className="font-medium" style={{ color: tokscaleMutation.data.success ? "var(--accent-green)" : "var(--accent-red)" }}>
                tokscale:
              </span>{" "}
              {tokscaleMutation.data.message}
            </p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard
            label="Total MTD"
            value={formatCurrency(data.totalMtd, "USD")}
            sub={`since ${data.since}`}
            icon={Cpu}
            iconColor="blue"
            glow
          />
          <MetricCard
            label="Tokens"
            value={totalTokens.toLocaleString()}
            sub={`across ${data.byProvider.length} provider${data.byProvider.length === 1 ? "" : "s"}`}
            icon={Activity}
            iconColor="purple"
          />
          <MetricCard
            label="Top model"
            value={
              data.byModel.length > 0
                ? formatCurrency(data.byModel[0].totalCost, "USD")
                : "—"
            }
            sub={data.byModel[0]?.model ?? "no models yet"}
            icon={Zap}
            iconColor="yellow"
          />
        </div>

        {/* Daily area */}
        <div className="finance-card">
          <SectionTitle
            eyebrow="Daily usage"
            title={
              <span className="flex items-center gap-2">
                Cost trend
                <span className="balance-md mono" style={{ color: "var(--text-secondary)" }}>
                  {formatCurrency(data.totalMtd, "USD")}
                </span>
              </span>
            }
          />
          {daily.length > 1 ? (
            <LwcAreaChart
              data={daily}
              height={260}
              topColor="rgba(255, 56, 56, 0.30)"
              bottomColor="rgba(255, 56, 56, 0.0)"
              lineColor="#ff3838"
              priceFormat={(v) => `$${v.toFixed(2)}`}
            />
          ) : (
            <p className="text-sm py-10 text-center" style={{ color: "var(--text-muted)" }}>
              {daily.length === 1 ? "Single day of data so far — keep syncing to build a trend." : "No usage data yet."}
            </p>
          )}
        </div>

        {/* By model table */}
        {data.byModel.length > 0 && (
          <div className="finance-card !p-0 overflow-hidden">
            <div className="px-5 pt-5">
              <SectionTitle eyebrow="Cost" title="By model" />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Model</th>
                  <th className="!text-right">Input</th>
                  <th className="!text-right">Output</th>
                  <th className="!text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {(data.byModel as Array<{ provider: string; model: string; totalInput: number; totalOutput: number; totalCost: number }>).map((m, i) => {
                  const meta = PROVIDER_META[m.provider] ?? PROVIDER_META.other;
                  return (
                    <tr key={i}>
                      <td>
                        <span
                          className="pill"
                          style={{
                            background: meta.color + "22",
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="mono">{m.model}</td>
                      <td className="!text-right mono" style={{ color: "var(--text-secondary)" }}>
                        {m.totalInput.toLocaleString()}
                      </td>
                      <td className="!text-right mono" style={{ color: "var(--text-secondary)" }}>
                        {m.totalOutput.toLocaleString()}
                      </td>
                      <td className="!text-right mono font-semibold">
                        {formatCurrency(m.totalCost, "USD")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.totalMtd === 0 && (
          <div className="finance-card flex flex-col items-center text-center py-16">
            <Cpu size={28} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm mt-3" style={{ color: "var(--text-primary)" }}>No AI usage data yet</p>
            <p className="text-[12px] mt-1 max-w-md" style={{ color: "var(--text-muted)" }}>
              Run <span className="mono" style={{ color: "var(--accent-red)" }}>tokscale</span> locally and click "Sync tokscale", or configure your provider API keys in Settings.
            </p>
            <a href="/settings" className="btn btn-secondary mt-4 !text-[12px]">
              Go to Settings
            </a>
          </div>
        )}
      </div>

      {/* Right rail — provider breakdown */}
      <div className="space-y-5 min-w-0">
        <div className="rail-card">
          <SectionTitle eyebrow="Providers" title="MTD breakdown" />
          {data.byProvider.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>No data.</p>
          ) : (
            <>
              <div className="flex w-full h-3 rounded-full overflow-hidden">
                {(data.byProvider as Array<{ provider: string; totalCost: number }>).map((p) => (
                  <div
                    key={p.provider}
                    style={{
                      background: PROVIDER_META[p.provider]?.color ?? "#666",
                      width: `${(p.totalCost / data.totalMtd) * 100}%`,
                    }}
                    title={`${p.provider} ${formatCurrency(p.totalCost, "USD")}`}
                  />
                ))}
              </div>
              <ul className="mt-4 space-y-3">
                {(data.byProvider as Array<{ provider: string; totalCost: number; totalInput: number; totalOutput: number; records: number }>)
                  .slice()
                  .sort((a, b) => b.totalCost - a.totalCost)
                  .map((p) => {
                    const meta = PROVIDER_META[p.provider] ?? PROVIDER_META.other;
                    return (
                      <li key={p.provider}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: meta.color }} />
                            <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                              {meta.label}
                            </span>
                          </div>
                          <span className="mono text-[13px] font-semibold">
                            {formatCurrency(p.totalCost, "USD")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <span>{(p.totalInput + p.totalOutput).toLocaleString()} tokens</span>
                          <span>{((p.totalCost / data.totalMtd) * 100).toFixed(1)}%</span>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
        </div>

        <div className="rail-card">
          <SectionTitle eyebrow="Tools" title="Keep usage current" />
          <p className="text-[12.5px] mb-3" style={{ color: "var(--text-secondary)" }}>
            tokscale scans local <span className="mono" style={{ color: "var(--accent-red)" }}>~/.claude/projects/</span>
            (and codex/cursor/etc.) for token usage. Re-run any time.
          </p>
          <div className="space-y-2">
            <a href="/subscriptions" className="btn btn-secondary w-full justify-center !text-[12px]">
              Manage subscriptions
            </a>
            <a href="/settings" className="btn btn-secondary w-full justify-center !text-[12px]">
              Configure API keys
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function AISkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 animate-pulse">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl" style={{ background: "var(--bg-card)" }} />)}
        </div>
        <div className="h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
      <div className="space-y-5">
        <div className="h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
    </div>
  );
}
