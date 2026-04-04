"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CardSkeleton, TableSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";

const COLORS: Record<string, string> = {
  "Entry Fees": "#ef4444",
  "Tires": "#f97316",
  "Fuel": "#eab308",
  "Parts & Maintenance": "#a855f7",
  "Travel": "#3b82f6",
  "Gear": "#6366f1",
};

export default function KartingPage() {
  const expenses = trpc.expenses.list.useQuery({ domain: "karting" });
  const exportData = trpc.export.expenses.useQuery({});

  if (expenses.isLoading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /><TableSkeleton /></div>;
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
        <h2 className="text-2xl font-bold">Karting</h2>
        <ExportButton data={exportData.data} filename="karting-expenses.csv" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Total Spend</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalSpend)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Events</p>
          <p className="text-3xl font-bold mt-1">{events.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Avg Cost / Race</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(costPerRace)}</p>
        </div>
      </div>

      {/* Category Bar Chart */}
      {chartData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Spend by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <XAxis type="number" tickFormatter={(v) => `$${v}`} stroke="#52525b" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#52525b" fontSize={12} width={90} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.name] ?? "#71717a"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Event Tracker */}
      {byEvent.size > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <h3 className="text-lg font-semibold p-6 pb-0">Event Tracker</h3>
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Track</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {[...byEvent.entries()].map(([event, data]) => (
                <tr key={event} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm">{event}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{data.track || "-"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{formatDate(data.date)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-400">{formatCurrency(data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-zinc-500 text-sm">No karting expenses yet. Add expenses with a karting category to see them here.</p>
        </div>
      )}
    </div>
  );
}
