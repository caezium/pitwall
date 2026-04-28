"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CardSkeleton, TableSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";

const COLORS: Record<string, string> = {
  "Entry Fees": "#f87171",
  "Tires": "#f59e0b",
  "Fuel": "#eab308",
  "Parts & Maintenance": "#a855f7",
  "Travel": "#4f7df7",
  "Gear": "#34d399",
};

export default function KartingPage() {
  const expenses = trpc.expenses.list.useQuery({ domain: "karting" });
  const exportData = trpc.export.expenses.useQuery({});

  if (expenses.isLoading) {
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
  if (expenses.error) return <QueryError error={expenses.error} onRetry={() => expenses.refetch()} />;

  const items = expenses.data ?? [];
  const totalSpend = items.reduce((s: number, e: any) => s + e.amount, 0);
  const events = [...new Set(items.map((e: any) => e.eventName).filter(Boolean))];
  const costPerRace = events.length > 0 ? totalSpend / events.length : 0;

  // By category for chart
  const byCategory = new Map<string, number>();
  items.forEach((e: any) => {
    const name = e.category?.name ?? "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount);
  });
  const chartData = [...byCategory.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  // By event
  const byEvent = new Map<string, { total: number; track: string; date: string }>();
  items.forEach((e: any) => {
    if (e.eventName) {
      const existing = byEvent.get(e.eventName) ?? { total: 0, track: e.trackName ?? "", date: e.date };
      existing.total += e.amount;
      byEvent.set(e.eventName, existing);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Karting</h1>
        <ExportButton data={exportData.data} filename="karting-expenses.csv" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total Spend</p>
          <p className="balance-lg mt-2" style={{ color: "var(--accent-red)" }}>{formatCurrency(totalSpend)}</p>
        </div>
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Events</p>
          <p className="balance-lg mt-2" style={{ color: "var(--text-primary)" }}>{events.length}</p>
        </div>
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Avg Cost / Race</p>
          <p className="balance-lg mt-2" style={{ color: "var(--text-primary)" }}>{formatCurrency(costPerRace)}</p>
        </div>
      </div>

      {/* Category Bar Chart */}
      {chartData.length > 0 && (
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Spend by Category</p>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <XAxis type="number" tickFormatter={(v) => `$${v}`} stroke="var(--text-muted)" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} width={90} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                  itemStyle={{ color: "var(--text-primary)" }}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.name] ?? "var(--text-muted)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Event Tracker */}
      {byEvent.size > 0 && (
        <div className="finance-card !p-0 overflow-hidden">
          <p className="text-xs font-medium uppercase tracking-wide px-5 pt-5" style={{ color: "var(--text-muted)" }}>
            Event Tracker
          </p>
          <table className="w-full mt-3">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Event</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Track</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {[...byEvent.entries()].map(([event, data]) => (
                <tr key={event} className="group" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-5 py-3.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{event}</td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>{data.track || "-"}</td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>{formatDate(data.date)}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono font-semibold" style={{ color: "var(--accent-red)" }}>{formatCurrency(data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="finance-card flex flex-col items-center py-16">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: "var(--bg-input)" }}>
            🏎️
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No karting expenses yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add expenses with a karting category to see them here</p>
          <a href="/expenses" className="text-sm mt-3 font-medium" style={{ color: "var(--accent-blue)" }}>
            Add expense →
          </a>
        </div>
      )}
    </div>
  );
}
