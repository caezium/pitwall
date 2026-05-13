"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CardSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";

export default function BudgetsPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const budgetStatus = trpc.budgets.status.useQuery();
  const categories = trpc.expenses.categories.useQuery();
  const forecast = trpc.budgets.forecast.useQuery({ months: 3 });
  const createBudget = trpc.budgets.create.useMutation({
    onSuccess: () => { utils.budgets.status.invalidate(); utils.budgets.forecast.invalidate(); setShowForm(false); },
  });
  const deleteBudget = trpc.budgets.delete.useMutation({
    onSuccess: () => { utils.budgets.status.invalidate(); utils.budgets.forecast.invalidate(); },
  });

  if (budgetStatus.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 rounded-lg" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      </div>
    );
  }
  if (budgetStatus.error) return <QueryError error={budgetStatus.error} onRetry={() => budgetStatus.refetch()} />;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createBudget.mutate({
      name: form.get("name") as string,
      categoryId: (form.get("categoryId") as string) || undefined,
      amount: Number(form.get("amount")),
      period: form.get("period") as "monthly" | "quarterly" | "yearly",
      rollover: form.get("rollover") === "on",
      startDate: new Date().toISOString().split("T")[0],
    });
  };

  // Budget vs Actual bar chart data
  const barData = budgetStatus.data?.map((b: any) => ({
    name: b.name.length > 12 ? b.name.slice(0, 12) + "..." : b.name,
    budget: b.amount,
    spent: b.spent,
  })) ?? [];

  // Forecast chart data
  const forecastData = [
    ...(forecast.data?.historical ?? []).map((m: any) => ({ month: m.month, actual: m.total, projected: null as number | null })),
    ...(forecast.data?.forecast ?? []).map((f: any) => ({ month: f.month, actual: null as number | null, projected: f.projected })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Budgets</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`btn ${showForm ? "btn-secondary" : "btn-primary"}`}
        >
          {showForm ? "Cancel" : "Add Budget"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="finance-card space-y-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Budget</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Name</label>
              <input
                name="name"
                required
                placeholder="e.g. Monthly Karting"
                className="w-full rounded-xl px-3 py-2.5 text-sm input input-bordered"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Amount</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                className="w-full rounded-xl px-3 py-2.5 text-sm input input-bordered"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Category</label>
              <select
                name="categoryId"
                className="w-full rounded-xl px-3 py-2.5 text-sm input input-bordered"
              >
                <option value="">All expenses</option>
                {categories.data?.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Period</label>
              <select
                name="period"
                className="w-full rounded-xl px-3 py-2.5 text-sm input input-bordered"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="flex items-center gap-2 col-span-full">
              <input name="rollover" type="checkbox" id="rollover" className="rounded" />
              <label htmlFor="rollover" className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Rollover unused budget to next period
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={createBudget.isPending}
            className="btn btn-success"
          >
            {createBudget.isPending ? "Saving..." : "Create Budget"}
          </button>
        </form>
      )}

      {/* Budget Cards with Progress */}
      {budgetStatus.data?.length === 0 ? (
        <div className="finance-card flex flex-col items-center py-16">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: "var(--bg-input)" }}>
            📋
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No budgets yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Click &quot;Add Budget&quot; to create your first budget</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetStatus.data?.map((b: any) => (
            <div key={b.id} className="finance-card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{b.name}</h3>
                  <p className="text-xs capitalize mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {b.period} &middot; {b.category?.name ?? "All expenses"}
                  </p>
                </div>
                <button
                  onClick={() => deleteBudget.mutate({ id: b.id })}
                  className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  Delete
                </button>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="mono text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: b.overBudget ? "var(--accent-red)" : "var(--accent-green)" }}
                  >
                    {b.overBudget ? `Over by ${formatCurrency(Math.abs(b.remaining))}` : `${formatCurrency(b.remaining)} left`}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(b.percentUsed, 100)}%`,
                      background: b.overBudget ? "var(--accent-red)" : b.percentUsed > 80 ? "#f59e0b" : "var(--accent-green)",
                    }}
                  />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                {b.periodRange.start} to {b.periodRange.end}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Budget vs Actual Bar Chart */}
      {barData.length > 0 && (
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Budget vs Actual</p>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis tickFormatter={(v) => `$${v}`} stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  formatter={(v: any) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                  itemStyle={{ color: "var(--text-primary)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
                <Bar dataKey="budget" fill="var(--accent-blue)" radius={[6, 6, 0, 0]} name="Budget" />
                <Bar dataKey="spent" fill="var(--accent-red)" radius={[6, 6, 0, 0]} name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecastData.length > 0 && (
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>3-Month Forecast</p>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            Rolling average: <span className="mono font-medium" style={{ color: "var(--text-primary)" }}>{formatCurrency(forecast.data?.avgMonthly ?? 0)}</span> / month
          </p>
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData}>
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                <YAxis tickFormatter={(v) => `$${v}`} stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  formatter={(v: any) => v ? formatCurrency(v) : "-"}
                  contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                  itemStyle={{ color: "var(--text-primary)" }}
                />
                <Bar dataKey="actual" fill="var(--accent-blue)" radius={[6, 6, 0, 0]} name="Actual" />
                <Bar dataKey="projected" fill="rgba(79, 125, 247, 0.4)" radius={[6, 6, 0, 0]} name="Projected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
