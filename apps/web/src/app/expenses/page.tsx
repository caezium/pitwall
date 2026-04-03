"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";

export default function ExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const expenses = trpc.expenses.list.useQuery();
  const categories = trpc.expenses.categories.useQuery();
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      setShowForm(false);
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
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
        >
          {showForm ? "Cancel" : "Add Expense"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Description
              </label>
              <input
                name="description"
                required
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
              <label className="block text-sm text-zinc-400 mb-1">Date</label>
              <input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
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
                <option value="">Uncategorized</option>
                {categories.data?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Event Name
              </label>
              <input
                name="eventName"
                placeholder="e.g. Spring Series Round 3"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Track Name
              </label>
              <input
                name="trackName"
                placeholder="e.g. NJMP"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={createExpense.isPending}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createExpense.isPending ? "Saving..." : "Save Expense"}
          </button>
        </form>
      )}

      {/* Expense List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {expenses.isLoading ? (
          <p className="p-6 text-zinc-500 text-sm">Loading...</p>
        ) : expenses.data?.length === 0 ? (
          <p className="p-6 text-zinc-500 text-sm">
            No expenses yet. Click &quot;Add Expense&quot; to get started.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.data?.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-4 py-3 text-sm">{expense.description}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {expense.category?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {expense.eventName ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-red-400">
                    -{formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteExpense.mutate({ id: expense.id })}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
