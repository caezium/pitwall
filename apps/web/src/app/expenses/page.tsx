"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";
import { TagManager } from "@/components/tag-manager";
import { ReceiptUpload } from "@/components/receipt-upload";
import { Pagination } from "@/components/pagination";
import { ExportButton } from "@/components/export-button";
import { PageSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";

const LIMIT = 25;

export default function ExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const expenses = trpc.expenses.list.useQuery({ limit: LIMIT, offset });
  const categories = trpc.expenses.categories.useQuery();
  const exportData = trpc.export.expenses.useQuery({});
  const updateExpense = trpc.expenses.update.useMutation({
    onSuccess: () => utils.expenses.list.invalidate(),
  });
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      setShowForm(false);
      setSelectedTags([]);
    },
  });
  const deleteExpense = trpc.expenses.delete.useMutation({
    onSuccess: () => utils.expenses.list.invalidate(),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createExpense.mutate({
      description: form.get("description") as string,
      amount: Number(form.get("amount")),
      date: form.get("date") as string,
      categoryId: (form.get("categoryId") as string) || undefined,
      eventName: (form.get("eventName") as string) || undefined,
      trackName: (form.get("trackName") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      tagIds: selectedTags.length > 0 ? selectedTags : undefined,
    });
  };

  if (expenses.isLoading) return <PageSkeleton />;
  if (expenses.error) return <QueryError error={expenses.error} onRetry={() => expenses.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <div className="flex gap-2">
          <ExportButton data={exportData.data} filename="expenses.csv" />
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            {showForm ? "Cancel" : "Add Expense"}
          </button>
        </div>
      </div>

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
              <label className="block text-sm text-zinc-400 mb-1">Date</label>
              <input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Category</label>
              <select name="categoryId" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Uncategorized</option>
                {categories.data?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Event Name</label>
              <input name="eventName" placeholder="e.g. Spring Series Round 3" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Track Name</label>
              <input name="trackName" placeholder="e.g. NJMP" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes</label>
            <textarea name="notes" rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <TagManager selectedTagIds={selectedTags} onChange={setSelectedTags} />
          <button type="submit" disabled={createExpense.isPending} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50">
            {createExpense.isPending ? "Saving..." : "Save Expense"}
          </button>
        </form>
      )}

      {/* Expense List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {expenses.data?.length === 0 ? (
          <p className="p-6 text-zinc-500 text-sm">No expenses yet. Click &quot;Add Expense&quot; to get started.</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.data?.map((expense: any) => (
                  <tr key={expense.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-sm text-zinc-400">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3 text-sm">
                      {expense.description}
                      {expense.eventName && <span className="text-xs text-zinc-500 ml-2">{expense.eventName}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{expense.category?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-1 flex-wrap">
                        {expense.expenseTags?.map((et: any) => (
                          <span key={et.tag.id} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">{et.tag.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <ReceiptUpload
                        expenseId={expense.id}
                        currentUrl={expense.receiptUrl}
                        onUploaded={(url) => updateExpense.mutate({ id: expense.id, receiptUrl: url } as any)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-red-400">-{formatCurrency(expense.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteExpense.mutate({ id: expense.id })} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-zinc-800">
              <Pagination
                offset={offset}
                limit={LIMIT}
                hasMore={(expenses.data?.length ?? 0) >= LIMIT}
                onPrev={() => setOffset(Math.max(0, offset - LIMIT))}
                onNext={() => setOffset(offset + LIMIT)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
