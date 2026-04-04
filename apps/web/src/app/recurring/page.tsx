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

  if (items.isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><CardSkeleton /><CardSkeleton /></div>;
  if (items.error) return <QueryError error={items.error} onRetry={() => items.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Recurring Expenses</h2>
        <div className="flex gap-2">
          <button
            onClick={() => processDue.mutate()}
            disabled={processDue.isPending}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {processDue.isPending ? "Processing..." : "Process Due"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            {showForm ? "Cancel" : "Add Recurring"}
          </button>
        </div>
      </div>

      {processDue.data && (
        <div className="bg-green-950/30 border border-green-900/50 rounded-xl p-4 text-sm text-green-400">
          Processed {processDue.data.processed} recurring expense(s).
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Description</label>
              <input name="description" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Amount</label>
              <input name="amount" type="number" step="0.01" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Frequency</label>
              <select name="frequency" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Next Date</label>
              <input name="nextDate" type="date" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Category</label>
              <select name="categoryId" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="">None</option>
                {categories.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={create.isPending} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50">
            {create.isPending ? "Saving..." : "Create"}
          </button>
        </form>
      )}

      {items.data?.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-zinc-500 text-sm">No recurring expenses. These auto-create expenses on schedule.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Next Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.data?.map((item: any) => (
                <tr key={item.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400 capitalize">{item.frequency}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{formatDate(item.nextDate)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-400">-{formatCurrency(item.amount)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs ${item.enabled ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                      {item.enabled ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => del.mutate({ id: item.id })} className="text-xs text-zinc-600 hover:text-red-400">Delete</button>
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
