"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { BudgetAlerts } from "@/components/budget-alerts";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const DOMAIN_COLORS: Record<string, string> = {
  karting: "#f87171",
  ai: "#4f7df7",
  investment: "#34d399",
  general: "#8888a0",
};

export default function DashboardPage() {
  const overview = trpc.dashboard.overview.useQuery();

  if (overview.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 rounded-lg" style={{ background: "var(--bg-card)" }} />
        <div className="h-44 rounded-2xl" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (overview.error) return null;
  const data = overview.data!;

  const pieData = data.domainBreakdown
    .filter((d: any) => d.total > 0)
    .map((d: any) => ({ name: d.domain ?? "general", value: d.total }));

  const totalSpent = pieData.reduce((s: number, d: any) => s + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Here&apos;s your financial overview
        </p>
      </div>

      <BudgetAlerts />

      {/* Hero Balance Card */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          border: "1px solid rgba(79, 125, 247, 0.2)",
        }}
      >
        <div className="relative z-10">
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
            Last 30 Days
          </p>
          <p className="balance-xl mt-2" style={{ color: "#fff" }}>
            {formatCurrency(data.monthlyBurn)}
          </p>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            {data.monthlyTransactions} transaction{data.monthlyTransactions !== 1 ? "s" : ""} &middot; since {data.windowStart}
          </p>
        </div>
        {/* Decorative gradient orb */}
        <div
          className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #4f7df7, transparent)" }}
        />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            AI Subscriptions
          </p>
          <p className="balance-lg mt-2" style={{ color: "var(--accent-blue)" }}>
            {formatCurrency(data.subscriptionMonthly ?? 0, "USD")}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {data.activeSubsCount ?? 0} active &middot; per month
          </p>
        </div>

        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            AI Token Costs
          </p>
          <p className="balance-lg mt-2" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(data.aiCostsMtd, "USD")}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>last 30 days</p>
        </div>

        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Portfolio
          </p>
          <p className="balance-lg mt-2" style={{ color: data.portfolio ? "var(--accent-green)" : "var(--text-muted)" }}>
            {data.portfolio ? formatCurrency(data.portfolio.netLiquidation) : "—"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {data.portfolio ? `as of ${data.portfolio.date}` : "not connected"}
          </p>
        </div>
      </div>

      {/* Spending Breakdown + Recent Transactions */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Donut */}
        {pieData.length > 0 && (
          <div className="md:col-span-2 finance-card flex flex-col items-center">
            <p className="text-xs font-medium uppercase tracking-wide self-start" style={{ color: "var(--text-muted)" }}>
              By Category
            </p>
            <div className="w-44 h-44 mt-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    dataKey="value"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={DOMAIN_COLORS[pieData[i].name] ?? "#555"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Total</span>
                <span className="text-lg font-bold mono" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(totalSpent)}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-2 w-full">
              {pieData.map((d: any) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="category-dot" style={{ background: DOMAIN_COLORS[d.name] ?? "#555" }} />
                    <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                  </div>
                  <span className="text-xs mono font-medium" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className={`${pieData.length > 0 ? "md:col-span-3" : "md:col-span-5"} finance-card`}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Recent Activity
          </p>
          {data.recentExpenses.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-3" style={{ background: "var(--bg-input)" }}>
                💸
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No transactions yet</p>
              <a href="/expenses" className="text-sm mt-2 font-medium" style={{ color: "var(--accent-blue)" }}>
                Add your first expense →
              </a>
            </div>
          ) : (
            <div className="mt-2">
              {data.recentExpenses.map((expense: any) => (
                <div key={expense.id} className="tx-row">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{
                      background: DOMAIN_COLORS[expense.category?.domain ?? "general"] + "20",
                      color: DOMAIN_COLORS[expense.category?.domain ?? "general"],
                    }}
                  >
                    {expense.category?.icon ? expense.category.icon.charAt(0).toUpperCase() : "$"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {expense.description}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {expense.category?.name ?? "Uncategorized"} · {expense.date}
                    </p>
                  </div>
                  <span className="text-sm font-semibold mono" style={{ color: "var(--accent-red)" }}>
                    −{formatCurrency(expense.amount, expense.currency ?? "CNY")}
                  </span>
                </div>
              ))}
              <a
                href="/expenses"
                className="block text-center text-xs font-medium py-3 mt-2 rounded-xl"
                style={{ color: "var(--accent-blue)", background: "var(--bg-input)" }}
              >
                View all transactions →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
