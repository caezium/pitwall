"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";

export default function KartingPage() {
  const expenses = trpc.expenses.list.useQuery({ domain: "karting" as any });
  const categories = trpc.expenses.categories.useQuery({ domain: "karting" });

  // Calculate stats
  const totalSpend =
    expenses.data?.reduce((s, e) => s + e.amount, 0) ?? 0;
  const events = [
    ...new Set(expenses.data?.map((e) => e.eventName).filter(Boolean)),
  ];
  const costPerRace = events.length > 0 ? totalSpend / events.length : 0;

  // Group by category
  const byCategory = new Map<string, number>();
  expenses.data?.forEach((e) => {
    const name = e.category?.name ?? "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount);
  });

  // Group by event
  const byEvent = new Map<
    string,
    { total: number; track: string; date: string }
  >();
  expenses.data?.forEach((e) => {
    if (e.eventName) {
      const existing = byEvent.get(e.eventName) ?? {
        total: 0,
        track: e.trackName ?? "",
        date: e.date,
      };
      existing.total += e.amount;
      byEvent.set(e.eventName, existing);
    }
  });

  const maxCategorySpend = Math.max(...byCategory.values(), 1);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Karting</h2>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Total Spend</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(totalSpend)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Events</p>
          <p className="text-3xl font-bold mt-1">{events.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Avg Cost / Race</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(costPerRace)}
          </p>
        </div>
      </div>

      {/* By Category */}
      {byCategory.size > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            Spend by Category
          </h3>
          <div className="space-y-3">
            {[...byCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, amount]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-40 text-sm text-zinc-400">{name}</span>
                  <div className="flex-1 h-5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{
                        width: `${(amount / maxCategorySpend) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono text-sm">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))}
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
                <tr
                  key={event}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-sm">{event}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {data.track || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {formatDate(data.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-400">
                    {formatCurrency(data.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expenses.data?.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-zinc-500 text-sm">
            No karting expenses yet. Add expenses with a karting category to see
            them here.
          </p>
        </div>
      )}
    </div>
  );
}
