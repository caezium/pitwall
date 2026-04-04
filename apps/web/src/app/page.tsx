"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { BudgetAlerts } from "@/components/budget-alerts";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CardSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#71717a"];

export default function DashboardPage() {
  const overview = trpc.dashboard.overview.useQuery();

  if (overview.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }

  if (overview.error) return <QueryError error={overview.error} onRetry={() => overview.refetch()} />;
  const data = overview.data!;

  const pieData = data.domainBreakdown
    .filter((d: any) => d.total > 0)
    .map((d: any) => ({ name: d.domain ?? "other", value: d.total }));

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <BudgetAlerts />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Monthly Burn</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(data.monthlyBurn)}</p>
          <p className="text-xs text-zinc-500 mt-1">{data.monthlyTransactions} transactions</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">AI Costs (MTD)</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(data.aiCostsMtd)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Portfolio</p>
          <p className="text-3xl font-bold mt-1">
            {data.portfolio ? formatCurrency(data.portfolio.netLiquidation) : "Not connected"}
          </p>
          {data.portfolio && <p className="text-xs text-zinc-500 mt-1">as of {data.portfolio.date}</p>}
        </div>
      </div>

      {/* Spending Donut Chart */}
      {pieData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Spending by Domain (This Month)</h3>
          <div className="flex items-center gap-8">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.map((d: any, i: number) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-zinc-400 capitalize">{d.name}</span>
                  <span className="font-mono ml-auto">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Expenses</h3>
        {data.recentExpenses.length === 0 ? (
          <p className="text-zinc-500 text-sm">No expenses yet. Add your first expense to get started.</p>
        ) : (
          <div className="space-y-2">
            {data.recentExpenses.map((expense: any) => (
              <div key={expense.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-sm">{expense.description}</p>
                  <p className="text-xs text-zinc-500">{expense.date} &middot; {expense.category?.name ?? "Uncategorized"}</p>
                </div>
                <span className="font-mono text-red-400">-{formatCurrency(expense.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
