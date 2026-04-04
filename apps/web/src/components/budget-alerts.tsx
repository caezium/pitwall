"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";

export function BudgetAlerts() {
  const budgetStatus = trpc.budgets.status.useQuery();

  const alerts = budgetStatus.data?.filter(
    (b: any) => b.overBudget || b.percentUsed > 80
  ) ?? [];

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((b: any) => (
        <div
          key={b.id}
          className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm ${
            b.overBudget
              ? "bg-red-950/40 border border-red-900/50 text-red-400"
              : "bg-yellow-950/40 border border-yellow-900/50 text-yellow-400"
          }`}
        >
          <span>
            {b.overBudget ? "Over budget" : "Near limit"}: <strong>{b.name}</strong>
          </span>
          <span className="font-mono">
            {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
            <span className="ml-2 text-xs opacity-70">
              ({Math.round(b.percentUsed)}%)
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
