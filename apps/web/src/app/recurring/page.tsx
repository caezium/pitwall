"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";
import { CardSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";

export default function RecurringPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const items = trpc.recurring.list.useQuery();
  const categories = trpc.expenses.categories.useQuery();
  const processDue = trpc.recurring.processDue.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
  });
  const create = trpc.recurring.create.useMutation({
    onSuccess: () => { utils.recurring.list.invalidate(); setShowForm(false); },
  });
  const del = trpc.recurring.delete.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate({
      description: form.get("description") as string,
      amount: Number(form.get("amount")),
      frequency: form.get("frequency") as "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly",
      nextDate: form.get("nextDate") as string,
      categoryId: (form.get("categoryId") as string) || undefined,
    });
  };

  if (items.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-56 rounded-lg" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      </div>
    );
  }
  if (items.error) return <QueryError error={items.error} onRetry={() => items.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Recurring Expenses</h1>
        <div className="flex gap-2">
          <button
            onClick={() => processDue.mutate()}
            disabled={processDue.isPending}
            className="btn btn-success"
          >
            {processDue.isPending ? "Processing..." : "Process Due"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-info"
          >
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      {processDue.data && (
        <div
          className="finance-card text-sm"
          style={{ borderColor: "rgba(52, 211, 153, 0.3)", color: "var(--accent-green)" }}
        >
          Processed {processDue.data.processed} recurring expense(s).
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="finance-card space-y-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Recurring Expense</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Description</label>
              <input
                name="description"
                required
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Frequency</label>
              <select
                name="frequency"
                className="w-full rounded-xl px-3 py-2.5 text-sm input input-bordered"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Next Date</label>
              <input
                name="nextDate"
                type="date"
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
                <option value="">None</option>
                {categories.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="btn btn-success"
          >
            {create.isPending ? "Saving..." : "Create"}
          </button>
        </form>
      )}

      {items.data?.length === 0 ? (
        <div className="finance-card flex flex-col items-center py-16">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: "var(--bg-input)" }}>
            🔁
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No recurring expenses</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>These auto-create expenses on schedule</p>
        </div>
      ) : (
        <div className="finance-card !p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Description</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Frequency</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Next Date</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Amount</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.data?.map((item: any) => (
                <tr key={item.id} className="group" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-5 py-3.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.description}</td>
                  <td className="px-5 py-3.5 text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{item.frequency}</td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>{formatDate(item.nextDate)}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono font-semibold" style={{ color: "var(--accent-red)" }}>
                    -{formatCurrency(item.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    <span
                      className="px-2.5 py-0.5 rounded-lg text-xs font-medium"
                      style={{
                        background: item.enabled ? "rgba(52, 211, 153, 0.15)" : "var(--bg-input)",
                        color: item.enabled ? "var(--accent-green)" : "var(--text-muted)",
                      }}
                    >
                      {item.enabled ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => del.mutate({ id: item.id })}
                      className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
