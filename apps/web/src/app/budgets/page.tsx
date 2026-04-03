"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";

export default function BudgetsPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const budgetStatus = trpc.budgets.status.useQuery();
  const categories = trpc.expenses.categories.useQuery();
  const forecast = trpc.budgets.forecast.useQuery({ months: 3 });
  const createBudget = trpc.budgets.create.useMutation({
    onSuccess: () => {
      utils.budgets.status.invalidate();
      setShowForm(false);
    },
  });
  const deleteBudget = trpc.budgets.delete.useMutation({
    onSuccess: () => utils.budgets.status.invalidate(),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createBudget.mutate({
      name: form.get("name") as string,
      categoryId: (form.get("categoryId") as string) || undefined,
      amount: Number(form.get("amount")),
      period: form.get("period") as "monthly" | "quarterly" | "yearly",
      startDate: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Budgets</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
        >
          {showForm ? "Cancel" : "Add Budget"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name</label>
              <input
                name="name"
                required
                placeholder="e.g. Monthly Karting"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Amount
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Category
              </label>
              <select
                name="categoryId"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All expenses</option>
                {categories.data?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Period
              </label>
              <select
                name="period"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={createBudget.isPending}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createBudget.isPending ? "Saving..." : "Create Budget"}
          </button>
        </form>
      )}

      {/* Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetStatus.data?.map((b) => (
          <div
            key={b.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold">{b.name}</h3>
                <p className="text-xs text-zinc-500 capitalize">
                  {b.period} &middot; {b.category?.name ?? "All expenses"}
                </p>
              </div>
              <button
                onClick={() => deleteBudget.mutate({ id: b.id })}
                className="text-xs text-zinc-600 hover:text-red-400"
              >
                Delete
              </button>
            </div>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">
                  {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
                </span>
                <span
                  className={
                    b.overBudget ? "text-red-400" : "text-green-400"
                  }
                >
                  {b.overBudget
                    ? `Over by ${formatCurrency(Math.abs(b.remaining))}`
                    : `${formatCurrency(b.remaining)} left`}
                </span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    b.overBudget
                      ? "bg-red-500"
                      : b.percentUsed > 80
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-zinc-600">
              {b.periodRange.start} to {b.periodRange.end}
            </p>
          </div>
        ))}
        {budgetStatus.data?.length === 0 && (
          <p className="text-zinc-500 text-sm col-span-2">
            No budgets yet. Click &quot;Add Budget&quot; to set spending limits.
          </p>
        )}
      </div>

      {/* Forecast */}
      {forecast.data && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">3-Month Forecast</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Based on rolling average:{" "}
            <span className="font-mono text-zinc-200">
              {formatCurrency(forecast.data.avgMonthly)}
            </span>{" "}
            / month
          </p>
          <div className="space-y-2">
            {forecast.data.historical.map((m) => (
              <div key={m.month} className="flex justify-between text-sm">
                <span className="text-zinc-400">{m.month}</span>
                <span className="font-mono">{formatCurrency(m.total)}</span>
              </div>
            ))}
            {forecast.data.forecast.map((f) => (
              <div
                key={f.month}
                className="flex justify-between text-sm text-zinc-500 italic"
              >
                <span>{f.month} (projected)</span>
                <span className="font-mono">
                  {formatCurrency(f.projected)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
