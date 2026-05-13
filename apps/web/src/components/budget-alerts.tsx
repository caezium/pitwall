"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";

type BudgetStatus = {
  id: string;
  name: string;
  overBudget: boolean;
  percentUsed: number;
  spent: number;
  amount: number;
};

export function BudgetAlerts() {
  const budgetStatus = trpc.budgets.status.useQuery();

  const alerts = (budgetStatus.data as BudgetStatus[] | undefined)?.filter(
    (b) => b.overBudget || b.percentUsed > 80
  ) ?? [];

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((b) => (
        <div
          key={b.id}
          role="alert"
          className={`alert rounded-2xl ${b.overBudget ? "alert-error" : "alert-warning"}`}
        >
          <div className="flex-1">
            <strong>{b.overBudget ? "Over budget" : "Near limit"}:</strong>{" "}
            {b.name}
          </div>
          <span className="font-mono text-sm">
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
